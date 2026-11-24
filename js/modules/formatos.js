/* Sistema I+D — Fase 4: Formatos (sección 8). Vista general de todo el laboratorio, como las hojas de cálculo de hoy,
   con los mismos datos que están dentro de los proyectos (un dato, un lugar: se llena aquí o en el proyecto).
   Todas las tablas: editables en la celda · filtros por proyecto, iteración, código, responsable y rango de fechas ·
   semáforo y chips por fila · toda edición queda en el Historial con motivo · Exportar a Excel ·
   código y versión del formato (vendrán de Calidad › Documentos). */
'use strict';

var FORMATOS_DOC = {disenos:'doc_formato_disenos', fresco:'doc_formato_fresco', roturas:'doc_formato_roturas', cargas:'doc_formato_cargas'};
function docFormatoHtml(clave){
  var v = Lab.config(FORMATOS_DOC[clave]) || 'Código por definir';
  return '<span class="doc-formato" title="Código y versión del formato · se administran en Calidad › Documentos">' + esc(v) + '</span>';
}
function cabeceraFormatoHtml(clave, titulo, extra){
  return '<div class="fmt-cab"><div><h3>' + esc(titulo) + '</h3>' + docFormatoHtml(clave) + '</div><div class="fmt-cab-acc">' + (extra || '') + '</div></div>';
}

/* ================= FILTROS COMUNES ================= */
function opcionesProyectosHtml(sel){
  return '<option value="">Todos los proyectos</option>' + PROYECTO_CATALOGO.map(function(p){ return '<option' + (p === sel ? ' selected' : '') + '>' + esc(p) + '</option>'; }).join('');
}
function opcionesIteracionesHtml(proyecto, sel){
  var its = proyecto && typeof iteracionesDeProyecto === 'function' ? iteracionesDeProyecto(proyecto) : [];
  if(!proyecto){
    var todas = {}; disenos.forEach(function(d){ if(d.iteracionId) todas[d.iteracionId] = true; });
    its = Object.keys(todas).sort();
  }
  return '<option value="">Todas las iteraciones</option>' + its.map(function(i){ return '<option' + (i === sel ? ' selected' : '') + '>' + esc(i) + '</option>'; }).join('');
}
function filtrosFormatoHtml(pre){
  return '<div class="fmt-filtros" data-fmt="' + pre + '">' +
    '<select data-ff="proyecto">' + opcionesProyectosHtml('') + '</select>' +
    '<select data-ff="iteracion">' + opcionesIteracionesHtml('', '') + '</select>' +
    '<input type="search" data-ff="codigo" placeholder="Código o nombre">' +
    '<select data-ff="responsable"><option value="">Todos los responsables</option>' + usuariosActivos().map(function(u){ return '<option value="' + esc(u.id) + '">' + esc(u.nombre || u.usuario) + '</option>'; }).join('') + '</select>' +
    '<label class="fmt-fecha">Desde <input type="date" data-ff="desde"></label><label class="fmt-fecha">Hasta <input type="date" data-ff="hasta"></label>' +
    '<button type="button" class="btn-link" data-ff-limpiar>Limpiar</button>' +
  '</div>';
}
/* Monta la barra una sola vez (conserva lo elegido entre renders) */
function montarFiltros(pre, cont, alCambiar){
  var bar = cont.querySelector('.fmt-filtros[data-fmt="' + pre + '"]');
  if(bar){
    var p = bar.querySelector('[data-ff="proyecto"]'), v = p.value;
    p.innerHTML = opcionesProyectosHtml(v);
    return;
  }
  cont.insertAdjacentHTML('afterbegin', filtrosFormatoHtml(pre));
  bar = cont.querySelector('.fmt-filtros[data-fmt="' + pre + '"]');
  bar.addEventListener('change', function(e){
    if(e.target.dataset.ff === 'proyecto') bar.querySelector('[data-ff="iteracion"]').innerHTML = opcionesIteracionesHtml(e.target.value, '');
    alCambiar();
  });
  bar.addEventListener('input', function(e){ if(e.target.dataset.ff === 'codigo') alCambiar(); });
  bar.addEventListener('click', function(e){
    if(!e.target.closest('[data-ff-limpiar]')) return;
    bar.querySelectorAll('[data-ff]').forEach(function(x){ x.value = ''; });
    bar.querySelector('[data-ff="iteracion"]').innerHTML = opcionesIteracionesHtml('', '');
    alCambiar();
  });
}
function leerFiltros(pre){
  var f = {};
  document.querySelectorAll('.fmt-filtros[data-fmt="' + pre + '"] [data-ff]').forEach(function(x){ f[x.dataset.ff] = String(x.value || '').trim(); });
  return f;
}
function pasaFiltro(f, r){
  if(f.proyecto && r.proyecto !== f.proyecto) return false;
  if(f.iteracion && r.iteracion !== f.iteracion) return false;
  if(f.codigo){
    var q = normalizar(f.codigo), txt = normalizar(r.texto);
    // Un código (ID-0026, DID-0026, RR-2026-001) se compara completo: "ID-0026" no debe traer "DID-0026"
    var esCodigo = /^[a-z]{1,4}(-\d+)+$/.test(q);
    if(esCodigo ? !txt.split(/\s+/).some(function(t){ return t === q || t.indexOf(q + '-') === 0; }) : txt.indexOf(q) === -1) return false;
  }
  if(f.responsable){
    var u = usuarioPorId(f.responsable);
    var claves = [f.responsable, u && u.nombre, u && u.usuario, u && inicialesUsuario(u)].filter(Boolean).map(normalizar);
    if(!(r.responsables || []).filter(Boolean).some(function(x){ return claves.indexOf(normalizar(x)) > -1; })) return false;
  }
  if(f.desde && (!r.fecha || r.fecha < f.desde)) return false;
  if(f.hasta && (!r.fecha || r.fecha > f.hasta)) return false;
  return true;
}
function fechaDiseno(d){ return d.fechaElaboracionISO || dmyToISO(d.fecha) || ''; }
function registroDeDiseno(d){
  return {proyecto:proyectoNombre(d.proyectoId), iteracion:d.iteracionId || '', texto:d.codigo + ' ' + diseñoTitulo(d) + ' ' + (d.replicaObjs || []).map(function(r){ return r.codigo; }).join(' '),
    responsables:[d.asignadoA, nombreDe(d.asignadoA), d.responsable, d.colaborador], fecha:fechaDiseno(d)};
}

/* ================= EDICIÓN EN LA CELDA (regla 2: motivo si cambia un valor que ya existía) ================= */
function vacioCelda(v){ return v === undefined || v === null || v === false || String(v).trim() === ''; }
function editarCelda(op){
  if(String(vacioCelda(op.antes) ? '' : op.antes) === String(vacioCelda(op.despues) ? '' : op.despues)) return;
  var nuevo = vacioCelda(op.antes);
  var a = {}, b = {}; a[op.etiqueta] = op.antes; b[op.etiqueta] = op.despues;
  var fin = function(motivo){
    if(op.aplicar() === false){ op.refrescar(); return; }
    registrarHistorial(nuevo ? 'Registró' : 'Editó', op.entidad, op.codigo + ' · ' + op.etiqueta + ': ' + (nuevo ? '' : valorLegible(op.antes) + ' → ') + valorLegible(op.despues),
      {codigo:op.codigo, proyecto:op.proyecto || '', ref:op.ref || op.codigo, antes:nuevo ? undefined : a, despues:b, motivo:motivo || ''});
    op.refrescar();
  };
  if(nuevo){ fin(''); return; }
  op.refrescar();
  pedirMotivo('Editar ' + op.etiqueta + ' · ' + op.codigo, resumenCambioHtml({antes:a, despues:b}), fin);
}
function exportarFormato(nombre, cabecera, filas, clave){
  if(!exigir('datos:exportar')) return;
  var doc = Lab.config(FORMATOS_DOC[clave]) || '';
  if(exportarExcel(nombre + '.xlsx', [{nombre:nombre, filas:[[nombre + (doc ? ' · ' + doc : '')], ['Exportado ' + new Date().toLocaleString('es-PE')], [], cabecera].concat(filas)}])){
    registrarHistorial('Exportó', 'Formatos', nombre + ' · ' + filas.length + ' filas');
    toast(nombre + ' exportado a Excel');
  }
}
function estadoDisenoHtml(d){
  var e = estadoCalculado(d);
  return '<span class="tag-pill ' + (e === 'Cerrado' ? 'tag-verde' : 'tag-naranja') + '">' + e + '</span>';
}

/* ================= FORMATO DE DISEÑOS (D-CC-F-148) ================= */
var CAMPOS_EDIT_DISENO = {fc:"f'c (kg/cm²)", amcEfectiva:'a/mc efectiva', slump:'Slump objetivo', aire:'Aire objetivo (%)'};
function materialesResumen(d){
  return (d.mix || []).filter(function(it){ return n(it.pesoSeco) > 0; }).map(function(it){ return esc(it.nombre) + ' <b>' + fmt(it.pesoSeco, n(it.pesoSeco) < 20 ? 2 : 0) + '</b>'; }).join(' · ') || '—';
}
function disenosFormato(){
  var f = leerFiltros('dis');
  return disenos.filter(function(d){ return pasaFiltro(f, registroDeDiseno(d)); }).sort(function(a,b){ return (b.ts || 0) - (a.ts || 0); });
}
function renderFormatoDisenos(){
  var cont = document.getElementById('sub-tabla');
  if(!cont.querySelector('.fmt-cab')) cont.innerHTML = cabeceraFormatoHtml('disenos', 'Formato de Diseños', '<span class="badge-pill" id="fdis-cuenta"></span><button class="btn-add verde" data-fdis="nuevo" data-perm="disenos:crear">+ Nuevo diseño</button><button class="btn-add ghost" data-fdis="excel" data-perm="datos:exportar">Excel</button>') + '<div id="fdis-filtros"></div><div class="table-scroll fmt-scroll"><table class="data-table fmt-tabla" id="fdis-tabla"></table></div>';
  montarFiltros('dis', document.getElementById('fdis-filtros'), renderFormatoDisenos);
  var lista = disenosFormato();
  var editable = can('disenos:crear');
  document.getElementById('fdis-cuenta').textContent = lista.length + ' de ' + disenos.length + ' diseños';
  var celda = function(d, k){ return editable ? '<input type="text" class="fmt-in" data-fdis-campo="' + k + '" data-codigo="' + esc(d.codigo) + '" value="' + esc(d[k] || '') + '">' : esc(d[k] || '—'); };
  document.getElementById('fdis-tabla').innerHTML = '<thead><tr><th></th><th>Código</th><th>Nombre unificado</th><th>Proyecto</th><th>Iteración</th><th>Fecha</th><th>Asignado a</th><th>f\'c</th><th>a/mc</th><th>Slump</th><th>Aire %</th><th>Materiales (kg/m³)</th><th>CVD S/.</th><th>Réplicas (código)</th><th>Estado</th><th></th></tr></thead><tbody>' +
    (lista.length ? lista.map(function(d){
      return '<tr><td>' + semaforoDotHtml(semaforoChecklist(d)) + '</td><td class="mono"><b>' + esc(d.codigo) + '</b></td>' +
        '<td><b class="nombre-tecnico">' + esc(diseñoTitulo(d)) + '</b><div class="chips-fila">' + chipsFaltaHtml(d) + '</div></td>' +
        '<td>' + esc(proyectoNombre(d.proyectoId) || '—') + '</td><td>' + esc(d.iteracionId || '—') + '</td><td>' + esc(d.fecha || '—') + '</td>' +
        '<td>' + (editable ? '<select class="fmt-in" data-fdis-asignar="' + esc(d.codigo) + '">' + opcionesUsuariosHtml(d.asignadoA || '', 'Sin asignar', true) + '</select>' : esc(nombreDe(d.asignadoA) || '—')) + '</td>' +
        '<td>' + celda(d, 'fc') + '</td><td>' + celda(d, 'amcEfectiva') + '</td><td>' + celda(d, 'slump') + '</td><td>' + celda(d, 'aire') + '</td>' +
        '<td class="fmt-mat">' + materialesResumen(d) + '</td><td>' + (d.cvdTotal ? fmt(d.cvdTotal, 2) : '—') + '</td>' +
        '<td class="mono">' + ((d.replicaObjs || []).map(function(r){ return 'R' + r.n + ' ' + (r.codigo || '—'); }).join('<br>') || '—') + '</td>' +
        '<td>' + estadoDisenoHtml(d) + '</td>' +
        '<td class="acciones-fila"><button class="btn-icon" data-fdis="flujo" data-codigo="' + esc(d.codigo) + '" title="Flujo del diseño">' + FLUJO_ICON + '</button><button class="btn-icon" data-fdis="ver" data-codigo="' + esc(d.codigo) + '" title="Ver diseño">' + EYE_ICON + '</button></td></tr>';
    }).join('') : '<tr><td colspan="16" class="nota-sm">Sin registros.</td></tr>') + '</tbody>';
}
document.getElementById('sub-tabla').addEventListener('click', function(e){
  var b = e.target.closest('[data-fdis]');
  if(!b) return;
  var acc = b.dataset.fdis, d = disenoPorCodigo(b.dataset.codigo);
  if(acc === 'nuevo'){ if(exigir('disenos:crear')) showSubTab('calcular'); }
  else if(acc === 'excel'){
    exportarFormato('Formato de Diseños', ['Código','Nombre unificado','Proyecto','Iteración','Fecha','Asignado a',"f'c",'a/mc','Slump','Aire %','Materiales (kg/m³)','CVD S/.','Réplicas','Estado','Falta'],
      disenosFormato().map(function(x){ return [x.codigo, diseñoTitulo(x), proyectoNombre(x.proyectoId), x.iteracionId || '', x.fecha || '', nombreDe(x.asignadoA) || '', x.fc || '', x.amcEfectiva || '', x.slump || '', x.aire || '',
        (x.mix || []).filter(function(it){ return n(it.pesoSeco) > 0; }).map(function(it){ return it.nombre + ' ' + it.pesoSeco; }).join('; '), x.cvdTotal || '',
        (x.replicaObjs || []).map(function(r){ return 'R' + r.n + ' ' + (r.codigo || '-'); }).join(', '), estadoCalculado(x), faltaDiseno(x).map(function(f){ return f.texto; }).join('; ')]; }), 'disenos');
  }
  else if(acc === 'flujo' && d) abrirFlujoDiseno(d);
  else if(acc === 'ver' && d) openDesignModal(d);
});
document.getElementById('sub-tabla').addEventListener('change', function(e){
  var asig = e.target.dataset.fdisAsignar;
  if(asig){ var dd = disenoPorCodigo(asig); if(dd) asignarDiseno(dd, e.target.value); renderFormatoDisenos(); return; }
  var k = e.target.dataset.fdisCampo;
  if(!k) return;
  var d = disenoPorCodigo(e.target.dataset.codigo);
  if(!d || !exigir('disenos:crear')){ renderFormatoDisenos(); return; }
  var v = e.target.value.trim();
  if(v && k !== 'slump' && !isFinite(Number(v))){ toast(CAMPOS_EDIT_DISENO[k] + ' debe ser un número'); renderFormatoDisenos(); return; }
  editarCelda({antes:d[k], despues:v, etiqueta:CAMPOS_EDIT_DISENO[k], entidad:'Diseño', codigo:d.codigo, proyecto:proyectoNombre(d.proyectoId),
    aplicar:function(){ d[k] = v; d.editedAt = Date.now(); save('sid10_disenos', disenos); }, refrescar:function(){ refrescarTodoFlujo(d); renderFormatoDisenos(); }});
});

/* ================= FORMATO DE ESTADO FRESCO (por código) ================= */
var COLS_FRESCO = [
  {k:'slump:0', l:"Cons. 0'", ens:'ens-slump'}, {k:'slump:1', l:"30'", ens:'ens-slump'}, {k:'slump:2', l:"60'", ens:'ens-slump'}, {k:'slump:3', l:"90'", ens:'ens-slump'}, {k:'slump:4', l:"120'", ens:'ens-slump'},
  {k:'tempc:0', l:'T° concreto', ens:'ens-temp-concreto'}, {k:'tempa:0', l:'T° ambiente', ens:'ens-temp-ambiente'},
  {k:'pesoUnitario', l:'Peso unitario', ens:'ens-pu-concreto'}, {k:'thermoIni', l:'Fragua inicial', ens:'ens-fragua'}, {k:'thermoFin', l:'Fragua final', ens:'ens-fragua'},
  {k:'aire', l:'Aire %', ens:'ens-aire'}, {k:'cohesividad', l:'Cohesividad', ens:'ens-cohesividad'}, {k:'apariencia', l:'Apariencia', ens:'ens-cohesividad'}
];
function valorFresco(res, k){
  if(!res) return '';
  var p = k.split(':');
  if(p.length === 2){ var fila = (res.slump || [])[Number(p[1])]; return fila ? (fila[p[0]] || '') : ''; }
  return res[k] || '';
}
function fijarValorFresco(d, i, k, v){
  d.resultados = d.resultados || {replicas:[]};
  d.resultados.replicas = d.resultados.replicas || [];
  var res = d.resultados.replicas[i];
  if(!res || !res.slump) res = d.resultados.replicas[i] = Object.assign(emptyReplicaExtras(), res || {});
  var p = k.split(':');
  if(p.length === 2){
    var r = Number(p[1]);
    res.slump[r] = res.slump[r] || {hora:'', slump:'', tempc:'', tempa:''};
    res.slump[r][p[0]] = v;
    res.tiempos = Array.isArray(res.tiempos) ? res.tiempos : [0];
    if(v && res.tiempos.indexOf(r) === -1) res.tiempos.push(r);
  } else res[k] = v;
}
function filasFresco(){
  var f = leerFiltros('fre');
  var filas = [];
  disenos.forEach(function(d){
    var reg = registroDeDiseno(d);
    var nRep = (d.replicaObjs && d.replicaObjs.length) || d.replicas || 1;
    for(var i = 0; i < nRep; i++){
      var rep = (d.replicaObjs || [])[i] || {n:i + 1, nombre:diseñoTitulo(d) + '-R' + (i + 1), codigo:''};
      var el = rep.elaboracion || {};
      var r = Object.assign({}, reg, {texto:reg.texto + ' ' + rep.nombre, fecha:el.fecha || reg.fecha});
      if(pasaFiltro(f, r)) filas.push({d:d, i:i, rep:rep, res:((d.resultados && d.resultados.replicas) || [])[i]});
    }
  });
  return filas.sort(function(a,b){ return (b.d.ts || 0) - (a.d.ts || 0) || a.i - b.i; });
}
function renderFormatoFresco(){
  var cont = document.getElementById('sub-fresco');
  if(!cont.querySelector('.fmt-cab')) cont.innerHTML = cabeceraFormatoHtml('fresco', 'Formato de Estado Fresco', '<span class="badge-pill" id="ffre-cuenta"></span><button class="btn-add ghost" data-ffre="excel" data-perm="datos:exportar">Excel</button>') + '<div id="ffre-filtros"></div><div class="table-scroll fmt-scroll"><table class="data-table fmt-tabla" id="ffre-tabla"></table></div>';
  montarFiltros('fre', document.getElementById('ffre-filtros'), renderFormatoFresco);
  var filas = filasFresco();
  var editable = can('resultados:registrar');
  document.getElementById('ffre-cuenta').textContent = filas.length + ' réplicas';
  document.getElementById('ffre-tabla').innerHTML = '<thead><tr><th></th><th>Código</th><th>Réplica</th><th>Proyecto</th><th>Iteración</th><th>Elaboración</th>' + COLS_FRESCO.map(function(c){ return '<th>' + esc(c.l) + '</th>'; }).join('') + '</tr></thead><tbody>' +
    (filas.length ? filas.map(function(x){
      var el = x.rep.elaboracion || {};
      var falta = x.d.flujo && x.rep.codigo && !replicaTieneFresco(x.res);
      return '<tr><td>' + semaforoDotHtml(semaforoChecklist(x.d)) + '</td><td class="mono"><b>' + esc(x.rep.codigo || '—') + '</b></td>' +
        '<td>' + esc(x.rep.nombre) + (falta ? '<div class="chips-fila"><span class="chip-falta">Falta: Estado fresco</span></div>' : '') + '</td>' +
        '<td>' + esc(proyectoNombre(x.d.proyectoId) || '—') + '</td><td>' + esc(x.d.iteracionId || '—') + '</td>' +
        '<td>' + (el.fecha ? isoToDMY(el.fecha) + ' ' + esc(el.hora || '') : esc(x.d.fecha || '—')) + '</td>' +
        COLS_FRESCO.map(function(c){
          var v = valorFresco(x.res, c.k);
          return '<td>' + (editable ? '<input type="text" class="fmt-in fmt-corto" data-ffre-campo="' + c.k + '" data-codigo="' + esc(x.d.codigo) + '" data-rep="' + x.i + '" value="' + esc(v) + '">' : esc(v || '—')) + '</td>';
        }).join('') + '</tr>';
    }).join('') : '<tr><td colspan="' + (6 + COLS_FRESCO.length) + '" class="nota-sm">Sin registros.</td></tr>') + '</tbody>';
}
document.getElementById('sub-fresco').addEventListener('change', function(e){
  var k = e.target.dataset.ffreCampo;
  if(!k) return;
  var d = disenoPorCodigo(e.target.dataset.codigo), i = Number(e.target.dataset.rep);
  var col = COLS_FRESCO.filter(function(c){ return c.k === k; })[0];
  if(!d || !exigir('resultados:registrar') || !exigirEnsayos([col.ens], d)){ renderFormatoFresco(); return; }
  var v = e.target.value.trim();
  var antes = valorFresco(((d.resultados && d.resultados.replicas) || [])[i], k);
  var rep = (d.replicaObjs || [])[i];
  editarCelda({antes:antes, despues:v, etiqueta:col.l, entidad:'Resultados', codigo:(rep && rep.codigo) || d.codigo, ref:d.codigo, proyecto:proyectoNombre(d.proyectoId),
    aplicar:function(){
      fijarValorFresco(d, i, k, v);
      d.frescoContexto = {analista_id:usuarioActual.id, analista:usuarioActual.nombre || usuarioActual.usuario, registrado_en:new Date().toISOString()};
      d.editedAt = Date.now();
      save('sid10_disenos', disenos);
    }, refrescar:function(){ refrescarTodoFlujo(d); renderFormatoFresco(); }});
});
document.getElementById('sub-fresco').addEventListener('click', function(e){
  if(!e.target.closest('[data-ffre="excel"]')) return;
  exportarFormato('Formato de Estado Fresco', ['Código','Réplica','Proyecto','Iteración','Elaboración'].concat(COLS_FRESCO.map(function(c){ return c.l; })),
    filasFresco().map(function(x){ var el = x.rep.elaboracion || {}; return [x.rep.codigo || '', x.rep.nombre, proyectoNombre(x.d.proyectoId), x.d.iteracionId || '', el.fecha ? isoToDMY(el.fecha) + ' ' + (el.hora || '') : (x.d.fecha || '')]
      .concat(COLS_FRESCO.map(function(c){ return valorFresco(x.res, c.k); })); }), 'fresco');
});

/* ================= FORMATO DE ROTURAS I+D (pestañas Probetas y Cubos) ================= */
var roFormatoTipo = 'Probetas';
var ROTURA_CAMPOS_CARGA = ['a1','a2','a3','m1kN','m2kN','m3kN','m1kg','m2kg','m3kg','tipoRoturaM1','tipoRoturaM2','tipoRoturaM3'];
var ROTURA_ETIQUETAS = {correoEnviado:'Correo enviado', fechaEnsayoReal:'Fecha de ensayo', horaEnsayo:'Hora de ensayo', equipo:'Equipo', comentarios:'Comentarios',
  a1:'Área M1', a2:'Área M2', a3:'Área M3', m1kN:'M1 (kN)', m2kN:'M2 (kN)', m3kN:'M3 (kN)', m1kg:'M1 (kg)', m2kg:'M2 (kg)', m3kg:'M3 (kg)',
  tipoRoturaM1:'Tipo M1', tipoRoturaM2:'Tipo M2', tipoRoturaM3:'Tipo M3'};
function registroDeRotura(c){
  return {proyecto:c.proyecto || '', iteracion:c.iteracion || '', texto:(c.codigo || '') + ' ' + (c.producto || '') + ' ' + (c.disenoCodigoDiseno || ''),
    responsables:[c.aCargoDeId, c.aCargoDe], fecha:c.fechaEnsayo || ''};
}
function roturasFormato(){
  var f = leerFiltros('rot');
  return roturaCargas.filter(function(c){ return pasaFiltro(f, registroDeRotura(c)); })
    .sort(function(a,b){ return (a.codigo || '').localeCompare(b.codigo || '') || a.dia - b.dia; });
}
function estadoRoturaHtml(c){
  if(c.estado === 'completado') return '<span class="chip-ok">Rota</span>' + chipNoConformeHtml(c);
  if(cargaAtrasada(c)) return '<span class="chip-falta atrasado">Atrasada</span>';
  if(!c.horaElaboracion) return '<span class="chip-falta">Falta: hora</span>';
  return cargaActiva(c) ? '<span class="chip-falta">Para hoy</span>' : '<span class="chip-edad">Se activa el ' + fechaCorta(diaDeActivacion(c)) + '</span>';
}
function filaRoturaHtml(c){
  var editable = can('roturas:registrar');
  var d = c.disenoCodigoDiseno ? disenoPorCodigo(c.disenoCodigoDiseno) : null;
  var inp = function(k, tipo, cls){ return editable ? '<input type="' + (tipo || 'text') + '" class="fmt-in ' + (cls || 'fmt-corto') + '" data-f="' + k + '" value="' + esc(c[k] || '') + '">' : esc(c[k] || '—'); };
  var sel = function(k){ return editable ? '<select class="fmt-in" data-f="' + k + '">' + ['','1','2','3','4','5','6'].map(function(t){ var v = t ? 'Tipo ' + t : ''; return '<option value="' + v + '"' + (c[k] === v ? ' selected' : '') + '>' + (t || '—') + '</option>'; }).join('') + '</select>' : esc(c[k] || '—'); };
  return '<tr data-id="' + esc(c.id) + '"><td>' + (d ? semaforoDotHtml(semaforoChecklist(d)) : '') + '</td>' +
    '<td><div class="id-card"><span class="id-card-tipo">' + ((c.tipo || 'Probetas') !== 'Cubos' ? 'Probeta' : 'Cubo') + '</span><span class="id-card-codigo">' + esc(c.codigo) + '</span></div></td>' +
    '<td>' + esc(c.producto) + (c.origen === 'manual' ? ' <span class="fase-chip">manual</span>' : '') + '</td><td>' + esc(c.proyecto || '—') + '</td><td>' + esc(c.iteracion || '—') + '</td><td>' + esc(c.aCargoDe || '—') + '</td>' +
    '<td class="ro-locked">' + isoToDMY(c.fechaElaboracion) + ' ' + esc(c.horaElaboracion || '') + '</td><td class="ro-locked">' + c.dia + ' d</td>' +
    '<td class="ro-locked">' + isoToDMY(c.fechaEnsayo) + '</td><td class="ro-locked">' + esc(textoVentana(c)) + ' ±' + c.toleranciaHoras + ' h</td>' +
    '<td>' + estadoRoturaHtml(c) + '</td>' +
    '<td><input type="checkbox" data-f="correoEnviado"' + (c.correoEnviado ? ' checked' : '') + (editable ? '' : ' disabled') + '></td>' +
    '<td>' + inp('fechaEnsayoReal', 'date', 'fmt-fecha-in') + '</td><td>' + inp('horaEnsayo', 'time', 'fmt-hora-in') + '</td>' +
    '<td>' + inp('a1') + '</td><td>' + inp('a2') + '</td><td>' + inp('a3') + '</td>' +
    '<td>' + inp('m1kN') + '</td><td>' + inp('m2kN') + '</td><td>' + inp('m3kN') + '</td>' +
    '<td>' + inp('m1kg') + '</td><td>' + inp('m2kg') + '</td><td>' + inp('m3kg') + '</td>' +
    '<td>' + sel('tipoRoturaM1') + '</td><td>' + sel('tipoRoturaM2') + '</td><td>' + sel('tipoRoturaM3') + '</td>' +
    '<td class="ro-locked">' + (c.m1kgcm2 || '—') + '</td><td class="ro-locked">' + (c.m2kgcm2 || '—') + '</td><td class="ro-locked">' + (c.m3kgcm2 || '—') + '</td>' +
    '<td class="ro-locked"><b>' + (c.promedio || '—') + '</b></td><td class="ro-locked' + (parseFloat(c.coefVar) > cvAlerta() ? ' cv-alto' : '') + '">' + (c.coefVar || '—') + '</td><td class="ro-locked">' + (c.desvest || '—') + '</td>' +
    '<td>' + inp('equipo', 'text', 'fmt-medio') + '</td><td>' + inp('comentarios', 'text', 'fmt-largo') + '</td>' +
    '<td><button class="btn-icon danger" data-perm="roturas:eliminar" data-act="anular-carga" title="Anular (con motivo)">×</button></td></tr>';
}
var CABECERA_ROTURAS = ['Código','Producto','Proyecto','Iteración','A cargo de','Elaboración','Edad','F. ensayo','Ventana','Estado','Correo','F. ensayo real','Hora ensayo','A1','A2','A3',
  'M1 kN','M2 kN','M3 kN','M1 kg','M2 kg','M3 kg','Tipo M1','Tipo M2','Tipo M3','M1 kg/cm²','M2 kg/cm²','M3 kg/cm²',"Promedio f'c",'CV','Desv.','Equipo','Comentarios'];
function renderRoturasFormato(){
  var cont = document.getElementById('ro-sub-formato');
  if(!cont.querySelector('.fmt-cab')){
    cont.innerHTML = cabeceraFormatoHtml('roturas', 'Formato de Roturas I+D',
      '<div class="view-toggle" id="ro-formato-tipo-tabs"><button class="view-toggle-btn active" data-tipo="Probetas">Probetas <span class="col-count-badge" id="ro-formato-count-probetas">0</span></button>' +
      '<button class="view-toggle-btn" data-tipo="Cubos">Cubos <span class="col-count-badge" id="ro-formato-count-cubos">0</span></button></div>' +
      '<button class="btn-add verde" data-ro-fmt="manual" data-perm="roturas:registrar">+ Registro manual</button><button class="btn-add ghost" data-ro-fmt="excel" data-perm="datos:exportar">Excel</button>') +
      '<div id="ro-fmt-filtros"></div><div class="roturas-table-wrap fmt-scroll"><table class="roturas-table fmt-tabla" id="ro-formato-tabla"></table></div>';
  }
  montarFiltros('rot', document.getElementById('ro-fmt-filtros'), renderRoturasFormato);
  var lista = roturasFormato();
  var probetas = lista.filter(function(c){ return (c.tipo || 'Probetas') !== 'Cubos'; }), cubos = lista.filter(function(c){ return c.tipo === 'Cubos'; });
  document.getElementById('ro-formato-count-probetas').textContent = probetas.length;
  document.getElementById('ro-formato-count-cubos').textContent = cubos.length;
  document.querySelectorAll('#ro-formato-tipo-tabs .view-toggle-btn').forEach(function(b){ b.classList.toggle('active', b.dataset.tipo === roFormatoTipo); });
  var filas = roFormatoTipo === 'Cubos' ? cubos : probetas;
  document.getElementById('ro-formato-tabla').innerHTML = '<thead><tr><th></th>' + CABECERA_ROTURAS.map(function(h){ return '<th>' + esc(h) + '</th>'; }).join('') + '<th></th></tr></thead><tbody>' +
    (filas.length ? filas.map(filaRoturaHtml).join('') : '<tr><td colspan="' + (CABECERA_ROTURAS.length + 2) + '" class="nota-sm">Sin registros.</td></tr>') + '</tbody>';
}
function aplicarCampoRotura(c, f, v){
  var kgf = kgfPorKn();
  c[f] = v;
  var m = /^m(\d)(kN|kg)$/.exec(f);
  if(m){
    var x = Number(v);
    if(m[2] === 'kN') c['m' + m[1] + 'kg'] = v && isFinite(x) ? (x * kgf).toFixed(2) : '';
    else c['m' + m[1] + 'kN'] = v && isFinite(x) ? (x / kgf).toFixed(2) : '';
  }
  var eraCompleta = c.estado === 'completado';
  recalcCarga(c);
  if(ROTURA_CAMPOS_CARGA.indexOf(f) > -1 || f === 'horaEnsayo' || f === 'fechaEnsayoReal' || f === 'equipo'){
    var e = Lab.ensayo(ensayoDeRotura(c.tipo));
    c.contexto = {analista_id:usuarioActual.id, analista:usuarioActual.nombre || usuarioActual.usuario, metodo:e ? e.metodo : '', version:e ? e.version : '',
      registrado_en:new Date().toISOString(), equipo:c.equipo || '', lote:c.lote || ''};
  }
  var avisos = c.estado === 'completado' && !eraCompleta ? evaluarRoturaCompletada(c) : [];
  saveRoturaCargas();
  if(avisos.length) toast(c.codigo + ' · ' + avisos.join(' · '));
}
document.getElementById('ro-sub-formato').addEventListener('change', function(e){
  var f = e.target.dataset.f;
  var tr = e.target.closest('tr[data-id]');
  if(!f || !tr) return;
  var c = roturaCargas.filter(function(x){ return x.id === tr.dataset.id; })[0];
  if(!c) return;
  if(!exigir('roturas:registrar')){ renderRoturasFormato(); return; }
  var d = c.disenoCodigoDiseno ? disenoPorCodigo(c.disenoCodigoDiseno) : null;
  if(!exigirEnsayos([ensayoDeRotura(c.tipo)], d, c.aCargoDeId)){ renderRoturasFormato(); return; }
  var v = e.target.type === 'checkbox' ? e.target.checked : e.target.value.trim();
  if(ROTURA_CAMPOS_CARGA.indexOf(f) > -1 && v){
    if(!c.horaElaboracion){ toast('Falta la hora de elaboración: complétala primero'); renderRoturasFormato(); return; }
    if(c.estado === 'pendiente' && !cargaActiva(c)){ toast('Esta rotura se activa el ' + fechaCorta(diaDeActivacion(c))); renderRoturasFormato(); return; }
    if(/^m\d(kN|kg)$/.test(f) && (!c.fechaEnsayoReal || !c.horaEnsayo)){ toast('Primero indicá la fecha y la hora de ensayo de esta fila'); renderRoturasFormato(); return; }
    if(f.charAt(0) !== 't' && !isFinite(Number(v))){ toast(ROTURA_ETIQUETAS[f] + ' debe ser un número'); renderRoturasFormato(); return; }
  }
  editarCelda({antes:f === 'correoEnviado' ? (c[f] ? 'Sí' : '') : c[f], despues:f === 'correoEnviado' ? (v ? 'Sí' : '') : v, etiqueta:ROTURA_ETIQUETAS[f] || f, entidad:'Rotura',
    codigo:c.codigo + ' ' + c.dia + 'd', ref:c.disenoCodigoDiseno || c.codigo, proyecto:c.proyecto,
    aplicar:function(){ aplicarCampoRotura(c, f, v); }, refrescar:function(){ refrescarTodoFlujo(d); renderRoturasFormato(); }});
});
document.getElementById('ro-sub-formato').addEventListener('click', function(e){
  var tab = e.target.closest('#ro-formato-tipo-tabs .view-toggle-btn');
  if(tab){ roFormatoTipo = tab.dataset.tipo; renderRoturasFormato(); return; }
  var b = e.target.closest('[data-ro-fmt]');
  if(b && b.dataset.roFmt === 'manual'){ abrirRegistroManual(); return; }
  if(b && b.dataset.roFmt === 'excel'){
    exportarFormato('Formato de Roturas I+D', ['Tipo'].concat(CABECERA_ROTURAS), roturasFormato().map(function(c){
      return [c.tipo || 'Probetas', c.codigo, c.producto, c.proyecto || '', c.iteracion || '', c.aCargoDe || '', isoToDMY(c.fechaElaboracion) + ' ' + (c.horaElaboracion || ''), c.dia, isoToDMY(c.fechaEnsayo), textoVentana(c) + ' ±' + c.toleranciaHoras + ' h',
        c.estado === 'completado' ? 'Rota' : (cargaAtrasada(c) ? 'Atrasada' : 'Pendiente'), c.correoEnviado ? 'Sí' : '', c.fechaEnsayoReal ? isoToDMY(c.fechaEnsayoReal) : '', c.horaEnsayo || '',
        c.a1, c.a2, c.a3, c.m1kN, c.m2kN, c.m3kN, c.m1kg, c.m2kg, c.m3kg, c.tipoRoturaM1, c.tipoRoturaM2, c.tipoRoturaM3, c.m1kgcm2, c.m2kgcm2, c.m3kgcm2, c.promedio, c.coefVar, c.desvest, c.equipo || '', c.comentarios || ''];
    }), 'roturas');
    return;
  }
  var an = e.target.closest('[data-act="anular-carga"]');
  if(an){
    if(!exigir('roturas:eliminar')) return;
    var c = roturaCargas.filter(function(x){ return x.id === an.closest('tr').dataset.id; })[0];
    if(c) anularRotura(c);
  }
});
/* Regla 2: una fila de rotura se anula con motivo; queda guardada fuera de las listas */
function anularRotura(c){
  pedirMotivo('Anular la rotura ' + c.codigo + ' · ' + c.dia + ' d', '<p>' + esc(c.producto) + ' · ' + esc(c.proyecto || '') + '. No se borra: queda guardada con el motivo.</p>', function(motivo){
    roturaCargas = roturaCargas.filter(function(x){ return x.id !== c.id; });
    roturasAnuladas.push(Object.assign(c, datosAnulacion(motivo)));
    save('sid_roturas_anuladas', roturasAnuladas);
    saveRoturaCargas();
    registrarHistorial('Anuló', 'Rotura', c.codigo + ' · ' + c.producto + ' · ' + c.dia + ' d', {codigo:c.codigo, proyecto:c.proyecto, ref:c.disenoCodigoDiseno || c.codigo, antes:{anulado:false}, despues:{anulado:true}, motivo:motivo});
    toast('Rotura anulada');
    refrescarTodoFlujo(c.disenoCodigoDiseno ? disenoPorCodigo(c.disenoCodigoDiseno) : null);
    renderRoturasFormato();
  });
}

/* ---------- + Registro manual: roturas que no vienen de un diseño (alimentan la misma tabla) ---------- */
function abrirRegistroManual(){
  if(!exigir('roturas:registrar')) return;
  var m = document.getElementById('manual-modal');
  if(!m){
    document.body.insertAdjacentHTML('beforeend', '<div id="manual-modal" class="sid-modal"><div class="modal-card wide"><div class="modal-header"><h3>Registro manual de roturas</h3><button class="modal-close" data-close="manual-modal">×</button></div>' +
      '<div class="modal-body" id="manual-body"></div><div class="modal-actions"><button class="btn-add verde" id="manual-guardar">Registrar</button><button class="btn-add ghost" data-close="manual-modal">Cancelar</button></div></div></div>');
    document.getElementById('manual-modal').addEventListener('change', actualizarManualPreview);
    document.getElementById('manual-modal').addEventListener('input', actualizarManualPreview);
    document.getElementById('manual-guardar').addEventListener('click', guardarRegistroManual);
  }
  document.getElementById('manual-body').innerHTML = '<div class="pred-form">' +
    '<div class="pp-field span-2"><label>Producto</label><input type="text" id="man-producto" placeholder="Ej. Concreto de obra Planta Trujillo"></div>' +
    '<div class="pp-field"><label>Proyecto</label><select id="man-proyecto">' + PROYECTO_CATALOGO.map(function(p){ return '<option' + (p === proyectoFlujo ? ' selected' : '') + '>' + esc(p) + '</option>'; }).join('') + '</select></div>' +
    '<div class="pp-field"><label>Iteración</label><input type="text" id="man-iteracion" placeholder="Ej. Noviembre"></div>' +
    '<div class="pp-field"><label>A cargo de</label><select id="man-acargo">' + opcionesUsuariosHtml((usuarioActual && usuarioActual.id) || '') + '</select></div>' +
    '<div class="pp-field"><label>Tipo de espécimen</label><div class="elab-tipo"><label class="pp-check-inline"><input type="radio" name="man-tipo" value="Probetas" checked> Probetas</label><label class="pp-check-inline"><input type="radio" name="man-tipo" value="Cubos"> Cubos</label></div></div>' +
    '<div class="pp-field span-2"><div class="codigo-preview-destacado"><span class="cpd-label">Código que se asignará</span><span class="cpd-codigo" id="man-codigo"></span></div></div>' +
    '<div class="pp-field"><label>Fecha de elaboración</label><input type="date" id="man-fecha" value="' + todayISO() + '"></div>' +
    '<div class="pp-field"><label>Hora de elaboración</label><input type="time" id="man-hora"></div>' +
    '<div class="pp-field span-2"><label>Edades</label><div class="elab-tipo" id="man-edades">' + DIAS_COMUNES.map(function(x){ return '<label class="pp-check-inline"><input type="checkbox" value="' + x + '"' + ([1,3,7,28].indexOf(x) > -1 ? ' checked' : '') + '> ' + x + ' d</label>'; }).join('') + '</div></div>' +
    '<div class="pp-field span-2" id="man-ventanas"></div>' +
  '</div>';
  actualizarManualPreview();
  abrirModal('manual-modal');
}
function manualTipo(){ return (document.querySelector('input[name="man-tipo"]:checked') || {}).value || 'Probetas'; }
function manualEdades(){ return Array.prototype.map.call(document.querySelectorAll('#man-edades input:checked'), function(x){ return Number(x.value); }); }
function actualizarManualPreview(){
  if(!document.getElementById('man-codigo')) return;
  document.getElementById('man-codigo').textContent = peekNextCodigoRotura(manualTipo());
  var fecha = document.getElementById('man-fecha').value, hora = document.getElementById('man-hora').value;
  document.getElementById('man-ventanas').innerHTML = manualEdades().map(function(dia){
    return '<span class="chip-edad">' + dia + ' d · ' + esc(fecha ? textoVentana({fechaElaboracion:fecha, horaElaboracion:hora, dia:dia, fechaEnsayo:calcularFechaEnsayo(fecha, dia)}) : '—') + '</span>';
  }).join(' ');
}
function guardarRegistroManual(){
  var producto = document.getElementById('man-producto').value.trim();
  var proyecto = document.getElementById('man-proyecto').value;
  var aCargo = document.getElementById('man-acargo').value;
  var fecha = document.getElementById('man-fecha').value, hora = document.getElementById('man-hora').value;
  var edades = manualEdades(), tipo = manualTipo();
  if(!producto){ toast('Indicá el producto'); return; }
  if(!proyecto){ toast('Elegí el proyecto'); return; }
  if(!fecha || !edades.length){ toast('Indicá la fecha de elaboración y al menos una edad'); return; }
  if(!exigirEnsayos(['ens-elaboracion'], null, aCargo)) return;
  var codigo = nextCodigoRotura(tipo);
  var e = Lab.ensayo(ensayoDeRotura(tipo));
  var creados = edades.map(function(dia){
    var c = {id:nextRoturaId(), codigo:codigo, tipo:tipo, disenoCodigoDiseno:'', replicaNombre:producto, producto:producto, proyecto:proyecto, iteracion:document.getElementById('man-iteracion').value.trim(),
      aCargoDe:nombreDe(aCargo), aCargoDeId:aCargo, fechaElaboracion:fecha, horaElaboracion:hora, dia:dia, fechaEnsayo:calcularFechaEnsayo(fecha, dia), toleranciaHoras:toleranciaHoras(dia),
      correoEnviado:false, origen:'manual', metodo:e ? e.metodo + ' (' + e.version + ')' : '', lote:'', horaEnsayo:'', a1:'', a2:'', a3:'', m1kN:'', m2kN:'', m3kN:'', m1kg:'', m2kg:'', m3kg:'',
      tipoRoturaM1:'', tipoRoturaM2:'', tipoRoturaM3:'', evid1:'', evid2:'', evid3:'', m1kgcm2:'', m2kgcm2:'', m3kgcm2:'', promedio:'', coefVar:'', desvest:'', comentarios:'', estado:'pendiente'};
    roturaCargas.push(c);
    return c;
  });
  saveRoturaCargas();
  registrarHistorial('Registró', 'Rotura', 'Registro manual ' + codigo + ' · ' + producto + ' · edades ' + edades.join(', '), {codigo:codigo, proyecto:proyecto, ref:codigo, despues:{codigo:codigo, producto:producto, edades:edades}});
  cerrarModal('manual-modal');
  toast('Registro manual creado — ' + codigo + ' (' + creados.length + ' edades)');
  roFormatoTipo = tipo;
  refrescarTodoFlujo();
  showRoturasSub('formato');
}

/* ================= FORMATO DE CARGAS Y PROMEDIADOS ================= */
function promedioReplicaEdad(d, rep, dia){
  var cs = cargasDeDiseno(d).filter(function(c){ return c.replicaNombre === rep.nombre && Number(c.dia) === Number(dia) && c.estado === 'completado'; });
  return cs.length ? cs[0].promedio : '';
}
function rrConDiseno(codigo){ return rrEstudios.filter(function(e){ return (e.tipos || []).some(function(t){ return t.origenDisenoCodigo === codigo; }); }); }
function filasCargas(){
  var f = leerFiltros('car');
  var filas = [];
  disenos.forEach(function(d){
    if(!pasaFiltro(f, registroDeDiseno(d))) return;
    var cs = cargasDeDiseno(d);
    if(!cs.length) return;
    var comb = nombreUnificadoPromedio(d);
    var edades = {}; cs.forEach(function(c){ edades[c.dia] = true; });
    Object.keys(edades).map(Number).sort(function(a,b){ return a - b; }).forEach(function(dia){
      var deEdad = cs.filter(function(c){ return Number(c.dia) === dia; });
      var hechas = deEdad.filter(function(c){ return c.estado === 'completado'; });
      var st = comb[dia] || {};
      var nVals = hechas.reduce(function(a, c){ return a + [c.m1kgcm2, c.m2kgcm2, c.m3kgcm2].filter(Boolean).length; }, 0);
      filas.push({d:d, dia:dia, st:st, n:nVals, hechas:hechas.length, total:deEdad.length, reps:(d.replicaObjs || []).map(function(r){ return promedioReplicaEdad(d, r, dia); }), nc:deEdad.some(tncAbiertoDeCarga)});
    });
  });
  return filas;
}
function renderFormatoCargas(){
  var cont = document.getElementById('rr-vista-cargas');
  if(!cont.querySelector('.fmt-cab')) cont.innerHTML = cabeceraFormatoHtml('cargas', 'Formato de Cargas y Promediados', '<span class="badge-pill" id="fcar-cuenta"></span><button class="btn-add ghost" data-fcar="excel" data-perm="datos:exportar">Excel</button>') +
    '<div id="fcar-filtros"></div><div class="table-scroll fmt-scroll"><table class="data-table fmt-tabla" id="fcar-tabla"></table></div>';
  montarFiltros('car', document.getElementById('fcar-filtros'), renderFormatoCargas);
  var filas = filasCargas();
  var maxRep = filas.reduce(function(m, x){ return Math.max(m, x.reps.length); }, 0);
  document.getElementById('fcar-cuenta').textContent = filas.length + ' promedios';
  var colsRep = []; for(var i = 1; i <= maxRep; i++) colsRep.push('R' + i);
  document.getElementById('fcar-tabla').innerHTML = '<thead><tr><th></th><th>Nombre unificado</th><th>Proyecto</th><th>Iteración</th><th>Edad</th>' + colsRep.map(function(r){ return '<th>' + r + '</th>'; }).join('') +
    '<th>Promedio f\'c</th><th>Desv.</th><th>CV</th><th>n</th><th>Roturas</th><th>En RR</th></tr></thead><tbody>' +
    (filas.length ? filas.map(function(x){
      var rr = rrConDiseno(x.d.codigo);
      return '<tr><td>' + semaforoDotHtml(semaforoChecklist(x.d)) + '</td><td><b class="nombre-tecnico">' + esc(diseñoTitulo(x.d)) + '</b><div class="nota-sm mono">' + esc(x.d.codigo) + '</div></td>' +
        '<td>' + esc(proyectoNombre(x.d.proyectoId) || '—') + '</td><td>' + esc(x.d.iteracionId || '—') + '</td><td><span class="chip-edad">' + x.dia + ' d</span></td>' +
        colsRep.map(function(r, i){ return '<td>' + esc(x.reps[i] || '—') + '</td>'; }).join('') +
        '<td><b>' + esc(x.st.promedio || '—') + '</b></td><td>' + esc(x.st.desvest || '—') + '</td><td class="' + (parseFloat(x.st.coefVar) > cvAlerta() ? 'cv-alto' : '') + '">' + esc(x.st.coefVar || '—') + '</td><td>' + x.n + '</td>' +
        '<td>' + (x.hechas === x.total ? '<span class="chip-ok">' + x.hechas + '/' + x.total + '</span>' : '<span class="chip-falta">' + x.hechas + '/' + x.total + '</span>') + (x.nc ? ' <span class="chip-falta atrasado">No conforme</span>' : '') + '</td>' +
        '<td>' + (rr.map(function(e){ return '<span class="chip-edad" title="' + esc(e.nombre) + '">' + esc(e.codigo || e.nombre) + '</span>'; }).join('') || '—') + '</td></tr>';
    }).join('') : '<tr><td colspan="' + (11 + maxRep) + '" class="nota-sm">Sin registros.</td></tr>') + '</tbody>';
}
function montarVistasRR(){
  var sec = document.getElementById('panel-reporte-rr');
  if(document.getElementById('rr-vistas')) return;
  var layout = sec.querySelector('.rr-layout');
  layout.id = 'rr-vista-informes';
  layout.insertAdjacentHTML('beforebegin', '<div class="view-toggle rr-vistas" id="rr-vistas"><button class="view-toggle-btn active" data-rr-vista="cargas">Cargas y promediados</button><button class="view-toggle-btn" data-rr-vista="informes">Informes RR</button></div><div class="card" id="rr-vista-cargas"></div>');
  sec.querySelector('.content-header h2').textContent = 'Formato de Cargas y Promediados';
  document.getElementById('rr-vistas').addEventListener('click', function(e){ var b = e.target.closest('[data-rr-vista]'); if(b) mostrarVistaRR(b.dataset.rrVista); });
  document.getElementById('rr-vista-cargas').addEventListener('click', function(e){
    if(!e.target.closest('[data-fcar="excel"]')) return;
    var filas = filasCargas(), maxRep = filas.reduce(function(m, x){ return Math.max(m, x.reps.length); }, 0), reps = [];
    for(var i = 1; i <= maxRep; i++) reps.push('R' + i);
    exportarFormato('Formato de Cargas y Promediados', ['Código','Nombre unificado','Proyecto','Iteración','Edad (d)'].concat(reps).concat(["Promedio f'c",'Desv.','CV','n','Roturas']),
      filas.map(function(x){ return [x.d.codigo, diseñoTitulo(x.d), proyectoNombre(x.d.proyectoId), x.d.iteracionId || '', x.dia].concat(reps.map(function(r, i){ return x.reps[i] || ''; })).concat([x.st.promedio || '', x.st.desvest || '', x.st.coefVar || '', x.n, x.hechas + '/' + x.total]); }), 'cargas');
  });
}
var rrVista = 'cargas';
function mostrarVistaRR(v){
  montarVistasRR();
  rrVista = v;
  document.querySelectorAll('#rr-vistas .view-toggle-btn').forEach(function(b){ b.classList.toggle('active', b.dataset.rrVista === v); });
  document.getElementById('rr-vista-cargas').style.display = v === 'cargas' ? '' : 'none';
  document.getElementById('rr-vista-informes').style.display = v === 'informes' ? '' : 'none';
  document.getElementById('btn-generar-rr').style.display = v === 'informes' ? '' : 'none';
  if(v === 'cargas') renderFormatoCargas(); else { renderRRStudyList(); renderRRDetail(); }
}
PANEL_HOOKS['reporte-rr'] = function(){ mostrarVistaRR(rrVista); };
