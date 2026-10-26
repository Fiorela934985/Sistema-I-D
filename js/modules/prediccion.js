/* Sistema I+D — Panel Predicción.
   1) Curva de madurez: proyecta 28/56/90 d con las roturas ya registradas de un diseño.
   2) Simulador: el modelo entrenado con la base histórica (js/core/ml.js) estima la resistencia de un diseño nuevo.
   3) Modelo y precisión: entrenamiento, validación con diseños no vistos y seguimiento predicción vs. real. */
'use strict';

var predCharts = {};
function destruirPredChart(id){ if(predCharts[id]){ predCharts[id].destroy(); delete predCharts[id]; } }

function ajusteMadurez(d){
  var r = resistenciaPorEdad(d);
  var pts = Object.keys(r).map(Number).map(function(t){ return {t:t, y:r[t]}; });
  return ajustarCurvaMadurez(pts, tipoCementoNormalizado(d));
}
function disenosConResultados(){ return disenos.filter(function(d){ return Object.keys(resistenciaPorEdad(d)).length > 0; }); }
function prediccionModeloDiseno(d, edad){
  var c = caracteristicasDiseno(d);
  if(!c || !isFinite(c.cementante)) return null;
  var r = predecirResistencia({amc:c.amc, cemento:c.he ? 'HE' : 'I', cementante:c.cementante, flyAshPct:c.flyAshPct, aditivoPct:c.aditivoPct, agua:c.agua, edad:edad || 28});
  return r.error ? null : r;
}

/* ================= 1) Curva de madurez ================= */
function renderPrediccionMadurez(){
  var sel = document.getElementById('pred-diseno');
  var demoCod = {}; disenosDeDemostracion().forEach(function(d){ demoCod[d.codigo] = true; });
  var lista = disenosConResultados().sort(function(a,b){ return (demoCod[a.codigo]?1:0) - (demoCod[b.codigo]?1:0) || (b.ts||0) - (a.ts||0); });
  var actual = sel.value;
  sel.innerHTML = lista.length ? lista.map(function(d){
    return '<option value="'+esc(d.codigo)+'"'+(d.codigo===actual?' selected':'')+'>'+esc(d.codigo+' · '+diseñoTitulo(d)+' ('+(proyectoNombre(d.proyectoId)||'-')+')'+(demoCod[d.codigo]?' · demostración':''))+'</option>';
  }).join('') : '<option value="">No hay diseños con roturas registradas</option>';
  dibujarMadurez();
  // Diseños que aún no tienen resultado a 28 días: proyección por curva y por modelo (y se guardan para medir el acierto)
  var filas = lista.filter(function(d){ return !isFinite(resistenciaPorEdad(d)[28]); }).map(function(d){
    var aj = ajusteMadurez(d);
    var ultima = aj.pts[aj.pts.length-1];
    var p28 = aj.predecir(28), fcv = n(d.fc);
    var pm = demoCod[d.codigo] ? null : prediccionModeloDiseno(d, 28);
    if(!demoCod[d.codigo]){
      registrarPrediccion(d.codigo, 'madurez', p28, 'con edades ' + aj.pts.map(function(p){ return p.t; }).join(', ') + ' d');
      if(pm) registrarPrediccion(d.codigo, 'modelo', pm.valor, pm.modelo.nombre);
    }
    var estado = !fcv ? '<span class="tag-pill tag-gris">Sin f\'c</span>' : (p28 >= fcv ? '<span class="tag-pill tag-verde">Alcanzaría f\'c</span>' : '<span class="tag-pill tag-rojo">Por debajo de f\'c</span>');
    return '<tr class="fila-click" data-pred-cod="'+esc(d.codigo)+'"><td class="mono">'+esc(d.codigo)+'</td><td><b>'+esc(diseñoTitulo(d))+'</b></td><td>'+esc(proyectoNombre(d.proyectoId)||'-')+'</td>' +
      '<td>'+ultima.t+' d → '+fmt(ultima.y,1)+'</td><td><b>'+fmt(p28,1)+'</b></td><td>'+(pm ? fmt(pm.valor,1)+' <span class="nota-sm">±'+fmt(pm.mae,0)+'</span>' : '-')+'</td><td>'+(fcv||'-')+'</td><td>'+estado+'</td></tr>';
  });
  document.getElementById('pred-tabla-encurso').innerHTML = '<thead><tr><th>Código</th><th>Diseño</th><th>Proyecto</th><th>Última edad medida</th><th>28 d por curva</th><th>28 d por modelo</th><th>f\'c</th><th>Estado (curva)</th></tr></thead><tbody>' +
    (filas.join('') || '<tr><td colspan="8" class="empty-note">Todos los diseños con roturas ya tienen su resultado a 28 días.</td></tr>') + '</tbody>';
}
function dibujarMadurez(){
  var d = disenoPorCodigo(document.getElementById('pred-diseno').value);
  var box = document.getElementById('pred-madurez-resultado');
  destruirPredChart('madurez');
  if(!d){ box.innerHTML = ''; return; }
  var aj = ajusteMadurez(d);
  var fcv = n(d.fc);
  var p28 = aj.predecir(28), p56 = aj.predecir(56), p90 = aj.predecir(90);
  var med28 = resistenciaPorEdad(d)[28];
  var bt = backtestMadurez();
  box.innerHTML = '<div class="pred-res-grid">' +
    '<div class="pred-res"><span>28 días</span><b>'+fmt(p28,1)+'</b><small>kg/cm²'+(isFinite(med28)?' · medido '+fmt(med28,1):'')+'</small></div>' +
    '<div class="pred-res"><span>56 días</span><b>'+fmt(p56,1)+'</b><small>kg/cm²</small></div>' +
    '<div class="pred-res"><span>90 días</span><b>'+fmt(p90,1)+'</b><small>kg/cm²</small></div>' +
    '</div><p class="nota-sm">'+aj.metodo+(aj.r2!==null?' · R² = '+fmt(aj.r2,3):'')+(fcv?' · f\'c especificado: '+fcv+' kg/cm² → '+(p28>=fcv?'<b class="txt-verde">lo alcanzaría</b>':'<b class="txt-rojo">no lo alcanzaría</b>'):'')+'</p>' +
    (bt.metricas ? '<p class="nota-sm">Precisión histórica de este método: proyectando 28 d sin ver ese resultado, se equivocó en promedio <b>±'+fmt(bt.metricas.mae,1)+' kg/cm²</b> ('+fmt(bt.metricas.mape,1)+' %) en '+bt.metricas.n+' diseños.</p>' : '');
  if(typeof Chart === 'undefined') return;
  var curva = [];
  for(var t=1;t<=90;t+= (t<7?1:(t<28?3:7))){ curva.push({x:t, y:+aj.predecir(t).toFixed(1)}); }
  curva.push({x:90, y:+p90.toFixed(1)});
  var ds = [
    {label:'Medido', data:aj.pts.map(function(p){ return {x:p.t, y:+p.y.toFixed(1)}; }), type:'scatter', backgroundColor:COLOR_VERDE, pointRadius:6},
    {label:'Curva ajustada', data:curva, borderColor:COLOR_PRIMARIO, backgroundColor:'rgba(3,150,200,.12)', fill:true, tension:.3, pointRadius:0, borderWidth:2.5}
  ];
  if(fcv) ds.push({label:"f'c especificado", data:[{x:1,y:fcv},{x:90,y:fcv}], borderColor:COLOR_AMBAR, borderDash:[6,5], pointRadius:0, borderWidth:2});
  predCharts.madurez = new Chart(document.getElementById('chart-pred-madurez'), {
    type:'line', data:{datasets:ds},
    options:{responsive:true, maintainAspectRatio:false, scales:{x:{type:'linear', min:0, max:92, title:{display:true, text:'Edad (días)'}}, y:{beginAtZero:true, title:{display:true, text:'kg/cm²'}}},
      plugins:{legend:{position:'bottom', labels:{boxWidth:10}}}}
  });
}
document.getElementById('pred-diseno').addEventListener('change', dibujarMadurez);
document.getElementById('pred-tabla-encurso').addEventListener('click', function(e){
  var tr = e.target.closest('[data-pred-cod]');
  if(!tr) return;
  document.getElementById('pred-diseno').value = tr.dataset.predCod;
  dibujarMadurez();
  window.scrollTo({top:0, behavior:'smooth'});
});

/* ================= 2) Simulador ================= */
function entradaSimulador(){
  return {amc: n(document.getElementById('sim-amc').value), cemento: document.getElementById('sim-cemento').value,
    cementante: n(document.getElementById('sim-cemento-kg').value), flyAshPct: n(document.getElementById('sim-flyash').value),
    aditivoPct: n(document.getElementById('sim-aditivo').value), edad: Math.max(1, n(document.getElementById('sim-edad').value) || 28)};
}
function renderSimulador(){
  var res = document.getElementById('sim-resultado');
  var info = document.getElementById('sim-modelo-info');
  destruirPredChart('sim');
  var ent = entradaSimulador();
  var p = predecirResistencia(ent);
  if(p.error){ res.innerHTML = '<div class="empty-note">'+esc(p.error)+'</div>'; info.innerHTML = ''; return; }
  res.innerHTML = '<div class="pred-res-grid"><div class="pred-res destacado"><span>Resistencia estimada a '+ent.edad+' días</span><b>'+fmt(p.valor,1)+'</b><small>kg/cm² · error esperado ±'+fmt(p.mae,1)+' (con diseños no vistos)</small></div></div>' +
    (p.fueraDeRango.length ? '<div class="aviso-rango"><b>Fuera de lo que el modelo conoce:</b> '+p.fueraDeRango.map(esc).join('; ')+'. La estimación es menos confiable.</div>' : '');
  info.innerHTML = '<p class="nota-sm">Modelo activo: <b>'+esc(p.modelo.nombre)+'</b>, entrenado con '+p.modelo.filas+' resultados de '+p.modelo.disenos+' diseños reales ('+fechaHora(p.modelo.fecha)+'). <a href="#" data-predtab-ir="modelo">Ver precisión y reentrenar →</a></p>';
  if(typeof Chart === 'undefined') return;
  var similares = filasEntrenamientoML().filter(function(f){ return Math.abs(f.x[0] - ent.amc) <= 0.05 && f.x[3] === (ent.cemento === 'HE' ? 1 : 0); })
    .map(function(f){ return {x:f.edad, y:+f.y.toFixed(1)}; });
  predCharts.sim = new Chart(document.getElementById('chart-pred-sim'), {
    type:'line',
    data:{datasets:[
      {label:'Estimación del modelo', data:p.curva, borderColor:COLOR_PRIMARIO, backgroundColor:'rgba(3,150,200,.12)', fill:true, tension:.3, pointRadius:2, borderWidth:2.5},
      {label:'Resultados reales similares (a/mc ±0.05, mismo cemento)', data:similares, type:'scatter', backgroundColor:'rgba(46,158,87,.75)', pointRadius:4}
    ]},
    options:{responsive:true, maintainAspectRatio:false, scales:{x:{type:'linear', min:0, max:92, title:{display:true, text:'Edad (días)'}}, y:{beginAtZero:true, title:{display:true, text:'kg/cm²'}}},
      plugins:{legend:{position:'bottom', labels:{boxWidth:10}}}}
  });
}
['sim-amc','sim-cemento','sim-cemento-kg','sim-flyash','sim-aditivo','sim-edad'].forEach(function(id){
  document.getElementById(id).addEventListener(document.getElementById(id).tagName === 'SELECT' ? 'change' : 'input', renderSimulador);
});

/* ================= 3) Modelo y precisión ================= */
function badgeMetrica(valor, sufijo){ return isFinite(valor) ? fmt(valor, 1) + (sufijo||'') : '-'; }
function renderModeloPanel(){
  var wrap = document.getElementById('pred-modelo-contenido');
  var m = asegurarModelo();
  destruirPredChart('importancia'); destruirPredChart('validacion');
  if(!m || m.error){ wrap.innerHTML = '<div class="empty-note">'+esc(m ? m.error : 'Sin datos para entrenar.')+'</div>'; return; }
  var comp = m.comparacion || {};
  var filasComp = [['gbm','Gradient boosting (árboles)'],['ridge','Regresión ridge'],['promedio','Promedio por edad (referencia)']].map(function(par){
    var x = comp[par[0]];
    if(!x) return '';
    var activo = m.algoritmo === par[0];
    return '<tr'+(activo?' class="fila-activa"':'')+'><td><b>'+par[1]+'</b>'+(activo?' <span class="tag-pill tag-verde">Activo</span>':'')+'</td><td>±'+badgeMetrica(x.mae)+'</td><td>'+badgeMetrica(x.mape,' %')+'</td><td>'+(isFinite(x.r2)?fmt(x.r2,2):'-')+'</td></tr>';
  }).join('');
  // Error por diseño (solo 28 d, si hay; si no, la edad mayor de cada diseño)
  var porDis = {};
  (m.validacion || []).forEach(function(v){ if(!porDis[v.g] || v.e === 28 || (porDis[v.g].e !== 28 && v.e > porDis[v.g].e)) porDis[v.g] = v; });
  var filasVal = Object.keys(porDis).map(function(g){ return porDis[g]; }).sort(function(a,b){ return Math.abs(b.p-b.r) - Math.abs(a.p-a.r); }).map(function(v){
    var err = v.p - v.r, pct = Math.abs(err) / v.r * 100;
    return '<tr><td class="mono">'+esc(v.g)+'</td><td>'+esc(v.nom)+'</td><td>'+v.e+' d</td><td>'+fmt(v.r,1)+'</td><td>'+fmt(v.p,1)+'</td><td class="'+(pct<=10?'ok':(pct>20?'bajo':''))+'">'+(err>0?'+':'')+fmt(err,1)+' ('+fmt(pct,0)+' %)</td></tr>';
  }).join('');
  var bt = backtestMadurez();
  var seg = seguimientoPredicciones();
  var conReal = seg.filter(function(s){ return isFinite(s.real); });
  var segFilas = seg.slice(0, 30).map(function(s){
    var d = s.diseno;
    return '<tr><td class="mono">'+esc(s.pred.codigo)+'</td><td>'+esc(d ? diseñoTitulo(d) : '(eliminado)')+'</td><td>'+(s.pred.metodo === 'modelo' ? 'Modelo' : 'Curva de madurez')+'</td><td>'+fechaHora(s.pred.fecha)+'</td><td><b>'+fmt(s.pred.valor,1)+'</b></td>' +
      '<td>'+(isFinite(s.real) ? fmt(s.real,1) : '<span class="nota-sm">pendiente</span>')+'</td><td'+(isFinite(s.error)?(Math.abs(s.error)/s.real<=.1?' class="ok"':(Math.abs(s.error)/s.real>.2?' class="bajo"':'')):'')+'>'+(isFinite(s.error)?(s.error>0?'+':'')+fmt(s.error,1):'-')+'</td></tr>';
  }).join('');
  var historialModelos = modelosML.map(function(x){
    return '<tr><td>'+fechaHora(x.fecha)+'</td><td>'+esc(x.nombre)+'</td><td>'+x.disenos+' / '+x.filas+'</td><td>±'+fmt(x.metricas.mae,1)+'</td><td>'+(isFinite(x.metricas.r2)?fmt(x.metricas.r2,2):'-')+'</td><td>'+esc(x.usuario||'-')+'</td><td>'+(x.activo?'<span class="tag-pill tag-verde">Activo</span>':'<button class="btn-add ghost btn-sm" data-activar-modelo="'+x.id+'">Activar</button>')+'</td></tr>';
  }).join('');
  wrap.innerHTML =
    '<div class="kpi-grid">' +
      kpiCard('kpi-naranja', ICO_RESIST, '±' + fmt(m.metricas.mae,1), 'Error medio con diseños no vistos (kg/cm²)') +
      kpiCard('kpi-verde', ICO_ACTIVO, fmt(m.metricas.mape,1) + ' %', 'Error porcentual medio') +
      kpiCard('kpi-negro', ICO_DISENO, m.disenos + ' / ' + m.filas, 'Diseños reales / resultados usados') +
      kpiCard('kpi-rojo', ICO_CARPETA, isFinite(m.metricas.r2) ? fmt(m.metricas.r2,2) : '-', 'R² (validación por diseño)') +
    '</div>' +
    '<div class="pred-layout">' +
      '<div class="card"><div class="section-num">Modelos comparados</div>' +
        '<p class="nota-sm">Cada modelo se evalúa dejando afuera un diseño a la vez y prediciéndolo con el resto: es el error que se espera con un diseño nuevo. Se activa automáticamente el que menos se equivoca.</p>' +
        '<div class="table-scroll"><table class="data-table"><thead><tr><th>Modelo</th><th>Error medio (kg/cm²)</th><th>Error %</th><th>R²</th></tr></thead><tbody>'+filasComp+'</tbody></table></div>' +
        '<div class="form-actions" style="margin-top:14px;"><button class="btn-add" id="pred-reentrenar">Reentrenar con la base histórica</button>' +
        '<span class="nota-sm">Entrenado '+fechaHora(m.fecha)+(m.usuario?' por '+esc(m.usuario):'')+'. Se reentrena solo cuando cambian los resultados.</span></div></div>' +
      '<div class="chart-card"><h4>¿Qué variables pesan más? <span class="chart-sub">(cuánto empeora el error si se mezcla cada variable)</span></h4><div class="dash-chart-wrap"><canvas id="chart-pred-importancia"></canvas></div></div>' +
    '</div>' +
    '<div class="chart-card" style="margin-top:16px;"><h4>Real vs. predicho <span class="chart-sub">(cada punto es un diseño y edad que el modelo no vio)</span></h4><div class="dash-chart-wrap alto"><canvas id="chart-pred-validacion"></canvas></div></div>' +
    '<div class="card" style="margin-top:16px;"><div class="section-num">Error por diseño</div><div class="table-scroll"><table class="data-table"><thead><tr><th>Código</th><th>Diseño</th><th>Edad</th><th>Real</th><th>Predicho</th><th>Error</th></tr></thead><tbody>'+filasVal+'</tbody></table></div>' +
      '<p class="nota-sm">Verde: error ≤ 10 %. Rojo: error > 20 %.</p></div>' +
    '<div class="card" style="margin-top:16px;"><div class="section-num">Curva de madurez: prueba retrospectiva</div>' +
      (bt.metricas ? '<p class="nota-sm">Proyectando el resultado de 28 días solo con las edades tempranas (sin ver el de 28 d), la curva se equivocó en promedio <b>±'+fmt(bt.metricas.mae,1)+' kg/cm²</b> ('+fmt(bt.metricas.mape,1)+' %) en '+bt.metricas.n+' diseños.</p>' +
        '<div class="table-scroll"><table class="data-table"><thead><tr><th>Código</th><th>Diseño</th><th>Edades usadas</th><th>Real 28 d</th><th>Proyectado</th><th>Error</th></tr></thead><tbody>' +
        bt.pares.map(function(p){ var e = p.pred - p.real; return '<tr><td class="mono">'+esc(p.grupo)+'</td><td>'+esc(p.nombre)+'</td><td>'+esc(p.edadesUsadas)+' d</td><td>'+fmt(p.real,1)+'</td><td>'+fmt(p.pred,1)+'</td><td class="'+(Math.abs(e)/p.real<=.1?'ok':(Math.abs(e)/p.real>.2?'bajo':''))+'">'+(e>0?'+':'')+fmt(e,1)+'</td></tr>'; }).join('') +
        '</tbody></table></div>' : '<p class="nota-sm">Todavía no hay diseños reales con resultado a 28 días y edades previas.</p>') +
    '</div>' +
    '<div class="card" style="margin-top:16px;"><div class="section-num">Seguimiento: predicción guardada vs. resultado real</div>' +
      '<p class="nota-sm">Cada vez que se proyecta un diseño en curso, la predicción queda guardada con su fecha. Cuando llega la rotura de 28 días se compara con lo predicho. '+(conReal.length ? 'Error medio real hasta ahora: <b>±'+fmt(promedio(conReal.map(function(s){ return Math.abs(s.error); })),1)+' kg/cm²</b> en '+conReal.length+' predicciones.' : 'Aún no llegó ningún resultado para comparar.')+'</p>' +
      (segFilas ? '<div class="table-scroll"><table class="data-table"><thead><tr><th>Código</th><th>Diseño</th><th>Método</th><th>Predicho el</th><th>Predicción 28 d</th><th>Real 28 d</th><th>Error</th></tr></thead><tbody>'+segFilas+'</tbody></table></div>' : '') +
    '</div>' +
    '<div class="card" style="margin-top:16px;"><div class="section-num">Modelos entrenados</div><div class="table-scroll"><table class="data-table"><thead><tr><th>Fecha</th><th>Modelo</th><th>Diseños / resultados</th><th>Error medio</th><th>R²</th><th>Usuario</th><th></th></tr></thead><tbody>'+historialModelos+'</tbody></table></div></div>' +
    '<div class="nota-box"><b>Sobre XGBoost:</b> el modelo de árboles de este panel usa la misma técnica (gradient boosting) y corre en el navegador. Para probar XGBoost en Google Colab, exportá el dataset desde <i>Base histórica → CSV</i> y compará su error con el de esta tabla usando la misma validación por diseño.</div>';
  if(typeof Chart === 'undefined') return;
  var imp = importanciaPermutacion(m).filter(function(x){ return x.v > 0.05; }).sort(function(a,b){ return b.v - a.v; });
  predCharts.importancia = new Chart(document.getElementById('chart-pred-importancia'), {
    type:'bar', data:{labels: imp.map(function(x){ return x.t; }), datasets:[{data: imp.map(function(x){ return +x.v.toFixed(1); }), backgroundColor: COLOR_PRIMARIO, borderRadius:5, maxBarThickness:22}]},
    options:{indexAxis:'y', responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}}, scales:{x:{beginAtZero:true, title:{display:true, text:'Aumento del error (kg/cm²)'}}}}
  });
  var pts = (m.validacion || []).map(function(v){ return {x: v.r, y: v.p}; });
  var lim = Math.max.apply(null, pts.map(function(p){ return Math.max(p.x, p.y); }).concat([50])) * 1.05;
  predCharts.validacion = new Chart(document.getElementById('chart-pred-validacion'), {
    type:'scatter',
    data:{datasets:[
      {label:'Diseño no visto', data:pts, backgroundColor:'rgba(3,150,200,.7)', pointRadius:5},
      {label:'Predicción perfecta', data:[{x:0,y:0},{x:lim,y:lim}], type:'line', borderColor:COLOR_VERDE, borderDash:[6,5], pointRadius:0, borderWidth:2}
    ]},
    options:{responsive:true, maintainAspectRatio:false, scales:{x:{min:0, max:lim, title:{display:true, text:'Resistencia real (kg/cm²)'}}, y:{min:0, max:lim, title:{display:true, text:'Predicha (kg/cm²)'}}},
      plugins:{legend:{position:'bottom', labels:{boxWidth:10}}}}
  });
}
document.getElementById('pred-modelo-contenido').addEventListener('click', function(e){
  if(e.target.closest('#pred-reentrenar')){
    var r = entrenarModeloHistorico();
    if(r.error){ toast(r.error); return; }
    r.firma = firmaDatosML(); saveModelos();
    toast('Modelo reentrenado: ' + r.nombre + ' · error medio ±' + fmt(r.metricas.mae, 1) + ' kg/cm²');
    renderModeloPanel();
    return;
  }
  var act = e.target.closest('[data-activar-modelo]');
  if(act){
    modelosML.forEach(function(x){ x.activo = x.id === act.dataset.activarModelo; });
    var elegido = modeloActivo();
    if(elegido) elegido.firma = firmaDatosML();
    saveModelos();
    registrarHistorial('Activó', 'Modelo', elegido ? elegido.nombre + ' del ' + fechaHora(elegido.fecha) : '');
    renderModeloPanel();
  }
});

/* ================= Pestañas ================= */
var predTab = 'madurez';
function mostrarPredTab(tab){
  predTab = tab;
  document.querySelectorAll('#pred-tabs .subtab').forEach(function(x){ x.classList.toggle('active', x.dataset.predtab === tab); });
  ['madurez','simulador','modelo'].forEach(function(t){ document.getElementById('pred-' + t).style.display = t === tab ? 'block' : 'none'; });
  if(tab === 'simulador') renderSimulador();
  else if(tab === 'modelo') renderModeloPanel();
  else renderPrediccionMadurez();
}
document.getElementById('pred-tabs').addEventListener('click', function(e){
  var b = e.target.closest('[data-predtab]');
  if(b) mostrarPredTab(b.dataset.predtab);
});
document.getElementById('panel-prediccion').addEventListener('click', function(e){
  var ir = e.target.closest('[data-predtab-ir]');
  if(ir){ e.preventDefault(); mostrarPredTab(ir.dataset.predtabIr); }
});
PANEL_HOOKS.prediccion = function(){ mostrarPredTab(predTab); };
