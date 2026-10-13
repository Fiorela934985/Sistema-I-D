/* Sistema I+D — Arranque de la aplicación: inicialización, inicio y cierre de sesión */
'use strict';

/* ================= INIT ================= */
buildPlantaSelect();
buildTipoConcretoSelect();
rebuildAllMaterialSelects();
buildLimitesTable();
renderComponentesPanel();
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

/* ================= LOGIN ================= */
var loginView = document.getElementById('login-view');
var loadingViewEl = document.getElementById('loading-view');

function entrarAlSistema(){
  aplicarPermisos();
  renderUsuarioShell();
  showPanel('inicio');
  renderRRDetail();
}
if(restaurarSesion()){
  loginView.classList.add('hidden');
  loadingViewEl.classList.remove('not-started');
  entrarAlSistema();
  runLoader();
} else {
  document.getElementById('login-user').focus();
}
document.getElementById('login-eye').addEventListener('click', function(){
  var inp = document.getElementById('login-pass');
  inp.type = inp.type === 'password' ? 'text' : 'password';
});
document.getElementById('login-form').addEventListener('submit', function(e){
  e.preventDefault();
  var user = document.getElementById('login-user').value.trim();
  var pass = document.getElementById('login-pass').value;
  var errEl = document.getElementById('login-error');
  var u = iniciarSesion(user, pass);
  if(u){
    errEl.textContent = '';
    registrarHistorial('Ingresó', 'Sesión', u.usuario + ' (' + rolLabel(u.rol) + ')');
    document.getElementById('login-btn').disabled = true;
    document.getElementById('login-pass').value = '';
    entrarAlSistema();
    loginView.classList.add('leaving');
    loadingViewEl.classList.remove('not-started');
    runLoader();
    setTimeout(function(){ loginView.classList.add('hidden'); }, 520);
  } else {
    var existe = usuarioPorNombre(user);
    errEl.textContent = existe && !existe.activo ? 'Usuario desactivado. Consultá con el administrador.' : 'Usuario o contraseña incorrectos.';
    var card = document.querySelector('.login-card');
    card.classList.remove('shake'); void card.offsetWidth; card.classList.add('shake');
  }
});
document.getElementById('btn-logout').addEventListener('click', function(){
  if(!confirm('¿Cerrar sesión?')) return;
  registrarHistorial('Salió', 'Sesión', usuarioActual ? usuarioActual.usuario : '');
  cerrarSesion();
  location.reload();
});
