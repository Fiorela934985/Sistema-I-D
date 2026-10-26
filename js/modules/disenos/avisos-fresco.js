/* Sistema I+D — Avisos de los tiempos de slump (0', 30', 60'…).
   En Resultados se eligen los tiempos a medir y con "Ahora" se marca la hora de contacto: el sistema avisa
   (sonido, notificación y contador flotante) cuando toca cada medición, aunque la ventana esté cerrada. */
'use strict';

var avisosFresco = load('sid_avisos_fresco', []);
function saveAvisosFresco(){ save('sid_avisos_fresco', avisosFresco); }

function horaAhoraHM(){ var d = new Date(); return String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0'); }
function hmATimestamp(hm){
  var m = String(hm || '').trim().match(/^(\d{1,2})[:.h](\d{2})/);
  if(!m) return NaN;
  var d = new Date();
  d.setHours(Number(m[1]), Number(m[2]), 0, 0);
  return d.getTime();
}
function campoModal(r, sel){ return document.querySelector('#results-modal-body [data-r="'+r+'"]' + sel); }
function nombreReplicaModal(r){ var h = document.querySelector('#results-modal-body .replica-block[data-replica="'+r+'"] .replica-head'); return h ? h.textContent.trim() : ''; }

/* Guarda lo cargado en la ventana sin cambiar el estado del diseño (para no perder la hora marcada). */
function persistirResultadosModal(){
  var d = currentResultsDesign;
  if(!d || !can('resultados:registrar')) return;
  var nRep = (d.replicaObjs && d.replicaObjs.length) || d.replicas || 1;
  d.resultados = {replicas: collectResultsFromModal(nRep)};
  save('sid10_disenos', disenos);
  resultsModalDirty = true;
}

/* Rehace los avisos de una réplica según la hora base y los tiempos elegidos. */
function sincronizarAvisosReplica(r){
  var d = currentResultsDesign;
  if(!d) return [];
  var base = hmATimestamp((campoModal(r, '[data-rf="contacto"]') || {}).value);
  if(!isFinite(base)) base = hmATimestamp((campoModal(r, '[data-row="0"][data-col="hora"]') || {}).value);
  avisosFresco = avisosFresco.filter(function(a){ return !(a.codigo === d.codigo && a.replica === r); });
  var nuevos = [];
  if(isFinite(base)){
    document.querySelectorAll('#results-modal-body [data-tiempo-r="'+r+'"].on').forEach(function(chip){
      var fila = Number(chip.dataset.tiempo), min = SLUMP_MINUTOS[fila];
      if(!min) return;
      if((campoModal(r, '[data-row="'+fila+'"][data-col="hora"]') || {}).value) return; // ya medido
      var ts = base + min * 60000;
      if(ts < Date.now() - 30 * 60000) return;
      var a = {id: d.codigo + '-' + r + '-' + fila, codigo: d.codigo, replica: r, fila: fila, etiqueta: SLUMP_ROWS[fila],
        nombre: nombreReplicaModal(r) || d.codigo, ts: ts, preaviso: ts - Date.now() <= 60000, avisado: false};
      avisosFresco.push(a);
      nuevos.push(a);
    });
  }
  avisosFresco.sort(function(a, b){ return a.ts - b.ts; });
  saveAvisosFresco();
  revisarAvisosFresco();
  return nuevos;
}
function pedirPermisoNotificaciones(){
  if('Notification' in window && Notification.permission === 'default'){ try{ Notification.requestPermission(); }catch(e){} }
}

/* ---- Interacción en la ventana de resultados ---- */
document.getElementById('results-modal-body').addEventListener('click', function(e){
  var chip = e.target.closest('.chip-tiempo');
  if(chip){
    var r = Number(chip.dataset.tiempoR);
    var activos = document.querySelectorAll('#results-modal-body [data-tiempo-r="'+r+'"].on');
    if(chip.classList.contains('on') && activos.length === 1){ toast('Dejá al menos un tiempo'); return; }
    chip.classList.toggle('on');
    var tr = document.querySelector('#results-modal-body .replica-block[data-replica="'+r+'"] tr[data-fila-tiempo="'+chip.dataset.tiempo+'"]');
    if(tr) tr.classList.toggle('fila-oculta', !chip.classList.contains('on'));
    persistirResultadosModal();
    sincronizarAvisosReplica(r);
    return;
  }
  var bc = e.target.closest('[data-ahora-contacto]');
  if(bc){
    var rc = Number(bc.dataset.ahoraContacto), hora = horaAhoraHM();
    campoModal(rc, '[data-rf="contacto"]').value = hora;
    var h0 = campoModal(rc, '[data-row="0"][data-col="hora"]');
    if(h0 && !h0.value) h0.value = hora;
    pedirPermisoNotificaciones();
    persistirResultadosModal();
    var nuevos = sincronizarAvisosReplica(rc);
    toast(nuevos.length ? 'Te aviso a los ' + nuevos.map(function(a){ return a.etiqueta; }).join(', ') : 'Hora marcada');
    return;
  }
  var bf = e.target.closest('[data-ahora-fila]');
  if(bf){
    var rf = Number(bf.dataset.r), fila = Number(bf.dataset.ahoraFila), h = horaAhoraHM();
    campoModal(rf, '[data-row="'+fila+'"][data-col="hora"]').value = h;
    var cont = campoModal(rf, '[data-rf="contacto"]');
    if(fila === 0 && cont && !cont.value) cont.value = h;
    pedirPermisoNotificaciones();
    persistirResultadosModal();
    sincronizarAvisosReplica(rf);
    var sl = campoModal(rf, '[data-row="'+fila+'"][data-col="slump"]');
    if(sl) sl.focus();
  }
});
document.getElementById('results-modal-body').addEventListener('change', function(e){
  var el = e.target;
  if(el.dataset.rf === 'contacto' || (el.dataset.rf === 'slump' && el.dataset.col === 'hora')){
    persistirResultadosModal();
    sincronizarAvisosReplica(Number(el.dataset.r));
  }
});

/* ---- Aviso: sonido, vibración, notificación del sistema y mensaje ---- */
function sonarAviso(){
  try{
    var Ctx = window.AudioContext || window.webkitAudioContext;
    if(!Ctx) return;
    var ctx = new Ctx();
    [0, 0.35, 0.7].forEach(function(t){
      var o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = 880; o.connect(g); g.connect(ctx.destination);
      g.gain.setValueAtTime(0.25, ctx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.3);
      o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + 0.3);
    });
    setTimeout(function(){ ctx.close(); }, 1500);
  }catch(e){}
}
function notificarAviso(a){
  var titulo = 'Toca medir ' + a.etiqueta, cuerpo = a.nombre + ' · slump y temperaturas';
  sonarAviso();
  if(navigator.vibrate) navigator.vibrate([300, 150, 300]);
  toast(titulo + ' · ' + a.nombre);
  if(!('Notification' in window) || Notification.permission !== 'granted') return;
  var opciones = {body: cuerpo, tag: a.id, requireInteraction: true, icon: 'assets/favicon.svg'};
  var directa = function(){ try{ new Notification(titulo, opciones); }catch(e){} };
  if(navigator.serviceWorker && navigator.serviceWorker.getRegistration){
    navigator.serviceWorker.getRegistration().then(function(reg){ if(reg) reg.showNotification(titulo, opciones); else directa(); }, directa);
  } else directa();
}

/* ---- Revisión cada segundo: avisos, contadores en la tabla y lista flotante ---- */
function textoCuenta(ms){
  if(ms <= 0) return '¡Ahora!';
  var s = Math.round(ms / 1000), m = Math.floor(s / 60);
  return m >= 60 ? Math.floor(m / 60) + ' h ' + (m % 60) + ' min' : m + ':' + String(s % 60).padStart(2,'0');
}
function avisoYaMedido(a){
  var d = disenoPorCodigo(a.codigo);
  if(!d) return true;
  var rep = d.resultados && d.resultados.replicas && d.resultados.replicas[a.replica];
  var fila = rep && rep.slump && rep.slump[a.fila];
  return !!(fila && fila.hora);
}
function revisarAvisosFresco(){
  var ahora = Date.now(), cambio = false;
  avisosFresco = avisosFresco.filter(function(a){
    var vigente = a.ts > ahora - 30 * 60000 && !avisoYaMedido(a);
    if(!vigente) cambio = true;
    return vigente;
  });
  avisosFresco.forEach(function(a){
    if(!a.preaviso && a.ts - ahora <= 60000){ a.preaviso = true; cambio = true; if(a.ts > ahora) toast('En 1 minuto toca ' + a.etiqueta + ' · ' + a.nombre); }
    if(!a.avisado && a.ts <= ahora){ a.avisado = true; cambio = true; notificarAviso(a); }
  });
  if(cambio) saveAvisosFresco();
  // Contadores dentro de la ventana de resultados abierta
  var abierto = document.getElementById('results-modal').classList.contains('show') && currentResultsDesign;
  if(abierto){
    document.querySelectorAll('#results-modal-body [data-cuenta]').forEach(function(td){
      var p = td.dataset.cuenta.split('-');
      var a = avisosFresco.filter(function(x){ return x.codigo === currentResultsDesign.codigo && x.replica === Number(p[0]) && x.fila === Number(p[1]); })[0];
      td.textContent = a ? textoCuenta(a.ts - ahora) : '';
      td.classList.toggle('toca', !!a && a.ts <= ahora);
    });
  }
  renderAvisosFlotantes(ahora);
}
function renderAvisosFlotantes(ahora){
  var box = document.getElementById('avisos-fresco');
  if(!avisosFresco.length || !usuarioActual){ if(box) box.remove(); return; }
  if(!box){
    box = document.createElement('div');
    box.id = 'avisos-fresco';
    document.body.appendChild(box);
  }
  box.innerHTML = avisosFresco.slice(0, 4).map(function(a){
    var toca = a.ts <= ahora;
    return '<div class="aviso-fresco'+(toca ? ' toca' : '')+'" data-aviso-abrir="'+esc(a.id)+'">' +
      '<span class="af-min">'+esc(a.etiqueta)+'</span><span class="af-nom">'+esc(a.nombre)+'</span>' +
      '<b class="af-cuenta">'+textoCuenta(a.ts - ahora)+'</b>' +
      '<button class="af-cerrar" data-aviso-quitar="'+esc(a.id)+'" title="Quitar aviso">×</button></div>';
  }).join('');
}
document.addEventListener('click', function(e){
  var q = e.target.closest('[data-aviso-quitar]');
  if(q){
    avisosFresco = avisosFresco.filter(function(a){ return a.id !== q.dataset.avisoQuitar; });
    saveAvisosFresco();
    revisarAvisosFresco();
    return;
  }
  var ab = e.target.closest('[data-aviso-abrir]');
  if(ab){
    var a = avisosFresco.filter(function(x){ return x.id === ab.dataset.avisoAbrir; })[0];
    var d = a && disenoPorCodigo(a.codigo);
    if(!d) return;
    openResultsModal(d, disenos.indexOf(d));
    setTimeout(function(){
      var inp = campoModal(a.replica, '[data-row="'+a.fila+'"][data-col="hora"]');
      if(inp) inp.scrollIntoView({block:'center', behavior:'smooth'});
    }, 100);
  }
});
setInterval(revisarAvisosFresco, 1000);
