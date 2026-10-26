/* Sistema I+D — Asistente I+D: preguntas en lenguaje natural respondidas con los datos registrados.
   Funciona 100 % en el navegador: detecta la intención y las entidades (proyecto, diseño, edad) y
   consulta la misma analítica que usan los paneles; si no reconoce la intención, busca por similitud. */
'use strict';

var chatLog = [];
var PALABRAS_VACIAS = ['de','la','el','los','las','del','y','en','a','al','que','con','para','por','un','una','me','mi','es','se','lo','como','cual','cuales','cuanto','cuantos','cuantas','hay','tengo','tiene','sobre','estudio','proyecto','diseno','disenos','resistencia','dame','dime','muestra','mostrar','ver','quiero','saber'];
function tokens(s){ return normalizar(s).replace(/[^a-z0-9.\/ -]/g,' ').split(/[\s\/-]+/).filter(function(t){ return t && PALABRAS_VACIAS.indexOf(t) === -1; }); }

/* ---------- Detección de entidades ---------- */
function detectarProyecto(q){
  var qn = ' ' + normalizar(q).replace(/[^a-z0-9.]+/g,' ') + ' ';
  var mejor = null;
  nombresDeProyectos().forEach(function(p){
    var pn = normalizar(p).replace(/[^a-z0-9.]+/g,' ').trim();
    var score;
    if(qn.indexOf(' ' + pn + ' ') > -1) score = 10 + pn.length;           // nombre completo
    else {
      var tk = tokens(p);
      if(!tk.length) return;
      var hits = tk.filter(function(t){ return qn.indexOf(' ' + t + ' ') > -1; }).length;
      score = hits / tk.length >= 0.6 ? hits / tk.length * 5 + hits : 0;
    }
    if(score > 0 && (!mejor || score > mejor.score)) mejor = {nombre:p, score:score};
  });
  return mejor ? mejor.nombre : null;
}
function detectarDisenos(q){
  var qn = normalizar(q);
  var out = [];
  var vistos = {};
  function add(d){ if(d && !vistos[d.codigo]){ vistos[d.codigo] = true; out.push(d); } }
  (qn.match(/did-?\s?\d{1,4}/g) || []).forEach(function(m){ add(disenoPorCodigo('DID-' + pad4(m.replace(/\D/g,'')))); });
  (qn.match(/\br-?\s?\d{1,3}\b/g) || []).forEach(function(m){ add(disenos.filter(function(d){ return normalizar(d.recetaId) === 'r-' + m.replace(/\D/g,''); })[0]); });
  (qn.match(/\bid-?\s?\d{1,4}\b/g) || []).forEach(function(m){
    var cod = 'ID-' + pad4(m.replace(/\D/g,''));
    var c = roturaCargas.filter(function(x){ return x.codigo === cod; })[0];
    if(c) add(disenoPorCodigo(c.disenoCodigoDiseno));
  });
  disenos.forEach(function(d){
    var nom = normalizar(diseñoTitulo(d));
    if(nom.length >= 6 && qn.indexOf(nom) > -1) add(d);
  });
  return out;
}
function detectarEdad(q){
  var m = normalizar(q).match(/(\d{1,3})\s*(d\b|dias?\b|día)/);
  return m ? Number(m[1]) : null;
}

/* ---------- Respuestas ---------- */
function btnAccion(texto, attrs){ return '<button class="chat-accion" '+attrs+'>'+texto+'</button>'; }
function listaRoturasHtml(lista, max){
  max = max || 8;
  return '<ul class="chat-lista">' + lista.slice(0, max).map(function(c){
    return '<li><b>'+esc(c.codigo)+'</b> · '+esc(c.replicaNombre)+' · día '+c.dia+' · '+isoToDMY(c.fechaEnsayo)+' <span class="nota-sm">('+esc(c.proyecto||'-')+')</span></li>';
  }).join('') + '</ul>' + (lista.length > max ? '<p class="nota-sm">… y '+(lista.length-max)+' más.</p>' : '');
}
function resumenDisenoHtml(d){
  var r = resistenciaPorEdad(d);
  var edades = Object.keys(r).map(Number).sort(function(a,b){ return a-b; });
  var cs = cargasDeDiseno(d), ok = cs.filter(function(c){ return c.estado === 'completado'; }).length;
  return '<p><b>'+esc(diseñoTitulo(d))+'</b> ('+esc(d.codigo)+') · '+esc(proyectoNombre(d.proyectoId)||'Sin proyecto')+' / '+esc(d.iteracionId||'-')+'</p>' +
    '<p>Estado: <b>'+esc(d.estado)+'</b> · f\'c '+(n(d.fc)||'-')+' kg/cm² · a/mc '+esc(d.amcEfectiva||'-')+' · CVD S/. '+fmt(n(d.cvdTotal),2)+' · roturas '+ok+'/'+cs.length+'</p>' +
    (edades.length ? '<p>Resistencia: ' + edades.map(function(e){ return '<b>'+e+' d</b> '+fmt(r[e],1); }).join(' · ') + ' kg/cm²</p>' : '<p>Todavía no tiene roturas registradas.</p>') +
    '<div class="chat-acciones">' + btnAccion('Ver informe', 'data-chat-informe="'+esc(d.codigo)+'"') + btnAccion('Expediente del proyecto', 'data-chat-exp="'+esc(proyectoNombre(d.proyectoId))+'"') + '</div>';
}
function resumenProyectoHtml(nombre, edad){
  var m = metricasProyecto(nombre);
  var porEdad = {};
  m.disenos.forEach(function(d){ var r = resistenciaPorEdad(d); Object.keys(r).forEach(function(e){ (porEdad[e] = porEdad[e] || []).push(r[e]); }); });
  var edades = Object.keys(porEdad).map(Number).sort(function(a,b){ return a-b; });
  var txtEdad = edad && porEdad[edad] ? '<p>Resistencia promedio a <b>'+edad+' días</b>: <b>'+fmt(promedio(porEdad[edad]),1)+' kg/cm²</b> ('+porEdad[edad].length+' diseños).</p>' : '';
  return '<p>Proyecto <b>'+esc(nombre)+'</b> · '+esc(m.estado)+'</p>' +
    '<p>'+m.nDisenos+' diseños ('+m.completados+' completados) en '+m.iteraciones.length+' iteraciones · roturas '+m.cargasCompletas+'/'+m.cargas.length+(m.vencidas?' · <b class="txt-rojo">'+m.vencidas+' vencidas</b>':'')+'</p>' +
    txtEdad +
    (edades.length ? '<p>Promedio por edad: ' + edades.map(function(e){ return '<b>'+e+' d</b> '+fmt(promedio(porEdad[e]),1); }).join(' · ') + ' kg/cm²</p>' : '') +
    (m.proximaRotura ? '<p>Próxima rotura: '+isoToDMY(m.proximaRotura)+'</p>' : '') +
    '<div class="chat-acciones">' + btnAccion('Abrir expediente', 'data-chat-exp="'+esc(nombre)+'"') + btnAccion('Comparar iteraciones', 'data-chat-exp="'+esc(nombre)+'" data-chat-tab="comparativo"') + '</div>';
}
/* ---------- Respuestas ampliadas (motor local) ---------- */
var chatContexto = {disenos: [], proyecto: null};
function esDisenoReal(d){ return !disenosDeDemostracion().some(function(x){ return x.codigo === d.codigo; }); }
function disenosFiltrados(proyecto){ return disenos.filter(function(d){ return esDisenoReal(d) && (!proyecto || proyectoNombre(d.proyectoId) === proyecto); }); }
function tablaHtml(cab, filas){
  return '<table class="data-table chat-tabla"><thead><tr>' + cab.map(function(c){ return '<th>'+c+'</th>'; }).join('') + '</tr></thead><tbody>' +
    filas.map(function(f){ return '<tr>' + f.map(function(c){ return '<td>'+c+'</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table>';
}
function tasaTexto(acierto){ return isFinite(acierto) ? 'Tasa de acierto <b>'+fmt(acierto,0)+' %</b> · tasa de error <b>'+fmt(100-acierto,0)+' %</b> (±'+ML_TOLERANCIA+' %)' : ''; }
function promedioPorEdad(lista){
  var porEdad = {};
  lista.forEach(function(d){ var r = resistenciaPorEdad(d); Object.keys(r).forEach(function(e){ (porEdad[e] = porEdad[e] || []).push(r[e]); }); });
  return porEdad;
}
function compararGrupos(nombreA, a, nombreB, b){
  var pa = promedioPorEdad(a), pb = promedioPorEdad(b), eds = {};
  Object.keys(pa).concat(Object.keys(pb)).forEach(function(e){ eds[e] = true; });
  var le = Object.keys(eds).map(Number).sort(function(x,y){ return x-y; });
  if(!le.length) return '<p>No hay resultados para comparar.</p>';
  return tablaHtml(['Edad', nombreA+' ('+a.length+')', nombreB+' ('+b.length+')', 'Diferencia'], le.map(function(e){
    var va = promedio(pa[e] || []), vb = promedio(pb[e] || []);
    return [e+' d', isFinite(va) ? fmt(va,1) : '-', isFinite(vb) ? fmt(vb,1) : '-', isFinite(va) && isFinite(vb) ? (va-vb>0?'+':'')+fmt(va-vb,1)+' ('+fmt((va-vb)/vb*100,0)+' %)' : '-'];
  }));
}
/* a/mc necesaria para alcanzar una resistencia, buscando con el modelo entrenado. */
function amcParaResistencia(objetivo, edad, he, flyAsh, cementante){
  var mejor = null;
  for(var amc = 0.30; amc <= 0.90001; amc += 0.01){
    var p = predecirResistencia({amc: +amc.toFixed(2), cemento: he ? 'HE' : 'I', cementante: cementante, flyAshPct: flyAsh, aditivoPct: 1, edad: edad});
    if(p.error) return {error: p.error};
    if(p.valor >= objetivo) mejor = {amc: +amc.toFixed(2), valor: p.valor, pred: p};
  }
  return mejor || {sinSolucion: true};
}
function responderAmpliado(q, pregunta, proyecto, dis, edad){
  // Nombres de proyecto que contienen HE o fly ash se confunden con la pregunta: solo filtran si se piden explícitamente.
  var proyExplicito = /proyecto|\ben\b/.test(q) ? proyecto : null;
  // Precisión del modelo
  if(/(precision|exactitud|exact[oa]|acierto|confiable|que tan (bien|buen)|tasa de error|margen de error)/.test(q) && /(predic|modelo|estim|proyecc)/.test(q)){
    var m = asegurarModelo();
    if(!m || m.error) return '<p>'+esc(m ? m.error : 'Todavía no hay modelo entrenado.')+'</p>';
    var bt = backtestMadurez();
    return '<p>Modelo activo: <b>'+esc(m.nombre)+'</b>, entrenado con '+m.disenos+' diseños reales ('+m.filas+' resultados).</p>' +
      tablaHtml(['Caso', 'Acierto', 'Error', 'Error medio'], [
        ['Diseño nuevo', '<b>'+fmt(m.metricas.acierto,0)+' %</b>', fmt(m.metricas.tasaError,0)+' %', '±'+fmt(m.metricas.mae,1)+' kg/cm²'],
        m.calibrado ? ['Diseño con roturas tempranas', '<b>'+fmt(m.calibrado.acierto,0)+' %</b>', fmt(m.calibrado.tasaError,0)+' %', '±'+fmt(m.calibrado.mae,1)+' kg/cm²'] : null,
        bt.metricas ? ['Curva logarítmica a 28 d', fmt(bt.metricas.acierto,0)+' %', fmt(bt.metricas.tasaError,0)+' %', '±'+fmt(bt.metricas.mae,1)+' kg/cm²'] : null
      ].filter(Boolean)) +
      '<p class="nota-sm">Acierto = predicción dentro de ±'+ML_TOLERANCIA+' % del resultado real, medido con diseños que el modelo no vio.</p>' +
      '<div class="chat-acciones">'+btnAccion('Ver precisión', 'data-goto="prediccion"')+'</div>';
  }
  // ¿Qué a/mc necesito para X kg/cm²?
  var obj = q.match(/(\d{3})\s*(kg|kgf|de f'?c|f'?c)?/);
  if(/(que|cual|cuanta|necesito|requiero|para (llegar|alcanzar|lograr))/.test(q) && /a\s*\/?\s*m?c|relacion agua/.test(q) && obj){
    var objetivo = Number(obj[1]), e = edad || 28, he = /\bhe\b/.test(q);
    var faM = q.match(/(\d{1,2})\s*%\s*(de\s*)?(fly|ceniza)/), fa = faM ? Number(faM[1]) : 0;
    var r = amcParaResistencia(objetivo, e, he, fa, 350);
    if(r.error) return '<p>'+esc(r.error)+'</p>';
    if(r.sinSolucion) return '<p>Con los datos actuales el modelo no llega a <b>'+objetivo+' kg/cm²</b> a '+e+' días ni con a/mc 0.30'+(he?'':'. Probá con cemento HE')+'.</p>';
    return '<p>Para <b>'+objetivo+' kg/cm²</b> a '+e+' días con cemento <b>'+(he?'HE':'Tipo I')+'</b>'+(fa?' y '+fa+' % de fly ash':'')+', el modelo sugiere una a/mc de hasta <b>'+r.amc.toFixed(2)+'</b> (estima '+fmt(r.valor,1)+' kg/cm²).</p>' +
      '<p class="nota-sm">'+tasaTexto(r.pred.acierto)+'. Conviene dejar margen de ±'+fmt(r.pred.mae,0)+' kg/cm².</p>' +
      '<div class="chat-acciones">'+btnAccion('Abrir simulador', 'data-goto="prediccion"')+'</div>';
  }
  // Indicadores generales
  if(/(kpi|indicador|resumen general|como vamos|como va el laboratorio|estado (general|del laboratorio)|panorama)/.test(q)){
    var reales = disenosFiltrados(proyecto), k = kpisCalidad(reales), hoy = todayISO();
    var pend = roturaCargas.filter(function(c){ return c.estado === 'pendiente' && (!proyecto || c.proyecto === proyecto); });
    return '<p>Resumen'+(proyecto?' de <b>'+esc(proyecto)+'</b>':' del laboratorio')+':</p><ul class="chat-lista">' +
      '<li><b>'+reales.length+'</b> diseños reales · '+reales.filter(function(d){ return d.estado === 'Completado'; }).length+' completados</li>' +
      '<li>Resistencia promedio a 28 d: <b>'+(isFinite(k.r28)?fmt(k.r28,1)+' kg/cm²':'-')+'</b></li>' +
      '<li>Cumplen f\'c a 28 d: <b>'+(isFinite(k.cumplimiento)?k.cumplimiento+' %':'-')+'</b> ('+k.cumplen+' de '+k.evaluados+')</li>' +
      '<li>Roturas pendientes: <b>'+pend.length+'</b> · vencidas: <b>'+pend.filter(function(c){ return c.fechaEnsayo < hoy; }).length+'</b> · hoy: <b>'+pend.filter(function(c){ return c.fechaEnsayo === hoy; }).length+'</b></li>' +
      '<li>Proyectos en curso: <b>'+metricasTodosLosProyectos().filter(function(x){ return x.estado === 'En curso'; }).length+'</b></li></ul>' +
      '<div class="chat-acciones">'+btnAccion('Abrir dashboard', 'data-goto="reportes"')+'</div>';
  }
  // Cumplimiento de f'c
  if(/(cumpl|alcanz|llega|no llega|no cumpl|fall)/.test(q) && /(f'?c|resistencia|especific|diseno)/.test(q) && !/(costo|cvd|barat|econom|car[oa]s?\b|precio)/.test(q) && !dis.length){
    var lista = disenosFiltrados(proyecto).filter(function(d){ return n(d.fc) > 0 && isFinite(resistenciaPorEdad(d)[edad || 28]); });
    if(!lista.length) return '<p>No hay diseños con f\'c y resultado a '+(edad||28)+' días'+(proyecto?' en '+esc(proyecto):'')+'.</p>';
    var noCumplen = /no (cumpl|alcanz|llega)|fall/.test(q);
    var sel = lista.filter(function(d){ var ok = resistenciaPorEdad(d)[edad || 28] >= n(d.fc); return noCumplen ? !ok : ok; });
    return '<p><b>'+sel.length+' de '+lista.length+'</b> diseños '+(noCumplen?'no cumplen':'cumplen')+' su f\'c a '+(edad||28)+' días'+(proyecto?' en <b>'+esc(proyecto)+'</b>':'')+'.</p>' +
      (sel.length ? tablaHtml(['Diseño', 'f\'c', 'Real', '%'], sel.slice(0, 12).map(function(d){ var v = resistenciaPorEdad(d)[edad || 28]; return ['<b>'+esc(diseñoTitulo(d))+'</b> <span class="nota-sm">'+esc(d.codigo)+'</span>', n(d.fc), fmt(v,1), fmt(v/n(d.fc)*100,0)+' %']; })) : '');
  }
  // Costos
  if(/(costo|cvd|barat|econom|car[oa]s?\b|precio|soles)/.test(q)){
    var conCosto = disenosFiltrados(proyecto).filter(function(d){ return n(d.cvdTotal) > 0; });
    if(/(cumpl|que llegue|que alcance)/.test(q)) conCosto = conCosto.filter(function(d){ var v = resistenciaPorEdad(d)[28]; return n(d.fc) > 0 && isFinite(v) && v >= n(d.fc); });
    if(!conCosto.length) return '<p>No hay diseños con costo registrado'+(proyecto?' en '+esc(proyecto):'')+'.</p>';
    var caros = /(car[oa]s?\b|mayor costo|mas costos)/.test(q);
    conCosto.sort(function(a,b){ return caros ? n(b.cvdTotal) - n(a.cvdTotal) : n(a.cvdTotal) - n(b.cvdTotal); });
    return '<p>Diseños '+(caros?'más caros':'más económicos')+' por m³'+(proyecto?' en <b>'+esc(proyecto)+'</b>':'')+' · costo promedio S/. '+fmt(promedio(conCosto.map(function(d){ return n(d.cvdTotal); })),2)+':</p>' +
      tablaHtml(['Diseño', 'CVD S/.', 'f\'c', '28 d'], conCosto.slice(0, 8).map(function(d){ var v = resistenciaPorEdad(d)[28]; return ['<b>'+esc(diseñoTitulo(d))+'</b> <span class="nota-sm">'+esc(d.codigo)+'</span>', fmt(n(d.cvdTotal),2), n(d.fc)||'-', isFinite(v)?fmt(v,1):'-']; }));
  }
  // HE vs Tipo I
  if(/\bhe\b/.test(q) && /(tipo i\b|tipo 1|\bi\b|vs|versus|compar|diferencia|mejor)/.test(q) && !dis.length){
    var base = disenosFiltrados(proyExplicito);
    return '<p>Resistencia promedio (kg/cm²) por tipo de cemento'+(proyExplicito?' en <b>'+esc(proyExplicito)+'</b>':'')+':</p>' +
      compararGrupos('HE', base.filter(function(d){ return tipoCementoNormalizado(d) === 'HE'; }), 'Tipo I', base.filter(function(d){ return tipoCementoNormalizado(d) !== 'HE'; }));
  }
  // Fly ash
  if(/(fly ?ash|ceniza)/.test(q) && /(efecto|influ|compar|diferencia|sin|con|vs|mejor|ayuda|sirve)/.test(q) && !/predic|estim|a\s*\/?\s*m?c\s*\d|0[.,]\d/.test(q)){
    var b2 = disenosFiltrados(proyExplicito);
    return '<p>Resistencia promedio (kg/cm²) con y sin fly ash'+(proyExplicito?' en <b>'+esc(proyExplicito)+'</b>':'')+':</p>' +
      compararGrupos('Con fly ash', b2.filter(usaFlyAsh), 'Sin fly ash', b2.filter(function(d){ return !usaFlyAsh(d); }));
  }
  // Dosificación / mezcla / estado fresco de un diseño
  if(dis.length && /(dosific|mezcla|materiales|composicion|receta|proporcion|cuanto cemento|agua)/.test(q)){
    var d1 = dis[0];
    var mix = (d1.mix || []).filter(function(it){ return n(it.pesoSeco) > 0; });
    return '<p>Dosificación de <b>'+esc(diseñoTitulo(d1))+'</b> ('+esc(d1.codigo)+') por m³ · a/mc '+esc(d1.amcEfectiva||'-')+':</p>' +
      tablaHtml(['Material', 'Peso seco (kg)'], mix.map(function(it){ return [esc(it.nombre), fmt(n(it.pesoSeco),2)]; })) +
      '<div class="chat-acciones">'+btnAccion('Ver informe', 'data-chat-informe="'+esc(d1.codigo)+'"')+'</div>';
  }
  if(dis.length && /(slump|asentamiento|fresco|temperatura|aire|peso unitario|fragua|thermo)/.test(q)){
    var d2 = dis[0], reps = (d2.resultados && d2.resultados.replicas) || [];
    if(!reps.length) return '<p><b>'+esc(diseñoTitulo(d2))+'</b> todavía no tiene ensayos en estado fresco cargados.</p>';
    return '<p>Estado fresco de <b>'+esc(diseñoTitulo(d2))+'</b>:</p>' + reps.map(function(rp, k){
      var filas = (rp.slump || []).map(function(s, i){ return s && (s.slump || s.tempc) ? [SLUMP_ROWS[i], esc(s.hora||'-'), esc(s.slump||'-'), esc(s.tempc||'-'), esc(s.tempa||'-')] : null; }).filter(Boolean);
      return '<p class="nota-sm">Réplica '+(k+1)+' · PU '+esc(rp.pesoUnitario||'-')+' · aire '+esc(rp.aire||'-')+' % · fragua '+esc(rp.thermoIni||'-')+' / '+esc(rp.thermoFin||'-')+'</p>' +
        (filas.length ? tablaHtml(['Min', 'Hora', 'Slump', 'T° C', 'T° A'], filas) : '');
    }).join('');
  }
  // Promedio a una edad
  if(/promedio/.test(q) && edad && !dis.length){
    var pe = promedioPorEdad(disenosFiltrados(proyecto))[edad];
    if(!pe) return '<p>No hay resultados a '+edad+' días'+(proyecto?' en '+esc(proyecto):'')+'.</p>';
    return '<p>Resistencia promedio a <b>'+edad+' días</b>'+(proyecto?' en <b>'+esc(proyecto)+'</b>':'')+': <b>'+fmt(promedio(pe),1)+' kg/cm²</b> ('+pe.length+' diseños, rango '+fmt(Math.min.apply(null,pe),1)+' – '+fmt(Math.max.apply(null,pe),1)+').</p>';
  }
  // Proyectos
  if(/(que|cuales|lista|listar|mis|todos los) proyectos|proyectos (hay|activos|en curso|registrados)/.test(q)){
    var ms = metricasTodosLosProyectos();
    if(!ms.length) return '<p>No hay proyectos registrados.</p>';
    return tablaHtml(['Proyecto', 'Estado', 'Diseños', 'Roturas'], ms.map(function(x){
      return ['<a href="#" data-chat-exp="'+esc(x.nombre)+'"><b>'+esc(x.nombre)+'</b></a>', esc(x.estado), x.nDisenos, x.cargasCompletas+'/'+x.cargas.length+(x.vencidas?' <span class="txt-rojo">('+x.vencidas+' venc.)</span>':'')];
    }));
  }
  // Diseños recientes / en desarrollo
  if(/(ultimo|reciente|nuevo)s? disenos?|disenos? (recientes|nuevos|en desarrollo|iniciados|pendientes|sin resultado)/.test(q)){
    var estadoF = /desarrollo/.test(q) ? 'En desarrollo' : (/iniciad/.test(q) ? 'Iniciado' : null);
    var lr = disenos.filter(function(d){ return (!proyecto || proyectoNombre(d.proyectoId) === proyecto) && (!estadoF || d.estado === estadoF); })
      .sort(function(a,b){ return (b.ts||0) - (a.ts||0) || String(b.fecha).localeCompare(String(a.fecha)); }).slice(0, 8);
    if(!lr.length) return '<p>No encontré diseños con ese criterio.</p>';
    return '<ul class="chat-lista">' + lr.map(function(d){ return '<li><b>'+esc(diseñoTitulo(d))+'</b> · '+esc(d.codigo)+' · '+esc(d.estado)+' · '+esc(d.fecha||'-')+' <span class="nota-sm">('+esc(proyectoNombre(d.proyectoId)||'-')+')</span></li>'; }).join('') + '</ul>';
  }
  // Historial
  if(/(historial|que (se )?(hizo|registro|hicieron)|movimientos|ultimos cambios|quien)/.test(q)){
    if(!can('ver:historial')) return '<p>Tu rol no tiene acceso al historial.</p>';
    var hs = historial.filter(function(h){ return !proyecto || h.proyecto === proyecto; }).slice(0, 8);
    if(!hs.length) return '<p>Sin movimientos registrados.</p>';
    return '<ul class="chat-lista">' + hs.map(function(h){ return '<li>'+fechaHora(h.ts)+' · <b>'+esc(h.usuario)+'</b> '+esc(h.accion).toLowerCase()+' '+esc(h.entidad)+' <span class="nota-sm">'+esc(h.detalle||'')+'</span></li>'; }).join('') + '</ul>' +
      '<div class="chat-acciones">'+btnAccion('Abrir historial', 'data-goto="historial"')+'</div>';
  }
  // Reporte RR
  if(/(reporte rr|\brr\b|estudios?( rr)?$|estudios comparativos)/.test(q)){
    var es = rrEstudios.filter(function(x){ return !proyecto || normalizar(proyectoNombre(x.proyectoId) || x.nombre).indexOf(normalizar(proyecto)) > -1; });
    if(!es.length) return '<p>No hay estudios RR'+(proyecto?' para '+esc(proyecto):'')+'.</p>';
    return '<ul class="chat-lista">' + es.map(function(x){ return '<li><b>'+esc(x.nombre)+'</b> · '+esc(x.fecha)+' · '+x.tipos.length+' tipos: '+esc(x.tipos.map(function(t){ return t.nombre; }).join(', '))+'</li>'; }).join('') + '</ul>' +
      '<div class="chat-acciones">'+btnAccion('Abrir Reporte RR', 'data-goto="reporte-rr"')+'</div>';
  }
  // Fecha
  if(/(que dia|que fecha|fecha de hoy|hoy es)/.test(q)) return '<p>Hoy es <b>'+DIA_NOMBRES[new Date().getDay()]+' '+isoToDMY(todayISO())+'</b>.</p>';
  return null;
}

var DESTINOS = [
  {re:/dashboard|kpi|metricas|indicadores/, panel:'reportes'}, {re:/calendario/, panel:'calendario'}, {re:/rotura/, panel:'roturas'},
  {re:/proyecto|expediente|radar/, panel:'proyectos'}, {re:/diseno|calculadora|calcular/, panel:'disenos'}, {re:/registro|componente|material/, panel:'componentes'},
  {re:/reporte rr|\brr\b/, panel:'reporte-rr'}, {re:/archivador/, panel:'archivador'}, {re:/base historica|historica|dataset/, panel:'base-historica'},
  {re:/prediccion|predecir|simulador/, panel:'prediccion'}, {re:/historial|auditoria|movimientos/, panel:'historial'}, {re:/usuario|roles|permisos/, panel:'usuarios'},
  {re:/ajuste|configuracion|contrasena/, panel:'ajustes'}, {re:/inicio|home/, panel:'inicio'}
];
function responder(pregunta){
  var q = normalizar(pregunta);
  var hoy = todayISO();
  var proyecto = detectarProyecto(pregunta);
  var dis = detectarDisenos(pregunta);
  var edad = detectarEdad(pregunta);
  // Preguntas de seguimiento ("¿y a 7 días?", "su dosificación"): se usa lo último consultado
  if(!dis.length && !proyecto && /^(y|e|ahora|tambien)\b|\b(ese|este|esa|esta|su|sus|mismo|misma|anterior)\b/.test(q)){ dis = chatContexto.disenos; proyecto = chatContexto.proyecto; }
  if(dis.length){ chatContexto.disenos = dis; chatContexto.proyecto = null; }
  else if(proyecto){ chatContexto.proyecto = proyecto; chatContexto.disenos = []; }

  if(/^(hola|buen[oa]s|ayuda|help|que (puedes|sabes) hacer|como funciona)/.test(q)){
    return '<p>¡Hola! Puedo responder con los datos del sistema. Probá, por ejemplo:</p><ul class="chat-lista">' +
      '<li>¿Qué roturas tengo hoy / esta semana / vencidas?</li><li>¿Cómo vamos? · Resumen del proyecto Estudio HE</li><li>¿Qué diseños no cumplen f\'c?</li><li>Diseño más barato que cumpla</li>' +
      '<li>HE vs Tipo I · Efecto del fly ash</li><li>Dosificación / slump de DID-0023</li><li>Predice DID-0023 a 28 días · ¿Qué a/mc necesito para 280 a 28 días con HE?</li><li>¿Qué tan exacta es la predicción?</li><li>Compara DID-0023 y DID-0025 · Abrir calendario</li></ul>';
  }
  // Navegación / accesos directos
  if(/^(abr[ie]r?|ir a|ve a|ll[eé]vame|mostr[aá]me|muestr[ae]|ver)\b/.test(q) && !dis.length && !/rotura(s)? (de )?hoy|semana|vencid/.test(q)){
    var dest = DESTINOS.filter(function(x){ return x.re.test(q); })[0];
    if(dest){
      if(!can('ver:' + dest.panel)) return '<p>Tu rol no tiene acceso a <b>'+esc(panelInfo(dest.panel).label)+'</b>.</p>';
      if(dest.panel === 'proyectos' && proyecto){ setTimeout(function(){ abrirExpediente(proyecto); }, 300); return '<p>Abriendo el expediente de <b>'+esc(proyecto)+'</b>…</p>'; }
      setTimeout(function(){ showPanel(dest.panel); if(dest.panel === 'disenos') showSubTab('historico'); }, 300);
      return '<p>Abriendo <b>'+esc(panelInfo(dest.panel).label)+'</b>…</p>';
    }
  }
  var ampliada = responderAmpliado(q, pregunta, proyecto, dis, edad);
  if(ampliada) return ampliada;
  // Predicción
  if(/predic|estim|simula|cuanto (daria|alcanzaria|llegaria)|proyecta/.test(q)){
    var amcM = q.match(/a\s*\/?\s*m?c\s*(de|=)?\s*(0?[.,]\d+)/) || q.match(/\b(0[.,]\d{2})\b/);
    if(dis.length){
      var e1 = edad || 28;
      var pc = predecirDisenoCalibrado(dis[0], e1);
      var aj = ajusteMadurez(dis[0]);
      if(!pc && !aj) return '<p>'+esc(diseñoTitulo(dis[0]))+' todavía no tiene datos suficientes para proyectar.</p>';
      var medido = resistenciaPorEdad(dis[0])[e1];
      return '<p>Para <b>'+esc(diseñoTitulo(dis[0]))+'</b> a '+e1+' días: <b>'+fmt(pc ? pc.valor : aj.predecir(e1),1)+' kg/cm²</b>'+(pc ? (pc.edadesUsadas.length ? ' (modelo calibrado con sus roturas de '+pc.edadesUsadas.join(', ')+' d)' : ' (modelo histórico)') : ' (curva de madurez)')+'.'+(isFinite(medido) ? ' Medido: <b>'+fmt(medido,1)+'</b>.' : '')+(n(dis[0].fc) ? ' f\'c '+n(dis[0].fc)+' → '+((pc ? pc.valor : aj.predecir(e1)) >= n(dis[0].fc) ? '<b class="txt-verde">lo alcanza</b>' : '<b class="txt-rojo">no lo alcanza</b>') : '')+'</p>' +
        (pc ? '<p class="nota-sm">'+tasaTexto(pc.acierto)+'</p>' : '') +
        '<div class="chat-acciones">'+btnAccion('Ver en Predicción', 'data-goto="prediccion"')+'</div>';
    }
    if(amcM){
      var amc = Number(String(amcM[amcM.length-1]).replace(',', '.'));
      var e2 = edad || 28, he = /\bhe\b/.test(q), faM = q.match(/(\d{1,2})\s*%\s*(de\s*)?(fly|ceniza)/), fa = faM ? Number(faM[1]) : (/fly|ceniza/.test(q) ? 12 : 0);
      var cemM = q.match(/(\d{3})\s*kg/);
      var cem = cemM ? Number(cemM[1]) : 350;
      var pr = predecirResistencia({amc: amc, cemento: he ? 'HE' : 'I', cementante: cem, flyAshPct: fa, aditivoPct: 1, edad: e2});
      if(pr.error) return '<p>' + esc(pr.error) + '</p>';
      return '<p>Con a/mc <b>'+amc+'</b>, cemento <b>'+(he?'HE':'Tipo I')+'</b>'+(fa?' con '+fa+' % de fly ash':'')+' y '+Math.round(cem)+' kg/m³ de cementante, el modelo ('+esc(pr.modelo.nombre)+') estima <b>'+fmt(pr.valor,1)+' kg/cm²</b> a '+e2+' días. Error esperado ±'+fmt(pr.mae,1)+' kg/cm².</p><p class="nota-sm">'+tasaTexto(pr.acierto)+'</p>' +
        (pr.fueraDeRango.length ? '<p class="nota-sm">Ojo: '+esc(pr.fueraDeRango.join('; '))+' está fuera de los datos de entrenamiento.</p>' : '') +
        '<div class="chat-acciones">'+btnAccion('Abrir simulador', 'data-goto="prediccion"')+'</div>';
    }
    return '<p>Indicame un diseño (ej. <i>DID-0023</i>) o una relación a/mc (ej. <i>a/mc 0.55 con cemento HE a 28 días</i>) para estimar.</p>';
  }
  // Roturas
  if(/rotura|romper|ensayo|probeta|cubo/.test(q) && !dis.length){
    var base = roturaCargas.filter(function(c){ return !proyecto || c.proyecto === proyecto; });
    var pend = base.filter(function(c){ return c.estado === 'pendiente'; });
    var sufijo = proyecto ? ' en <b>'+esc(proyecto)+'</b>' : '';
    if(/vencid|atrasad|retrasad|pasad/.test(q)){
      var venc = pend.filter(function(c){ return c.fechaEnsayo < hoy; }).sort(function(a,b){ return a.fechaEnsayo.localeCompare(b.fechaEnsayo); });
      return venc.length ? '<p>Hay <b>'+venc.length+'</b> roturas vencidas'+sufijo+':</p>' + listaRoturasHtml(venc) + '<div class="chat-acciones">'+btnAccion('Ir a Roturas', 'data-goto="roturas" data-sub="pendientes"')+'</div>'
        : '<p>No hay roturas vencidas'+sufijo+'. 👍</p>';
    }
    if(/manana/.test(q)){
      var man = addDaysISO(hoy, 1);
      var lm = pend.filter(function(c){ return c.fechaEnsayo === man; });
      return lm.length ? '<p>Mañana hay <b>'+lm.length+'</b> roturas'+sufijo+':</p>' + listaRoturasHtml(lm) : '<p>Mañana no hay roturas programadas'+sufijo+'.</p>';
    }
    if(/semana/.test(q)){
      var lun = lunesDe(hoy), dom = addDaysISO(lun, 6);
      var ls = base.filter(function(c){ return c.fechaEnsayo >= lun && c.fechaEnsayo <= dom; }).sort(function(a,b){ return a.fechaEnsayo.localeCompare(b.fechaEnsayo); });
      var lsp = ls.filter(function(c){ return c.estado === 'pendiente'; });
      return '<p>Esta semana ('+isoToDMY(lun)+' al '+isoToDMY(dom)+') hay <b>'+ls.length+'</b> roturas'+sufijo+', <b>'+lsp.length+'</b> por registrar.</p>' + (lsp.length ? listaRoturasHtml(lsp) : '') +
        '<div class="chat-acciones">'+btnAccion('Abrir calendario', 'data-goto="calendario"')+'</div>';
    }
    var lh = pend.filter(function(c){ return c.fechaEnsayo === hoy; });
    if(/hoy/.test(q) || !/pendiente/.test(q)){
      return lh.length ? '<p>Hoy toca romper <b>'+lh.length+'</b>'+sufijo+':</p>' + listaRoturasHtml(lh) + '<div class="chat-acciones">'+btnAccion('Registrar en Roturas', 'data-goto="roturas" data-sub="pendientes"')+'</div>'
        : '<p>Hoy no hay roturas programadas'+sufijo+'. Hay '+pend.length+' pendientes en total.</p>';
    }
    return '<p>Hay <b>'+pend.length+'</b> roturas pendientes'+sufijo+' ('+pend.filter(function(c){ return c.fechaEnsayo < hoy; }).length+' vencidas, '+pend.filter(function(c){ return c.fechaEnsayo === hoy; }).length+' para hoy).</p>' +
      '<div class="chat-acciones">'+btnAccion('Ver pendientes', 'data-goto="roturas" data-sub="pendientes"')+btnAccion('Calendario', 'data-goto="calendario"')+'</div>';
  }
  // Comparar
  if(/compar|versus|\bvs\b|diferencia entre/.test(q)){
    if(dis.length >= 2){
      var eds = {};
      dis.forEach(function(d){ Object.keys(resistenciaPorEdad(d)).forEach(function(e){ eds[e] = true; }); });
      var le = Object.keys(eds).map(Number).sort(function(a,b){ return a-b; });
      return '<p>Comparación de resistencias (kg/cm²):</p><table class="data-table chat-tabla"><thead><tr><th>Diseño</th><th>a/mc</th>' + le.map(function(e){ return '<th>'+e+' d</th>'; }).join('') + '</tr></thead><tbody>' +
        dis.map(function(d){ var r = resistenciaPorEdad(d); return '<tr><td><b>'+esc(diseñoTitulo(d))+'</b></td><td>'+esc(d.amcEfectiva||'-')+'</td>' + le.map(function(e){ return '<td>'+(isFinite(r[e])?fmt(r[e],1):'-')+'</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table>';
    }
    if(proyecto) return '<p>Te abro el comparativo de iteraciones de <b>'+esc(proyecto)+'</b>.</p><div class="chat-acciones">'+btnAccion('Comparar iteraciones', 'data-chat-exp="'+esc(proyecto)+'" data-chat-tab="comparativo"')+'</div>';
    return '<p>Indicame dos diseños (ej. <i>compara DID-0023 y DID-0025</i>) o un proyecto para comparar sus iteraciones.</p>';
  }
  // Ranking de resistencia
  if(/(mayor|mejor|maxima|mas alta|top|menor|peor|minima|mas baja).*(resistencia|resultado)|(resistencia|resultado).*(mayor|mejor|maxima|mas alta|menor|peor|minima|mas baja)/.test(q)){
    var asc = /menor|peor|minima|mas baja/.test(q);
    var cand = disenos.filter(function(d){ return !proyecto || proyectoNombre(d.proyectoId) === proyecto; }).map(function(d){
      var r = resistenciaPorEdad(d);
      return {d:d, v: edad ? r[edad] : resistenciaMaxima(d)};
    }).filter(function(x){ return isFinite(x.v); }).sort(function(a,b){ return asc ? a.v-b.v : b.v-a.v; }).slice(0,5);
    if(!cand.length) return '<p>No encontré resultados'+(edad?' a '+edad+' días':'')+(proyecto?' en '+esc(proyecto):'')+'.</p>';
    return '<p>Diseños con '+(asc?'menor':'mayor')+' resistencia'+(edad?' a <b>'+edad+' días</b>':' (máxima alcanzada)')+(proyecto?' en <b>'+esc(proyecto)+'</b>':'')+':</p><ol class="chat-lista">' +
      cand.map(function(x){ return '<li><b>'+esc(diseñoTitulo(x.d))+'</b> — '+fmt(x.v,1)+' kg/cm² <span class="nota-sm">('+esc(proyectoNombre(x.d.proyectoId)||'-')+', a/mc '+esc(x.d.amcEfectiva||'-')+')</span></li>'; }).join('') + '</ol>';
  }
  // Conteos
  if(/cuant[oa]s/.test(q)){
    if(/usuario/.test(q)) return '<p>Hay <b>'+usuarios.filter(function(u){ return u.activo; }).length+'</b> usuarios activos.</p>';
    if(/componente|material/.test(q)) return '<p>Hay <b>'+componentes.length+'</b> componentes registrados: ' + CAT_DEFS.map(function(c){ return c.id+' '+componentes.filter(function(x){ return x.categoria === c.id; }).length; }).join(' · ') + '.</p>';
    if(/proyecto/.test(q) && !proyecto) return '<p>Hay <b>'+nombresDeProyectos().length+'</b> proyectos registrados, '+metricasTodosLosProyectos().filter(function(m){ return m.estado === 'En curso'; }).length+' en curso.</p>';
    if(/diseno/.test(q)){
      var ld = disenos.filter(function(d){ return !proyecto || proyectoNombre(d.proyectoId) === proyecto; });
      return '<p>Hay <b>'+ld.length+'</b> diseños'+(proyecto?' en <b>'+esc(proyecto)+'</b>':'')+': '+ld.filter(function(d){ return d.estado==='Completado'; }).length+' completados, '+ld.filter(function(d){ return d.estado==='En desarrollo'; }).length+' en desarrollo y '+ld.filter(function(d){ return d.estado==='Iniciado'; }).length+' iniciados.</p>';
    }
  }
  // Componentes
  var cat = CAT_DEFS.filter(function(c){ return q.indexOf(normalizar(c.id)) > -1; })[0];
  if(cat && /componente|material|registr|lista|cuales|tenemos|hay/.test(q)){
    var lc = componentes.filter(function(x){ return x.categoria === cat.id; });
    return '<p><b>'+cat.id+'</b> registrados ('+lc.length+'):</p><ul class="chat-lista">' + lc.map(function(x){ return '<li><b>'+esc(x.nombre)+'</b>'+(x.costo&&x.costo!=='-'?' · S/. '+esc(x.costo)+'/kg':'')+(x.procedencia&&x.procedencia!=='-'?' · '+esc(x.procedencia):'')+'</li>'; }).join('') + '</ul>';
  }
  // Diseño o proyecto específico
  if(dis.length) return dis.slice(0,3).map(resumenDisenoHtml).join('<hr>');
  if(proyecto) return resumenProyectoHtml(proyecto, edad);

  // Búsqueda por similitud
  var tq = tokens(pregunta);
  if(tq.length){
    var docs = [];
    disenos.forEach(function(d){ docs.push({tipo:'Diseño', titulo:diseñoTitulo(d), sub:d.codigo+' · '+(proyectoNombre(d.proyectoId)||''), texto:[diseñoTitulo(d), d.codigo, d.recetaId, proyectoNombre(d.proyectoId), d.iteracionId, d.planta, d.tipo, d.cementoTipo].join(' '), accion:'data-chat-informe="'+esc(d.codigo)+'"'}); });
    nombresDeProyectos().forEach(function(p){ docs.push({tipo:'Proyecto', titulo:p, sub:'Expediente', texto:p, accion:'data-chat-exp="'+esc(p)+'"'}); });
    componentes.forEach(function(c){ docs.push({tipo:'Componente', titulo:c.nombre, sub:c.categoria, texto:[c.nombre, c.categoria, c.procedencia, c.funcion, c.tipo].join(' '), accion:'data-goto="componentes"'}); });
    rrEstudios.forEach(function(e){ docs.push({tipo:'Reporte RR', titulo:e.nombre, sub:e.fecha, texto:[e.nombre].concat(e.tipos.map(function(t){ return t.nombre; })).join(' '), accion:'data-goto="reporte-rr"'}); });
    var df = {};
    docs.forEach(function(doc){ doc.tk = tokens(doc.texto); var u = {}; doc.tk.forEach(function(t){ u[t] = true; }); Object.keys(u).forEach(function(t){ df[t] = (df[t]||0) + 1; }); });
    docs.forEach(function(doc){
      doc.score = tq.reduce(function(acc, t){
        var hit = doc.tk.some(function(x){ return x === t || (t.length > 3 && x.indexOf(t) === 0); });
        return acc + (hit ? Math.log(1 + docs.length / (df[t] || 1)) : 0);
      }, 0);
    });
    var top = docs.filter(function(d){ return d.score > 0; }).sort(function(a,b){ return b.score - a.score; }).slice(0,5);
    if(top.length){
      return '<p>No estoy seguro de qué necesitás, pero encontré esto relacionado:</p><ul class="chat-lista">' +
        top.map(function(d){ return '<li><span class="tag-pill tag-gris">'+d.tipo+'</span> <b>'+esc(d.titulo)+'</b> <span class="nota-sm">'+esc(d.sub||'')+'</span> '+btnAccion('Abrir', d.accion)+'</li>'; }).join('') + '</ul>';
    }
  }
  return '<p>No encontré eso en los datos. Puedo responder sobre roturas, proyectos, diseños, resistencias, costos, cumplimiento de f\'c, estado fresco y predicciones. Escribí <b>ayuda</b> para ver ejemplos.</p>';
}

/* ---------- Interfaz ---------- */
var SUGERENCIAS_CHAT = ['¿Cómo vamos?', '¿Qué roturas tengo hoy?', '¿Qué diseños no cumplen f\'c?', 'HE vs Tipo I', 'Diseño más barato que cumpla', '¿Qué a/mc necesito para 280 a 28 días con HE?', '¿Qué tan exacta es la predicción?'];
function renderChat(){
  var log = document.getElementById('chat-log');
  log.innerHTML = chatLog.map(function(m){ return '<div class="chat-msg '+m.de+'"><div class="chat-burbuja">'+m.html+'</div></div>'; }).join('');
  log.scrollTop = log.scrollHeight;
  document.getElementById('chat-sugerencias').innerHTML = SUGERENCIAS_CHAT.map(function(s){ return '<button class="chip-sug" data-sug="'+esc(s)+'">'+esc(s)+'</button>'; }).join('');
}
function respuestaLocal(texto){
  try{ return responder(texto); }catch(e){ console.error(e); return '<p>Ocurrió un error al procesar la pregunta.</p>'; }
}
function enviarPregunta(texto){
  texto = String(texto||'').trim();
  if(!texto || agenteOcupado) return;
  chatLog.push({de:'usuario', html:esc(texto)});
  if(chatLog.length > 60) chatLog = chatLog.slice(-60);
  if(!agenteDisponible()){
    chatLog.push({de:'asistente', html:respuestaLocal(texto)});
    renderChat();
    return;
  }
  // Agente con Claude: burbuja de progreso mientras consulta los datos
  var burbuja = {de:'asistente pensando', html:'<p class="chat-pasos"><span class="chat-spinner"></span> Analizando la pregunta…</p>'};
  chatLog.push(burbuja);
  agenteOcupado = true;
  renderChat();
  var pasos = [];
  preguntarAgente(texto, function(p){
    pasos.push(p);
    burbuja.html = '<p class="chat-pasos"><span class="chat-spinner"></span> ' + esc(p) + '</p>';
    renderChat();
  }).then(function(r){
    burbuja.de = 'asistente';
    burbuja.html = markdownAHtml(r.texto) + (pasos.length ? '<p class="chat-fuente">Consultó: ' + esc(pasos.join(' · ').replace(/…/g, '')) + '</p>' : '');
  }).catch(function(err){
    burbuja.de = 'asistente';
    burbuja.html = '<p class="chat-aviso">' + esc(err.message) + (err.local ? ' Respondo con el motor local:' : '') + '</p>' + (err.local ? respuestaLocal(texto) : '');
  }).then(function(){
    agenteOcupado = false;
    renderChat();
    renderModoAsistente();
  });
}
function renderModoAsistente(){
  var ia = agenteDisponible();
  var chip = document.getElementById('chat-modo');
  chip.className = 'chat-modo ' + (ia ? 'ia' : 'local');
  chip.innerHTML = ia ? '<span class="live-dot"></span> Agente IA · Claude' : 'Motor local';
  document.getElementById('chat-nota').innerHTML = ia
    ? 'Las preguntas se envían a la API de Anthropic.'
    : (can('ver:usuarios') ? 'Agente con IA: <a href="#" data-goto="ajustes">configurar en Ajustes</a>' : '');
}
document.getElementById('chat-nueva').addEventListener('click', function(){
  if(agenteOcupado) return;
  nuevaConversacionAgente();
  chatLog = [];
  PANEL_HOOKS.asistente();
});
document.getElementById('chat-form').addEventListener('submit', function(e){
  e.preventDefault();
  var inp = document.getElementById('chat-input');
  enviarPregunta(inp.value);
  inp.value = '';
  inp.focus();
});
document.getElementById('panel-asistente').addEventListener('click', function(e){
  var sug = e.target.closest('[data-sug]');
  if(sug){ enviarPregunta(sug.dataset.sug); return; }
  var inf = e.target.closest('[data-chat-informe]');
  if(inf){ var d = disenoPorCodigo(inf.dataset.chatInforme); if(d) openInformeModal(d); return; }
  var exp = e.target.closest('[data-chat-exp]');
  if(exp){ abrirExpediente(exp.dataset.chatExp, exp.dataset.chatTab); return; }
});
PANEL_HOOKS.asistente = function(){
  if(!chatLog.length){
    chatLog.push({de:'asistente', html:'<p>Hola'+(usuarioActual ? ' ' + esc((usuarioActual.nombre||usuarioActual.usuario).split(' ')[0]) : '')+'. Soy el asistente del Laboratorio I+D. Preguntame sobre proyectos, diseños, roturas, resistencias o pedime que abra una sección.</p>'});
  }
  renderChat();
  renderModoAsistente();
  setTimeout(function(){ document.getElementById('chat-input').focus(); }, 50);
};
