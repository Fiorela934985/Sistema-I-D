/* Sistema I+D — Panel PROYECTOS: tarjetas con avance, expediente del proyecto, comparativo entre
   iteraciones y radar de seguimiento. */
'use strict';

var proyVista = 'lista';
var expedienteProyecto = null;
var expedienteTab = 'resumen';
var proyCharts = {};
function destruirProyChart(id){ if(proyCharts[id]){ proyCharts[id].destroy(); delete proyCharts[id]; } }

function ordenIteracion(it){
  var p = partesDeIteracion(it);
  var m = MES_NOMBRES.indexOf(p.mes);
  return (m < 0 ? 99 : m) * 10 + Math.max(0, NUMERAL_ROMANO.indexOf(p.numeral));
}
function tagEstadoDiseno(estado){
  var cls = estado === 'Completado' ? 'tag-verde' : (estado === 'En desarrollo' ? 'tag-naranja' : 'tag-celeste');
  return '<span class="tag-pill '+cls+'">'+esc(estado)+'</span>';
}
function tagEstadoProyecto(estado){
  var cls = estado === 'Completado' ? 'tag-verde' : (estado === 'En curso' ? 'tag-celeste' : 'tag-gris');
  return '<span class="tag-pill '+cls+'">'+esc(estado)+'</span>';
}
function kpiCard(clase, icono, valor, etiqueta){
  return '<div class="kpi-card '+clase+'"><div class="kpi-icon">'+icono+'</div><div><div class="kpi-num">'+valor+'</div><div class="kpi-label">'+etiqueta+'</div></div></div>';
}
var ICO_CARPETA = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"/></svg>';
var ICO_ACTIVO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>';
var ICO_DISENO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="7" x2="16" y2="7"/><line x1="8" y1="12" x2="16" y2="12"/></svg>';
var ICO_ALERTA = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';
var ICO_RESIST = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17l6-6 4 4 8-8"/></svg>';

/* ================= LISTA DE PROYECTOS ================= */
function renderProyectosPanel(){
  if(expedienteProyecto){ renderExpediente(); return; }
  document.getElementById('proy-vista-principal').style.display = 'block';
  document.getElementById('proy-expediente').style.display = 'none';
  var metricas = metricasTodosLosProyectos();
  var enCurso = metricas.filter(function(m){ return m.estado === 'En curso'; }).length;
  var totalDis = metricas.reduce(function(a,m){ return a + m.nDisenos; }, 0);
  var vencidas = metricas.reduce(function(a,m){ return a + m.vencidas; }, 0);
  document.getElementById('proy-kpis').innerHTML =
    kpiCard('kpi-naranja', ICO_CARPETA, metricas.length, 'Proyectos registrados') +
    kpiCard('kpi-verde', ICO_ACTIVO, enCurso, 'Proyectos en curso') +
    kpiCard('kpi-negro', ICO_DISENO, totalDis, 'Diseños en total') +
    kpiCard('kpi-rojo', ICO_ALERTA, vencidas, 'Roturas vencidas');
  document.getElementById('proy-vista-lista').style.display = proyVista === 'lista' ? 'block' : 'none';
  document.getElementById('proy-vista-radar').style.display = proyVista === 'radar' ? 'block' : 'none';
  if(proyVista === 'lista') renderProyGrid(metricas); else renderRadar(metricas);
}
function renderProyGrid(metricas){
  var txt = normalizar(document.getElementById('proy-buscar').value);
  var est = document.getElementById('proy-filtro-estado').value;
  var orden = document.getElementById('proy-orden').value;
  var lista = metricas.filter(function(m){
    if(txt && normalizar(m.nombre).indexOf(txt) === -1) return false;
    if(est && m.estado !== est) return false;
    return true;
  });
  lista.sort(function(a,b){
    if(orden === 'nombre') return a.nombre.localeCompare(b.nombre);
    if(orden === 'avance') return b.avancePct - a.avancePct;
    if(orden === 'disenos') return b.nDisenos - a.nDisenos;
    return b.ultimaActividad - a.ultimaActividad;
  });
  var grid = document.getElementById('proy-grid');
  if(!lista.length){ grid.innerHTML = '<div class="empty-note">No hay proyectos con ese filtro.</div>'; return; }
  grid.innerHTML = lista.map(function(m){
    return '<article class="proy-card" data-proy="'+esc(m.nombre)+'">' +
      '<div class="pc-head"><h4>'+esc(m.nombre)+'</h4>'+tagEstadoProyecto(m.estado)+'</div>' +
      '<div class="pc-stats">' +
        '<div><b>'+m.nDisenos+'</b><span>Diseños</span></div>' +
        '<div><b>'+m.iteraciones.length+'</b><span>Iteraciones</span></div>' +
        '<div><b>'+m.cargasCompletas+'/'+m.cargas.length+'</b><span>Roturas</span></div>' +
        '<div><b>'+(isFinite(m.resistMax) ? fmt(m.resistMax,0) : '-')+'</b><span>Máx. kg/cm²</span></div>' +
      '</div>' +
      '<div class="pc-bar"><div class="pc-bar-fill" style="width:'+m.avancePct+'%"></div></div>' +
      '<div class="pc-meta"><span>'+m.avancePct+'% diseños completados</span>' +
        (m.vencidas ? '<span class="pc-alerta">'+m.vencidas+' vencida'+(m.vencidas===1?'':'s')+'</span>' :
          (m.proximaRotura ? '<span>Próx. rotura '+isoToDMY(m.proximaRotura)+'</span>' : '<span>Sin roturas pendientes</span>')) +
      '</div>' +
      '<div class="pc-foot"><span class="mono">'+(m.ultimaActividad ? 'Actividad ' + hace(m.ultimaActividad) : 'Sin actividad')+'</span>' +
        '<button class="btn-add" data-abrir-exp="'+esc(m.nombre)+'">Abrir expediente →</button></div>' +
    '</article>';
  }).join('');
}
['proy-buscar','proy-filtro-estado','proy-orden'].forEach(function(id){
  document.getElementById(id).addEventListener(id === 'proy-buscar' ? 'input' : 'change', function(){ renderProyGrid(metricasTodosLosProyectos()); });
});
document.getElementById('proy-grid').addEventListener('click', function(e){
  var card = e.target.closest('[data-abrir-exp], .proy-card');
  if(!card) return;
  abrirExpediente(card.dataset.abrirExp || card.dataset.proy);
});
document.getElementById('proy-vista-toggle').addEventListener('click', function(e){
  var btn = e.target.closest('.view-toggle-btn');
  if(!btn) return;
  proyVista = btn.dataset.vista;
  document.querySelectorAll('#proy-vista-toggle .view-toggle-btn').forEach(function(b){ b.classList.toggle('active', b === btn); });
  renderProyectosPanel();
});
document.getElementById('proy-nuevo-btn').addEventListener('click', function(){
  if(!exigir('proyectos:editar')) return;
  showPanel('componentes');
  activeCompCat = 'Proyecto';
  renderComponentesPanel();
  setTimeout(function(){ document.getElementById('proy-nombre').focus(); }, 50);
});

/* ================= RADAR DE PROYECTOS ================= */
var radarSeleccion = null;
function renderRadar(metricas){
  var conDatos = metricas.filter(function(m){ return m.nDisenos > 0; });
  if(!radarSeleccion){
    radarSeleccion = conDatos.slice().sort(function(a,b){ return b.nDisenos - a.nDisenos; }).slice(0,4).map(function(m){ return m.nombre; });
  }
  document.getElementById('radar-picker').innerHTML = conDatos.map(function(m){
    var on = radarSeleccion.indexOf(m.nombre) > -1;
    return '<label class="chip-check'+(on?' on':'')+'"><input type="checkbox" data-radar="'+esc(m.nombre)+'"'+(on?' checked':'')+'> '+esc(m.nombre)+'</label>';
  }).join('') || '<span class="nota-sm">Todavía no hay proyectos con diseños.</span>';
  var ejes = ejesRadar(conDatos).filter(function(x){ return radarSeleccion.indexOf(x.nombre) > -1; });
  destruirProyChart('radar');
  if(typeof Chart !== 'undefined'){
    proyCharts.radar = new Chart(document.getElementById('chart-radar-proyectos'), {
      type:'radar',
      data:{labels:EJES_RADAR, datasets: ejes.map(function(x, i){
        var col = PALETA[i % PALETA.length];
        return {label:x.nombre, data:x.valores, borderColor:col, backgroundColor:col+'26', pointBackgroundColor:col, borderWidth:2};
      })},
      options:{responsive:true, maintainAspectRatio:false, scales:{r:{min:0, max:100, ticks:{stepSize:25, display:false}, pointLabels:{font:{size:12, weight:'600'}}}},
        plugins:{legend:{position:'bottom', labels:{boxWidth:10}}}}
    });
  }
  var filas = metricas.slice().sort(function(a,b){ return (b.vencidas - a.vencidas) || (b.cargasPendientes - a.cargasPendientes); });
  document.getElementById('radar-tabla').innerHTML =
    '<thead><tr><th></th><th>Proyecto</th><th>Diseños</th><th>En desarrollo</th><th>Roturas pend.</th><th>Vencidas</th><th>Próxima rotura</th><th>Avance</th></tr></thead><tbody>' +
    filas.map(function(m){
      var sem = m.vencidas ? 'rojo' : (m.cargasPendientes ? 'naranja' : 'verde');
      if(!m.nDisenos) sem = 'gris';
      return '<tr class="fila-click" data-abrir-exp="'+esc(m.nombre)+'"><td><span class="semaforo-dot semaforo-'+sem+'"></span></td><td><b>'+esc(m.nombre)+'</b></td>' +
        '<td>'+m.nDisenos+'</td><td>'+m.enDesarrollo+'</td><td>'+m.cargasPendientes+'</td><td>'+(m.vencidas?'<b class="txt-rojo">'+m.vencidas+'</b>':'0')+'</td>' +
        '<td>'+(m.proximaRotura ? isoToDMY(m.proximaRotura) : '-')+'</td><td><div class="mini-bar"><div style="width:'+m.avancePct+'%"></div></div> '+m.avancePct+'%</td></tr>';
    }).join('') + '</tbody>';
}
document.getElementById('radar-picker').addEventListener('change', function(e){
  var nombre = e.target.dataset.radar;
  if(!nombre) return;
  if(e.target.checked){
    if(radarSeleccion.length >= 6){ e.target.checked = false; toast('Máximo 6 proyectos en el radar'); return; }
    radarSeleccion.push(nombre);
  } else {
    radarSeleccion = radarSeleccion.filter(function(x){ return x !== nombre; });
  }
  renderRadar(metricasTodosLosProyectos());
});
document.getElementById('radar-tabla').addEventListener('click', function(e){
  var tr = e.target.closest('[data-abrir-exp]');
  if(tr) abrirExpediente(tr.dataset.abrirExp);
});

/* ================= EXPEDIENTE DEL PROYECTO ================= */
var EXP_TABS = [
  {id:'resumen', label:'Resumen'},
  {id:'resultados', label:'Resultados'},
  {id:'comparativo', label:'Comparativo de iteraciones'},
  {id:'evidencias', label:'Evidencias'},
  {id:'reportes', label:'Reportes RR'},
  {id:'historial', label:'Historial'}
];
function abrirExpediente(nombre, tab){
  if(!nombre){ toast('El diseño no tiene proyecto asignado'); return; }
  expedienteProyecto = nombre;
  expedienteTab = tab || 'resumen';
  if(panelActual !== 'proyectos') showPanel('proyectos'); else renderExpediente();
}
function cerrarExpediente(){
  expedienteProyecto = null;
  Object.keys(proyCharts).forEach(destruirProyChart);
  renderProyectosPanel();
}
function rrDeProyecto(nombre, lista){
  var codigos = {}; lista.forEach(function(d){ codigos[d.codigo] = true; if(d.recetaId) codigos[d.recetaId] = true; });
  return rrEstudios.filter(function(e){
    return (e.proyectoId && proyectoNombre(e.proyectoId) === nombre) || e.tipos.some(function(t){ return codigos[t.origenDisenoCodigo]; });
  });
}
function renderExpediente(){
  var nombre = expedienteProyecto;
  var m = metricasProyecto(nombre);
  document.getElementById('proy-vista-principal').style.display = 'none';
  var wrap = document.getElementById('proy-expediente');
  wrap.style.display = 'block';
  var nEvid = evidenciasDeProyecto(nombre).length;
  var nRR = rrDeProyecto(nombre, m.disenos).length;
  wrap.innerHTML =
    '<button class="comp-back" id="exp-volver">← Volver a proyectos</button>' +
    '<div class="exp-header">' +
      '<div><span class="exp-kicker">Expediente del proyecto</span><h2>'+esc(nombre)+'</h2>' +
        '<div class="exp-sub">'+tagEstadoProyecto(m.estado)+' <span>'+m.iteraciones.length+' iteraciones · '+m.nDisenos+' diseños · '+(m.ultimaActividad ? 'actividad ' + hace(m.ultimaActividad) : 'sin actividad')+'</span></div></div>' +
      '<div class="ch-actions">' +
        '<button class="btn-add ghost" id="exp-evidencia" data-perm="evidencias:subir">'+CAMERA_ICON+' Subir evidencia</button>' +
        '<button class="btn-add ghost" id="exp-exportar" data-perm="datos:exportar">Exportar expediente</button>' +
        '<button class="btn-add" id="exp-nuevo-diseno" data-perm="disenos:crear">+ Diseño en este proyecto</button>' +
      '</div>' +
    '</div>' +
    '<div class="kpi-grid">' +
      kpiCard('kpi-naranja', ICO_DISENO, m.completados + '/' + m.nDisenos, 'Diseños completados') +
      kpiCard('kpi-verde', ICO_ACTIVO, m.roturasPct + '%', 'Roturas registradas ('+m.cargasCompletas+'/'+m.cargas.length+')') +
      kpiCard('kpi-negro', ICO_RESIST, isFinite(m.resistMax) ? fmt(m.resistMax,0) : '-', 'Resistencia máx. (kg/cm²)') +
      kpiCard('kpi-rojo', ICO_ALERTA, m.vencidas, 'Roturas vencidas') +
    '</div>' +
    '<div class="roturas-subtabs exp-tabs">' + EXP_TABS.map(function(t){
      var extra = t.id === 'evidencias' ? ' <span class="col-count-badge suave">'+nEvid+'</span>' : (t.id === 'reportes' ? ' <span class="col-count-badge suave">'+nRR+'</span>' : '');
      return '<button class="subtab'+(t.id===expedienteTab?' active':'')+'" data-exp-tab="'+t.id+'">'+t.label+extra+'</button>';
    }).join('') + '</div>' +
    '<div id="exp-contenido"></div>';
  renderExpedienteTab(m);
}
function renderExpedienteTab(m){
  Object.keys(proyCharts).forEach(function(k){ if(k !== 'radar') destruirProyChart(k); });
  var c = document.getElementById('exp-contenido');
  if(expedienteTab === 'resumen') c.innerHTML = expResumenHtml(m);
  else if(expedienteTab === 'resultados'){ c.innerHTML = expResultadosHtml(m); dibujarExpResultados(m); }
  else if(expedienteTab === 'comparativo'){ c.innerHTML = '<div id="cmp-wrap"></div>'; renderComparativo(m); }
  else if(expedienteTab === 'evidencias'){
    c.innerHTML = '<div class="card"><div class="ev-toolbar"><span></span>' +
      '<button class="btn-add" id="exp-evidencia-2" data-perm="evidencias:subir">+ Subir evidencia</button></div><div id="exp-galeria">'+galeriaEvidenciasHtml(evidenciasDeProyecto(m.nombre))+'</div></div>';
    cargarMiniaturas(c);
  }
  else if(expedienteTab === 'reportes') c.innerHTML = expReportesHtml(m);
  else if(expedienteTab === 'historial') c.innerHTML = expHistorialHtml(m);
}
function expResumenHtml(m){
  if(!m.nDisenos) return '<div class="empty-note">Este proyecto todavía no tiene diseños. Usá "+ Diseño en este proyecto" para empezar.</div>';
  var porIter = {};
  m.disenos.forEach(function(d){ (porIter[d.iteracionId || 'Sin iteración'] = porIter[d.iteracionId || 'Sin iteración'] || []).push(d); });
  var iters = Object.keys(porIter).sort(function(a,b){ return ordenIteracion(a) - ordenIteracion(b); });
  return '<div class="exp-timeline">' + iters.map(function(it){
    var lista = porIter[it];
    var comp = lista.filter(function(d){ return d.estado === 'Completado'; }).length;
    return '<div class="exp-iter">' +
      '<div class="exp-iter-head"><span class="exp-iter-dot"></span><h4>'+esc(it)+'</h4><span class="nota-sm">'+lista.length+' diseño'+(lista.length===1?'':'s')+' · '+comp+' completado'+(comp===1?'':'s')+'</span></div>' +
      '<div class="table-scroll"><table class="data-table"><thead><tr><th></th><th>Código</th><th>Diseño</th><th>Fecha</th><th>a/mc</th><th>Roturas</th><th>Máx. kg/cm²</th><th>Estado</th><th></th></tr></thead><tbody>' +
      lista.map(function(d){
        var cs = cargasDeDiseno(d), ok = cs.filter(function(c){ return c.estado === 'completado'; }).length;
        var rm = resistenciaMaxima(d);
        return '<tr><td>'+semaforoDotHtml(semaforoDiseno(d))+'</td><td class="mono">'+esc(d.codigo)+'</td><td><b>'+esc(diseñoTitulo(d))+'</b></td><td>'+esc(d.fecha||'-')+'</td>' +
          '<td>'+esc(d.amcEfectiva||'-')+'</td><td>'+ok+'/'+cs.length+'</td><td>'+(isFinite(rm)?fmt(rm,1):'-')+'</td><td>'+tagEstadoDiseno(d.estado)+'</td>' +
          '<td class="acciones-fila"><button class="btn-icon" data-exp-act="view" data-codigo="'+esc(d.codigo)+'" title="Ver diseño">'+EYE_ICON+'</button>' +
          '<button class="btn-icon" data-exp-act="informe" data-codigo="'+esc(d.codigo)+'" title="Informe">'+CHART_ICON+'</button>' +
          '<button class="btn-icon" data-exp-act="etiquetas" data-codigo="'+esc(d.codigo)+'" title="Etiquetas">'+TAG_ICON+'</button></td></tr>';
      }).join('') + '</tbody></table></div></div>';
  }).join('') + '</div>';
}
function expResultadosHtml(m){
  var edades = {};
  m.disenos.forEach(function(d){ Object.keys(resistenciaPorEdad(d)).forEach(function(e){ edades[e] = true; }); });
  var lista = Object.keys(edades).map(Number).sort(function(a,b){ return a-b; });
  if(!lista.length) return '<div class="empty-note">Todavía no hay roturas registradas en este proyecto.</div>';
  var filas = m.disenos.map(function(d){
    var r = resistenciaPorEdad(d);
    if(!Object.keys(r).length) return '';
    var fcv = n(d.fc);
    return '<tr><td class="mono">'+esc(d.codigo)+'</td><td><b>'+esc(diseñoTitulo(d))+'</b></td><td>'+esc(d.iteracionId||'-')+'</td><td>'+(fcv||'-')+'</td>' +
      lista.map(function(e){
        var v = r[e];
        var ok = isFinite(v) && fcv && e >= 28 ? (v >= fcv ? ' class="ok"' : ' class="bajo"') : '';
        return '<td'+ok+'>'+(isFinite(v) ? fmt(v,1) : '-')+'</td>';
      }).join('') + '</tr>';
  }).join('');
  return '<div class="chart-card"><h4>Resistencia vs. edad <span class="chart-sub">(promedio combinado de réplicas, kg/cm²)</span></h4><div class="dash-chart-wrap alto"><canvas id="chart-exp-resultados"></canvas></div></div>' +
    '<div class="card" style="margin-top:16px;"><div class="table-scroll"><table class="data-table"><thead><tr><th>Código</th><th>Diseño</th><th>Iteración</th><th>f\'c</th>' +
    lista.map(function(e){ return '<th>'+e+' d</th>'; }).join('') + '</tr></thead><tbody>'+filas+'</tbody></table></div>' +
    '<p class="nota-sm">A 28 días o más: verde si alcanza el f\'c especificado, rojo si queda por debajo.</p></div>';
}
function dibujarExpResultados(m){
  if(typeof Chart === 'undefined') return;
  var datasets = m.disenos.map(function(d, i){
    var r = resistenciaPorEdad(d);
    var pts = Object.keys(r).map(Number).sort(function(a,b){ return a-b; }).map(function(e){ return {x:e, y:+r[e].toFixed(1)}; });
    var col = PALETA[i % PALETA.length];
    return pts.length ? {label:diseñoTitulo(d), data:pts, borderColor:col, backgroundColor:col, tension:.3, pointRadius:3} : null;
  }).filter(Boolean);
  proyCharts.expRes = new Chart(document.getElementById('chart-exp-resultados'), {
    type:'line', data:{datasets:datasets},
    options:{responsive:true, maintainAspectRatio:false, scales:{x:{type:'linear', title:{display:true, text:'Edad (días)'}}, y:{title:{display:true, text:'kg/cm²'}}},
      plugins:{legend:{position:'bottom', labels:{boxWidth:10, font:{size:10}}}}}
  });
}

/* ---- Comparativo entre iteraciones ---- */
var cmpSeleccion = {};
function renderComparativo(m){
  destruirProyChart('cmp');
  var wrap = document.getElementById('cmp-wrap');
  var porIter = {};
  m.disenos.forEach(function(d){ if(d.iteracionId) (porIter[d.iteracionId] = porIter[d.iteracionId] || []).push(d); });
  var iters = Object.keys(porIter).sort(function(a,b){ return ordenIteracion(a) - ordenIteracion(b); });
  if(iters.length < 1){ wrap.innerHTML = '<div class="empty-note">El proyecto no tiene iteraciones con diseños para comparar.</div>'; return; }
  var sel = cmpSeleccion[m.nombre] || iters.slice(-4);
  sel = sel.filter(function(it){ return iters.indexOf(it) > -1; });
  cmpSeleccion[m.nombre] = sel;
  var edadesSet = {};
  var resumen = iters.map(function(it){
    var lista = porIter[it];
    var porEdad = {};
    lista.forEach(function(d){
      var r = resistenciaPorEdad(d);
      Object.keys(r).forEach(function(e){ (porEdad[e] = porEdad[e] || []).push(r[e]); edadesSet[e] = true; });
    });
    var res = {};
    Object.keys(porEdad).forEach(function(e){ res[e] = promedio(porEdad[e]); });
    return {iter:it, n:lista.length,
      completados: lista.filter(function(d){ return d.estado === 'Completado'; }).length,
      amc: promedio(lista.map(function(d){ return n(d.amcEfectiva) || NaN; })),
      cemento: promedio(lista.map(contenidoCemento)),
      costo: promedio(lista.map(function(d){ return n(d.cvdTotal) || NaN; })),
      res: res};
  });
  var edades = Object.keys(edadesSet).map(Number).sort(function(a,b){ return a-b; });
  var mejorPorEdad = {};
  edades.forEach(function(e){
    var vals = resumen.filter(function(r){ return sel.indexOf(r.iter) > -1 && isFinite(r.res[e]); }).map(function(r){ return r.res[e]; });
    mejorPorEdad[e] = vals.length ? Math.max.apply(null, vals) : NaN;
  });
  wrap.innerHTML =
    '<div class="card"><div class="section-num">Elegí las iteraciones a comparar</div><div class="radar-picker">' +
      iters.map(function(it){ var on = sel.indexOf(it) > -1; return '<label class="chip-check'+(on?' on':'')+'"><input type="checkbox" data-cmp="'+esc(it)+'"'+(on?' checked':'')+'> '+esc(it)+' <span class="mono">('+porIter[it].length+')</span></label>'; }).join('') +
    '</div></div>' +
    '<div class="chart-card" style="margin-top:16px;"><h4>Resistencia promedio por edad <span class="chart-sub">(cada línea es una iteración)</span></h4><div class="dash-chart-wrap alto"><canvas id="chart-cmp"></canvas></div></div>' +
    '<div class="card" style="margin-top:16px;"><div class="table-scroll"><table class="data-table"><thead><tr><th>Iteración</th><th>Diseños</th><th>Completados</th><th>a/mc prom.</th><th>Cemento prom. (kg/m³)</th><th>CVD prom. (S/.)</th>' +
      edades.map(function(e){ return '<th>'+e+' d (kg/cm²)</th>'; }).join('') + '</tr></thead><tbody>' +
      resumen.filter(function(r){ return sel.indexOf(r.iter) > -1; }).map(function(r){
        return '<tr><td><b>'+esc(r.iter)+'</b></td><td>'+r.n+'</td><td>'+r.completados+'</td><td>'+fmt(r.amc,2)+'</td><td>'+fmt(r.cemento,0)+'</td><td>'+fmt(r.costo,2)+'</td>' +
          edades.map(function(e){ var v = r.res[e]; var mejor = isFinite(v) && v === mejorPorEdad[e] && sel.length > 1; return '<td'+(mejor?' class="ok"':'')+'>'+(isFinite(v)?fmt(v,1):'-')+'</td>'; }).join('') + '</tr>';
      }).join('') +
    '</tbody></table></div><p class="nota-sm">En verde, la iteración con mayor resistencia en cada edad.</p></div>';
  if(typeof Chart !== 'undefined'){
    proyCharts.cmp = new Chart(document.getElementById('chart-cmp'), {
      type:'line',
      data:{datasets: resumen.filter(function(r){ return sel.indexOf(r.iter) > -1; }).map(function(r, i){
        var col = PALETA[i % PALETA.length];
        return {label:r.iter, data: Object.keys(r.res).map(Number).sort(function(a,b){ return a-b; }).map(function(e){ return {x:e, y:+r.res[e].toFixed(1)}; }),
          borderColor:col, backgroundColor:col, tension:.3, pointRadius:4, borderWidth:2.5};
      })},
      options:{responsive:true, maintainAspectRatio:false, scales:{x:{type:'linear', title:{display:true, text:'Edad (días)'}}, y:{title:{display:true, text:'kg/cm²'}}},
        plugins:{legend:{position:'bottom', labels:{boxWidth:10}}}}
    });
  }
}
function expReportesHtml(m){
  var lista = rrDeProyecto(m.nombre, m.disenos);
  if(!lista.length) return '<div class="empty-note">No hay reportes RR asociados a este proyecto. Generalos desde <a href="#" data-goto="reporte-rr">Reporte RR</a>.</div>';
  return '<div class="proy-grid">' + lista.map(function(e){
    return '<article class="proy-card"><div class="pc-head"><h4>'+esc(e.nombre)+'</h4>'+(e.generado?'<span class="tag-pill tag-verde">Generado</span>':'<span class="tag-pill tag-gris">Borrador</span>')+'</div>' +
      '<div class="pc-meta"><span>'+e.tipos.length+' diseños · '+e.edades.length+' edades</span><span>'+esc(e.fecha||'')+'</span></div>' +
      '<div class="pc-foot"><span class="mono">'+esc(e.tipos.slice(0,2).map(function(t){ return t.nombre; }).join(', '))+(e.tipos.length>2?'…':'')+'</span><button class="btn-add" data-abrir-rr="'+esc(e.id)+'">Abrir en visor →</button></div></article>';
  }).join('') + '</div>';
}
function expHistorialHtml(m){
  var lista = historialDeProyecto(m.nombre);
  var filas = lista.length ? lista.slice(0, 200).map(function(h){
    return '<tr><td class="mono">'+fechaHora(h.ts)+'</td><td>'+esc(h.usuario)+'</td><td>'+esc(h.accion)+'</td><td>'+esc(h.entidad)+'</td><td>'+esc(h.detalle)+'</td></tr>';
  }).join('') : '';
  var base = m.disenos.slice().sort(function(a,b){ return (b.ts||0)-(a.ts||0); }).map(function(d){
    return '<tr><td class="mono">'+esc(d.fecha||'')+'</td><td>'+esc(d.colaborador||'-')+'</td><td>Creó</td><td>Diseño</td><td>'+esc(d.codigo+' · '+diseñoTitulo(d))+'</td></tr>';
  }).join('');
  return '<div class="card"><div class="table-scroll"><table class="data-table"><thead><tr><th>Fecha</th><th>Usuario</th><th>Acción</th><th>Entidad</th><th>Detalle</th></tr></thead><tbody>' +
    (filas || base || '<tr><td colspan="5" class="empty-note">Sin movimientos registrados.</td></tr>') + '</tbody></table></div></div>';
}
function exportarExpediente(m){
  var resumen = [['Expediente del proyecto', m.nombre], ['Estado', m.estado], ['Iteraciones', m.iteraciones.join(', ')],
    ['Diseños', m.nDisenos], ['Completados', m.completados], ['Roturas registradas', m.cargasCompletas + ' de ' + m.cargas.length],
    ['Roturas vencidas', m.vencidas], ['Resistencia máxima (kg/cm²)', isFinite(m.resistMax) ? +m.resistMax.toFixed(1) : ''],
    ['CVD promedio (S/.)', isFinite(m.costoProm) ? +m.costoProm.toFixed(2) : ''], ['Exportado', fechaHora(Date.now()) + ' por ' + (usuarioActual ? usuarioActual.usuario : '')]];
  var dis = [['Código','Diseño','Iteración','Fecha','Planta','f\'c','a/mc','Cemento','CVD (S/.)','Estado','Colaborador','Responsable']].concat(m.disenos.map(function(d){
    return [d.codigo, diseñoTitulo(d), d.iteracionId||'', d.fecha||'', d.planta||'', n(d.fc)||'', n(d.amcEfectiva)||'', d.cementoTipo||'', n(d.cvdTotal)||'', d.estado, d.colaborador||'', d.responsable||''];
  }));
  var filasBH = baseHistoricaFilas().filter(function(f){ return f.proyecto === m.nombre; });
  var res = [BH_COLUMNAS.map(function(c){ return c.t; })].concat(filasBH.map(function(f){ return BH_COLUMNAS.map(function(c){ return f[c.k]; }); }));
  var his = [['Fecha','Usuario','Acción','Entidad','Detalle']].concat(historialDeProyecto(m.nombre).map(function(h){ return [fechaHora(h.ts), h.usuario, h.accion, h.entidad, h.detalle]; }));
  if(exportarExcel('Expediente - ' + m.nombre + '.xlsx', [{nombre:'Resumen', filas:resumen}, {nombre:'Diseños', filas:dis}, {nombre:'Resultados', filas:res}, {nombre:'Historial', filas:his}])){
    registrarHistorial('Exportó', 'Proyecto', 'Expediente ' + m.nombre, {proyecto:m.nombre});
    toast('Expediente exportado a Excel');
  }
}
document.getElementById('proy-expediente').addEventListener('click', function(e){
  if(e.target.closest('#exp-volver')){ cerrarExpediente(); return; }
  var tab = e.target.closest('[data-exp-tab]');
  if(tab){ expedienteTab = tab.dataset.expTab; renderExpediente(); return; }
  if(e.target.closest('#exp-evidencia, #exp-evidencia-2')){
    abrirModalEvidencia(expedienteProyecto, '', function(){ expedienteTab = 'evidencias'; renderExpediente(); });
    return;
  }
  if(e.target.closest('#exp-exportar')){ exportarExpediente(metricasProyecto(expedienteProyecto)); return; }
  if(e.target.closest('#exp-nuevo-diseno')){
    if(!exigir('disenos:crear')) return;
    showPanel('disenos'); showSubTab('calcular');
    fillProyectoCatalogoSelect(document.getElementById('pp-proyecto'), expedienteProyecto);
    fillPpIteracionSelect(expedienteProyecto, '');
    return;
  }
  var act = e.target.closest('[data-exp-act]');
  if(act){
    var d = disenoPorCodigo(act.dataset.codigo);
    if(!d) return;
    if(act.dataset.expAct === 'view') openDesignModal(d);
    else if(act.dataset.expAct === 'informe') openInformeModal(d);
    else if(act.dataset.expAct === 'etiquetas') abrirEtiquetas(d.codigo);
    return;
  }
  var rr = e.target.closest('[data-abrir-rr]');
  if(rr){ rrActiveId = rr.dataset.abrirRr; showPanel('reporte-rr'); renderRRStudyList(); renderRRDetail(); return; }
  if(e.target.closest('#exp-galeria')){ manejarClickGaleria(e, function(){ renderExpediente(); }); }
});
document.getElementById('proy-expediente').addEventListener('change', function(e){
  var it = e.target.dataset.cmp;
  if(!it) return;
  var sel = cmpSeleccion[expedienteProyecto] || [];
  if(e.target.checked){ if(sel.indexOf(it) === -1) sel.push(it); }
  else sel = sel.filter(function(x){ return x !== it; });
  cmpSeleccion[expedienteProyecto] = sel;
  renderComparativo(metricasProyecto(expedienteProyecto));
});
PANEL_HOOKS.proyectos = function(){ renderProyectosPanel(); };
// Tocar "Proyectos" en el menú siempre vuelve a la lista (cierra el expediente abierto).
document.querySelector('.side-nav [data-panel="proyectos"]').addEventListener('click', function(){ expedienteProyecto = null; }, true);
