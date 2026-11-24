/* Sistema I+D — Pantalla completa: al presionar un botón (Ver todo, etc.) se abre una pantalla nueva con "Volver". */
'use strict';

var pantallaAlCerrar = null;
function abrirPantalla(titulo, html, alCerrar){
  var p = document.getElementById('pantalla');
  if(!p){
    p = document.createElement('div');
    p.id = 'pantalla';
    p.className = 'pantalla';
    document.body.appendChild(p);
    p.addEventListener('click', function(e){ if(e.target.closest('[data-pantalla-volver]')) cerrarPantalla(); });
  }
  var main = document.querySelector('.content').getBoundingClientRect();
  var top = document.querySelector('.topbar').getBoundingClientRect().bottom;
  p.style.left = main.left + 'px'; p.style.top = top + 'px'; p.style.right = '0'; p.style.bottom = '0';
  p.innerHTML = '<div class="pantalla-cab"><button class="btn-volver" data-pantalla-volver>← Volver</button><h2>' + esc(titulo) + '</h2></div><div class="pantalla-cuerpo">' + html + '</div>';
  p.style.display = 'block';
  pantallaAlCerrar = alCerrar || null;
}
function cerrarPantalla(){
  var p = document.getElementById('pantalla');
  if(p) p.style.display = 'none';
  if(pantallaAlCerrar){ var f = pantallaAlCerrar; pantallaAlCerrar = null; f(); }
}
function pantallaAbierta(){ var p = document.getElementById('pantalla'); return !!p && p.style.display === 'block'; }
document.addEventListener('keydown', function(e){ if(e.key === 'Escape' && pantallaAbierta() && !document.querySelector('.sid-modal.show')) cerrarPantalla(); });
window.addEventListener('resize', function(){ if(pantallaAbierta()){ var p = document.getElementById('pantalla'); p.style.left = document.querySelector('.content').getBoundingClientRect().left + 'px'; } });
