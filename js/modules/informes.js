/* Sistema I+D — Fase 4: Informes (pestaña Informes del proyecto y Formato de Cargas y Promediados).
   · El RR no se arma solo: se genera eligiendo proyecto, iteración, tipo (promediado o detallado), nombre y requisito,
     y añadiendo con un botón los registros promediados que entran. Se llena desde los datos (sin pasar por Excel):
     materiales de la receta, a/mc, CVD, consistencia, T° del concreto y ambiente, peso unitario, fragua, aire y la
     resistencia por edad (promedio combinado de R1, R2… o desglose por réplica).
   · Regla 7 (17025, 7.8): Borrador → En revisión → Aprobado → Emitido. Aprueba alguien con permiso que no lo elaboró.
     Aprobado o emitido ya no se edita: se crea una nueva versión con motivo.
   · Informe final del proyecto con el mismo circuito. */
'use strict';

var ESTADOS_INFORME = {
  borrador:{l:'Borrador', c:'tag-gris'}, en_revision:{l:'En revisión', c:'tag-naranja'},
  aprobado:{l:'Aprobado', c:'tag-celeste'}, emitido:{l:'Emitido', c:'tag-verde'}
};
var informesFinales = load('sid_informes_finales', []);
function saveInformesFinales(){ save('sid_informes_finales', informesFinales); }
function saveRR(){ save('sid10_rr', rrEstudios); }
function chipEstadoInforme(e){ var x = ESTADOS_INFORME[e.estado || 'borrador']; return '<span class="tag-pill ' + x.c + '">' + x.l + (e.version > 1 ? ' · v' + e.version : '') + '</span>'; }
function siguienteCodigoInforme(prefijo){
  var anio = new Date().getFullYear(), max = 0;
  rrEstudios.concat(informesFinales).forEach(function(e){ var m = new RegExp('^' + prefijo + '-(\\d{4})-(\\d+)$').exec(e.codigo || ''); if(m && Number(m[1]) === anio) max = Math.max(max, Number(m[2])); });
  return prefijo + '-' + anio + '-' + String(max + 1).padStart(3, '0');
}
function fechaHoyDMY(){ return isoToDMY(todayISO()); }

/* Los RR que ya existían pasan a Borrador con su código (se revisan y aprueban como cualquier otro) */
(function migrarRR(){
  var cambio = false;
  rrEstudios.forEach(function(e){
    if(e.estado) return;
    e.estado = 'borrador'; e.version = 1; e.codigo = siguienteCodigoInforme('RR');
    e.tipo = String(e.tipo || 'promediado').toLowerCase();
    e.proyecto = e.proyectoId ? proyectoNombre(e.proyectoId) : '';
    e.elaborado_por = ''; e.estados = [{estado:'borrador', por:'', en:new Date().toISOString(), motivo:'Reporte existente antes de la Fase 4'}];
    cambio = true;
  });
  if(cambio) saveRR();
})();
function rrEditable(e){ return !!e && can('rr:editar') && (e.estado || 'borrador') === 'borrador'; }

/* ================= CONSTRUIR EL RR DESDE LOS DATOS ================= */
function claveMaterial(nombre){ return 'mat_' + normalizar(nombre).replace(/[^a-z0-9]+/g, '_'); }
function aNumero(s){
  s = String(s == null ? '' : s).trim();
  if(!s || s === '-') return NaN;
  var m = /^(\d+)\s+(\d+)\/(\d+)$/.exec(s); if(m) return Number(m[1]) + Number(m[2]) / Number(m[3]);
  m = /^(\d+)\/(\d+)$/.exec(s); if(m) return Number(m[1]) / Number(m[2]);
  return /^-?\d+([.,]\d+)?$/.test(s) ? Number(s.replace(',', '.')) : NaN;
}
function combinarValores(vals){
  vals = vals.filter(function(v){ return v !== '' && v != null && v !== '-'; });
  if(!vals.length) return '';
  var nums = vals.map(aNumero);
  if(nums.every(isFinite)) return String(+promedio(nums).toFixed(2));
  return vals[0];
}
var CAMPOS_FRESCO_RR = [
  ['cons_0', 'slump', 0], ['cons_30', 'slump', 1], ['cons_60', 'slump', 2], ['cons_90', 'slump', 3], ['cons_120', 'slump', 4],
  ['tc_0', 'tempc', 0], ['tc_30', 'tempc', 1], ['tc_60', 'tempc', 2], ['tc_90', 'tempc', 3], ['tc_120', 'tempc', 4],
  ['ta_0', 'tempa', 0], ['ta_30', 'tempa', 1], ['ta_60', 'tempa', 2], ['ta_90', 'tempa', 3], ['ta_120', 'tempa', 4],
  ['pu', 'pesoUnitario'], ['fragua_i', 'thermoIni'], ['fragua_f', 'thermoFin'], ['aire', 'aire'], ['cohesividad', 'cohesividad'], ['apariencia', 'apariencia']
];
function valoresDeDiseno(d, repIdx){
  var v = {};
  (d.mix || []).forEach(function(it){
    if(n(it.pesoSeco) <= 0) return;
    var k = claveMaterial(it.nombre);
    v[k] = String(+n(it.pesoSeco).toFixed(2));
    if(it.dosis) v['d_' + k] = String(it.dosis);
  });
  v.ac = d.amcEfectiva || '';
  v.cvd = d.cvdTotal ? Number(d.cvdTotal).toFixed(2) : '';
  var res = (d.resultados && d.resultados.replicas) || [];
  var indices = repIdx === null || repIdx === undefined ? res.map(function(r, i){ return i; }) : [repIdx];
  CAMPOS_FRESCO_RR.forEach(function(c){
    v[c[0]] = combinarValores(indices.map(function(i){
      var r = res[i]; if(!r) return '';
      return c.length === 3 ? ((r.slump || [])[c[2]] || {})[c[1]] || '' : r[c[1]] || '';
    }));
  });
  v.comentarios = indices.map(function(i){ return (res[i] || {}).observaciones || ''; }).filter(Boolean).join(' / ') || '-';
  return v;
}
function filasMaterialesDe(lista){
  var mats = [], dosis = [], vistos = {};
  lista.forEach(function(d){
    (d.mix || []).forEach(function(it){
      if(n(it.pesoSeco) <= 0) return;
      var k = claveMaterial(it.nombre);
      if(vistos[k]) return;
      vistos[k] = true;
      mats.push({t:'row', key:k, label:it.nombre, unit:'kg'});
      if(it.dosis) dosis.push({t:'row', key:'d_' + k, label:it.nombre, unit:'%'});
    });
  });
  return {materiales:mats, dosis:dosis};
}
/* Registros promediados de un proyecto: diseños con al menos una rotura registrada */
function registrosPromediados(proyecto, iteracion){
  return disenos.filter(function(d){
    if(proyecto && proyectoNombre(d.proyectoId) !== proyecto) return false;
    if(iteracion && d.iteracionId !== iteracion) return false;
    return cargasDeDiseno(d).some(function(c){ return c.estado === 'completado'; });
  });
}
function contenidoRR(lista, tipo, requisito){
  var tipos = [], k = 0;
  lista.forEach(function(d){
    if(tipo === 'detallado'){
      (d.replicaObjs || []).forEach(function(rep, i){ tipos.push({id:'t' + (++k), nombre:rep.nombre, origenDisenoCodigo:d.codigo, replica:i, valores:valoresDeDiseno(d, i)}); });
    } else tipos.push({id:'t' + (++k), nombre:diseñoTitulo(d), origenDisenoCodigo:d.codigo, valores:valoresDeDiseno(d, null)});
  });
  var edadesSet = {};
  lista.forEach(function(d){ cargasDeDiseno(d).forEach(function(c){ if(c.estado === 'completado') edadesSet[c.dia] = true; }); });
  var edades = Object.keys(edadesSet).map(Number).sort(function(a,b){ return a - b; }).map(function(dia){
    var valores = {};
    tipos.forEach(function(t){
      var d = disenoPorCodigo(t.origenDisenoCodigo);
      if(!d) return;
      valores[t.id] = t.replica !== undefined ? (promedioReplicaEdad(d, d.replicaObjs[t.replica], dia) || '') : ((nombreUnificadoPromedio(d)[dia] || {}).promedio || '');
    });
    return {edad:dia + ' d', requisito:requisito || '', valores:valores};
  });
  var f = filasMaterialesDe(lista);
  return {tipos:tipos, edades:edades, filasMateriales:f.materiales, filasDosis:f.dosis};
}

/* ================= NUEVO RR (desde Informes) ================= */
var nrr = {proyecto:'', fijo:false, sel:[]};
function abrirNuevoRR(proyecto, fijo){
  if(!exigir('rr:editar')) return;
  nrr = {proyecto:proyecto || proyectoFlujo || PROYECTO_CATALOGO[0] || '', fijo:!!fijo, sel:[]};
  var m = document.getElementById('nuevo-rr-modal');
  if(!m){
    document.body.insertAdjacentHTML('beforeend', '<div id="nuevo-rr-modal" class="sid-modal"><div class="modal-card wide"><div class="modal-header"><div><h3>Nuevo Reporte RR</h3><div class="nota-sm">Se llena con los datos del sistema: receta, estado fresco y resistencias por edad.</div></div><button class="modal-close" data-close="nuevo-rr-modal">×</button></div>' +
      '<div class="modal-body" id="nrr-body"></div><div class="modal-actions"><button class="btn-add verde" id="nrr-generar">Generar RR</button><button class="btn-add ghost" data-close="nuevo-rr-modal">Cancelar</button></div></div></div>');
    m = document.getElementById('nuevo-rr-modal');
    m.addEventListener('change', function(e){
      if(e.target.id === 'nrr-proyecto'){ nrr.proyecto = e.target.value; nrr.sel = []; document.getElementById('nrr-iteracion').innerHTML = opcionesIteracionesHtml(nrr.proyecto, ''); }
      if(e.target.id === 'nrr-proyecto' || e.target.id === 'nrr-iteracion') renderNrrLista();
    });
    m.addEventListener('click', function(e){
      var b = e.target.closest('[data-nrr-add]');
      if(b){ var c = b.dataset.nrrAdd, i = nrr.sel.indexOf(c); if(i === -1) nrr.sel.push(c); else nrr.sel.splice(i, 1); renderNrrLista(); }
    });
    document.getElementById('nrr-generar').addEventListener('click', generarNuevoRR);
  }
  document.getElementById('nrr-body').innerHTML = '<div class="pred-form">' +
    '<div class="pp-field"><label>Proyecto</label><select id="nrr-proyecto"' + (nrr.fijo ? ' disabled' : '') + '>' + PROYECTO_CATALOGO.map(function(p){ return '<option' + (p === nrr.proyecto ? ' selected' : '') + '>' + esc(p) + '</option>'; }).join('') + '</select></div>' +
    '<div class="pp-field"><label>Iteración</label><select id="nrr-iteracion">' + opcionesIteracionesHtml(nrr.proyecto, '') + '</select></div>' +
    '<div class="pp-field"><label>Tipo</label><div class="elab-tipo"><label class="pp-check-inline"><input type="radio" name="nrr-tipo" value="promediado" checked> Promediado</label><label class="pp-check-inline"><input type="radio" name="nrr-tipo" value="detallado"> Detallado (por réplica)</label></div></div>' +
    '<div class="pp-field"><label>Requisito</label><input type="text" id="nrr-requisito" placeholder="Ej. f\'c 280 kg/cm² a 28 d"></div>' +
    '<div class="pp-field span-2"><label>Nombre del RR</label><input type="text" id="nrr-nombre" placeholder="Ej. Tipo I vs HE — a/mc 0.70"></div>' +
  '</div><div class="section-num" style="margin-top:12px;">Registros promediados <span class="nota-sm" id="nrr-cuenta"></span></div><div id="nrr-lista"></div>';
  renderNrrLista();
  abrirModal('nuevo-rr-modal');
}
function renderNrrLista(){
  var it = document.getElementById('nrr-iteracion').value;
  var lista = registrosPromediados(nrr.proyecto, it);
  document.getElementById('nrr-cuenta').textContent = nrr.sel.length + ' añadido(s)';
  document.getElementById('nrr-lista').innerHTML = lista.length ? '<div class="table-scroll"><table class="data-table"><thead><tr><th></th><th>Nombre unificado</th><th>Iteración</th><th>Estado</th><th>Promedio combinado por edad</th><th></th></tr></thead><tbody>' +
    lista.map(function(d){
      var comb = nombreUnificadoPromedio(d);
      var sel = nrr.sel.indexOf(d.codigo) > -1;
      return '<tr><td>' + semaforoDotHtml(semaforoChecklist(d)) + '</td><td><b class="nombre-tecnico">' + esc(diseñoTitulo(d)) + '</b><div class="nota-sm mono">' + esc(d.codigo) + '</div></td><td>' + esc(d.iteracionId || '—') + '</td><td>' + estadoDisenoHtml(d) + '</td>' +
        '<td class="mono">' + (Object.keys(comb).sort(function(a,b){ return a - b; }).map(function(dia){ return dia + 'd: <b>' + comb[dia].promedio + '</b>'; }).join(' · ') || '—') + '</td>' +
        '<td><button class="btn-add ' + (sel ? 'verde' : 'ghost') + '" data-nrr-add="' + esc(d.codigo) + '">' + (sel ? '✓ Añadido' : '+ Añadir') + '</button></td></tr>';
    }).join('') + '</tbody></table></div>' : '<p class="nota-sm">No hay registros promediados (diseños con roturas registradas) en este proyecto' + (it ? ' e iteración' : '') + '.</p>';
}
function generarNuevoRR(){
  var nombre = document.getElementById('nrr-nombre').value.trim();
  var tipo = (document.querySelector('input[name="nrr-tipo"]:checked') || {}).value || 'promediado';
  var requisito = document.getElementById('nrr-requisito').value.trim();
  if(!nombre){ toast('Indicá el nombre del RR'); return; }
  if(!nrr.sel.length){ toast('Añadí al menos un registro promediado'); return; }
  var lista = nrr.sel.map(disenoPorCodigo).filter(Boolean);
  var c = contenidoRR(lista, tipo, requisito);
  var ficha = fichaDeProyecto(nrr.proyecto) || {};
  var e = Object.assign({id:Lab.idNuevo('rr'), codigo:siguienteCodigoInforme('RR'), nombre:nombre, fecha:fechaHoyDMY(), proyectoId:nrr.proyecto, proyecto:nrr.proyecto,
    iteracion:document.getElementById('nrr-iteracion').value, tipo:tipo, requisito:requisito, generado:true, items:nrr.sel.slice(), obs:{},
    cabecera:{planta:(lista[0] && lista[0].planta) || '', ubicacion:'Laboratorio I+D', colaborador:inicialesUsuario(usuarioActual), responsable:nombreDe(ficha.responsable_id) || '', fecha:todayISO()},
    estado:'borrador', version:1, elaborado_por:usuarioActual.id, elaborado_en:new Date().toISOString(),
    estados:[{estado:'borrador', por:usuarioActual.id, en:new Date().toISOString(), motivo:''}]}, c);
  rrEstudios.push(e);
  saveRR();
  registrarHistorial('Generó', 'Informes', e.codigo + ' · ' + nombre + ' · ' + lista.length + ' registro(s) ' + tipo, {codigo:e.codigo, proyecto:nrr.proyecto, ref:e.id});
  cerrarModal('nuevo-rr-modal');
  toast('RR ' + e.codigo + ' generado en Borrador');
  abrirRR(e.id);
}
function abrirRR(id){
  rrActiveId = id;
  rrVista = 'informes';
  showPanel('reporte-rr');
}
/* Mientras está en Borrador se puede volver a llenar con los datos actuales */
function actualizarRRDesdeDatos(e){
  if(!rrEditable(e)) return;
  var lista = (e.items || []).map(disenoPorCodigo).filter(Boolean);
  if(!lista.length){ toast('Este RR no tiene registros del sistema para actualizar'); return; }
  var c = contenidoRR(lista, e.tipo, e.requisito);
  Object.assign(e, c);
  saveRR();
  registrarHistorial('Actualizó', 'Informes', e.codigo + ' · ' + e.nombre + ' desde los datos', {codigo:e.codigo, proyecto:e.proyecto, ref:e.id});
  toast('RR actualizado con los datos actuales');
  renderRRDetail();
}

/* ================= CIRCUITO DE APROBACIÓN (regla 7) ================= */
function cambiarEstadoInforme(inf, nuevo, motivo, alTerminar){
  var yo = usuarioActual.id, ahora = new Date().toISOString(), antes = inf.estado || 'borrador';
  if(nuevo === 'en_revision'){
    if(!exigir('rr:editar')) return;
    if(antes !== 'borrador') return;
    if(inf.tipo !== 'final' && !(inf.tipos || []).length){ toast('El RR no tiene registros'); return; }
  }
  if(nuevo === 'aprobado' || nuevo === 'emitido'){
    if(!exigir('informes:aprobar', 'Solo un responsable con permiso de aprobar informes puede hacerlo')) return;
    if(nuevo === 'aprobado' && antes !== 'en_revision'){ toast('Primero se envía a revisión'); return; }
    if(nuevo === 'aprobado' && inf.elaborado_por === yo && usuarioActual.rol !== 'admin'){ toast('Quien elaboró el informe no puede aprobarlo: lo revisa y aprueba otro responsable'); return; }
    if(nuevo === 'emitido' && antes !== 'aprobado'){ toast('Un informe no se emite sin revisión y aprobación'); return; }
  }
  if(nuevo === 'borrador' && antes === 'en_revision' && !can('informes:aprobar') && inf.elaborado_por !== yo){ toast('Tu rol no tiene permiso para esta acción'); return; }
  inf.estado = nuevo;
  inf.motivo_estado = motivo || '';
  inf.estados = (inf.estados || []).concat({estado:nuevo, por:yo, en:ahora, motivo:motivo || ''});
  if(nuevo === 'aprobado'){ inf.revisado_por = yo; inf.revisado_en = ahora; inf.aprobado_por = yo; inf.aprobado_en = ahora; }
  if(nuevo === 'emitido'){ inf.emitido_por = yo; inf.emitido_en = ahora; }
  if(nuevo === 'borrador'){
    if(antes === 'aprobado' || antes === 'emitido') inf.version = (inf.version || 1) + 1;
    ['revisado_por','revisado_en','aprobado_por','aprobado_en','emitido_por','emitido_en'].forEach(function(k){ delete inf[k]; });
  }
  if(inf.tipo === 'final') saveInformesFinales(); else saveRR();
  registrarHistorial('Cambió estado', 'Informes', inf.codigo + ' · ' + inf.nombre + ': ' + ESTADOS_INFORME[antes].l + ' → ' + ESTADOS_INFORME[nuevo].l,
    {codigo:inf.codigo, proyecto:inf.proyecto || '', ref:inf.id, antes:{estado:antes}, despues:{estado:nuevo, version:inf.version || 1}, motivo:motivo || ''});
  toast(inf.codigo + ': ' + ESTADOS_INFORME[nuevo].l);
  if(alTerminar) alTerminar();
}
function botonesEstadoHtml(inf){
  var e = inf.estado || 'borrador', b = [];
  if(e === 'borrador') b.push('<button class="btn-add" data-inf-acc="en_revision" data-perm="rr:editar">Enviar a revisión</button>');
  if(e === 'en_revision'){ b.push('<button class="btn-add verde" data-inf-acc="aprobado" data-perm="informes:aprobar">Revisar y aprobar</button>'); b.push('<button class="btn-add ghost" data-inf-acc="devolver">Devolver a borrador</button>'); }
  if(e === 'aprobado') b.push('<button class="btn-add verde" data-inf-acc="emitido" data-perm="informes:aprobar">Emitir</button>');
  if(e === 'aprobado' || e === 'emitido') b.push('<button class="btn-add ghost" data-inf-acc="version" data-perm="rr:editar">Nueva versión</button>');
  return b.join('');
}
function firmasHtml(inf){
  var f = function(et, id, en){ return id ? '<span><b>' + et + ':</b> ' + esc(nombreDe(id) || '—') + (en ? ' · ' + new Date(en).toLocaleDateString('es-PE') : '') + '</span>' : ''; };
  return [f('Elaboró', inf.elaborado_por, inf.elaborado_en), f('Revisó y aprobó', inf.aprobado_por, inf.aprobado_en), f('Emitió', inf.emitido_por, inf.emitido_en)].filter(Boolean).join('') || '<span class="nota-sm">Sin firmas todavía</span>';
}
function accionEstado(inf, acc, alTerminar){
  if(acc === 'devolver') pedirMotivo('Devolver ' + inf.codigo + ' a borrador', '<p>Indicá qué hay que corregir.</p>', function(m){ cambiarEstadoInforme(inf, 'borrador', m, alTerminar); });
  else if(acc === 'version') pedirMotivo('Nueva versión de ' + inf.codigo, '<p>El informe vuelve a Borrador como versión ' + ((inf.version || 1) + 1) + ' y deberá revisarse y aprobarse de nuevo.</p>', function(m){ cambiarEstadoInforme(inf, 'borrador', m, alTerminar); });
  else cambiarEstadoInforme(inf, acc, '', alTerminar);
}

/* ================= VISOR DEL RR (Formato de Cargas y Promediados › Informes RR) ================= */
function renderEstadoRR(){
  var bar = document.getElementById('rr-estado-bar');
  if(!bar){
    var tb = document.querySelector('#panel-reporte-rr .rr-toolbar');
    if(!tb) return;
    tb.insertAdjacentHTML('afterend', '<div id="rr-estado-bar" class="inf-estado-bar"></div>');
    bar = document.getElementById('rr-estado-bar');
    bar.addEventListener('click', function(e){
      var est = rrFind(rrActiveId), b = e.target.closest('[data-inf-acc]');
      if(!est || !b) return;
      if(b.dataset.infAcc === 'actualizar'){ actualizarRRDesdeDatos(est); return; }
      accionEstado(est, b.dataset.infAcc, function(){ renderRRStudyList(); renderRRDetail(); });
    });
  }
  var est = rrFind(rrActiveId);
  if(!est){ bar.innerHTML = ''; return; }
  bar.innerHTML = '<div class="inf-estado-main"><span class="mono"><b>' + esc(est.codigo || '') + '</b></span>' + chipEstadoInforme(est) +
    '<span class="nota-sm">' + esc((est.tipo === 'detallado' ? 'Detallado' : 'Promediado') + (est.iteracion ? ' · ' + est.iteracion : '') + (est.requisito ? ' · Requisito: ' + est.requisito : '')) + '</span></div>' +
    '<div class="inf-firmas">' + firmasHtml(est) + '</div>' +
    '<div class="flujo-botones">' + (rrEditable(est) && (est.items || []).length ? '<button class="btn-add ghost" data-inf-acc="actualizar">Actualizar desde los datos</button>' : '') + botonesEstadoHtml(est) + '</div>' +
    (est.estado !== 'emitido' ? '<div class="inf-marca">' + (est.estado === 'borrador' ? 'Borrador: se puede editar.' : 'Bloqueado para edición.') + ' No emitido: al exportarlo sale marcado como no emitido.</div>' : '');
}
var _renderRRDetailBase = renderRRDetail;
renderRRDetail = function(){
  _renderRRDetailBase();
  var est = rrFind(rrActiveId);
  if(est && !rrEditable(est)) document.querySelectorAll('#rr-zoom-area input').forEach(function(inp){ inp.readOnly = true; });
  document.querySelectorAll('#rr-add-tipo, #rr-add-edad').forEach(function(b){ b.style.display = est && rrEditable(est) && !est.generado ? '' : 'none'; });
  renderEstadoRR();
};
renderRRStudyList = function(){
  var wrap = document.getElementById('rr-study-list');
  var lista = rrEstudios.slice().sort(function(a,b){ return (b.elaborado_en || b.codigo || '').localeCompare(a.elaborado_en || a.codigo || ''); });
  wrap.innerHTML = lista.map(function(e){
    return '<div class="rr-study-card' + (e.id === rrActiveId ? ' active' : '') + '" data-id="' + esc(e.id) + '">' +
      '<h5>' + esc(e.nombre) + '</h5><span class="mono">' + esc(e.codigo || '') + '</span> ' + chipEstadoInforme(e) +
      '<span>' + (e.tipos || []).length + ' columnas · ' + esc(e.fecha || '') + (e.proyecto || e.proyectoId ? ' · ' + esc(e.proyecto || proyectoNombre(e.proyectoId)) : '') + '</span></div>';
  }).join('') || '<div class="empty-note">Todavía no hay reportes RR.</div>';
  document.getElementById('rr-count').textContent = rrEstudios.length + ' reportes';
  updateStats();
};
/* Las ediciones del visor solo valen en Borrador */
['rr-table-holder', 'rr-edad-holder', 'rr-print-head'].forEach(function(id){
  ['input', 'click'].forEach(function(tipo){
    document.getElementById(id).addEventListener(tipo, function(e){
      if(tipo === 'click' && !e.target.closest('.rr-del-col')) return;
      if(!rrEditable(rrFind(rrActiveId))){ e.stopImmediatePropagation(); e.preventDefault(); if(tipo === 'click') toast('El RR no está en Borrador: crea una nueva versión para cambiarlo'); }
    }, true);
  });
});
(function reemplazarGenerar(){
  var b = document.getElementById('btn-generar-rr');
  var nb = b.cloneNode(true);
  nb.textContent = '+ Nuevo RR';
  b.parentNode.replaceChild(nb, b);
  nb.addEventListener('click', function(){ abrirNuevoRR(proyectoFlujo, false); });
  var nuevoManual = document.querySelector('#panel-reporte-rr .rr-new-study');
  if(nuevoManual) nuevoManual.style.display = 'none';
})();

/* ================= INFORME FINAL DEL PROYECTO ================= */
function contenidoFinal(ficha){
  var r = resumenProyecto(ficha);
  var lista = r.disenos;
  return {
    proyecto:{codigo:ficha.codigo, nombre:ficha.nombre, tipo:tipoDe(ficha), responsable:nombreDe(ficha.responsable_id) || '', equipo:(ficha.equipo || []).map(nombreDe).filter(Boolean),
      fecha_inicio:ficha.fecha_inicio || '', fecha_fin:ficha.fecha_fin || ''},
    objetivos:(ficha.objetivos || []).map(function(o){ var c = cumplimientoObjetivo(o, lista); return {texto:textoObjetivo(o), valor:isFinite(c.valor) ? fmt(c.valor, 1) : '', estado:c.estado}; }),
    avance:{disenos:lista.length, cerrados:r.cerrados, pct:r.avancePct},
    disenos:lista.map(function(d){ var rp = resistenciaPorEdad(d); return {codigo:d.codigo, nombre:diseñoTitulo(d), iteracion:d.iteracionId || '', estado:estadoCalculado(d), resistencias:Object.keys(rp).sort(function(a,b){ return a - b; }).map(function(e){ return e + 'd: ' + fmt(rp[e], 1); }).join(' · ')}; }),
    rr:rrEstudios.filter(function(e){ return (e.proyecto || proyectoNombre(e.proyectoId)) === ficha.nombre; }).map(function(e){ return {codigo:e.codigo, nombre:e.nombre, estado:ESTADOS_INFORME[e.estado || 'borrador'].l}; }),
    no_conformes:trabajosNoConformes.filter(function(t){ return t.proyecto === ficha.nombre; }).map(function(t){ return {codigo:t.codigo, caso:TIPOS_TNC[t.tipo] || t.tipo, estado:t.estado}; })
  };
}
function generarInformeFinal(nombreProyecto){
  if(!exigir('rr:editar')) return;
  var ficha = fichaDeProyecto(nombreProyecto);
  if(!ficha) return;
  if(informesFinales.some(function(f){ return f.proyecto === ficha.nombre && f.estado !== 'emitido'; })){ toast('Ya hay un informe final en curso para este proyecto'); return; }
  var ahora = new Date().toISOString();
  var inf = {id:Lab.idNuevo('if'), tipo:'final', codigo:siguienteCodigoInforme('IF'), nombre:'Informe final · ' + ficha.nombre, proyecto:ficha.nombre, fecha:fechaHoyDMY(),
    contenido:contenidoFinal(ficha), conclusiones:'', estado:'borrador', version:1, elaborado_por:usuarioActual.id, elaborado_en:ahora, estados:[{estado:'borrador', por:usuarioActual.id, en:ahora, motivo:''}]};
  informesFinales.push(inf);
  saveInformesFinales();
  registrarHistorial('Generó', 'Informes', inf.codigo + ' · ' + inf.nombre, {codigo:inf.codigo, proyecto:ficha.nombre, ref:inf.id});
  abrirInformeFinal(inf.id);
}
function finalPorId(id){ return informesFinales.filter(function(f){ return f.id === id; })[0] || null; }
function informeFinalHtml(inf){
  var c = inf.contenido, p = c.proyecto;
  var marca = inf.estado !== 'emitido' ? '<div class="inf-marca-agua">' + (ESTADOS_INFORME[inf.estado].l.toUpperCase()) + ' — NO EMITIDO</div>' : '';
  var tabla = function(cab, filas){ return '<table class="data-table"><thead><tr>' + cab.map(function(h){ return '<th>' + esc(h) + '</th>'; }).join('') + '</tr></thead><tbody>' + (filas.length ? filas.join('') : '<tr><td colspan="' + cab.length + '">—</td></tr>') + '</tbody></table>'; };
  return marca + '<div class="if-doc"><div class="if-cab"><div><h2>Informe final del proyecto</h2><div class="mono">' + esc(inf.codigo) + ' · versión ' + (inf.version || 1) + ' · ' + esc(inf.fecha) + '</div></div>' + chipEstadoInforme(inf) + '</div>' +
    '<h4>1. Proyecto</h4><p><b>' + esc(p.nombre) + '</b> (' + esc(p.codigo) + ') · ' + esc(p.tipo) + '<br>Responsable: ' + esc(p.responsable || '—') + ' · Equipo: ' + esc(p.equipo.join(', ') || '—') + '<br>Fechas: ' + (p.fecha_inicio ? isoToDMY(p.fecha_inicio) : '—') + ' – ' + (p.fecha_fin ? isoToDMY(p.fecha_fin) : '—') + '</p>' +
    '<h4>2. Objetivos y cumplimiento</h4>' + tabla(['Objetivo', 'Resultado', 'Cumplimiento'], c.objetivos.map(function(o){ return '<tr><td>' + esc(o.texto) + '</td><td>' + esc(o.valor || '—') + '</td><td>' + (o.estado === 'cumple' ? 'Cumple' : o.estado === 'no-cumple' ? 'No cumple' : 'Sin datos') + '</td></tr>'; })) +
    '<h4>3. Diseños (' + c.avance.cerrados + ' de ' + c.avance.disenos + ' cerrados · ' + c.avance.pct + ' %)</h4>' + tabla(['Código', 'Nombre unificado', 'Iteración', 'Estado', "Resistencia promedio (kg/cm²)"], c.disenos.map(function(d){ return '<tr><td class="mono">' + esc(d.codigo) + '</td><td>' + esc(d.nombre) + '</td><td>' + esc(d.iteracion || '—') + '</td><td>' + esc(d.estado) + '</td><td>' + esc(d.resistencias || '—') + '</td></tr>'; })) +
    '<h4>4. Reportes RR</h4>' + tabla(['Código', 'Nombre', 'Estado'], c.rr.map(function(r){ return '<tr><td class="mono">' + esc(r.codigo || '') + '</td><td>' + esc(r.nombre) + '</td><td>' + esc(r.estado) + '</td></tr>'; })) +
    '<h4>5. Trabajos no conformes</h4>' + tabla(['Código', 'Caso', 'Estado'], c.no_conformes.map(function(t){ return '<tr><td class="mono">' + esc(t.codigo) + '</td><td>' + esc(t.caso) + '</td><td>' + esc(t.estado) + '</td></tr>'; })) +
    '<h4>6. Conclusiones</h4>' + (rrEditable(inf) ? '<textarea id="if-conclusiones" rows="4" class="if-concl">' + esc(inf.conclusiones || '') + '</textarea>' : '<p>' + esc(inf.conclusiones || '—') + '</p>') +
    '<div class="if-firmas">' + firmasHtml(inf) + '</div></div>';
}
var finalAbiertoId = null;
function abrirInformeFinal(id){
  var inf = finalPorId(id);
  if(!inf) return;
  finalAbiertoId = id;
  if(!document.getElementById('final-modal')){
    document.body.insertAdjacentHTML('beforeend', '<div id="final-modal" class="sid-modal"><div class="modal-card wide"><div class="modal-header"><h3>Informe final del proyecto</h3><button class="modal-close" data-close="final-modal">×</button></div>' +
      '<div class="modal-body" id="final-body"></div><div class="modal-actions" id="final-acciones"></div></div></div>');
    document.getElementById('final-modal').addEventListener('click', function(e){
      var f = finalPorId(finalAbiertoId), b = e.target.closest('[data-inf-acc]');
      if(!f || !b) return;
      var acc = b.dataset.infAcc;
      if(acc === 'actualizar-final'){ f.contenido = contenidoFinal(fichaDeProyecto(f.proyecto)); saveInformesFinales(); abrirInformeFinal(f.id); toast('Informe actualizado con los datos actuales'); return; }
      if(acc === 'imprimir'){ imprimirInformeFinal(f); return; }
      accionEstado(f, acc, function(){ abrirInformeFinal(f.id); if(typeof expedienteProyecto !== 'undefined' && expedienteProyecto) renderExpediente(); });
    });
    document.getElementById('final-modal').addEventListener('change', function(e){
      if(e.target.id !== 'if-conclusiones') return;
      var f = finalPorId(finalAbiertoId);
      if(!rrEditable(f)) return;
      f.conclusiones = e.target.value; saveInformesFinales();
    });
  }
  document.getElementById('final-body').innerHTML = informeFinalHtml(inf);
  document.getElementById('final-acciones').innerHTML = (rrEditable(inf) ? '<button class="btn-add ghost" data-inf-acc="actualizar-final">Actualizar desde los datos</button>' : '') + botonesEstadoHtml(inf) +
    '<button class="btn-add ghost" data-inf-acc="imprimir">Imprimir / PDF</button>';
  abrirModal('final-modal');
}
function imprimirInformeFinal(inf){
  var css = 'body{font-family:Arial,Helvetica,sans-serif;color:#14181a;font-size:10pt;margin:14mm;}h2{margin:0 0 4px;}h4{margin:14px 0 6px;}table{width:100%;border-collapse:collapse;margin-bottom:6px;}th,td{border:1px solid #999;padding:3px 5px;text-align:left;font-size:9pt;}' +
    '.inf-marca-agua{position:fixed;top:40%;left:0;right:0;text-align:center;font-size:40pt;color:rgba(220,38,38,.18);transform:rotate(-20deg);font-weight:bold;}.if-cab{display:flex;justify-content:space-between;}.if-firmas span{display:block;margin-top:4px;}.tag-pill{border:1px solid #999;padding:2px 6px;border-radius:8px;}';
  var w = document.createElement('iframe');
  w.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
  document.body.appendChild(w);
  w.contentDocument.open();
  w.contentDocument.write('<!doctype html><html><head><meta charset="utf-8"><title>' + esc(inf.codigo) + '</title><style>' + css + '</style></head><body>' + informeFinalHtml(Object.assign({}, inf, {estado:inf.estado})).replace(/<textarea[^>]*>([\s\S]*?)<\/textarea>/, '<p>$1</p>') + '</body></html>');
  w.contentDocument.close();
  setTimeout(function(){ w.contentWindow.focus(); w.contentWindow.print(); setTimeout(function(){ if(w.parentNode) w.parentNode.removeChild(w); }, 1500); }, 250);
  registrarHistorial('Imprimió', 'Informes', inf.codigo + (inf.estado !== 'emitido' ? ' (no emitido)' : ''), {codigo:inf.codigo, proyecto:inf.proyecto, ref:inf.id});
}

/* ================= PESTAÑA INFORMES DEL PROYECTO ================= */
expReportesHtml = function(m){
  var lista = rrEstudios.filter(function(e){ return (e.proyecto || proyectoNombre(e.proyectoId)) === m.nombre || (e.tipos || []).some(function(t){ return m.disenos.some(function(d){ return d.codigo === t.origenDisenoCodigo; }); }); });
  var finales = informesFinales.filter(function(f){ return f.proyecto === m.nombre; });
  var barra = '<div class="ev-toolbar"><span class="section-num" style="margin:0;">Reportes RR</span>' +
    '<span class="ch-actions"><button class="btn-add ghost" data-ver-indicadores>' + CHART_ICON + ' Ver indicadores</button>' +
    '<button class="btn-add verde" data-nuevo-rr="' + esc(m.nombre) + '" data-perm="rr:editar">+ Nuevo RR</button></span></div>';
  var rr = lista.length ? '<div class="table-scroll"><table class="data-table"><thead><tr><th>Código</th><th>Nombre</th><th>Tipo</th><th>Registros</th><th>Estado</th><th>Firmas</th><th></th></tr></thead><tbody>' + lista.map(function(e){
    return '<tr><td class="mono"><b>' + esc(e.codigo || '') + '</b></td><td>' + esc(e.nombre) + (e.requisito ? '<div class="nota-sm">Requisito: ' + esc(e.requisito) + '</div>' : '') + '</td><td>' + (e.tipo === 'detallado' ? 'Detallado' : 'Promediado') + (e.iteracion ? '<div class="nota-sm">' + esc(e.iteracion) + '</div>' : '') + '</td>' +
      '<td>' + (e.tipos || []).length + '</td><td>' + chipEstadoInforme(e) + '</td><td class="inf-firmas-mini">' + firmasHtml(e) + '</td><td><button class="btn-add ghost" data-abrir-rr="' + esc(e.id) + '">Abrir</button></td></tr>';
  }).join('') + '</tbody></table></div>' : '<div class="empty-note">Todavía no hay reportes RR de este proyecto.</div>';
  var fin = '<div class="ev-toolbar"><span class="section-num" style="margin:0;">Informe final del proyecto</span><button class="btn-add verde" data-final-nuevo="' + esc(m.nombre) + '" data-perm="rr:editar">Generar informe final</button></div>' +
    (finales.length ? '<div class="table-scroll"><table class="data-table"><thead><tr><th>Código</th><th>Versión</th><th>Estado</th><th>Firmas</th><th></th></tr></thead><tbody>' + finales.map(function(f){
      return '<tr><td class="mono"><b>' + esc(f.codigo) + '</b></td><td>v' + (f.version || 1) + '</td><td>' + chipEstadoInforme(f) + '</td><td class="inf-firmas-mini">' + firmasHtml(f) + '</td><td><button class="btn-add ghost" data-final-abrir="' + esc(f.id) + '">Abrir</button></td></tr>';
    }).join('') + '</tbody></table></div>' : '<p class="nota-sm">Reúne objetivos y cumplimiento, diseños, resistencias, RR y no conformes. Se emite solo después de revisión y aprobación (17025, 7.8).</p>');
  return '<div class="card">' + barra + rr + '</div><div class="card" style="margin-top:16px;">' + fin + '</div>';
};
document.addEventListener('click', function(e){
  var n1 = e.target.closest('[data-nuevo-rr]');
  if(n1){ abrirNuevoRR(n1.dataset.nuevoRr, true); return; }
  var f1 = e.target.closest('[data-final-nuevo]');
  if(f1){ generarInformeFinal(f1.dataset.finalNuevo); return; }
  var f2 = e.target.closest('[data-final-abrir]');
  if(f2){ abrirInformeFinal(f2.dataset.finalAbrir); }
});
