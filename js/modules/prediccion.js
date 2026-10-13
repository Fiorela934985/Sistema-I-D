/* Sistema I+D — Predicción de resistencia a partir de la base histórica.
   1) Curva de madurez por diseño: ajusta f(t) = a + b·ln(t) con las roturas registradas.
   2) Simulador: regresión lineal regularizada (ridge) entrenada con todos los resultados. */
'use strict';

var predCharts = {};
function destruirPredChart(id){ if(predCharts[id]){ predCharts[id].destroy(); delete predCharts[id]; } }

/* Relación típica f(t)/f(28) (ACI 209) para estimar con una sola edad medida. */
function ratioACI(t, tipoCemento){ return tipoCemento === 'HE' ? t / (2.3 + 0.92*t) : t / (4 + 0.85*t); }

function ajusteMadurez(d){
  var r = resistenciaPorEdad(d);
  var pts = Object.keys(r).map(Number).filter(function(t){ return t > 0 && isFinite(r[t]); }).sort(function(a,b){ return a-b; })
    .map(function(t){ return {t:t, y:r[t]}; });
  if(!pts.length) return null;
  var tipo = tipoCementoNormalizado(d);
  if(pts.length === 1){
    var f28 = pts[0].y / ratioACI(pts[0].t, tipo);
    return {pts:pts, metodo:'Relación ACI 209 (una sola edad medida)', predecir:function(t){ return f28 * ratioACI(t, tipo); }, r2:null};
  }
  var xs = pts.map(function(p){ return Math.log(p.t); }), ys = pts.map(function(p){ return p.y; });
  var mx = promedio(xs), my = promedio(ys);
  var sxy = 0, sxx = 0, sst = 0;
  xs.forEach(function(x, i){ sxy += (x-mx)*(ys[i]-my); sxx += (x-mx)*(x-mx); sst += (ys[i]-my)*(ys[i]-my); });
  var b = sxx ? sxy/sxx : 0, a = my - b*mx;
  var sse = xs.reduce(function(acc, x, i){ var e = ys[i] - (a + b*x); return acc + e*e; }, 0);
  return {pts:pts, metodo:'Ajuste logarítmico con ' + pts.length + ' edades', a:a, b:b,
    predecir:function(t){ return a + b*Math.log(t); }, r2: sst ? 1 - sse/sst : null};
}
function disenosConResultados(){ return disenos.filter(function(d){ return Object.keys(resistenciaPorEdad(d)).length > 0; }); }

function renderPrediccionMadurez(){
  var sel = document.getElementById('pred-diseno');
  var lista = disenosConResultados().sort(function(a,b){ return (b.ts||0)-(a.ts||0); });
  var actual = sel.value;
  sel.innerHTML = lista.length ? lista.map(function(d){
    return '<option value="'+esc(d.codigo)+'"'+(d.codigo===actual?' selected':'')+'>'+esc(d.codigo+' · '+diseñoTitulo(d)+' ('+(proyectoNombre(d.proyectoId)||'-')+')')+'</option>';
  }).join('') : '<option value="">No hay diseños con roturas registradas</option>';
  dibujarMadurez();
  // Tabla: diseños que aún no tienen resultado a 28 días
  var filas = lista.filter(function(d){ return !isFinite(resistenciaPorEdad(d)[28]); }).map(function(d){
    var aj = ajusteMadurez(d);
    var ultima = aj.pts[aj.pts.length-1];
    var p28 = aj.predecir(28), fcv = n(d.fc);
    var estado = !fcv ? '<span class="tag-pill tag-gris">Sin f\'c</span>' : (p28 >= fcv ? '<span class="tag-pill tag-verde">Alcanzaría f\'c</span>' : '<span class="tag-pill tag-rojo">Por debajo de f\'c</span>');
    return '<tr class="fila-click" data-pred-cod="'+esc(d.codigo)+'"><td class="mono">'+esc(d.codigo)+'</td><td><b>'+esc(diseñoTitulo(d))+'</b></td><td>'+esc(proyectoNombre(d.proyectoId)||'-')+'</td>' +
      '<td>'+ultima.t+' d → '+fmt(ultima.y,1)+'</td><td><b>'+fmt(p28,1)+'</b></td><td>'+(fcv||'-')+'</td><td>'+estado+'</td></tr>';
  });
  document.getElementById('pred-tabla-encurso').innerHTML = '<thead><tr><th>Código</th><th>Diseño</th><th>Proyecto</th><th>Última edad medida</th><th>28 d proyectado</th><th>f\'c</th><th>Estado</th></tr></thead><tbody>' +
    (filas.join('') || '<tr><td colspan="7" class="empty-note">Todos los diseños con roturas ya tienen su resultado a 28 días.</td></tr>') + '</tbody>';
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
  box.innerHTML = '<div class="pred-res-grid">' +
    '<div class="pred-res"><span>28 días</span><b>'+fmt(p28,1)+'</b><small>kg/cm²'+(isFinite(med28)?' · medido '+fmt(med28,1):'')+'</small></div>' +
    '<div class="pred-res"><span>56 días</span><b>'+fmt(p56,1)+'</b><small>kg/cm²</small></div>' +
    '<div class="pred-res"><span>90 días</span><b>'+fmt(p90,1)+'</b><small>kg/cm²</small></div>' +
    '</div><p class="nota-sm">'+aj.metodo+(aj.r2!==null?' · R² = '+fmt(aj.r2,3):'')+(fcv?' · f\'c especificado: '+fcv+' kg/cm² → '+(p28>=fcv?'<b class="txt-verde">lo alcanzaría</b>':'<b class="txt-rojo">no lo alcanzaría</b>'):'')+'</p>';
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

/* ================= Regresión ridge (simulador) ================= */
function vectorCaracteristicas(amc, edad, he, cementoKg, flyAsh){
  var le = Math.log(Math.max(1, edad));
  return [1, amc, le, he, cementoKg/100, flyAsh, he*le, amc*le];
}
var NOMBRES_CARACT = ['Intercepto','a/mc','ln(edad)','Cemento HE','Cemento (×100 kg/m³)','Fly Ash','HE × ln(edad)','a/mc × ln(edad)'];
function resolverSistema(A, b){
  var nn = b.length, M = A.map(function(row, i){ return row.concat([b[i]]); });
  for(var c=0;c<nn;c++){
    var piv = c;
    for(var r=c+1;r<nn;r++){ if(Math.abs(M[r][c]) > Math.abs(M[piv][c])) piv = r; }
    var tmp = M[c]; M[c] = M[piv]; M[piv] = tmp;
    if(Math.abs(M[c][c]) < 1e-12) continue;
    for(var r2=0;r2<nn;r2++){
      if(r2 === c) continue;
      var f = M[r2][c] / M[c][c];
      for(var k=c;k<=nn;k++) M[r2][k] -= f * M[c][k];
    }
  }
  return M.map(function(row, i){ return Math.abs(row[i]) < 1e-12 ? 0 : row[nn] / row[i]; });
}
function entrenarRidge(X, y, lambda){
  var p = X[0].length;
  var A = [], b = [];
  for(var i=0;i<p;i++){
    A.push([]); b.push(0);
    for(var j=0;j<p;j++){
      var s = 0;
      for(var r=0;r<X.length;r++) s += X[r][i]*X[r][j];
      A[i].push(s + (i===j && i>0 ? lambda : 0));
    }
    for(var r3=0;r3<X.length;r3++) b[i] += X[r3][i]*y[r3];
  }
  return resolverSistema(A, b);
}
function predecirLineal(beta, x){ return x.reduce(function(acc, v, i){ return acc + v*beta[i]; }, 0); }
var modeloSimulador = null;
function datosEntrenamiento(){
  // Los diseños de demostración tienen la misma resistencia en todas las edades: se excluyen para no
  // enseñarle al modelo que la edad no importa.
  var demo = {};
  disenosDeDemostracion().forEach(function(d){ demo[d.codigo] = true; });
  var filas = baseHistoricaFilas().filter(function(f){ return f.resistencia !== '' && f.amc !== '' && f.edad > 0 && !demo[f.disenoCodigo]; });
  var cems = filas.map(function(f){ return f.cementoKg; }).filter(function(v){ return v !== ''; });
  var cemMedio = cems.length ? promedio(cems) : 350;
  return {cemMedio:cemMedio, filas:filas.map(function(f){
    return {x: vectorCaracteristicas(Number(f.amc), Number(f.edad), f.cementoTipo === 'HE' ? 1 : 0, f.cementoKg === '' ? cemMedio : Number(f.cementoKg), Number(f.flyAsh)||0), y: Number(f.resistencia), f:f};
  })};
}
function entrenarModeloSimulador(){
  var datos = datosEntrenamiento();
  var filas = datos.filas;
  if(filas.length < 8){ modeloSimulador = {insuficiente:true, n:filas.length}; return modeloSimulador; }
  var lambda = 0.5;
  // Validación cruzada de 5 pliegues (determinística) para reportar el error esperado.
  var errAbs = [], ssRes = 0, ssTot = 0, my = promedio(filas.map(function(r){ return r.y; }));
  for(var k=0;k<5;k++){
    var train = filas.filter(function(_, i){ return i % 5 !== k; }), test = filas.filter(function(_, i){ return i % 5 === k; });
    if(!test.length || train.length < 5) continue;
    var bk = entrenarRidge(train.map(function(r){ return r.x; }), train.map(function(r){ return r.y; }), lambda);
    test.forEach(function(r){ var e = r.y - predecirLineal(bk, r.x); errAbs.push(Math.abs(e)); ssRes += e*e; ssTot += (r.y-my)*(r.y-my); });
  }
  var beta = entrenarRidge(filas.map(function(r){ return r.x; }), filas.map(function(r){ return r.y; }), lambda);
  modeloSimulador = {beta:beta, n:filas.length, mae:promedio(errAbs), r2: ssTot ? 1 - ssRes/ssTot : null, cemMedio:datos.cemMedio, filas:filas};
  return modeloSimulador;
}
function renderSimulador(){
  var m = modeloSimulador || entrenarModeloSimulador();
  var res = document.getElementById('sim-resultado');
  var info = document.getElementById('sim-modelo-info');
  destruirPredChart('sim');
  if(m.insuficiente){
    res.innerHTML = '<div class="empty-note">Se necesitan al menos 8 resultados de rotura para entrenar el modelo (hay '+m.n+').</div>';
    info.innerHTML = '';
    return;
  }
  var amc = n(document.getElementById('sim-amc').value), edad = Math.max(1, n(document.getElementById('sim-edad').value) || 28);
  var he = document.getElementById('sim-cemento').value === 'HE' ? 1 : 0;
  var cem = n(document.getElementById('sim-cemento-kg').value) || m.cemMedio;
  var fa = Number(document.getElementById('sim-flyash').value);
  var pred = predecirLineal(m.beta, vectorCaracteristicas(amc, edad, he, cem, fa));
  res.innerHTML = '<div class="pred-res-grid"><div class="pred-res destacado"><span>Resistencia estimada a '+edad+' días</span><b>'+fmt(pred,1)+'</b><small>kg/cm² · ±'+fmt(m.mae,1)+' (error medio)</small></div></div>';
  var importancia = m.beta.slice(1).map(function(b, i){ return {nombre:NOMBRES_CARACT[i+1], b:b}; });
  info.innerHTML = '<p class="nota-sm">Entrenado con <b>'+m.n+'</b> resultados reales de la base histórica (sin diseños de demostración) · validación cruzada (5 pliegues): R² = <b>'+(m.r2!==null?fmt(m.r2,2):'-')+'</b>, error medio absoluto = <b>'+fmt(m.mae,1)+' kg/cm²</b>.</p>' +
    '<details class="pred-coef"><summary>Ver coeficientes del modelo</summary><table class="data-table"><tbody>' +
    importancia.map(function(x){ return '<tr><td>'+x.nombre+'</td><td class="mono">'+(x.b>=0?'+':'')+fmt(x.b,2)+'</td></tr>'; }).join('') + '</tbody></table></details>';
  if(typeof Chart === 'undefined') return;
  var curva = [];
  [1,2,3,5,7,10,14,21,28,42,56,70,90].forEach(function(t){ curva.push({x:t, y:+predecirLineal(m.beta, vectorCaracteristicas(amc, t, he, cem, fa)).toFixed(1)}); });
  var similares = m.filas.filter(function(r){ return Math.abs(Number(r.f.amc) - amc) <= 0.05 && (r.f.cementoTipo === 'HE' ? 1 : 0) === he; })
    .map(function(r){ return {x:r.f.edad, y:r.y}; });
  predCharts.sim = new Chart(document.getElementById('chart-pred-sim'), {
    type:'line',
    data:{datasets:[
      {label:'Estimación del modelo', data:curva, borderColor:COLOR_PRIMARIO, backgroundColor:'rgba(3,150,200,.12)', fill:true, tension:.3, pointRadius:2, borderWidth:2.5},
      {label:'Resultados históricos similares (a/mc ±0.05)', data:similares, type:'scatter', backgroundColor:'rgba(46,158,87,.7)', pointRadius:4}
    ]},
    options:{responsive:true, maintainAspectRatio:false, scales:{x:{type:'linear', min:0, max:92, title:{display:true, text:'Edad (días)'}}, y:{beginAtZero:true, title:{display:true, text:'kg/cm²'}}},
      plugins:{legend:{position:'bottom', labels:{boxWidth:10}}}}
  });
}
['sim-amc','sim-cemento','sim-cemento-kg','sim-flyash','sim-edad'].forEach(function(id){
  document.getElementById(id).addEventListener(document.getElementById(id).tagName === 'SELECT' ? 'change' : 'input', renderSimulador);
});
var predTab = 'madurez';
document.getElementById('pred-tabs').addEventListener('click', function(e){
  var b = e.target.closest('[data-predtab]');
  if(!b) return;
  predTab = b.dataset.predtab;
  document.querySelectorAll('#pred-tabs .subtab').forEach(function(x){ x.classList.toggle('active', x === b); });
  document.getElementById('pred-madurez').style.display = predTab === 'madurez' ? 'block' : 'none';
  document.getElementById('pred-simulador').style.display = predTab === 'simulador' ? 'block' : 'none';
  if(predTab === 'simulador') renderSimulador(); else renderPrediccionMadurez();
});
PANEL_HOOKS.prediccion = function(){
  modeloSimulador = null; // se reentrena con los datos actuales cada vez que se entra
  if(predTab === 'simulador') renderSimulador(); else renderPrediccionMadurez();
};
