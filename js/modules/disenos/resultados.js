/* Sistema I+D — Resultados de ensayo por réplica */
'use strict';

/* ================= RESULTADOS DE ENSAYO (por réplica) — resistencia jalada de Roturas por código ================= */
var SLUMP_ROWS = ["0'","30'","60'","90'","120'"];
var SLUMP_MINUTOS = [0, 30, 60, 90, 120];
var currentResultsDesign = null;
var currentResultsIndex = -1;

function emptyReplicaExtras(){
  return {
    contacto:'',
    tiempos:[0], // filas de la tabla de slump que se van a medir (a veces solo 0')
    slump: SLUMP_ROWS.map(function(){ return {hora:'', slump:'', tempc:'', tempa:''}; }),
    pesoUnitario:'', aire:'', thermoIni:'', thermoFin:'', cohesividad:'', apariencia:'',
    observaciones:''
  };
}
function cargasDeReplica(nombreReplica){
  return roturaCargas.filter(function(c){ return c.replicaNombre === nombreReplica; });
}
function resistTableHtmlFromRoturas(nombreReplica){
  var cargas = cargasDeReplica(nombreReplica).sort(function(a,b){ return a.dia-b.dia; });
  if(!cargas.length){
    return '<div class="table-scroll"><table class="resist-table"><thead><tr><th>Edad</th><th>Carga</th><th>kg/cm2</th></tr></thead>' +
      '<tbody><tr><td colspan="3" style="color:var(--text-muted);">Todavía no hay cargas registradas en Roturas para esta réplica.</td></tr></tbody></table></div>';
  }
  var rows = cargas.map(function(c){
    var cargaTxt = [c.m1kg,c.m2kg,c.m3kg].filter(function(v){return v;}).join(' / ') || [c.m1kN,c.m2kN,c.m3kN].filter(function(v){return v;}).join(' / ') || '-';
    return '<tr><td class="resist-readonly">'+c.dia+' d</td><td class="resist-readonly">'+cargaTxt+'</td><td class="resist-readonly">'+(c.promedio||'-')+'</td></tr>';
  }).join('');
  return '<div class="table-scroll"><table class="resist-table"><thead><tr><th>Edad</th><th>Carga</th><th>kg/cm2</th></tr></thead><tbody>'+rows+'</tbody></table></div>';
}

/* Filas que se miden: las elegidas, más las que ya tienen datos. */
function tiemposDeReplica(data){
  var t = Array.isArray(data.tiempos) ? data.tiempos.slice() : [0];
  (data.slump || []).forEach(function(row, r){ if(row && (row.hora || row.slump || row.tempc || row.tempa) && t.indexOf(r) === -1) t.push(r); });
  if(!t.length) t = [0];
  return t;
}
function btnAhora(attrs){ return '<button type="button" class="btn-ahora" data-perm="resultados:registrar" '+attrs+' title="Poner la hora actual">Ahora</button>'; }
function replicaBlockHtml(idx, nombreBase, data){
  var nombreReplica = nombreBase + '-R' + (idx+1);
  var tiempos = tiemposDeReplica(data);
  var chips = SLUMP_ROWS.map(function(label, r){
    return '<button type="button" class="chip-tiempo'+(tiempos.indexOf(r) > -1 ? ' on' : '')+'" data-tiempo="'+r+'" data-tiempo-r="'+idx+'">'+label+'</button>';
  }).join('');
  var slumpRows = SLUMP_ROWS.map(function(label, r){
    var row = data.slump[r] || {hora:'',slump:'',tempc:'',tempa:''};
    return '<tr data-fila-tiempo="'+r+'"'+(tiempos.indexOf(r) === -1 ? ' class="fila-oculta"' : '')+'><td><b>'+label+'</b></td>' +
      '<td><div class="hora-celda"><input type="text" data-rf="slump" data-r="'+idx+'" data-row="'+r+'" data-col="hora" value="'+esc(row.hora)+'" placeholder="hh:mm">'+btnAhora('data-ahora-fila="'+r+'" data-r="'+idx+'"')+'</div></td>' +
      '<td><input type="text" data-rf="slump" data-r="'+idx+'" data-row="'+r+'" data-col="slump" value="'+esc(row.slump)+'"></td>' +
      '<td><input type="text" data-rf="slump" data-r="'+idx+'" data-row="'+r+'" data-col="tempc" value="'+esc(row.tempc)+'"></td>' +
      '<td><input type="text" data-rf="slump" data-r="'+idx+'" data-row="'+r+'" data-col="tempa" value="'+esc(row.tempa)+'"></td>' +
      '<td class="cuenta-celda" data-cuenta="'+idx+'-'+r+'"></td>' +
    '</tr>';
  }).join('');
  var d = disenos.filter(function(x){ return x.replicaObjs && x.replicaObjs.some(function(r){ return r.nombre===nombreReplica; }); })[0];
  var sem = d ? semaforoDotHtml(semaforoDiseno(d)) : '';
  return '<div class="replica-block" data-replica="'+idx+'">' +
    '<div class="replica-head">'+sem+' '+esc(nombreReplica)+'</div>' +
    '<div class="replica-body">' +
      '<div class="replica-row"><label>Hora de contacto a/mc</label><div class="hora-celda"><input type="text" data-rf="contacto" data-r="'+idx+'" value="'+esc(data.contacto)+'" placeholder="hh:mm">'+btnAhora('data-ahora-contacto="'+idx+'"')+'</div></div>' +
      '<div class="replica-row"><label>Tiempos a medir</label><div class="chips-tiempo">'+chips+'</div></div>' +
      '<table class="slump-table"><thead><tr><th>Min</th><th>Hora</th><th>Slump ó Flow</th><th>Temp. C°</th><th>Temp. A°</th><th>Aviso</th></tr></thead><tbody>'+slumpRows+'</tbody></table>' +
      '<div class="replica-row"><label>Peso unitario</label><input type="text" data-rf="pesoUnitario" data-r="'+idx+'" value="'+esc(data.pesoUnitario)+'"></div>' +
      '<div class="replica-row"><label>Contenido de aire (%)</label><input type="text" data-rf="aire" data-r="'+idx+'" value="'+esc(data.aire)+'"></div>' +
      '<div class="replica-row"><label>Thermocrete — F. inicial</label><input type="text" data-rf="thermoIni" data-r="'+idx+'" value="'+esc(data.thermoIni)+'" placeholder="hh:mm"></div>' +
      '<div class="replica-row"><label>Thermocrete — F. final</label><input type="text" data-rf="thermoFin" data-r="'+idx+'" value="'+esc(data.thermoFin)+'" placeholder="hh:mm"></div>' +
      '<div class="replica-row"><label>Cohesividad</label><input type="text" data-rf="cohesividad" data-r="'+idx+'" value="'+esc(data.cohesividad)+'"></div>' +
      '<div class="replica-row"><label>Apariencia</label><input type="text" data-rf="apariencia" data-r="'+idx+'" value="'+esc(data.apariencia)+'"></div>' +
      '<label style="font-size:.72rem;font-weight:700;display:block;margin-bottom:6px;">Resistencia a la compresión</label>' +
      '<div class="resist-toolbar">' +
        '<button data-act="actualizar-resist" data-r="'+idx+'" data-replica="'+esc(nombreReplica)+'">Actualizar</button>' +
        '<span class="resist-hint">Desde Roturas</span>' +
      '</div>' +
      '<div data-resist-wrap="'+idx+'">'+resistTableHtmlFromRoturas(nombreReplica)+'</div>' +
      '<div class="replica-row"><label>Observaciones</label><textarea data-rf="observaciones" data-r="'+idx+'">'+esc(data.observaciones)+'</textarea></div>' +
    '</div>' +
  '</div>';
}

var resultsModalDirty = false;
function nombreUnificadoPromedio(d){
  // Combina TODOS los valores individuales kg/cm2 de TODAS las réplicas (no promedio de promedios), agrupado por edad.
  var porEdad = {};
  (d.replicaObjs||[]).forEach(function(rep){
    cargasDeReplica(rep.nombre).forEach(function(c){
      porEdad[c.dia] = porEdad[c.dia] || [];
      [c.m1kgcm2,c.m2kgcm2,c.m3kgcm2].forEach(function(v){ if(v) porEdad[c.dia].push(Number(v)); });
    });
  });
  var out = {};
  Object.keys(porEdad).forEach(function(dia){
    out[dia] = statsFromValues(porEdad[dia]);
  });
  return out;
}
function tablaPorReplicaHtml(d){
  var reps = d.replicaObjs || [];
  if(!reps.length) return '';
  var dias = {};
  var porReplicaDia = reps.map(function(rep){
    var mapa = {};
    cargasDeReplica(rep.nombre).forEach(function(c){ mapa[c.dia] = c.promedio || ''; dias[c.dia] = true; });
    return mapa;
  });
  var diasOrdenados = Object.keys(dias).map(Number).sort(function(a,b){return a-b;});
  if(!diasOrdenados.length) return '';
  var combinado = nombreUnificadoPromedio(d);
  var head = '<th>Edad</th>' + reps.map(function(rep){ return '<th>'+esc(rep.nombre.split('-').pop())+'</th>'; }).join('') + '<th>Promedio</th><th>Coef. Var.</th><th>Desvest.</th>';
  var rows = diasOrdenados.map(function(dia){
    var cells = porReplicaDia.map(function(mapa){ return '<td class="resist-readonly">'+(mapa[dia]||'-')+'</td>'; }).join('');
    var st = combinado[dia] || {};
    return '<tr><td class="resist-readonly">'+dia+' d</td>'+cells+'<td class="resist-readonly">'+(st.promedio||'-')+'</td><td class="resist-readonly">'+(st.coefVar||'-')+'</td><td class="resist-readonly">'+(st.desvest||'-')+'</td></tr>';
  }).join('');
  return '<div class="table-scroll"><table class="resist-table"><thead><tr>'+head+'</tr></thead><tbody>'+rows+'</tbody></table></div>';
}
function openResultsModal(d, i){
  currentResultsDesign = d;
  currentResultsIndex = i;
  resultsModalDirty = false;
  var numReplicas = (d.replicaObjs && d.replicaObjs.length) || d.replicas || 1;
  var existing = d.resultados && d.resultados.replicas || [];
  var nombre = diseñoTitulo(d);
  document.getElementById('results-modal-title').textContent = nombre;
  document.getElementById('results-modal-sub').textContent = d.codigo + (d.proyectoId ? (' · '+proyectoNombre(d.proyectoId)) : '');
  var body = '<div class="results-design-recap">'+mezclaTableHtml(d)+'</div><div class="results-section-label">2. Ensayos</div>';
  for(var r=0;r<numReplicas;r++){
    var data = existing[r] || emptyReplicaExtras();
    if(!data.slump) data = emptyReplicaExtras();
    body += replicaBlockHtml(r, nombre, data);
  }
  var tablaReplicas = tablaPorReplicaHtml(d);
  if(tablaReplicas){
    body += '<div class="results-section-label" style="margin-top:16px;">Resistencia por réplica y promedio combinado</div>' + tablaReplicas;
  }
  document.getElementById('results-modal-body').innerHTML = body;
  document.getElementById('results-modal').classList.add('show');
}
document.getElementById('results-modal-body').addEventListener('input', function(e){ if(e.target.dataset.rf) resultsModalDirty = true; });
document.getElementById('results-modal-body').addEventListener('change', function(e){ if(e.target.dataset.rf) resultsModalDirty = true; });
document.getElementById('results-modal-body').addEventListener('click', function(e){
  var btn = e.target.closest('[data-act="actualizar-resist"]');
  if(!btn) return;
  var wrap = document.querySelector('[data-resist-wrap="'+btn.dataset.r+'"]');
  wrap.innerHTML = resistTableHtmlFromRoturas(btn.dataset.replica);
  toast('Cargas actualizadas desde Roturas');
});
document.getElementById('results-modal-close').addEventListener('click', function(){ document.getElementById('results-modal').classList.remove('show'); });
document.getElementById('results-modal').addEventListener('click', function(e){ if(e.target.id === 'results-modal') document.getElementById('results-modal').classList.remove('show'); });
document.getElementById('results-print').addEventListener('click', function(){ window.print(); });

function collectResultsFromModal(nReplicas){
  var replicas = [];
  for(var r=0;r<nReplicas;r++){
    var data = emptyReplicaExtras();
    data.contacto = (document.querySelector('[data-rf="contacto"][data-r="'+r+'"]')||{}).value || '';
    data.tiempos = Array.prototype.map.call(document.querySelectorAll('[data-tiempo-r="'+r+'"].on'), function(b){ return Number(b.dataset.tiempo); });
    data.pesoUnitario = (document.querySelector('[data-rf="pesoUnitario"][data-r="'+r+'"]')||{}).value || '';
    data.aire = (document.querySelector('[data-rf="aire"][data-r="'+r+'"]')||{}).value || '';
    data.thermoIni = (document.querySelector('[data-rf="thermoIni"][data-r="'+r+'"]')||{}).value || '';
    data.thermoFin = (document.querySelector('[data-rf="thermoFin"][data-r="'+r+'"]')||{}).value || '';
    data.cohesividad = (document.querySelector('[data-rf="cohesividad"][data-r="'+r+'"]')||{}).value || '';
    data.apariencia = (document.querySelector('[data-rf="apariencia"][data-r="'+r+'"]')||{}).value || '';
    data.observaciones = (document.querySelector('[data-rf="observaciones"][data-r="'+r+'"]')||{}).value || '';
    data.slump = [];
    document.querySelectorAll('[data-rf="slump"][data-r="'+r+'"]').forEach(function(el){
      var row = Number(el.dataset.row);
      if(!data.slump[row]) data.slump[row] = {hora:'',slump:'',tempc:'',tempa:''};
      data.slump[row][el.dataset.col] = el.value;
    });
    replicas.push(data);
  }
  return replicas;
}
function registrarResultadosEnHistorial(d){
  registrarHistorial('Registró', 'Resultados', d.codigo + ' · ' + diseñoTitulo(d) + ' · estado ' + d.estado, {proyecto: proyectoNombre(d.proyectoId), ref: d.codigo});
}
document.getElementById('results-save').addEventListener('click', function(){
  if(!currentResultsDesign) return;
  if(!exigir('resultados:registrar')) return;
  var numReplicas = (currentResultsDesign.replicaObjs && currentResultsDesign.replicaObjs.length) || currentResultsDesign.replicas || 1;
  currentResultsDesign.resultados = { replicas: collectResultsFromModal(numReplicas) };
  currentResultsDesign.editedAt = Date.now();
  if(resultsModalDirty){
    document.getElementById('completos-confirm-modal').classList.add('show');
  } else {
    save('sid10_disenos', disenos);
    registrarResultadosEnHistorial(currentResultsDesign);
    document.getElementById('results-modal').classList.remove('show');
    toast('Resultados guardados');
    renderAllDesignViews();
  }
});
document.getElementById('completos-confirm-yes').addEventListener('click', function(){
  if(currentResultsDesign) currentResultsDesign.estado = 'Completado';
  save('sid10_disenos', disenos);
  if(currentResultsDesign) registrarResultadosEnHistorial(currentResultsDesign);
  document.getElementById('completos-confirm-modal').classList.remove('show');
  document.getElementById('results-modal').classList.remove('show');
  toast('Resultados guardados — diseño Completado');
  renderAllDesignViews();
});
document.getElementById('completos-confirm-no').addEventListener('click', function(){
  if(currentResultsDesign) currentResultsDesign.estado = 'En desarrollo';
  save('sid10_disenos', disenos);
  if(currentResultsDesign) registrarResultadosEnHistorial(currentResultsDesign);
  document.getElementById('completos-confirm-modal').classList.remove('show');
  document.getElementById('results-modal').classList.remove('show');
  toast('Resultados guardados — diseño En desarrollo');
  renderAllDesignViews();
});
