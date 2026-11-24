/* Sistema I+D — Etiquetas (sección 7): 3 etiquetas iguales por edad, en blanco y negro, con QR.
   Contenido: DINO S.R.L, producto, código, proyecto, fecha y hora de elaboración y edad (sin M1/M2/M3).
   El QR lleva el enlace que abre directo el registro de la rotura de ese código y edad. */
'use strict';

var ETIQUETAS_POR_EDAD = 3;
var etiquetasDisenoCodigo = null;

function qrSvg(texto){
  if(typeof qrcode === 'undefined') return '<div class="etq-qr-falta">QR</div>';
  try{
    var qr = qrcode(0, 'M');
    qr.addData(texto);
    qr.make();
    return qr.createSvgTag({cellSize: 2, margin: 0, scalable: true});
  }catch(e){ return '<div class="etq-qr-falta">QR</div>'; }
}
function ordenarCargas(lista){
  return lista.slice().sort(function(a,b){ return (a.codigo || '').localeCompare(b.codigo || '') || a.dia - b.dia; });
}
/* Una entrada por rotura (réplica × edad); al imprimir se repite 3 veces */
function etiquetaDeCarga(c){
  return {codigo:c.codigo, producto:c.producto || c.replicaNombre, proyecto:c.proyecto || '',
    elaboracion:isoToDMY(c.fechaElaboracion) + ' ' + (c.horaElaboracion || '__:__'), edad:c.dia + (Number(c.dia) === 1 ? ' día' : ' días'), qr:urlEtiqueta(c)};
}
function etiquetasDeCargas(cargas){
  var lista = [];
  ordenarCargas(cargas).forEach(function(c){
    var e = etiquetaDeCarga(c);
    for(var k = 0; k < ETIQUETAS_POR_EDAD; k++) lista.push(e);
  });
  return lista;
}
function etiquetaHtml(e){
  return '<div class="etq">' +
    '<div class="etq-qr">' + qrSvg(e.qr) + '</div>' +
    '<div class="etq-txt"><div class="etq-emp">' + esc(EMPRESA_ETIQUETA) + '</div><div class="etq-cod">' + esc(e.codigo) + '</div><div class="etq-tit">' + esc(e.producto) + '</div>' +
      '<div class="etq-l">' + esc(e.proyecto) + '</div><div class="etq-l">Elab.: ' + esc(e.elaboracion) + '</div><div class="etq-edad">Edad: ' + esc(e.edad) + '</div></div>' +
  '</div>';
}
function imprimirEtiquetas(lista, titulo){
  if(!lista.length){ toast('No hay etiquetas para imprimir'); return false; }
  var css = '@page{size:A4;margin:8mm;}body{font-family:Arial,Helvetica,sans-serif;margin:0;color:#000;}' +
    '.hoja{display:grid;grid-template-columns:repeat(3,62mm);gap:3mm;}' +
    '.etq{width:62mm;height:34mm;border:1px dashed #000;box-sizing:border-box;padding:2.5mm;display:flex;gap:2.5mm;align-items:center;page-break-inside:avoid;overflow:hidden;}' +
    '.etq-qr{width:24mm;height:24mm;flex-shrink:0;}.etq-qr svg{width:100%;height:100%;}' +
    '.etq-txt{min-width:0;font-size:7pt;line-height:1.25;}.etq-emp{font-size:6.5pt;font-weight:bold;letter-spacing:.04em;}' +
    '.etq-cod{font-size:13pt;font-weight:bold;}.etq-tit{font-weight:bold;word-break:break-word;}.etq-edad{font-weight:bold;font-size:8.5pt;margin-top:.5mm;}';
  var html = '<!doctype html><html><head><meta charset="utf-8"><title>' + esc(titulo) + '</title><style>' + css + '</style></head><body><div class="hoja">' +
    lista.map(etiquetaHtml).join('') + '</div></body></html>';
  var iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
  document.body.appendChild(iframe);
  iframe.contentDocument.open();
  iframe.contentDocument.write(html);
  iframe.contentDocument.close();
  setTimeout(function(){
    iframe.contentWindow.focus();
    iframe.contentWindow.print();
    setTimeout(function(){ if(iframe.parentNode) document.body.removeChild(iframe); }, 1500);
  }, 250);
  return true;
}

/* ================= Ventana de etiquetas de un diseño ================= */
function cargasParaEtiquetas(d, soloPendientes){
  return cargasDeDiseno(d).filter(function(c){ return !c.anulada && (!soloPendientes || c.estado !== 'completado'); });
}
function renderEtiquetasPreview(){
  var d = disenoPorCodigo(etiquetasDisenoCodigo);
  if(!d) return;
  var lista = etiquetasDeCargas(cargasParaEtiquetas(d, document.getElementById('etq-solo-pendientes').checked));
  document.getElementById('etq-cuenta').textContent = lista.length + ' etiqueta' + (lista.length === 1 ? '' : 's') + ' (3 por edad)';
  document.getElementById('etq-preview').innerHTML = lista.length
    ? lista.slice(0, 12).map(etiquetaHtml).join('') + (lista.length > 12 ? '<div class="etq-mas">… y ' + (lista.length - 12) + ' más al imprimir</div>' : '')
    : '<div class="empty-note">No hay roturas para etiquetar con este filtro.</div>';
}
function abrirEtiquetas(codigo){
  var d = disenoPorCodigo(codigo);
  if(!d){ toast('No se encontró el diseño'); return; }
  etiquetasDisenoCodigo = codigo;
  document.getElementById('etq-diseno-nombre').textContent = d.codigo + ' · ' + diseñoTitulo(d) + ' · ' + (proyectoNombre(d.proyectoId) || 'Sin proyecto');
  // Los códigos nacen en la elaboración (paso 3): sin elaborar no hay qué etiquetar
  var sinCodigos = !cargasParaEtiquetas(d, false).length;
  document.getElementById('etq-opciones').style.display = sinCodigos ? 'none' : '';
  document.getElementById('etq-imprimir').style.display = sinCodigos ? 'none' : '';
  if(sinCodigos){
    document.getElementById('etq-cuenta').textContent = '';
    document.getElementById('etq-preview').innerHTML =
      '<div class="etq-vacio"><b>Este diseño todavía no tiene réplicas elaboradas.</b>' +
      '<p>El código de cada réplica (ID-0001, ID-0002…) y sus etiquetas nacen al registrar la elaboración.</p>' +
      '<button class="btn-add verde" id="etq-programar" data-perm="roturas:registrar">Ir al flujo del diseño</button></div>';
    abrirModal('etiquetas-modal');
    return;
  }
  document.getElementById('etq-solo-pendientes').checked = cargasParaEtiquetas(d, true).length > 0;
  renderEtiquetasPreview();
  abrirModal('etiquetas-modal');
}
document.getElementById('etiquetas-modal').addEventListener('click', function(e){
  if(!e.target.closest('#etq-programar')) return;
  var d = disenoPorCodigo(etiquetasDisenoCodigo);
  cerrarModal('etiquetas-modal');
  if(d) abrirFlujoDiseno(d);
});
document.getElementById('etiquetas-modal').addEventListener('change', function(e){
  if(e.target.id === 'etq-solo-pendientes') renderEtiquetasPreview();
});
document.getElementById('etq-imprimir').addEventListener('click', function(){
  var d = disenoPorCodigo(etiquetasDisenoCodigo);
  if(!d) return;
  var lista = etiquetasDeCargas(cargasParaEtiquetas(d, document.getElementById('etq-solo-pendientes').checked));
  if(imprimirEtiquetas(lista, 'Etiquetas ' + d.codigo))
    registrarHistorial('Imprimió', 'Etiquetas', lista.length + ' etiquetas · ' + d.codigo + ' · ' + diseñoTitulo(d), {proyecto: proyectoNombre(d.proyectoId), ref: d.codigo});
});

/* ================= Formatos › Etiquetas: todas las etiquetas acumuladas ================= */
var etqpSeleccion = {};
function cargasPanelEtiquetas(){
  var proy = document.getElementById('etqp-proyecto').value;
  var txt = normalizar(document.getElementById('etqp-buscar').value);
  var soloPend = document.getElementById('etqp-pendientes').checked;
  return ordenarCargas(roturaCargas.filter(function(c){
    if(c.anulada || !c.codigo) return false;
    if(proy && c.proyecto !== proy) return false;
    if(soloPend && c.estado === 'completado') return false;
    if(txt && normalizar(c.codigo + ' ' + (c.producto || '')).indexOf(txt) === -1) return false;
    return true;
  }));
}
function renderEtiquetasPanel(){
  var sel = document.getElementById('etqp-proyecto');
  var actual = sel.value || (typeof etqpProyectoInicial !== 'undefined' && etqpProyectoInicial) || '';
  etqpProyectoInicial = '';
  sel.innerHTML = '<option value="">Todos los proyectos</option>' + PROYECTO_CATALOGO.map(function(p){ return '<option' + (p === actual ? ' selected' : '') + '>' + esc(p) + '</option>'; }).join('');
  var lista = cargasPanelEtiquetas();
  var ids = {}; lista.forEach(function(c){ ids[c.id] = true; });
  Object.keys(etqpSeleccion).forEach(function(id){ if(!ids[id]) delete etqpSeleccion[id]; });
  document.getElementById('etqp-tbody').innerHTML = lista.length ? lista.map(function(c){
    return '<tr><td><input type="checkbox" data-etqp="' + esc(c.id) + '"' + (etqpSeleccion[c.id] ? ' checked' : '') + '></td>' +
      '<td><div class="id-card"><span class="id-card-tipo">' + ((c.tipo || 'Probetas') !== 'Cubos' ? 'Probeta' : 'Cubo') + '</span><span class="id-card-codigo">' + esc(c.codigo) + '</span></div></td>' +
      '<td>' + esc(c.producto || c.replicaNombre) + '</td><td>' + esc(c.proyecto || '—') + '</td>' +
      '<td>' + isoToDMY(c.fechaElaboracion) + ' ' + (c.horaElaboracion ? esc(c.horaElaboracion) : '<span class="chip-falta">Falta: hora</span>') + '</td>' +
      '<td><span class="chip-edad">' + c.dia + ' d</span></td><td>' + esc(textoVentana(c)) + '</td>' +
      '<td>' + (c.estado === 'completado' ? '<span class="chip-ok">Rota</span>' : '<span class="chip-falta' + (cargaAtrasada(c) ? ' atrasado' : '') + '">' + (cargaAtrasada(c) ? 'Atrasada' : 'Pendiente') + '</span>') + '</td></tr>';
  }).join('') : '<tr><td colspan="8" class="nota-sm">No hay etiquetas con este filtro. Los códigos nacen al registrar la elaboración de cada réplica.</td></tr>';
  var n = Object.keys(etqpSeleccion).length;
  document.getElementById('etqp-todas').checked = lista.length > 0 && n === lista.length;
  document.getElementById('etqp-cuenta').textContent = lista.length + ' rotura(s) · ' + n + ' seleccionada(s) = ' + (n * ETIQUETAS_POR_EDAD) + ' etiquetas';
}
var etqpProyectoInicial = '';
function abrirPanelEtiquetas(proyecto){ etqpProyectoInicial = proyecto || ''; document.getElementById('etqp-proyecto').value = ''; showPanel('etiquetas'); }
['etqp-proyecto', 'etqp-pendientes'].forEach(function(id){ document.getElementById(id).addEventListener('change', function(){ etqpSeleccion = {}; renderEtiquetasPanel(); }); });
document.getElementById('etqp-buscar').addEventListener('input', renderEtiquetasPanel);
document.getElementById('etqp-tbody').addEventListener('change', function(e){
  var id = e.target.dataset.etqp;
  if(!id) return;
  if(e.target.checked) etqpSeleccion[id] = true; else delete etqpSeleccion[id];
  renderEtiquetasPanel();
});
document.getElementById('etqp-todas').addEventListener('change', function(){
  var marcar = this.checked;
  etqpSeleccion = {};
  if(marcar) cargasPanelEtiquetas().forEach(function(c){ etqpSeleccion[c.id] = true; });
  renderEtiquetasPanel();
});
document.getElementById('etqp-imprimir').addEventListener('click', function(){
  var cargas = roturaCargas.filter(function(c){ return etqpSeleccion[c.id]; });
  if(!cargas.length){ toast('Marcá las roturas cuyas etiquetas querés imprimir'); return; }
  var lista = etiquetasDeCargas(cargas);
  if(imprimirEtiquetas(lista, 'Etiquetas I+D'))
    registrarHistorial('Imprimió', 'Etiquetas', lista.length + ' etiquetas · ' + cargas.length + ' rotura(s)', {codigo:cargas.map(function(c){ return c.codigo; }).filter(function(v, i, a){ return a.indexOf(v) === i; }).join(', ')});
});
PANEL_HOOKS.etiquetas = renderEtiquetasPanel;
