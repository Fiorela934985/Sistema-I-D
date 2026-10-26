/* Sistema I+D — Inicio: acciones y accesos rápidos según el rol, KPIs del día y semana de roturas. */
'use strict';

var ACCESOS_RAPIDOS = [
  {texto:'Nuevo diseño', sub:'Calcular dosificación', perm:'disenos:crear', goto:'disenos', subtab:'calcular', icono:'<path d="M12 5v14"/><path d="M5 12h14"/>'},
  {texto:'Registrar rotura', sub:'Elaboración o carga', perm:'roturas:registrar', goto:'roturas', subtab:'pendientes', icono:'<path d="M12 2l3 6-5 4 6 2-8 8 2-7-5-2 4-4-3-5z"/>'},
  {texto:'Calendario', sub:'Roturas programadas', perm:'ver:calendario', goto:'calendario', icono:'<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="16" y1="2" x2="16" y2="6"/>'},
  {texto:'Expedientes', sub:'Proyectos y radar', perm:'ver:proyectos', goto:'proyectos', icono:'<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"/>'},
  {texto:'Reporte RR', sub:'Visor y gráficos', perm:'ver:reporte-rr', goto:'reporte-rr', icono:'<path d="M9 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M9 8h6"/><path d="M9 12h6"/>'},
  {texto:'Dashboard', sub:'KPIs en vivo', perm:'ver:reportes', goto:'reportes', icono:'<path d="M3 3v18h18"/><rect x="7" y="12" width="3" height="6"/><rect x="12" y="8" width="3" height="10"/><rect x="17" y="5" width="3" height="13"/>'},
  {texto:'Predicción', sub:'Anticipar resultados', perm:'ver:prediccion', goto:'prediccion', icono:'<path d="M3 17l6-6 4 4 8-8"/><path d="M14 7h7v7"/>'},
  {texto:'Asistente I+D', sub:'Preguntá en lenguaje natural', perm:'ver:asistente', goto:'asistente', icono:'<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>'}
];
function renderAccesosRapidos(){
  var lista = ACCESOS_RAPIDOS.filter(function(a){ return can(a.perm); }).slice(0, 6);
  document.getElementById('inicio-accesos').innerHTML = lista.map(function(a){
    return '<button class="acceso" data-goto="'+a.goto+'"'+(a.subtab?' data-sub="'+a.subtab+'"':'')+'>' +
      '<span class="acceso-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'+a.icono+'</svg></span>' +
      '<span class="acceso-txt"><b>'+a.texto+'</b><small>'+a.sub+'</small></span></button>';
  }).join('');
}
var hookInicioOriginal = PANEL_HOOKS.inicio;
PANEL_HOOKS.inicio = function(){
  renderUsuarioShell();
  renderAccesosRapidos();
  hookInicioOriginal();
  renderInicioSemana();
};
