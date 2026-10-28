/* Sistema I+D — Panel Predicción.
   1) Proyección: estima 28/56/90 d de un diseño con el modelo histórico calibrado con sus roturas ya registradas.
   2) Simulador: el modelo entrenado con la base histórica (js/core/ml.js) estima la resistencia de un diseño nuevo.
   3) Modelo y precisión: tasa de acierto y de error, validación con diseños no vistos y seguimiento predicción vs. real. */
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
/* Barra de tasa de acierto (verde) y de error (rojo). */
function tasaHtml(acierto, n){
  if(!isFinite(acierto)) return '';
  var a = Math.round(acierto), e = 100 - a;
  return '<div class="tasa">' +
    '<div class="tasa-bar"><span class="tasa-ok" style="width:'+a+'%"></span><span class="tasa-mal" style="width:'+e+'%"></span></div>' +
    '<div class="tasa-leyenda"><span class="txt-verde"><b>'+a+' %</b> aciertos</span><span class="txt-rojo"><b>'+e+' %</b> error</span>' +
    '<span class="nota-sm">±'+ML_TOLERANCIA+' %'+(n ? ' · '+n+' casos' : '')+'</span></div></div>';
}
function claseError(pred, real){ var pct = Math.abs(pred - real) / real * 100; return pct <= ML_TOLERANCIA ? 'ok' : (pct > 2 * ML_TOLERANCIA ? 'bajo' : ''); }

/* ================= 1) Proyección de diseños con roturas ================= */
function renderPrediccionMadurez(){
  var sel = document.getElementById('pred-diseno');
  var demoCod = {}; disenosDeDemostracion().forEach(function(d){ demoCod[d.codigo] = true; });
  var lista = disenosConResultados().sort(function(a,b){ return (demoCod[a.codigo]?1:0) - (demoCod[b.codigo]?1:0) || (b.ts||0) - (a.ts||0); });
  var actual = sel.value;
  sel.innerHTML = lista.length ? lista.map(function(d){
    return '<option value="'+esc(d.codigo)+'"'+(d.codigo===actual?' selected':'')+'>'+esc(d.codigo+' · '+diseñoTitulo(d)+' ('+(proyectoNombre(d.proyectoId)||'-')+')'+(demoCod[d.codigo]?' · demostración':''))+'</option>';
  }).join('') : '<option value="">No hay diseños con roturas registradas</option>';
  dibujarMadurez();
  // Diseños sin resultado a 28 días: se proyectan y se guarda la predicción para medir el acierto cuando llegue la rotura
  var filas = lista.filter(function(d){ return !isFinite(resistenciaPorEdad(d)[28]); }).map(function(d){
    var aj = ajusteMadurez(d);
    var ultima = aj.pts[aj.pts.length-1];
    var pc = predecirDisenoCalibrado(d, 28);
    var p28 = pc ? pc.valor : aj.predecir(28), fcv = n(d.fc);
    if(!demoCod[d.codigo]){
      registrarPrediccion(d.codigo, 'madurez', aj.predecir(28), 'con edades ' + aj.pts.map(function(p){ return p.t; }).join(', ') + ' d');
      if(pc) registrarPrediccion(d.codigo, 'calibrado', pc.valor, pc.modelo.nombre);
    }
    var estado = !fcv ? '<span class="tag-pill tag-gris">Sin f\'c</span>' : (p28 >= fcv ? '<span class="tag-pill tag-verde">Alcanzaría</span>' : '<span class="tag-pill tag-rojo">No alcanzaría</span>');
    return '<tr class="fila-click" data-pred-cod="'+esc(d.codigo)+'"><td class="mono">'+esc(d.codigo)+'</td><td><b>'+esc(diseñoTitulo(d))+'</b></td><td>'+esc(proyectoNombre(d.proyectoId)||'-')+'</td>' +
      '<td>'+ultima.t+' d → '+fmt(ultima.y,1)+'</td><td><b>'+fmt(p28,1)+'</b></td><td>'+(pc && isFinite(pc.acierto) ? fmt(pc.acierto,0)+' %' : '-')+'</td><td>'+(fcv||'-')+'</td><td>'+estado+'</td></tr>';
  });
  document.getElementById('pred-tabla-encurso').innerHTML = '<thead><tr><th>Código</th><th>Diseño</th><th>Proyecto</th><th>Última edad</th><th>28 d proyectado</th><th>Acierto</th><th>f\'c</th><th>f\'c a 28 d</th></tr></thead><tbody>' +
    (filas.join('') || '<tr><td colspan="8" class="empty-note">Todos los diseños con roturas ya tienen su resultado a 28 días.</td></tr>') + '</tbody>';
}
function dibujarMadurez(){
  var d = disenoPorCodigo(document.getElementById('pred-diseno').value);
  var box = document.getElementById('pred-madurez-resultado');
  destruirPredChart('madurez');
  if(!d){ box.innerHTML = ''; return; }
  var aj = ajusteMadurez(d);
  var fcv = n(d.fc);
  var medidas = resistenciaPorEdad(d);
  var pc = predecirDisenoCalibrado(d, 90);
  var valorEn = function(t){
    if(!pc) return aj.predecir(t);
    var p = pc.curva.filter(function(x){ return x.x === t; })[0];
    return p ? p.y : aj.predecir(t);
  };
  var p28 = isFinite(medidas[28]) ? medidas[28] : valorEn(28);
  var celda = function(t){
    var med = medidas[t];
    return '<div class="pred-res"><span>'+t+' días</span><b>'+fmt(isFinite(med) ? med : valorEn(t),1)+'</b><small>kg/cm²'+(isFinite(med)?' · medido':'')+'</small></div>';
  };
  var precision = pc ? pc.acierto : (backtestMadurez().metricas || {}).acierto;
  box.innerHTML = '<div class="pred-res-grid">' + celda(28) + celda(56) + celda(90) + '</div>' +
    (fcv ? '<p class="pred-veredicto">f\'c '+fcv+' kg/cm² → '+(p28>=fcv?'<b class="txt-verde">lo alcanza</b>':'<b class="txt-rojo">no lo alcanza</b>')+'</p>' : '') +
    tasaHtml(precision);
  if(typeof Chart === 'undefined') return;
  var curva = [];
  for(var t=1;t<=90;t+= (t<7?1:(t<28?3:7))){ curva.push({x:t, y:+aj.predecir(t).toFixed(1)}); }
  curva.push({x:90, y:+aj.predecir(90).toFixed(1)});
  var ds = [{label:'Medido', data:aj.pts.map(function(p){ return {x:p.t, y:+p.y.toFixed(1)}; }), type:'scatter', backgroundColor:COLOR_VERDE, pointRadius:6}];
  if(pc) ds.push({label:'Modelo calibrado', data:pc.curva, borderColor:COLOR_PRIMARIO, backgroundColor:'rgba(3,150,200,.12)', fill:true, tension:.3, pointRadius:0, borderWidth:2.5});
  ds.push({label:'Curva logarítmica', data:curva, borderColor:pc ? '#94a3b8' : COLOR_PRIMARIO, borderDash:pc ? [4,4] : [], fill:false, tension:.3, pointRadius:0, borderWidth:pc ? 1.5 : 2.5});
  if(fcv) ds.push({label:"f'c", data:[{x:1,y:fcv},{x:90,y:fcv}], borderColor:COLOR_AMBAR, borderDash:[6,5], pointRadius:0, borderWidth:2});
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
  res.innerHTML = '<div class="pred-res-grid"><div class="pred-res destacado"><span>A '+ent.edad+' días</span><b>'+fmt(p.valor,1)+'</b><small>kg/cm² · ±'+fmt(p.mae,1)+'</small></div></div>' +
    tasaHtml(p.acierto, p.modelo.metricas.n) +
    (p.fueraDeRango.length ? '<div class="aviso-rango"><b>Fuera de rango:</b> '+p.fueraDeRango.map(esc).join('; ')+'</div>' : '');
  info.innerHTML = '<p class="nota-sm">'+esc(p.modelo.nombre)+' · '+p.modelo.disenos+' diseños reales · <a href="#" data-predtab-ir="modelo">Ver precisión</a></p>';
  if(typeof Chart === 'undefined') return;
  var similares = filasEntrenamientoML().filter(function(f){ return Math.abs(f.x[0] - ent.amc) <= 0.05 && f.x[3] === (ent.cemento === 'HE' ? 1 : 0); })
    .map(function(f){ return {x:f.edad, y:+f.y.toFixed(1)}; });
  predCharts.sim = new Chart(document.getElementById('chart-pred-sim'), {
    type:'line',
    data:{datasets:[
      {label:'Estimación', data:p.curva, borderColor:COLOR_PRIMARIO, backgroundColor:'rgba(3,150,200,.12)', fill:true, tension:.3, pointRadius:2, borderWidth:2.5},
      {label:'Reales similares', data:similares, type:'scatter', backgroundColor:'rgba(46,158,87,.75)', pointRadius:4}
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
function pct(valor){ return isFinite(valor) ? fmt(valor, 0) + ' %' : '-'; }
function renderModeloPanel(){
  var wrap = document.getElementById('pred-modelo-contenido');
  var m = asegurarModelo();
  destruirPredChart('importancia'); destruirPredChart('validacion');
  if(!m || m.error){ wrap.innerHTML = '<div class="empty-note">'+esc(m ? m.error : 'Sin datos para entrenar.')+'</div>'; return; }
  var comp = m.comparacion || {};
  var filasComp = Object.keys(ML_ALGORITMOS).map(function(k){
    var x = comp[k];
    if(!x) return '';
    var activo = m.algoritmo === k;
    return '<tr'+(activo?' class="fila-activa"':'')+'><td><b>'+ML_ALGORITMOS[k].nombre+'</b>'+(activo?' <span class="tag-pill tag-verde">Activo</span>':'')+'</td><td><b>'+pct(x.acierto)+'</b></td><td>'+pct(x.tasaError)+'</td><td>±'+badgeMetrica(x.mae)+'</td></tr>';
  }).join('');
  // Error por diseño (28 d si hay; si no, la edad mayor de cada diseño)
  var porDis = {};
  (m.validacion || []).forEach(function(v){ if(!porDis[v.g] || v.e === 28 || (porDis[v.g].e !== 28 && v.e > porDis[v.g].e)) porDis[v.g] = v; });
  var filasVal = Object.keys(porDis).map(function(g){ return porDis[g]; }).sort(function(a,b){ return Math.abs(b.p-b.r) - Math.abs(a.p-a.r); }).map(function(v){
    var err = v.p - v.r, pct = Math.abs(err) / v.r * 100;
    return '<tr><td class="mono">'+esc(v.g)+'</td><td>'+esc(v.nom)+'</td><td>'+v.e+' d</td><td>'+fmt(v.r,1)+'</td><td>'+fmt(v.p,1)+'</td><td class="'+claseError(v.p, v.r)+'">'+(err>0?'+':'')+fmt(err,1)+' ('+fmt(pct,0)+' %)</td></tr>';
  }).join('');
  var bt = backtestMadurez();
  var cal = m.calibrado;
  var seg = seguimientoPredicciones();
  var conReal = seg.filter(function(s){ return isFinite(s.real); });
  var segAcierto = conReal.length ? conReal.filter(function(s){ return esAcierto(s.pred.valor, s.real); }).length / conReal.length * 100 : NaN;
  var NOMBRE_METODO = {modelo:'Modelo', calibrado:'Modelo calibrado', madurez:'Curva logarítmica'};
  var segFilas = seg.slice(0, 30).map(function(s){
    var d = s.diseno;
    return '<tr><td class="mono">'+esc(s.pred.codigo)+'</td><td>'+esc(d ? diseñoTitulo(d) : '(eliminado)')+'</td><td>'+(NOMBRE_METODO[s.pred.metodo] || s.pred.metodo)+'</td><td>'+fechaHora(s.pred.fecha)+'</td><td><b>'+fmt(s.pred.valor,1)+'</b></td>' +
      '<td>'+(isFinite(s.real) ? fmt(s.real,1) : '<span class="nota-sm">pendiente</span>')+'</td><td'+(isFinite(s.error)?' class="'+claseError(s.pred.valor, s.real)+'"':'')+'>'+(isFinite(s.error)?(s.error>0?'+':'')+fmt(s.error,1):'-')+'</td></tr>';
  }).join('');
  var historialModelos = modelosML.map(function(x){
    return '<tr><td>'+fechaHora(x.fecha)+'</td><td>'+esc(x.nombre)+'</td><td>'+x.disenos+' / '+x.filas+'</td><td>'+pct(x.metricas.acierto)+'</td><td>±'+fmt(x.metricas.mae,1)+'</td><td>'+esc(x.usuario||'-')+'</td><td>'+(x.activo?'<span class="tag-pill tag-verde">Activo</span>':'<button class="btn-add ghost btn-sm" data-activar-modelo="'+x.id+'">Activar</button>')+'</td></tr>';
  }).join('');
  var metodoFila = function(nombre, x){ return x ? '<tr><td><b>'+nombre+'</b></td><td><b>'+pct(x.acierto)+'</b></td><td>'+pct(x.tasaError)+'</td><td>±'+badgeMetrica(x.mae)+'</td></tr>' : ''; };
  wrap.innerHTML =
    '<div class="kpi-grid">' +
      kpiCard('kpi-verde', ICO_ACTIVO, pct(m.metricas.acierto), 'Tasa de acierto (±'+ML_TOLERANCIA+' %)') +
      kpiCard('kpi-rojo', ICO_ALERTA, pct(m.metricas.tasaError), 'Tasa de error') +
      kpiCard('kpi-naranja', ICO_RESIST, '±' + fmt(m.metricas.mae,1), 'Error medio (kg/cm²)') +
      kpiCard('kpi-negro', ICO_DISENO, m.disenos + ' / ' + m.filas, 'Diseños / resultados') +
    '</div>' +
    '<div class="pred-layout">' +
      '<div class="card"><div class="section-num">Precisión por método</div>' +
        '<div class="table-scroll"><table class="data-table"><thead><tr><th>Caso</th><th>Acierto</th><th>Error</th><th>± kg/cm²</th></tr></thead><tbody>' +
          metodoFila('Diseño nuevo (modelo)', m.metricas) +
          metodoFila('Diseño con roturas (calibrado)', cal) +
          metodoFila('Curva logarítmica a 28 d', bt.metricas) +
        '</tbody></table></div>' +
        '<div class="section-num" style="margin-top:16px;">Modelos comparados</div>' +
        '<div class="table-scroll"><table class="data-table"><thead><tr><th>Modelo</th><th>Acierto</th><th>Error</th><th>± kg/cm²</th></tr></thead><tbody>'+filasComp+'</tbody></table></div>' +
        '<div class="form-actions" style="margin-top:14px;"><button class="btn-add" id="pred-reentrenar">Reentrenar</button>' +
        '<span class="nota-sm">'+fechaHora(m.fecha)+(m.usuario?' · '+esc(m.usuario):'')+'</span></div></div>' +
      '<div class="chart-card"><h4>Variables que más pesan</h4><div class="dash-chart-wrap"><canvas id="chart-pred-importancia"></canvas></div></div>' +
    '</div>' +
    '<div class="chart-card" style="margin-top:16px;"><h4>Real vs. predicho</h4><div class="dash-chart-wrap alto"><canvas id="chart-pred-validacion"></canvas></div></div>' +
    '<div class="card" style="margin-top:16px;"><div class="section-num">Error por diseño</div><div class="table-scroll"><table class="data-table"><thead><tr><th>Código</th><th>Diseño</th><th>Edad</th><th>Real</th><th>Predicho</th><th>Error</th></tr></thead><tbody>'+filasVal+'</tbody></table></div></div>' +
    '<div class="card" style="margin-top:16px;"><div class="section-num">Seguimiento: predicción vs. resultado real</div>' +
      (conReal.length ? tasaHtml(segAcierto, conReal.length) : '<p class="nota-sm">Aún sin resultados para comparar.</p>') +
      (segFilas ? '<div class="table-scroll"><table class="data-table"><thead><tr><th>Código</th><th>Diseño</th><th>Método</th><th>Fecha</th><th>Predicción 28 d</th><th>Real 28 d</th><th>Error</th></tr></thead><tbody>'+segFilas+'</tbody></table></div>' : '') +
    '</div>' +
    '<div class="card" style="margin-top:16px;"><div class="section-num">Modelos entrenados</div><div class="table-scroll"><table class="data-table"><thead><tr><th>Fecha</th><th>Modelo</th><th>Diseños / resultados</th><th>Acierto</th><th>Error medio</th><th>Usuario</th><th></th></tr></thead><tbody>'+historialModelos+'</tbody></table></div></div>';
  if(typeof Chart === 'undefined') return;
  var imp = importanciaPermutacion(m).filter(function(x){ return x.v > 0.05; }).sort(function(a,b){ return b.v - a.v; });
  predCharts.importancia = new Chart(document.getElementById('chart-pred-importancia'), {
    type:'bar', data:{labels: imp.map(function(x){ return x.t; }), datasets:[{data: imp.map(function(x){ return +x.v.toFixed(1); }), backgroundColor: COLOR_PRIMARIO, borderRadius:5, maxBarThickness:22}]},
    options:{indexAxis:'y', responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}}, scales:{x:{beginAtZero:true, title:{display:true, text:'Aumento del error (kg/cm²)'}}}}
  });
  var val = m.validacion || [];
  var ok = val.filter(function(v){ return esAcierto(v.p, v.r); }).map(function(v){ return {x: v.r, y: v.p}; });
  var mal = val.filter(function(v){ return !esAcierto(v.p, v.r); }).map(function(v){ return {x: v.r, y: v.p}; });
  var lim = Math.max.apply(null, val.map(function(v){ return Math.max(v.r, v.p); }).concat([50])) * 1.05;
  predCharts.validacion = new Chart(document.getElementById('chart-pred-validacion'), {
    type:'scatter',
    data:{datasets:[
      {label:'Acierto (±'+ML_TOLERANCIA+' %)', data:ok, backgroundColor:'rgba(46,158,87,.8)', pointRadius:5},
      {label:'Error', data:mal, backgroundColor:'rgba(220,38,38,.75)', pointRadius:5},
      {label:'Predicción perfecta', data:[{x:0,y:0},{x:lim,y:lim}], type:'line', borderColor:'#94a3b8', borderDash:[6,5], pointRadius:0, borderWidth:2}
    ]},
    options:{responsive:true, maintainAspectRatio:false, scales:{x:{min:0, max:lim, title:{display:true, text:'Real (kg/cm²)'}}, y:{min:0, max:lim, title:{display:true, text:'Predicho (kg/cm²)'}}},
      plugins:{legend:{position:'bottom', labels:{boxWidth:10}}}}
  });
}
document.getElementById('pred-modelo-contenido').addEventListener('click', function(e){
  if(e.target.closest('#pred-reentrenar')){
    var r = entrenarModeloHistorico();
    if(r.error){ toast(r.error); return; }
    r.firma = firmaDatosML(); saveModelos();
    toast('Modelo reentrenado · acierto ' + fmt(r.metricas.acierto, 0) + ' %');
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

/* ================= Pronóstico en la calculadora (paso 3 del flujo) =================
   Mientras se arma la mezcla se estima la resistencia con el modelo histórico, leyendo el diseño igual que
   en el entrenamiento, y se compara con el f'cr objetivo antes de registrar. */
function pronosticoDeDiseno(d, edad){
  var c = caracteristicasDiseno(d);
  if(!c || !isFinite(c.cementante)) return {error:'Completá la a/mc efectiva y el cemento (o el agua) para ver el pronóstico.'};
  return predecirResistencia({amc:c.amc, cemento:c.he ? 'HE' : 'I', cementante:c.cementante, flyAshPct:c.flyAshPct, aditivoPct:c.aditivoPct, agua:c.agua, edad:edad || 28});
}
function disenoEnCalculadora(){
  var cem = componentes[Number(document.getElementById('dis-cemento-mat').value)];
  return {
    amcEfectiva: document.getElementById('dis-amc-efectiva').value,
    cementoPeso: document.getElementById('dis-cemento-peso').value,
    cementoTipo: cementoTipoDesdeCatalogo() || (cem ? cem.nombre : ''),
    nombreTecnico: cem ? cem.nombre : '',
    mix: getComposicionItems().map(function(it){ var comp = componentes[it.compIndex]; return {nombre: comp ? comp.nombre : '', pesoSeco: it.pesoSeco}; })
  };
}
function renderPronosticoCalculadora(){
  var box = document.getElementById('dis-pronostico');
  var edad = n(document.getElementById('dis-edad').value) || 28;
  var cab = '<div class="section-num">Pronóstico de resistencia</div>';
  var p = pronosticoDeDiseno(disenoEnCalculadora(), edad);
  if(p.error){ box.innerHTML = cab + '<p class="nota-sm">' + esc(p.error) + '</p>'; return; }
  var fcr = n(document.getElementById('dis-fcr').value) || n(document.getElementById('dis-fc').value);
  var p28 = edad === 28 ? p : pronosticoDeDiseno(disenoEnCalculadora(), 28);
  var veredicto = '';
  if(fcr > 0){
    var ok = p.valor >= fcr;
    veredicto = '<p class="pred-veredicto ' + (ok ? 'txt-verde' : 'txt-rojo') + '"><b>' + (ok ? '✓ Alcanzaría' : '✗ No alcanzaría') + '</b> el objetivo de ' + fmt(fcr, 0) + ' kg/cm² a ' + edad + ' d' +
      (ok ? '' : ' — probá bajar la a/mc o subir el cemento') + '.</p>';
  }
  box.innerHTML = cab +
    '<div class="pron-valores"><div><small>A ' + edad + ' días</small><b>' + fmt(p.valor, 0) + '</b><span>kg/cm² · ±' + fmt(p.mae, 0) + '</span></div>' +
    (edad !== 28 && !p28.error ? '<div><small>A 28 días</small><b>' + fmt(p28.valor, 0) + '</b><span>kg/cm²</span></div>' : '') + '</div>' +
    veredicto + tasaHtml(p.acierto) +
    (p.fueraDeRango.length ? '<p class="aviso-rango">Fuera del rango de los datos históricos: ' + p.fueraDeRango.map(esc).join('; ') + '. Tomá el valor con cautela.</p>' : '') +
    '<p class="nota-sm">Modelo: ' + esc(p.modelo.nombre) + ', entrenado con ' + p.modelo.disenos + ' diseños reales. Al registrar, el pronóstico a 28 d queda guardado para compararlo con el resultado real.</p>';
}
var pronosticoTimer = null;
function programarPronostico(){ clearTimeout(pronosticoTimer); pronosticoTimer = setTimeout(renderPronosticoCalculadora, 400); }
['input', 'change'].forEach(function(ev){ document.getElementById('sub-calcular').addEventListener(ev, programarPronostico); });
