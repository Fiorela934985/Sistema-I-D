/* Sistema I+D — Flujo del ensayo: los pasos del trabajo del laboratorio en orden (Registro → Diseño →
   Roturas → Resultados → Reporte RR → Archivo). Dibuja la barra de pasos y los botones Anterior/Siguiente
   en cada sección del flujo, marca el paso en el menú y la cabecera, y define los atajos de teclado. */
'use strict';

var FLUJO = [
  {n:1, panel:'componentes', titulo:'Registro', sub:'Materiales, proyecto e iteración',
   ayuda:'Revisá que los materiales del diseño estén cargados y que exista el proyecto con su iteración (categoría <b>Proyecto</b>).'},
  {n:2, panel:'disenos', subtab:'calcular', titulo:'Diseño', sub:'Calcular dosificación',
   ayuda:'Elegí proyecto e iteración, completá la hoja D-CC-F-148 y registrá. Al registrar se eligen réplicas y días, y las roturas quedan programadas solas.'},
  {n:3, panel:'roturas', titulo:'Roturas', sub:'Elaboración y cargas', alias:['calendario'],
   ayuda:'En <b>Pendientes</b> registrá la carga de cada probeta el día que toca. El <b>Calendario</b> muestra la semana; las vencidas aparecen primero.'},
  {n:4, panel:'disenos', subtab:'historico', titulo:'Resultados', sub:'Estado fresco y resistencia',
   ayuda:'Abrí el diseño y entrá a <b>Resultados</b>: slump, temperaturas y observaciones por réplica. La resistencia llega sola desde Roturas.'},
  {n:5, panel:'reporte-rr', titulo:'Reporte RR', sub:'Comparar diseños y edades',
   ayuda:'Generá el Reporte RR para comparar los diseños de la iteración por edad y exportarlo.'},
  {n:6, panel:'archivador', titulo:'Archivo', sub:'Diseños completados',
   ayuda:'Los diseños completados quedan guardados por proyecto, con su informe listo para consultar o imprimir.'}
];
var PANELES_FLUJO = ['componentes', 'disenos', 'roturas', 'calendario', 'reporte-rr', 'archivador'];
var subTabDisenos = 'calcular';

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
  if(p.panel === 'disenos') showSubTab(p.subtab === 'calcular' && !can('disenos:crear') ? 'historico' : p.subtab);
  if(p.panel === 'roturas') showRoturasSub('pendientes');
  if(p.panel === 'componentes'){ activeCompCat = null; renderComponentesPanel(); }
}

/* Barra de pasos: el paso actual resaltado, los anteriores como hechos */
function flujoBarraHtml(actual){
  return '<div class="flujo-cab"><span class="flujo-tit">Flujo del ensayo</span>' +
    (actual ? '<span class="flujo-paso">Paso ' + actual.n + ' de ' + FLUJO.length + '</span>' : '') +
    '<button class="flujo-ayuda-btn" data-atajos title="Atajos de teclado (?)">Atajos <kbd>?</kbd></button></div>' +
    '<ol class="flujo-pasos">' + FLUJO.map(function(p){
      var cls = actual && p.n === actual.n ? 'actual' : (actual && p.n < actual.n ? 'hecho' : '');
      var bloqueado = !pasoPermitido(p);
      return '<li><button class="flujo-step ' + cls + '" data-paso="' + p.n + '"' + (bloqueado ? ' disabled' : '') +
        ' title="' + p.titulo + ' · Alt+' + p.n + '"><span class="fs-num">' + p.n + '</span>' +
        '<span class="fs-txt"><b>' + p.titulo + '</b><small>' + p.sub + '</small></span></button></li>';
    }).join('') + '</ol>' +
    (actual ? '<p class="flujo-ayuda"><b>Qué hacer acá:</b> ' + actual.ayuda + '</p>' : '');
}

/* Pie con el paso anterior y el siguiente */
function flujoPieHtml(actual){
  var ant = pasoFlujo(actual.n - 1), sig = pasoFlujo(actual.n + 1);
  return (ant ? '<button class="btn-add ghost" data-paso="' + ant.n + '">← Paso ' + ant.n + ': ' + ant.titulo + '</button>' : '<span></span>') +
    (sig ? '<button class="btn-add" data-paso="' + sig.n + '">Siguiente · Paso ' + sig.n + ': ' + sig.titulo + ' →</button>' : '<button class="btn-add ghost" data-goto="inicio">Volver al Inicio</button>');
}

function prepararContenedoresFlujo(){
  PANELES_FLUJO.forEach(function(id){
    var sec = document.getElementById('panel-' + id);
    if(!sec || sec.querySelector('.flujo')) return;
    var barra = document.createElement('nav');
    barra.className = 'flujo';
    barra.setAttribute('aria-label', 'Flujo del ensayo');
    var cab = sec.querySelector('.content-header');
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
    var barra = sec.querySelector('.flujo'), pie = sec.querySelector('.flujo-pie');
    if(barra) barra.innerHTML = flujoBarraHtml(actual);
    if(pie) pie.innerHTML = flujoPieHtml(actual);
    document.getElementById('tb-crumb').textContent = 'Paso ' + actual.n + ' · ' + actual.titulo;
  }
  // En el menú, Diseños y Resultados comparten sección: se marca según la pestaña
  document.querySelectorAll('.side-nav .nav-item[data-panel]').forEach(function(btn){
    var activo = btn.dataset.panel === panelActual && (!btn.dataset.sub || panelActual !== 'disenos' || btn.dataset.sub === subTabDisenos);
    btn.classList.toggle('active', activo);
  });
}

/* Inicio: los seis pasos con lo que hay pendiente en cada uno */
function renderInicioFlujo(){
  var el = document.getElementById('inicio-flujo');
  if(!el) return;
  var hoy = todayISO();
  var porRomper = roturaCargas.filter(function(c){ return c.estado === 'pendiente' && c.fechaEnsayo <= hoy; }).length;
  var enCurso = disenos.filter(function(d){ return d.estado !== 'Completado'; }).length;
  var completos = disenos.length - enCurso;
  var datos = {
    1: componentes.length + ' materiales',
    2: disenos.length + ' diseños',
    3: porRomper ? '<em>' + porRomper + ' por romper</em>' : 'Al día',
    4: enCurso + ' en curso',
    5: rrEstudios.length + ' reportes',
    6: completos + ' completados'
  };
  el.innerHTML = '<div class="flujo-cab"><span class="flujo-tit">Flujo del ensayo</span><span class="flujo-paso">Seguí los pasos en orden · Alt+1 a Alt+6</span>' +
    '<button class="flujo-ayuda-btn" data-atajos title="Atajos de teclado (?)">Atajos <kbd>?</kbd></button></div>' +
    '<ol class="flujo-pasos">' + FLUJO.map(function(p){
      return '<li><button class="flujo-step" data-paso="' + p.n + '"' + (pasoPermitido(p) ? '' : ' disabled') + '>' +
        '<span class="fs-num">' + p.n + '</span><span class="fs-txt"><b>' + p.titulo + '</b><small>' + datos[p.n] + '</small></span></button></li>';
    }).join('') + '</ol>';
}
var hookInicioFlujo = PANEL_HOOKS.inicio;
PANEL_HOOKS.inicio = function(){ hookInicioFlujo(); renderInicioFlujo(); };

document.addEventListener('click', function(e){
  var paso = e.target.closest('[data-paso]');
  if(paso){ e.preventDefault(); irAPaso(Number(paso.dataset.paso)); return; }
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
    var m = /^Digit([0-6])$/.exec(e.code);
    if(m){
      e.preventDefault();
      if(m[1] === '0') showPanel('inicio'); else irAPaso(Number(m[1]));
      return;
    }
    if(e.code === 'KeyN'){
      e.preventDefault();
      if(exigir('disenos:crear')){ showPanel('disenos'); showSubTab('calcular'); }
      return;
    }
  }
  if(e.key === 'Escape' && document.getElementById('atajos-modal').classList.contains('show')){ cerrarAtajos(); return; }
  if(e.key === '?' && !escribiendo(e.target)){ e.preventDefault(); abrirAtajos(); }
});

prepararContenedoresFlujo();
