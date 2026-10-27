/* Sistema I+D — Flujo del ensayo: el trabajo del laboratorio en orden, siempre a partir de un proyecto
   (Proyecto → Materiales → Diseño → Roturas → Resultados → Reporte RR → Archivo).
   El proyecto elegido en el paso 1 queda "en curso": acompaña a los pasos siguientes (calculadora, histórico,
   roturas, calendario y archivo se abren filtrados por él) y sin proyecto no se puede avanzar más allá de Materiales.
   Dibuja la barra de pasos y los botones Anterior/Siguiente, marca el paso en el menú y define los atajos. */
'use strict';

var FLUJO = [
  {n:1, panel:'proyectos', titulo:'Proyecto', sub:'Crear o elegir el proyecto',
   ayuda:'Todo parte de un proyecto. Creá uno con <b>+ Nuevo proyecto</b> o abrí el que vas a trabajar: queda como proyecto en curso para los pasos siguientes.'},
  {n:2, panel:'componentes', titulo:'Materiales', sub:'Cemento, agregados, aditivos',
   ayuda:'Revisá que los materiales que vas a usar en el diseño estén cargados con sus propiedades (densidad, absorción, humedad, costo).'},
  {n:3, panel:'disenos', subtab:'calcular', titulo:'Diseño', sub:'Calcular dosificación', proyecto:true,
   ayuda:'Elegí la iteración del proyecto, completá la hoja D-CC-F-148 y registrá. Al registrar se eligen réplicas y días, y las roturas quedan programadas solas.'},
  {n:4, panel:'roturas', titulo:'Roturas', sub:'Elaboración y cargas', alias:['calendario'], proyecto:true,
   ayuda:'En <b>Pendientes</b> registrá la carga de cada probeta el día que toca. El <b>Calendario</b> muestra la semana; las vencidas aparecen primero.'},
  {n:5, panel:'disenos', subtab:'historico', titulo:'Resultados', sub:'Estado fresco y resistencia', proyecto:true,
   ayuda:'Abrí el diseño y entrá a <b>Resultados</b>: slump, temperaturas y observaciones por réplica. La resistencia llega sola desde Roturas.'},
  {n:6, panel:'reporte-rr', titulo:'Reporte RR', sub:'Comparar diseños y edades', proyecto:true,
   ayuda:'Generá el Reporte RR para comparar los diseños de la iteración por edad y exportarlo.'},
  {n:7, panel:'archivador', titulo:'Archivo', sub:'Diseños completados', proyecto:true,
   ayuda:'Los diseños completados del proyecto quedan guardados con su informe, listos para consultar o imprimir.'}
];
var PANELES_FLUJO = ['proyectos', 'componentes', 'disenos', 'roturas', 'calendario', 'reporte-rr', 'archivador'];
var PANELES_CON_PROYECTO = ['disenos', 'roturas', 'calendario', 'reporte-rr', 'archivador'];
var subTabDisenos = 'calcular';

/* ---- Proyecto en curso (se recuerda en este equipo) ---- */
var proyectoFlujo = load('sid_proyecto_flujo', null);
if(proyectoFlujo && PROYECTO_CATALOGO.indexOf(proyectoFlujo) === -1) proyectoFlujo = null;
var roturasSoloProyecto = true; // en Pendientes, ver solo las del proyecto en curso
function fijarProyectoFlujo(nombre){
  if(!nombre || nombre === proyectoFlujo) return;
  proyectoFlujo = nombre;
  roturasSoloProyecto = true;
  save('sid_proyecto_flujo', proyectoFlujo);
  toast('Proyecto en curso: ' + nombre);
}
/* Sin proyecto no se entra a los pasos que trabajan sobre él */
function requiereProyecto(panel){ return PANELES_CON_PROYECTO.indexOf(panel) !== -1 && !proyectoFlujo; }

var abrirExpedienteOriginal = abrirExpediente;
abrirExpediente = function(nombre, tab){
  if(nombre) fijarProyectoFlujo(nombre);
  abrirExpedienteOriginal(nombre, tab);
  actualizarFlujo();
};
document.getElementById('pp-proyecto').addEventListener('change', function(){ if(this.value) fijarProyectoFlujo(this.value); actualizarFlujo(); });

function pasoFlujo(n){ return FLUJO[n - 1]; }
function pasoPermitido(p){ return !usuarioActual || can('ver:' + p.panel); }
function pasoActual(){
  for(var i = 0; i < FLUJO.length; i++){
    var p = FLUJO[i];
    var enPanel = p.panel === panelActual || (p.alias || []).indexOf(panelActual) !== -1;
    if(enPanel && (!p.subtab || p.subtab === subTabDisenos)) return p;
  }
  return null;
}

function irAPaso(n){
  var p = pasoFlujo(n);
  if(!p) return;
  if(!pasoPermitido(p)){ toast('Tu rol no tiene acceso a ' + p.titulo); return; }
  cerrarAtajos();
  showPanel(p.panel);
  if(panelActual !== p.panel) return; // se redirigió al paso 1 por falta de proyecto
  if(p.panel === 'disenos') showSubTab(p.subtab === 'calcular' && !can('disenos:crear') ? 'historico' : p.subtab);
  if(p.panel === 'roturas') showRoturasSub('pendientes');
  if(p.panel === 'componentes'){ activeCompCat = null; renderComponentesPanel(); }
}

/* Al entrar a un paso, sus selectores toman el proyecto en curso */
var ultimaVistaFlujo = '';
function aplicarProyectoFlujo(){
  var vista = panelActual + '/' + subTabDisenos;
  if(!proyectoFlujo || vista === ultimaVistaFlujo) return;
  ultimaVistaFlujo = vista;
  if(panelActual === 'disenos' && subTabDisenos === 'calcular'){
    var pp = document.getElementById('pp-proyecto');
    if(pp.value !== proyectoFlujo){
      fillProyectoCatalogoSelect(pp, proyectoFlujo);
      fillPpIteracionSelect(proyectoFlujo, '');
      refreshNombrePreview();
    }
  } else if(panelActual === 'disenos'){
    document.getElementById('hist-proyecto-filtro').value = proyectoFlujo;
    renderDisenosHistorico();
  } else if(panelActual === 'calendario'){
    document.getElementById('cal-proyecto').value = proyectoFlujo;
    renderCalendario();
  } else if(panelActual === 'roturas'){
    var ro = document.getElementById('ro-proyecto');
    if(ro.value !== proyectoFlujo){ fillProyectoCatalogoSelect(ro, proyectoFlujo); rebuildRoDisenoSelect(); }
    renderRoturasPendientes();
  } else if(panelActual === 'archivador' && window._archivadorData && window._archivadorData[proyectoFlujo]){
    archivadorProyectoAbierto = proyectoFlujo;
    document.getElementById('archivador-carpetas').style.display = 'none';
    renderArchivadorDetalle();
  }
}

/* Barra de pasos: el paso actual resaltado, los anteriores como hechos */
function chipProyectoHtml(){
  return proyectoFlujo
    ? '<span class="flujo-proy">Proyecto en curso: <b>' + esc(proyectoFlujo) + '</b> <button class="flujo-proy-btn" data-cambiar-proyecto>Cambiar</button></span>'
    : '<span class="flujo-proy sin">Sin proyecto elegido <button class="flujo-proy-btn" data-paso="1">Elegir proyecto</button></span>';
}
function pasosHtml(actual, detalle){
  return '<ol class="flujo-pasos">' + FLUJO.map(function(p){
    var cls = actual && p.n === actual.n ? 'actual' : (actual && p.n < actual.n ? 'hecho' : '');
    var bloqueado = !pasoPermitido(p);
    var falta = p.proyecto && !proyectoFlujo;
    return '<li><button class="flujo-step ' + cls + (falta ? ' falta' : '') + '" data-paso="' + p.n + '"' + (bloqueado ? ' disabled' : '') +
      ' title="' + p.titulo + (falta ? ' · primero elegí el proyecto' : '') + ' · Alt+' + p.n + '"><span class="fs-num">' + p.n + '</span>' +
      '<span class="fs-txt"><b>' + p.titulo + '</b><small>' + (detalle ? detalle[p.n] : p.sub) + '</small></span></button></li>';
  }).join('') + '</ol>';
}
function flujoBarraHtml(actual){
  return '<div class="flujo-cab"><span class="flujo-tit">Flujo del ensayo</span>' +
    '<span class="flujo-paso">Paso ' + actual.n + ' de ' + FLUJO.length + '</span>' + chipProyectoHtml() +
    '<button class="flujo-ayuda-btn" data-atajos title="Atajos de teclado (?)">Atajos <kbd>?</kbd></button></div>' +
    pasosHtml(actual) +
    '<p class="flujo-ayuda"><b>Qué hacer acá:</b> ' + actual.ayuda + '</p>';
}

/* Pie con el paso anterior y el siguiente */
function flujoPieHtml(actual){
  var ant = pasoFlujo(actual.n - 1), sig = pasoFlujo(actual.n + 1);
  var htmlSig;
  if(!sig) htmlSig = '<button class="btn-add ghost" data-goto="inicio">Volver al Inicio</button>';
  else if(sig.proyecto && !proyectoFlujo) htmlSig = '<span class="flujo-falta">Para seguir, elegí o creá el proyecto (paso 1).</span>';
  else htmlSig = '<button class="btn-add" data-paso="' + sig.n + '">Siguiente · Paso ' + sig.n + ': ' + sig.titulo + ' →</button>';
  return (ant ? '<button class="btn-add ghost" data-paso="' + ant.n + '">← Paso ' + ant.n + ': ' + ant.titulo + '</button>' : '<span></span>') + htmlSig;
}

function prepararContenedoresFlujo(){
  PANELES_FLUJO.forEach(function(id){
    var sec = document.getElementById('panel-' + id);
    if(!sec || sec.querySelector('.flujo')) return;
    var barra = document.createElement('nav');
    barra.className = 'flujo';
    barra.setAttribute('aria-label', 'Flujo del ensayo');
    // En Proyectos el encabezado se oculta al abrir el expediente: la barra va arriba de todo
    var cab = id === 'proyectos' ? null : sec.querySelector('.content-header');
    if(cab) cab.insertAdjacentElement('afterend', barra); else sec.insertBefore(barra, sec.firstChild);
    var pie = document.createElement('div');
    pie.className = 'flujo-pie';
    sec.appendChild(pie);
  });
}

/* Se llama al cambiar de sección o de pestaña en Diseños */
function actualizarFlujo(){
  var actual = pasoActual();
  var sec = document.getElementById('panel-' + panelActual);
  if(actual && sec){
    aplicarProyectoFlujo();
    var barra = sec.querySelector('.flujo'), pie = sec.querySelector('.flujo-pie');
    if(barra) barra.innerHTML = flujoBarraHtml(actual);
    if(pie) pie.innerHTML = flujoPieHtml(actual);
    document.getElementById('tb-crumb').textContent = 'Paso ' + actual.n + ' · ' + actual.titulo;
  } else {
    ultimaVistaFlujo = '';
  }
  // En el menú, Diseño y Resultados comparten sección: se marca según la pestaña
  document.querySelectorAll('.side-nav .nav-item[data-panel]').forEach(function(btn){
    var activo = btn.dataset.panel === panelActual && (!btn.dataset.sub || panelActual !== 'disenos' || btn.dataset.sub === subTabDisenos);
    btn.classList.toggle('active', activo);
    btn.classList.toggle('falta', requiereProyecto(btn.dataset.panel));
  });
}

/* Inicio: los siete pasos con lo pendiente en cada uno (del proyecto en curso si hay uno) */
function renderInicioFlujo(){
  var el = document.getElementById('inicio-flujo');
  if(!el) return;
  var hoy = todayISO();
  var dis = disenos.filter(function(d){ return !proyectoFlujo || proyectoNombre(d.proyectoId) === proyectoFlujo; });
  var cargas = roturaCargas.filter(function(c){ return !proyectoFlujo || c.proyecto === proyectoFlujo; });
  var porRomper = cargas.filter(function(c){ return c.estado === 'pendiente' && c.fechaEnsayo <= hoy; }).length;
  var enCurso = dis.filter(function(d){ return d.estado !== 'Completado'; }).length;
  var rr = rrEstudios.filter(function(e){ return !proyectoFlujo || proyectoNombre(e.proyectoId) === proyectoFlujo; });
  var detalle = {
    1: proyectoFlujo ? '<em class="ok">' + esc(proyectoFlujo) + '</em>' : '<em>Elegí uno para empezar</em>',
    2: componentes.length + ' materiales',
    3: dis.length + ' diseños',
    4: porRomper ? '<em>' + porRomper + ' por romper</em>' : 'Al día',
    5: enCurso + ' en curso',
    6: rr.length + ' reportes',
    7: (dis.length - enCurso) + ' completados'
  };
  el.innerHTML = '<div class="flujo-cab"><span class="flujo-tit">Flujo del ensayo</span><span class="flujo-paso">Trabajá en este orden · Alt+1 a Alt+7</span>' +
    chipProyectoHtml() + '<button class="flujo-ayuda-btn" data-atajos title="Atajos de teclado (?)">Atajos <kbd>?</kbd></button></div>' +
    pasosHtml(null, detalle);
}
var hookInicioFlujo = PANEL_HOOKS.inicio;
PANEL_HOOKS.inicio = function(){ hookInicioFlujo(); renderInicioFlujo(); };

document.addEventListener('click', function(e){
  var paso = e.target.closest('[data-paso]');
  if(paso){ e.preventDefault(); irAPaso(Number(paso.dataset.paso)); return; }
  if(e.target.closest('[data-cambiar-proyecto]')){
    e.preventDefault();
    if(typeof expedienteProyecto !== 'undefined' && expedienteProyecto) cerrarExpediente();
    irAPaso(1);
    toast('Elegí el proyecto con el que vas a trabajar');
    return;
  }
  if(e.target.closest('[data-solo-proyecto]')){ roturasSoloProyecto = !roturasSoloProyecto; renderRoturasPendientes(); return; }
  if(e.target.closest('[data-atajos]')) abrirAtajos();
});

/* ================= ATAJOS DE TECLADO ================= */
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
  if(e.altKey && !e.ctrlKey && !e.metaKey){
    var m = /^Digit([0-7])$/.exec(e.code);
    if(m){
      e.preventDefault();
      if(m[1] === '0') showPanel('inicio'); else irAPaso(Number(m[1]));
      return;
    }
    if(e.code === 'KeyN'){
      e.preventDefault();
      if(exigir('disenos:crear')) irAPaso(3);
      return;
    }
  }
  if(e.key === 'Escape' && document.getElementById('atajos-modal').classList.contains('show')){ cerrarAtajos(); return; }
  if(e.key === '?' && !escribiendo(e.target)){ e.preventDefault(); abrirAtajos(); }
});

prepararContenedoresFlujo();
