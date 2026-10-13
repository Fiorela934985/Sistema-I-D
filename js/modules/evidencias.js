/* Sistema I+D — Evidencias fotográficas (IndexedDB) */
'use strict';

/* ================= EVIDENCIAS (IndexedDB — persisten al recargar) ================= */
var EVID_DB_NAME = 'sid10_files';
var EVID_STORE = 'evidencias';
var evidDbPromise = null;
function openEvidDB(){
  if(evidDbPromise) return evidDbPromise;
  evidDbPromise = new Promise(function(resolve, reject){
    if(!window.indexedDB){ reject(new Error('IndexedDB no disponible')); return; }
    var req = indexedDB.open(EVID_DB_NAME, 1);
    req.onupgradeneeded = function(e){ e.target.result.createObjectStore(EVID_STORE); };
    req.onsuccess = function(e){ resolve(e.target.result); };
    req.onerror = function(e){ reject(e.target.error); };
  });
  return evidDbPromise;
}
function saveEvidenciaBlob(key, blob){
  return openEvidDB().then(function(db){
    return new Promise(function(resolve, reject){
      var tx = db.transaction(EVID_STORE, 'readwrite');
      tx.objectStore(EVID_STORE).put(blob, key);
      tx.oncomplete = function(){ resolve(key); };
      tx.onerror = function(e){ reject(e.target.error); };
    });
  });
}
function loadEvidenciaURL(key){
  return openEvidDB().then(function(db){
    return new Promise(function(resolve, reject){
      var tx = db.transaction(EVID_STORE, 'readonly');
      var req = tx.objectStore(EVID_STORE).get(key);
      req.onsuccess = function(){ resolve(req.result ? URL.createObjectURL(req.result) : null); };
      req.onerror = function(e){ reject(e.target.error); };
    });
  });
}
function deleteEvidencia(key){
  return openEvidDB().then(function(db){
    return new Promise(function(resolve){
      var tx = db.transaction(EVID_STORE, 'readwrite');
      tx.objectStore(EVID_STORE).delete(key);
      tx.oncomplete = function(){ resolve(); };
    });
  });
}

/* ================= ÍNDICE DE EVIDENCIAS (categorizadas por sección y diseño) =================
   El archivo de la foto vive en IndexedDB; acá se guarda a qué proyecto, diseño y sección pertenece,
   para que nunca se pierda la ruta y se pueda consultar desde el expediente del proyecto. */
var SECCIONES_EVIDENCIA = ['Dosificación', 'Elaboración de mezcla', 'Estado fresco', 'Rotura', 'Resultados', 'Otros'];
var evidenciasIdx = load('sid_evidencias', []);
function saveEvidenciasIdx(){ save('sid_evidencias', evidenciasIdx); }
function indexarEvidencia(meta){
  var existente = evidenciasIdx.filter(function(e){ return e.key === meta.key; })[0];
  if(existente){ Object.assign(existente, meta); }
  else {
    evidenciasIdx.unshift(Object.assign({ts: Date.now(), usuario: usuarioActual ? usuarioActual.usuario : ''}, meta));
  }
  saveEvidenciasIdx();
}
function quitarEvidencia(key){
  evidenciasIdx = evidenciasIdx.filter(function(e){ return e.key !== key; });
  saveEvidenciasIdx();
  roturaCargas.forEach(function(c){ [1,2,3].forEach(function(m){ if(c['evid'+m] === key) c['evid'+m] = ''; }); });
  saveRoturaCargas();
  return deleteEvidencia(key).catch(function(){});
}
/* Las fotos que se suben al registrar una rotura se indexan automáticamente en la sección "Rotura". */
function sincronizarEvidenciasRoturas(){
  var vigentes = {};
  roturaCargas.forEach(function(c){
    [1,2,3].forEach(function(m){
      var key = c['evid'+m];
      if(!key) return;
      vigentes[key] = true;
      var d = disenos.filter(function(x){ return x.codigo === c.disenoCodigoDiseno; })[0];
      var ya = evidenciasIdx.filter(function(e){ return e.key === key; })[0];
      var meta = {key:key, origen:'rotura', roturaId:c.id, seccion:'Rotura',
        proyecto: c.proyecto || (d ? proyectoNombre(d.proyectoId) : ''),
        disenoCodigo: c.disenoCodigoDiseno, disenoNombre: d ? diseñoTitulo(d) : c.producto,
        descripcion: c.codigo + ' · ' + c.replicaNombre + ' · día ' + c.dia + ' · M' + m};
      if(ya) Object.assign(ya, meta); else evidenciasIdx.unshift(Object.assign({ts: Date.now(), usuario: ''}, meta));
    });
  });
  evidenciasIdx = evidenciasIdx.filter(function(e){ return e.origen !== 'rotura' || vigentes[e.key]; });
  saveEvidenciasIdx();
}
function evidenciasDeProyecto(nombre){ return evidenciasIdx.filter(function(e){ return e.proyecto === nombre; }); }

/* ---- Modal: subir evidencia manual ---- */
var evidenciaModalProyecto = null;
var evidenciaModalCallback = null;
function abrirModalEvidencia(proyecto, disenoCodigo, callback){
  if(!exigir('evidencias:subir')) return;
  evidenciaModalProyecto = proyecto;
  evidenciaModalCallback = callback || null;
  var lista = disenos.filter(function(d){ return !proyecto || proyectoNombre(d.proyectoId) === proyecto; });
  document.getElementById('ev-diseno').innerHTML = '<option value="">General del proyecto</option>' + lista.map(function(d){
    return '<option value="'+esc(d.codigo)+'"'+(d.codigo===disenoCodigo?' selected':'')+'>'+esc(d.codigo+' · '+diseñoTitulo(d))+'</option>';
  }).join('');
  document.getElementById('ev-seccion').innerHTML = SECCIONES_EVIDENCIA.filter(function(s){ return s !== 'Rotura'; })
    .map(function(s){ return '<option>'+s+'</option>'; }).join('');
  document.getElementById('ev-descripcion').value = '';
  document.getElementById('ev-archivos').value = '';
  abrirModal('evidencia-modal');
}
document.getElementById('ev-guardar').addEventListener('click', function(){
  var archivos = Array.prototype.slice.call(document.getElementById('ev-archivos').files || []);
  if(!archivos.length){ toast('Elegí al menos una foto'); return; }
  var codigo = document.getElementById('ev-diseno').value;
  var d = codigo ? disenos.filter(function(x){ return x.codigo === codigo; })[0] : null;
  var seccion = document.getElementById('ev-seccion').value;
  var descripcion = document.getElementById('ev-descripcion').value.trim();
  var proyecto = evidenciaModalProyecto || (d ? proyectoNombre(d.proyectoId) : '');
  var promesas = archivos.map(function(file, i){
    var key = 'ev' + Date.now() + '_' + i + '_' + Math.floor(Math.random()*1000);
    return saveEvidenciaBlob(key, file).then(function(){
      indexarEvidencia({key:key, origen:'manual', seccion:seccion, proyecto:proyecto,
        disenoCodigo: d ? d.codigo : '', disenoNombre: d ? diseñoTitulo(d) : '', descripcion: descripcion || file.name});
    });
  });
  Promise.all(promesas).then(function(){
    registrarHistorial('Subió', 'Evidencia', archivos.length + ' foto(s) · ' + seccion + (d ? ' · ' + diseñoTitulo(d) : ''), {proyecto:proyecto});
    cerrarModal('evidencia-modal');
    toast(archivos.length === 1 ? 'Evidencia guardada' : archivos.length + ' evidencias guardadas');
    if(evidenciaModalCallback) evidenciaModalCallback();
  }).catch(function(){ toast('No se pudo guardar la evidencia en este navegador'); });
});

/* ---- Galería reutilizable (expediente) ---- */
function galeriaEvidenciasHtml(lista){
  if(!lista.length) return '<div class="empty-note">Todavía no hay evidencias para este proyecto.</div>';
  var porSeccion = {};
  lista.forEach(function(e){ (porSeccion[e.seccion] = porSeccion[e.seccion] || []).push(e); });
  return SECCIONES_EVIDENCIA.filter(function(s){ return porSeccion[s]; }).map(function(s){
    return '<div class="ev-seccion"><h5>'+esc(s)+' <span>'+porSeccion[s].length+'</span></h5><div class="ev-grid">' +
      porSeccion[s].map(function(e){
        return '<figure class="ev-item" data-ev-key="'+esc(e.key)+'">' +
          '<div class="ev-thumb" data-ev-ver="'+esc(e.key)+'"><span>Cargando…</span></div>' +
          '<figcaption><b>'+esc(e.disenoNombre || 'General')+'</b><span>'+esc(e.descripcion||'')+'</span><span class="mono">'+fechaHora(e.ts)+(e.usuario?' · '+esc(e.usuario):'')+'</span></figcaption>' +
          '<button class="btn-icon danger ev-borrar" data-perm="evidencias:subir" data-ev-borrar="'+esc(e.key)+'" title="Borrar">×</button>' +
        '</figure>';
      }).join('') + '</div></div>';
  }).join('');
}
function cargarMiniaturas(contenedor){
  contenedor.querySelectorAll('[data-ev-ver]').forEach(function(el){
    loadEvidenciaURL(el.dataset.evVer).then(function(url){
      el.innerHTML = url ? '<img src="'+url+'" alt="Evidencia">' : '<span>Sin archivo en este equipo</span>';
      if(url) el.dataset.url = url;
    }).catch(function(){ el.innerHTML = '<span>No disponible</span>'; });
  });
}
function manejarClickGaleria(e, alBorrar){
  var ver = e.target.closest('[data-ev-ver]');
  if(ver && ver.dataset.url){
    var meta = evidenciasIdx.filter(function(x){ return x.key === ver.dataset.evVer; })[0] || {};
    document.getElementById('lightbox-img').src = ver.dataset.url;
    document.getElementById('lightbox-pie').textContent = [meta.seccion, meta.disenoNombre, meta.descripcion].filter(Boolean).join(' · ');
    abrirModal('lightbox');
    return true;
  }
  var borrar = e.target.closest('[data-ev-borrar]');
  if(borrar){
    if(!exigir('evidencias:subir')) return true;
    if(!confirm('¿Borrar esta evidencia? No se puede deshacer.')) return true;
    var meta2 = evidenciasIdx.filter(function(x){ return x.key === borrar.dataset.evBorrar; })[0] || {};
    quitarEvidencia(borrar.dataset.evBorrar).then(function(){
      registrarHistorial('Eliminó', 'Evidencia', [meta2.seccion, meta2.disenoNombre, meta2.descripcion].filter(Boolean).join(' · '), {proyecto: meta2.proyecto});
      toast('Evidencia borrada');
      if(alBorrar) alBorrar();
    });
    return true;
  }
  return false;
}
