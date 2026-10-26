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
    '<div class="acerca-fila"><span>Usuarios</span><b>'+usuarios.length+'</b></div>' +
    '<p class="nota-sm">Los datos viven en este navegador. Para no perderlos, descargá un respaldo desde <a href="#" data-goto="base-historica">Base histórica</a>.</p>';
}
document.getElementById('cta-guardar').addEventListener('click', function(){
  var u = usuarioActual;
  if(!u) return;
  var actual = document.getElementById('cta-actual').value;
  var nueva = document.getElementById('cta-nueva').value;
  var rep = document.getElementById('cta-repetir').value;
  if(u.hash !== hashPassword(actual, u.sal)){ toast('La contraseña actual no es correcta'); return; }
  if(nueva.length < 6){ toast('La nueva contraseña debe tener al menos 6 caracteres'); return; }
  if(nueva !== rep){ toast('Las contraseñas nuevas no coinciden'); return; }
  u.sal = nuevaSal();
  u.hash = hashPassword(nueva, u.sal);
  saveUsuarios();
  ['cta-actual','cta-nueva','cta-repetir'].forEach(function(id){ document.getElementById(id).value = ''; });
  registrarHistorial('Editó', 'Usuario', u.usuario + ' · cambió su contraseña');
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
PANEL_HOOKS.ajustes = function(){ renderAjustes(); if(can('ver:usuarios')) renderAjustesIA(); };
