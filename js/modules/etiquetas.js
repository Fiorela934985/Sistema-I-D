/* Sistema I+D — Etiquetas de identificación de probetas/cubos (con QR) a partir del nombre y código. */
'use strict';

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
function etiquetasDeDiseno(d, modo, soloPendientes){
  var cargas = cargasDeDiseno(d).filter(function(c){ return !soloPendientes || c.estado !== 'completado'; })
    .sort(function(a,b){ return (a.codigo||'').localeCompare(b.codigo||'') || a.dia - b.dia; });
  var proyecto = proyectoNombre(d.proyectoId);
  if(modo === 'replica'){
    var vistos = {};
    return (d.replicaObjs || []).filter(function(r){
      return !soloPendientes || cargas.some(function(c){ return c.replicaNombre === r.nombre; });
    }).map(function(r){
      if(vistos[r.nombre]) return null;
      vistos[r.nombre] = true;
      var dias = cargasDeDiseno(d).filter(function(c){ return c.replicaNombre === r.nombre; }).map(function(c){ return c.dia; }).sort(function(a,b){ return a-b; });
      return {codigo: r.codigo || '-', titulo: r.nombre, linea1: 'Edades: ' + (dias.join(', ') || '-') + ' d', linea2: 'Elab.: ' + (d.fecha || '-'),
        proyecto: proyecto, qr: [r.codigo, r.nombre, d.codigo].join('|')};
    }).filter(Boolean);
  }
  var lista = [];
  cargas.forEach(function(c){
    var base = {codigo: c.codigo, titulo: c.replicaNombre, linea2: 'Ensayo: ' + isoToDMY(c.fechaEnsayo) + ' ±' + c.toleranciaHoras + 'h', proyecto: proyecto};
    if(modo === 'especimen'){
      [1,2,3].forEach(function(m){
        lista.push(Object.assign({}, base, {linea1: 'Día ' + c.dia + ' · M' + m + ' · Elab. ' + isoToDMY(c.fechaElaboracion), qr: [c.codigo, c.replicaNombre, 'D' + c.dia, 'M' + m, c.fechaEnsayo].join('|')}));
      });
    } else {
      lista.push(Object.assign({}, base, {linea1: 'Día ' + c.dia + ' · Elab. ' + isoToDMY(c.fechaElaboracion), qr: [c.codigo, c.replicaNombre, 'D' + c.dia, c.fechaEnsayo].join('|')}));
    }
  });
  return lista;
}
function etiquetaHtml(e){
  return '<div class="etq">' +
    '<div class="etq-qr">'+qrSvg(e.qr)+'</div>' +
    '<div class="etq-txt"><div class="etq-cod">'+esc(e.codigo)+'</div><div class="etq-tit">'+esc(e.titulo)+'</div>' +
      '<div class="etq-l">'+esc(e.linea1)+'</div><div class="etq-l">'+esc(e.linea2)+'</div><div class="etq-p">'+esc([e.proyecto, 'Lab. I+D'].filter(Boolean).join(' · '))+'</div></div>' +
  '</div>';
}
function opcionesEtiquetas(){
  return {modo: (document.querySelector('input[name="etq-modo"]:checked') || {}).value || 'especimen',
          soloPend: document.getElementById('etq-solo-pendientes').checked};
}
function renderEtiquetasPreview(){
  var d = disenoPorCodigo(etiquetasDisenoCodigo);
  if(!d) return;
  var op = opcionesEtiquetas();
  var lista = etiquetasDeDiseno(d, op.modo, op.soloPend);
  document.getElementById('etq-cuenta').textContent = lista.length + ' etiqueta' + (lista.length===1?'':'s');
  document.getElementById('etq-preview').innerHTML = lista.length
    ? lista.slice(0, 12).map(etiquetaHtml).join('') + (lista.length > 12 ? '<div class="etq-mas">… y ' + (lista.length - 12) + ' más al imprimir</div>' : '')
    : '<div class="empty-note">No hay roturas para etiquetar con este filtro.</div>';
}
function abrirEtiquetas(codigo){
  var d = disenoPorCodigo(codigo);
  if(!d){ toast('No se encontró el diseño'); return; }
  etiquetasDisenoCodigo = codigo;
  document.getElementById('etq-diseno-nombre').textContent = d.codigo + ' · ' + diseñoTitulo(d) + ' · ' + (proyectoNombre(d.proyectoId) || 'Sin proyecto');
  // Sin réplicas ni roturas no hay qué etiquetar: se explica y se ofrece programarlas desde acá.
  var sinRoturas = !cargasDeDiseno(d).length && !(d.replicaObjs || []).length;
  document.getElementById('etq-opciones').style.display = sinRoturas ? 'none' : '';
  document.getElementById('etq-imprimir').style.display = sinRoturas ? 'none' : '';
  if(sinRoturas){
    document.getElementById('etq-cuenta').textContent = '';
    document.getElementById('etq-preview').innerHTML =
      '<div class="etq-vacio"><b>Este diseño todavía no tiene réplicas ni roturas programadas.</b>' +
      '<p>Las etiquetas se generan a partir de los códigos de cada réplica (ID-0001, ID-0002…). Programá las réplicas y los días de rotura y vas a poder imprimirlas.</p>' +
      '<button class="btn-add" id="etq-programar" data-perm="roturas:registrar">Programar réplicas y roturas</button></div>';
    abrirModal('etiquetas-modal');
    return;
  }
  var hayPend = cargasDeDiseno(d).some(function(c){ return c.estado !== 'completado'; });
  document.getElementById('etq-solo-pendientes').checked = hayPend;
  renderEtiquetasPreview();
  abrirModal('etiquetas-modal');
}
document.getElementById('etiquetas-modal').addEventListener('click', function(e){
  if(!e.target.closest('#etq-programar')) return;
  if(!exigir('roturas:registrar')) return;
  var d = disenoPorCodigo(etiquetasDisenoCodigo);
  cerrarModal('etiquetas-modal');
  // Abre el mismo flujo del registro de diseño: réplicas → días → roturas creadas → "Imprimir etiquetas".
  if(d) askReplicasThenPrint(d);
});
document.getElementById('etiquetas-modal').addEventListener('change', function(e){
  if(e.target.name === 'etq-modo' || e.target.id === 'etq-solo-pendientes') renderEtiquetasPreview();
});
document.getElementById('etq-imprimir').addEventListener('click', function(){
  var d = disenoPorCodigo(etiquetasDisenoCodigo);
  if(!d) return;
  var op = opcionesEtiquetas();
  var lista = etiquetasDeDiseno(d, op.modo, op.soloPend);
  if(!lista.length){ toast('No hay etiquetas para imprimir'); return; }
  var css = '@page{size:A4;margin:8mm;}body{font-family:Arial,Helvetica,sans-serif;margin:0;}' +
    '.hoja{display:grid;grid-template-columns:repeat(3,62mm);gap:3mm;}' +
    '.etq{width:62mm;height:34mm;border:1px dashed #9aa;box-sizing:border-box;padding:2.5mm;display:flex;gap:2.5mm;align-items:center;page-break-inside:avoid;overflow:hidden;}' +
    '.etq-qr{width:22mm;height:22mm;flex-shrink:0;}.etq-qr svg{width:100%;height:100%;}' +
    '.etq-txt{min-width:0;font-size:7.5pt;line-height:1.25;}.etq-cod{font-size:13pt;font-weight:bold;color:#0b5f7a;}' +
    '.etq-tit{font-weight:bold;font-size:7.5pt;word-break:break-word;}.etq-l{color:#222;}.etq-p{color:#666;font-size:6.5pt;margin-top:1mm;}';
  var html = '<!doctype html><html><head><meta charset="utf-8"><title>Etiquetas ' + esc(d.codigo) + '</title><style>' + css + '</style></head><body><div class="hoja">' +
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
    setTimeout(function(){ document.body.removeChild(iframe); }, 1500);
  }, 250);
  registrarHistorial('Imprimió', 'Etiquetas', lista.length + ' etiquetas · ' + d.codigo + ' · ' + diseñoTitulo(d), {proyecto: proyectoNombre(d.proyectoId), ref: d.codigo});
});
