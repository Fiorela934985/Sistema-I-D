/* Sistema I+D — Ficha del proyecto (Fase 2) y estados calculados (regla 9: los estados se calculan, no se marcan).
   · Ficha: código, tipo (flujo de Ensayos y métodos), responsable, equipo, fechas, objetivos medibles y los ensayos
     elegidos con sus edades de rotura. Lo elegido es el checklist que hereda cada diseño (17025, 7.1 y 7.2).
   · Los proyectos que ya existían (solo un nombre) reciben su ficha automáticamente con el flujo de Concreto.
   · Diseño Abierto mientras falte algo del checklist; Cerrado cuando no falta nada. Chips de "Falta" y semáforo.
   Con servidor, la ficha se guarda en D1 (proyectos, proyecto_equipo, objetivos, proyecto_ensayos). */
'use strict';

var EDADES_OPCIONES = [1, 3, 4, 7, 28, 56, 90, 180, 360];
var FLUJO_POR_DEFECTO = 'flu-concreto';

var fichasProyecto = load('sid_proyectos_ficha', []);
function saveFichas(){ save('sid_proyectos_ficha', fichasProyecto); }

function siguienteCodigoProyecto(){
  var anio = new Date().getFullYear();
  var max = 0;
  fichasProyecto.forEach(function(f){ var m = /^PRY-(\d{4})-(\d+)$/.exec(f.codigo || ''); if(m && Number(m[1]) === anio) max = Math.max(max, Number(m[2])); });
  return 'PRY-' + anio + '-' + String(max + 1).padStart(3, '0');
}
function ensayosDelFlujo(flujoId){
  var f = Lab.flujo(flujoId);
  var ids = [];
  (f ? f.pasos : []).forEach(function(p){ (p.ensayos || []).forEach(function(id){ if(ids.indexOf(id) === -1) ids.push(id); }); });
  return ids;
}
/* Ficha de un proyecto por nombre. Si el proyecto existe solo como nombre, se crea con el flujo de Concreto. */
function fichaDeProyecto(nombre){
  if(!nombre) return null;
  var f = fichasProyecto.filter(function(x){ return x.nombre === nombre; })[0];
  if(f) return f;
  if(PROYECTO_CATALOGO.indexOf(nombre) === -1) return null;
  var flujo = Lab.flujo(FLUJO_POR_DEFECTO);
  var fechas = disenos.filter(function(d){ return proyectoNombre(d.proyectoId) === nombre && d.fecha; }).map(function(d){ return dmyToISO(d.fecha); }).filter(Boolean).sort();
  f = {id:Lab.idNuevo('pry'), nombre:nombre, codigo:siguienteCodigoProyecto(), tipo_flujo_id:FLUJO_POR_DEFECTO, responsable_id:'', equipo:[],
    fecha_inicio:fechas[0] || '', fecha_fin:'', objetivos:[], ensayos:ensayosDelFlujo(FLUJO_POR_DEFECTO),
    edades:flujo ? flujo.edades_defecto.slice() : [1,3,7,28], creado_en:new Date().toISOString(), migrado:true};
  fichasProyecto.push(f);
  saveFichas();
  return f;
}
function asegurarFichas(){ PROYECTO_CATALOGO.forEach(fichaDeProyecto); }
function fichaPorId(id){ return fichasProyecto.filter(function(f){ return f.id === id; })[0] || null; }

/* ---------- checklist y estado de cada diseño ---------- */
function etapasDelChecklist(ficha){
  var et = {};
  (ficha ? ficha.ensayos : []).forEach(function(id){ var e = Lab.ensayo(id); if(e) et[e.etapa] = true; });
  return et;
}
function replicaTieneFresco(r){
  if(!r) return false;
  return (r.slump || []).some(function(s){ return s && (s.slump !== '' && s.slump != null || s.tempc !== '' && s.tempc != null); }) || !!r.pesoUnitario || !!r.aire || !!r.thermoIni;
}
function tieneFresco(d){ return ((d.resultados && d.resultados.replicas) || []).some(replicaTieneFresco); }
/* Lo que falta se mide por réplica (sección 11): en los diseños de la Fase 3, cada réplica elaborada necesita su estado fresco */
function frescoCompleto(d){
  if(!d.flujo) return tieneFresco(d);
  var reps = d.replicaObjs || [], res = (d.resultados && d.resultados.replicas) || [];
  if(!reps.length) return false;
  return reps.every(function(r, i){ return replicaTieneFresco(res[i]); });
}
function fechaCorta(iso){ var p = String(iso || '').split('-'); return p.length === 3 ? p[2] + '/' + p[1] : ''; }
/* Lo que falta a un diseño según el checklist de su proyecto: [{tipo, texto, atrasado}] */
function faltaDiseno(d){
  var ficha = fichaDeProyecto(proyectoNombre(d.proyectoId));
  var et = etapasDelChecklist(ficha || {ensayos:ensayosDelFlujo(FLUJO_POR_DEFECTO)});
  var out = [];
  var reps = d.replicaObjs || [];
  if(d.flujo && et.caracterizacion && !d.loteAgregadoId) out.push({tipo:'agregados', texto:'Falta: Agregados'});
  if(d.flujo && (et.elaboracion || et.endurecido || et.fresco)){
    var sinElab = reps.filter(function(r){ return !r.codigo; });
    if(!reps.length) out.push({tipo:'diseno', texto:'Falta: Réplicas'});
    else if(sinElab.length) out.push({tipo:'elaboracion', texto:'Falta: Elaboración ' + sinElab.map(function(r){ return 'R' + r.n; }).join(', ')});
  }
  if(et.fresco && !frescoCompleto(d)) out.push({tipo:'fresco', texto:'Falta: Estado fresco'});
  if(et.endurecido){
    var cs = cargasDeDiseno(d).filter(function(c){ return !c.anulada; });
    var total = reps.length * (d.diasRotura || []).length;
    var pend = cs.filter(function(c){ return c.estado === 'pendiente'; }).sort(function(a,b){ return (a.fechaEnsayo || '').localeCompare(b.fechaEnsayo || '') || a.dia - b.dia; });
    var atr = pend.filter(cargaAtrasada);
    var prox = pend.filter(function(c){ return !cargaAtrasada(c); });
    if(atr.length) out.push({tipo:'atrasado', texto:'Atrasado: ' + atr[0].dia + 'd', atrasado:true});
    if(prox.length){
      var edadesProx = {}; prox.forEach(function(c){ edadesProx[c.dia] = true; });
      var nEd = Object.keys(edadesProx).length;
      out.push({tipo:'endurecido', texto:'Falta: Endurecido · ' + prox[0].dia + 'd el ' + textoVentana(prox[0]) + (nEd > 1 ? ' +' + (nEd - 1) : '')});
    }
    if(!pend.length && (d.flujo ? cs.length < Math.max(total, 1) : (!cs.length && !total))) out.push({tipo:'endurecido', texto:'Falta: Endurecido'});
  }
  return out;
}
function estadoCalculado(d){ return faltaDiseno(d).length ? 'Abierto' : 'Cerrado'; }
/* Semáforo del diseño completo: rojo sin avance, naranja parcial, verde completo */
function semaforoChecklist(d){
  var falta = faltaDiseno(d);
  if(!falta.length) return 'verde';
  var hayAvance = tieneFresco(d) || cargasDeDiseno(d).some(function(c){ return c.estado === 'completado'; }) ||
    (d.flujo && (!!d.loteAgregadoId || (d.replicaObjs || []).some(function(r){ return r.codigo; })));
  return hayAvance ? 'naranja' : 'rojo';
}
function chipsFaltaHtml(d){
  return faltaDiseno(d).map(function(f){ return '<span class="chip-falta' + (f.atrasado ? ' atrasado' : '') + '">' + esc(f.texto) + '</span>'; }).join(' ');
}

/* ---------- proyecto ---------- */
function resumenProyecto(ficha){
  var lista = disenos.filter(function(d){ return proyectoNombre(d.proyectoId) === ficha.nombre; });
  var abiertos = lista.filter(function(d){ return estadoCalculado(d) === 'Abierto'; });
  var hoy = todayISO();
  var codigos = {}; lista.forEach(function(d){ codigos[d.codigo] = true; });
  var pend = roturaCargas.filter(function(c){ return codigos[c.disenoCodigoDiseno] && !c.anulada && c.estado === 'pendiente' && c.fechaEnsayo; })
    .sort(function(a,b){ return a.fechaEnsayo.localeCompare(b.fechaEnsayo); });
  var prox = pend.filter(function(c){ return !cargaAtrasada(c); });
  return {
    disenos:lista, abiertos:abiertos, cerrados:lista.length - abiertos.length,
    avancePct: lista.length ? Math.round((lista.length - abiertos.length) / lista.length * 100) : 0,
    estado: lista.length && !abiertos.length ? 'Cerrado' : 'Abierto',
    proximaRotura: prox[0] || null, atrasadas: pend.filter(cargaAtrasada).length, pendientes: pend
  };
}
/* Etapa del flujo en la que está el proyecto: el primer paso que todavía tiene algo pendiente */
function etapaProyecto(ficha){
  var flujo = Lab.flujo(ficha.tipo_flujo_id);
  var pasos = flujo ? flujo.pasos.filter(function(p){ return (p.ensayos || []).some(function(id){ return ficha.ensayos.indexOf(id) > -1; }); }) : [];
  var r = resumenProyecto(ficha);
  var idx;
  var idxDe = function(id){ for(var i = 0; i < pasos.length; i++) if(pasos[i].id === id) return i; return -1; };
  if(!r.disenos.length) idx = Math.max(0, idxDe('diseno'));
  else if(!r.abiertos.length) idx = pasos.length;
  else {
    var faltas = {}; r.abiertos.forEach(function(d){ faltaDiseno(d).forEach(function(f){ faltas[f.tipo === 'atrasado' ? 'endurecido' : (f.tipo === 'diseno' ? 'elaboracion' : f.tipo)] = true; }); });
    idx = pasos.length;
    ['agregados','elaboracion','fresco','endurecido'].forEach(function(t){ var i = idxDe(t); if(faltas[t] && i > -1 && i < idx) idx = i; });
    if(idx === pasos.length) idx = Math.max(0, pasos.length - 1);
  }
  return {pasos:pasos, indice:idx, cerrado: r.disenos.length > 0 && !r.abiertos.length};
}

/* ---------- objetivos y su cumplimiento ---------- */
var OPERADORES = {'>=':'≥', '<=':'≤', 'entre':'entre', '=':'='};
function textoObjetivo(o){
  var e = Lab.ensayo(o.ensayo_id);
  var cond = o.operador === 'entre' ? 'entre ' + o.valor_min + ' y ' + o.valor_max : (OPERADORES[o.operador] || o.operador) + ' ' + o.valor_min;
  return (o.descripcion ? o.descripcion + ': ' : '') + (e ? e.nombre : 'Ensayo') + (o.edad_dias ? ' a ' + o.edad_dias + ' d' : '') + ' ' + cond + ' ' + (o.unidad || '');
}
function valorObjetivo(o, lista){
  var e = Lab.ensayo(o.ensayo_id);
  if(!e) return NaN;
  if(e.etapa === 'endurecido'){
    var vals = lista.map(function(d){ return resistenciaPorEdad(d)[o.edad_dias]; }).filter(isFinite);
    return vals.length ? Math.max.apply(null, vals) : NaN;
  }
  var campo = {'ens-slump':function(r){ return r.slump && r.slump[0] && r.slump[0].slump; }, 'ens-pu-concreto':function(r){ return r.pesoUnitario; },
    'ens-aire':function(r){ return r.aire; }, 'ens-temp-concreto':function(r){ return r.slump && r.slump[0] && r.slump[0].tempc; }}[e.id];
  if(!campo) return NaN;
  var v = [];
  lista.forEach(function(d){ ((d.resultados && d.resultados.replicas) || []).forEach(function(r){ var x = parseFloat(campo(r)); if(isFinite(x)) v.push(x); }); });
  return v.length ? promedio(v) : NaN;
}
function cumplimientoObjetivo(o, lista){
  var v = valorObjetivo(o, lista);
  if(!isFinite(v)) return {estado:'sin-datos', valor:NaN};
  var ok = o.operador === '>=' ? v >= o.valor_min : o.operador === '<=' ? v <= o.valor_min : o.operador === 'entre' ? (v >= o.valor_min && v <= o.valor_max) : Math.abs(v - o.valor_min) < 1e-9;
  return {estado: ok ? 'cumple' : 'no-cumple', valor:v};
}

/* ---------- guardar (servidor primero si hay; luego local + historial) ---------- */
var CAMPOS_FICHA = ['codigo','nombre','tipo_flujo_id','responsable_id','equipo','fecha_inicio','fecha_fin','objetivos','ensayos','edades'];
function guardarFicha(f, motivo){
  var previa = fichaPorId(f.id);
  var copiaPrevia = previa ? JSON.parse(JSON.stringify(previa)) : null;
  var dif = previa ? diferencias(previa, f, CAMPOS_FICHA) : null;
  if(previa && !dif) return Promise.resolve(false);
  var aplicar = function(){
    if(previa && previa.nombre !== f.nombre){
      var i = PROYECTO_CATALOGO.indexOf(previa.nombre);
      if(i > -1) PROYECTO_CATALOGO[i] = f.nombre;
      if(PROYECTO_ITERACIONES[previa.nombre]){ PROYECTO_ITERACIONES[f.nombre] = PROYECTO_ITERACIONES[previa.nombre]; delete PROYECTO_ITERACIONES[previa.nombre]; saveProyectoIteraciones(); }
      disenos.forEach(function(d){ if(d.proyectoId === previa.nombre) d.proyectoId = f.nombre; });
      save('sid10_disenos', disenos);
      renombrarProyectoEnTodo(previa.nombre, f.nombre);
      if(proyectoFlujo === previa.nombre){ proyectoFlujo = f.nombre; save('sid_proyecto_flujo', f.nombre); }
    }
    if(PROYECTO_CATALOGO.indexOf(f.nombre) === -1) PROYECTO_CATALOGO.push(f.nombre);
    saveCatalogo();
    var nueva = Object.assign({}, f); delete nueva.migrado;
    var idx = fichasProyecto.findIndex(function(x){ return x.id === f.id; });
    if(idx === -1) fichasProyecto.push(nueva); else fichasProyecto[idx] = nueva;
    saveFichas();
    refreshAllProyectoSelects();
    registrarHistorial(previa ? 'Editó' : 'Creó', 'Proyectos', f.nombre, {codigo:f.codigo, ref:f.id, proyecto:f.nombre,
      antes: dif ? dif.antes : undefined, despues: dif ? dif.despues : {codigo:f.codigo, tipo:f.tipo_flujo_id, ensayos:f.ensayos.length + ' ensayos'}, motivo:motivo || '', servidor:Nube.activa()});
  };
  if(!Nube.activa()){ aplicar(); return Promise.resolve(true); }
  return Nube.enviar('PUT', '/api/proyectos/' + encodeURIComponent(f.id), Object.assign({}, f, {motivo:motivo, era_migrado:!!(copiaPrevia && copiaPrevia.migrado)}))
    .then(function(){ aplicar(); return true; });
}
function sincronizarProyectos(){
  if(!Nube.activa() || !Nube.tieneToken()) return Promise.resolve(false);
  return Nube.pedir('GET', '/api/proyectos').then(function(lista){
    lista.forEach(function(p){
      var f = {id:p.id, nombre:p.nombre, codigo:p.codigo || '', tipo_flujo_id:p.tipo_flujo_id || FLUJO_POR_DEFECTO, responsable_id:p.responsable_id || '', equipo:p.equipo || [],
        fecha_inicio:p.fecha_inicio || '', fecha_fin:p.fecha_fin || '', objetivos:p.objetivos || [], ensayos:p.ensayos || [], edades:p.edades || [], creado_en:p.creado_en};
      fichasProyecto = fichasProyecto.filter(function(x){ return x.nombre !== f.nombre && x.id !== f.id; });
      fichasProyecto.push(f);
      if(PROYECTO_CATALOGO.indexOf(f.nombre) === -1) PROYECTO_CATALOGO.push(f.nombre);
    });
    saveFichas(); saveCatalogo(); refreshAllProyectoSelects();
    return true;
  }).catch(function(){ return false; });
}
