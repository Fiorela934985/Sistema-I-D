/* Sistema I+D — La secuencia del proceso I+D, en un solo lugar.
   1 Proyecto → 2 Diseño → 3 Elaboración (+ etiquetas y desmolde) → 4 Roturas → 5 Revisión → 6 Reporte RR → 7 Archivador
   Cada réplica avanza: Por elaborar → Programada → Elaborada → Desmoldada → Completa.
   Inicio, el expediente del proyecto y cada sección muestran en qué paso está cada cosa. */
'use strict';

var ESTADOS_REPLICA = ['Por elaborar', 'Programada', 'Elaborada', 'Desmoldada', 'Completa'];

function cargasDeReplicaObj(d, rep){
  return roturaCargas.filter(function(c){ return c.disenoCodigoDiseno === d.codigo && c.replicaNombre === rep.nombre; });
}
/* Una edad está resuelta si se rompió, se marcó No ubicada o se invalidó con motivo. */
function cargaResuelta(c){ return c.estado === 'completado' || c.estado === 'no-ubicada' || c.estado === 'invalidada' || c.estado === 'cancelada'; }
function estadoReplica(d, rep){
  var cargas = cargasDeReplicaObj(d, rep);
  var elaborada = !!rep.elaboracion || (cargas.length > 0 && !rep.programacion);   // datos anteriores: las roturas nacían con el diseño
  if(!elaborada) return rep.programacion ? 'Programada' : 'Por elaborar';
  if(cargas.length && cargas.every(cargaResuelta)) return 'Completa';
  return rep.desmolde || !rep.elaboracion ? 'Desmoldada' : 'Elaborada';
}
function replicasDe(d){ return d.replicaObjs || []; }
function todasLasReplicas(filtro){
  var out = [];
  disenos.forEach(function(d){
    if(d.estado === 'Cancelado') return;
    if(filtro && !filtro(d)) return;
    replicasDe(d).forEach(function(rep, i){ out.push({d:d, rep:rep, idx:i, estado:estadoReplica(d, rep)}); });
  });
  return out;
}
/* Diseño listo para revisión: todas sus réplicas Completas (RF-RES-01). */
function disenoListoParaRevision(d){
  var reps = replicasDe(d);
  return reps.length > 0 && ['Completado', 'Validado', 'Cancelado'].indexOf(d.estado) === -1 &&
    reps.every(function(r){ return estadoReplica(d, r) === 'Completa'; });
}
/* Tarea de desmolde: aparece a las 24 h; ventana 16–32 h (NTP 339.183 / ASTM C192). */
function horasDesdeElaboracion(rep){
  if(!rep.elaboracion || !rep.elaboracion.fecha) return NaN;
  var t = new Date(rep.elaboracion.fecha + 'T' + (rep.elaboracion.hora || '08:00') + ':00').getTime();
  return (Date.now() - t) / 3600000;
}

/* Conteos por etapa. filtroProyecto: nombre del proyecto o vacío para todos los visibles. */
function etapasProceso(filtroProyecto){
  var hoy = todayISO();
  var visibles = {};
  proyectosVisibles().forEach(function(p){ visibles[p.nombre] = true; });
  var enAlcance = function(nombre){ return filtroProyecto ? nombre === filtroProyecto : (visibles[nombre] || !proyectoPorNombre(nombre)); };
  var dis = disenos.filter(function(d){ return enAlcance(proyectoNombre(d.proyectoId)); });
  var reps = todasLasReplicas(function(d){ return enAlcance(proyectoNombre(d.proyectoId)); });
  var codigos = {}; dis.forEach(function(d){ codigos[d.codigo] = true; });
  var cargas = roturaCargas.filter(function(c){ return codigos[c.disenoCodigoDiseno] || (!c.disenoCodigoDiseno && enAlcance(c.proyecto)); });
  var pend = cargas.filter(function(c){ return c.estado === 'pendiente'; });
  var rr = rrEstudios.filter(function(e){ return enAlcance(proyectoNombre(e.proyectoId)); });
  var proys = filtroProyecto ? [proyectoPorNombre(filtroProyecto)].filter(Boolean) : proyectosVisibles();
  var porDesmoldar = reps.filter(function(r){ return r.estado === 'Elaborada'; });
  return [
    {n:1, id:'proyectos', titulo:'Proyecto', panel:'proyectos', total: proys.length,
      detalle: proys.filter(function(p){ return p.fichaIncompleta; }).length + ' con ficha incompleta',
      alerta: proys.filter(function(p){ return p.fichaIncompleta; }).length},
    {n:2, id:'disenos', titulo:'Diseño', panel:'disenos', total: dis.length,
      detalle: dis.filter(function(d){ return d.estado === 'Iniciado'; }).length + ' iniciados', alerta:0},
    {n:3, id:'elaboracion', titulo:'Elaboración', panel:'elaboracion', total: reps.filter(function(r){ return r.estado === 'Por elaborar' || r.estado === 'Programada'; }).length,
      detalle: reps.filter(function(r){ return r.estado === 'Programada' && r.rep.programacion.fecha === hoy; }).length + ' para hoy · ' + porDesmoldar.length + ' por desmoldar',
      alerta: porDesmoldar.filter(function(r){ return horasDesdeElaboracion(r.rep) > 32; }).length},
    {n:4, id:'roturas', titulo:'Roturas', panel:'roturas', total: pend.length,
      detalle: pend.filter(function(c){ return c.fechaEnsayo === hoy; }).length + ' hoy · ' + pend.filter(function(c){ return c.fechaEnsayo < hoy; }).length + ' vencidas',
      alerta: pend.filter(function(c){ return c.fechaEnsayo < hoy; }).length},
    {n:5, id:'revision', titulo:'Revisión', panel:'revision', total: dis.filter(disenoListoParaRevision).length,
      detalle: dis.filter(function(d){ return d.estado === 'Completado' && !d.validacion; }).length + ' por validar (JEF)', alerta:0},
    {n:6, id:'reporte-rr', titulo:'Reporte RR', panel:'reporte-rr', total: rr.filter(function(e){ return !e.emitido; }).length,
      detalle: rr.filter(function(e){ return e.emitido && !rrFirmadoPorJefatura(e); }).length + ' por firmar', alerta:0},
    {n:7, id:'archivador', titulo:'Archivador', panel:'archivador', total: dis.filter(function(d){ return d.estado === 'Completado' || d.estado === 'Validado'; }).length,
      detalle: 'diseños completados', alerta:0}
  ];
}
function rrFirmadoPorJefatura(e){ return (e.firmas || []).some(function(f){ return f.rol === 'JEF'; }); }

/* Barra de pasos. Cada paso lleva a su sección (con el proyecto filtrado si corresponde). */
function flujoHtml(filtroProyecto, compacto){
  return '<div class="flujo' + (compacto ? ' compacto' : '') + '">' + etapasProceso(filtroProyecto).map(function(e, i, arr){
    var cls = e.alerta ? ' alerta' : (e.total ? ' activo' : '');
    return '<button class="flujo-paso' + cls + '" data-goto="' + e.panel + '"' + (filtroProyecto ? ' data-flujo-proy="' + esc(filtroProyecto) + '"' : '') + '>' +
      '<span class="flujo-num">' + e.n + '</span>' +
      '<span class="flujo-txt"><b>' + esc(e.titulo) + '</b><span class="flujo-total">' + e.total + '</span><small>' + esc(e.detalle) + '</small></span>' +
      '</button>' + (i < arr.length - 1 ? '<span class="flujo-flecha" aria-hidden="true">›</span>' : '');
  }).join('') + '</div>';
}
/* Línea de estados de una réplica (para el cuaderno y la ficha del diseño). */
function estadosReplicaHtml(estado){
  var idx = ESTADOS_REPLICA.indexOf(estado);
  return '<span class="rep-estados">' + ESTADOS_REPLICA.map(function(s, i){
    return '<span class="rep-estado' + (i < idx ? ' hecho' : (i === idx ? ' actual' : '')) + '">' + esc(s) + '</span>';
  }).join('') + '</span>';
}
