/* Sistema I+D — Ajustes del usuario: apariencia, notificaciones, cuenta y datos del sistema */
'use strict';

/* ================= AJUSTES ================= */
var elDarkMode = document.getElementById('set-darkmode');
var elNotif = document.getElementById('set-notif');
var settings = load('sid10_settings', {notif:true});
var APP_VERSION = '2.0.0';
function applySettingsToUI(){
  elDarkMode.checked = currentTheme === 'dark';
  elNotif.checked = settings.notif !== false;
}
elDarkMode.addEventListener('change', function(){
  currentTheme = elDarkMode.checked ? 'dark' : 'light';
  applyTheme(currentTheme);
  save('sid10_theme', currentTheme);
  toast(currentTheme === 'dark' ? 'Modo oscuro activado' : 'Modo claro activado');
});
elNotif.addEventListener('change', function(){
  settings.notif = elNotif.checked;
  save('sid10_settings', settings);
  updateNavBadges();
  toast(settings.notif ? 'Notificaciones activadas' : 'Notificaciones desactivadas');
});

function renderAjustes(){
  applySettingsToUI();
  var u = usuarioActual;
  document.getElementById('cuenta-resumen').innerHTML = u ?
    '<div class="cuenta-fila"><span class="sb-avatar rol-'+u.rol+'">'+esc(inicialesUsuario(u))+'</span><div><b>'+esc(u.nombre||u.usuario)+'</b><span>'+esc(u.usuario)+' · '+esc(rolLabel(u.rol))+'</span></div></div>' +
    '<p class="nota-sm">'+esc((ROLES_DEF[u.rol]||{}).desc||'')+'</p>' : '';
  var usado = 0;
  for(var i=0;i<localStorage.length;i++){ var k = localStorage.key(i); if(/^sid/.test(k)) usado += (localStorage.getItem(k)||'').length; }
  document.getElementById('acerca-lista').innerHTML =
    '<div class="acerca-fila"><span>Versión</span><b>'+APP_VERSION+'</b></div>' +
    '<div class="acerca-fila"><span>Datos guardados en este navegador</span><b>'+(usado/1024).toFixed(0)+' KB</b></div>' +
    '<div class="acerca-fila"><span>Diseños / roturas</span><b>'+disenos.length+' / '+roturaCargas.length+'</b></div>' +
    '<div class="acerca-fila"><span>Usuarios</span><b>'+usuarios.length+'</b></div>';
}
document.getElementById('cta-guardar').addEventListener('click', function(){
  var u = usuarioActual;
  if(!u) return;
  var actual = document.getElementById('cta-actual').value;
  var nueva = document.getElementById('cta-nueva').value;
  var rep = document.getElementById('cta-repetir').value;
  if(nueva.length < 8){ toast('La nueva contraseña debe tener al menos 8 caracteres'); return; }
  if(nueva !== rep){ toast('Las contraseñas nuevas no coinciden'); return; }
  var limpiar = function(){ ['cta-actual','cta-nueva','cta-repetir'].forEach(function(id){ document.getElementById(id).value = ''; }); };
  if(Nube.activa()){
    Nube.pedir('PUT', '/api/yo/clave', {actual:actual, nueva:nueva}).then(function(){
      limpiar(); registrarHistorial('Editó', 'Usuarios', u.usuario + ' · cambió su contraseña', {codigo:u.usuario, servidor:true}); toast('Contraseña actualizada');
    }, function(e){ toast(e.mensaje); });
    return;
  }
  if(u.hash !== hashPassword(actual, u.sal)){ toast('La contraseña actual no es correcta'); return; }
  u.sal = nuevaSal();
  u.hash = hashPassword(nueva, u.sal);
  saveUsuarios();
  limpiar();
  registrarHistorial('Editó', 'Usuarios', u.usuario + ' · cambió su contraseña', {codigo:u.usuario});
  toast('Contraseña actualizada');
});
/* ---- Asistente con IA ---- */
function renderAjustesIA(){
  document.getElementById('ia-clave').value = '';
  document.getElementById('ia-clave').placeholder = agenteCfg.apiKey ? 'Clave guardada (…' + agenteCfg.apiKey.slice(-4) + ')' : 'sk-ant-…';
  document.getElementById('ia-activo').checked = agenteCfg.activo !== false;
  document.getElementById('ia-estado').textContent = agenteCfg.apiKey ? ('Modelo: ' + AGENTE_MODELO + '. Estado: ' + (agenteCfg.activo !== false ? 'activo.' : 'apagado (se usa el motor local).')) : 'Sin clave: el asistente usa el motor local.';
}
document.getElementById('ia-guardar').addEventListener('click', function(){
  var k = document.getElementById('ia-clave').value.trim();
  if(k && !/^sk-ant-/.test(k)){ toast('La clave debe empezar con sk-ant-'); return; }
  if(k) agenteCfg.apiKey = k;
  agenteCfg.activo = document.getElementById('ia-activo').checked;
  saveAgenteCfg();
  nuevaConversacionAgente();
  registrarHistorial('Editó', 'Ajustes', 'Asistente con IA ' + (agenteCfg.activo ? 'activado' : 'desactivado') + (k ? ' · clave actualizada' : ''));
  renderAjustesIA();
  toast('Configuración del asistente guardada');
});
document.getElementById('ia-quitar').addEventListener('click', function(){
  if(!agenteCfg.apiKey) return;
  if(!confirm('¿Quitar la clave de API de este navegador?')) return;
  agenteCfg.apiKey = '';
  saveAgenteCfg();
  nuevaConversacionAgente();
  registrarHistorial('Editó', 'Ajustes', 'Clave del asistente con IA eliminada');
  renderAjustesIA();
  toast('Clave eliminada');
});
document.getElementById('ia-probar').addEventListener('click', function(){
  var estado = document.getElementById('ia-estado');
  if(!agenteCfg.apiKey){ toast('Primero guardá una clave'); return; }
  estado.textContent = 'Probando la conexión…';
  cargarSdkAnthropic().then(function(Anthropic){
    return clienteAnthropic(Anthropic).models.retrieve(AGENTE_MODELO).then(function(m){
      estado.textContent = 'Conexión correcta: ' + (m.display_name || m.id) + ' disponible.';
    }, function(err){ estado.textContent = traducirErrorAgente(err, Anthropic).message; });
  }).catch(function(){ estado.textContent = 'No se pudo cargar la librería de Anthropic (¿sin internet?).'; });
});
/* ---- Servidor (Cloudflare Workers + D1) ---- */
function renderAjustesNube(){
  Nube.actualizarIndicador();
  document.getElementById('nube-url').value = Nube.url();
  document.getElementById('nube-desconectar').style.display = Nube.activa() ? '' : 'none';
  document.getElementById('nube-instalar').style.display = 'none';
  document.getElementById('nube-msg').textContent = '';
}
function conectarNube(url){
  Nube.configurar(url);
  document.getElementById('nube-msg').textContent = 'Conectado. Volvé a ingresar con tu usuario del servidor.';
  registrarHistorial('Editó', 'Ajustes', 'Conectó el servidor ' + url, {local:true});
  setTimeout(function(){ cerrarSesion(); location.reload(); }, 1800);
}
document.getElementById('nube-conectar').addEventListener('click', function(){
  if(!exigir('config:laboratorio')) return;
  var url = document.getElementById('nube-url').value.trim().replace(/\/+$/, '');
  var msg = document.getElementById('nube-msg');
  if(!/^https:\/\/[^\s]+$/.test(url)){ msg.textContent = 'Ingresá la URL https del Worker.'; return; }
  msg.textContent = 'Probando conexión…';
  Nube.estado(url).then(function(r){
    if(r.instalado){ msg.textContent = 'Servidor v' + r.version + ' listo.'; conectarNube(url); return; }
    msg.textContent = 'Servidor v' + r.version + ' sin usuarios todavía.';
    document.getElementById('nube-inst-correo').value = usuarioActual.correo || '';
    document.getElementById('nube-instalar').style.display = '';
  }, function(e){ msg.textContent = 'No se pudo conectar: ' + e.mensaje + '. Revisá la URL y que ORIGENES_PERMITIDOS incluya ' + location.origin + '.'; });
});
document.getElementById('nube-inst-ok').addEventListener('click', function(){
  var url = document.getElementById('nube-url').value.trim().replace(/\/+$/, '');
  var clave = document.getElementById('nube-inst-clave').value;
  if(clave.length < 8){ toast('La contraseña debe tener al menos 8 caracteres'); return; }
  var u = usuarioActual;
  Nube.pedir('POST', '/api/instalar', {id:u.id, usuario:u.usuario, nombre:u.nombre || u.usuario, iniciales:u.iniciales || '', correo:document.getElementById('nube-inst-correo').value.trim(), clave:clave}, {url:url, sinToken:true})
    .then(function(){ conectarNube(url); }, function(e){ document.getElementById('nube-msg').textContent = e.mensaje; });
});
document.getElementById('nube-desconectar').addEventListener('click', function(){
  if(!confirm('¿Volver a modo local? Los datos del servidor no se borran; este navegador deja de usarlos.')) return;
  Nube.logout().then(function(){ Nube.configurar(''); cerrarSesion(); location.reload(); });
});
PANEL_HOOKS.ajustes = function(){ renderAjustes(); if(can('ver:usuarios')) renderAjustesIA(); if(can('config:laboratorio')) renderAjustesNube(); };
