/* Sistema I+D — Analítica compartida: métricas por proyecto/diseño y base histórica aplanada.
   Proyectos, Radar, Dashboard, Base histórica, Predicción y el Asistente leen de acá para que todos
   muestren los mismos números. */
'use strict';

function disenoPorCodigo(codigo){ return disenos.filter(function(d){ return d.codigo === codigo; })[0] || null; }
function cargasDeDiseno(d){ return roturaCargas.filter(function(c){ return c.disenoCodigoDiseno === d.codigo; }); }
function valoresKgCm2(c){
  var v = [c.m1kgcm2, c.m2kgcm2, c.m3kgcm2].map(Number).filter(function(x){ return x > 0; });
  if(!v.length && Number(c.promedio) > 0) v = [Number(c.promedio)]; 
  return v;
}
/* Resistencia por edad de un diseño: combina todos los especímenes de todas sus réplicas. */
function resistenciaPorEdad(d){
  var porDia = {};
  cargasDeDiseno(d).forEach(function(c){
    var v = valoresKgCm2(c);
    if(!v.length) return;
    (porDia[c.dia] = porDia[c.dia] || []).push.apply(porDia[c.dia], v);
  });
  var out = {};
  Object.keys(porDia).forEach(function(dia){ out[dia] = promedio(porDia[dia]); });
  return out;
}
function resistenciaMaxima(d){
  var r = resistenciaPorEdad(d);
  var vals = Object.keys(r).map(function(k){ return r[k]; });
  return vals.length ? Math.max.apply(null, vals) : NaN;
}
/* Tipo de cemento: primero por el material realmente usado en la mezcla (I-PAC / HE-PAC); el nombre
   no sirve porque los estudios se llaman "EST HE …" aunque usen cemento Tipo I. */
function tipoCementoNormalizado(d){
  var mix = (d.mix || []).filter(function(it){ return n(it.pesoSeco) > 0; }).map(function(it){ return String(it.nombre || '').toUpperCase(); });
  if(mix.some(function(x){ return /^HE[-\s]?PAC|\bHE[-\s]?PAC\b/.test(x); })) return 'HE';
  if(mix.some(function(x){ return /^I[-\s]?PAC|\bTIPO I\b/.test(x); })) return 'I';
  var nom = String(d.nombreTecnico || '').toUpperCase();
  if(/TIPO I\b/.test(nom)) return 'I';
  var t = String(d.cementoTipo || nom).toUpperCase();
  return /\bHE\b|HE-|HEV/.test(t) ? 'HE' : 'I';
}
function contenidoCemento(d){
  if(n(d.cementoPeso) > 0) return n(d.cementoPeso);
  var nombresCemento = componentes.filter(function(c){ return c.categoria === 'Cemento'; }).map(function(c){ return c.nombre.toUpperCase(); });
  var total = (d.mix || []).reduce(function(acc, it){
    var nom = String(it.nombre || '').toUpperCase();
    var esCemento = nombresCemento.indexOf(nom) > -1 || /(^|[^A-Z])(I|HE|MS|IP|ICO)-?PAC\b|CEMENTO/.test(nom);
    return acc + (esCemento ? n(it.pesoSeco) : 0);
  }, 0);
  return total || NaN;
}
function usaFlyAsh(d){ return (d.mix || []).some(function(it){ return /FLY\s*ASH|CENIZA/i.test(it.nombre) && n(it.pesoSeco) > 0; }) || /\bFA\b|FLY ASH/i.test(d.nombreTecnico || ''); }

/* ---------- Métricas por proyecto ---------- */
function metricasProyecto(nombre){
  var hoy = todayISO();
  var lista = disenos.filter(function(d){ return proyectoNombre(d.proyectoId) === nombre; });
  var codigos = {}; lista.forEach(function(d){ codigos[d.codigo] = true; });
  var cargas = roturaCargas.filter(function(c){ return codigos[c.disenoCodigoDiseno]; });
  var completas = cargas.filter(function(c){ return c.estado === 'completado'; });
  var pendientes = cargas.filter(function(c){ return c.estado === 'pendiente'; });
  var vencidas = pendientes.filter(function(c){ return c.fechaEnsayo < hoy; });
  var proximas = pendientes.filter(function(c){ return c.fechaEnsayo >= hoy; }).map(function(c){ return c.fechaEnsayo; }).sort();
  var completados = lista.filter(function(d){ return d.estado === 'Completado'; }).length;
  var iteraciones = {};
  lista.forEach(function(d){ if(d.iteracionId) iteraciones[d.iteracionId] = true; });
  iteracionesDeProyecto(nombre).forEach(function(it){ iteraciones[it] = true; });
  var resistMax = lista.map(resistenciaMaxima).filter(isFinite);
  var r28 = lista.map(function(d){ return resistenciaPorEdad(d)[28]; }).filter(isFinite);
  var costos = lista.map(function(d){ return n(d.cvdTotal); }).filter(function(v){ return v > 0; });
  var tsAct = lista.map(function(d){ return d.editedAt || d.ts || 0; });
  historialDeProyecto(nombre).slice(0,1).forEach(function(h){ tsAct.push(h.ts); });
  var ultima = tsAct.length ? Math.max.apply(null, tsAct) : 0;
  var limite30 = Date.now() - 30*DAY;
  var estado = !lista.length ? 'Sin diseños' : (completados === lista.length ? 'Completado' : 'En curso');
  return {
    nombre: nombre, disenos: lista, nDisenos: lista.length,
    completados: completados,
    enDesarrollo: lista.filter(function(d){ return d.estado === 'En desarrollo'; }).length,
    iniciados: lista.filter(function(d){ return d.estado === 'Iniciado'; }).length,
    iteraciones: Object.keys(iteraciones),
    cargas: cargas, cargasCompletas: completas.length, cargasPendientes: pendientes.length, vencidas: vencidas.length,
    proximaRotura: proximas[0] || '',
    avancePct: lista.length ? Math.round(completados / lista.length * 100) : 0,
    roturasPct: cargas.length ? Math.round(completas.length / cargas.length * 100) : 0,
    puntualidadPct: cargas.length ? Math.round((cargas.length - vencidas.length) / cargas.length * 100) : 100,
    resistMax: resistMax.length ? Math.max.apply(null, resistMax) : NaN,
    resist28: r28.length ? promedio(r28) : NaN,
    costoProm: costos.length ? promedio(costos) : NaN,
    recientes: lista.filter(function(d){ return (d.ts||0) >= limite30; }).length,
    ultimaActividad: ultima,
    estado: estado
  };
}
function nombresDeProyectos(){
  var set = {};
  PROYECTO_CATALOGO.forEach(function(p){ set[p] = true; });
  disenos.forEach(function(d){ var p = proyectoNombre(d.proyectoId); if(p) set[p] = true; });
  return Object.keys(set);
}
function metricasTodosLosProyectos(){ return nombresDeProyectos().map(metricasProyecto); }

/* Ejes del radar normalizados a 0–100 comparando contra el conjunto. */
function ejesRadar(lista){
  var maxRes = Math.max.apply(null, lista.map(function(m){ return isFinite(m.resistMax) ? m.resistMax : 0; }).concat([1]));
  var maxRec = Math.max.apply(null, lista.map(function(m){ return m.recientes; }).concat([1]));
  var costos = lista.map(function(m){ return m.costoProm; }).filter(isFinite);
  var cMin = costos.length ? Math.min.apply(null, costos) : 0, cMax = costos.length ? Math.max.apply(null, costos) : 0;
  return lista.map(function(m){
    var costoScore = !isFinite(m.costoProm) ? 0 : (cMax === cMin ? 100 : Math.round(100 - (m.costoProm - cMin) / (cMax - cMin) * 100));
    return {nombre: m.nombre, valores: [
      m.avancePct, m.roturasPct, m.puntualidadPct,
      isFinite(m.resistMax) ? Math.round(m.resistMax / maxRes * 100) : 0,
      Math.round(m.recientes / maxRec * 100),
      costoScore
    ]};
  });
}
var EJES_RADAR = ['Avance', 'Roturas', 'Puntualidad', 'Resistencia', 'Actividad', 'Costo'];

/* ---------- Base histórica: una fila por réplica y edad ---------- */
var BH_COLUMNAS = [
  {k:'proyecto', t:'Proyecto'}, {k:'iteracion', t:'Iteración'}, {k:'disenoCodigo', t:'Cód. diseño'}, {k:'diseno', t:'Diseño'},
  {k:'replica', t:'Réplica'}, {k:'codigoId', t:'Código ID'}, {k:'tipo', t:'Tipo'}, {k:'planta', t:'Planta'},
  {k:'fc', t:"f'c (kg/cm²)"}, {k:'amc', t:'a/mc'}, {k:'cementoTipo', t:'Cemento'}, {k:'cementoKg', t:'Cemento (kg/m³)'},
  {k:'flyAsh', t:'Fly Ash'}, {k:'edad', t:'Edad (d)'}, {k:'resistencia', t:'Resistencia (kg/cm²)'}, {k:'coefVar', t:'Coef. var.'},
  {k:'fechaElaboracion', t:'F. elaboración'}, {k:'fechaEnsayo', t:'F. ensayo'}, {k:'estado', t:'Estado'}, {k:'cvd', t:'CVD (S/.)'}
];
function baseHistoricaFilas(){
  var porCodigo = {};
  disenos.forEach(function(d){ porCodigo[d.codigo] = d; });
  return roturaCargas.map(function(c){
    var d = porCodigo[c.disenoCodigoDiseno] || {};
    var v = valoresKgCm2(c);
    return {
      proyecto: c.proyecto || proyectoNombre(d.proyectoId) || '',
      iteracion: c.iteracion || d.iteracionId || '',
      disenoCodigo: c.disenoCodigoDiseno || '',
      diseno: d.codigo ? diseñoTitulo(d) : c.producto,
      replica: c.replicaNombre || '',
      codigoId: c.codigo || '',
      tipo: c.tipo || 'Probetas',
      planta: d.planta || '',
      fc: n(d.fc) || '',
      amc: n(d.amcEfectiva) || '',
      cementoTipo: d.codigo ? tipoCementoNormalizado(d) : '',
      cementoKg: d.codigo && isFinite(contenidoCemento(d)) ? Math.round(contenidoCemento(d)) : '',
      flyAsh: d.codigo ? (usaFlyAsh(d) ? 1 : 0) : '',
      edad: Number(c.dia),
      resistencia: v.length ? +promedio(v).toFixed(2) : '',
      coefVar: c.coefVar || '',
      fechaElaboracion: c.fechaElaboracion || '',
      fechaEnsayo: c.fechaEnsayo || '',
      estado: c.estado || '',
      cvd: n(d.cvdTotal) || ''
    };
  });
}
