/* Sistema I+D — Fase 4: los registros del laboratorio viven en el servidor (un dato, un lugar).
   Diseños, roturas, lotes de agregado, informes, trabajos no conformes y el correlativo de códigos.
   · Cada vez que se guarda una de estas listas, se envía solo lo que cambió (por lotes, con la cola de reintentos de Nube).
   · Al ingresar se baja lo que hay en el servidor; lo que existe solo en este navegador se sube.
   · Nada se borra: lo anulado viaja con anulado = true y su motivo.
   Sin servidor configurado no hace nada (modo local). */
'use strict';

var Sync = (function(){
  var MAPA = {
    'sid10_disenos': {col:'disenos', id:function(d){ return d.codigo; }},
    'sid_disenos_anulados': {col:'disenos', id:function(d){ return d.codigo; }, anulado:true},
    'sid10_rotura_cargas': {col:'roturas', id:function(c){ return c.id; }},
    'sid_roturas_anuladas': {col:'roturas', id:function(c){ return c.id; }, anulado:true},
    'sid_lotes_agregado': {col:'lotes', id:function(l){ return l.id; }},
    'sid10_rr': {col:'informes', id:function(r){ return r.id; }},
    'sid_informes_finales': {col:'informes', id:function(r){ return r.id; }},
    'sid_tnc': {col:'tnc', id:function(t){ return t.id; }},
    'sid10_codigo_counters': {col:'contadores', unico:'codigos'},
    'sid_planes': {col:'planes', id:function(p){ return p.id; }},
    'sid_actividades': {col:'actividades', id:function(a){ return a.id; }},
    'sid_correos': {col:'correos', id:function(c){ return c.id; }},
    'sid_semanas_publicadas': {col:'semanas', unico:'publicadas'},
    'sid_poza': {col:'poza', id:function(l){ return l.id; }}
  };
  var snap = load('sid_sync_snap', {});
  var pausado = false;
  var LOTE = 100;

  function hash(s){ var h = 5381; for(var i = 0; i < s.length; i++){ h = ((h << 5) + h + s.charCodeAt(i)) | 0; } return s.length + ':' + h; }
  function documentos(clave, valor){
    var m = MAPA[clave];
    if(m.unico) return [{id:m.unico, datos:Object.assign({id:m.unico}, valor), anulado:false}];
    return (valor || []).map(function(doc){ return {id:String(m.id(doc)), datos:doc, anulado:!!m.anulado}; }).filter(function(x){ return x.id && x.id !== 'undefined'; });
  }
  function activa(){ return Nube.activa() && Nube.tieneToken() && typeof usuarioActual !== 'undefined' && !!usuarioActual; }
  function enviar(items){
    if(!items.length) return Promise.resolve(true);
    var lotes = [];
    for(var i = 0; i < items.length; i += LOTE) lotes.push(items.slice(i, i + LOTE));
    return lotes.reduce(function(p, lote){
      return p.then(function(){
        return Nube.enviar('POST', '/api/registros', {items:lote.map(function(x){ return {coleccion:x.col, id:x.id, datos:x.datos, anulado:x.anulado}; })})
          .then(function(){ lote.forEach(function(x){ snap[x.col + '/' + x.id] = x.h; }); save('sid_sync_snap', snap); })
          .catch(function(){ /* rechazo del servidor: ya se avisó; el registro sigue marcado como pendiente */ });
      });
    }, Promise.resolve()).then(function(){ return true; });
  }
  function cambios(clave, valor){
    var m = MAPA[clave];
    return documentos(clave, valor).map(function(x){
      var doc = x.anulado ? Object.assign({}, x.datos, {anulado:true}) : x.datos;
      var h = hash(JSON.stringify(doc) + (x.anulado ? '#a' : ''));
      return {col:m.col, id:x.id, datos:doc, anulado:x.anulado, h:h};
    }).filter(function(x){ return snap[x.col + '/' + x.id] !== x.h; });
  }
  /* Se llama desde save(): solo actúa sobre las listas del laboratorio */
  function alGuardar(clave, valor){
    if(pausado || !MAPA[clave] || !activa()) return;
    enviar(cambios(clave, valor));
  }
  function mezclar(locales, remotos, idDe){
    var porId = {};
    locales.forEach(function(d){ porId[idDe(d)] = d; });
    remotos.forEach(function(d){ porId[idDe(d)] = d; });
    return Object.keys(porId).map(function(k){ return porId[k]; });
  }
  /* Al ingresar: lo del servidor manda; lo que solo está acá se sube */
  function descargar(){
    if(!activa()) return Promise.resolve(false);
    return Nube.pedir('GET', '/api/registros').then(function(r){
      var c = r.colecciones || {};
      pausado = true;
      try{
        var porCodigo = function(d){ return d.codigo; }, porIdF = function(d){ return d.id; };
        var dis = mezclar(disenos.concat(disenosAnulados.map(function(d){ return Object.assign({}, d, {anulado:true}); })), c.disenos || [], porCodigo);
        disenos = dis.filter(function(d){ return !d.anulado; });
        disenosAnulados = dis.filter(function(d){ return d.anulado; });
        var ro = mezclar(roturaCargas.concat(roturasAnuladas.map(function(x){ return Object.assign({}, x, {anulado:true}); })), c.roturas || [], porIdF);
        roturaCargas = ro.filter(function(x){ return !x.anulado; });
        roturasAnuladas = ro.filter(function(x){ return x.anulado; });
        lotesAgregado = mezclar(lotesAgregado, c.lotes || [], porIdF);
        var inf = mezclar(rrEstudios.concat(informesFinales), c.informes || [], porIdF);
        rrEstudios = inf.filter(function(e){ return e.tipo !== 'final'; });
        informesFinales = inf.filter(function(e){ return e.tipo === 'final'; });
        trabajosNoConformes = mezclar(trabajosNoConformes, c.tnc || [], porIdF).sort(function(a,b){ return (b.creado_en || '').localeCompare(a.creado_en || ''); });
        planesTrabajo = mezclar(planesTrabajo, c.planes || [], porIdF);
        lecturasPoza = mezclar(lecturasPoza, c.poza || [], porIdF);
        actividades = mezclar(actividades, c.actividades || [], porIdF);
        correos = mezclar(correos, c.correos || [], porIdF).sort(function(a,b){ return (b.creado_en || '').localeCompare(a.creado_en || ''); });
        var sp = Object.assign({}, (c.semanas || [])[0] || {}); delete sp.id;
        semanasPublicadas = Object.assign({}, semanasPublicadas, sp);
        var cont = (c.contadores || [])[0] || {};
        CODIGO_COUNTERS = {Probetas:Math.max(CODIGO_COUNTERS.Probetas || 0, cont.Probetas || 0), Cubos:Math.max(CODIGO_COUNTERS.Cubos || 0, cont.Cubos || 0)};
        // Lo que vino del servidor queda marcado como ya sincronizado
        [['disenos', c.disenos, porCodigo], ['roturas', c.roturas, porIdF], ['lotes', c.lotes, porIdF], ['informes', c.informes, porIdF], ['tnc', c.tnc, porIdF], ['planes', c.planes, porIdF], ['actividades', c.actividades, porIdF], ['correos', c.correos, porIdF], ['poza', c.poza, porIdF]].forEach(function(t){
          (t[1] || []).forEach(function(doc){ snap[t[0] + '/' + t[2](doc)] = hash(JSON.stringify(doc) + (doc.anulado ? '#a' : '')); });
        });
      } finally { pausado = false; }
      save('sid_sync_snap', snap);
      // Guardar localmente sube lo que el servidor todavía no tiene
      save('sid10_disenos', disenos); save('sid_disenos_anulados', disenosAnulados);
      save('sid10_rotura_cargas', roturaCargas); save('sid_roturas_anuladas', roturasAnuladas);
      save('sid_lotes_agregado', lotesAgregado); save('sid10_rr', rrEstudios); save('sid_informes_finales', informesFinales); save('sid_tnc', trabajosNoConformes);
      save('sid10_codigo_counters', CODIGO_COUNTERS);
      save('sid_planes', planesTrabajo); save('sid_actividades', actividades); save('sid_correos', correos); save('sid_semanas_publicadas', semanasPublicadas); save('sid_poza', lecturasPoza);
      if(typeof refrescarTodoFlujo === 'function') refrescarTodoFlujo();
      if(typeof renderRRStudyList === 'function'){ renderRRStudyList(); renderRRDetail(); }
      return true;
    }).catch(function(e){ if(!e.red) toast('No se pudieron leer los registros del servidor: ' + e.mensaje); return false; });
  }
  function pendientes(){
    var n = 0;
    Object.keys(MAPA).forEach(function(k){ n += cambios(k, load(k, MAPA[k].unico ? {} : [])).length; });
    return n;
  }
  return {alGuardar:alGuardar, descargar:descargar, pendientes:pendientes, colecciones:MAPA};
})();
window.alGuardar = Sync.alGuardar;
