/* Sistema I+D — Menú lateral ordenado según la sección 4 del prompt maestro.
   Secuencia: Inicio · Proyectos · Formatos · Planificación · Recursos · Calidad · Inteligencia · Administración.
   · Las entradas únicas (Inicio, Proyectos, Planificación) van solas.
   · Cada sección con varias entradas es un encabezado que se despliega y muestra sus subsecciones;
     solo queda abierta la sección donde está el usuario (más la que abra a mano).
   · Con el menú contraído se ven solo los íconos, separados por sección. */
'use strict';

var ICONOS_SECCION = {
  'Formatos':'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16v16H4z"/><path d="M4 9h16M4 14h16M9 4v16"/></svg>',
  'Recursos':'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="7" r="4"/><path d="M2 21v-2a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v2"/><path d="M19 8v6M22 11h-6"/></svg>',
  'Calidad':'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6z"/><path d="M9 12l2 2 4-4"/></svg>',
  'Inteligencia':'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z"/></svg>',
  'Administración':'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 9h10M7 13h6"/></svg>'
};
var menuAbiertas = load('sid_menu_abiertas', {});

function armarMenuPorSecciones(){
  document.querySelectorAll('#side-nav .sn-group').forEach(function(g){
    var lbl = g.querySelector(':scope > .sn-label');
    if(!lbl || g.classList.contains('sn-seccion')) return;
    var nombre = lbl.textContent.trim();
    g.classList.add('sn-seccion');
    g.dataset.seccion = nombre;
    var items = document.createElement('div');
    items.className = 'sn-items';
    Array.prototype.slice.call(g.querySelectorAll(':scope > .nav-item')).forEach(function(b){ b.classList.add('nav-sub'); items.appendChild(b); });
    var cab = document.createElement('button');
    cab.type = 'button';
    cab.className = 'sn-head';
    cab.setAttribute('aria-expanded', 'false');
    cab.title = nombre;
    cab.innerHTML = (ICONOS_SECCION[nombre] || '') + '<span class="sn-label">' + esc(nombre) + '</span><span class="sn-badge" style="display:none;"></span><span class="sn-chev" aria-hidden="true"></span>';
    lbl.remove();
    g.appendChild(cab);
    g.appendChild(items);
    cab.addEventListener('click', function(){ alternarSeccion(g); });
  });
  actualizarMenuSecciones();
}
function abrirSeccion(g, abierta){
  g.classList.toggle('abierta', abierta);
  g.querySelector('.sn-head').setAttribute('aria-expanded', abierta ? 'true' : 'false');
}
function alternarSeccion(g){
  var abierta = !g.classList.contains('abierta');
  abrirSeccion(g, abierta);
  menuAbiertas[g.dataset.seccion] = abierta;
  save('sid_menu_abiertas', menuAbiertas);
}
/* La sección de la pantalla actual se abre sola; las demás quedan como el usuario las dejó */
function actualizarMenuSecciones(){
  document.querySelectorAll('#side-nav .sn-seccion').forEach(function(g){
    var activa = !!g.querySelector('.nav-item.active');
    g.classList.toggle('con-activa', activa);
    abrirSeccion(g, activa || !!menuAbiertas[g.dataset.seccion]);
    // El aviso de la sección (p. ej. roturas atrasadas) se ve aunque esté cerrada
    var badges = Array.prototype.slice.call(g.querySelectorAll('.nav-badge')).filter(function(b){ return b.style.display !== 'none' && Number(b.textContent) > 0; });
    var sb = g.querySelector('.sn-badge');
    var total = badges.reduce(function(a, b){ return a + Number(b.textContent); }, 0);
    sb.style.display = total ? '' : 'none';
    sb.textContent = total;
  });
}
