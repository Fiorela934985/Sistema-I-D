/* Sistema I+D — Historial de cambios (ISO/IEC 17025: 7.5, 7.11, 8.4): quién, cuándo, valor anterior,
   valor nuevo y motivo. Es de solo lectura: nada de lo registrado se edita ni se borra.
   Con servidor conectado, lo que el servidor ya registra (usuarios, personal, configuración) no se duplica:
   el resto de los eventos se envía también al servidor. */
'use strict';

var HISTORIAL_MAX = 5000;
var historial = load('sid_historial', []);
function saveHistorial(){ save('sid_historial', historial); }

/* accion: Creó / Editó / Anuló / Registró / Ingresó…  entidad (módulo): Diseño, Rotura, Personal…
   detalle: texto libre.
   extra: proyecto, ref, codigo, antes, despues, motivo;
          servidor:true → el servidor ya lo registró (no se reenvía); local:true → no se envía al servidor. */
function registrarHistorial(accion, entidad, detalle, extra){
  extra = extra || {};
  var h = {
    id: 'h' + Date.now() + Math.floor(Math.random()*1000),
    ts: Date.now(),
    usuarioId: usuarioActual ? usuarioActual.id : '',
    usuario: usuarioActual ? usuarioActual.usuario : 'sistema',
    rol: usuarioActual ? usuarioActual.rol : '',
    accion: accion,
    entidad: entidad,
    detalle: detalle || '',
    proyecto: extra.proyecto || '',
    ref: extra.ref || '',
    codigo: extra.codigo || '',
    antes: extra.antes === undefined ? null : extra.antes,
    despues: extra.despues === undefined ? null : extra.despues,
    motivo: extra.motivo || ''
  };
  historial.unshift(h);
  if(historial.length > HISTORIAL_MAX) historial.length = HISTORIAL_MAX;
  saveHistorial();
  if(!extra.servidor && !extra.local && typeof Nube !== 'undefined' && Nube.activa() && Nube.tieneToken() && accion !== 'Ingresó' && accion !== 'Salió'){
    Nube.enviar('POST', '/api/historial', {accion:accion, modulo:entidad, detalle:h.detalle, codigo:h.codigo, entidad_id:h.ref,
      antes:h.antes, despues:h.despues, motivo:h.motivo, proyecto:h.proyecto}).catch(function(){});
  }
  return h;
}
/* Diferencia entre dos objetos: solo los campos que cambiaron, para guardar antes/después */
function diferencias(antes, despues, campos){
  var a = {}, d = {};
  (campos || Object.keys(despues || {})).forEach(function(k){
    var va = antes ? antes[k] : undefined, vd = despues ? despues[k] : undefined;
    if(JSON.stringify(va === undefined ? null : va) !== JSON.stringify(vd === undefined ? null : vd)){ a[k] = va === undefined ? null : va; d[k] = vd === undefined ? null : vd; }
  });
  return Object.keys(d).length ? {antes:a, despues:d} : null;
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

/* ================= MOTIVO DEL CAMBIO =================
   Toda edición de un registro existente pide el motivo (regla 2). Una sola ventana reutilizable. */
function pedirMotivo(titulo, resumen, alConfirmar){
  var m = document.getElementById('motivo-modal');
  if(!m){
    m = document.createElement('div');
    m.id = 'motivo-modal';
    m.className = 'sid-modal';
    m.innerHTML = '<div class="modal-card"><div class="modal-header"><h3 id="motivo-titulo"></h3><button class="modal-close" data-close="motivo-modal">×</button></div>' +
      '<div class="modal-body"><div id="motivo-resumen" class="motivo-resumen"></div>' +
      '<div class="pp-field"><label for="motivo-texto">Motivo del cambio</label><textarea id="motivo-texto" rows="3" maxlength="500" placeholder="Ej. Corrección de un dato mal digitado"></textarea></div></div>' +
      '<div class="modal-actions"><button class="btn-add" id="motivo-ok">Confirmar</button><button class="btn-add ghost" data-close="motivo-modal">Cancelar</button></div></div>';
    document.body.appendChild(m);
    document.getElementById('motivo-texto').addEventListener('keydown', function(e){ if(e.key === 'Enter' && (e.ctrlKey || e.metaKey)) document.getElementById('motivo-ok').click(); });
  }
  document.getElementById('motivo-titulo').textContent = titulo;
  document.getElementById('motivo-resumen').innerHTML = resumen || '';
  var txt = document.getElementById('motivo-texto');
  txt.value = '';
  var ok = document.getElementById('motivo-ok');
  var nuevo = ok.cloneNode(true);
  ok.parentNode.replaceChild(nuevo, ok);
  nuevo.addEventListener('click', function(){
    var motivo = txt.value.trim();
    if(motivo.length < 3){ toast('Escribí el motivo del cambio'); txt.focus(); return; }
    cerrarModal('motivo-modal');
    alConfirmar(motivo);
  });
  abrirModal('motivo-modal');
  setTimeout(function(){ txt.focus(); }, 50);
}
/* Resumen legible de un cambio para mostrarlo antes de pedir el motivo */
function resumenCambioHtml(dif, etiquetas){
  if(!dif) return '';
  etiquetas = etiquetas || {};
  return '<table class="data-table motivo-tabla"><thead><tr><th>Campo</th><th>Antes</th><th>Después</th></tr></thead><tbody>' +
    Object.keys(dif.despues).map(function(k){
      return '<tr><td>'+esc(etiquetas[k] || k)+'</td><td>'+esc(valorLegible(dif.antes[k]))+'</td><td><b>'+esc(valorLegible(dif.despues[k]))+'</b></td></tr>';
    }).join('') + '</tbody></table>';
}
function valorLegible(v){
  if(v === null || v === undefined || v === '') return '—';
  if(v === true) return 'Sí';
  if(v === false) return 'No';
  if(typeof v === 'object') return JSON.stringify(v);
  return String(v);
}
