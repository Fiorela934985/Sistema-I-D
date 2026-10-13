/* Sistema I+D — Dashboard: KPIs y gráficos en vivo */
'use strict';

/* ================= DASHBOARD (KPIs + gráficos en vivo) ================= */
function animateCount(el, target, suffix){
  suffix = suffix || '';
  var start = 0, duration = 700, startTime = null;
  function step(ts){
    if(!startTime) startTime = ts;
    var progress = Math.min((ts - startTime) / duration, 1);
    el.textContent = Math.round(start + (target-start)*progress) + suffix;
    if(progress < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}
function updateStats(){ /* usado por otras pantallas para refrescar badges/contadores dependientes */ }

var dashCharts = {};
var dashInterval = null;
var DASH_PALETTE = ['#c81e1e','#ea580c','#f5c518','#16a34a','#0d9488','#7c3aed'];

function destroyDashCharts(){
  Object.keys(dashCharts).forEach(function(k){ dashCharts[k].destroy(); });
  dashCharts = {};
}
function chartDefaults(){
  return {
    plugins:{legend:{labels:{color:getComputedStyle(document.body).color, font:{family:'Inter'}}}},
    scales:{}
  };
}
function poblarFiltroAnioDashboard(){
  var sel = document.getElementById('dash-filtro-anio');
  var anios = {};
  disenos.forEach(function(d){ if(d.ts) anios[new Date(d.ts).getFullYear()] = true; });
  var actual = new Date().getFullYear();
  anios[actual] = true;
  var lista = Object.keys(anios).map(Number).sort(function(a,b){return b-a;});
  var prev = sel.value;
  sel.innerHTML = lista.map(function(a){ return '<option value="'+a+'">'+a+'</option>'; }).join('');
  sel.value = prev || String(actual);
}
function disenosFiltradosDashboard(){
  var rango = document.getElementById('dash-filtro-rango').value;
  var anio = Number(document.getElementById('dash-filtro-anio').value);
  if(rango === 'todo') return disenos;
  if(rango === 'anio') return disenos.filter(function(d){ return d.ts && new Date(d.ts).getFullYear() === anio; });
  var dias = Number(rango);
  var limite = Date.now() - dias*DAY;
  return disenos.filter(function(d){ return (d.ts||0) >= limite; });
}
document.getElementById('dash-filtro-anio').addEventListener('change', function(){ buildDashboard(false); });
document.getElementById('dash-filtro-rango').addEventListener('change', function(){ buildDashboard(false); });

function renderAvanceProyecto(disenosF){
  var wrap = document.getElementById('dash-avance-proyecto');
  var porProyecto = {};
  disenosF.forEach(function(d){
    var nombre = proyectoNombre(d.proyectoId) || 'Sin proyecto';
    if(!porProyecto[nombre]) porProyecto[nombre] = [];
    porProyecto[nombre].push(d);
  });
  var nombres = Object.keys(porProyecto).sort();
  if(!nombres.length){ wrap.innerHTML = '<div class="empty-note">Sin diseños en el rango seleccionado.</div>'; return; }
  wrap.innerHTML = nombres.map(function(nombre){
    var lista = porProyecto[nombre];
    var completos = lista.filter(function(d){ return d.estado==='Completado'; }).length;
    var pct = lista.length ? Math.round(completos/lista.length*100) : 0;
    var iteraciones = {};
    lista.forEach(function(d){ iteraciones[iteracionNombre(d.iteracionId)] = true; });
    var nIter = Object.keys(iteraciones).length;
    return '<div class="dash-avance-card">' +
      '<div class="dac-top"><span class="dac-nombre">'+esc(nombre)+'</span><span class="dac-pct">'+pct+'%</span></div>' +
      '<div class="dac-bar-track"><div class="dac-bar-fill" style="width:'+pct+'%;"></div></div>' +
      '<div class="dac-meta"><span>'+completos+'/'+lista.length+' diseños completados</span><span>'+nIter+' iteración'+(nIter===1?'':'es')+'</span></div>' +
    '</div>';
  }).join('');
}

function buildDashboard(first){
  var todayStr = todayISO();
  if(first) poblarFiltroAnioDashboard();
  var disenosF = disenosFiltradosDashboard();
  renderAvanceProyecto(disenosF);

  // ---- KPIs ----
  var totalDisenos = disenosF.length;
  var completados = disenosF.filter(function(d){ return d.estado==='Completado'; }).length;
  var pct = totalDisenos ? Math.round(completados/totalDisenos*100) : 0;
  var roturasPend = roturaCargas.filter(function(c){ return c.estado==='pendiente' && c.fechaEnsayo<=todayStr; }).length;
  var proyectosActivos = todosLosProyectoIds().filter(function(pid){ var l = diseñosDeProyecto(pid); return l.length>0 && l.some(function(d){ return d.estado!=='Completado'; }); }).length;

  if(first){
    animateCount(document.getElementById('kpi-total-disenos'), totalDisenos);
    animateCount(document.getElementById('kpi-pct-completado'), pct, '%');
    animateCount(document.getElementById('kpi-roturas-pendientes'), roturasPend);
    animateCount(document.getElementById('kpi-proyectos-activos'), proyectosActivos);
  } else {
    document.getElementById('kpi-total-disenos').textContent = totalDisenos;
    document.getElementById('kpi-pct-completado').textContent = pct+'%';
    document.getElementById('kpi-roturas-pendientes').textContent = roturasPend;
    document.getElementById('kpi-proyectos-activos').textContent = proyectosActivos;
  }
  document.getElementById('dash-updated').textContent = new Date().toLocaleTimeString('es-PE',{hour:'2-digit',minute:'2-digit',second:'2-digit'});

  // ---- 1. Resistencia promedio por edad (agregado real) ----
  var porEdad = {};
  roturaCargas.forEach(function(c){
    if(!c.promedio) return;
    porEdad[c.dia] = porEdad[c.dia] || [];
    porEdad[c.dia].push(Number(c.promedio));
  });
  var edadesOrdenadas = Object.keys(porEdad).map(Number).sort(function(a,b){return a-b;});
  var resistData = edadesOrdenadas.map(function(dia){
    var vals = porEdad[dia];
    return +(vals.reduce(function(a,b){return a+b;},0)/vals.length).toFixed(1);
  });
  upsertChart('chart-dash-resistencia', 'line', {
    labels: edadesOrdenadas.map(function(d){ return d+'d'; }),
    datasets:[{label:'kg/cm² promedio', data:resistData, borderColor:'#c81e1e', backgroundColor:'rgba(200,30,30,.12)', fill:true, tension:.35, pointRadius:4, pointBackgroundColor:'#c81e1e'}]
  }, {scales:{y:{beginAtZero:false, title:{display:true,text:'kg/cm²'}}}});

  // ---- 2. Diseños por estado (donut) ----
  var estados = ['Iniciado','En desarrollo','Completado'];
  var estadoColors = ['#dc2626','#ea580c','#16a34a'];
  var estadoCounts = estados.map(function(e){ return disenos.filter(function(d){ return d.estado===e; }).length; });
  upsertChart('chart-dash-estado', 'doughnut', {
    labels: estados,
    datasets:[{data:estadoCounts, backgroundColor:estadoColors, borderWidth:0}]
  }, {cutout:'62%', plugins:{legend:{position:'bottom', labels:{boxWidth:10,padding:10}}}});

  // ---- 3. Semáforo de roturas por diseño ----
  var semCounts = {rojo:0, naranja:0, verde:0};
  disenos.forEach(function(d){ semCounts[semaforoDiseno(d)]++; });
  upsertChart('chart-dash-semaforo', 'bar', {
    labels:['Sin iniciar','En proceso','Completo'],
    datasets:[{data:[semCounts.rojo, semCounts.naranja, semCounts.verde], backgroundColor:['#dc2626','#ea580c','#16a34a'], borderRadius:6, maxBarThickness:46}]
  }, {plugins:{legend:{display:false}}, scales:{y:{beginAtZero:true, ticks:{precision:0}}}});

  // ---- 4. Timeline últimos 14 días ----
  var days = [];
  for(var i=13;i>=0;i--){ days.push(new Date(Date.now()-i*DAY)); }
  var dayLabels = days.map(function(d){ return String(d.getDate()).padStart(2,'0')+'/'+String(d.getMonth()+1).padStart(2,'0'); });
  var dayCounts = days.map(function(d){
    var iso = d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
    return disenos.filter(function(x){ return dmyToISO(x.fecha) === iso; }).length;
  });
  upsertChart('chart-dash-timeline', 'bar', {
    labels: dayLabels,
    datasets:[{label:'Diseños registrados', data:dayCounts, backgroundColor:'#ea580c', borderRadius:5, maxBarThickness:28}]
  }, {plugins:{legend:{display:false}}, scales:{y:{beginAtZero:true, ticks:{precision:0}}}});

  // ---- 5. Diseños por proyecto (top 6) ----
  var proyStats = todosLosProyectoIds().map(function(pid){ return {nombre:proyectoNombre(pid), n: diseñosDeProyecto(pid).length}; })
    .sort(function(a,b){ return b.n-a.n; }).slice(0,6);
  upsertChart('chart-dash-proyectos', 'bar', {
    labels: proyStats.map(function(p){ return p.nombre; }),
    datasets:[{data: proyStats.map(function(p){ return p.n; }), backgroundColor:'#161616', borderRadius:5, maxBarThickness:26}]
  }, {indexAxis:'y', plugins:{legend:{display:false}}, scales:{x:{beginAtZero:true, ticks:{precision:0}}}});

  // ---- 6. Cumplimiento de plazos ----
  var aTiempo = roturaCargas.filter(function(c){ return c.estado==='completado'; }).length;
  var vencidas = roturaCargas.filter(function(c){ return c.estado==='pendiente' && c.fechaEnsayo < todayStr; }).length;
  var enPlazo = roturaCargas.filter(function(c){ return c.estado==='pendiente' && c.fechaEnsayo >= todayStr; }).length;
  upsertChart('chart-dash-plazos', 'doughnut', {
    labels:['Completadas','En plazo','Vencidas'],
    datasets:[{data:[aTiempo, enPlazo, vencidas], backgroundColor:['#16a34a','#f5c518','#dc2626'], borderWidth:0}]
  }, {cutout:'62%', plugins:{legend:{position:'bottom', labels:{boxWidth:10,padding:10}}}});

  // ---- 7. Costo promedio por m³ por proyecto (nueva métrica) ----
  var costoPorProyecto = {};
  disenosF.forEach(function(d){
    var nombre = proyectoNombre(d.proyectoId) || 'Sin proyecto';
    if(d.cvdTotal){ costoPorProyecto[nombre] = costoPorProyecto[nombre] || []; costoPorProyecto[nombre].push(Number(d.cvdTotal)); }
  });
  var costoStats = Object.keys(costoPorProyecto).map(function(nombre){
    var arr = costoPorProyecto[nombre];
    return {nombre:nombre, prom: arr.reduce(function(a,b){return a+b;},0)/arr.length};
  }).sort(function(a,b){return b.prom-a.prom;}).slice(0,6);
  upsertChart('chart-dash-costo', 'bar', {
    labels: costoStats.map(function(p){ return p.nombre; }),
    datasets:[{data: costoStats.map(function(p){ return +p.prom.toFixed(2); }), backgroundColor:'#0099cc', borderRadius:5, maxBarThickness:26}]
  }, {indexAxis:'y', plugins:{legend:{display:false}}, scales:{x:{beginAtZero:true}}});
}
function upsertChart(canvasId, type, data, extraOptions){
  if(typeof Chart === 'undefined') return;
  Chart.defaults.color = '#14181a';
  Chart.defaults.plugins.legend.labels.color = '#14181a';
  var canvas = document.getElementById(canvasId);
  if(!canvas) return;
  if(dashCharts[canvasId]){
    dashCharts[canvasId].data = data;
    dashCharts[canvasId].update();
    return;
  }
  var opts = Object.assign({responsive:true, maintainAspectRatio:false, animation:{duration:900, easing:'easeOutQuart'}}, extraOptions||{});
  dashCharts[canvasId] = new Chart(canvas, {type:type, data:data, options:opts});
}
function animateReportes(intento){
  intento = intento || 0;
  if(typeof Chart === 'undefined' && intento < 25){ setTimeout(function(){ animateReportes(intento+1); }, 300); return; }
  buildDashboard(true);
  clearInterval(dashInterval);
  dashInterval = setInterval(function(){
    if(!document.getElementById('panel-reportes').classList.contains('active')){ clearInterval(dashInterval); return; }
    buildDashboard(false);
  }, 4000);
}
