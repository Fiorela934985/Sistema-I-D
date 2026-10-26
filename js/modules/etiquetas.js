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
        proyecto: proyecto, qr: urlQR(r.codigo || d.codigo, '', '')};
    }).filter(Boolean);
  }
  var lista = [];
  cargas.forEach(function(c){
    var base = {codigo: c.codigo, titulo: c.replicaNombre, linea2: 'Ensayo: ' + isoToDMY(c.fechaEnsayo) + ' ±' + c.toleranciaHoras + 'h', proyecto: proyecto};
    if(modo === 'especimen'){
      [1,2,3].forEach(function(m){
        lista.push(Object.assign({}, base, {linea1: 'Día ' + c.dia + ' · M' + m + ' · Elab. ' + isoToDMY(c.fechaElaboracion), qr: urlQR(c.codigo, c.dia, m)}));
      });
    } else {
      lista.push(Object.assign({}, base, {linea1: 'Día ' + c.dia + ' · Elab. ' + isoToDMY(c.fechaElaboracion), qr: urlQR(c.codigo, c.dia, '')}));
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
  var sinRoturas = !cargasDeDiseno(d).length;
  document.getElementById('etq-opciones').style.display = sinRoturas ? 'none' : '';
  document.getElementById('etq-imprimir').style.display = sinRoturas ? 'none' : '';
  if(sinRoturas){
    document.getElementById('etq-cuenta').textContent = '';
    document.getElementById('etq-preview').innerHTML =
      '<div class="etq-vacio"><b>Este diseño todavía no tiene réplicas ni roturas programadas.</b>' +
      '<p>Las etiquetas nacen al guardar la elaboración de cada réplica: ahí se asignan los códigos ID y las fechas de ensayo.</p>' +
      '<button class="btn-add" id="etq-programar">Ir a Elaboración</button></div>';
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
  var d = disenoPorCodigo(etiquetasDisenoCodigo);
  cerrarModal('etiquetas-modal');
  // Abre el mismo flujo del registro de diseño: réplicas → días → roturas creadas → "Imprimir etiquetas".
  if(d){ elaboracionFiltroProyecto = proyectoNombre(d.proyectoId); showPanel('elaboracion'); showElaboracionSub('programar'); }
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
  var t = TAMANOS_ETQ[document.getElementById('etq-tamano').value] || TAMANOS_ETQ.mediano;
  var css = '@page{size:A4;margin:8mm;}body{font-family:Arial,Helvetica,sans-serif;margin:0;}' +
    '.hoja{display:grid;grid-template-columns:repeat('+t.cols+','+t.w+'mm);gap:3mm;}' +
    '.etq{width:'+t.w+'mm;height:'+t.h+'mm;border:1px dashed #9aa;box-sizing:border-box;padding:2.5mm;display:flex;gap:2.5mm;align-items:center;page-break-inside:avoid;overflow:hidden;}' +
    '.etq-qr{width:'+t.qr+'mm;height:'+t.qr+'mm;flex-shrink:0;}.etq-qr svg{width:100%;height:100%;}' +
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

/* RF-ETQ-03: tamaño configurable de la etiqueta (hoja A4 de etiquetas sintéticas). */
var TAMANOS_ETQ = {
  'pequeño': {w:48, h:25, qr:17, cols:4},
  'mediano': {w:62, h:34, qr:22, cols:3},
  'grande': {w:95, h:45, qr:32, cols:2}
};
(function(){
  var sel = document.getElementById('etq-tamano');
  if(sel) sel.value = typeof ajuste === 'function' ? ajuste('tamanoEtiqueta') : 'mediano';
})();
/* RF-ETQ-02: sin codificadora en red, se exporta un CSV para el programa de la codificadora. */
document.getElementById('etq-csv').addEventListener('click', function(){
  var d = disenoPorCodigo(etiquetasDisenoCodigo);
  if(!d) return;
  var op = opcionesEtiquetas();
  var lista = etiquetasDeDiseno(d, op.modo, op.soloPend);
  if(!lista.length){ toast('No hay etiquetas para exportar'); return; }
  var filas = [['codigo', 'titulo', 'linea1', 'linea2', 'proyecto', 'qr']].concat(lista.map(function(x){ return [x.codigo, x.titulo, x.linea1, x.linea2, x.proyecto, x.qr]; }));
  descargarArchivo('etiquetas-' + d.codigo + '.csv', '\ufeff' + aCSV(filas), 'text/csv;charset=utf-8');
  registrarHistorial('Exportó', 'Etiquetas', lista.length + ' etiquetas (CSV) · ' + d.codigo, {proyecto: proyectoNombre(d.proyectoId), ref: d.codigo});
});

/* RF-ETQ-06: el QR lleva al registro. Si quien escanea no tiene sesión, primero pide ingresar. */
function urlQR(codigo, dia, especimen){
  var base = location.origin + location.pathname;
  return base + '#qr=' + encodeURIComponent(codigo) + (dia ? '&d=' + dia : '') + (especimen ? '&m=' + especimen : '');
}
function leerQR(texto){
  var s = String(texto || '').trim();
  var m = s.match(/#qr=([^&]+)(?:&d=(\d+))?(?:&m=(\d))?/);
  if(m) return {codigo: decodeURIComponent(m[1]), dia: m[2] ? Number(m[2]) : null, m: m[3] ? Number(m[3]) : null};
  var partes = s.split('|');                              // etiquetas impresas con la versión anterior
  if(/^ID-\d+/i.test(partes[0])) return {codigo: partes[0].toUpperCase(), dia: partes[2] && /^D\d+$/.test(partes[2]) ? Number(partes[2].slice(1)) : null, m: null};
  if(/^ID-\d+$/i.test(s)) return {codigo: s.toUpperCase(), dia: null, m: null};
  return null;
}
/* Abre lo que corresponde al código leído: la rotura del día (si ya está registrada, su resultado). */
function abrirDesdeQR(datos){
  if(!datos){ toast('El código no es una etiqueta del sistema'); return; }
  var cargas = roturaCargas.filter(function(c){ return c.codigo === datos.codigo; });
  if(!cargas.length){ toast('No hay roturas con el código ' + datos.codigo); return; }
  var c = datos.dia ? cargas.filter(function(x){ return x.dia === datos.dia; })[0] : null;
  if(!c) c = cargas.filter(function(x){ return x.estado === 'pendiente'; }).sort(function(a, b){ return (a.fechaEnsayo || '').localeCompare(b.fechaEnsayo || ''); })[0] || cargas[0];
  showPanel('roturas');
  openRoturaCargaModal(c.id);
}
/* RNF-04: escáner con la cámara del celular, sin instalar otra app (BarcodeDetector). Si el navegador
   no lo soporta, se escribe el código a mano. */
function escanearQR(titulo, alLeer){
  var stream = null, timer = null;
  var soporta = 'BarcodeDetector' in window && navigator.mediaDevices && navigator.mediaDevices.getUserMedia;
  var dlg = abrirDialogo({titulo: titulo || 'Escanear etiqueta', html:
    (soporta ? '<video id="qr-video" playsinline muted style="width:100%;max-height:50vh;border-radius:10px;background:#000;"></video><p class="nota-sm">Apuntá la cámara al código QR de la etiqueta.</p>' : '<p class="nota-sm">Este navegador no permite leer QR con la cámara. Escribí el código de la etiqueta.</p>') +
    '<div class="pp-field"><label>O escribí el código</label><input type="text" id="qr-manual" placeholder="ID-0001" autocapitalize="characters"></div>',
    botones:[{label:'Usar código', accion:function(c){
      var v = c.querySelector('#qr-manual').value.trim();
      if(!v){ toast('Escribí el código'); return false; }
      alLeer(leerQR(v) || {codigo: v.toUpperCase(), dia: null});
    }}],
    alCerrar:function(){ if(timer) clearInterval(timer); if(stream) stream.getTracks().forEach(function(t){ t.stop(); }); }
  });
  if(!soporta) return;
  var video = dlg.el.querySelector('#qr-video');
  var detector = new window.BarcodeDetector({formats:['qr_code']});
  navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}}).then(function(s){
    stream = s; video.srcObject = s; video.play();
    timer = setInterval(function(){
      detector.detect(video).then(function(res){
        if(res && res.length){ var txt = res[0].rawValue; dlg.cerrar(); alLeer(leerQR(txt)); }
      }).catch(function(){});
    }, 400);
  }).catch(function(){ toast('No se pudo abrir la cámara: escribí el código'); });
}
