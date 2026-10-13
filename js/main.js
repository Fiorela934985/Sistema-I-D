/* Sistema I+D — Arranque de la aplicación */
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
var LOGIN_USER = 'FSANTOS';
var LOGIN_PASS = '12345678';
var loginView = document.getElementById('login-view');
var loadingViewEl = document.getElementById('loading-view');
if(sessionStorage.getItem('sid10_logged_in') === '1'){
  loginView.classList.add('hidden');
  loadingViewEl.classList.remove('not-started');
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
  var user = document.getElementById('login-user').value.trim().toUpperCase();
  var pass = document.getElementById('login-pass').value.trim();
  var errEl = document.getElementById('login-error');
  if(user === LOGIN_USER && pass === LOGIN_PASS){
    errEl.textContent = '';
    sessionStorage.setItem('sid10_logged_in', '1');
    document.getElementById('login-btn').disabled = true;
    loginView.classList.add('leaving');
    loadingViewEl.classList.remove('not-started');
    runLoader();
    setTimeout(function(){ loginView.classList.add('hidden'); }, 520);
  } else {
    errEl.textContent = 'Usuario o contraseña incorrectos.';
    var card = document.querySelector('.login-card');
    card.classList.remove('shake'); void card.offsetWidth; card.classList.add('shake');
  }
});
