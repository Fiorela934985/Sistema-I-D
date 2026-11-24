/* Sistema I+D — Proyectos (prompt maestro, sección 6). Una sola entrada en el menú.
   · Lista: buscador, filtros (responsable, tipo, año), Agrupar por Fecha · Estado · Responsable; tarjetas con tipo,
     responsable, fechas, % de avance (diseños cerrados / total), diseños abiertos y próxima rotura; a la derecha el
     radar con la etapa del flujo en la que está cada proyecto.
   · Dentro de un proyecto: Resumen · Muestras · Diseños · Ensayos · Informes · Plan de trabajo · Archivo.
     Diseños y Ensayos solo aparecen si el proyecto incluye esos ensayos. Los estados se calculan. */
'use strict';

var expedienteProyecto = null;
var expedienteTab = 'resumen';
var expDisenosSub = 'abiertos';
var proyCharts = {};
function destruirProyChart(id){ if(proyCharts[id]){ proyCharts[id].destroy(); delete proyCharts[id]; } }

function ordenIteracion(it){
  var p = partesDeIteracion(it);
  var m = MES_NOMBRES.indexOf(p.mes);
  return (m < 0 ? 99 : m) * 10 + Math.max(0, NUMERAL_ROMANO.indexOf(p.numeral));
}
function tagEstadoDiseno(estado){
  return '<span class="tag-pill ' + (estado === 'Cerrado' ? 'tag-verde' : 'tag-celeste') + '">' + esc(estado) + '</span>';
}
function tagEstadoProyecto(estado){
  return '<span class="tag-pill ' + (estado === 'Cerrado' ? 'tag-verde' : 'tag-celeste') + '">' + esc(estado) + '</span>';
}
function kpiCard(clase, icono, valor, etiqueta){
  return '<div class="kpi-card '+clase+'"><div class="kpi-icon">'+icono+'</div><div><div class="kpi-num">'+valor+'</div><div class="kpi-label">'+etiqueta+'</div></div></div>';
}
var ICO_CARPETA = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"/></svg>';
var ICO_ACTIVO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>';
var ICO_DISENO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="7" x2="16" y2="7"/><line x1="8" y1="12" x2="16" y2="12"/></svg>';
var ICO_ALERTA = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';
var ICO_RESIST = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17l6-6 4 4 8-8"/></svg>';

function nombreDe(id){ var u = id ? usuarioPorId(id) : null; return u ? (u.nombre || u.usuario) : ''; }
function tipoDe(ficha){ var f = Lab.flujo(ficha.tipo_flujo_id); return f ? f.tipo_proyecto : '—'; }
function rangoFechas(ficha){
  if(!ficha.fecha_inicio && !ficha.fecha_fin) return '<span class="chip-falta">Falta: fechas</span>';
  return esc(ficha.fecha_inicio ? isoToDMY(ficha.fecha_inicio) : '?') + ' – ' + esc(ficha.fecha_fin ? isoToDMY(ficha.fecha_fin) : '?');
}

/* ================= LISTA DE PROYECTOS ================= */
function fichasFiltradas(){
  var txt = normalizar(document.getElementById('proy-buscar').value);
  var resp = document.getElementById('proy-f-responsable').value;
  var tipo = document.getElementById('proy-f-tipo').value;
  var anio = document.getElementById('proy-f-anio').value;
  return fichasProyecto.filter(function(f){
    if(f.anulado) return false;
    if(txt && normalizar(f.nombre + ' ' + f.codigo).indexOf(txt) === -1) return false;
    if(resp && f.responsable_id !== resp) return false;
    if(tipo && f.tipo_flujo_id !== tipo) return false;
    if(anio && String(f.fecha_inicio || f.creado_en || '').slice(0, 4) !== anio) return false;
    return true;
  });
}
function poblarFiltrosProyectos(){
  var selR = document.getElementById('proy-f-responsable'), vR = selR.value;
  var resp = {}; fichasProyecto.forEach(function(f){ if(f.responsable_id) resp[f.responsable_id] = nombreDe(f.responsable_id); });
  selR.innerHTML = '<option value="">Todos los responsables</option>' + Object.keys(resp).map(function(id){ return '<option value="'+esc(id)+'"'+(id===vR?' selected':'')+'>'+esc(resp[id])+'</option>'; }).join('');
  var selT = document.getElementById('proy-f-tipo'), vT = selT.value;
  selT.innerHTML = '<option value="">Todos los tipos</option>' + Lab.flujos(false).map(function(f){ return '<option value="'+esc(f.id)+'"'+(f.id===vT?' selected':'')+'>'+esc(f.tipo_proyecto)+'</option>'; }).join('');
  var selA = document.getElementById('proy-f-anio'), vA = selA.value;
  var anios = {}; fichasProyecto.forEach(function(f){ var a = String(f.fecha_inicio || f.creado_en || '').slice(0, 4); if(/^\d{4}$/.test(a)) anios[a] = true; });
  selA.innerHTML = '<option value="">Todos los años</option>' + Object.keys(anios).sort().reverse().map(function(a){ return '<option'+(a===vA?' selected':'')+'>'+a+'</option>'; }).join('');
}
function renderProyectosPanel(){
  asegurarFichas();
  if(expedienteProyecto){ renderExpediente(); return; }
  document.getElementById('proy-vista-principal').style.display = 'block';
  document.getElementById('proy-expediente').style.display = 'none';
  poblarFiltrosProyectos();
  renderListaProyectos();
}
function tarjetaProyectoHtml(f){
  var r = resumenProyecto(f);
  var prox = r.proximaRotura;
  return '<article class="proy-card" data-proy="'+esc(f.nombre)+'" tabindex="0">' +
    '<div class="pc-head"><div><h4>'+esc(f.nombre)+'</h4><span class="pc-codigo mono">'+esc(f.codigo || '')+' · '+esc(tipoDe(f))+'</span></div>'+tagEstadoProyecto(r.estado)+'</div>' +
    '<div class="pc-datos"><span>'+(f.responsable_id ? esc(nombreDe(f.responsable_id)) : '<span class="chip-falta">Falta: responsable</span>')+'</span><span>'+rangoFechas(f)+'</span></div>' +
    '<div class="pc-bar"><div class="pc-bar-fill" style="width:'+r.avancePct+'%"></div></div>' +
    '<div class="pc-meta"><span><b>'+r.avancePct+'%</b> · '+r.cerrados+'/'+r.disenos.length+' diseños cerrados</span><span>'+r.abiertos.length+' abierto'+(r.abiertos.length===1?'':'s')+'</span></div>' +
    '<div class="pc-meta">' + (r.atrasadas ? '<span class="chip-falta atrasado">'+r.atrasadas+' rotura'+(r.atrasadas===1?'':'s')+' atrasada'+(r.atrasadas===1?'':'s')+'</span>' :
      (prox ? '<span>Próxima rotura: <b>'+prox.dia+'d</b> el '+isoToDMY(prox.fechaEnsayo)+'</span>' : '<span class="nota-sm">Sin roturas pendientes</span>')) + '</div>' +
  '</article>';
}
function renderListaProyectos(){
  var lista = fichasFiltradas();
  var modo = document.getElementById('proy-agrupar').value;
  var grupos = {}, orden = [];
  var meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  lista.forEach(function(f){
    var clave, etiqueta;
    if(modo === 'estado'){ var e = resumenProyecto(f).estado; clave = e === 'Abierto' ? '0' : '1'; etiqueta = e === 'Abierto' ? 'Abiertos' : 'Cerrados'; }
    else if(modo === 'responsable'){ clave = f.responsable_id ? nombreDe(f.responsable_id) : '~'; etiqueta = f.responsable_id ? nombreDe(f.responsable_id) : 'Sin responsable'; }
    else { var fe = f.fecha_inicio || ''; clave = fe ? fe.slice(0, 7) : '0000'; etiqueta = fe ? meses[Number(fe.slice(5, 7)) - 1] + ' ' + fe.slice(0, 4) : 'Sin fecha de inicio'; }
    if(!grupos[clave]){ grupos[clave] = {etiqueta:etiqueta, items:[]}; orden.push(clave); }
    grupos[clave].items.push(f);
  });
  orden.sort(); if(modo === 'fecha') orden.reverse();
  document.getElementById('proy-grupos').innerHTML = lista.length ? orden.map(function(k){
    var g = grupos[k];
    g.items.sort(function(a,b){ return (b.fecha_inicio || '').localeCompare(a.fecha_inicio || '') || a.nombre.localeCompare(b.nombre); });
    return '<div class="proy-grupo"><div class="proy-grupo-cab">'+esc(g.etiqueta)+' <span class="col-count-badge suave">'+g.items.length+'</span></div><div class="proy-grid">' + g.items.map(tarjetaProyectoHtml).join('') + '</div></div>';
  }).join('') : '<div class="empty-note">No hay proyectos con ese filtro.</div>';
  renderRadarEtapas(lista);
}
/* Radar: en qué etapa del flujo está cada proyecto */
/* Radar de proyectos (gráfico con puntos): en qué etapa del flujo está cada proyecto, o sus indicadores */
var radarSel = null, radarModo = 'etapas';
var EJES_ETAPAS = ['Agregados', 'Diseño', 'Elaboración', 'Estado fresco', 'Estado endurecido', 'Informes'];
function valoresEtapas(f){
  var ds = resumenProyecto(f).disenos;
  var pct = function(paso){
    if(!ds.length) return 0;
    return Math.round(ds.filter(function(d){ var e = estadoPaso(d, paso); return e === 'hecho' || e === 'no-aplica'; }).length / ds.length * 100);
  };
  var rr = rrEstudios.filter(function(e){ return (e.proyecto || proyectoNombre(e.proyectoId)) === f.nombre; });
  return [pct('agregados'), pct('diseno'), pct('elaboracion'), pct('fresco'), pct('endurecido'), rr.length ? Math.round(rr.filter(function(e){ return e.estado === 'emitido'; }).length / rr.length * 100) : 0];
}
function renderRadarEtapas(lista){
  var cont = document.getElementById('proy-radar');
  var nombres = lista.map(function(f){ return f.nombre; });
  if(!radarSel) radarSel = lista.slice().sort(function(a,b){ return resumenProyecto(b).disenos.length - resumenProyecto(a).disenos.length; }).slice(0, 4).map(function(f){ return f.nombre; });
  var sel = radarSel.filter(function(n){ return nombres.indexOf(n) > -1; });
  cont.innerHTML = '<div class="view-toggle radar-modo"><button class="view-toggle-btn' + (radarModo === 'etapas' ? ' active' : '') + '" data-radar-modo="etapas">Etapas</button>' +
      '<button class="view-toggle-btn' + (radarModo === 'indicadores' ? ' active' : '') + '" data-radar-modo="indicadores">Indicadores</button></div>' +
    '<div class="radar-graf"><canvas id="chart-radar-proyectos"></canvas></div>' +
    '<div class="radar-picker">' + lista.map(function(f, k){
      var on = sel.indexOf(f.nombre) > -1, col = PALETA[sel.indexOf(f.nombre) % PALETA.length];
      return '<label class="radar-chip' + (on ? ' on' : '') + '"' + (on ? ' style="border-color:' + col + ';"' : '') + '><input type="checkbox" data-radar="' + esc(f.nombre) + '"' + (on ? ' checked' : '') + '>' +
        (on ? '<i style="background:' + col + '"></i>' : '') + esc(f.nombre) + '</label>';
    }).join('') + '</div>';
  destruirProyChart('radar');
  if(typeof Chart === 'undefined') return;
  var datos;
  if(radarModo === 'etapas') datos = sel.map(function(n){ return {nombre:n, valores:valoresEtapas(fichaDeProyecto(n))}; });
  else datos = ejesRadar(sel.map(metricasProyecto));
  proyCharts.radar = new Chart(document.getElementById('chart-radar-proyectos'), {
    type:'radar',
    data:{labels:radarModo === 'etapas' ? EJES_ETAPAS : EJES_RADAR, datasets:datos.map(function(x, i){
      var col = PALETA[i % PALETA.length];
      return {label:x.nombre, data:x.valores, borderColor:col, backgroundColor:col + '22', pointBackgroundColor:col, pointRadius:3.5, borderWidth:2};
    })},
    options:{responsive:true, maintainAspectRatio:false, animation:false,
      scales:{r:{min:0, max:100, ticks:{stepSize:25, display:false}, pointLabels:{font:{size:11, weight:'600'}, color:'#14181a'}}},
      plugins:{legend:{display:false}, tooltip:{callbacks:{label:function(c){ return c.dataset.label + ': ' + c.parsed.r + '%'; }}}}}
  });
}
document.getElementById('proy-radar').addEventListener('click', function(e){
  var m = e.target.closest('[data-radar-modo]');
  if(m){ radarModo = m.dataset.radarModo; renderRadarEtapas(fichasFiltradas()); }
});
document.getElementById('proy-radar').addEventListener('change', function(e){
  var n = e.target.dataset.radar;
  if(!n) return;
  if(e.target.checked){ if(radarSel.length >= 6){ toast('Máximo 6 proyectos en el radar'); e.target.checked = false; return; } radarSel.push(n); }
  else radarSel = radarSel.filter(function(x){ return x !== n; });
  renderRadarEtapas(fichasFiltradas());
});
['proy-buscar','proy-f-responsable','proy-f-tipo','proy-f-anio','proy-agrupar'].forEach(function(id){
  document.getElementById(id).addEventListener(id === 'proy-buscar' ? 'input' : 'change', renderListaProyectos);
});
document.getElementById('proy-vista-principal').addEventListener('click', function(e){
  var card = e.target.closest('[data-proy]');
  if(card) abrirExpediente(card.dataset.proy);
});
document.getElementById('proy-vista-principal').addEventListener('keydown', function(e){
  if(e.key === 'Enter'){ var card = e.target.closest('[data-proy]'); if(card) abrirExpediente(card.dataset.proy); }
});

/* ================= DENTRO DE UN PROYECTO ================= */
var EXP_TABS = [
  {id:'resumen', label:'Resumen'},
  {id:'muestras', label:'Muestras'},
  {id:'disenos', label:'Diseños', requiere:['diseno']},
  {id:'ensayos', label:'Ensayos', requiere:['fresco','endurecido']},
  {id:'informes', label:'Informes'},
  {id:'plan', label:'Plan de trabajo'},
  {id:'archivo', label:'Archivo'}
];
/* Nombres viejos de pestañas que todavía usan otros módulos */
var EXP_TAB_ALIAS = {resultados:'ensayos', comparativo:'ensayos', evidencias:'muestras', reportes:'informes', historial:'resumen'};
function tabsDeProyecto(ficha){
  var et = etapasDelChecklist(ficha);
  return EXP_TABS.filter(function(t){ return !t.requiere || t.requiere.some(function(x){ return et[x]; }); });
}
function abrirExpediente(nombre, tab){
  if(!nombre){ toast('El diseño no tiene proyecto asignado'); return; }
  expedienteProyecto = nombre;
  expedienteTab = EXP_TAB_ALIAS[tab] || tab || 'resumen';
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
  var ficha = fichaDeProyecto(expedienteProyecto);
  if(!ficha){ expedienteProyecto = null; renderProyectosPanel(); return; }
  var r = resumenProyecto(ficha);
  var tabs = tabsDeProyecto(ficha);
  if(!tabs.some(function(t){ return t.id === expedienteTab; })) expedienteTab = 'resumen';
  document.getElementById('proy-vista-principal').style.display = 'none';
  var wrap = document.getElementById('proy-expediente');
  wrap.style.display = 'block';
  var cuenta = {disenos:r.disenos.length, archivo:r.cerrados, informes:rrDeProyecto(ficha.nombre, r.disenos).length};
  wrap.innerHTML =
    '<button class="comp-back" id="exp-volver">← Todos los proyectos</button>' +
    '<div class="exp-header">' +
      '<div><span class="exp-kicker">'+esc(ficha.codigo || '')+' · '+esc(tipoDe(ficha))+'</span><h2>'+esc(ficha.nombre)+'</h2>' +
        '<div class="exp-sub">'+tagEstadoProyecto(r.estado)+' <span>'+(ficha.responsable_id ? 'Responsable: ' + esc(nombreDe(ficha.responsable_id)) : '<span class="chip-falta">Falta: responsable</span>')+' · '+rangoFechas(ficha)+' · '+r.avancePct+'% de avance</span></div></div>' +
      '<div class="ch-actions">' +
        '<button class="btn-add ghost" id="exp-editar" data-perm="proyectos:editar">'+EDIT_ICON+' Editar proyecto</button>' +
        '<button class="btn-add ghost" data-ver-indicadores>'+CHART_ICON+' Indicadores</button>' +
        '<button class="btn-add ghost" id="exp-exportar" data-perm="datos:exportar">Exportar</button>' +
        (etapasDelChecklist(ficha).diseno ? '<button class="btn-add" id="exp-nuevo-diseno" data-perm="disenos:crear">+ Diseño en este proyecto</button>' : '') +
      '</div>' +
    '</div>' +
    (ficha.migrado ? '<div class="aviso-ficha">Este proyecto venía de la versión anterior: se le asignó el flujo de Concreto. Completá su ficha con <b>Editar proyecto</b>.</div>' : '') +
    '<div class="roturas-subtabs exp-tabs">' + tabs.map(function(t){
      return '<button class="subtab'+(t.id===expedienteTab?' active':'')+'" data-exp-tab="'+t.id+'">'+t.label+(cuenta[t.id] !== undefined ? ' <span class="col-count-badge suave">'+cuenta[t.id]+'</span>' : '')+'</button>';
    }).join('') + '</div>' +
    '<div id="exp-contenido"></div>';
  renderExpedienteTab(ficha, r);
}
function renderExpedienteTab(ficha, r){
  Object.keys(proyCharts).forEach(destruirProyChart);
  var c = document.getElementById('exp-contenido');
  var m = metricasProyecto(ficha.nombre);
  if(expedienteTab === 'resumen') c.innerHTML = expResumenHtml(ficha, r);
  else if(expedienteTab === 'muestras'){ c.innerHTML = expMuestrasHtml(ficha, r); cargarMiniaturas(c); }
  else if(expedienteTab === 'disenos') c.innerHTML = expDisenosHtml(ficha, r);
  else if(expedienteTab === 'ensayos'){ c.innerHTML = expFrescoHtml(r) + expResultadosHtml(m) + '<div id="cmp-wrap" style="margin-top:16px;"></div>'; dibujarExpResultados(m); renderComparativo(m); }
  else if(expedienteTab === 'informes') c.innerHTML = expReportesHtml(m);
  else if(expedienteTab === 'plan') c.innerHTML = expPlanHtml(ficha);
  else if(expedienteTab === 'archivo') c.innerHTML = expArchivoHtml(ficha, r);
}

/* ---- Resumen ---- */
function expResumenHtml(ficha, r){
  var ensayos = ficha.ensayos.map(Lab.ensayo).filter(Boolean);
  var obj = ficha.objetivos || [];
  var objHtml = obj.length ? '<ul class="obj-lista">' + obj.map(function(o){
    var c = cumplimientoObjetivo(o, r.disenos);
    var tag = c.estado === 'cumple' ? '<span class="tag-pill tag-verde">Cumple</span>' : c.estado === 'no-cumple' ? '<span class="tag-pill tag-rojo">No cumple</span>' : '<span class="tag-pill tag-gris">Sin datos</span>';
    return '<li>'+tag+' <span>'+esc(textoObjetivo(o))+'</span>'+(isFinite(c.valor) ? ' <b class="mono">→ '+fmt(c.valor, 1)+'</b>' : '')+'</li>';
  }).join('') + '</ul>' : '<p class="nota-sm">Sin objetivos. <span class="chip-falta">Falta: objetivos</span></p>';
  var prox = r.pendientes.slice(0, 5);
  var movs = historialDeProyecto(ficha.nombre).slice(0, 5);
  return '<div class="exp-resumen">' +
    '<div class="card"><div class="section-num">Objetivos y cumplimiento</div>'+objHtml+'</div>' +
    '<div class="card"><div class="section-num">Avance</div><div class="avance-grande"><b>'+r.avancePct+'%</b><span>'+r.cerrados+' de '+r.disenos.length+' diseños cerrados</span></div>' +
      '<div class="pc-bar"><div class="pc-bar-fill" style="width:'+r.avancePct+'%"></div></div>' +
      '<p class="nota-sm">'+r.abiertos.length+' abiertos'+(r.atrasadas ? ' · <span class="txt-rojo">'+r.atrasadas+' roturas atrasadas</span>' : '')+'</p></div>' +
    '<div class="card"><div class="section-num">Responsables</div><p><b>'+(ficha.responsable_id ? esc(nombreDe(ficha.responsable_id)) : '—')+'</b> <span class="nota-sm">responsable</span></p>' +
      '<div class="chips-fila">'+((ficha.equipo || []).map(function(id){ return '<span class="chip-campo">'+esc(nombreDe(id))+'</span>'; }).join('') || '<span class="nota-sm">Sin equipo asignado</span>')+'</div>' +
      '<p class="nota-sm" style="margin-top:8px;">'+ensayos.length+' ensayos elegidos · edades de rotura: '+(ficha.edades || []).map(function(d){ return d + ' d'; }).join(', ')+'</p></div>' +
    '<div class="card"><div class="section-num">Próximas fechas</div>' + (prox.length ? '<table class="data-table compacta"><tbody>' + prox.map(function(c){
      var atr = c.fechaEnsayo < todayISO();
      return '<tr title="'+esc(c.codigo || '')+'"><td class="mono'+(atr?' txt-rojo':'')+'">'+isoToDMY(c.fechaEnsayo).slice(0,5)+'</td><td class="celda-larga">'+esc(c.producto || c.replicaNombre)+'</td><td>'+c.dia+' d</td></tr>';
    }).join('') + '</tbody></table>' : '<p class="nota-sm">Sin roturas pendientes.</p>') + '</div>' +
    '<div class="card exp-movs"><div class="section-num">Últimos movimientos</div>' + (movs.length ? '<ul class="mov-lista">' + movs.map(function(h){
      return '<li><span class="mono">'+fechaHora(h.ts)+'</span> <b>'+esc(h.usuario)+'</b> '+esc(h.accion.toLowerCase())+' '+esc(h.entidad.toLowerCase())+(h.detalle ? ': '+esc(h.detalle) : '')+(h.motivo ? ' <span class="nota-sm">('+esc(h.motivo)+')</span>' : '')+'</li>';
    }).join('') + '</ul>' : '<p class="nota-sm">Sin movimientos.</p>') + '</div>' +
  '</div>';
}

/* ---- Muestras: probetas y cubos con su código, y evidencias ---- */
function expMuestrasHtml(ficha, r){
  var codigos = {}; r.disenos.forEach(function(d){ codigos[d.codigo] = true; });
  var lotes = {}; r.disenos.forEach(function(d){ if(d.loteAgregadoId) (lotes[d.loteAgregadoId] = lotes[d.loteAgregadoId] || []).push(d.codigo); });
  var lotesHtml = Object.keys(lotes).length ? '<div class="card" style="margin-bottom:16px;"><div class="section-num">Lotes de agregado recibidos</div><div class="table-scroll"><table class="data-table"><thead><tr><th>Lote</th><th>Fino</th><th>Grueso</th><th>Procedencia</th><th>Muestreo</th><th>Diseños</th></tr></thead><tbody>' +
    Object.keys(lotes).map(function(id){ var l = lotePorId(id) || {}; return '<tr><td class="mono"><b>'+esc(l.codigo || id)+'</b></td><td>'+esc(l.fino || '—')+'</td><td>'+esc(l.grueso || '—')+'</td><td>'+esc(l.procedencia || '—')+'</td><td>'+(l.fecha ? isoToDMY(l.fecha) : '—')+'</td><td class="mono">'+esc(lotes[id].join(', '))+'</td></tr>'; }).join('') +
    '</tbody></table></div></div>' : '';
  var porCodigo = {};
  roturaCargas.filter(function(c){ return !c.anulada && (codigos[c.disenoCodigoDiseno] || c.proyecto === ficha.nombre); }).forEach(function(c){
    var k = c.codigo || c.replicaNombre;
    if(!porCodigo[k]) porCodigo[k] = {codigo:c.codigo, producto:c.producto || c.replicaNombre, tipo:c.tipo, elab:c.fechaElaboracion, hora:c.horaElaboracion, edades:[], hechas:0};
    porCodigo[k].edades.push(c.dia);
    if(c.estado === 'completado') porCodigo[k].hechas++;
  });
  var filas = Object.keys(porCodigo).map(function(k){ return porCodigo[k]; }).sort(function(a,b){ return String(a.codigo).localeCompare(String(b.codigo)); });
  return lotesHtml + '<div class="card"><div class="ev-toolbar"><span class="section-num" style="margin:0;">Probetas y cubos</span><button class="btn-add ghost" data-etiquetas-proyecto>'+TAG_ICON+' Etiquetas QR</button></div>' +
    (filas.length ? '<div class="table-scroll"><table class="data-table"><thead><tr><th>Código</th><th>Producto</th><th>Tipo</th><th>Elaboración</th><th>Edades</th><th>Roturas</th></tr></thead><tbody>' + filas.map(function(m){
      return '<tr><td class="mono"><b>'+esc(m.codigo || '—')+'</b></td><td>'+esc(m.producto)+'</td><td>'+esc(m.tipo || '')+'</td><td>'+(m.elab ? isoToDMY(m.elab) : '—')+(m.hora ? ' '+esc(m.hora) : ' <span class="chip-falta">Falta: hora</span>')+'</td>' +
        '<td>'+m.edades.sort(function(a,b){ return a-b; }).map(function(d){ return '<span class="chip-edad">'+d+' d</span>'; }).join('')+'</td><td>'+m.hechas+'/'+m.edades.length+'</td></tr>';
    }).join('') + '</tbody></table></div>' : '<p class="nota-sm">Sin especímenes.</p>') + '</div>' +
    '<div class="card" style="margin-top:16px;"><div class="ev-toolbar"><span class="section-num" style="margin:0;">Evidencias fotográficas</span>' +
      '<button class="btn-add" id="exp-evidencia-2" data-perm="evidencias:subir">'+CAMERA_ICON+' Subir evidencia</button></div><div id="exp-galeria">'+galeriaEvidenciasHtml(evidenciasDeProyecto(ficha.nombre))+'</div></div>';
}

/* ---- Diseños: Abiertos y Cerrados, con chips de "Falta" y semáforo ---- */
function filaDisenoHtml(d){
  var rm = resistenciaMaxima(d);
  return '<tr><td>'+semaforoDotHtml(semaforoChecklist(d))+'</td><td class="mono">'+esc(d.codigo)+'</td><td><b class="nombre-tecnico">'+esc(diseñoTitulo(d))+'</b><div class="chips-fila">'+chipsFaltaHtml(d)+'</div></td>' +
    '<td>'+esc(d.iteracionId || '—')+'</td><td>'+esc(d.fecha || '—')+'</td><td>'+(isFinite(rm) ? fmt(rm, 1) : '—')+'</td>' +
    '<td class="acciones-fila"><button class="btn-icon" data-exp-act="flujo" data-codigo="'+esc(d.codigo)+'" title="Flujo del diseño (5 pasos)">'+FLUJO_ICON+'</button>' +
    '<button class="btn-icon" data-exp-act="view" data-codigo="'+esc(d.codigo)+'" title="Ver diseño">'+EYE_ICON+'</button>' +
    '<button class="btn-icon" data-exp-act="resultados" data-codigo="'+esc(d.codigo)+'" data-perm="resultados:registrar" title="Estado fresco">'+RESULTS_ICON+'</button>' +
    '<button class="btn-icon" data-exp-act="informe" data-codigo="'+esc(d.codigo)+'" title="Informe">'+CHART_ICON+'</button>' +
    '<button class="btn-icon" data-exp-act="etiquetas" data-codigo="'+esc(d.codigo)+'" title="Etiquetas">'+TAG_ICON+'</button></td></tr>';
}
function tablaDisenosHtml(lista, vacio){
  if(!lista.length) return '<div class="empty-note">'+vacio+'</div>';
  lista = lista.slice().sort(function(a,b){ return ordenIteracion(b.iteracionId) - ordenIteracion(a.iteracionId) || (b.ts||0) - (a.ts||0); });
  return '<div class="table-scroll"><table class="data-table"><thead><tr><th></th><th>Código</th><th>Diseño</th><th>Iteración</th><th>Fecha</th><th>Máx. kg/cm²</th><th></th></tr></thead><tbody>' +
    lista.map(filaDisenoHtml).join('') + '</tbody></table></div>';
}
function expDisenosHtml(ficha, r){
  var cerrados = r.disenos.filter(function(d){ return estadoCalculado(d) === 'Cerrado'; });
  return '<div class="card"><div class="ev-toolbar"><div class="view-toggle" id="exp-dis-sub">' +
      '<button class="view-toggle-btn'+(expDisenosSub==='abiertos'?' active':'')+'" data-dis-sub="abiertos">Abiertos ('+r.abiertos.length+')</button>' +
      '<button class="view-toggle-btn'+(expDisenosSub==='cerrados'?' active':'')+'" data-dis-sub="cerrados">Cerrados ('+cerrados.length+')</button></div></div>' +
    (expDisenosSub === 'abiertos' ? tablaDisenosHtml(r.abiertos, 'No hay diseños abiertos.') : tablaDisenosHtml(cerrados, 'Todavía no hay diseños cerrados.')) + '</div>';
}

/* ---- Ensayos: estado fresco y endurecido ---- */
function expFrescoHtml(r){
  var filas = [];
  r.disenos.forEach(function(d){
    ((d.resultados && d.resultados.replicas) || []).forEach(function(rep, i){
      var s0 = (rep.slump || [])[0] || {};
      if(!(s0.slump || s0.tempc || rep.pesoUnitario || rep.aire)) return;
      var nombreRep = (d.replicaObjs && d.replicaObjs[i] && d.replicaObjs[i].nombre) || (diseñoTitulo(d) + '-R' + (i + 1));
      filas.push('<tr><td class="mono">'+esc(d.codigo)+'</td><td>'+esc(nombreRep)+'</td><td>'+esc(s0.slump || '—')+'</td><td>'+esc(s0.tempc || '—')+'</td><td>'+esc(s0.tempa || '—')+'</td><td>'+esc(rep.pesoUnitario || '—')+'</td><td>'+esc(rep.aire || '—')+'</td><td>'+esc(rep.cohesividad || '—')+'</td></tr>');
    });
  });
  return '<div class="card" style="margin-bottom:16px;"><div class="section-num">Estado fresco</div>' + (filas.length ? '<div class="table-scroll"><table class="data-table"><thead><tr><th>Código</th><th>Réplica</th><th>Slump 0\' (pulg)</th><th>T° concreto</th><th>T° ambiente</th><th>Peso unitario</th><th>Aire %</th><th>Cohesividad</th></tr></thead><tbody>' + filas.join('') + '</tbody></table></div>'
    : '<p class="nota-sm">Sin resultados.</p>') + '</div>';
}
function expResultadosHtml(m){
  var edades = {};
  m.disenos.forEach(function(d){ Object.keys(resistenciaPorEdad(d)).forEach(function(e){ edades[e] = true; }); });
  var lista = Object.keys(edades).map(Number).sort(function(a,b){ return a-b; });
  if(!lista.length) return '<div class="card"><div class="section-num">Estado endurecido</div><p class="nota-sm">Sin roturas registradas.</p></div>';
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
  return '<div class="chart-card"><h4>Estado endurecido: resistencia vs. edad <span class="chart-sub">(promedio de M1–M3 de todas las réplicas, kg/cm²)</span></h4><div class="dash-chart-wrap alto"><canvas id="chart-exp-resultados"></canvas></div></div>' +
    '<div class="card" style="margin-top:16px;"><div class="table-scroll"><table class="data-table"><thead><tr><th>Código</th><th>Diseño</th><th>Iteración</th><th>f\'c</th>' +
    lista.map(function(e){ return '<th>'+e+' d</th>'; }).join('') + '</tr></thead><tbody>'+filas+'</tbody></table></div>' +
    '</div>';
}
function dibujarExpResultados(m){
  if(typeof Chart === 'undefined' || !document.getElementById('chart-exp-resultados')) return;
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

/* ---- Comparativo entre iteraciones (dentro de Ensayos) ---- */
var cmpSeleccion = {};
function renderComparativo(m){
  destruirProyChart('cmp');
  var wrap = document.getElementById('cmp-wrap');
  if(!wrap) return;
  var porIter = {};
  m.disenos.forEach(function(d){ if(d.iteracionId) (porIter[d.iteracionId] = porIter[d.iteracionId] || []).push(d); });
  var iters = Object.keys(porIter).sort(function(a,b){ return ordenIteracion(a) - ordenIteracion(b); });
  if(iters.length < 2){ wrap.innerHTML = ''; return; }
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
    return {iter:it, n:lista.length, cerrados: lista.filter(function(d){ return estadoCalculado(d) === 'Cerrado'; }).length,
      amc: promedio(lista.map(function(d){ return n(d.amcEfectiva) || NaN; })), cemento: promedio(lista.map(contenidoCemento)),
      costo: promedio(lista.map(function(d){ return n(d.cvdTotal) || NaN; })), res: res};
  });
  var edades = Object.keys(edadesSet).map(Number).sort(function(a,b){ return a-b; });
  var mejorPorEdad = {};
  edades.forEach(function(e){
    var vals = resumen.filter(function(r){ return sel.indexOf(r.iter) > -1 && isFinite(r.res[e]); }).map(function(r){ return r.res[e]; });
    mejorPorEdad[e] = vals.length ? Math.max.apply(null, vals) : NaN;
  });
  wrap.innerHTML =
    '<div class="card"><div class="section-num">Comparativo de iteraciones</div><div class="radar-picker">' +
      iters.map(function(it){ var on = sel.indexOf(it) > -1; return '<label class="chip-check'+(on?' on':'')+'"><input type="checkbox" data-cmp="'+esc(it)+'"'+(on?' checked':'')+'> '+esc(it)+' <span class="mono">('+porIter[it].length+')</span></label>'; }).join('') +
    '</div></div>' +
    '<div class="chart-card" style="margin-top:16px;"><h4>Resistencia promedio por edad <span class="chart-sub">(cada línea es una iteración)</span></h4><div class="dash-chart-wrap alto"><canvas id="chart-cmp"></canvas></div></div>' +
    '<div class="card" style="margin-top:16px;"><div class="table-scroll"><table class="data-table"><thead><tr><th>Iteración</th><th>Diseños</th><th>Cerrados</th><th>a/mc prom.</th><th>Cemento prom. (kg/m³)</th><th>CVD prom. (S/.)</th>' +
      edades.map(function(e){ return '<th>'+e+' d (kg/cm²)</th>'; }).join('') + '</tr></thead><tbody>' +
      resumen.filter(function(r){ return sel.indexOf(r.iter) > -1; }).map(function(r){
        return '<tr><td><b>'+esc(r.iter)+'</b></td><td>'+r.n+'</td><td>'+r.cerrados+'</td><td>'+fmt(r.amc,2)+'</td><td>'+fmt(r.cemento,0)+'</td><td>'+fmt(r.costo,2)+'</td>' +
          edades.map(function(e){ var v = r.res[e]; var mejor = isFinite(v) && v === mejorPorEdad[e] && sel.length > 1; return '<td'+(mejor?' class="ok"':'')+'>'+(isFinite(v)?fmt(v,1):'-')+'</td>'; }).join('') + '</tr>';
      }).join('') +
    '</tbody></table></div></div>';
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

/* ---- Informes ---- */
function expReportesHtml(m){
  var lista = rrDeProyecto(m.nombre, m.disenos);
  var barra = '<div class="ev-toolbar"><span class="section-num" style="margin:0;">Reportes RR</span>' +
    '<span class="ch-actions"><button class="btn-add ghost" data-ver-indicadores>'+CHART_ICON+' Ver indicadores</button>' +
    '<button class="btn-add" data-goto="reporte-rr" data-perm="rr:editar">+ Nuevo Reporte RR</button></span></div>';
  var rr = lista.length ? '<div class="proy-grid">' + lista.map(function(e){
    return '<article class="proy-card"><div class="pc-head"><h4>'+esc(e.nombre)+'</h4>'+(e.generado?'<span class="tag-pill tag-verde">Generado</span>':'<span class="tag-pill tag-gris">Borrador</span>')+'</div>' +
      '<div class="pc-meta"><span>'+e.tipos.length+' diseños · '+e.edades.length+' edades</span><span>'+esc(e.fecha||'')+'</span></div>' +
      '<div class="pc-foot"><span class="mono">'+esc(e.tipos.slice(0,2).map(function(t){ return t.nombre; }).join(', '))+(e.tipos.length>2?'…':'')+'</span><button class="btn-add" data-abrir-rr="'+esc(e.id)+'">Abrir en visor →</button></div></article>';
  }).join('') + '</div>' : '<div class="empty-note">Todavía no hay reportes RR de este proyecto.</div>';
  return '<div class="card">' + barra + rr + '</div>' +
    '<div class="card fase-card" style="margin-top:16px;"><div class="section-num">Informe final del proyecto <span class="fase-chip">Fase 4</span></div>' +
    '<p class="nota-sm">Con revisión y aprobación de un responsable antes de emitirse (17025, 7.8).</p></div>';
}

/* ---- Archivo: diseños cerrados con sus informes ---- */
function expArchivoHtml(ficha, r){
  var cerrados = r.disenos.filter(function(d){ return estadoCalculado(d) === 'Cerrado'; });
  return '<div class="card"><div class="section-num">Diseños cerrados</div>' + tablaDisenosHtml(cerrados, 'Todavía no hay diseños cerrados en este proyecto.') + '</div>' +
    '<div class="card fase-card" style="margin-top:16px;"><div class="section-num">Documentos del proyecto <span class="fase-chip">Fase 7</span></div></div>';
}

function exportarExpediente(ficha){
  var r = resumenProyecto(ficha), m = metricasProyecto(ficha.nombre);
  var resumen = [['Proyecto', ficha.nombre], ['Código', ficha.codigo], ['Tipo', tipoDe(ficha)], ['Responsable', nombreDe(ficha.responsable_id)],
    ['Equipo', (ficha.equipo || []).map(nombreDe).join(', ')], ['Inicio', ficha.fecha_inicio ? isoToDMY(ficha.fecha_inicio) : ''], ['Fin estimado', ficha.fecha_fin ? isoToDMY(ficha.fecha_fin) : ''],
    ['Estado', r.estado], ['Avance', r.avancePct + '%'], ['Diseños', r.disenos.length], ['Cerrados', r.cerrados], ['Roturas atrasadas', r.atrasadas],
    ['Exportado', fechaHora(Date.now()) + ' por ' + (usuarioActual ? usuarioActual.usuario : '')]];
  var obj = [['Objetivo','Cumplimiento','Valor']].concat((ficha.objetivos || []).map(function(o){ var c = cumplimientoObjetivo(o, r.disenos); return [textoObjetivo(o), c.estado, isFinite(c.valor) ? +c.valor.toFixed(1) : '']; }));
  var ens = [['Código','Ensayo','Etapa','Norma / método','Versión']].concat(ficha.ensayos.map(Lab.ensayo).filter(Boolean).map(function(e){ return [e.codigo, e.nombre, etapaLabel(e.etapa), e.metodo, e.version]; }));
  var dis = [['Código','Diseño','Iteración','Fecha','f\'c','a/mc','CVD (S/.)','Estado','Falta']].concat(r.disenos.map(function(d){
    return [d.codigo, diseñoTitulo(d), d.iteracionId||'', d.fecha||'', n(d.fc)||'', n(d.amcEfectiva)||'', n(d.cvdTotal)||'', estadoCalculado(d), faltaDiseno(d).map(function(f){ return f.texto; }).join('; ')];
  }));
  var filasBH = baseHistoricaFilas().filter(function(f){ return f.proyecto === m.nombre; });
  var res = [BH_COLUMNAS.map(function(c){ return c.t; })].concat(filasBH.map(function(f){ return BH_COLUMNAS.map(function(c){ return f[c.k]; }); }));
  var his = [['Fecha','Usuario','Acción','Módulo','Detalle','Motivo']].concat(historialDeProyecto(m.nombre).map(function(h){ return [fechaHora(h.ts), h.usuario, h.accion, h.entidad, h.detalle, h.motivo || '']; }));
  if(exportarExcel('Proyecto - ' + ficha.nombre + '.xlsx', [{nombre:'Resumen', filas:resumen}, {nombre:'Objetivos', filas:obj}, {nombre:'Ensayos', filas:ens}, {nombre:'Diseños', filas:dis}, {nombre:'Resultados', filas:res}, {nombre:'Historial', filas:his}])){
    registrarHistorial('Exportó', 'Proyectos', 'Expediente ' + ficha.nombre, {proyecto:ficha.nombre, codigo:ficha.codigo});
    toast('Proyecto exportado a Excel');
  }
}
document.getElementById('proy-expediente').addEventListener('click', function(e){
  if(e.target.closest('#exp-volver')){ cerrarExpediente(); return; }
  var tab = e.target.closest('[data-exp-tab]');
  if(tab){ expedienteTab = tab.dataset.expTab; renderExpediente(); return; }
  var sub = e.target.closest('[data-dis-sub]');
  if(sub){ expDisenosSub = sub.dataset.disSub; renderExpediente(); return; }
  var ficha = fichaDeProyecto(expedienteProyecto);
  if(e.target.closest('#exp-editar')){ if(exigir('proyectos:editar')) abrirAsistenteProyecto(ficha); return; }
  if(e.target.closest('#exp-evidencia-2')){
    abrirModalEvidencia(expedienteProyecto, '', function(){ expedienteTab = 'muestras'; renderExpediente(); });
    return;
  }
  if(e.target.closest('#exp-exportar')){ exportarExpediente(ficha); return; }
  if(e.target.closest('[data-etiquetas-proyecto]')){ abrirPanelEtiquetas(expedienteProyecto); return; }
  if(e.target.closest('#exp-nuevo-diseno')){
    if(!exigir('disenos:crear')) return;
    showPanel('disenos'); showSubTab('calcular');
    fillProyectoCatalogoSelect(document.getElementById('pp-proyecto'), expedienteProyecto);
    fillPpIteracionSelect(expedienteProyecto, '');
    refreshNombrePreview();
    return;
  }
  var act = e.target.closest('[data-exp-act]');
  if(act){
    var d = disenoPorCodigo(act.dataset.codigo);
    if(!d) return;
    if(act.dataset.expAct === 'flujo') abrirFlujoDiseno(d);
    else if(act.dataset.expAct === 'view') openDesignModal(d);
    else if(act.dataset.expAct === 'informe') openInformeModal(d);
    else if(act.dataset.expAct === 'etiquetas') abrirEtiquetas(d.codigo);
    else if(act.dataset.expAct === 'resultados'){ if(exigir('resultados:registrar')) openResultsModal(d, disenos.indexOf(d)); }
    return;
  }
  var rr = e.target.closest('[data-abrir-rr]');
  if(rr){ abrirRR(rr.dataset.abrirRr); return; }
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
// Tocar "Proyectos" en el menú siempre vuelve a la lista (cierra el proyecto abierto).
document.querySelector('.side-nav [data-panel="proyectos"]').addEventListener('click', function(){ expedienteProyecto = null; }, true);
