/* Sistema I+D — Estructura de la app: tema, pantalla de carga y navegación entre paneles */
'use strict';

/* ================= THEME ================= */
function applyTheme(t){ document.documentElement.setAttribute('data-theme', t); }
var currentTheme = load('sid10_theme', 'light');
applyTheme(currentTheme);

/* ================= LOADER ================= */
var loaderStarted = false;
var loadingView = document.getElementById('loading-view');
var appShell = document.getElementById('app-shell');
var gaugeFill = document.getElementById('gauge-fill');
var loaderBar = document.getElementById('loader-bar');
var CIRC = 377;
var STEPS = [15,32,50,66,80,92,100];
function runLoader(){
  if(loaderStarted) return;
  loaderStarted = true;
  var i = 0;
  var timer = setInterval(function(){
    var pct = STEPS[i];
    if(gaugeFill) gaugeFill.style.strokeDashoffset = CIRC - (CIRC*pct/100);
    loaderBar.style.width = pct + '%';
    i++;
    if(i >= STEPS.length){ clearInterval(timer); finishLoading(); }
  }, 190);
}
function finishLoading(){
  setTimeout(function(){
    loadingView.classList.add('leaving');
    appShell.classList.add('ready');
    setTimeout(function(){ loadingView.classList.add('hidden'); }, 520);
  }, 220);
}
// runLoader() se dispara desde el login (más abajo), no automáticamente al cargar la página.

/* ================= NAV ================= */
var navItems = document.querySelectorAll('.topbar-nav .nav-item[data-panel]');
function showPanel(name){
  navItems.forEach(function(btn){ btn.classList.toggle('active', btn.dataset.panel === name); });
  document.querySelectorAll('.panel').forEach(function(sec){ sec.classList.toggle('active', sec.id === 'panel-' + name); });
  document.getElementById('back-home-bar').style.display = name === 'inicio' ? 'none' : 'block';
  if(name === 'reportes') animateReportes();
  if(name === 'inicio'){ renderInicioKpis(); renderInicioRecientes(); renderInicioFavoritos(); renderPendientesHoyInicio(); }
  if(name === 'roturas'){ renderRoturasAll(); }
  if(name === 'archivador'){ renderArchivador(); }
  window.scrollTo({top:0, behavior:'auto'});
}
document.getElementById('btn-back-home').addEventListener('click', function(){ showPanel('inicio'); });
navItems.forEach(function(btn){
  btn.addEventListener('click', function(){
    if(btn.dataset.panel === 'componentes'){ activeCompCat = null; }
    showPanel(btn.dataset.panel);
    if(btn.dataset.panel === 'componentes'){ renderComponentesPanel(); }
    if(btn.dataset.panel === 'disenos'){ showSubTab('historico'); }
  });
});
document.getElementById('btn-calcular').addEventListener('click', function(){ showPanel('disenos'); showSubTab('calcular'); });
document.getElementById('btn-ver-roturas-inicio').addEventListener('click', function(){ showPanel('roturas'); showRoturasSub('pendientes'); });
