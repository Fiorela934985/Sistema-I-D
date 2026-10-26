/* Sistema I+D — Panel PROYECTOS (sección 5): lista con filtros, ficha, expediente con sus pestañas y radar. */
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
  var cls = estado === 'Completado' || estado === 'Validado' ? 'tag-verde' : (estado === 'En desarrollo' ? 'tag-naranja' : (estado === 'Cancelado' ? 'tag-gris' : 'tag-celeste'));
  return '<span class="tag-pill '+cls+'">'+esc(estado)+'</span>';
}
function tagEstadoProyecto(estado){
  var cls = {'Completado':'tag-verde', 'En curso':'tag-celeste', 'En pausa':'tag-naranja', 'Cancelado':'tag-gris', 'Planificado':'tag-gris'}[estado] || 'tag-gris';
  return '<span class="tag-pill '+cls+'">'+esc(estado)+'</span>';
}
function kpiCard(clase, icono, valor, etiqueta){
  return '<div class="kpi-card '+clase+'"><div class="kpi-icon">'+icono+'</div><div><div class="kpi-num">'+valor+'</div><div class="kpi-label">'+etiqueta+'</div></div></div>';
}
function soles(v){ return 'S/ ' + (isFinite(v) ? Number(v).toLocaleString('es-PE', {minimumFractionDigits:2, maximumFractionDigits:2}) : '0.00'); }
var ICO_CARPETA = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"/></svg>';
var ICO_ACTIVO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>';
var ICO_DISENO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="7" x2="16" y2="7"/><line x1="8" y1="12" x2="16" y2="12"/></svg>';
var ICO_ALERTA = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';
var ICO_RESIST = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17l6-6 4 4 8-8"/></svg>';
var ICO_COSTO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>';

/* ================= LISTA DE PROYECTOS (RF-PRY-12/13/14) ================= */
function llenarFiltrosProyectos(){
  var put = function(id, valores, vacio, etiqueta){
    var sel = document.getElementById(id), actual = sel.value;
    sel.innerHTML = '<option value="">' + vacio + '</option>' + valores.map(function(v){ return '<option value="'+esc(v)+'"'+(v===actual?' selected':'')+'>'+esc(etiqueta ? etiqueta(v) : v)+'</option>'; }).join('');
  };
  put('proy-filtro-estado', ESTADOS_PROYECTO, 'Todos los estados');
  put('proy-filtro-lab', catalogo('laboratorios'), 'Todos los laboratorios', labLabel);
  put('proy-filtro-equipo', catalogo('equipos'), 'Todos los equipos');
  put('proy-filtro-linea', LINEAS_PROYECTO, 'Todas las líneas');
  put('proy-filtro-prioridad', PRIORIDADES, 'Todas las prioridades');
  var resp = usuariosActivos(['ANA', 'JEF']);
  put('proy-filtro-resp', resp.map(function(u){ return u.id; }), 'Todos los responsables', function(id){ return nombreUsuario(usuarioPorId(id)); });
}
function proyectosFiltrados(){
  var txt = normalizar(document.getElementById('proy-buscar').value);
  var f = function(id){ return document.getElementById(id).value; };
  var desde = f('proy-filtro-desde');
  var lista = proyectosVisibles().filter(function(p){
    if(txt && normalizar(p.nombre + ' ' + p.codigo).indexOf(txt) === -1) return false;
    if(f('proy-filtro-estado') && p.estado !== f('proy-filtro-estado')) return false;
    if(f('proy-filtro-lab') && p.laboratorio !== f('proy-filtro-lab')) return false;
    if(f('proy-filtro-equipo') && p.equipoLider !== f('proy-filtro-equipo') && (p.equiposApoyo || []).indexOf(f('proy-filtro-equipo')) === -1) return false;
    if(f('proy-filtro-linea') && p.linea !== f('proy-filtro-linea')) return false;
    if(f('proy-filtro-prioridad') && p.prioridad !== f('proy-filtro-prioridad')) return false;
    if(f('proy-filtro-resp') && p.responsable !== f('proy-filtro-resp')) return false;
    if(desde && (p.fechaInicio || '') < desde) return false;
    return true;
  });
  var orden = f('proy-orden');
  var met = {};
  lista.forEach(function(p){ met[p.nombre] = metricasProyecto(p.nombre); });
  lista.sort(function(a, b){
    if(orden === 'nombre') return a.nombre.localeCompare(b.nombre);
    if(orden === 'avance') return met[b.nombre].avancePct - met[a.nombre].avancePct;
    return met[b.nombre].ultimaActividad - met[a.nombre].ultimaActividad || (b.creado || 0) - (a.creado || 0);
  });
  return {lista: lista, met: met};
}
function renderProyectosPanel(){
  if(expedienteProyecto){ renderExpediente(); return; }
  document.getElementById('proy-vista-principal').style.display = 'block';
  document.getElementById('proy-expediente').style.display = 'none';
  llenarFiltrosProyectos();
  var vis = proyectosVisibles();
  var metricas = vis.map(function(p){ return metricasProyecto(p.nombre); });
  var rojos = vis.filter(function(p){ return semaforoProyecto(p.nombre).color === 'rojo'; }).length;
  document.getElementById('proy-kpis').innerHTML =
    kpiCard('kpi-naranja', ICO_CARPETA, vis.filter(function(p){ return p.estado === 'En curso'; }).length + ' / ' + vis.length, 'Proyectos en curso / total') +
    kpiCard('kpi-verde', ICO_ACTIVO, metricas.length ? Math.round(promedio(metricas.map(function(m){ return m.avancePct; }))) + '%' : '0%', 'Avance promedio') +
    kpiCard('kpi-negro', ICO_DISENO, metricas.reduce(function(a, m){ return a + m.nDisenos; }, 0), 'Diseños en total') +
    kpiCard('kpi-rojo', ICO_ALERTA, rojos, 'Proyectos en rojo');
  document.getElementById('proy-vista-lista').style.display = proyVista === 'lista' ? 'block' : 'none';
  document.getElementById('proy-vista-radar').style.display = proyVista === 'radar' ? 'block' : 'none';
  if(proyVista === 'lista') renderProyGrid(); else renderRadar(metricas);
}
function renderProyGrid(){
  var r = proyectosFiltrados();
  var grid = document.getElementById('proy-grid');
  if(!r.lista.length){ grid.innerHTML = '<div class="empty-note">No hay proyectos con ese filtro.' + (can('proyectos:crear') ? ' Creá uno con "+ Nuevo proyecto".' : '') + '</div>'; return; }
  grid.innerHTML = r.lista.map(function(p){
    var m = r.met[p.nombre], sem = semaforoProyecto(p.nombre);
    var dr = diasRestantes(p);
    return '<article class="proy-card" data-proy="'+esc(p.nombre)+'">' +
      '<div class="pc-head"><h4>'+semaforoDotHtml(sem.color, sem.motivos.join(', '))+' '+esc(p.nombre)+'</h4>'+tagEstadoProyecto(p.estado)+'</div>' +
      '<div class="pc-meta"><span class="mono">'+esc(p.codigo)+' · '+esc(labLabel(p.laboratorio))+'</span><span>'+esc(p.equipoLider || 'Sin equipo')+'</span></div>' +
      (p.fichaIncompleta ? '<div class="pc-alerta-ficha">Ficha incompleta: completá objetivo, fechas y responsable</div>' : '') +
      '<div class="pc-stats">' +
        '<div><b>'+m.completados+'/'+m.nDisenos+'</b><span>Diseños</span></div>' +
        '<div><b>'+m.iteraciones.length+'</b><span>Iteraciones</span></div>' +
        '<div><b>'+m.cargasCompletas+'/'+m.cargas.length+'</b><span>Roturas</span></div>' +
        '<div><b>'+(dr === null ? '-' : dr)+'</b><span>Días restantes</span></div>' +
      '</div>' +
      '<div class="pc-bar"><div class="pc-bar-fill" style="width:'+m.avancePct+'%"></div></div>' +
      '<div class="pc-meta"><span>'+m.avancePct+'% de avance</span><span>'+esc(sem.motivos.join(', '))+'</span></div>' +
      '<div class="pc-foot"><span class="mono">'+(m.ultimaActividad ? 'Actividad ' + hace(m.ultimaActividad) : 'Sin actividad')+'</span>' +
        '<button class="btn-add" data-abrir-exp="'+esc(p.nombre)+'">Abrir expediente →</button></div>' +
    '</article>';
  }).join('');
}
['proy-buscar','proy-filtro-estado','proy-filtro-lab','proy-filtro-equipo','proy-filtro-linea','proy-filtro-prioridad','proy-filtro-resp','proy-filtro-desde','proy-orden'].forEach(function(id){
  document.getElementById(id).addEventListener(id === 'proy-buscar' ? 'input' : 'change', renderProyGrid);
});
document.getElementById('proy-grid').addEventListener('click', function(e){
  var card = e.target.closest('[data-abrir-exp], .proy-card');
  if(card) abrirExpediente(card.dataset.abrirExp || card.dataset.proy);
});
document.getElementById('proy-vista-toggle').addEventListener('click', function(e){
  var btn = e.target.closest('.view-toggle-btn');
  if(!btn) return;
  proyVista = btn.dataset.vista;
  document.querySelectorAll('#proy-vista-toggle .view-toggle-btn').forEach(function(b){ b.classList.toggle('active', b === btn); });
  renderProyectosPanel();
});
document.getElementById('proy-nuevo-btn').addEventListener('click', function(){ if(exigir('proyectos:crear')) abrirFichaProyecto(null); });
/* RF-PRY-14: Excel con los filtros aplicados. */
document.getElementById('proy-exportar').addEventListener('click', function(){
  if(!exigir('datos:exportar')) return;
  var r = proyectosFiltrados();
  var filas = [['Código','Nombre','Tipo','Línea','Laboratorio','Equipo líder','Equipos de apoyo','Responsable','Prioridad','Estado','Semáforo','Avance %','Inicio','Fin planificado','Días restantes','Presupuesto (S/)','Costo acumulado (S/)','Diseños','Completados','Iteraciones']].concat(r.lista.map(function(p){
    var m = r.met[p.nombre];
    return [p.codigo, p.nombre, p.tipo, p.linea, labLabel(p.laboratorio), p.equipoLider, (p.equiposApoyo||[]).join(', '), nombreUsuario(usuarioPorId(p.responsable)),
      p.prioridad, p.estado, semaforoProyecto(p.nombre).color, m.avancePct, p.fechaInicio, p.fechaFin, diasRestantes(p), n(p.presupuesto) || '',
      +costoProyecto(p.nombre).total.toFixed(2), m.nDisenos, m.completados, m.iteraciones.length];
  }));
  if(exportarExcel('Proyectos I+D ' + todayISO() + '.xlsx', [{nombre:'Proyectos', filas:filas}])) registrarHistorial('Exportó', 'Proyecto', r.lista.length + ' proyectos (con filtros)');
});

/* ================= FICHA DEL PROYECTO (5.1, RF-PRY-01/02) ================= */
function campo(label, html, err){ return '<div class="pp-field"><label>'+label+'</label>'+html+(err ? '<small class="campo-error" data-err="'+err+'"></small>' : '')+'</div>'; }
function abrirFichaProyecto(p){
  var nuevo = !p;
  if(nuevo && !exigir('proyectos:crear')) return;
  if(!nuevo && !puedeEditarProyecto(p)){ toast('No podés editar la ficha de este proyecto'); return; }
  if(!nuevo && !proyectoAbierto(p)){ toast('El proyecto está ' + p.estado + ': sus datos son de solo lectura'); return; }
  var f = p || proyectoNuevoBase('', false);
  var conDisenos = !nuevo && diseñosDeProyecto(p.nombre).length > 0;
  var resp = usuariosActivos(['ANA', 'JEF']);
  var html = '<div class="pred-form ficha-proyecto">' +
    campo('Código', '<input type="text" value="'+esc(nuevo ? 'Se asigna al guardar' : f.codigo)+'" disabled>') +
    campo('Nombre', '<input type="text" id="fp-nombre" maxlength="120" value="'+esc(f.nombre)+'">', 'nombre') +
    campo('Tipo', '<select id="fp-tipo">'+opcionesHtml(TIPOS_PROYECTO, f.tipo)+'</select>', 'tipo') +
    campo('Línea', '<select id="fp-linea">'+opcionesHtml(LINEAS_PROYECTO, f.linea)+'</select>', 'linea') +
    campo('Laboratorio', '<select id="fp-laboratorio"'+(conDisenos?' disabled title="No editable: el proyecto ya tiene diseños"':'')+'>'+catalogo('laboratorios').map(function(l){ return '<option value="'+esc(l)+'"'+(l===f.laboratorio?' selected':'')+'>'+esc(labLabel(l))+'</option>'; }).join('')+'</select>', 'laboratorio') +
    campo('Equipo que lidera', '<select id="fp-equipo">'+opcionesHtml(catalogo('equipos'), f.equipoLider, 'Elegí…')+'</select>', 'equipoLider') +
    campo('Responsable (ANA o JEF)', '<select id="fp-responsable"><option value="">Elegí…</option>'+resp.map(function(u){ return '<option value="'+u.id+'"'+(u.id===f.responsable?' selected':'')+'>'+esc(nombreUsuario(u))+' · '+rolDe(u)+'</option>'; }).join('')+'</select>', 'responsable') +
    campo('Solicitante (persona o área)', '<input type="text" id="fp-solicitante" value="'+esc(f.solicitante)+'">') +
    campo('Fecha de inicio', '<input type="date" id="fp-inicio" value="'+esc(f.fechaInicio)+'">', 'fechaInicio') +
    campo('Fecha fin planificada', '<input type="date" id="fp-fin" value="'+esc(f.fechaFin)+'">', 'fechaFin') +
    campo('Presupuesto (S/)', '<input type="text" inputmode="decimal" id="fp-presupuesto" value="'+esc(f.presupuesto)+'">', 'presupuesto') +
    campo('CECO', '<select id="fp-ceco">'+opcionesHtml(catalogo('ceco'), f.ceco, 'Sin CECO')+'</select>') +
    campo('Prioridad', '<select id="fp-prioridad">'+opcionesHtml(PRIORIDADES, f.prioridad)+'</select>', 'prioridad') +
    '</div>' +
    '<div class="pp-field" style="margin-top:10px;"><label>Equipos que apoyan (comparten el proyecto; siempre lidera uno)</label><div class="chips-check">' +
      catalogo('equipos').map(function(eq){ return '<label class="chip-check"><input type="checkbox" name="fp-apoyo" value="'+esc(eq)+'"'+((f.equiposApoyo||[]).indexOf(eq)>-1?' checked':'')+'> '+esc(eq)+'</label>'; }).join('') + '</div></div>' +
    campo('Objetivo (mín. 20 caracteres)', '<textarea id="fp-objetivo" rows="3">'+esc(f.objetivo)+'</textarea>', 'objetivo') +
    campo('Hipótesis / criterio de éxito (recomendado)', '<textarea id="fp-hipotesis" rows="2" placeholder="Ej. f\'c 28 d ≥ 210 kg/cm² con costo ≤ patrón">'+esc(f.hipotesis)+'</textarea>') +
    '<div class="pred-form" style="margin-top:10px;">' +
      campo('Criterio: f\'c mínimo a 28 d (kg/cm²)', '<input type="text" inputmode="decimal" id="fp-crit-fc" value="'+esc(f.criterioFc || '')+'">') +
      campo('Criterio: costo máximo por m³ (S/)', '<input type="text" inputmode="decimal" id="fp-crit-costo" value="'+esc(f.criterioCosto || '')+'">') +
    '</div>' +
    '<p class="nota-sm">'+(nuevo ? 'El proyecto nace en estado Planificado y pasa a En curso solo al registrar su primer diseño.' : 'Cambiar la fecha fin o el presupuesto pide motivo.')+'</p>';
  abrirDialogo({titulo: nuevo ? 'Nuevo proyecto' : 'Ficha · ' + f.codigo, ancho:'grande', html: html, botones:[{label: nuevo ? 'Crear proyecto' : 'Guardar ficha', accion: function(c){
    var datos = {
      nombre: c.querySelector('#fp-nombre').value.trim().replace(/\s+/g, ' '),
      tipo: c.querySelector('#fp-tipo').value, linea: c.querySelector('#fp-linea').value,
      laboratorio: c.querySelector('#fp-laboratorio').value, equipoLider: c.querySelector('#fp-equipo').value,
      equiposApoyo: Array.prototype.map.call(c.querySelectorAll('input[name="fp-apoyo"]:checked'), function(i){ return i.value; }),
      responsable: c.querySelector('#fp-responsable').value, solicitante: c.querySelector('#fp-solicitante').value.trim(),
      fechaInicio: c.querySelector('#fp-inicio').value, fechaFin: c.querySelector('#fp-fin').value,
      presupuesto: c.querySelector('#fp-presupuesto').value.trim() === '' ? '' : parseNumero(c.querySelector('#fp-presupuesto').value),
      ceco: c.querySelector('#fp-ceco').value, prioridad: c.querySelector('#fp-prioridad').value,
      objetivo: c.querySelector('#fp-objetivo').value.trim(), hipotesis: c.querySelector('#fp-hipotesis').value.trim(),
      criterioFc: parseNumero(c.querySelector('#fp-crit-fc').value) || '', criterioCosto: parseNumero(c.querySelector('#fp-crit-costo').value) || ''
    };
    datos.equiposApoyo = datos.equiposApoyo.filter(function(e){ return e !== datos.equipoLider; });
    if(conDisenos) datos.laboratorio = p.laboratorio;
    if(!mostrarErrores(c, validarFichaProyecto(datos, nuevo ? null : p.codigo))){ toast('Revisá los campos marcados'); return false; }
    function aplicar(motivo){
      if(nuevo){
        var pr = Object.assign(proyectoNuevoBase(datos.nombre, false), datos, {codigo: nextCodigoProyecto(), estado:'Planificado', creado:Date.now(), creadoPor:usuarioActual.id});
        proyectos.push(pr);
        saveProyectos();
        registrarHistorial('Creó', 'Proyecto', pr.codigo + ' · ' + pr.nombre, {proyecto: pr.nombre});
        toast('Proyecto ' + pr.codigo + ' creado');
        refreshAllProyectoSelects();
        abrirExpediente(pr.nombre);
        return;
      }
      var viejo = p.nombre;
      if(motivo) p.motivos.push({ts:Date.now(), de:'ficha', a:'ficha', motivo:motivo, usuario:usuarioActual.id, cambio:'fecha fin ' + p.fechaFin + ' → ' + datos.fechaFin + ' · presupuesto ' + p.presupuesto + ' → ' + datos.presupuesto});
      Object.assign(p, datos, {fichaIncompleta:false, modificado:Date.now(), modificadoPor:usuarioActual.id});
      if(viejo !== datos.nombre){ renombrarProyectoEnTodo(viejo, datos.nombre); expedienteProyecto = datos.nombre; }
      saveProyectos();
      registrarHistorial('Editó', 'Proyecto', p.codigo + ' · ficha' + (motivo ? ' · motivo: ' + motivo : ''), {proyecto: p.nombre});
      toast('Ficha guardada');
      refreshAllProyectoSelects();
      renderProyectosPanel();
    }
    var cambiaComprometido = !nuevo && !p.fichaIncompleta && (datos.fechaFin !== p.fechaFin || String(datos.presupuesto) !== String(p.presupuesto));
    if(cambiaComprometido){
      setTimeout(function(){ pedirMotivo('Cambio de fecha fin o presupuesto', 'Estos datos son compromisos del proyecto: el cambio queda registrado con su motivo.', function(m){ aplicar(m); }); }, 0);
      return;
    }
    aplicar('');
  }}]});
}

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

/* ---- 6. Resultados y comparativo entre iteraciones ---- */
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

/* ================= EXPEDIENTE DEL PROYECTO (5.2) ================= */
var EXP_TABS = [
  {id:'resumen', label:'Resumen'},
  {id:'plan', label:'Plan de trabajo'},
  {id:'iteraciones', label:'Iteraciones'},
  {id:'disenos', label:'Diseños'},
  {id:'roturas', label:'Ensayos y roturas'},
  {id:'resultados', label:'Resultados'},
  {id:'costos', label:'Materiales y costos'},
  {id:'muestras', label:'Muestras'},
  {id:'documentos', label:'Documentos'},
  {id:'bitacora', label:'Bitácora'},
  {id:'reportes', label:'Reportes'},
  {id:'equipo', label:'Equipo'},
  {id:'historial', label:'Historial'}
];
function abrirExpediente(nombre, tab){
  if(!nombre){ toast('El diseño no tiene proyecto asignado'); return; }
  var p = proyectoPorNombre(nombre);
  if(p && !proyectoVisible(p)){ toast('No tenés acceso a este proyecto'); return; }
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
function accionesEstadoHtml(p){
  if(!can('proyectos:aprobar')) return '';
  var b = [];
  if(p.estado === 'En curso') b.push(['En pausa', 'Pausar'], ['Completado', 'Completar']);
  if(p.estado === 'En pausa') b.push(['En curso', 'Reanudar']);
  if(p.estado === 'Completado' || p.estado === 'Cancelado') b.push(['En curso', 'Reabrir']);
  if(p.estado !== 'Cancelado') b.push(['Cancelado', 'Cancelar']);
  return b.map(function(x){ return '<button class="btn-add ghost'+(x[0]==='Cancelado'?' danger':'')+'" data-estado-proy="'+x[0]+'">'+x[1]+'</button>'; }).join('');
}
function renderExpediente(){
  var nombre = expedienteProyecto;
  var p = proyectoPorNombre(nombre);
  if(!p){ asegurarProyectosDeDisenos(); p = proyectoPorNombre(nombre); }
  var m = metricasProyecto(nombre);
  var sem = semaforoProyecto(nombre);
  var costo = costoProyecto(nombre);
  document.getElementById('proy-vista-principal').style.display = 'none';
  var wrap = document.getElementById('proy-expediente');
  wrap.style.display = 'block';
  var dr = diasRestantes(p);
  var editable = puedeEditarProyecto(p) && proyectoAbierto(p);
  wrap.innerHTML =
    '<button class="comp-back" id="exp-volver">← Volver a proyectos</button>' +
    '<div class="exp-header">' +
      '<div><span class="exp-kicker">Expediente del proyecto · '+esc(p.codigo)+'</span><h2>'+semaforoDotHtml(sem.color, sem.motivos.join(', '))+' '+esc(nombre)+'</h2>' +
        '<div class="exp-sub">'+tagEstadoProyecto(p.estado)+' <span>'+esc(labLabel(p.laboratorio))+' · lidera '+esc(p.equipoLider || '—')+' · responsable '+esc(nombreUsuario(usuarioPorId(p.responsable)) || '—')+'</span></div>' +
        (p.fichaIncompleta ? '<div class="pc-alerta-ficha">La ficha está incompleta (proyecto migrado). Completala para que el reporte salga entero.</div>' : '') +
      '</div>' +
      '<div class="ch-actions">' +
        (editable ? '<button class="btn-add ghost" id="exp-ficha">Editar ficha</button>' : '') +
        accionesEstadoHtml(p) +
        '<button class="btn-add ghost" id="exp-exportar" data-perm="datos:exportar">Exportar Excel</button>' +
        (proyectoAdmiteDisenos(nombre) ? '<button class="btn-add" id="exp-nuevo-diseno" data-perm="disenos:crear">+ Diseño en este proyecto</button>' : '') +
      '</div>' +
    '</div>' +
    '<div class="section-num">Secuencia del proyecto</div>' + flujoHtml(nombre, true) +
    '<div class="kpi-grid">' +
      kpiCard('kpi-naranja', ICO_DISENO, m.avancePct + '%', 'Avance ('+m.completados+'/'+m.nDisenos+' diseños)') +
      kpiCard('kpi-verde', ICO_ACTIVO, m.cargasCompletas + '/' + m.cargas.length, 'Roturas registradas') +
      kpiCard('kpi-negro', ICO_COSTO, soles(costo.total), 'Costo' + (n(p.presupuesto) ? ' de ' + soles(n(p.presupuesto)) : ' (sin presupuesto)')) +
      kpiCard('kpi-rojo', ICO_ALERTA, dr === null ? '-' : dr, dr !== null && dr < 0 ? 'Días de atraso' : 'Días restantes') +
    '</div>' +
    '<div class="roturas-subtabs exp-tabs">' + EXP_TABS.map(function(t){
      return '<button class="subtab'+(t.id===expedienteTab?' active':'')+'" data-exp-tab="'+t.id+'">'+t.label+'</button>';
    }).join('') + '</div>' +
    '<div id="exp-contenido"></div>';
  renderExpedienteTab(m, p);
}
function renderExpedienteTab(m, p){
  Object.keys(proyCharts).forEach(function(k){ if(k !== 'radar') destruirProyChart(k); });
  var c = document.getElementById('exp-contenido');
  var t = expedienteTab;
  if(t === 'resumen') c.innerHTML = expResumenHtml(m, p);
  else if(t === 'plan') c.innerHTML = expPlanHtml(p);
  else if(t === 'iteraciones') c.innerHTML = expIteracionesHtml(m, p);
  else if(t === 'disenos') c.innerHTML = expDisenosHtml(m);
  else if(t === 'roturas') c.innerHTML = expRoturasHtml(m);
  else if(t === 'resultados'){ c.innerHTML = expResultadosHtml(m) + '<div id="cmp-wrap" style="margin-top:16px;"></div>'; dibujarExpResultados(m); if(m.iteraciones.length) renderComparativo(m); }
  else if(t === 'costos') c.innerHTML = expCostosHtml(m, p);
  else if(t === 'muestras') c.innerHTML = expMuestrasHtml(p);
  else if(t === 'documentos'){ c.innerHTML = expDocumentosHtml(p); cargarMiniaturas(c); }
  else if(t === 'bitacora') c.innerHTML = expBitacoraHtml(p);
  else if(t === 'reportes') c.innerHTML = expReportesHtml(m, p);
  else if(t === 'equipo') c.innerHTML = expEquipoHtml(p);
  else if(t === 'historial') c.innerHTML = expHistorialHtml(m);
}

/* ---- 1. Resumen ---- */
function expResumenHtml(m, p){
  var sem = semaforoProyecto(p.nombre), costo = costoProyecto(p.nombre), pres = n(p.presupuesto);
  var fila = function(k, v){ return '<div class="acerca-fila"><span>'+k+'</span><b>'+(v || '—')+'</b></div>'; };
  var ultimas = historialDeProyecto(p.nombre).slice(0, 6);
  return '<div class="exp-resumen-grid">' +
    '<div class="card"><div class="section-num">Ficha</div>' +
      fila('Tipo · línea', esc(p.tipo + ' · ' + p.linea)) + fila('Solicitante', esc(p.solicitante)) +
      fila('Inicio → fin planificado', esc(isoToDMY(p.fechaInicio) + ' → ' + isoToDMY(p.fechaFin))) + fila('Prioridad', esc(p.prioridad)) +
      fila('CECO', esc(p.ceco)) + fila('Equipos de apoyo', esc((p.equiposApoyo || []).join(', '))) +
      '<p class="nota-sm" style="margin-top:8px;"><b>Objetivo:</b> '+esc(p.objetivo || '—')+'</p>' +
      '<p class="nota-sm"><b>Criterio de éxito:</b> '+esc(p.hipotesis || '—')+'</p></div>' +
    '<div class="card"><div class="section-num">Semáforo y avance</div>' +
      '<div class="sem-grande sem-'+sem.color+'">'+semaforoDotHtml(sem.color)+' <b>'+{verde:'A tiempo', naranja:'Atención', rojo:'Atrasado'}[sem.color]+'</b><span>'+esc(sem.motivos.join(' · '))+'</span></div>' +
      '<div class="pc-bar" style="margin:12px 0 4px;"><div class="pc-bar-fill" style="width:'+m.avancePct+'%"></div></div><span class="nota-sm">'+m.avancePct+'% de avance (diseños completados / activos' + (actividades.some(function(a){ return a.proyecto === p.nombre; }) ? ', ponderado con el plan de trabajo' : '') + ')</span>' +
      fila('Costo diseños', soles(costo.disenos)) + fila('Consumo de inventario', soles(costo.egresos)) +
      fila('Costo acumulado vs presupuesto', soles(costo.total) + (pres ? ' / ' + soles(pres) + ' (' + Math.round(costo.total / pres * 100) + '%)' : ' / sin presupuesto')) +
      fila('Próxima rotura', m.proximaRotura ? isoToDMY(m.proximaRotura) : '') + '</div>' +
    '<div class="card"><div class="section-num">Últimas actividades</div>' +
      (ultimas.length ? ultimas.map(function(h){ return '<div class="nota-sm">'+fechaHora(h.ts)+' · <b>'+esc(h.usuario)+'</b> '+esc(h.accion+' '+h.entidad+' — '+h.detalle)+'</div>'; }).join('') : '<p class="nota-sm">Sin movimientos.</p>') +
      (p.motivos && p.motivos.length ? '<div class="section-num" style="margin-top:12px;">Cambios de estado</div>' + p.motivos.slice(-5).reverse().map(function(x){ return '<div class="nota-sm">'+fechaHora(x.ts)+' · '+esc(x.de+' → '+x.a)+(x.motivo ? ' · '+esc(x.motivo) : '')+'</div>'; }).join('') : '') +
    '</div></div>';
}

/* ---- 2. Plan de trabajo con Gantt (RF-PRY-05) ---- */
function expPlanHtml(p){
  var lista = actividades.filter(function(a){ return a.proyecto === p.nombre; }).sort(function(a, b){ return (a.inicio || '').localeCompare(b.inicio || ''); });
  var editable = puedeEditarProyecto(p) && proyectoAbierto(p);
  var cab = '<div class="card"><div class="ev-toolbar"><span class="nota-sm">Actividades con responsable, fechas y avance. Las que vencen pintan el semáforo del proyecto.</span>' +
    (editable ? '<button class="btn-add" data-act-nueva="1">+ Actividad</button>' : '') + '</div>';
  if(!lista.length) return cab + '<div class="empty-note">Sin actividades en el plan.</div></div>';
  var ini = lista.reduce(function(a, x){ return x.inicio < a ? x.inicio : a; }, lista[0].inicio);
  var fin = lista.reduce(function(a, x){ return x.fin > a ? x.fin : a; }, lista[0].fin);
  var total = Math.max(1, (new Date(fin) - new Date(ini)) / DAY + 1);
  var hoy = todayISO();
  var pos = function(f){ return Math.max(0, Math.min(100, (new Date(f) - new Date(ini)) / DAY / total * 100)); };
  var gantt = '<div class="gantt"><div class="gantt-escala"><span>'+isoToDMY(ini)+'</span><span>'+isoToDMY(fin)+'</span></div>' + lista.map(function(a){
    var vencida = a.fin < hoy && n(a.avance) < 100;
    var l = pos(a.inicio), w = Math.max(1.5, pos(addDaysISO(a.fin, 1)) - l);
    return '<div class="gantt-fila"><span class="gantt-nombre">'+(a.hito ? '◆ ' : '')+esc(a.nombre)+'</span><div class="gantt-pista">' +
      (hoy >= ini && hoy <= fin ? '<span class="gantt-hoy" style="left:'+pos(hoy)+'%"></span>' : '') +
      '<span class="gantt-barra'+(vencida?' vencida':'')+(a.hito?' hito':'')+'" style="left:'+l+'%;width:'+w+'%"><span style="width:'+n(a.avance)+'%"></span></span></div></div>';
  }).join('') + '</div>';
  var tabla = '<div class="table-scroll"><table class="data-table"><thead><tr><th>Actividad</th><th>Responsable</th><th>Inicio</th><th>Fin</th><th>Avance</th><th>Depende de</th><th></th></tr></thead><tbody>' +
    lista.map(function(a){
      var dep = actividades.filter(function(x){ return x.id === a.dependeDe; })[0];
      return '<tr><td>'+(a.hito?'◆ ':'')+'<b>'+esc(a.nombre)+'</b></td><td>'+esc(nombreUsuario(usuarioPorId(a.responsable)))+'</td><td>'+isoToDMY(a.inicio)+'</td><td>'+isoToDMY(a.fin)+'</td>' +
        '<td><div class="mini-bar"><div style="width:'+n(a.avance)+'%"></div></div> '+n(a.avance)+'%</td><td>'+esc(dep ? dep.nombre : '—')+'</td>' +
        '<td>'+(editable ? '<button class="btn-icon edit" data-act-editar="'+a.id+'">'+EDIT_ICON+'</button>' : '')+'</td></tr>';
    }).join('') + '</tbody></table></div>';
  return cab + gantt + tabla + '</div>';
}
function abrirActividad(p, a){
  var nueva = !a;
  a = a || {proyecto:p.nombre, nombre:'', responsable:usuarioActual.id, inicio:todayISO(), fin:todayISO(), avance:0, dependeDe:'', hito:false};
  var otras = actividades.filter(function(x){ return x.proyecto === p.nombre && x.id !== a.id; });
  var equipo = usuariosActivos().filter(function(u){ return ['ANA','JEF','TEC'].indexOf(rolDe(u)) > -1; });
  abrirDialogo({titulo: nueva ? 'Nueva actividad' : 'Editar actividad', html:
    '<div class="pred-form">' + campo('Nombre', '<input type="text" id="ac-nombre" value="'+esc(a.nombre)+'">') +
    campo('Responsable', '<select id="ac-resp">'+equipo.map(function(u){ return '<option value="'+u.id+'"'+(u.id===a.responsable?' selected':'')+'>'+esc(nombreUsuario(u))+'</option>'; }).join('')+'</select>') +
    campo('Inicio', '<input type="date" id="ac-ini" value="'+esc(a.inicio)+'">') + campo('Fin', '<input type="date" id="ac-fin" value="'+esc(a.fin)+'">') +
    campo('Avance (%)', '<input type="number" min="0" max="100" id="ac-av" value="'+esc(a.avance)+'">') +
    campo('Depende de (opcional)', '<select id="ac-dep"><option value="">—</option>'+otras.map(function(x){ return '<option value="'+x.id+'"'+(x.id===a.dependeDe?' selected':'')+'>'+esc(x.nombre)+'</option>'; }).join('')+'</select>') +
    '</div><label class="chip-check"><input type="checkbox" id="ac-hito"'+(a.hito?' checked':'')+'> Es un hito</label><p class="campo-error" id="ac-err"></p>',
    botones:[{label:'Guardar', accion:function(c){
      var d = {nombre:c.querySelector('#ac-nombre').value.trim(), responsable:c.querySelector('#ac-resp').value, inicio:c.querySelector('#ac-ini').value,
        fin:c.querySelector('#ac-fin').value, avance:Number(c.querySelector('#ac-av').value), dependeDe:c.querySelector('#ac-dep').value, hito:c.querySelector('#ac-hito').checked};
      var err = validarActividad(d);
      if(!err && d.dependeDe){ var dep = actividades.filter(function(x){ return x.id === d.dependeDe; })[0]; if(dep && d.inicio < dep.fin) err = 'Empieza antes de que termine la actividad de la que depende (' + dep.nombre + ').'; }
      if(err){ c.querySelector('#ac-err').textContent = err; return false; }
      if(nueva){ actividades.push(Object.assign({id:nuevoId('a'), proyecto:p.nombre, creadoPor:usuarioActual.id, ts:Date.now()}, d)); }
      else Object.assign(a, d, {modificado:Date.now()});
      saveActividades();
      registrarHistorial(nueva ? 'Creó' : 'Editó', 'Actividad', d.nombre + ' · ' + d.avance + '%', {proyecto:p.nombre});
      renderExpediente();
    }}]});
}

/* ---- 3. Iteraciones (RF-PRY-03/04) ---- */
function expIteracionesHtml(m, p){
  var editable = (can('proyectos:editar') || can('proyectos:crear')) && proyectoAbierto(p) && (puedeEditarProyecto(p) || rolDe(usuarioActual) === 'ANA' && esDeMiEquipo(p));
  var iters = iteracionesDeProyecto(p.nombre).slice();
  m.iteraciones.forEach(function(it){ if(iters.indexOf(it) === -1) iters.push(it); });
  iters.sort(function(a, b){ return ordenIteracion(a) - ordenIteracion(b); });
  return '<div class="card"><div class="ev-toolbar"><span class="nota-sm">Formato "Mes - Numeral". Una iteración se cierra cuando todos sus diseños están completados o cancelados, con su conclusión.</span>' +
    (editable ? '<button class="btn-add" data-iter-nueva="1">+ Iteración</button>' : '') + '</div>' +
    (iters.length ? '<div class="exp-timeline">' + iters.map(function(it){
      var info = infoIteracion(p.nombre, it);
      var lista = m.disenos.filter(function(d){ return d.iteracionId === it; });
      var comp = lista.filter(function(d){ return d.estado === 'Completado' || d.estado === 'Validado'; }).length;
      return '<div class="exp-iter"><div class="exp-iter-head"><span class="exp-iter-dot'+(info.cerrada?' cerrada':'')+'"></span><h4>'+esc(it)+'</h4>' +
        '<span class="nota-sm">'+lista.length+' diseños · '+comp+' completados · '+(info.cerrada ? '<b class="txt-verde">Cerrada '+fechaHora(info.fechaCierre)+'</b>' : 'Abierta')+'</span>' +
        (editable && !info.cerrada ? '<button class="btn-add ghost" data-iter-cerrar="'+esc(it)+'">Cerrar iteración</button>' : '') +
        (editable && info.cerrada && can('proyectos:aprobar') ? '<button class="btn-add ghost" data-iter-reabrir="'+esc(it)+'">Reabrir</button>' : '') + '</div>' +
        '<p class="nota-sm"><b>Objetivo:</b> '+esc(info.objetivo || '—')+'</p>' +
        (info.cerrada ? '<p class="nota-sm"><b>Conclusión:</b> '+esc(info.conclusion)+'</p>' : '') +
        (lista.length ? '<p class="nota-sm">'+lista.map(function(d){ return esc(d.codigo) + ' ' + tagEstadoDiseno(d.estado); }).join(' · ')+'</p>' : '') + '</div>';
    }).join('') + '</div>' : '<div class="empty-note">Sin iteraciones. Se crean al registrar el primer diseño o con "+ Iteración".</div>') + '</div>';
}

/* ---- 4. Diseños (filtrables por iteración, estado y semáforo) ---- */
var expFiltroDis = {iter:'', estado:'', sem:''};
function expDisenosHtml(m){
  if(!m.nDisenos) return '<div class="empty-note">Este proyecto todavía no tiene diseños. Usá "+ Diseño en este proyecto" para empezar.</div>';
  var lista = m.disenos.filter(function(d){
    return (!expFiltroDis.iter || d.iteracionId === expFiltroDis.iter) && (!expFiltroDis.estado || d.estado === expFiltroDis.estado) && (!expFiltroDis.sem || semaforoDiseno(d) === expFiltroDis.sem);
  });
  var porIter = {};
  lista.forEach(function(d){ (porIter[d.iteracionId || 'Sin iteración'] = porIter[d.iteracionId || 'Sin iteración'] || []).push(d); });
  var iters = Object.keys(porIter).sort(function(a,b){ return ordenIteracion(a) - ordenIteracion(b); });
  var sel = function(k, opts, vacio){ return '<select data-exp-fdis="'+k+'"><option value="">'+vacio+'</option>'+opts.map(function(o){ return '<option value="'+esc(o[0])+'"'+(expFiltroDis[k]===o[0]?' selected':'')+'>'+esc(o[1])+'</option>'; }).join('')+'</select>'; };
  return '<div class="hist-toolbar">' + sel('iter', m.iteraciones.map(function(i){ return [i, i]; }), 'Todas las iteraciones') +
    sel('estado', ['Iniciado','En desarrollo','Completado','Validado','Cancelado'].map(function(e){ return [e, e]; }), 'Todos los estados') +
    sel('sem', [['verde','Verde'],['naranja','Naranja'],['rojo','Rojo']], 'Todos los semáforos') + '</div>' +
    '<div class="exp-timeline">' + iters.map(function(it){
    var grupo = porIter[it];
    return '<div class="exp-iter"><div class="exp-iter-head"><span class="exp-iter-dot"></span><h4>'+esc(it)+'</h4><span class="nota-sm">'+grupo.length+' diseño'+(grupo.length===1?'':'s')+'</span></div>' +
      '<div class="table-scroll"><table class="data-table"><thead><tr><th></th><th>Código</th><th>Diseño</th><th>Versión</th><th>Réplicas</th><th>a/mc</th><th>Roturas</th><th>Máx. kg/cm²</th><th>Estado</th><th></th></tr></thead><tbody>' +
      grupo.map(function(d){
        var cs = cargasDeDiseno(d), ok = cs.filter(cargaResuelta).length;
        var rm = resistenciaMaxima(d);
        return '<tr><td>'+semaforoDotHtml(semaforoDiseno(d))+'</td><td class="mono">'+esc(d.codigo)+'</td><td><b>'+esc(diseñoTitulo(d))+'</b></td><td>v'+(d.version||1)+'</td>' +
          '<td>'+replicasDe(d).map(function(r){ return '<span class="tag-pill tag-gris" title="'+esc(r.nombre)+'">R'+r.n+': '+esc(estadoReplica(d, r))+'</span>'; }).join(' ')+'</td>' +
          '<td>'+esc(d.amcEfectiva||'-')+'</td><td>'+ok+'/'+cs.length+'</td><td>'+(isFinite(rm)?fmt(rm,1):'-')+'</td><td>'+tagEstadoDiseno(d.estado)+'</td>' +
          '<td class="acciones-fila"><button class="btn-icon" data-exp-act="view" data-codigo="'+esc(d.codigo)+'" title="Ver diseño">'+EYE_ICON+'</button>' +
          '<button class="btn-icon" data-exp-act="informe" data-codigo="'+esc(d.codigo)+'" title="Informe">'+CHART_ICON+'</button>' +
          '<button class="btn-icon" data-exp-act="etiquetas" data-codigo="'+esc(d.codigo)+'" title="Etiquetas">'+TAG_ICON+'</button></td></tr>';
      }).join('') + '</tbody></table></div></div>';
  }).join('') + '</div>';
}

/* ---- 5. Ensayos y roturas ---- */
function expRoturasHtml(m){
  var hoy = todayISO();
  var lista = m.cargas.slice().sort(function(a, b){ return (a.fechaEnsayo || '').localeCompare(b.fechaEnsayo || ''); });
  if(!lista.length) return '<div class="empty-note">Este proyecto no tiene roturas programadas.</div>';
  var pend = lista.filter(function(c){ return c.estado === 'pendiente'; });
  return '<div class="card"><div class="ev-toolbar"><span class="nota-sm">'+pend.length+' pendientes · '+pend.filter(function(c){ return c.fechaEnsayo < hoy; }).length+' vencidas · '+lista.filter(function(c){ return c.estado === 'completado'; }).length+' registradas</span>' +
    '<button class="btn-add ghost" data-goto="calendario">Ver calendario →</button></div>' +
    '<div class="table-scroll"><table class="data-table"><thead><tr><th>ID</th><th>Réplica</th><th>Edad</th><th>Fecha de ensayo</th><th>Ventana</th><th>Estado</th><th>Promedio</th><th>CV</th><th></th></tr></thead><tbody>' +
    lista.map(function(c){
      var est = c.estado === 'pendiente' ? (c.fechaEnsayo < hoy ? '<span class="tag-pill tag-rojo">Vencida</span>' : (c.fechaEnsayo === hoy ? '<span class="tag-pill tag-naranja">Hoy</span>' : '<span class="tag-pill tag-celeste">Pendiente</span>')) : '<span class="tag-pill '+(c.estado==='completado'?'tag-verde':'tag-gris')+'">'+esc(etiquetaEstadoCarga(c))+'</span>';
      return '<tr><td class="mono">'+esc(c.codigo)+'</td><td>'+esc(c.replicaNombre)+'</td><td>'+c.dia+' d</td><td>'+isoToDMY(c.fechaEnsayo)+'</td><td>±'+c.toleranciaHoras+' h</td><td>'+est+(c.fueraTolerancia?' <span class="tag-pill tag-naranja">Fuera de ventana</span>':'')+'</td>' +
        '<td>'+(c.promedio||'-')+'</td><td>'+(c.coefVar||'-')+'</td><td>'+(c.estado==='pendiente' && can('roturas:registrar') ? '<button class="btn-add ghost" data-exp-rotura="'+c.id+'">Registrar</button>' : '')+'</td></tr>';
    }).join('') + '</tbody></table></div></div>';
}

/* ---- 7. Materiales y costos (RF-PRY-11) ---- */
function expCostosHtml(m, p){
  var costo = costoProyecto(p.nombre);
  var consumo = {};
  m.disenos.forEach(function(d){
    var factor = (n(d.batchVol) || 30) / 1000 * ((d.replicaObjs || []).filter(function(r){ return r.elaboracion; }).length || (d.replicaObjs || []).length || 1);
    (d.mix || []).forEach(function(it){
      if(!n(it.pesoSeco)) return;
      var k = it.nombre || '-';
      consumo[k] = consumo[k] || {kg:0, costo:0};
      consumo[k].kg += n(it.pesoSeco) * factor;
      consumo[k].costo += n(it.cvd) * factor;
    });
  });
  var egresos = (typeof egresosInventario !== 'undefined' ? egresosInventario : []).filter(function(e){ return e.proyecto === p.nombre; });
  return '<div class="card"><div class="section-num">Costo por diseño</div><div class="table-scroll"><table class="data-table"><thead><tr><th>Código</th><th>Diseño</th><th>S/ por m³</th><th>Tanda (L)</th><th>Réplicas elaboradas</th><th>Costo (S/)</th></tr></thead><tbody>' +
    m.disenos.map(function(d){ return '<tr><td class="mono">'+esc(d.codigo)+'</td><td>'+esc(diseñoTitulo(d))+'</td><td>'+fmt(n(d.cvdTotal),2)+'</td><td>'+(n(d.batchVol)||30)+'</td><td>'+((d.replicaObjs||[]).filter(function(r){ return r.elaboracion; }).length || (d.replicaObjs||[]).length)+'</td><td>'+fmt(costoDiseno(d),2)+'</td></tr>'; }).join('') +
    '</tbody><tfoot><tr><td colspan="5"><b>Total diseños</b></td><td><b>'+fmt(costo.disenos,2)+'</b></td></tr></tfoot></table></div></div>' +
    '<div class="card"><div class="section-num">Consumo por material (dosis × tanda × réplicas)</div><div class="table-scroll"><table class="data-table"><thead><tr><th>Material</th><th>kg consumidos</th><th>Costo (S/)</th></tr></thead><tbody>' +
    (Object.keys(consumo).length ? Object.keys(consumo).sort().map(function(k){ return '<tr><td>'+esc(k)+'</td><td>'+fmt(consumo[k].kg,2)+'</td><td>'+fmt(consumo[k].costo,2)+'</td></tr>'; }).join('') : '<tr><td colspan="3" class="nota-sm">Los diseños no tienen composición registrada.</td></tr>') + '</tbody></table></div></div>' +
    '<div class="card"><div class="section-num">Egresos de inventario por lote</div>' + (egresos.length ? '<div class="table-scroll"><table class="data-table"><thead><tr><th>Fecha</th><th>Producto</th><th>Lote</th><th>Cantidad</th><th>Costo (S/)</th><th>Diseño / réplica</th><th>Estado</th></tr></thead><tbody>' +
      egresos.map(function(e){ return '<tr><td>'+isoToDMY(e.fecha)+'</td><td>'+esc(e.producto)+'</td><td>'+esc(e.lote||'FIFO')+'</td><td>'+fmt(e.cantidad,2)+' '+esc(e.unidad||'kg')+'</td><td>'+fmt(e.costo,2)+'</td><td>'+esc((e.disenoCodigo||'')+' '+(e.replica||''))+'</td><td>'+esc(e.estado||'Registrado')+'</td></tr>'; }).join('') + '</tbody></table></div>' : '<p class="nota-sm">Sin egresos registrados para este proyecto.</p>') +
    '<div class="acerca-fila"><span>Total del proyecto</span><b>'+soles(costo.total)+(n(p.presupuesto) ? ' de '+soles(n(p.presupuesto)) : '')+'</b></div></div>';
}

/* ---- 8. Muestras vinculadas ---- */
function expMuestrasHtml(p){
  var lista = (typeof muestrasInventario !== 'undefined' ? muestrasInventario : []).filter(function(x){ return x.proyecto === p.nombre; });
  if(!lista.length) return '<div class="empty-note">Sin muestras vinculadas. Se vinculan desde <a href="#" data-goto="inventario">Inventario › Muestras</a>.</div>';
  return '<div class="card table-scroll"><table class="data-table"><thead><tr><th>Código</th><th>Trazabilidad</th><th>Descripción</th><th>Material</th><th>Ubicación</th><th>Estado</th><th>Descarte</th></tr></thead><tbody>' +
    lista.map(function(x){ return '<tr><td class="mono">'+esc(x.codigo)+'</td><td>'+esc(x.trazabilidad)+'</td><td>'+esc(x.descripcion)+'</td><td>'+esc(x.material)+'</td><td>'+esc(x.ubicacion)+'</td><td>'+esc(x.estado)+'</td><td>'+isoToDMY(x.fechaDescarte)+'</td></tr>'; }).join('') + '</tbody></table></div>';
}

/* ---- 9. Documentos (Drive) y evidencias (RF-PRY-07/08) ---- */
function expDocumentosHtml(p){
  var lista = documentosProyecto.filter(function(x){ return x.proyecto === p.nombre; }).sort(function(a, b){ return (b.ts||0) - (a.ts||0); });
  var editable = (rolDe(usuarioActual) === 'ADM' || ['ANA','JEF'].indexOf(rolDe(usuarioActual)) > -1) && proyectoAbierto(p);
  return '<div class="card"><div class="ev-toolbar"><span class="nota-sm">Archivos guardados en Google Drive: normas, fichas técnicas, presentaciones semanales, informes. Formatos PDF, imagen, Excel, Word, PPT; máx. 10 MB.</span>' +
    (editable ? '<button class="btn-add" data-doc-nuevo="1">+ Documento</button>' : '') + '</div>' +
    (lista.length ? '<div class="table-scroll"><table class="data-table"><thead><tr><th>Documento</th><th>Tipo</th><th>Semana</th><th>Subido por</th><th>Fecha</th><th></th></tr></thead><tbody>' +
      lista.map(function(x){ return '<tr><td><a href="'+esc(x.url)+'" target="_blank" rel="noopener"><b>'+esc(x.nombre)+'</b></a></td><td>'+esc(x.tipo)+'</td><td>'+(x.semana ? 'Semana del '+isoToDMY(lunesDe(x.semana)) : '—')+'</td><td>'+esc(nombreUsuario(usuarioPorId(x.autor)))+'</td><td>'+fechaHora(x.ts)+'</td>' +
        '<td>'+(editable ? '<button class="btn-icon danger" data-doc-quitar="'+x.id+'" title="Quitar">×</button>' : '')+'</td></tr>'; }).join('') + '</tbody></table></div>' : '<p class="nota-sm">Sin documentos.</p>') + '</div>' +
    '<div class="card"><div class="ev-toolbar"><span class="nota-sm"><b>Fotos de evidencia</b> por sección y diseño. Las de rotura se agregan solas al registrar la carga.</span><button class="btn-add" id="exp-evidencia-2" data-perm="evidencias:subir">+ Subir evidencia</button></div>' +
    '<div id="exp-galeria">'+galeriaEvidenciasHtml(evidenciasDeProyecto(p.nombre))+'</div></div>';
}
function abrirDocumento(p){
  abrirDialogo({titulo:'Agregar documento', html:'<div class="pred-form">' +
    campo('Nombre', '<input type="text" id="doc-nombre">') + campo('Tipo', '<select id="doc-tipo">'+opcionesHtml(TIPOS_DOCUMENTO, '')+'</select>') +
    campo('Enlace de Google Drive', '<input type="url" id="doc-url" placeholder="https://drive.google.com/…">') +
    campo('Semana (solo presentaciones)', '<input type="date" id="doc-semana">') + '</div><p class="campo-error" id="doc-err"></p>',
    botones:[{label:'Agregar', accion:function(c){
      var d = {id:nuevoId('doc'), proyecto:p.nombre, nombre:c.querySelector('#doc-nombre').value.trim(), tipo:c.querySelector('#doc-tipo').value,
        url:c.querySelector('#doc-url').value.trim(), semana:c.querySelector('#doc-semana').value, autor:usuarioActual.id, ts:Date.now()};
      if(d.tipo !== 'Presentación semanal') d.semana = '';
      var err = validarDocumento(d);
      if(err){ c.querySelector('#doc-err').textContent = err; return false; }
      documentosProyecto.push(d);
      saveDocumentos();
      registrarHistorial('Agregó', 'Documento', d.tipo + ': ' + d.nombre, {proyecto:p.nombre});
      renderExpediente();
    }}]});
}

/* ---- 10. Bitácora (RF-PRY-06) ---- */
function expBitacoraHtml(p){
  var lista = bitacora.filter(function(b){ return b.proyecto === p.nombre; });
  var puede = can('bitacora:escribir') && proyectoAbierto(p) && (rolDe(usuarioActual) !== 'TEC' || esDeMiEquipo(p));
  return '<div class="card"><div class="ev-toolbar"><span class="nota-sm">Qué se probó, qué falló, qué se decidió. Las notas no se borran: al editarlas queda la versión anterior.</span>' +
    (puede ? '<button class="btn-add" data-bit-nueva="1">+ Nota</button>' : '') + '</div>' +
    (lista.length ? lista.map(function(b){
      var propia = b.autor === usuarioActual.id || rolDe(usuarioActual) === 'JEF';
      return '<div class="bitacora-nota"><div class="bn-head"><b>'+isoToDMY(b.fecha)+'</b> · '+esc(nombreUsuario(usuarioPorId(b.autor)) || '—')+
        (b.editado ? ' · <span class="nota-sm">editada '+fechaHora(b.editado)+' ('+b.versiones.length+' versión'+(b.versiones.length===1?'':'es')+' anterior'+(b.versiones.length===1?'':'es')+')</span>' : '') +
        (puede && propia ? ' <button class="btn-icon edit" data-bit-editar="'+b.id+'">'+EDIT_ICON+'</button>' : '') + '</div>' +
        '<p>'+esc(b.texto).replace(/\n/g, '<br>')+'</p>' + (b.adjunto ? '<a href="'+esc(b.adjunto)+'" target="_blank" rel="noopener" class="nota-sm">Adjunto</a>' : '') +
        (b.versiones && b.versiones.length ? '<details><summary class="nota-sm">Ver versiones anteriores</summary>'+b.versiones.map(function(v){ return '<p class="nota-sm">'+fechaHora(v.ts)+': '+esc(v.texto)+'</p>'; }).join('')+'</details>' : '') + '</div>';
    }).join('') : '<p class="nota-sm">Sin notas.</p>') + '</div>';
}
function abrirNotaBitacora(p, b){
  abrirDialogo({titulo: b ? 'Editar nota' : 'Nueva nota de bitácora', html:'<div class="pred-form">' +
    campo('Fecha', '<input type="date" id="bn-fecha" value="'+esc(b ? b.fecha : todayISO())+'"'+(b?' disabled':'')+'>') +
    campo('Adjunto (enlace, opcional)', '<input type="url" id="bn-adj" value="'+esc(b ? b.adjunto : '')+'">') + '</div>' +
    campo('Nota (mín. 5 caracteres)', '<textarea id="bn-texto" rows="5">'+esc(b ? b.texto : '')+'</textarea>') + '<p class="campo-error" id="bn-err"></p>',
    botones:[{label:'Guardar', accion:function(c){
      var fecha = c.querySelector('#bn-fecha').value;
      if(!b && fecha > todayISO()){ c.querySelector('#bn-err').textContent = 'La fecha no puede ser futura.'; return false; }
      var err = guardarNotaBitacora({id: b ? b.id : '', proyecto:p.nombre, fecha:fecha, texto:c.querySelector('#bn-texto').value, adjunto:c.querySelector('#bn-adj').value.trim()});
      if(err){ c.querySelector('#bn-err').textContent = err; return false; }
      renderExpediente();
    }}]});
}

/* ---- 11. Reportes: RR, informe final y reporte del proyecto ---- */
function expReportesHtml(m, p){
  var lista = rrDeProyecto(m.nombre, m.disenos);
  var reps = reportesProyecto.filter(function(r){ return r.proyecto === p.nombre; }).sort(function(a, b){ return b.ts - a.ts; });
  return '<div class="card"><div class="ev-toolbar"><span class="nota-sm"><b>Reporte detallado del proyecto</b> (5.5): se arma solo con lo registrado. Las secciones incompletas salen en rojo.</span>' +
      '<span>'+(can('reporte:generar') ? '<button class="btn-add ghost" data-rep-generar="avance">Generar reporte de avance</button> <button class="btn-add" data-rep-generar="final">Generar reporte final</button>' : '')+'</span></div>' +
      (reps.length ? '<div class="table-scroll"><table class="data-table"><thead><tr><th>Versión</th><th>Tipo</th><th>Fecha</th><th>Generado por</th><th>Secciones incompletas</th><th></th></tr></thead><tbody>' +
        reps.map(function(r){ return '<tr><td>v'+r.version+'</td><td>'+(r.final ? '<b>Final</b>' : 'Avance')+'</td><td>'+fechaHora(r.ts)+'</td><td>'+esc(nombreUsuario(usuarioPorId(r.autor)))+'</td><td>'+(r.incompletas.length ? '<span class="txt-rojo">'+esc(r.incompletas.join(', '))+'</span>' : 'Ninguna')+'</td>' +
          '<td><button class="btn-add ghost" data-rep-ver="'+r.id+'">Ver / PDF</button></td></tr>'; }).join('') + '</tbody></table></div>' : '<p class="nota-sm">Todavía no se generó ningún reporte.</p>') + '</div>' +
    '<div class="card"><div class="section-num">Reportes RR</div>' + (lista.length ? '<div class="proy-grid">' + lista.map(function(e){
      return '<article class="proy-card"><div class="pc-head"><h4>'+esc(e.nombre)+'</h4>'+(e.emitido?'<span class="tag-pill tag-verde">Emitido'+(e.revision?' · Rev. '+e.revision:'')+'</span>':'<span class="tag-pill tag-gris">Borrador</span>')+'</div>' +
        '<div class="pc-meta"><span>'+(e.codigo ? esc(e.codigo)+' · ' : '')+e.tipos.length+' diseños · '+e.edades.length+' edades</span><span>'+esc(e.fecha||'')+'</span></div>' +
        '<div class="pc-foot"><span class="mono">'+esc((e.firmas||[]).map(function(f){ return f.rol + ' ' + f.nombre; }).join(' · ') || 'Sin firmas')+'</span><button class="btn-add" data-abrir-rr="'+esc(e.id)+'">Abrir en visor →</button></div></article>';
    }).join('') + '</div>' : '<p class="nota-sm">No hay reportes RR. Generalos desde <a href="#" data-goto="reporte-rr">Reporte RR</a>.</p>') + '</div>';
}

/* ---- 12. Equipo ---- */
function expEquipoHtml(p){
  var equipos = [p.equipoLider].concat(p.equiposApoyo || []).filter(Boolean);
  var gente = usuarios.filter(function(u){ return u.activo && (u.id === p.responsable || (u.equipos || []).some(function(e){ return equipos.indexOf(e) > -1; })); });
  return '<div class="card"><div class="section-num">Equipos</div><p><b>Lidera:</b> '+esc(p.equipoLider || '—')+'</p><p><b>Apoyan:</b> '+esc((p.equiposApoyo || []).join(', ') || '—')+'</p></div>' +
    '<div class="card table-scroll"><table class="data-table"><thead><tr><th></th><th>Nombre</th><th>Puesto</th><th>Rol en el sistema</th><th>Rol en el proyecto</th><th>Equipo</th></tr></thead><tbody>' +
    (gente.length ? gente.map(function(u){
      var enProy = u.id === p.responsable ? 'Responsable' : ((u.equipos || []).indexOf(p.equipoLider) > -1 ? 'Equipo líder' : 'Apoyo');
      return '<tr><td><span class="sb-avatar chico rol-'+rolDe(u)+'">'+esc(inicialesUsuario(u))+'</span></td><td>'+esc(nombreUsuario(u))+'</td><td>'+esc(u.puesto||'-')+'</td><td>'+esc(rolLabel(u.rol))+'</td><td><b>'+enProy+'</b></td><td>'+esc((u.equipos||[]).join(', '))+'</td></tr>';
    }).join('') : '<tr><td colspan="6" class="nota-sm">Nadie asignado a estos equipos. Se asignan en Usuarios y roles.</td></tr>') + '</tbody></table></div>';
}
function expHistorialHtml(m){
  var lista = historialDeProyecto(m.nombre);
  return '<div class="card"><div class="table-scroll"><table class="data-table"><thead><tr><th>Fecha</th><th>Usuario</th><th>Acción</th><th>Entidad</th><th>Detalle</th></tr></thead><tbody>' +
    (lista.length ? lista.slice(0, 300).map(function(h){
      return '<tr><td class="mono">'+fechaHora(h.ts)+'</td><td>'+esc(h.usuario)+'</td><td>'+esc(h.accion)+'</td><td>'+esc(h.entidad)+'</td><td>'+esc(h.detalle)+'</td></tr>';
    }).join('') : '<tr><td colspan="5" class="empty-note">Sin movimientos registrados.</td></tr>') + '</tbody></table></div></div>';
}
function exportarExpediente(m){
  var p = proyectoPorNombre(m.nombre);
  var resumen = [['Expediente del proyecto', m.nombre], ['Código', p.codigo], ['Estado', p.estado], ['Semáforo', semaforoProyecto(m.nombre).color], ['Avance %', m.avancePct],
    ['Iteraciones', m.iteraciones.join(', ')], ['Diseños', m.nDisenos], ['Completados', m.completados], ['Roturas registradas', m.cargasCompletas + ' de ' + m.cargas.length],
    ['Roturas vencidas', m.vencidas], ['Costo acumulado (S/)', +costoProyecto(m.nombre).total.toFixed(2)], ['Presupuesto (S/)', n(p.presupuesto) || ''],
    ['Exportado', fechaHora(Date.now()) + ' por ' + (usuarioActual ? usuarioActual.usuario : '')]];
  var dis = [['Código','Diseño','Iteración','Versión','Fecha','Planta','f\'c','a/mc','Cemento','CVD (S/./m³)','Costo (S/)','Estado','Colaborador','Responsable']].concat(m.disenos.map(function(d){
    return [d.codigo, diseñoTitulo(d), d.iteracionId||'', d.version||1, d.fecha||'', d.planta||'', n(d.fc)||'', n(d.amcEfectiva)||'', d.cementoTipo||'', n(d.cvdTotal)||'', +costoDiseno(d).toFixed(2), d.estado, d.colaborador||'', d.responsable||''];
  }));
  var filasBH = baseHistoricaFilas().filter(function(f){ return f.proyecto === m.nombre; });
  var res = [BH_COLUMNAS.map(function(c){ return c.t; })].concat(filasBH.map(function(f){ return BH_COLUMNAS.map(function(c){ return f[c.k]; }); }));
  var plan = [['Actividad','Responsable','Inicio','Fin','Avance %']].concat(actividades.filter(function(a){ return a.proyecto === m.nombre; }).map(function(a){ return [a.nombre, nombreUsuario(usuarioPorId(a.responsable)), a.inicio, a.fin, a.avance]; }));
  var bit = [['Fecha','Autor','Nota']].concat(bitacora.filter(function(b){ return b.proyecto === m.nombre; }).map(function(b){ return [b.fecha, nombreUsuario(usuarioPorId(b.autor)), b.texto]; }));
  var his = [['Fecha','Usuario','Acción','Entidad','Detalle']].concat(historialDeProyecto(m.nombre).map(function(h){ return [fechaHora(h.ts), h.usuario, h.accion, h.entidad, h.detalle]; }));
  if(exportarExcel('Expediente - ' + m.nombre + '.xlsx', [{nombre:'Resumen', filas:resumen}, {nombre:'Diseños', filas:dis}, {nombre:'Resultados', filas:res}, {nombre:'Plan', filas:plan}, {nombre:'Bitácora', filas:bit}, {nombre:'Historial', filas:his}])){
    registrarHistorial('Exportó', 'Proyecto', 'Expediente ' + m.nombre, {proyecto:m.nombre});
    toast('Expediente exportado a Excel');
  }
}

/* ---- Eventos del expediente ---- */
document.getElementById('proy-expediente').addEventListener('click', function(e){
  var p = proyectoPorNombre(expedienteProyecto);
  var t = function(sel){ return e.target.closest(sel); };
  if(t('#exp-volver')){ cerrarExpediente(); return; }
  var tab = t('[data-exp-tab]');
  if(tab){ expedienteTab = tab.dataset.expTab; renderExpediente(); return; }
  if(t('#exp-ficha')){ abrirFichaProyecto(p); return; }
  var est = t('[data-estado-proy]');
  if(est){
    var nuevo = est.dataset.estadoProy;
    var pideMotivo = nuevo === 'En pausa' || nuevo === 'Cancelado' || (nuevo === 'En curso' && p.estado !== 'Planificado');
    var aplicar = function(motivo){ var err = cambiarEstadoProyecto(p, nuevo, motivo); if(err) return err; toast('Proyecto ' + nuevo); renderExpediente(); return ''; };
    if(pideMotivo) pedirMotivo(est.textContent + ' proyecto', nuevo === 'En pausa' ? 'Se pausan los avisos del plan; las roturas ya programadas siguen.' : (nuevo === 'Cancelado' ? 'Los datos quedan de solo lectura.' : ''), aplicar);
    else { var err = aplicar(''); if(err) toast(err); }
    return;
  }
  if(t('#exp-evidencia-2')){ abrirModalEvidencia(expedienteProyecto, '', function(){ expedienteTab = 'documentos'; renderExpediente(); }); return; }
  if(t('#exp-exportar')){ exportarExpediente(metricasProyecto(expedienteProyecto)); return; }
  if(t('#exp-nuevo-diseno')){
    if(!exigir('disenos:crear')) return;
    showPanel('disenos'); showSubTab('calcular');
    fillProyectoCatalogoSelect(document.getElementById('pp-proyecto'), expedienteProyecto);
    fillPpIteracionSelect(expedienteProyecto, '');
    return;
  }
  if(t('[data-act-nueva]')){ abrirActividad(p, null); return; }
  var ae = t('[data-act-editar]');
  if(ae){ abrirActividad(p, actividades.filter(function(a){ return a.id === ae.dataset.actEditar; })[0]); return; }
  if(t('[data-iter-nueva]')){
    abrirDialogo({titulo:'Nueva iteración', html:'<div class="pred-form">' + campo('Mes', '<select id="it-mes"></select>') + campo('Numeral (opcional)', '<select id="it-num"><option value="">Sin numeral</option>'+NUMERAL_ROMANO.map(function(r){ return '<option>'+r+'</option>'; }).join('')+'</select>') + '</div>' +
      campo('Objetivo (opcional)', '<textarea id="it-obj" rows="2"></textarea>') + '<p class="campo-error" id="it-err"></p>',
      alAbrir:function(c){ fillMesSelect(c.querySelector('#it-mes'), mesActual()); },
      botones:[{label:'Registrar', accion:function(c){
        var mes = c.querySelector('#it-mes').value, num = c.querySelector('#it-num').value;
        if(!mes){ c.querySelector('#it-err').textContent = 'El mes es obligatorio.'; return false; }
        var it = construirIteracion(mes, !!num, num);
        if(iteracionesDeProyecto(p.nombre).indexOf(it) > -1){ c.querySelector('#it-err').textContent = 'Esa iteración ya existe en el proyecto.'; return false; }
        registrarIteracion(p.nombre, it, c.querySelector('#it-obj').value.trim());
        registrarHistorial('Creó', 'Iteración', p.nombre + ' — ' + it, {proyecto:p.nombre});
        renderExpediente();
      }}]});
    return;
  }
  var ic = t('[data-iter-cerrar]');
  if(ic){
    var it = ic.dataset.iterCerrar;
    var pre = validarCierreIteracion(p.nombre, it, 'x'.repeat(20));
    if(pre){ toast(pre); return; }
    abrirDialogo({titulo:'Cerrar iteración ' + it, html: campo('Conclusión (mín. 20 caracteres)', '<textarea id="it-conc" rows="4"></textarea>') + '<p class="campo-error" id="it-err"></p>',
      botones:[{label:'Cerrar iteración', accion:function(c){
        var err = cerrarIteracion(p.nombre, it, c.querySelector('#it-conc').value);
        if(err){ c.querySelector('#it-err').textContent = err; return false; }
        toast('Iteración cerrada'); renderExpediente();
      }}]});
    return;
  }
  var ir = t('[data-iter-reabrir]');
  if(ir){
    pedirMotivo('Reabrir iteración ' + ir.dataset.iterReabrir, '', function(m){
      var k = p.nombre + '::' + ir.dataset.iterReabrir;
      ITERACIONES_INFO[k] = Object.assign({}, ITERACIONES_INFO[k], {cerrada:false, reabierta:{ts:Date.now(), motivo:m, usuario:usuarioActual.id}});
      saveIteracionesInfo();
      registrarHistorial('Reabrió', 'Iteración', p.nombre + ' — ' + ir.dataset.iterReabrir + ' · motivo: ' + m, {proyecto:p.nombre});
      renderExpediente();
    });
    return;
  }
  if(t('[data-doc-nuevo]')){ abrirDocumento(p); return; }
  var dq = t('[data-doc-quitar]');
  if(dq){
    var doc = documentosProyecto.filter(function(x){ return x.id === dq.dataset.docQuitar; })[0];
    if(!doc || !confirm('¿Quitar "' + doc.nombre + '" del expediente? El archivo sigue en Drive.')) return;
    documentosProyecto = documentosProyecto.filter(function(x){ return x !== doc; });
    saveDocumentos();
    registrarHistorial('Quitó', 'Documento', doc.nombre, {proyecto:p.nombre});
    renderExpediente();
    return;
  }
  if(t('[data-bit-nueva]')){ abrirNotaBitacora(p, null); return; }
  var be = t('[data-bit-editar]');
  if(be){ abrirNotaBitacora(p, bitacora.filter(function(b){ return b.id === be.dataset.bitEditar; })[0]); return; }
  var rg = t('[data-rep-generar]');
  if(rg){ generarReporteProyecto(p, rg.dataset.repGenerar === 'final'); return; }
  var rv = t('[data-rep-ver]');
  if(rv){ verReporteProyecto(reportesProyecto.filter(function(r){ return r.id === rv.dataset.repVer; })[0]); return; }
  var ro = t('[data-exp-rotura]');
  if(ro){ openRoturaCargaModal(ro.dataset.expRotura); return; }
  var act = t('[data-exp-act]');
  if(act){
    var d = disenoPorCodigo(act.dataset.codigo);
    if(!d) return;
    if(act.dataset.expAct === 'view') openDesignModal(d);
    else if(act.dataset.expAct === 'informe') openInformeModal(d);
    else if(act.dataset.expAct === 'etiquetas') abrirEtiquetas(d.codigo);
    return;
  }
  var rr = t('[data-abrir-rr]');
  if(rr){ rrActiveId = rr.dataset.abrirRr; showPanel('reporte-rr'); renderRRStudyList(); renderRRDetail(); return; }
  if(t('#exp-galeria')){ manejarClickGaleria(e, function(){ renderExpediente(); }); }
});
document.getElementById('proy-expediente').addEventListener('change', function(e){
  var fd = e.target.dataset.expFdis;
  if(fd !== undefined){ expFiltroDis[fd] = e.target.value; renderExpedienteTab(metricasProyecto(expedienteProyecto), proyectoPorNombre(expedienteProyecto)); return; }
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
