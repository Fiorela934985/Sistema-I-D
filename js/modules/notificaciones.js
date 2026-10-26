/* Sistema I+D — Una sola campana para todo el sistema (RF-NOT-01/02/04) y la lista "Requiere atención"
   según el rol (RF-DSH-07). Hay dos fuentes:
   - avisos guardados (alguien hizo algo: te asignaron una elaboración, una probeta no se ubicó…);
   - avisos calculados a partir de los datos (roturas de hoy, desmoldes, stock bajo…), que se recalculan siempre. */
'use strict';

var notificaciones = load('sid_notificaciones', []);
function saveNotificaciones(){
  if(notificaciones.length > 2000) notificaciones.length = 2000;
  save('sid_notificaciones', notificaciones);
}
/* RF-NOT-04: un mismo aviso no se repite más de una vez al día por destinatario. */
function agregarNotificacion(para, titulo, texto, panel){
  var hoy = todayISO();
  var dup = notificaciones.some(function(x){ return x.para === para && x.titulo === titulo && x.texto === texto && x.dia === hoy; });
  if(dup) return;
  notificaciones.unshift({id: 'n' + Date.now() + Math.random().toString(36).slice(2, 5), para: para, titulo: titulo, texto: texto, panel: panel || '', ts: Date.now(), dia: hoy, leidaPor: []});
  saveNotificaciones();
  if(typeof actualizarCampana === 'function') actualizarCampana();
}
function notificar(rol, titulo, texto, panel){ agregarNotificacion('rol:' + rol, titulo, texto, panel); }
function notificarUsuario(id, titulo, texto, panel){ if(id) agregarNotificacion('usr:' + id, titulo, texto, panel); }
function notificarResponsablesProyecto(nombre, titulo, texto, panel){
  var p = proyectoPorNombre(nombre);
  if(p && p.responsable) notificarUsuario(p.responsable, titulo, texto, panel);
  else notificar('ANA', titulo, texto, panel);
}
function esParaMi(x){
  if(!usuarioActual) return false;
  return x.para === 'usr:' + usuarioActual.id || x.para === 'rol:' + rolDe(usuarioActual) || x.para === 'todos';
}

/* Avisos calculados según el rol (cada uno con una clave estable para marcarlo como leído). */
function avisosCalculados(){
  if(!usuarioActual) return [];
  var rol = rolDe(usuarioActual), hoy = todayISO(), manana = addDaysISO(hoy, 1);
  var out = [];
  var add = function(clave, nivel, titulo, texto, panel){ out.push({clave: clave + ':' + hoy, nivel: nivel, titulo: titulo, texto: texto, panel: panel, ts: Date.now(), calculado: true}); };
  if(['TEC', 'ANA', 'JEF', 'ADM'].indexOf(rol) > -1){
    var pend = roturasVisibles().filter(function(c){ return c.estado === 'pendiente'; });
    var venc = pend.filter(function(c){ return c.fechaEnsayo < hoy; });
    var deHoy = pend.filter(function(c){ return c.fechaEnsayo === hoy; });
    var deManana = pend.filter(function(c){ return c.fechaEnsayo === manana && (rol !== 'TEC' || c.tecnicoId === usuarioActual.id || !c.tecnicoId); });
    if(venc.length) add('rot-venc', 'rojo', venc.length + ' rotura(s) vencida(s)', venc.slice(0, 4).map(function(c){ return c.codigo + ' ' + c.dia + ' d'; }).join(', '), 'roturas');
    if(deHoy.length) add('rot-hoy', 'naranja', deHoy.length + ' rotura(s) para hoy', deHoy.slice(0, 4).map(function(c){ return c.codigo + ' ' + c.dia + ' d (' + ventanaTexto(c) + ')'; }).join(', '), 'roturas');
    if(deManana.length) add('rot-manana', 'celeste', deManana.length + ' rotura(s) mañana', 'Aviso del día anterior: ' + deManana.slice(0, 4).map(function(c){ return c.codigo + ' ' + c.dia + ' d'; }).join(', '), 'roturas');   // RF-ROT-02
    var reps = todasLasReplicas().filter(function(x){ return replicaMeCorresponde(x.d, x.rep); });
    var elabHoy = reps.filter(function(x){ return x.estado === 'Programada' && x.rep.programacion.fecha <= hoy; });
    if(elabHoy.length) add('ela-hoy', 'naranja', elabHoy.length + ' réplica(s) para elaborar', elabHoy.slice(0, 4).map(function(x){ return x.rep.nombre; }).join(', '), 'elaboracion');
    var desm = reps.filter(function(x){ return x.estado === 'Elaborada' && horasDesdeElaboracion(x.rep) >= 16; });
    if(desm.length) add('desm', desm.some(function(x){ return horasDesdeElaboracion(x.rep) > 32; }) ? 'rojo' : 'naranja', desm.length + ' réplica(s) por desmoldar', desm.slice(0, 4).map(function(x){ return x.rep.nombre + ' (' + Math.round(horasDesdeElaboracion(x.rep)) + ' h)'; }).join(', '), 'elaboracion');
    var sinEtq = reps.filter(function(x){ return x.rep.elaboracion && !x.rep.etiquetado; });
    if(sinEtq.length) add('etq', 'rojo', sinEtq.length + ' réplica(s) sin confirmar etiquetado', sinEtq.slice(0, 4).map(function(x){ return x.rep.nombre; }).join(', '), 'elaboracion');
  }
  if(rol === 'ANA' || rol === 'JEF' || rol === 'ADM'){
    var rev = typeof disenosParaRevision === 'function' ? disenosParaRevision() : [];
    if(rev.length) add('rev', 'celeste', rev.length + ' diseño(s) listo(s) para revisión', rev.slice(0, 4).map(function(d){ return d.codigo; }).join(', '), 'revision');
    var fichas = proyectosVisibles().filter(function(p){ return p.fichaIncompleta && (rol !== 'ANA' || esDeMiEquipo(p)); });
    if(fichas.length) add('fichas', 'celeste', fichas.length + ' proyecto(s) con ficha incompleta', fichas.slice(0, 4).map(function(p){ return p.nombre; }).join(', '), 'proyectos');
    var rojos = proyectosVisibles().filter(function(p){ return proyectoAbierto(p) && semaforoProyecto(p.nombre).color === 'rojo'; });
    if(rojos.length) add('proy-rojo', 'rojo', rojos.length + ' proyecto(s) en rojo', rojos.slice(0, 4).map(function(p){ return p.nombre + ' (' + semaforoProyecto(p.nombre).motivos.join(', ') + ')'; }).join('; '), 'proyectos');
  }
  if(rol === 'JEF' || rol === 'ADM'){
    var porValidar = disenos.filter(function(d){ return d.estado === 'Completado' && !d.validacion; });
    if(porValidar.length) add('validar', 'celeste', porValidar.length + ' diseño(s) por validar', porValidar.slice(0, 4).map(function(d){ return d.codigo; }).join(', '), 'revision');
    var rrFirmar = rrEstudios.filter(function(e){ return e.emitido && !rrFirmadoPorJefatura(e); });
    if(rrFirmar.length) add('rr-firmar', 'celeste', rrFirmar.length + ' RR por firmar', rrFirmar.slice(0, 4).map(function(e){ return e.codigo || e.nombre; }).join(', '), 'reporte-rr');
  }
  if(typeof avisosInventario === 'function' && (rol === 'INV' || rol === 'JEF' || rol === 'ADM')) avisosInventario().forEach(function(a){ add(a.clave, a.nivel, a.titulo, a.texto, 'inventario'); });
  return out;
}
function leidasDeUsuario(){ return usuarioActual ? load('sid_notif_leidas_' + usuarioActual.id, {}) : {}; }
function marcarLeida(clave){
  var l = leidasDeUsuario(); l[clave] = Date.now();
  save('sid_notif_leidas_' + usuarioActual.id, l);
}
function avisosDeLaCampana(){
  var leidas = leidasDeUsuario();
  var guardados = notificaciones.filter(esParaMi).map(function(x){ return {clave: x.id, nivel: 'celeste', titulo: x.titulo, texto: x.texto, panel: x.panel, ts: x.ts}; });
  return avisosCalculados().concat(guardados).map(function(a){ a.leida = !!leidas[a.clave]; return a; });
}
function actualizarCampana(){
  if(!usuarioActual) return;
  var notifOn = typeof settings === 'undefined' || settings.notif !== false;
  var lista = avisosDeLaCampana();
  var noLeidas = lista.filter(function(a){ return !a.leida; });
  var dot = document.getElementById('nav-bell-dot');
  dot.style.display = notifOn && noLeidas.length ? 'flex' : 'none';
  dot.textContent = noLeidas.length > 9 ? '9+' : (noLeidas.length || '');
  document.querySelector('#bell-dropdown .bell-header').innerHTML = 'Avisos <span class="nota-sm">' + noLeidas.length + ' sin leer</span><button class="bell-leer-todo" id="bell-leer-todo">Marcar todo leído</button>';
  var bellList = document.getElementById('bell-list');
  if(!notifOn){ bellList.innerHTML = '<div class="bell-empty">Los avisos están desactivados en Ajustes.</div>'; return; }
  bellList.innerHTML = lista.length ? lista.slice(0, 40).map(function(a){
    return '<button class="bell-item nivel-' + a.nivel + (a.leida ? ' leida' : '') + '" data-aviso="' + esc(a.clave) + '" data-panel="' + esc(a.panel || '') + '"><b>' + esc(a.titulo) + '</b><span>' + esc(a.texto) + '</span></button>';
  }).join('') : '<div class="bell-empty">No hay avisos.</div>';
}
document.getElementById('nav-bell-btn').addEventListener('click', function(e){
  e.stopPropagation();
  actualizarCampana();
  document.getElementById('bell-dropdown').classList.toggle('show');
});
document.addEventListener('click', function(e){
  if(!e.target.closest('#bell-dropdown') && !e.target.closest('#nav-bell-btn')) document.getElementById('bell-dropdown').classList.remove('show');
});
document.getElementById('bell-dropdown').addEventListener('click', function(e){
  if(e.target.closest('#bell-leer-todo')){ avisosDeLaCampana().forEach(function(a){ marcarLeida(a.clave); }); actualizarCampana(); return; }
  var it = e.target.closest('[data-aviso]');
  if(!it) return;
  marcarLeida(it.dataset.aviso);                       // RF-NOT-01: cada aviso abre el registro que lo originó
  document.getElementById('bell-dropdown').classList.remove('show');
  if(it.dataset.panel) showPanel(it.dataset.panel);
  actualizarCampana();
});
document.getElementById('bell-footer').textContent = 'Ver todo lo que requiere atención →';
document.getElementById('bell-footer').addEventListener('click', function(){
  document.getElementById('bell-dropdown').classList.remove('show');
  showPanel('inicio');
  var el = document.getElementById('inicio-atencion');
  if(el) el.scrollIntoView({behavior:'smooth'});
});
/* RF-DSH-07: lista única de lo vencido o bloqueado según el rol. */
function requiereAtencionHtml(){
  var lista = avisosCalculados().filter(function(a){ return a.nivel === 'rojo' || a.nivel === 'naranja'; });
  if(!lista.length) return '<div class="empty-note">Nada vencido ni bloqueado. ¡Al día!</div>';
  return lista.map(function(a){
    return '<button class="atencion-item nivel-' + a.nivel + '" data-goto="' + esc(a.panel) + '"><b>' + esc(a.titulo) + '</b><span>' + esc(a.texto) + '</span></button>';
  }).join('');
}
setInterval(function(){ if(usuarioActual) updateNavBadges(); }, 60000);
