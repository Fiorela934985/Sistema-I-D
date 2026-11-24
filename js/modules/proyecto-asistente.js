/* Sistema I+D — Nuevo proyecto: asistente de 4 pasos (prompt maestro, sección 6).
   1. Datos: nombre, código, tipo, responsable, equipo y fechas estimadas.
   2. Objetivos medibles (por ejemplo, f'c a 28 d ≥ un valor; slump en un rango).
   3. Ensayos y métodos: casillas del catálogo agrupadas por etapa, con su norma, y edades de rotura por defecto
      del tipo de proyecto o personalizadas. Equivale a la revisión de la solicitud (17025, 7.1 y 7.2).
   4. Confirmar: se crea el espacio del proyecto solo con las pestañas y ensayos elegidos.
   El mismo asistente edita un proyecto existente; al guardar pide el motivo. */
'use strict';

var asis = null; // estado del asistente: {paso, ficha, esNuevo}
var ASIS_PASOS = ['Datos', 'Objetivos', 'Ensayos y métodos', 'Confirmar'];

function asegurarModalAsistente(){
  if(document.getElementById('asistente-proy-modal')) return;
  var m = document.createElement('div');
  m.id = 'asistente-proy-modal';
  m.className = 'sid-modal';
  m.innerHTML = '<div class="modal-card wide asis-card"><div class="modal-header"><h3 id="asis-titulo">Nuevo proyecto</h3><button class="modal-close" data-close="asistente-proy-modal">×</button></div>' +
    '<ol class="asis-pasos" id="asis-pasos"></ol><div class="modal-body" id="asis-cuerpo"></div>' +
    '<div class="modal-actions asis-acciones"><button class="btn-add ghost" id="asis-anterior">← Anterior</button><span class="asis-error" id="asis-error"></span><button class="btn-add" id="asis-siguiente">Siguiente →</button></div></div>';
  document.body.appendChild(m);
  document.getElementById('asis-anterior').addEventListener('click', function(){ leerPasoAsistente(); if(asis.paso > 0){ asis.paso--; renderAsistente(); } });
  document.getElementById('asis-siguiente').addEventListener('click', avanzarAsistente);
  document.getElementById('asis-pasos').addEventListener('click', function(e){
    var li = e.target.closest('[data-asis-paso]');
    if(!li) return;
    var destino = Number(li.dataset.asisPaso);
    leerPasoAsistente();
    if(destino < asis.paso){ asis.paso = destino; renderAsistente(); return; }
    while(asis.paso < destino){ var err = validarPasoAsistente(asis.paso); if(err){ mostrarErrorAsistente(err); return; } asis.paso++; }
    renderAsistente();
  });
  var cuerpo = document.getElementById('asis-cuerpo');
  cuerpo.addEventListener('change', function(e){
    var lbl = e.target.closest('.chip-check, .asis-ensayo');
    if(lbl && e.target.type === 'checkbox') lbl.classList.toggle('on', e.target.checked);
    if(e.target.id === 'asis-tipo'){
      leerPasoAsistente();
      var f = Lab.flujo(asis.ficha.tipo_flujo_id);
      asis.ficha.ensayos = ensayosDelFlujo(asis.ficha.tipo_flujo_id);
      asis.ficha.edades = f ? f.edades_defecto.slice() : [1,3,7,28];
      toast('Se cargaron los ensayos y edades del tipo ' + (f ? f.tipo_proyecto : ''));
    }
    if(e.target.dataset.objK === 'ensayo_id' || e.target.dataset.objK === 'operador'){ leerPasoAsistente(); renderAsistente(); }
  });
  cuerpo.addEventListener('click', function(e){
    var b = e.target.closest('[data-asis-acc]');
    if(!b) return;
    leerPasoAsistente();
    var acc = b.dataset.asisAcc;
    if(acc === 'obj-agregar'){
      var numericos = ensayosParaObjetivo();
      if(!numericos.length){ toast('Primero elegí ensayos de estado fresco o endurecido (paso 3)'); return; }
      var e0 = numericos.filter(function(x){ return x.etapa === 'endurecido'; })[0] || numericos[0];
      asis.ficha.objetivos.push({id:Lab.idNuevo('obj'), descripcion:'', ensayo_id:e0.id, edad_dias:e0.etapa === 'endurecido' ? 28 : null, operador:'>=', valor_min:'', valor_max:'', unidad:e0.unidades || ''});
    } else if(acc === 'obj-quitar'){
      asis.ficha.objetivos.splice(Number(b.dataset.i), 1);
    } else if(acc === 'edad'){
      var d = Number(b.dataset.edad), ed = asis.ficha.edades;
      var i = ed.indexOf(d);
      if(i > -1) ed.splice(i, 1); else ed.push(d);
      ed.sort(function(a,b){ return a - b; });
    } else if(acc === 'edad-otra'){
      var v = Number(document.getElementById('asis-edad-otra').value);
      if(!(v > 0) || v > 3650){ toast('Indicá una edad en días'); return; }
      if(asis.ficha.edades.indexOf(v) === -1){ asis.ficha.edades.push(v); asis.ficha.edades.sort(function(a,b){ return a - b; }); }
    } else if(acc === 'etapa-todos'){
      var et = b.dataset.etapa, ids = Lab.ensayos(true).filter(function(x){ return x.etapa === et; }).map(function(x){ return x.id; });
      var todos = ids.every(function(id){ return asis.ficha.ensayos.indexOf(id) > -1; });
      asis.ficha.ensayos = asis.ficha.ensayos.filter(function(id){ return ids.indexOf(id) === -1; }).concat(todos ? [] : ids);
    }
    renderAsistente();
  });
}

function abrirAsistenteProyecto(fichaExistente){
  asegurarModalAsistente();
  var flujo = (Lab.flujo(FLUJO_POR_DEFECTO) && Lab.flujo(FLUJO_POR_DEFECTO).activo) ? Lab.flujo(FLUJO_POR_DEFECTO) : Lab.flujos(true)[0]; // Concreto primero
  var base = fichaExistente ? JSON.parse(JSON.stringify(fichaExistente)) : {
    id:Lab.idNuevo('pry'), nombre:'', codigo:siguienteCodigoProyecto(), tipo_flujo_id:flujo ? flujo.id : '', responsable_id:usuarioActual ? usuarioActual.id : '',
    equipo:[], fecha_inicio:todayISO(), fecha_fin:'', objetivos:[], ensayos:flujo ? ensayosDelFlujo(flujo.id) : [], edades:flujo ? flujo.edades_defecto.slice() : [1,3,7,28],
    creado_por:usuarioActual ? usuarioActual.id : '', creado_en:new Date().toISOString()};
  base.objetivos = base.objetivos || []; base.equipo = base.equipo || []; base.edades = base.edades || [];
  asis = {paso:0, ficha:base, esNuevo:!fichaExistente, original:fichaExistente ? JSON.parse(JSON.stringify(fichaExistente)) : null};
  document.getElementById('asis-titulo').textContent = fichaExistente ? 'Editar proyecto · ' + fichaExistente.nombre : 'Nuevo proyecto';
  renderAsistente();
  abrirModal('asistente-proy-modal');
  setTimeout(function(){ var n = document.getElementById('asis-nombre'); if(n) n.focus(); }, 60);
}

function ensayosParaObjetivo(){
  return asis.ficha.ensayos.map(Lab.ensayo).filter(function(e){ return e && (e.etapa === 'endurecido' || ['ens-slump','ens-pu-concreto','ens-aire','ens-temp-concreto'].indexOf(e.id) > -1); });
}
function usuariosAsignables(){ return usuarios.filter(function(u){ return u.activo; }).sort(function(a,b){ return (a.nombre||'').localeCompare(b.nombre||''); }); }

function renderAsistente(){
  var f = asis.ficha;
  document.getElementById('asis-pasos').innerHTML = ASIS_PASOS.map(function(t, i){
    return '<li data-asis-paso="'+i+'" class="'+(i === asis.paso ? 'actual' : (i < asis.paso ? 'hecho' : ''))+'"><span>'+(i + 1)+'</span>'+t+'</li>';
  }).join('');
  mostrarErrorAsistente('');
  var c = document.getElementById('asis-cuerpo');
  if(asis.paso === 0){
    c.innerHTML = '<div class="pred-form">' +
      '<div class="pp-field"><label for="asis-nombre">Nombre del proyecto</label><input type="text" id="asis-nombre" maxlength="120" value="'+esc(f.nombre)+'" placeholder="Ej. Estudio Low Heat 2027"></div>' +
      '<div class="pp-field"><label for="asis-codigo">Código</label><input type="text" id="asis-codigo" maxlength="30" value="'+esc(f.codigo)+'"></div>' +
      '<div class="pp-field"><label for="asis-tipo">Tipo de proyecto</label><select id="asis-tipo">' + Lab.flujos(false).filter(function(x){ return x.activo || x.id === f.tipo_flujo_id; }).map(function(x){
        return '<option value="'+esc(x.id)+'"'+(x.id === f.tipo_flujo_id ? ' selected' : '')+'>'+esc(x.tipo_proyecto)+'</option>'; }).join('') + '</select></div>' +
      '<div class="pp-field"><label for="asis-responsable">Responsable</label><select id="asis-responsable"><option value="">Elegí…</option>' + usuariosAsignables().map(function(u){
        return '<option value="'+esc(u.id)+'"'+(u.id === f.responsable_id ? ' selected' : '')+'>'+esc(u.nombre || u.usuario)+' · '+esc(rolLabel(u.rol))+'</option>'; }).join('') + '</select></div>' +
      '<div class="pp-field"><label for="asis-inicio">Inicio estimado</label><input type="date" id="asis-inicio" value="'+esc(f.fecha_inicio)+'"></div>' +
      '<div class="pp-field"><label for="asis-fin">Fin estimado</label><input type="date" id="asis-fin" value="'+esc(f.fecha_fin)+'"></div>' +
    '</div><div class="section-num" style="margin-top:14px;">Equipo</div><div class="chips-fila" id="asis-equipo">' + usuariosAsignables().map(function(u){
      var on = f.equipo.indexOf(u.id) > -1;
      return '<label class="chip-check'+(on?' on':'')+'"><input type="checkbox" value="'+esc(u.id)+'"'+(on?' checked':'')+'> '+esc(u.nombre || u.usuario)+'</label>';
    }).join('') + '</div>';
  } else if(asis.paso === 1){
    var opciones = ensayosParaObjetivo();
    c.innerHTML = '<p class="nota-sm">Objetivos medibles del proyecto. Se evalúan solos con los resultados de los diseños.</p>' +
      (f.objetivos.length ? '<div class="table-scroll"><table class="data-table obj-tabla"><thead><tr><th>Ensayo</th><th>Edad</th><th>Condición</th><th>Valor</th><th>Hasta</th><th>Unidad</th><th>Descripción</th><th></th></tr></thead><tbody>' +
        f.objetivos.map(function(o, i){
          var e = Lab.ensayo(o.ensayo_id);
          var endu = e && e.etapa === 'endurecido';
          return '<tr data-obj="'+i+'"><td><select data-obj-k="ensayo_id">' + opciones.map(function(x){ return '<option value="'+esc(x.id)+'"'+(x.id === o.ensayo_id ? ' selected' : '')+'>'+esc(x.codigo + ' · ' + x.nombre)+'</option>'; }).join('') + '</select></td>' +
            '<td>' + (endu ? '<select data-obj-k="edad_dias">' + (f.edades.length ? f.edades : [28]).map(function(d){ return '<option value="'+d+'"'+(Number(o.edad_dias) === d ? ' selected' : '')+'>'+d+' d</option>'; }).join('') + '</select>' : '—') + '</td>' +
            '<td><select data-obj-k="operador">' + Object.keys(OPERADORES).map(function(k){ return '<option value="'+k+'"'+(k === o.operador ? ' selected' : '')+'>'+OPERADORES[k]+'</option>'; }).join('') + '</select></td>' +
            '<td><input type="number" step="any" data-obj-k="valor_min" value="'+esc(o.valor_min)+'"></td>' +
            '<td>' + (o.operador === 'entre' ? '<input type="number" step="any" data-obj-k="valor_max" value="'+esc(o.valor_max)+'">' : '—') + '</td>' +
            '<td><input type="text" data-obj-k="unidad" value="'+esc(o.unidad || (e ? e.unidades : ''))+'" maxlength="20"></td>' +
            '<td><input type="text" data-obj-k="descripcion" value="'+esc(o.descripcion)+'" maxlength="120" placeholder="Opcional"></td>' +
            '<td><button class="btn-icon danger" data-asis-acc="obj-quitar" data-i="'+i+'" title="Quitar">×</button></td></tr>';
        }).join('') + '</tbody></table></div>' : '<div class="empty-note">Sin objetivos todavía.</div>') +
      '<div class="form-actions"><button class="btn-add ghost" data-asis-acc="obj-agregar">+ Objetivo</button></div>';
  } else if(asis.paso === 2){
    var ensayos = Lab.ensayos(true).concat(f.ensayos.map(Lab.ensayo).filter(function(e){ return e && !e.activo; }));
    var hayEndurecido = f.ensayos.some(function(id){ var e = Lab.ensayo(id); return e && e.etapa === 'endurecido'; });
    c.innerHTML = '<div class="asis-etapas">' + ETAPAS_ENSAYO.map(function(et){
      var del = ensayos.filter(function(e){ return e.etapa === et.id; });
      if(!del.length) return '';
      return '<div class="asis-etapa"><div class="asis-etapa-cab"><b>'+esc(et.label)+'</b><button class="btn-ghost chico" data-asis-acc="etapa-todos" data-etapa="'+et.id+'">Todos / ninguno</button></div>' +
        del.map(function(e){
          var on = f.ensayos.indexOf(e.id) > -1;
          return '<label class="asis-ensayo'+(on?' on':'')+'"><input type="checkbox" data-asis-ensayo value="'+esc(e.id)+'"'+(on?' checked':'')+'><span><b>'+esc(e.codigo)+'</b> '+esc(e.nombre)+'</span><small>'+esc((e.metodo || '') + (e.version ? ' · ' + e.version : ''))+'</small></label>';
        }).join('') + '</div>';
    }).join('') + '</div>' +
    '<div class="section-num" style="margin-top:14px;">Edades de rotura'+(hayEndurecido ? '' : ' <span class="nota-sm">(no hay ensayos de estado endurecido)</span>')+'</div>' +
    '<div class="chips-fila">' + EDADES_OPCIONES.concat(f.edades.filter(function(d){ return EDADES_OPCIONES.indexOf(d) === -1; })).sort(function(a,b){ return a - b; }).map(function(d){
      var on = f.edades.indexOf(d) > -1;
      return '<button class="chip-edad-btn'+(on?' on':'')+'" data-asis-acc="edad" data-edad="'+d+'">'+d+' d</button>';
    }).join('') + '<span class="asis-otra"><input type="number" id="asis-edad-otra" min="1" max="3650" placeholder="Otra"><button class="btn-ghost chico" data-asis-acc="edad-otra">+ Agregar</button></span></div>';
  } else {
    var tmp = Object.assign({}, f);
    var tabs = tabsDeProyecto(tmp).map(function(t){ return t.label; });
    var porEtapa = {};
    f.ensayos.forEach(function(id){ var e = Lab.ensayo(id); if(e) (porEtapa[e.etapa] = porEtapa[e.etapa] || []).push(e.codigo); });
    c.innerHTML = '<div class="asis-confirmar">' +
      '<div><span class="nota-sm">Proyecto</span><b>'+esc(f.nombre)+'</b><span class="mono">'+esc(f.codigo)+' · '+esc((Lab.flujo(f.tipo_flujo_id) || {}).tipo_proyecto || '')+'</span></div>' +
      '<div><span class="nota-sm">Responsable y equipo</span><b>'+esc(nombreDe(f.responsable_id))+'</b><span>'+(f.equipo.map(nombreDe).join(', ') || 'Sin equipo')+'</span></div>' +
      '<div><span class="nota-sm">Fechas estimadas</span><b>'+(f.fecha_inicio ? isoToDMY(f.fecha_inicio) : '?')+' – '+(f.fecha_fin ? isoToDMY(f.fecha_fin) : '?')+'</b></div>' +
      '<div><span class="nota-sm">Objetivos</span>'+(f.objetivos.length ? '<ul class="obj-lista">' + f.objetivos.map(function(o){ return '<li>'+esc(textoObjetivo(o))+'</li>'; }).join('') + '</ul>' : '<span>Sin objetivos</span>')+'</div>' +
      '<div><span class="nota-sm">Checklist que heredará cada diseño ('+f.ensayos.length+' ensayos)</span>' + ETAPAS_ENSAYO.filter(function(et){ return porEtapa[et.id]; }).map(function(et){
        return '<div class="asis-conf-etapa"><b>'+esc(et.label)+':</b> '+porEtapa[et.id].map(function(cod){ return '<span class="chip-campo">'+esc(cod)+'</span>'; }).join('')+'</div>';
      }).join('') + (porEtapa.endurecido ? '<div class="asis-conf-etapa"><b>Edades de rotura:</b> '+f.edades.map(function(d){ return '<span class="chip-edad">'+d+' d</span>'; }).join('')+'</div>' : '') + '</div>' +
      '<div><span class="nota-sm">Pestañas del proyecto</span><div class="chips-fila">'+tabs.map(function(t){ return '<span class="chip-aut">'+esc(t)+'</span>'; }).join('')+'</div></div>' +
    '</div>';
  }
  document.getElementById('asis-anterior').style.visibility = asis.paso === 0 ? 'hidden' : 'visible';
  document.getElementById('asis-siguiente').textContent = asis.paso < 3 ? 'Siguiente →' : (asis.esNuevo ? 'Crear proyecto' : 'Guardar cambios');
}

function leerPasoAsistente(){
  var f = asis.ficha;
  var v = function(id){ var el = document.getElementById(id); return el ? el.value.trim() : null; };
  if(asis.paso === 0 && document.getElementById('asis-nombre')){
    f.nombre = v('asis-nombre'); f.codigo = v('asis-codigo').toUpperCase(); f.tipo_flujo_id = v('asis-tipo'); f.responsable_id = v('asis-responsable');
    f.fecha_inicio = v('asis-inicio'); f.fecha_fin = v('asis-fin');
    f.equipo = Array.prototype.map.call(document.querySelectorAll('#asis-equipo input:checked'), function(x){ return x.value; });
  } else if(asis.paso === 1){
    document.querySelectorAll('#asis-cuerpo tr[data-obj]').forEach(function(tr){
      var o = f.objetivos[Number(tr.dataset.obj)];
      tr.querySelectorAll('[data-obj-k]').forEach(function(el){
        var k = el.dataset.objK, val = el.value;
        o[k] = (k === 'valor_min' || k === 'valor_max' || k === 'edad_dias') ? (val === '' ? '' : Number(val)) : val;
      });
      var e = Lab.ensayo(o.ensayo_id);
      if(e && e.etapa !== 'endurecido') o.edad_dias = null;
      else if(e && !o.edad_dias) o.edad_dias = f.edades.indexOf(28) > -1 ? 28 : (f.edades[f.edades.length - 1] || 28);
      if(o.operador !== 'entre') o.valor_max = '';
    });
  } else if(asis.paso === 2){
    var marcados = Array.prototype.map.call(document.querySelectorAll('#asis-cuerpo [data-asis-ensayo]:checked'), function(x){ return x.value; });
    if(document.querySelector('#asis-cuerpo [data-asis-ensayo]')) f.ensayos = marcados;
  }
}
function validarPasoAsistente(paso){
  var f = asis.ficha;
  if(paso === 0){
    if(!f.nombre) return 'Ingresá el nombre del proyecto';
    var otroNombre = PROYECTO_CATALOGO.some(function(x){ return x.toLowerCase() === f.nombre.toLowerCase() && (!asis.original || x !== asis.original.nombre); });
    if(otroNombre) return 'Ya existe un proyecto con ese nombre';
    if(!f.codigo) return 'Ingresá el código';
    if(fichasProyecto.some(function(x){ return x.codigo === f.codigo && x.id !== f.id; })) return 'Ya existe un proyecto con el código ' + f.codigo;
    if(!f.tipo_flujo_id) return 'Elegí el tipo de proyecto';
    if(!f.responsable_id) return 'Elegí el responsable';
    if(f.fecha_inicio && f.fecha_fin && f.fecha_fin < f.fecha_inicio) return 'La fecha de fin no puede ser anterior al inicio';
  }
  if(paso === 1){
    for(var i = 0; i < f.objetivos.length; i++){
      var o = f.objetivos[i];
      if(o.valor_min === '' || !isFinite(o.valor_min)) return 'Indicá el valor del objetivo ' + (i + 1);
      if(o.operador === 'entre' && (o.valor_max === '' || !(o.valor_max > o.valor_min))) return 'En el objetivo ' + (i + 1) + ' el valor "hasta" debe ser mayor';
    }
  }
  if(paso === 2){
    if(!f.ensayos.length) return 'Elegí al menos un ensayo';
    var endu = f.ensayos.some(function(id){ var e = Lab.ensayo(id); return e && e.etapa === 'endurecido'; });
    if(endu && !f.edades.length) return 'Elegí al menos una edad de rotura';
    var sinEnsayo = f.objetivos.filter(function(o){ return f.ensayos.indexOf(o.ensayo_id) === -1; });
    if(sinEnsayo.length) return 'Hay objetivos sobre ensayos que quitaste: volvé al paso 2 para ajustarlos';
    var sinEdad = f.objetivos.filter(function(o){ return o.edad_dias && f.edades.indexOf(Number(o.edad_dias)) === -1; });
    if(sinEdad.length) return 'Un objetivo usa la edad ' + sinEdad[0].edad_dias + ' d, que no está entre las edades elegidas';
  }
  return '';
}
function mostrarErrorAsistente(t){ var el = document.getElementById('asis-error'); if(el) el.textContent = t; }
function avanzarAsistente(){
  leerPasoAsistente();
  var err = validarPasoAsistente(asis.paso);
  if(err){ mostrarErrorAsistente(err); return; }
  if(asis.paso < 3){ asis.paso++; renderAsistente(); return; }
  for(var p = 0; p < 3; p++){ err = validarPasoAsistente(p); if(err){ asis.paso = p; renderAsistente(); mostrarErrorAsistente(err); return; } }
  var f = asis.ficha;
  if(asis.esNuevo){
    if(!exigir('proyectos:editar')) return;
    guardarFicha(f, '').then(function(){
      cerrarModal('asistente-proy-modal');
      toast('Proyecto ' + f.nombre + ' creado');
      abrirExpediente(f.nombre, 'resumen');
    }).catch(function(){});
    return;
  }
  var dif = diferencias(asis.original, f, CAMPOS_FICHA);
  if(!dif && asis.original.migrado){
    // Ficha heredada de la versión anterior confirmada tal cual: deja de mostrarse el aviso
    var confirmar = function(){
      var fx = fichaPorId(f.id); if(fx){ delete fx.migrado; saveFichas(); }
      registrarHistorial('Editó', 'Proyectos', f.nombre + ' · ficha confirmada', {codigo:f.codigo, proyecto:f.nombre, servidor:Nube.activa()});
      cerrarModal('asistente-proy-modal'); toast('Ficha confirmada'); renderExpediente();
    };
    if(Nube.activa()) Nube.enviar('PUT', '/api/proyectos/' + encodeURIComponent(f.id), Object.assign({}, f, {motivo:'Ficha confirmada'})).then(confirmar).catch(function(){});
    else confirmar();
    return;
  }
  if(!dif){ cerrarModal('asistente-proy-modal'); toast('No hubo cambios'); return; }
  var legible = {antes:{}, despues:{}};
  var resumir = function(k, v){
    if(k === 'ensayos') return (v || []).map(function(id){ var e = Lab.ensayo(id); return e ? e.codigo : id; }).join(', ');
    if(k === 'equipo') return (v || []).map(nombreDe).join(', ');
    if(k === 'responsable_id') return nombreDe(v);
    if(k === 'tipo_flujo_id') return (Lab.flujo(v) || {}).tipo_proyecto || v;
    if(k === 'objetivos') return (v || []).map(textoObjetivo).join(' | ');
    if(k === 'edades') return (v || []).join(', ') + ' d';
    return v;
  };
  Object.keys(dif.despues).forEach(function(k){ legible.antes[k] = resumir(k, dif.antes[k]); legible.despues[k] = resumir(k, dif.despues[k]); });
  pedirMotivo('Editar proyecto ' + asis.original.nombre, resumenCambioHtml(legible, {codigo:'Código', nombre:'Nombre', tipo_flujo_id:'Tipo', responsable_id:'Responsable', equipo:'Equipo',
    fecha_inicio:'Inicio', fecha_fin:'Fin', objetivos:'Objetivos', ensayos:'Ensayos', edades:'Edades'}), function(motivo){
    guardarFicha(f, motivo).then(function(){
      cerrarModal('asistente-proy-modal');
      toast('Proyecto actualizado');
      abrirExpediente(f.nombre, expedienteTab);
    }).catch(function(){});
  });
}
document.getElementById('proy-nuevo-btn').addEventListener('click', function(){ if(exigir('proyectos:editar')) abrirAsistenteProyecto(null); });
