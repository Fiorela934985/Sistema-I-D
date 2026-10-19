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

  if(/^(hola|buen[oa]s|ayuda|help|que (puedes|sabes) hacer|como funciona)/.test(q)){
    return '<p>¡Hola! Puedo responder con los datos del sistema. Probá, por ejemplo:</p><ul class="chat-lista">' +
      '<li>¿Qué roturas tengo hoy / esta semana / vencidas?</li><li>Resumen del proyecto Estudio HE</li><li>Resistencia promedio a 28 días de Estudio HE + Fly Ash</li>' +
      '<li>¿Cuál es el diseño con mayor resistencia a 7 días?</li><li>Compara DID-0023 y DID-0025</li><li>Predice la resistencia a 28 días con a/mc 0.55 y cemento HE</li><li>Abrir calendario</li></ul>';
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
  // Predicción
  if(/predic|estim|simula|cuanto (daria|alcanzaria|llegaria)|proyecta/.test(q)){
    var amcM = q.match(/a\s*\/?\s*m?c\s*(de|=)?\s*(0?[.,]\d+)/) || q.match(/\b(0[.,]\d{2})\b/);
    if(dis.length){
      var aj = ajusteMadurez(dis[0]);
      if(!aj) return '<p>'+esc(diseñoTitulo(dis[0]))+' todavía no tiene roturas para proyectar.</p>';
      var e1 = edad || 28;
      return '<p>Para <b>'+esc(diseñoTitulo(dis[0]))+'</b> la curva de madurez proyecta <b>'+fmt(aj.predecir(e1),1)+' kg/cm²</b> a '+e1+' días ('+aj.metodo.toLowerCase()+').</p>' +
        '<div class="chat-acciones">'+btnAccion('Ver en Predicción', 'data-goto="prediccion"')+'</div>';
    }
    if(amcM){
      var amc = Number(String(amcM[amcM.length-1]).replace(',', '.'));
      var mod = modeloSimulador || entrenarModeloSimulador();
      if(mod.insuficiente) return '<p>Todavía no hay suficientes resultados para entrenar el modelo (se necesitan 8).</p>';
      var e2 = edad || 28, he = /\bhe\b/.test(q) ? 1 : 0, fa = /fly|ceniza/.test(q) ? 1 : 0;
      var cemM = q.match(/(\d{3})\s*kg/);
      var cem = cemM ? Number(cemM[1]) : mod.cemMedio;
      var p = predecirLineal(mod.beta, vectorCaracteristicas(amc, e2, he, cem, fa));
      return '<p>Con a/mc <b>'+amc+'</b>, cemento <b>'+(he?'HE':'Tipo I')+'</b>'+(fa?' con fly ash':'')+' y '+Math.round(cem)+' kg/m³, el modelo estima <b>'+fmt(p,1)+' kg/cm²</b> a '+e2+' días (error medio ±'+fmt(mod.mae,1)+').</p>' +
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
  return '<p>No encontré información sobre eso en los datos registrados. Escribí <b>ayuda</b> para ver ejemplos de preguntas.</p>';
}

/* ---------- Interfaz ---------- */
var SUGERENCIAS_CHAT = ['¿Qué roturas tengo hoy?', 'Roturas vencidas', 'Roturas de esta semana', 'Diseño con mayor resistencia a 7 días', '¿Cuántos diseños hay?', 'Predice a/mc 0.55 cemento HE a 28 días'];
function renderChat(){
  var log = document.getElementById('chat-log');
  log.innerHTML = chatLog.map(function(m){ return '<div class="chat-msg '+m.de+'"><div class="chat-burbuja">'+m.html+'</div></div>'; }).join('');
  log.scrollTop = log.scrollHeight;
  document.getElementById('chat-sugerencias').innerHTML = SUGERENCIAS_CHAT.map(function(s){ return '<button class="chip-sug" data-sug="'+esc(s)+'">'+esc(s)+'</button>'; }).join('');
}
function enviarPregunta(texto){
  texto = String(texto||'').trim();
  if(!texto) return;
  chatLog.push({de:'usuario', html:esc(texto)});
  var resp;
  try{ resp = responder(texto); }catch(e){ console.error(e); resp = '<p>Ocurrió un error al procesar la pregunta.</p>'; }
  chatLog.push({de:'asistente', html:resp});
  if(chatLog.length > 60) chatLog = chatLog.slice(-60);
  renderChat();
}
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
  setTimeout(function(){ document.getElementById('chat-input').focus(); }, 50);
};
