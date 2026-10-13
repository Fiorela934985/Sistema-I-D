/* Sistema I+D — Historial (auditoría): quién hizo qué y cuándo */
'use strict';

var HISTORIAL_MAX = 5000;
var historial = load('sid_historial', []);
function saveHistorial(){ save('sid_historial', historial); }

/* accion: Creó / Editó / Eliminó / Registró / Ingresó…  entidad: Diseño, Rotura, Proyecto…
   detalle: texto libre. extra.proyecto: nombre del proyecto relacionado (para el expediente). */
function registrarHistorial(accion, entidad, detalle, extra){
  extra = extra || {};
  historial.unshift({
    id: 'h' + Date.now() + Math.floor(Math.random()*1000),
    ts: Date.now(),
    usuarioId: usuarioActual ? usuarioActual.id : '',
    usuario: usuarioActual ? usuarioActual.usuario : 'sistema',
    rol: usuarioActual ? usuarioActual.rol : '',
    accion: accion,
    entidad: entidad,
    detalle: detalle || '',
    proyecto: extra.proyecto || '',
    ref: extra.ref || ''
  });
  if(historial.length > HISTORIAL_MAX) historial.length = HISTORIAL_MAX;
  saveHistorial();
}
function historialDeProyecto(nombre){
  var key = String(nombre||'').toLowerCase();
  return historial.filter(function(h){ return (h.proyecto||'').toLowerCase() === key; });
}
function fechaHora(ts){
  var d = new Date(ts);
  return String(d.getDate()).padStart(2,'0')+'/'+String(d.getMonth()+1).padStart(2,'0')+'/'+d.getFullYear()+' '+
    String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');
}
function hace(ts){
  var s = Math.round((Date.now() - ts)/1000);
  if(s < 60) return 'hace un momento';
  if(s < 3600) return 'hace ' + Math.round(s/60) + ' min';
  if(s < 86400) return 'hace ' + Math.round(s/3600) + ' h';
  var d = Math.round(s/86400);
  return d === 1 ? 'ayer' : ('hace ' + d + ' días');
}
