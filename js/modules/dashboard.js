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
var DASH_PALETTE = PALETA;

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
  renderKpisCalidad(disenosF);
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
    datasets:[{label:'kg/cm² promedio', data:resistData, borderColor:COLOR_PRIMARIO, backgroundColor:'rgba(3,150,200,.14)', fill:true, tension:.35, pointRadius:4, pointBackgroundColor:COLOR_PRIMARIO}]
  }, {scales:{y:{beginAtZero:false, title:{display:true,text:'kg/cm²'}}}});

  // ---- 2. Diseños por estado (donut) ----
  var estados = ['Iniciado','En desarrollo','Completado'];
  var estadoColors = ['#38bdf8','#f59e0b','#2e9e57'];
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
    datasets:[{data:[semCounts.rojo, semCounts.naranja, semCounts.verde], backgroundColor:['#dc2626','#f59e0b','#2e9e57'], borderRadius:6, maxBarThickness:46}]
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
    datasets:[{label:'Diseños registrados', data:dayCounts, backgroundColor:COLOR_PRIMARIO, borderRadius:5, maxBarThickness:28}]
  }, {plugins:{legend:{display:false}}, scales:{y:{beginAtZero:true, ticks:{precision:0}}}});

  // ---- 5. Diseños por proyecto (top 6) ----
  var proyStats = todosLosProyectoIds().map(function(pid){ return {nombre:proyectoNombre(pid), n: diseñosDeProyecto(pid).length}; })
    .sort(function(a,b){ return b.n-a.n; }).slice(0,6);
  upsertChart('chart-dash-proyectos', 'bar', {
    labels: proyStats.map(function(p){ return p.nombre; }),
    datasets:[{data: proyStats.map(function(p){ return p.n; }), backgroundColor:'#0b5f7a', borderRadius:5, maxBarThickness:26}]
  }, {indexAxis:'y', plugins:{legend:{display:false}}, scales:{x:{beginAtZero:true, ticks:{precision:0}}}});

  // ---- 6. Cumplimiento de plazos ----
  var aTiempo = roturaCargas.filter(function(c){ return c.estado==='completado'; }).length;
  var vencidas = roturaCargas.filter(function(c){ return c.estado==='pendiente' && c.fechaEnsayo < todayStr; }).length;
  var enPlazo = roturaCargas.filter(function(c){ return c.estado==='pendiente' && c.fechaEnsayo >= todayStr; }).length;
  upsertChart('chart-dash-plazos', 'doughnut', {
    labels:['Completadas','En plazo','Vencidas'],
    datasets:[{data:[aTiempo, enPlazo, vencidas], backgroundColor:['#2e9e57','#38bdf8','#dc2626'], borderWidth:0}]
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
    datasets:[{data: costoStats.map(function(p){ return +p.prom.toFixed(2); }), backgroundColor:COLOR_VERDE, borderRadius:5, maxBarThickness:26}]
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

/* ---- KPIs de calidad (segunda fila) ---- */
function kpisCalidad(disenosF){
  var hoy = todayISO();
  var codigos = {}; disenosF.forEach(function(d){ codigos[d.codigo] = true; });
  var cargas = roturaCargas.filter(function(c){ return codigos[c.disenoCodigoDiseno]; });
  var r28 = cargas.filter(function(c){ return Number(c.dia) === 28; }).map(function(c){ return promedio(valoresKgCm2(c)); }).filter(isFinite);
  var cvs = cargas.filter(function(c){ return c.estado === 'completado' && c.coefVar; }).map(function(c){ return parseFloat(c.coefVar); }).filter(isFinite);
  var evaluados = disenosF.filter(function(d){ return n(d.fc) > 0 && isFinite(resistenciaPorEdad(d)[28]); });
  var cumplen = evaluados.filter(function(d){ return resistenciaPorEdad(d)[28] >= n(d.fc); });
  var vencen = cargas.filter(function(c){ return c.fechaEnsayo && c.fechaEnsayo <= hoy; });
  var alDia = vencen.filter(function(c){ return c.estado === 'completado' || c.fechaEnsayo === hoy; });
  return {
    r28: r28.length ? promedio(r28) : NaN, n28: r28.length,
    cv: cvs.length ? promedio(cvs) : NaN,
    cumplimiento: evaluados.length ? Math.round(cumplen.length / evaluados.length * 100) : NaN, evaluados: evaluados.length, cumplen: cumplen.length,
    alDia: vencen.length ? Math.round(alDia.length / vencen.length * 100) : 100
  };
}
function renderKpisCalidad(disenosF){
  var k = kpisCalidad(disenosF);
  document.getElementById('dash-kpis-2').innerHTML =
    kpiCard('kpi-naranja', ICO_RESIST, isFinite(k.r28) ? fmt(k.r28,0) : '-', 'Resistencia prom. a 28 d (kg/cm²) · ' + k.n28 + ' roturas') +
    kpiCard('kpi-verde', ICO_ACTIVO, isFinite(k.cumplimiento) ? k.cumplimiento + '%' : '-', 'Cumplen f\'c a 28 d (' + k.cumplen + ' de ' + k.evaluados + ' diseños)') +
    kpiCard('kpi-negro', ICO_DISENO, isFinite(k.cv) ? fmt(k.cv,1) + '%' : '-', 'Coef. de variación promedio entre especímenes') +
    kpiCard('kpi-rojo', ICO_ALERTA, k.alDia + '%', 'Roturas al día (sin vencer)');
}

/* ---- Exportar reporte completo ---- */
document.getElementById('dash-excel').addEventListener('click', function(){
  var disenosF = disenosFiltradosDashboard();
  var k = kpisCalidad(disenosF);
  var completados = disenosF.filter(function(d){ return d.estado === 'Completado'; }).length;
  var kpis = [['Reporte completo — Laboratorio I+D'], ['Generado', fechaHora(Date.now())], ['Rango', document.getElementById('dash-filtro-rango').selectedOptions[0].text], [],
    ['Indicador', 'Valor'], ['Diseños totales', disenosF.length], ['% completados', disenosF.length ? Math.round(completados/disenosF.length*100) + '%' : '-'],
    ['Roturas pendientes (hasta hoy)', roturaCargas.filter(function(c){ return c.estado === 'pendiente' && c.fechaEnsayo <= todayISO(); }).length],
    ['Resistencia promedio a 28 d (kg/cm²)', isFinite(k.r28) ? +k.r28.toFixed(1) : '-'], ['Cumplimiento de f\'c a 28 d', isFinite(k.cumplimiento) ? k.cumplimiento + '%' : '-'],
    ['Coef. de variación promedio', isFinite(k.cv) ? k.cv.toFixed(1) + '%' : '-'], ['Roturas al día', k.alDia + '%']];
  var proy = [['Proyecto','Estado','Diseños','Completados','Avance %','Roturas registradas','Roturas pendientes','Vencidas','Resist. máx (kg/cm²)','CVD prom. (S/.)']]
    .concat(metricasTodosLosProyectos().filter(function(m){ return m.nDisenos; }).map(function(m){
      return [m.nombre, m.estado, m.nDisenos, m.completados, m.avancePct, m.cargasCompletas, m.cargasPendientes, m.vencidas, isFinite(m.resistMax) ? +m.resistMax.toFixed(1) : '', isFinite(m.costoProm) ? +m.costoProm.toFixed(2) : ''];
    }));
  if(exportarExcel('Reporte KPIs I+D - ' + todayISO() + '.xlsx', [{nombre:'KPIs', filas:kpis}, {nombre:'Proyectos', filas:proy}])){
    registrarHistorial('Exportó', 'Dashboard', 'Reporte de KPIs (Excel)');
    toast('Reporte exportado');
  }
});
document.getElementById('dash-pdf').addEventListener('click', function(){
  if(typeof html2canvas === 'undefined' || typeof window.jspdf === 'undefined'){ toast('No se pudieron cargar las librerías de PDF'); return; }
  var panel = document.getElementById('panel-reportes');
  toast('Generando PDF…');
  panel.classList.add('capturando');
  html2canvas(panel, {scale: 1.5, backgroundColor: getComputedStyle(document.body).backgroundColor, useCORS: true}).then(function(canvas){
    panel.classList.remove('capturando');
    var doc = new window.jspdf.jsPDF('l', 'mm', 'a4');
    var pageW = 297, pageH = 210, margin = 8;
    var imgW = pageW - margin*2;
    var pxPorMm = canvas.width / imgW;
    var altoPagPx = (pageH - margin*2) * pxPorMm;
    var y = 0, pagina = 0;
    while(y < canvas.height){
      var trozo = document.createElement('canvas');
      trozo.width = canvas.width;
      trozo.height = Math.min(altoPagPx, canvas.height - y);
      trozo.getContext('2d').drawImage(canvas, 0, y, canvas.width, trozo.height, 0, 0, canvas.width, trozo.height);
      if(pagina) doc.addPage();
      doc.addImage(trozo.toDataURL('image/png'), 'PNG', margin, margin, imgW, trozo.height / pxPorMm);
      y += altoPagPx; pagina++;
    }
    doc.save('Reporte KPIs I+D - ' + todayISO() + '.pdf');
    registrarHistorial('Exportó', 'Dashboard', 'Reporte de KPIs (PDF)');
    toast('Reporte PDF descargado');
  }).catch(function(){ panel.classList.remove('capturando'); toast('No se pudo generar el PDF'); });
});
