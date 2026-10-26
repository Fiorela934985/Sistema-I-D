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
// runLoader() se dispara desde el login (main.js), no automáticamente al cargar la página.

/* ================= NAV ================= */
var navItems = document.querySelectorAll('.side-nav .nav-item[data-panel]');
var panelActual = 'inicio';
// Al entrar a cada panel se refresca su contenido (los módulos se registran acá).
var PANEL_HOOKS = {
  reportes: function(){ animateReportes(); },
  inicio: function(){ renderInicioKpis(); renderInicioRecientes(); renderInicioFavoritos(); renderPendientesHoyInicio(); },
  roturas: function(){ renderRoturasAll(); },
  archivador: function(){ renderArchivador(); }
};
function panelInfo(name){ return PANELES.filter(function(p){ return p.id === name; })[0] || {label:name, grupo:''}; }
function showPanel(name){
  if(usuarioActual && !can('ver:' + name)){
    toast('Tu rol no tiene acceso a ' + panelInfo(name).label);
    name = 'inicio';
  }
  panelActual = name;
  navItems.forEach(function(btn){ btn.classList.toggle('active', btn.dataset.panel === name); });
  document.querySelectorAll('.panel').forEach(function(sec){ sec.classList.toggle('active', sec.id === 'panel-' + name); });
  var info = panelInfo(name);
  document.getElementById('tb-panel-title').textContent = info.label;
  document.getElementById('tb-crumb').textContent = info.grupo;
  if(PANEL_HOOKS[name]) PANEL_HOOKS[name]();
  cerrarMenuMovil();
  window.scrollTo({top:0, behavior:'auto'});
}
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
document.getElementById('tb-asistente').addEventListener('click', function(){ showPanel('asistente'); });

/* Menú lateral en pantallas chicas */
function cerrarMenuMovil(){ document.body.classList.remove('sidebar-open'); }
document.getElementById('tb-menu').addEventListener('click', function(){ document.body.classList.toggle('sidebar-open'); });
document.getElementById('sidebar-backdrop').addEventListener('click', cerrarMenuMovil);

/* Menú lateral contraído: quedan solo los íconos fijos. La preferencia se recuerda en este equipo. */
function aplicarMenuContraido(contraido){
  document.body.classList.toggle('sidebar-mini', contraido);
  var btn = document.getElementById('sb-toggle');
  btn.title = contraido ? 'Mostrar menú' : 'Ocultar menú';
  btn.setAttribute('aria-label', btn.title);
}
document.querySelectorAll('.side-nav .nav-item').forEach(function(b){
  var lbl = b.querySelector('.label');
  if(lbl) b.dataset.tip = lbl.textContent;
});
document.getElementById('btn-logout').dataset.tip = 'Cerrar sesión';
aplicarMenuContraido(load('sid_menu_contraido', false));
document.getElementById('sb-toggle').addEventListener('click', function(){
  var contraido = !document.body.classList.contains('sidebar-mini');
  aplicarMenuContraido(contraido);
  save('sid_menu_contraido', contraido);
  // Los gráficos se reacomodan al nuevo ancho
  setTimeout(function(){ window.dispatchEvent(new Event('resize')); }, 260);
});

/* Navegación genérica: cualquier elemento con data-goto="panel" lleva a ese panel */
document.addEventListener('click', function(e){
  var el = e.target.closest('[data-goto]');
  if(!el) return;
  e.preventDefault();
  var proy = el.dataset.flujoProy || '';
  if(el.dataset.goto === 'elaboracion') elaboracionFiltroProyecto = proy;
  if(el.dataset.goto === 'proyectos' && proy){ abrirExpediente(proy); return; }
  if(el.dataset.goto === 'disenos' && proy){ var hf = document.getElementById('hist-proyecto-filtro'); if(hf) hf.value = proy; }
  showPanel(el.dataset.goto);
  if(el.dataset.goto === 'disenos') showSubTab(el.dataset.sub || 'historico');
  if(el.dataset.goto === 'roturas' && el.dataset.sub) showRoturasSub(el.dataset.sub);
});

/* Usuario en la barra lateral y la cabecera */
function renderUsuarioShell(){
  if(!usuarioActual) return;
  document.getElementById('sb-avatar').textContent = inicialesUsuario(usuarioActual);
  document.getElementById('sb-user-nombre').textContent = usuarioActual.nombre || usuarioActual.usuario;
  document.getElementById('sb-user-rol').textContent = rolLabel(usuarioActual.rol);
  document.getElementById('tb-avatar').textContent = inicialesUsuario(usuarioActual);
  document.getElementById('tb-avatar').className = 'sb-avatar chico rol-' + usuarioActual.rol;
  document.getElementById('tb-user-nombre').textContent = usuarioActual.nombre || usuarioActual.usuario;
  var chip = document.getElementById('tb-rol-chip');
  chip.textContent = rolLabel(usuarioActual.rol);
  chip.className = 'tb-rol-chip rol-' + usuarioActual.rol;
  var saludo = document.getElementById('inicio-bienvenido');
  if(saludo) saludo.textContent = '¡Hola, ' + (usuarioActual.nombre || usuarioActual.usuario).split(' ')[0] + '!';
}

/* Globo con el nombre de la sección cuando el menú está contraído */
var sbTip = document.createElement('div');
sbTip.className = 'sb-tip';
document.body.appendChild(sbTip);
document.getElementById('sidebar').addEventListener('mouseover', function(e){
  var el = e.target.closest('[data-tip]');
  if(!el || !document.body.classList.contains('sidebar-mini') || window.innerWidth <= 980){ sbTip.classList.remove('show'); return; }
  var r = el.getBoundingClientRect();
  sbTip.textContent = el.dataset.tip;
  sbTip.style.left = (r.right + 12) + 'px';
  sbTip.style.top = (r.top + r.height / 2) + 'px';
  sbTip.classList.add('show');
});
document.getElementById('sidebar').addEventListener('mouseleave', function(){ sbTip.classList.remove('show'); });
