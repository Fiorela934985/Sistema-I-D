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
  Nube.actualizarIndicador();
  aplicarPermisos();
  renderUsuarioShell();
  showPanel('inicio');
  renderRRDetail();
}
/* Con servidor, la sesión solo se restaura si el token sigue vigente; se valida en segundo plano */
if((!Nube.activa() || Nube.tieneToken()) && restaurarSesion()){
  loginView.classList.add('hidden');
  loadingViewEl.classList.remove('not-started');
  entrarAlSistema();
  runLoader();
  if(Nube.activa()) sincronizarLaboratorio().then(function(ok){ if(ok){ aplicarPermisos(); renderUsuarioShell(); } });
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
  if(Nube.activa()){
    // Con servidor: el usuario y la contraseña se validan allá (PBKDF2); acá queda solo la sesión
    document.getElementById('login-btn').disabled = true;
    errEl.textContent = '';
    Nube.login(user, pass).then(function(su){
      var local = {id:su.id, usuario:su.usuario, nombre:su.nombre, iniciales:su.iniciales || '', correo:su.correo || '', rol:su.rol, activo:true, servidor:true};
      var i = usuarios.findIndex(function(x){ return x.id === su.id; });
      if(i === -1) usuarios.push(local); else usuarios[i] = Object.assign({}, usuarios[i], local);
      usuarioActual = usuarioPorId(su.id);
      sessionStorage.setItem('sid_sesion', su.id);
      return sincronizarLaboratorio();
    }).then(function(){
      registrarHistorial('Ingresó', 'Sesión', usuarioActual.usuario + ' (' + rolLabel(usuarioActual.rol) + ')', {servidor:true});
      document.getElementById('login-pass').value = '';
      entrarAlSistema();
      loginView.classList.add('leaving');
      loadingViewEl.classList.remove('not-started');
      runLoader();
      setTimeout(function(){ loginView.classList.add('hidden'); }, 520);
    }).catch(function(e2){
      document.getElementById('login-btn').disabled = false;
      errEl.textContent = (e2 && e2.mensaje) || 'No se pudo ingresar';
      var card2 = document.querySelector('.login-card');
      card2.classList.remove('shake'); void card2.offsetWidth; card2.classList.add('shake');
    });
    return;
  }
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
  registrarHistorial('Salió', 'Sesión', usuarioActual ? usuarioActual.usuario : '', {servidor:Nube.activa()});
  Nube.logout().then(function(){ cerrarSesion(); location.reload(); });
});
