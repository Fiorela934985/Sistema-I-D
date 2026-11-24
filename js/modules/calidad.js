/* Sistema I+D — Fase 7: Calidad.
   · Documentos (17025, 8.3): procedimientos y formatos con código, versión vigente, fecha y archivo o enlace.
     Al publicar una versión nueva, la anterior queda como obsoleta. Cada formato del sistema toma de aquí su código y versión.
   · Trabajo no conforme (7.10): se abre (automático o [Reportar]) → se evalúa (responsable y causa) → se decide
     (aceptar con nota · repetir el ensayo · anular el resultado) → se cierra con fecha y responsable.
     Mientras está abierto el resultado lleva el chip No conforme; anulado no entra al promedio ni al RR. */
'use strict';

var documentosCalidad = load('sid_documentos', []);
function saveDocumentos(){ save('sid_documentos', documentosCalidad); }

/* ================= DOCUMENTOS ================= */
var TIPOS_DOC = ['Procedimiento', 'Formato', 'Instructivo', 'Registro', 'Norma', 'Otro'];
var FORMATOS_SISTEMA = {disenos:'Formato de Diseños', fresco:'Formato de Estado Fresco', roturas:'Formato de Roturas I+D', cargas:'Formato de Cargas y Promediados', rr:'Reporte RR'};
function versionVigente(doc){ return (doc.versiones || []).filter(function(v){ return v.estado === 'vigente'; })[0] || null; }
/* Código y versión que muestra cada formato del sistema */
function codigoFormatoSistema(clave){
  var doc = documentosCalidad.filter(function(d){ return !d.anulado && d.formato_sistema === clave; })[0];
  var v = doc ? versionVigente(doc) : null;
  if(doc && v) return doc.codigo + ' · v' + v.version;
  return Lab.config(FORMATOS_DOC[clave] || ('doc_formato_' + clave)) || 'Código por definir';
}
docFormatoHtml = function(clave){
  return '<span class="doc-formato" title="Código y versión vigentes (Calidad › Documentos)">' + esc(codigoFormatoSistema(clave)) + '</span>';
};
function puedeDocs(){ return can('informes:aprobar') || can('config:laboratorio'); }
function renderDocumentos(){
  var sec = document.getElementById('panel-documentos');
  var txt = normalizar((document.getElementById('doc-buscar') || {}).value || '');
  var tipo = (document.getElementById('doc-tipo') || {}).value || '';
  var verObs = (document.getElementById('doc-obsoletas') || {}).checked;
  var lista = documentosCalidad.filter(function(d){ return !d.anulado && (!tipo || d.tipo === tipo) && (!txt || normalizar(d.codigo + ' ' + d.titulo).indexOf(txt) > -1); })
    .sort(function(a,b){ return a.codigo.localeCompare(b.codigo); });
  var cuerpo = document.getElementById('doc-cuerpo');
  if(!cuerpo){
    sec.innerHTML = '<div class="content-header"><div><h2>Documentos</h2></div><button class="btn-add verde" id="doc-nuevo" data-perm="informes:aprobar">+ Documento</button></div>' +
      '<div class="card"><div class="fmt-filtros"><input type="search" id="doc-buscar" placeholder="Código o título"><select id="doc-tipo"><option value="">Todos los tipos</option>' + TIPOS_DOC.map(function(t){ return '<option>' + t + '</option>'; }).join('') + '</select>' +
      '<label class="pp-check-inline"><input type="checkbox" id="doc-obsoletas"> Ver versiones obsoletas</label></div><div id="doc-cuerpo"></div></div>';
    sec.querySelector('#doc-buscar').addEventListener('input', renderDocumentos);
    sec.querySelector('#doc-tipo').addEventListener('change', renderDocumentos);
    sec.querySelector('#doc-obsoletas').addEventListener('change', renderDocumentos);
    cuerpo = document.getElementById('doc-cuerpo');
  }
  cuerpo.innerHTML = lista.length ? '<div class="table-scroll"><table class="data-table"><thead><tr><th>Código</th><th>Título</th><th>Tipo</th><th>Formato del sistema</th><th>Versión</th><th>Fecha</th><th>Archivo</th><th></th></tr></thead><tbody>' + lista.map(function(d){
    var v = versionVigente(d) || {};
    var obs = (d.versiones || []).filter(function(x){ return x.estado === 'obsoleta'; });
    return '<tr><td class="mono"><b>' + esc(d.codigo) + '</b></td><td>' + esc(d.titulo) + '</td><td>' + esc(d.tipo) + '</td><td>' + esc(FORMATOS_SISTEMA[d.formato_sistema] || '—') + '</td>' +
      '<td><span class="chip-ok">v' + esc(v.version || '—') + ' vigente</span></td><td>' + (v.fecha ? isoToDMY(v.fecha) : '—') + '</td><td>' + archivoDocHtml(v) + '</td>' +
      '<td class="acciones-fila"><button class="btn-add ghost" data-doc-acc="version" data-id="' + esc(d.id) + '" data-perm="informes:aprobar">Nueva versión</button></td></tr>' +
      (verObs ? obs.map(function(o){ return '<tr class="doc-obsoleta"><td></td><td colspan="3" class="nota-sm">' + esc(o.motivo || '') + '</td><td><span class="chip-falta">v' + esc(o.version) + ' obsoleta</span></td><td>' + (o.fecha ? isoToDMY(o.fecha) : '—') + '</td><td>' + archivoDocHtml(o) + '</td><td></td></tr>'; }).join('') : '');
  }).join('') + '</tbody></table></div>' : '<div class="empty-note">Sin documentos.</div>';
}
function archivoDocHtml(v){
  if(!v) return '—';
  var a = [];
  if(v.enlace) a.push('<a href="' + esc(v.enlace) + '" target="_blank" rel="noopener">Abrir</a>');
  if(v.archivo) a.push('<button class="btn-link" data-doc-archivo="' + esc(v.archivo.key) + '" data-nombre="' + esc(v.archivo.nombre) + '">' + esc(v.archivo.nombre) + '</button>');
  return a.join(' · ') || '—';
}
var docEditId = null;
function abrirDocumento(doc){
  if(!exigir('informes:aprobar', 'Solo un responsable gestiona los documentos')) return;
  docEditId = doc ? doc.id : null;
  if(!document.getElementById('doc-modal')){
    document.body.insertAdjacentHTML('beforeend', '<div id="doc-modal" class="sid-modal"><div class="modal-card wide"><div class="modal-header"><h3 id="doc-modal-titulo"></h3><button class="modal-close" data-close="doc-modal">×</button></div><div class="modal-body" id="doc-modal-body"></div>' +
      '<div class="modal-actions"><button class="btn-add verde" id="doc-guardar">Guardar</button><button class="btn-add ghost" data-close="doc-modal">Cancelar</button></div></div></div>');
    document.getElementById('doc-guardar').addEventListener('click', guardarDocumento);
  }
  var v = doc ? versionVigente(doc) || {} : {};
  var sig = doc ? String((Number(v.version) || 0) + 1) : '1';
  document.getElementById('doc-modal-titulo').textContent = doc ? 'Nueva versión · ' + doc.codigo : 'Nuevo documento';
  document.getElementById('doc-modal-body').innerHTML = '<div class="pred-form">' +
    '<div class="pp-field"><label>Código</label><input id="doc-codigo" value="' + esc(doc ? doc.codigo : '') + '"' + (doc ? ' disabled' : ' placeholder="Ej. D-CC-F-148"') + '></div>' +
    '<div class="pp-field"><label>Tipo</label><select id="doc-tipo-f"' + (doc ? ' disabled' : '') + '>' + TIPOS_DOC.map(function(t){ return '<option' + (doc && doc.tipo === t ? ' selected' : '') + '>' + t + '</option>'; }).join('') + '</select></div>' +
    '<div class="pp-field span-2"><label>Título</label><input id="doc-titulo" value="' + esc(doc ? doc.titulo : '') + '"' + (doc ? ' disabled' : '') + '></div>' +
    '<div class="pp-field"><label>Formato del sistema</label><select id="doc-formato"' + (doc ? ' disabled' : '') + '><option value="">—</option>' + Object.keys(FORMATOS_SISTEMA).map(function(k){ return '<option value="' + k + '"' + (doc && doc.formato_sistema === k ? ' selected' : '') + '>' + FORMATOS_SISTEMA[k] + '</option>'; }).join('') + '</select></div>' +
    '<div class="pp-field"><label>Versión</label><input id="doc-version" value="' + sig + '"></div>' +
    '<div class="pp-field"><label>Fecha de vigencia</label><input type="date" id="doc-fecha" value="' + todayISO() + '"></div>' +
    '<div class="pp-field"><label>Enlace (Drive)</label><input id="doc-enlace" placeholder="https://drive.google.com/…"></div>' +
    '<div class="pp-field span-2"><label>Archivo</label><input type="file" id="doc-archivo"></div>' +
    (doc ? '<div class="pp-field span-2"><label>Motivo del cambio de versión</label><input id="doc-motivo"></div>' : '') + '</div>';
  abrirModal('doc-modal');
}
function guardarDocumento(){
  var g = function(id){ var el = document.getElementById(id); return el ? el.value.trim() : ''; };
  var doc = docEditId ? documentosCalidad.filter(function(d){ return d.id === docEditId; })[0] : null;
  var version = g('doc-version'), fecha = g('doc-fecha'), enlace = g('doc-enlace');
  if(!doc && (!g('doc-codigo') || !g('doc-titulo'))){ toast('Código y título son obligatorios'); return; }
  if(!doc && documentosCalidad.some(function(d){ return !d.anulado && d.codigo.toUpperCase() === g('doc-codigo').toUpperCase(); })){ toast('Ya existe un documento con ese código'); return; }
  if(!version || !fecha){ toast('Indicá la versión y la fecha'); return; }
  if(enlace && !/^https?:\/\//.test(enlace)){ toast('El enlace debe empezar con https://'); return; }
  if(doc && (doc.versiones || []).some(function(v){ return String(v.version) === version; })){ toast('Esa versión ya existe'); return; }
  if(doc && !g('doc-motivo')){ toast('Indicá el motivo del cambio de versión'); return; }
  var f = document.getElementById('doc-archivo').files[0];
  var id = doc ? doc.id : Lab.idNuevo('doc');
  var guardar = function(archivo){
    var v = {version:version, fecha:fecha, enlace:enlace, archivo:archivo, estado:'vigente', registrado_por:usuarioActual.id, registrado_en:new Date().toISOString(), motivo:g('doc-motivo')};
    if(doc){
      var antes = versionVigente(doc);
      (doc.versiones || []).forEach(function(x){ if(x.estado === 'vigente'){ x.estado = 'obsoleta'; x.obsoleta_en = new Date().toISOString(); } });
      doc.versiones.push(v);
      registrarHistorial('Editó', 'Documentos', doc.codigo + ' · nueva versión v' + version, {codigo:doc.codigo, ref:doc.id, antes:{version:antes ? antes.version : ''}, despues:{version:version}, motivo:v.motivo});
    } else {
      doc = {id:id, codigo:g('doc-codigo').toUpperCase(), titulo:g('doc-titulo'), tipo:g('doc-tipo-f'), formato_sistema:g('doc-formato'), versiones:[v], creado_por:usuarioActual.id, creado_en:new Date().toISOString()};
      if(doc.formato_sistema) documentosCalidad.forEach(function(d){ if(d.formato_sistema === doc.formato_sistema) d.formato_sistema = ''; });
      documentosCalidad.push(doc);
      registrarHistorial('Creó', 'Documentos', doc.codigo + ' · ' + doc.titulo + ' · v' + version, {codigo:doc.codigo, ref:doc.id});
    }
    saveDocumentos();
    cerrarModal('doc-modal');
    toast('Documento guardado');
    renderDocumentos();
  };
  if(f){ var key = 'doc_' + id + '_v' + version; saveEvidenciaBlob(key, f).then(function(){ guardar({nombre:f.name, tam:f.size, key:key}); }); }
  else guardar(null);
}
document.addEventListener('click', function(e){
  if(!e.target.closest('#panel-documentos')) return;
  if(e.target.closest('#doc-nuevo')){ abrirDocumento(null); return; }
  var b = e.target.closest('[data-doc-acc="version"]');
  if(b){ abrirDocumento(documentosCalidad.filter(function(d){ return d.id === b.dataset.id; })[0]); return; }
  var a = e.target.closest('[data-doc-archivo]');
  if(a) loadEvidenciaURL(a.dataset.docArchivo).then(function(url){ if(!url){ toast('El archivo está en el navegador donde se subió'); return; } var l = document.createElement('a'); l.href = url; l.download = a.dataset.nombre; document.body.appendChild(l); l.click(); l.remove(); });
});

/* ================= TRABAJO NO CONFORME ================= */
var CASOS_MANUALES = {perdida:'Probeta perdida', etiqueta:'Probeta mal etiquetada', danada:'Probeta dañada', receta:'Receta cambiada en el momento sin registrarse', otro:'Otro'};
Object.keys(CASOS_MANUALES).forEach(function(k){ TIPOS_TNC[k] = CASOS_MANUALES[k]; });
var DECISIONES_TNC = {aceptar:'Aceptar con nota', repetir:'Repetir el ensayo', anular:'Anular el resultado'};
var ETAPAS_TNC = ['Abierto', 'En evaluación', 'Decidido', 'Cerrado'];
function etapaTnc(t){ return t.estado === 'Cerrado' ? 3 : (t.decision ? 2 : (t.evaluacion ? 1 : 0)); }
tncAbiertoDeCarga = function(c){ return trabajosNoConformes.filter(function(t){ return t.estado !== 'Cerrado' && !t.alerta && (t.carga_id === c.id || (!t.carga_id && (t.codigos || []).indexOf(c.codigo) > -1 && t.tipo !== 'poza')); })[0] || null; };
function diasAbierto(t){ var fin = t.cierre ? new Date(t.cierre.en) : new Date(); return Math.max(0, Math.round((fin - new Date(t.creado_en)) / DAY)); }
var tncFiltro = {estado:'', caso:'', texto:''};
function renderTnc(){
  var sec = document.getElementById('panel-no-conforme');
  if(!document.getElementById('tnc-cuerpo')){
    sec.innerHTML = '<div class="content-header"><div><h2>Trabajo no conforme</h2></div><button class="btn-add" id="tnc-reportar" data-perm="tnc:reportar">Reportar</button></div>' +
      '<div class="kpi-grid" id="tnc-kpis"></div><div class="card" style="margin-top:12px;"><div class="fmt-filtros"><input type="search" id="tnc-texto" placeholder="Código o detalle">' +
      '<select id="tnc-estado"><option value="">Todos los estados</option>' + ETAPAS_TNC.map(function(x){ return '<option>' + x + '</option>'; }).join('') + '</select>' +
      '<select id="tnc-caso"><option value="">Todos los casos</option>' + Object.keys(TIPOS_TNC).map(function(k){ return '<option value="' + k + '">' + esc(TIPOS_TNC[k]) + '</option>'; }).join('') + '</select></div><div id="tnc-cuerpo"></div></div>';
    sec.querySelector('#tnc-texto').addEventListener('input', function(){ tncFiltro.texto = this.value; renderTnc(); });
    sec.querySelector('#tnc-estado').addEventListener('change', function(){ tncFiltro.estado = this.value; renderTnc(); });
    sec.querySelector('#tnc-caso').addEventListener('change', function(){ tncFiltro.caso = this.value; renderTnc(); });
  }
  var abiertos = trabajosNoConformes.filter(function(t){ return t.estado !== 'Cerrado' && !t.alerta; });
  document.getElementById('tnc-kpis').innerHTML =
    kpiCard('kpi-rojo', ICO_ALERTA, abiertos.filter(function(t){ return etapaTnc(t) === 0; }).length, 'Abiertos sin evaluar') +
    kpiCard('kpi-naranja', ICO_ACTIVO, abiertos.filter(function(t){ return etapaTnc(t) > 0; }).length, 'En evaluación o decididos') +
    kpiCard('kpi-verde', ICO_RESIST, trabajosNoConformes.filter(function(t){ return t.estado === 'Cerrado'; }).length, 'Cerrados') +
    kpiCard('kpi-negro', ICO_DISENO, trabajosNoConformes.filter(function(t){ return t.alerta && t.estado !== 'Cerrado'; }).length, 'Alertas de CV');
  var q = normalizar(tncFiltro.texto);
  var lista = trabajosNoConformes.filter(function(t){
    if(tncFiltro.estado && ETAPAS_TNC[etapaTnc(t)] !== tncFiltro.estado) return false;
    if(tncFiltro.caso && t.tipo !== tncFiltro.caso) return false;
    if(q && normalizar(t.codigo + ' ' + (t.codigos || []).join(' ') + ' ' + t.detalle + ' ' + (t.proyecto || '')).indexOf(q) === -1) return false;
    return true;
  });
  document.getElementById('tnc-cuerpo').innerHTML = lista.length ? '<div class="table-scroll"><table class="data-table"><thead><tr><th>Código</th><th>Fecha</th><th>Caso</th><th>Origen</th><th>Afecta a</th><th>Proyecto</th><th>Responsable</th><th>Días</th><th>Estado</th><th></th></tr></thead><tbody>' + lista.map(function(t){
    var e = etapaTnc(t);
    return '<tr><td class="mono"><b>' + esc(t.codigo) + '</b></td><td>' + new Date(t.creado_en).toLocaleDateString('es-PE') + '</td><td>' + esc(TIPOS_TNC[t.tipo] || t.tipo) + (t.alerta ? ' <span class="fase-chip">alerta</span>' : '') + '</td>' +
      '<td>' + (t.origen === 'manual' ? 'Manual' : 'Automático') + '</td><td class="mono">' + esc((t.codigos || []).slice(0, 4).join(', ') + ((t.codigos || []).length > 4 ? ' +' + (t.codigos.length - 4) : '')) + (t.edad ? ' · ' + t.edad + ' d' : '') + '</td>' +
      '<td>' + esc(t.proyecto || '—') + '</td><td>' + esc(t.evaluacion ? nombreDe(t.evaluacion.responsable_id) : '—') + '</td><td>' + diasAbierto(t) + '</td>' +
      '<td><span class="tnc-estado e' + e + '">' + ETAPAS_TNC[e] + '</span>' + (t.decision ? '<div class="nota-sm">' + esc(DECISIONES_TNC[t.decision.tipo]) + '</div>' : '') + '</td>' +
      '<td><button class="btn-add ghost" data-tnc-abrir="' + esc(t.id) + '">Abrir</button></td></tr>';
  }).join('') + '</tbody></table></div>' : '<div class="empty-note">Sin registros.</div>';
}
renderTncPanel = renderTnc;
var tncAbiertoId = null;
function abrirTnc(id){
  tncAbiertoId = id;
  if(!document.getElementById('tnc-modal')){
    document.body.insertAdjacentHTML('beforeend', '<div id="tnc-modal" class="sid-modal"><div class="modal-card wide"><div class="modal-header"><h3 id="tnc-modal-titulo"></h3><button class="modal-close" data-close="tnc-modal">×</button></div><div class="modal-body" id="tnc-modal-body"></div><div class="modal-actions" id="tnc-modal-acc"></div></div></div>');
    document.getElementById('tnc-modal').addEventListener('click', accionTnc);
  }
  renderTncDetalle();
  abrirModal('tnc-modal');
}
function renderTncDetalle(){
  var t = trabajosNoConformes.filter(function(x){ return x.id === tncAbiertoId; })[0];
  if(!t) return;
  var e = etapaTnc(t), gestiona = can('tnc:cerrar'), cerrado = t.estado === 'Cerrado';
  document.getElementById('tnc-modal-titulo').textContent = t.codigo + ' · ' + (TIPOS_TNC[t.tipo] || t.tipo);
  var paso = function(i, titulo, contenido){ return '<div class="tnc-paso' + (i < e || cerrado ? ' hecho' : i === e ? ' actual' : '') + '"><div class="tnc-paso-cab"><span>' + (i < e || cerrado ? '✓' : i + 1) + '</span><b>' + titulo + '</b></div>' + contenido + '</div>'; };
  var ev = t.evaluacion, de = t.decision;
  document.getElementById('tnc-modal-body').innerHTML =
    '<ol class="flujo-linea tnc-linea">' + ETAPAS_TNC.map(function(x, i){ return '<li class="' + (i < e || cerrado ? 'hecho' : i === e ? 'actual' : '') + '"><span class="fl-num">' + (i < e || cerrado ? '✓' : i + 1) + '</span><span class="fl-nombre">' + x + '</span></li>'; }).join('') + '</ol>' +
    paso(0, 'Se abre', '<p>' + esc(t.detalle) + '</p><p class="nota-sm">' + (t.origen === 'manual' ? 'Reportado por ' + esc(nombreDe(t.creado_por) || '') : 'Automático') + ' · ' + new Date(t.creado_en).toLocaleString('es-PE') + ' · Afecta a: <b class="mono">' + esc((t.codigos || []).join(', ') || '—') + '</b></p>') +
    paso(1, 'Se evalúa', ev ? '<p><b>' + esc(nombreDe(ev.responsable_id)) + '</b> · ' + new Date(ev.en).toLocaleDateString('es-PE') + '</p><p>' + esc(ev.causa) + '</p>'
      : (gestiona && !cerrado ? '<div class="pred-form"><div class="pp-field"><label>Responsable</label><select id="tnc-resp">' + opcionesUsuariosHtml(usuarioActual.id) + '</select></div><div class="pp-field span-2"><label>Análisis de la causa</label><textarea id="tnc-causa" rows="2"></textarea></div></div>' : '<p class="nota-sm">Pendiente.</p>')) +
    paso(2, 'Se decide', de ? '<p><b>' + esc(DECISIONES_TNC[de.tipo]) + '</b> · ' + esc(nombreDe(de.por)) + '</p>' + (de.nota ? '<p>' + esc(de.nota) + '</p>' : '')
      : (gestiona && ev && !cerrado ? '<div class="tnc-decisiones">' + Object.keys(DECISIONES_TNC).map(function(k){ return '<label class="pp-check-inline"><input type="radio" name="tnc-dec" value="' + k + '"> ' + DECISIONES_TNC[k] + '</label>'; }).join('') + '</div><div class="pp-field"><label>Nota</label><textarea id="tnc-nota" rows="2"></textarea></div>' : '<p class="nota-sm">Pendiente.</p>')) +
    paso(3, 'Se cierra', t.cierre ? '<p>' + esc(nombreDe(t.cierre.por)) + ' · ' + new Date(t.cierre.en).toLocaleString('es-PE') + '</p>' : '<p class="nota-sm">Pendiente.</p>');
  var acc = '';
  if(gestiona && !cerrado){
    if(!ev) acc = '<button class="btn-add" data-tnc-acc="evaluar">Registrar evaluación</button>';
    else if(!de) acc = '<button class="btn-add" data-tnc-acc="decidir">Registrar decisión</button>';
    else acc = '<button class="btn-add verde" data-tnc-acc="cerrar">Cerrar</button>';
  }
  document.getElementById('tnc-modal-acc').innerHTML = acc + '<button class="btn-add ghost" data-close="tnc-modal">Salir</button>';
}
function cargasDeTnc(t){ return roturaCargas.filter(function(c){ return t.carga_id ? c.id === t.carga_id : (t.codigos || []).indexOf(c.codigo) > -1 && c.estado === 'completado'; }); }
function accionTnc(e){
  var b = e.target.closest('[data-tnc-acc]');
  if(!b) return;
  var t = trabajosNoConformes.filter(function(x){ return x.id === tncAbiertoId; })[0];
  if(!t || !exigir('tnc:cerrar', 'Solo un responsable evalúa, decide y cierra')) return;
  var ahora = new Date().toISOString(), yo = usuarioActual.id;
  if(b.dataset.tncAcc === 'evaluar'){
    var causa = document.getElementById('tnc-causa').value.trim();
    if(causa.length < 5){ toast('Describí la causa'); return; }
    t.evaluacion = {responsable_id:document.getElementById('tnc-resp').value, causa:causa, por:yo, en:ahora};
    t.estado = 'En evaluación';
    registrarHistorial('Evaluó', 'Trabajo no conforme', t.codigo + ' · ' + causa, {codigo:t.codigo, ref:t.id, proyecto:t.proyecto, despues:{estado:'En evaluación'}});
  } else if(b.dataset.tncAcc === 'decidir'){
    var dec = (document.querySelector('input[name="tnc-dec"]:checked') || {}).value;
    var nota = document.getElementById('tnc-nota').value.trim();
    if(!dec){ toast('Elegí la decisión'); return; }
    if(dec === 'aceptar' && !nota){ toast('Aceptar requiere una nota (aparece en el informe)'); return; }
    var afectadas = cargasDeTnc(t);
    if(dec === 'anular' || dec === 'repetir') afectadas.forEach(function(c){ c.excluida = true; c.excluida_por = t.codigo; });
    if(dec === 'repetir') afectadas.forEach(function(c){
      var r = JSON.parse(JSON.stringify(c));
      ['horaEnsayo','a1','a2','a3','m1kN','m2kN','m3kN','m1kg','m2kg','m3kg','tipoRoturaM1','tipoRoturaM2','tipoRoturaM3','evid1','evid2','evid3','m1kgcm2','m2kgcm2','m3kgcm2','promedio','coefVar','desvest','comentarios','fechaEnsayoReal','equipo','contexto','fueraVentana','excluida','excluida_por'].forEach(function(k){ delete r[k]; });
      Object.assign(r, {id:nextRoturaId(), estado:'pendiente', repeticion:true, repeticion_de:c.id, origen:'repeticion', comentarios:'Repetición por ' + t.codigo});
      roturaCargas.push(r);
    });
    if(dec === 'aceptar') afectadas.forEach(function(c){ c.nota_tnc = t.codigo + ': ' + nota; });
    saveRoturaCargas();
    t.decision = {tipo:dec, nota:nota, por:yo, en:ahora};
    registrarHistorial('Decidió', 'Trabajo no conforme', t.codigo + ' · ' + DECISIONES_TNC[dec] + (afectadas.length ? ' · ' + afectadas.length + ' resultado(s)' : '') + (nota ? ' · ' + nota : ''), {codigo:t.codigo, ref:t.id, proyecto:t.proyecto, despues:{decision:DECISIONES_TNC[dec]}});
  } else if(b.dataset.tncAcc === 'cerrar'){
    t.cierre = {por:yo, en:ahora};
    t.estado = 'Cerrado';
    registrarHistorial('Cerró', 'Trabajo no conforme', t.codigo, {codigo:t.codigo, ref:t.id, proyecto:t.proyecto, despues:{estado:'Cerrado'}});
  }
  saveTnc();
  renderTncDetalle();
  renderTnc();
  if(typeof refrescarTodoFlujo === 'function') refrescarTodoFlujo();
}
/* [Reportar]: probeta perdida, mal etiquetada o dañada, receta cambiada sin registrarse */
function abrirReportarTnc(){
  if(!exigir('tnc:reportar')) return;
  if(!document.getElementById('tncr-modal')){
    document.body.insertAdjacentHTML('beforeend', '<div id="tncr-modal" class="sid-modal"><div class="modal-card"><div class="modal-header"><h3>Reportar trabajo no conforme</h3><button class="modal-close" data-close="tncr-modal">×</button></div><div class="modal-body" id="tncr-body"></div>' +
      '<div class="modal-actions"><button class="btn-add" id="tncr-ok">Reportar</button><button class="btn-add ghost" data-close="tncr-modal">Cancelar</button></div></div></div>');
    document.getElementById('tncr-ok').addEventListener('click', guardarReporteTnc);
  }
  var codigos = {}; roturaCargas.forEach(function(c){ if(c.codigo) codigos[c.codigo] = c.proyecto || ''; });
  document.getElementById('tncr-body').innerHTML = '<div class="pred-form">' +
    '<div class="pp-field span-2"><label>Caso</label><select id="tncr-caso">' + Object.keys(CASOS_MANUALES).map(function(k){ return '<option value="' + k + '">' + CASOS_MANUALES[k] + '</option>'; }).join('') + '</select></div>' +
    '<div class="pp-field span-2"><label>Códigos afectados</label><input id="tncr-codigos" list="tncr-lista" placeholder="ID-0026, ID-0027"><datalist id="tncr-lista">' + Object.keys(codigos).sort().map(function(c){ return '<option value="' + esc(c) + '">'; }).join('') + '</datalist></div>' +
    '<div class="pp-field span-2"><label>Detalle</label><textarea id="tncr-detalle" rows="3"></textarea></div></div>';
  abrirModal('tncr-modal');
}
function guardarReporteTnc(){
  var caso = document.getElementById('tncr-caso').value;
  var cods = document.getElementById('tncr-codigos').value.split(/[,;\s]+/).map(function(x){ return x.trim().toUpperCase(); }).filter(Boolean);
  var detalle = document.getElementById('tncr-detalle').value.trim();
  if(!detalle){ toast('Describí lo ocurrido'); return; }
  var desconocidos = cods.filter(function(c){ return !roturaCargas.some(function(x){ return x.codigo === c; }); });
  if(desconocidos.length){ toast('No existe: ' + desconocidos.join(', ')); return; }
  var primero = roturaCargas.filter(function(x){ return x.codigo === cods[0]; })[0];
  var t = {id:Lab.idNuevo('tnc'), codigo:siguienteCodigoTnc(), tipo:caso, origen:'manual', alerta:false, estado:'Abierto', codigos:cods, proyecto:primero ? primero.proyecto : '', diseno:primero ? primero.disenoCodigoDiseno : '',
    detalle:detalle, creado_en:new Date().toISOString(), creado_por:usuarioActual.id};
  trabajosNoConformes.unshift(t);
  saveTnc();
  registrarHistorial('Reportó', 'Trabajo no conforme', t.codigo + ' · ' + CASOS_MANUALES[caso] + ' · ' + (cods.join(', ') || '—'), {codigo:t.codigo, ref:t.id, proyecto:t.proyecto});
  if(typeof encolarCorreo === 'function'){ var f = t.proyecto ? fichaDeProyecto(t.proyecto) : null; (f && f.responsable_id ? [f.responsable_id] : lideres()).forEach(function(id){ encolarCorreo(id, 'Trabajo no conforme', t.codigo + ' · ' + CASOS_MANUALES[caso], [detalle, 'Códigos: ' + (cods.join(', ') || '—')], '#no-conforme'); }); }
  cerrarModal('tncr-modal');
  toast(t.codigo + ' reportado');
  renderTnc();
}
document.addEventListener('click', function(e){
  if(e.target.closest('#tnc-reportar')){ abrirReportarTnc(); return; }
  var a = e.target.closest('[data-tnc-abrir]');
  if(a) abrirTnc(a.dataset.tncAbrir);
});

/* ================= RESULTADOS ANULADOS Y REPETICIONES ================= */
/* Un resultado anulado (o repetido) por un trabajo no conforme no entra al promedio ni al RR */
var _resistenciaPorEdadBase = resistenciaPorEdad;
resistenciaPorEdad = function(d){
  var ex = roturaCargas.filter(function(c){ return c.excluida && c.disenoCodigoDiseno === d.codigo; });
  if(!ex.length) return _resistenciaPorEdadBase(d);
  var porDia = {};
  cargasDeDiseno(d).forEach(function(c){ if(c.excluida) return; var v = valoresKgCm2(c); if(v.length) (porDia[c.dia] = porDia[c.dia] || []).push.apply(porDia[c.dia], v); });
  var out = {}; Object.keys(porDia).forEach(function(k){ out[k] = promedio(porDia[k]); }); return out;
};
nombreUnificadoPromedio = function(d){
  var porEdad = {};
  (d.replicaObjs || []).forEach(function(rep){
    cargasDeReplica(rep.nombre).forEach(function(c){
      if(c.excluida) return;
      porEdad[c.dia] = porEdad[c.dia] || [];
      [c.m1kgcm2, c.m2kgcm2, c.m3kgcm2].forEach(function(v){ if(v) porEdad[c.dia].push(Number(v)); });
    });
  });
  var out = {}; Object.keys(porEdad).forEach(function(dia){ if(porEdad[dia].length) out[dia] = statsFromValues(porEdad[dia]); }); return out;
};
promedioReplicaEdad = function(d, rep, dia){
  var cs = cargasDeDiseno(d).filter(function(c){ return c.replicaNombre === rep.nombre && Number(c.dia) === Number(dia) && c.estado === 'completado' && !c.excluida; });
  return cs.length ? cs[cs.length - 1].promedio : '';
};
/* La repetición se registra cuando se pueda: no tiene ventana ni abre otro no conforme por estar fuera de ella */
var _cargaAtrasadaBase = cargaAtrasada, _cargaActivaBase = cargaActiva, _ventanaBase = ventanaDeCarga;
cargaAtrasada = function(c){ return c.repeticion ? false : _cargaAtrasadaBase(c); };
cargaActiva = function(c){ return c.repeticion ? true : _cargaActivaBase(c); };
evaluarRoturaCompletada = (function(base){ return function(c){ return c.repeticion ? (parseFloat(c.coefVar) > cvAlerta() ? base(Object.assign({}, c, {horaEnsayo:''})) : []) : base(c); }; })(evaluarRoturaCompletada);
/* Nota de "aceptar con nota" en los comentarios del RR */
valoresDeDiseno = (function(base){ return function(d, repIdx){
  var v = base(d, repIdx);
  var notas = cargasDeDiseno(d).filter(function(c){ return c.nota_tnc && (repIdx === null || repIdx === undefined || c.replicaNombre === (d.replicaObjs[repIdx] || {}).nombre); }).map(function(c){ return c.nota_tnc; });
  if(notas.length) v.comentarios = (v.comentarios && v.comentarios !== '-' ? v.comentarios + ' / ' : '') + notas.filter(function(x, i, a){ return a.indexOf(x) === i; }).join(' / ');
  return v;
}; })(valoresDeDiseno);

PANEL_HOOKS['no-conforme'] = renderTnc;
PANEL_HOOKS.documentos = renderDocumentos;
