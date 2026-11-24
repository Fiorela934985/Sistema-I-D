/* Sistema I+D — Pares de fechas inicio/fin en todo el sistema: la fecha de fin no puede ser anterior a la de inicio.
   El calendario del campo de fin no deja elegir días anteriores, y si se escribe una fecha anterior se corrige. */
'use strict';

var PARES_FECHA = [['asis-inicio', 'asis-fin'], ['act-desde', 'act-hasta'], ['pl-mes-ini', 'pl-mes-fin'], ['his-desde', 'his-hasta']];

/* Devuelve [inicio, fin] del par al que pertenece el campo, o null */
function parDeFecha(el){
  if(!el || !el.matches || !el.matches('input[type=date], input[type=month]')) return null;
  for(var i = 0; i < PARES_FECHA.length; i++){
    if(el.id === PARES_FECHA[i][0] || el.id === PARES_FECHA[i][1]) return [document.getElementById(PARES_FECHA[i][0]), document.getElementById(PARES_FECHA[i][1])];
  }
  var ff = el.dataset.ff;
  if(ff === 'desde' || ff === 'hasta'){
    var bar = el.closest('.fmt-filtros');
    return bar ? [bar.querySelector('[data-ff="desde"]'), bar.querySelector('[data-ff="hasta"]')] : null;
  }
  var pf = el.dataset.pf;
  if(pf === 'inicio' || pf === 'fin'){
    var tr = el.closest('tr');
    return tr ? [tr.querySelector('[data-pf="inicio"]'), tr.querySelector('[data-pf="fin"]')] : null;
  }
  return null;
}
function ajustarParFecha(par, cambiado){
  var ini = par[0], fin = par[1];
  if(!ini || !fin) return;
  fin.min = ini.value || '';
  if(ini.value && fin.value && fin.value < ini.value){
    if(cambiado === fin) toast('La fecha de fin no puede ser anterior a la de inicio');
    fin.value = ini.value;
  }
}
/* En captura: corrige antes de que lo lea el módulo */
document.addEventListener('change', function(e){ var par = parDeFecha(e.target); if(par) ajustarParFecha(par, e.target); }, true);
document.addEventListener('focusin', function(e){ var par = parDeFecha(e.target); if(par && e.target === par[1] && par[0]) par[1].min = par[0].value || ''; });
