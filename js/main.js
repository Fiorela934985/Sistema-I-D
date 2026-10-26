/* Sistema I+D — Arranque de la aplicación: inicialización, inicio y cierre de sesión */
'use strict';

/* ================= INIT ================= */
buildPlantaSelect();
buildTipoConcretoSelect();
rebuildAllMaterialSelects();
buildLimitesTable();
renderComponentesPanel();
asegurarProyectosDeDisenos();
refreshAllProyectoSelects();
document.querySelectorAll('.acc-head').forEach(function(head){
  head.addEventListener('click', function(){ head.closest('.params-col').classList.toggle('collapsed'); });
});
sincronizarEvidenciasRoturas();
renderAllDesignViews();
syncLaboratorio();
document.getElementById('dis-fecha-mezcla').value = todayISO();
document.getElementById('ro-fecha-elab').value = todayISO();
renderMezclaDisplay();
refreshNombrePreview();
renderRRStudyList();
renderRRDetail();
renderRoturasAll();
actualizarRelojInicio();
applySettingsToUI();
showSubTab('calcular');

/* ================= LOGIN (RF-USR-01/02/03) ================= */
var loginView = document.getElementById('login-view');
var loadingViewEl = document.getElementById('loading-view');
var reingresoPendiente = false;   // la sesión expiró con la app abierta: se vuelve a ingresar sin perder lo escrito

function entrarAlSistema(){
  aplicarPermisos();
  renderUsuarioShell();
  if(!reingresoPendiente) showPanel('inicio');
  renderRRDetail();
  updateNavBadges();
  reingresoPendiente = false;
  abrirQRPendiente();
  if(usuarioActual.debeCambiarClave) pedirCambioDeClave();
}
/* RF-USR-04: una clave temporal obliga a cambiarla al primer ingreso. */
function pedirCambioDeClave(){
  abrirDialogo({titulo:'Cambiá tu contraseña', cancelar:'Más tarde', html:
    '<p class="nota-sm">Ingresaste con una contraseña temporal. Elegí una nueva: mínimo 8 caracteres, con letras y números.</p>' +
    '<div class="pred-form"><div class="pp-field"><label>Nueva contraseña</label><input type="password" id="cc-nueva" autocomplete="new-password"></div>' +
    '<div class="pp-field"><label>Repetirla</label><input type="password" id="cc-rep" autocomplete="new-password"></div></div><p class="campo-error" id="cc-err"></p>',
    botones:[{label:'Guardar contraseña', accion:function(c){
      var nueva = c.querySelector('#cc-nueva').value, rep = c.querySelector('#cc-rep').value;
      var err = validarClaveNueva(nueva, '') || (nueva !== rep ? 'Las contraseñas no coinciden.' : '');
      if(!err && usuarioActual.hash === hashPassword(nueva, usuarioActual.sal)) err = 'Debe ser distinta de la temporal.';
      if(err){ c.querySelector('#cc-err').textContent = err; return false; }
      usuarioActual.sal = nuevaSal(); usuarioActual.hash = hashPassword(nueva, usuarioActual.sal); usuarioActual.debeCambiarClave = false;
      saveUsuarios();
      registrarHistorial('Editó', 'Usuario', usuarioActual.usuario + ' · cambió su contraseña temporal');
      toast('Contraseña actualizada');
    }}]});
}
if(restaurarSesion()){
  loginView.classList.add('hidden');
  loadingViewEl.classList.remove('not-started');
  entrarAlSistema();
  runLoader();
} else {
  document.getElementById('login-user').focus();
}
document.getElementById('login-user').placeholder = 'Usuario o correo';
document.getElementById('login-eye').addEventListener('click', function(){
  var inp = document.getElementById('login-pass');
  inp.type = inp.type === 'password' ? 'text' : 'password';
});
document.getElementById('login-form').addEventListener('submit', function(e){
  e.preventDefault();
  var user = document.getElementById('login-user').value.trim();
  var pass = document.getElementById('login-pass').value;
  var errEl = document.getElementById('login-error');
  var anterior = usuarioActual;
  var r = iniciarSesion(user, pass);
  if(r.u){
    if(reingresoPendiente && anterior && anterior.id !== r.u.id){ location.reload(); return; }
    errEl.textContent = '';
    registrarHistorial('Ingresó', 'Sesión', r.u.usuario + ' (' + rolLabel(r.u.rol) + ')');
    document.getElementById('login-pass').value = '';
    var eraReingreso = reingresoPendiente;
    entrarAlSistema();
    loginView.classList.add('leaving');
    setTimeout(function(){ loginView.classList.add('hidden'); loginView.classList.remove('leaving', 'reingreso'); }, 520);
    if(!eraReingreso){
      document.getElementById('login-btn').disabled = true;
      loadingViewEl.classList.remove('not-started');
      runLoader();
    }
  } else {
    errEl.textContent = r.error;
    var card = document.querySelector('.login-card');
    card.classList.remove('shake'); void card.offsetWidth; card.classList.add('shake');
  }
});
document.getElementById('btn-logout').addEventListener('click', function(){
  if(!confirm('¿Cerrar sesión?')) return;
  registrarHistorial('Salió', 'Sesión', usuarioActual ? usuarioActual.usuario : '');
  cerrarSesion();
  location.hash = '';
  location.reload();
});

/* RF-USR-02: expira tras 8 h o 60 min sin actividad. Al expirar se pide ingresar de nuevo encima de la
   pantalla actual, así un formulario a medio llenar no se pierde. */
['click', 'keydown', 'touchstart'].forEach(function(ev){ document.addEventListener(ev, function(){ if(usuarioActual && !reingresoPendiente) marcarActividad(); }, {passive:true}); });
setInterval(function(){
  if(!usuarioActual || reingresoPendiente) return;
  if(sesionVencida(datosSesion())){
    reingresoPendiente = true;
    sessionStorage.removeItem('sid_sesion');
    loginView.classList.remove('hidden', 'leaving');
    loginView.classList.add('reingreso');
    document.getElementById('login-btn').disabled = false;
    document.getElementById('login-error').textContent = 'Tu sesión expiró. Ingresá de nuevo para continuar donde estabas.';
    document.getElementById('login-user').value = usuarioActual.usuario;
    document.getElementById('login-pass').focus();
  }
}, 30000);

/* RF-ETQ-06: el QR de la etiqueta abre su rotura; si no hay sesión, primero se ingresa. */
function abrirQRPendiente(){
  if(location.hash.indexOf('#qr=') !== 0 || !usuarioActual) return;
  var datos = leerQR(location.href);
  history.replaceState(null, '', location.pathname + location.search);
  setTimeout(function(){ abrirDesdeQR(datos); }, 600);
}
window.addEventListener('hashchange', abrirQRPendiente);
