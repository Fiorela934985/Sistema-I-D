/* Sistema I+D — Navegación según el prompt maestro (sección 4): Inicio · Proyectos · Formatos · Planificación ·
   Recursos · Calidad · Inteligencia · Administración.
   · El proyecto que se abre en Proyectos queda "abierto": los formatos, el calendario y los indicadores lo toman
     para filtrar o precargar, pero nada exige elegirlo (Formatos es la vista de todo el laboratorio).
   · Las secciones de fases posteriores muestran qué tendrán y en qué fase llegan.
   · Atajos de teclado y ayuda (tecla ?). */
'use strict';

var subTabDisenos = 'calcular';

/* ---- Proyecto abierto (se recuerda en este equipo) ---- */
var proyectoFlujo = load('sid_proyecto_flujo', null);
if(proyectoFlujo && PROYECTO_CATALOGO.indexOf(proyectoFlujo) === -1) proyectoFlujo = null;
var roturasSoloProyecto = true; // en Roturas › Pendientes, ver solo las del proyecto abierto
function fijarProyectoFlujo(nombre){
  if(!nombre || nombre === proyectoFlujo) return;
  proyectoFlujo = nombre;
  roturasSoloProyecto = true;
  dashAlcance = 'proyecto'; // los indicadores pasan a medir el proyecto abierto
  save('sid_proyecto_flujo', proyectoFlujo);
}
function requiereProyecto(){ return false; }

var abrirExpedienteOriginal = abrirExpediente;
abrirExpediente = function(nombre, tab){
  if(nombre) fijarProyectoFlujo(nombre);
  abrirExpedienteOriginal(nombre, tab);
  actualizarFlujo();
};
document.getElementById('pp-proyecto').addEventListener('change', function(){ if(this.value) fijarProyectoFlujo(this.value); });

/* Al entrar a una sección, sus selectores toman el proyecto abierto */
var ultimaVistaFlujo = '';
function aplicarProyectoFlujo(){
  var vista = panelActual + '/' + subTabDisenos;
  if(vista === ultimaVistaFlujo) return;
  ultimaVistaFlujo = vista;
  if(panelActual === 'disenos' && subTabDisenos === 'calcular' && typeof programarPronostico === 'function') programarPronostico();
  if(!proyectoFlujo) return;
  if(panelActual === 'disenos' && subTabDisenos === 'calcular'){
    var pp = document.getElementById('pp-proyecto');
    if(!pp.value){
      fillProyectoCatalogoSelect(pp, proyectoFlujo);
      fillPpIteracionSelect(proyectoFlujo, '');
      refreshNombrePreview();
    }
  } else if(panelActual === 'calendario'){
    document.getElementById('cal-proyecto').value = proyectoFlujo;
    renderCalendario();
  } else if(panelActual === 'roturas'){
    var ro = document.getElementById('ro-proyecto');
    if(!ro.value){ fillProyectoCatalogoSelect(ro, proyectoFlujo); rebuildRoDisenoSelect(); }
    renderRoturasPendientes();
  }
}

/* Marca la entrada activa del menú (Formato de Diseños y de Estado Fresco comparten sección) */
function actualizarFlujo(){
  aplicarProyectoFlujo();
  document.querySelectorAll('.side-nav .nav-item[data-panel]').forEach(function(btn){
    var grupoSub = (subTabDisenos === 'tabla' || subTabDisenos === 'calcular') ? 'tabla' : 'fresco';
    var activo = btn.dataset.panel === panelActual && (!btn.dataset.sub || panelActual !== 'disenos' || btn.dataset.sub === grupoSub);
    btn.classList.toggle('active', activo);
  });
  var info = panelInfo(panelActual);
  var etiqueta = panelActual === 'disenos' ? ((subTabDisenos === 'historico' || subTabDisenos === 'fresco') ? 'Formato de Estado Fresco' : 'Formato de Diseños (D-CC-F-148)') : info.label;
  document.getElementById('tb-panel-title').textContent = etiqueta;
  document.getElementById('tb-crumb').textContent = info.grupo;
  actualizarMenuSecciones();
}

/* ================= SECCIONES DE FASES POSTERIORES ================= */
var SECCIONES_POR_FASE = {
  'documentos': {titulo:'Documentos', fase:7, sub:'Calidad',
    items:['Procedimientos y formatos con código, versión vigente, fecha y archivo en Google Drive (17025, 8.3).',
      'Cada formato del sistema mostrará el código y la versión que vienen de aquí; las versiones anteriores quedan como obsoletas.']},
  'no-conforme': {titulo:'Trabajo no conforme', fase:7, sub:'Calidad',
    items:['Se abre solo cuando una rotura sale de su ventana de tolerancia, un equipo tiene la calibración vencida o la poza sale de rango (17025, 7.10).',
      'Manual con [Reportar]: probeta perdida, mal etiquetada o dañada, o receta cambiada sin registrar.',
      'Flujo: se abre → se evalúa → se decide (aceptar con nota, repetir o anular el resultado) → se cierra.']}
};
function crearSeccionesPorFase(){
  var main = document.getElementById('panel-inicio').parentNode;
  Object.keys(SECCIONES_POR_FASE).forEach(function(id){
    if(document.getElementById('panel-' + id)) return;
    var s = SECCIONES_POR_FASE[id];
    var sec = document.createElement('section');
    sec.id = 'panel-' + id;
    sec.className = 'panel';
    sec.innerHTML = '<div class="content-header"><div><h2>' + esc(s.titulo) + '</h2></div><span class="fase-chip">Llega en la fase ' + s.fase + '</span></div>' +
      '<div class="card fase-card"><ul class="fase-lista">' + s.items.map(function(t){ return '<li>' + esc(t) + '</li>'; }).join('') + '</ul>' +
      (s.accion ? '<div class="form-actions"><button class="btn-add ghost" data-goto="' + s.accion.goto + '"' + (s.accion.sub ? ' data-sub="' + s.accion.sub + '"' : '') + '>' + esc(s.accion.texto) + '</button></div>' : '') +
      '</div>';
    main.appendChild(sec);
  });
}

/* ================= PLANIFICACIÓN (una sola entrada con tres botones) ================= */
function renderPlanificacion(){
  var hoy = todayISO(), lunes = lunesDe(hoy), domingo = addDaysISO(lunes, 6);
  var semana = roturaCargas.filter(function(c){ return c.estado === 'pendiente' && c.fechaEnsayo >= lunes && c.fechaEnsayo <= domingo; });
  var atrasadas = roturaCargas.filter(function(c){ return c.estado === 'pendiente' && c.fechaEnsayo < hoy; });
  document.getElementById('plan-resumen').innerHTML =
    kpiCard('kpi-naranja', ICO_RESIST, semana.length, 'Roturas programadas esta semana (' + isoToDMY(lunes).slice(0,5) + '–' + isoToDMY(domingo).slice(0,5) + ')') +
    kpiCard('kpi-rojo', ICO_ALERTA, atrasadas.length, 'Roturas atrasadas') +
    kpiCard('kpi-negro', ICO_DISENO, 0, 'Planes de trabajo activos') +
    kpiCard('kpi-verde', ICO_ACTIVO, 0, 'Actividades de la semana sin publicar');
}
PANEL_HOOKS.planificacion = renderPlanificacion;

/* ================= EVENTOS ================= */
document.addEventListener('click', function(e){
  var ind = e.target.closest('[data-ver-indicadores]');
  if(ind){
    e.preventDefault();
    if(typeof expedienteProyecto !== 'undefined' && expedienteProyecto) fijarProyectoFlujo(expedienteProyecto);
    dashAlcance = 'proyecto';
    showPanel('reportes');
    return;
  }
  if(e.target.closest('[data-solo-proyecto]')){ roturasSoloProyecto = !roturasSoloProyecto; renderRoturasPendientes(); return; }
  if(e.target.closest('[data-atajos]')) abrirAtajos();
});

/* ================= ATAJOS DE TECLADO ================= */
var ATAJOS = {
  Digit0: function(){ showPanel('inicio'); },
  Digit1: function(){ showPanel('proyectos'); },
  Digit2: function(){ showPanel('disenos'); showSubTab(can('disenos:crear') ? 'calcular' : 'historico'); },
  Digit3: function(){ showPanel('disenos'); showSubTab('fresco'); },
  Digit4: function(){ showPanel('roturas'); showRoturasSub('pendientes'); },
  Digit5: function(){ showPanel('planificacion'); },
  KeyN: function(){ if(exigir('disenos:crear')){ showPanel('disenos'); showSubTab('calcular'); } }
};
function abrirAtajos(){ document.getElementById('atajos-modal').classList.add('show'); }
function cerrarAtajos(){ document.getElementById('atajos-modal').classList.remove('show'); }
document.getElementById('atajos-cerrar').addEventListener('click', cerrarAtajos);
document.getElementById('atajos-modal').addEventListener('click', function(e){ if(e.target.id === 'atajos-modal') cerrarAtajos(); });
function escribiendo(el){
  return el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
}
document.addEventListener('keydown', function(e){
  if(!usuarioActual) return;
  // Alt sin Ctrl: en teclados en español AltGr llega como Ctrl+Alt y no debe disparar atajos
  if(e.altKey && !e.ctrlKey && !e.metaKey && ATAJOS[e.code]){
    e.preventDefault();
    cerrarAtajos();
    ATAJOS[e.code]();
    return;
  }
  if(e.key === 'Escape' && document.getElementById('atajos-modal').classList.contains('show')){ cerrarAtajos(); return; }
  if(e.key === '?' && !escribiendo(e.target)){ e.preventDefault(); abrirAtajos(); }
});

crearSeccionesPorFase();
armarMenuPorSecciones();
