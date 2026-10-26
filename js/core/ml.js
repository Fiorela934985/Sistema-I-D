/* Sistema I+D — Aprendizaje automático sobre la base histórica.
   - Gradient boosting de árboles de regresión (misma familia que XGBoost), entrenado en el navegador.
   - Validación "dejando un diseño afuera": cada diseño se predice con un modelo que nunca vio sus filas,
     así el error reportado es el que se espera con un diseño nuevo (las réplicas y edades de un mismo
     diseño están correlacionadas; mezclarlas entre entrenamiento y prueba daría un error optimista).
   - Se compara contra dos referencias (regresión ridge y promedio por edad) y se activa el que menos se equivoca.
   - Registro de modelos entrenados y seguimiento de predicciones contra el resultado real. */
'use strict';

/* ================= Características de cada diseño ================= */
var ML_FEATURES = [
  {k:'amc', t:'Relación a/mc'},
  {k:'edad', t:'Edad (días)'},
  {k:'lnEdad', t:'ln(edad)'},
  {k:'he', t:'Cemento HE'},
  {k:'cementante', t:'Cementante (kg/m³)'},
  {k:'flyAshPct', t:'Fly Ash (% del cementante)'},
  {k:'agua', t:'Agua (kg/m³)'},
  {k:'aditivoPct', t:'Aditivo (% del cementante)'}
];
function esAditivo(nombre){
  var nom = String(nombre || '').toUpperCase();
  if(componentes.some(function(c){ return c.categoria === 'Aditivo' && c.nombre.toUpperCase() === nom; })) return true;
  return /RHEOBUILD|SIKA|PLASTIMENT|DNHE|ADITIVO|POLYHEED|GLENIUM|VISCOCRETE/.test(nom);
}
/* Variables de mezcla de un diseño (independientes de la edad). null si falta lo esencial. */
function caracteristicasDiseno(d){
  var amc = n(d.amcEfectiva);
  if(!(amc > 0)) return null;
  var mix = (d.mix || []).filter(function(it){ return n(it.pesoSeco) > 0; });
  var cemento = contenidoCemento(d);
  var flyAsh = mix.filter(function(it){ return /FLY\s*ASH|CENIZA/i.test(it.nombre); }).reduce(function(a, it){ return a + n(it.pesoSeco); }, 0);
  var cementante = (isFinite(cemento) ? cemento : 0) + flyAsh;
  var agua = mix.filter(function(it){ return /^AGUA|HIELO/i.test(it.nombre); }).reduce(function(a, it){ return a + n(it.pesoSeco); }, 0);
  var aditivo = mix.filter(function(it){ return esAditivo(it.nombre); }).reduce(function(a, it){ return a + n(it.pesoSeco); }, 0);
  if(!(cementante > 0)) cementante = agua > 0 ? agua / amc : NaN;
  if(!(agua > 0) && cementante > 0) agua = amc * cementante;
  return {amc:amc, he: tipoCementoNormalizado(d) === 'HE' ? 1 : 0, cementante:cementante,
    flyAshPct: cementante > 0 ? flyAsh / cementante * 100 : 0, agua:agua,
    aditivoPct: cementante > 0 ? aditivo / cementante * 100 : 0};
}
function vectorML(c, edad){
  return [c.amc, edad, Math.log(Math.max(1, edad)), c.he, c.cementante, c.flyAshPct, c.agua, c.aditivoPct];
}
/* Filas de entrenamiento: una por diseño y edad con resultado real (sin diseños de demostración). */
function filasEntrenamientoML(){
  var demo = {};
  disenosDeDemostracion().forEach(function(d){ demo[d.codigo] = true; });
  var filas = [];
  disenos.forEach(function(d){
    if(demo[d.codigo]) return;
    var c = caracteristicasDiseno(d);
    if(!c || !isFinite(c.cementante)) return;
    var r = resistenciaPorEdad(d);
    Object.keys(r).forEach(function(e){
      var edad = Number(e), y = r[e];
      if(edad > 0 && isFinite(y) && y > 0) filas.push({x: vectorML(c, edad), y: y, grupo: d.codigo, edad: edad, nombre: diseñoTitulo(d)});
    });
  });
  return filas;
}

/* ================= Gradient boosting ================= */
function rngSemilla(semilla){ // mulberry32: reproducible, mismo modelo con los mismos datos
  var a = semilla >>> 0;
  return function(){ a = (a + 0x6D2B79F5) >>> 0; var t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function construirArbol(X, r, idx, prof, p, importancia){
  var suma = 0;
  idx.forEach(function(i){ suma += r[i]; });
  var hoja = suma / idx.length;
  if(prof >= p.profundidad || idx.length < 2 * p.minHoja) return hoja;
  var mejor = null, base = suma * suma / idx.length;
  for(var f = 0; f < X[0].length; f++){
    var orden = idx.slice().sort(function(a, b){ return X[a][f] - X[b][f]; });
    var sIzq = 0;
    for(var k = 0; k < orden.length - 1; k++){
      sIzq += r[orden[k]];
      var nIzq = k + 1, nDer = orden.length - nIzq;
      if(nIzq < p.minHoja || nDer < p.minHoja) continue;
      var xa = X[orden[k]][f], xb = X[orden[k + 1]][f];
      if(xa === xb) continue;
      var sDer = suma - sIzq;
      var ganancia = sIzq * sIzq / nIzq + sDer * sDer / nDer - base;
      if(!mejor || ganancia > mejor.g) mejor = {g: ganancia, f: f, t: (xa + xb) / 2, k: k, orden: orden};
    }
  }
  if(!mejor || mejor.g <= 1e-9) return hoja;
  importancia[mejor.f] += mejor.g;
  return [mejor.f, mejor.t,
    construirArbol(X, r, mejor.orden.slice(0, mejor.k + 1), prof + 1, p, importancia),
    construirArbol(X, r, mejor.orden.slice(mejor.k + 1), prof + 1, p, importancia)];
}
function evaluarArbol(nodo, x){
  while(typeof nodo !== 'number'){ nodo = x[nodo[0]] <= nodo[1] ? nodo[2] : nodo[3]; }
  return nodo;
}
function entrenarGBM(filas, p){
  var X = filas.map(function(f){ return f.x; }), y = filas.map(function(f){ return f.y; });
  var base = promedio(y);
  var F = y.map(function(){ return base; });
  var arboles = [], importancia = ML_FEATURES.map(function(){ return 0; });
  var rng = rngSemilla(20261025);
  for(var m = 0; m < p.arboles; m++){
    var r = y.map(function(v, i){ return v - F[i]; });
    var idx = [];
    for(var i = 0; i < X.length; i++){ if(rng() < p.submuestra) idx.push(i); }
    if(idx.length < 2 * p.minHoja) idx = X.map(function(_, j){ return j; });
    var arbol = construirArbol(X, r, idx, 0, p, importancia);
    arboles.push(arbol);
    for(var j = 0; j < X.length; j++) F[j] += p.tasa * evaluarArbol(arbol, X[j]);
  }
  return {tipo:'gbm', base: base, tasa: p.tasa, arboles: arboles, params: p, importancia: importancia};
}
function predecirGBM(modelo, x){
  var s = modelo.base;
  for(var i = 0; i < modelo.arboles.length; i++) s += modelo.tasa * evaluarArbol(modelo.arboles[i], x);
  return s;
}

/* ================= Referencias para comparar ================= */
function resolverLineal(A, b){
  var N = b.length, M = A.map(function(fila, i){ return fila.concat([b[i]]); });
  for(var c = 0; c < N; c++){
    var piv = c;
    for(var r = c + 1; r < N; r++) if(Math.abs(M[r][c]) > Math.abs(M[piv][c])) piv = r;
    var tmp = M[c]; M[c] = M[piv]; M[piv] = tmp;
    if(Math.abs(M[c][c]) < 1e-12) continue;
    for(var r2 = 0; r2 < N; r2++){
      if(r2 === c) continue;
      var f = M[r2][c] / M[c][c];
      for(var k = c; k <= N; k++) M[r2][k] -= f * M[c][k];
    }
  }
  return M.map(function(fila, i){ return Math.abs(fila[i]) < 1e-12 ? 0 : fila[N] / fila[i]; });
}
function entrenarRidgeML(filas, lambda){
  // Variables estandarizadas + interacción HE × ln(edad) y a/mc × ln(edad)
  var expand = function(x){ return x.concat([x[3] * x[2], x[0] * x[2]]); };
  var X = filas.map(function(f){ return expand(f.x); }), y = filas.map(function(f){ return f.y; });
  var p = X[0].length;
  var med = [], des = [];
  for(var j = 0; j < p; j++){
    var col = X.map(function(x){ return x[j]; });
    med[j] = promedio(col);
    des[j] = Math.sqrt(promedio(col.map(function(v){ return (v - med[j]) * (v - med[j]); }))) || 1;
  }
  var Z = X.map(function(x){ return [1].concat(x.map(function(v, j){ return (v - med[j]) / des[j]; })); });
  var A = [], b = [];
  for(var a = 0; a <= p; a++){
    A.push([]); b.push(0);
    for(var c = 0; c <= p; c++){
      var s = 0;
      for(var r = 0; r < Z.length; r++) s += Z[r][a] * Z[r][c];
      A[a].push(s + (a === c && a > 0 ? lambda : 0));
    }
    for(var r3 = 0; r3 < Z.length; r3++) b[a] += Z[r3][a] * y[r3];
  }
  return {tipo:'ridge', beta: resolverLineal(A, b), med: med, des: des};
}
function predecirRidgeML(m, x){
  var xe = x.concat([x[3] * x[2], x[0] * x[2]]);
  return m.beta[0] + xe.reduce(function(acc, v, j){ return acc + m.beta[j + 1] * (v - m.med[j]) / m.des[j]; }, 0);
}
function entrenarPromedioEdad(filas){
  var porEdad = {};
  filas.forEach(function(f){ (porEdad[f.edad] = porEdad[f.edad] || []).push(f.y); });
  var tabla = {};
  Object.keys(porEdad).forEach(function(e){ tabla[e] = promedio(porEdad[e]); });
  return {tipo:'promedio', tabla: tabla, global: promedio(filas.map(function(f){ return f.y; }))};
}
function predecirPromedioEdad(m, x){
  var edad = x[1];
  if(isFinite(m.tabla[edad])) return m.tabla[edad];
  var edades = Object.keys(m.tabla).map(Number).sort(function(a, b){ return Math.abs(a - edad) - Math.abs(b - edad); });
  return edades.length ? m.tabla[edades[0]] : m.global;
}
var ML_ALGORITMOS = {
  gbm: {nombre:'Gradient boosting (árboles)', entrenar: function(filas, p){ return entrenarGBM(filas, p); }, predecir: predecirGBM},
  ridge: {nombre:'Regresión ridge', entrenar: function(filas){ return entrenarRidgeML(filas, 1); }, predecir: predecirRidgeML},
  promedio: {nombre:'Promedio por edad (referencia)', entrenar: function(filas){ return entrenarPromedioEdad(filas); }, predecir: predecirPromedioEdad}
};

/* ================= Validación dejando un diseño afuera ================= */
function metricasError(pares){
  var errs = pares.map(function(p){ return p.pred - p.real; });
  var reales = pares.map(function(p){ return p.real; });
  var media = promedio(reales);
  var ssRes = errs.reduce(function(a, e){ return a + e * e; }, 0);
  var ssTot = reales.reduce(function(a, v){ return a + (v - media) * (v - media); }, 0);
  return {n: pares.length,
    mae: promedio(errs.map(Math.abs)),
    rmse: Math.sqrt(ssRes / Math.max(1, pares.length)),
    r2: ssTot ? 1 - ssRes / ssTot : NaN,
    mape: promedio(pares.map(function(p){ return Math.abs(p.pred - p.real) / p.real * 100; }))};
}
function validarDejandoUnDisenoAfuera(filas, algoritmo, params){
  var grupos = {};
  filas.forEach(function(f){ grupos[f.grupo] = true; });
  var pares = [];
  Object.keys(grupos).forEach(function(g){
    var train = filas.filter(function(f){ return f.grupo !== g; });
    var test = filas.filter(function(f){ return f.grupo === g; });
    if(train.length < 8) return;
    var m = ML_ALGORITMOS[algoritmo].entrenar(train, params);
    test.forEach(function(f){ pares.push({grupo: g, nombre: f.nombre, edad: f.edad, real: f.y, pred: ML_ALGORITMOS[algoritmo].predecir(m, f.x)}); });
  });
  return {pares: pares, metricas: metricasError(pares)};
}

/* ================= Entrenamiento completo y registro ================= */
var MODELOS_MAX = 12;
var modelosML = load('sid_modelos', []);
function saveModelos(){ save('sid_modelos', modelosML); }
function modeloActivo(){ return modelosML.filter(function(m){ return m.activo; })[0] || null; }

function entrenarModeloHistorico(){
  var filas = filasEntrenamientoML();
  var nDis = {}; filas.forEach(function(f){ nDis[f.grupo] = true; });
  if(filas.length < 12 || Object.keys(nDis).length < 4){
    return {error: 'Se necesitan al menos 4 diseños reales con roturas registradas (hay ' + Object.keys(nDis).length + ' diseños y ' + filas.length + ' resultados).'};
  }
  // Pequeña búsqueda de hiperparámetros, elegida por el error con diseños no vistos
  var grilla = [
    {arboles:150, tasa:0.08, profundidad:2, minHoja:4, submuestra:0.8},
    {arboles:300, tasa:0.05, profundidad:2, minHoja:4, submuestra:0.8},
    {arboles:200, tasa:0.06, profundidad:3, minHoja:4, submuestra:0.8},
    {arboles:400, tasa:0.04, profundidad:3, minHoja:5, submuestra:0.8}
  ];
  var candidatos = grilla.map(function(p){ var v = validarDejandoUnDisenoAfuera(filas, 'gbm', p); return {algoritmo:'gbm', params:p, validacion:v}; });
  candidatos.push({algoritmo:'ridge', params:{lambda:1}, validacion: validarDejandoUnDisenoAfuera(filas, 'ridge')});
  candidatos.push({algoritmo:'promedio', params:{}, validacion: validarDejandoUnDisenoAfuera(filas, 'promedio')});
  candidatos.sort(function(a, b){ return a.validacion.metricas.mae - b.validacion.metricas.mae; });
  var ganador = candidatos[0];
  var modelo = ML_ALGORITMOS[ganador.algoritmo].entrenar(filas, ganador.params);
  var comparacion = {};
  candidatos.forEach(function(c){
    var clave = c.algoritmo === 'gbm' ? 'gbm' : c.algoritmo;
    if(!comparacion[clave] || c.validacion.metricas.mae < comparacion[clave].mae) comparacion[clave] = c.validacion.metricas;
  });
  var registro = {
    id: 'm' + Date.now(), fecha: Date.now(), usuario: usuarioActual ? usuarioActual.usuario : '',
    algoritmo: ganador.algoritmo, nombre: ML_ALGORITMOS[ganador.algoritmo].nombre, params: ganador.params,
    modelo: modelo, filas: filas.length, disenos: Object.keys(nDis).length,
    metricas: ganador.validacion.metricas, comparacion: comparacion,
    validacion: ganador.validacion.pares.map(function(p){ return {g:p.grupo, nom:p.nombre, e:p.edad, r:+p.real.toFixed(1), p:+p.pred.toFixed(1)}; }),
    rangos: ML_FEATURES.map(function(_, j){ var col = filas.map(function(f){ return f.x[j]; }); return [Math.min.apply(null, col), Math.max.apply(null, col)]; }),
    activo: true
  };
  modelosML.forEach(function(m){ m.activo = false; });
  modelosML.unshift(registro);
  if(modelosML.length > MODELOS_MAX) modelosML.length = MODELOS_MAX;
  saveModelos();
  registrarHistorial('Entrenó', 'Modelo', registro.nombre + ' · ' + registro.disenos + ' diseños · error medio ±' + fmt(registro.metricas.mae, 1) + ' kg/cm²');
  return registro;
}
/* Asegura que haya un modelo entrenado con los datos actuales (reentrena si cambió la base). */
function firmaDatosML(){ var f = filasEntrenamientoML(); return f.length + ':' + Math.round(f.reduce(function(a, x){ return a + x.y; }, 0)); }
function asegurarModelo(){
  var m = modeloActivo();
  if(m && m.firma === firmaDatosML()) return m;
  var nuevo = entrenarModeloHistorico();
  if(nuevo.error) return m || nuevo;
  nuevo.firma = firmaDatosML();
  saveModelos();
  return nuevo;
}
/* Predicción con el modelo activo. Edad en días; curva monótona (la resistencia no baja con la edad). */
function predecirResistencia(entrada, modelo){
  modelo = modelo || asegurarModelo();
  if(!modelo || modelo.error) return {error: modelo ? modelo.error : 'Sin modelo'};
  var c = {amc: n(entrada.amc), he: entrada.cemento === 'HE' ? 1 : 0, cementante: n(entrada.cementante) || 350,
    flyAshPct: n(entrada.flyAshPct), aditivoPct: n(entrada.aditivoPct)};
  c.agua = n(entrada.agua) || c.amc * c.cementante;
  var alg = ML_ALGORITMOS[modelo.algoritmo];
  var edad = Math.max(1, n(entrada.edad) || 28);
  var edades = [1, 2, 3, 5, 7, 10, 14, 21, 28, 42, 56, 70, 90];
  if(edades.indexOf(edad) === -1) edades.push(edad);
  edades.sort(function(a, b){ return a - b; });
  var max = -Infinity;
  var curva = edades.map(function(t){ max = Math.max(max, alg.predecir(modelo.modelo, vectorML(c, t))); return {x: t, y: +max.toFixed(1)}; });
  var valor = curva.filter(function(p){ return p.x === edad; })[0].y;
  var fuera = [];
  var x = vectorML(c, edad);
  ML_FEATURES.forEach(function(ft, j){
    var r = modelo.rangos && modelo.rangos[j];
    if(r && (x[j] < r[0] - 1e-9 || x[j] > r[1] + 1e-9)) fuera.push(ft.t + ' (' + fmt(x[j], 2) + '; datos entre ' + fmt(r[0], 2) + ' y ' + fmt(r[1], 2) + ')');
  });
  return {valor: valor, curva: curva, mae: modelo.metricas.mae, modelo: modelo, fueraDeRango: fuera};
}

/* ================= Curva de madurez ================= */
function ratioACI(t, tipoCemento){ return tipoCemento === 'HE' ? t / (2.3 + 0.92 * t) : t / (4 + 0.85 * t); }
function ajustarCurvaMadurez(pts, tipo){
  pts = pts.filter(function(p){ return p.t > 0 && isFinite(p.y); }).sort(function(a, b){ return a.t - b.t; });
  if(!pts.length) return null;
  if(pts.length === 1){
    var f28 = pts[0].y / ratioACI(pts[0].t, tipo);
    return {pts: pts, metodo: 'Relación ACI 209 (una sola edad medida)', predecir: function(t){ return f28 * ratioACI(t, tipo); }, r2: null};
  }
  var xs = pts.map(function(p){ return Math.log(p.t); }), ys = pts.map(function(p){ return p.y; });
  var mx = promedio(xs), my = promedio(ys), sxy = 0, sxx = 0, sst = 0;
  xs.forEach(function(x, i){ sxy += (x - mx) * (ys[i] - my); sxx += (x - mx) * (x - mx); sst += (ys[i] - my) * (ys[i] - my); });
  var b = sxx ? sxy / sxx : 0, a = my - b * mx;
  var sse = xs.reduce(function(acc, x, i){ var e = ys[i] - (a + b * x); return acc + e * e; }, 0);
  // Si la pendiente sale negativa (datos ruidosos), se usa la relación ACI con la última edad medida
  if(b < 0){
    var ult = pts[pts.length - 1], f = ult.y / ratioACI(ult.t, tipo);
    return {pts: pts, metodo: 'Relación ACI 209 (los puntos no muestran crecimiento)', predecir: function(t){ return f * ratioACI(t, tipo); }, r2: null};
  }
  return {pts: pts, metodo: 'Ajuste logarítmico con ' + pts.length + ' edades', a: a, b: b, predecir: function(t){ return a + b * Math.log(t); }, r2: sst ? 1 - sse / sst : null};
}
/* Prueba retrospectiva: ¿cuánto se habría equivocado la curva al proyectar 28 d sin ver el resultado de 28 d? */
function backtestMadurez(){
  var demo = {}; disenosDeDemostracion().forEach(function(d){ demo[d.codigo] = true; });
  var pares = [];
  disenos.forEach(function(d){
    if(demo[d.codigo]) return;
    var r = resistenciaPorEdad(d);
    if(!isFinite(r[28])) return;
    var pts = Object.keys(r).map(Number).filter(function(t){ return t < 28; }).map(function(t){ return {t: t, y: r[t]}; });
    if(!pts.length) return;
    var aj = ajustarCurvaMadurez(pts, tipoCementoNormalizado(d));
    pares.push({grupo: d.codigo, nombre: diseñoTitulo(d), edad: 28, real: r[28], pred: aj.predecir(28), edadesUsadas: pts.map(function(p){ return p.t; }).join(', ')});
  });
  return {pares: pares, metricas: pares.length ? metricasError(pares) : null};
}

/* ================= Seguimiento: predicción guardada vs resultado real ================= */
var prediccionesML = load('sid_predicciones', []);
function savePrediccionesML(){ save('sid_predicciones', prediccionesML); }
function registrarPrediccion(codigo, metodo, valor, detalle){
  if(!isFinite(valor)) return;
  if(prediccionesML.some(function(p){ return p.codigo === codigo && p.metodo === metodo && p.edad === 28; })) return;
  prediccionesML.unshift({codigo: codigo, metodo: metodo, edad: 28, valor: +valor.toFixed(1), fecha: Date.now(), detalle: detalle || ''});
  if(prediccionesML.length > 500) prediccionesML.length = 500;
  savePrediccionesML();
}
function seguimientoPredicciones(){
  return prediccionesML.map(function(p){
    var d = disenoPorCodigo(p.codigo);
    var real = d ? resistenciaPorEdad(d)[28] : NaN;
    return {pred: p, diseno: d, real: real, error: isFinite(real) ? p.valor - real : NaN};
  });
}

/* Importancia por permutación (sirve para cualquier modelo): cuánto aumenta el error medio si se mezclan
   al azar los valores de una variable, rompiendo su relación con la resistencia. */
function importanciaPermutacion(registro){
  var filas = filasEntrenamientoML();
  if(!filas.length) return [];
  var alg = ML_ALGORITMOS[registro.algoritmo];
  var maeDe = function(X){ return promedio(X.map(function(x, i){ return Math.abs(alg.predecir(registro.modelo, x) - filas[i].y); })); };
  var base = maeDe(filas.map(function(f){ return f.x; }));
  var rng = rngSemilla(7);
  return ML_FEATURES.map(function(ft, j){
    var aumentos = [];
    for(var rep = 0; rep < 5; rep++){
      var col = filas.map(function(f){ return f.x[j]; });
      for(var i = col.length - 1; i > 0; i--){ var k = Math.floor(rng() * (i + 1)); var t = col[i]; col[i] = col[k]; col[k] = t; }
      aumentos.push(maeDe(filas.map(function(f, i){ var x = f.x.slice(); x[j] = col[i]; return x; })) - base);
    }
    return {t: ft.t, v: Math.max(0, promedio(aumentos))};
  });
}
