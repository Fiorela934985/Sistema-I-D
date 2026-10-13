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
