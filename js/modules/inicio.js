/* Sistema I+D — Inicio por rol (sección 3, "Pantalla de inicio por rol"): la secuencia del proceso,
   lo que requiere atención y los accesos de cada rol. */
'use strict';

var ICO = {
  mas:'<path d="M12 5v14"/><path d="M5 12h14"/>',
  rotura:'<path d="M12 2l3 6-5 4 6 2-8 8 2-7-5-2 4-4-3-5z"/>',
  qr:'<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><path d="M14 14h3v3h-3zM20 14v7M14 20h3"/>',
  mezcla:'<path d="M9 2v6L4 20a1 1 0 0 0 1 2h14a1 1 0 0 0 1-2L15 8V2"/><line x1="8" y1="2" x2="16" y2="2"/>',
  carpeta:'<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"/>',
  check:'<path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="10"/>',
  doc:'<path d="M9 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M9 8h6"/><path d="M9 12h6"/>',
  panel:'<path d="M3 3v18h18"/><rect x="7" y="12" width="3" height="6"/><rect x="12" y="8" width="3" height="10"/><rect x="17" y="5" width="3" height="13"/>',
  caja:'<path d="M21 8l-9-5-9 5 9 5 9-5z"/><path d="M3 8v8l9 5 9-5V8"/>',
  usuarios:'<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>',
  reloj:'<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/><path d="M12 7v5l3 3"/>',
  ajustes:'<circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.2 4.2l2.8 2.8M17 17l2.8 2.8M1 12h4M19 12h4"/>'
};
var ACCESOS_POR_ROL = {
  TEC: [
    {texto:'Elaborar hoy', sub:'Réplicas programadas', goto:'elaboracion', icono:ICO.mezcla},
    {texto:'Romper hoy', sub:'Roturas del día', goto:'roturas', subtab:'pendientes', icono:ICO.rotura},
    {texto:'Escanear QR', sub:'Abrir probeta o réplica', accion:'qr', icono:ICO.qr}
  ],
  ANA: [
    {texto:'Mis proyectos', sub:'Con semáforo', goto:'proyectos', icono:ICO.carpeta},
    {texto:'Nuevo diseño', sub:'Paso 2', goto:'disenos', subtab:'calcular', icono:ICO.mas},
    {texto:'Programar réplicas', sub:'Paso 3', goto:'elaboracion', icono:ICO.mezcla},
    {texto:'Revisar resultados', sub:'Paso 5', goto:'revision', icono:ICO.check},
    {texto:'Reporte RR', sub:'Paso 6', goto:'reporte-rr', icono:ICO.doc},
    {texto:'Escanear QR', sub:'Abrir probeta', accion:'qr', icono:ICO.qr}
  ],
  JEF: [
    {texto:'Panel de proyectos', sub:'Avance, plazos y costo', goto:'proyectos', icono:ICO.carpeta},
    {texto:'Diseños por validar', sub:'Firma de Jefatura', goto:'revision', icono:ICO.check},
    {texto:'RR por firmar', sub:'Reportes emitidos', goto:'reporte-rr', icono:ICO.doc},
    {texto:'Panel de control', sub:'KPIs', goto:'reportes', icono:ICO.panel}
  ],
  INV: [
    {texto:'Productos y lotes', sub:'Stock y vencimientos', goto:'inventario', icono:ICO.caja},
    {texto:'Equipos', sub:'Calibraciones del mes', goto:'inventario', isub:'equipos', icono:ICO.reloj},
    {texto:'Envíos', sub:'Por recepcionar', goto:'inventario', isub:'envios', icono:ICO.caja},
    {texto:'Panel de control', sub:'KPIs de inventario', goto:'reportes', icono:ICO.panel}
  ],
  CON: [
    {texto:'Proyectos', sub:'Con su reporte', goto:'proyectos', icono:ICO.carpeta},
    {texto:'Panel de control', sub:'Indicadores', goto:'reportes', icono:ICO.panel},
    {texto:'Archivador', sub:'Diseños completados', goto:'archivador', icono:ICO.doc}
  ],
  ADM: [
    {texto:'Usuarios y roles', sub:'Altas, organigrama', goto:'usuarios', icono:ICO.usuarios},
    {texto:'Historial', sub:'Movimientos', goto:'historial', icono:ICO.reloj},
    {texto:'Respaldos', sub:'Base histórica', goto:'base-historica', icono:ICO.caja},
    {texto:'Catálogos y ajustes', sub:'Listas y umbrales', goto:'ajustes', icono:ICO.ajustes}
  ]
};
function renderAccesosRapidos(){
  var rol = rolDe(usuarioActual);
  var lista = (ACCESOS_POR_ROL[rol] || []).filter(function(a){ return !a.goto || can('ver:' + a.goto); });
  var wrap = document.getElementById('inicio-accesos');
  wrap.classList.toggle('accesos-grandes', rol === 'TEC');
  wrap.innerHTML = lista.map(function(a){
    return '<button class="acceso"' + (a.goto ? ' data-goto="' + a.goto + '"' : '') + (a.subtab ? ' data-sub="' + a.subtab + '"' : '') + (a.isub ? ' data-isub-ir="' + a.isub + '"' : '') + (a.accion ? ' data-accion="' + a.accion + '"' : '') + '>' +
      '<span class="acceso-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + a.icono + '</svg></span>' +
      '<span class="acceso-txt"><b>' + a.texto + '</b><small>' + a.sub + '</small></span></button>';
  }).join('');
}
document.getElementById('inicio-accesos').addEventListener('click', function(e){
  var b = e.target.closest('.acceso');
  if(!b) return;
  if(b.dataset.accion === 'qr') escanearQR('Escanear etiqueta', abrirDesdeQR);
  if(b.dataset.isubIr) setTimeout(function(){ showInventarioSub(b.dataset.isubIr); }, 0);
});
function renderInicioProceso(){
  var rol = rolDe(usuarioActual);
  var flujo = document.getElementById('inicio-flujo');
  var aten = document.getElementById('inicio-atencion');
  if(flujo) flujo.innerHTML = rol === 'INV' ? '' : '<div class="section-num">Secuencia del proceso I+D</div>' + flujoHtml('', false);
  if(aten) aten.innerHTML = '<div class="section-num">Requiere atención</div><div class="atencion-lista">' + requiereAtencionHtml() + '</div>';
  var semana = document.getElementById('inicio-semana');
  if(semana) semana.style.display = rol === 'INV' || rol === 'CON' ? 'none' : '';
}
var hookInicioOriginal = PANEL_HOOKS.inicio;
PANEL_HOOKS.inicio = function(){
  renderUsuarioShell();
  renderAccesosRapidos();
  renderInicioProceso();
  hookInicioOriginal();
  renderInicioSemana();
};
