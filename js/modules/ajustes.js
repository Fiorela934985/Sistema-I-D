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
PANEL_HOOKS.ajustes = function(){ renderAjustes(); };
