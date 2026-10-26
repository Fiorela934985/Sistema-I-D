/* Sistema I+D — Entidad DISEÑO: datos, tarjetas, acciones, histórico e inicio */
'use strict';

var disenos = load('sid10_disenos', [
  {codigo:'DID-0001', nombreTecnico:'CL24MPa(28d)-I-H67-A1', planta:'1207 Industrial Cajamarca', laboratorio:'1207-CAX', tipo:'Mezcla ligera', resistencia:'24', estado:'Completado', fecha:'', ts:Date.now()-40*DAY, favorito:false, cvdTotal:210.00, mix:[], replicas:2},
  {codigo:'DID-0002', nombreTecnico:'CL28MPa(3d)-I-H67-A1', planta:'1213 Industrial Trujillo', laboratorio:'1213-TRU', tipo:'Mezcla estructural', resistencia:'28', estado:'Completado', fecha:'', ts:Date.now()-5*DAY, favorito:true, cvdTotal:269.52, mix:[], replicas:2},
  {codigo:'DID-0003', nombreTecnico:'CL35MPa(7d)-HE-H67-A1', planta:'1211 Industrial Pacasmayo', laboratorio:'1211-PAC', tipo:'Mezcla autocompactante', resistencia:'35', estado:'En desarrollo', fecha:'', ts:Date.now()-3*DAY, favorito:true, cvdTotal:198.70, mix:[], replicas:2},
  {codigo:'DID-0004', nombreTecnico:'CL42MPa(3d)-HE-H67-A1', planta:'1219 Industrial Moche', laboratorio:'1219-MCH', tipo:'Mezcla de alta resistencia', resistencia:'42', estado:'Iniciado', fecha:'', ts:Date.now()-1*DAY, favorito:false, cvdTotal:305.10, mix:[], replicas:2},
  {codigo:'DID-0005', nombreTecnico:'CL24MPa(3d)-I-H67-A2', planta:'1213 Industrial Trujillo', laboratorio:'1213-TRU', tipo:'Mezcla estándar', resistencia:'24', estado:'Iniciado', fecha:'', ts:Date.now()-6*3600*1000, favorito:false, cvdTotal:245.30, mix:[], replicas:2}
].map(function(d){
  if(!d.fecha){ var f = new Date(d.ts); d.fecha = String(f.getDate()).padStart(2,'0')+'/'+String(f.getMonth()+1).padStart(2,'0')+'/'+f.getFullYear(); }
  return d;
}));


function diseñoTitulo(d){ return d.nombreTecnico || d.tipo; }
/* Semáforo del diseño: rojo si tiene roturas vencidas o nada avanzado; naranja en curso; verde con todo resuelto. */
function semaforoDiseno(d){
  if(d.estado === 'Cancelado') return 'gris';
  if(d.estado === 'Completado' || d.estado === 'Validado') return 'verde';
  if(!d.replicaObjs || !d.replicaObjs.length || !d.diasRotura || !d.diasRotura.length) return 'rojo';
  var hoy = todayISO();
  var cargas = roturaCargas.filter(function(c){ return c.disenoCodigoDiseno === d.codigo; });
  if(cargas.some(function(c){ return c.estado === 'pendiente' && c.fechaEnsayo < hoy; })) return 'rojo';
  var total = d.replicaObjs.length * d.diasRotura.length;
  var resueltas = cargas.filter(cargaResuelta).length;
  if(resueltas >= total && total) return 'verde';
  return resueltas || cargas.length ? 'naranja' : 'rojo';
}
function replicasElaboradas(d){ return (d.replicaObjs || []).filter(function(r){ return r.elaboracion || cargasDeReplicaObj(d, r).length; }); }
function disenoEditable(d){ return ['Completado', 'Validado', 'Cancelado'].indexOf(d.estado) === -1 && proyectoAbierto(proyectoPorNombre(proyectoNombre(d.proyectoId)) || {estado:'En curso'}); }
function semaforoDotHtml(color, title){
  return '<span class="semaforo-dot semaforo-'+color+'" title="'+(title||'')+'"></span>';
}
function disenoActionsHtml(d,i){
  return '<button class="btn-icon view" data-act="view" data-i="'+i+'" title="Ver diseño">'+EYE_ICON+'</button>' +
    '<button class="btn-icon results" data-perm="resultados:registrar" data-act="results" data-i="'+i+'" title="Cargar resultados">'+RESULTS_ICON+'</button>' +
    '<button class="btn-icon fav'+(d.favorito?' active':'')+'" data-act="fav" data-i="'+i+'" title="Favorito">'+(d.favorito?STAR_FILLED:STAR_OUTLINE)+'</button>' +
    '<div class="more-wrap">' +
      '<button class="btn-icon more" data-act="more" data-i="'+i+'" title="Más opciones">'+KEBAB_ICON+'</button>' +
      '<div class="more-menu" data-menu-i="'+i+'">' +
        '<span class="more-menu-label">Consultar</span>' +
        '<button data-act="informe" data-i="'+i+'">'+CHART_ICON+' Ver informe</button>' +
        '<button data-act="expediente" data-i="'+i+'">'+FOLDER_ICON+' Expediente del proyecto</button>' +
        '<button data-act="copy" data-i="'+i+'">'+CLIPBOARD_ICON+' Copiar datos</button>' +
        '<span class="more-menu-label">Laboratorio</span>' +
        '<button data-act="etiquetas" data-i="'+i+'">'+TAG_ICON+' Imprimir etiquetas</button>' +
        '<button data-act="evidencia" data-perm="evidencias:subir" data-i="'+i+'">'+CAMERA_ICON+' Subir evidencia</button>' +
        '<button data-act="elaborar" data-i="'+i+'">'+RESULTS_ICON+' Ir a elaboración</button>' +
        '<span class="more-menu-label" data-perm="disenos:editar">Editar</span>' +
        (disenoEditable(d) ? '<button data-act="receta" data-perm="disenos:editar" data-i="'+i+'">'+EDIT_ICON+' '+(replicasElaboradas(d).length ? 'Nueva versión de receta' : 'Editar receta')+'</button>' +
          '<button data-act="replica" data-perm="disenos:editar" data-i="'+i+'">'+DUP_ICON+' Agregar réplica</button>' +
          '<button data-act="edit-iter" data-perm="disenos:editar" data-i="'+i+'">'+EDIT_ICON+' Cambiar iteración</button>' : '') +
        '<button data-act="dup" data-perm="disenos:crear" data-i="'+i+'">'+DUP_ICON+' Duplicar</button>' +
        (disenoEditable(d) ? '<div class="more-menu-divider" data-perm="disenos:editar"></div><button class="danger" data-act="cancelar" data-perm="disenos:editar" data-i="'+i+'">'+TRASH_ICON+' Cancelar diseño</button>' : '') +
        (!replicasElaboradas(d).length ? '<button class="danger" data-act="del" data-perm="disenos:eliminar" data-i="'+i+'">'+TRASH_ICON+' Eliminar (sin elaborar)</button>' : '') +
      '</div>' +
    '</div>';
}
function estadoColorClass(estado){ return estado === 'Completado' ? 'thumb-verde' : (estado === 'En desarrollo' ? 'thumb-naranja' : 'thumb-celeste'); }
function tituloConIteracion(d){
  var proyLabel = d.proyectoId ? esc(proyectoNombre(d.proyectoId)) : 'Sin proyecto';
  return proyLabel + (d.iteracionId ? ' - ' + esc(iteracionNombre(d.iteracionId)) : '');
}
function idsDeReplicasHtml(d){
  var codigos = (d.replicaObjs||[]).map(function(r){ return r.codigo; }).filter(Boolean);
  return codigos.length ? codigos.join(', ') : '-';
}
function tipoDisenoLabel(d){ return d.codigo && d.codigo.charAt(0)==='C' ? 'Cubo' : 'Probeta'; }
function disenoCardHtml(d){
  var i = disenos.indexOf(d);
  var tagEstado = d.estado === 'Completado' ? 'tag-verde' : (d.estado === 'En desarrollo' ? 'tag-naranja' : 'tag-celeste');
  var sem = semaforoDotHtml(semaforoDiseno(d), 'Avance de roturas');
  var nRep = (d.replicaObjs && d.replicaObjs.length) || d.replicas || 0;
  return '<div class="design-card">' +
    '<div class="design-thumb '+estadoColorClass(d.estado)+'"></div>' +
    '<div class="design-body">' +
      '<h4 class="dc-proyecto">'+sem+' '+tituloConIteracion(d)+'</h4>' +
      '<span class="dc-nombre">'+diseñoTitulo(d)+'</span>' +
      '<div class="dc-stats-row">' +
        '<div class="id-card-simple">'+d.codigo+'</div>' +
        '<div class="dc-stats-mini">' +
          '<div><b>'+esc(d.horaElaboracion||'-')+'</b><span>Hora</span></div>' +
          '<div><b>'+nRep+'</b><span>Réplica'+(nRep===1?'':'s')+'</span></div>' +
        '</div>' +
      '</div>' +
      '<span class="mono dc-meta">'+esc(d.laboratorio||'-')+' · IDs: '+idsDeReplicasHtml(d)+'</span>' +
      '<div class="tags"><span class="tag-pill '+tagEstado+'">'+d.estado+'</span></div>' +
      '<div class="design-actions">'+disenoActionsHtml(d,i)+'</div>' +
    '</div>' +
  '</div>';
}
function disenoRowHtml(d){
  var i = disenos.indexOf(d);
  var tagEstado = d.estado === 'Completado' ? 'tag-verde' : (d.estado === 'En desarrollo' ? 'tag-naranja' : 'tag-celeste');
  var sem = semaforoDotHtml(semaforoDiseno(d), 'Avance de roturas');
  return '<div class="design-row">' +
    '<div class="drow-thumb"></div>' +
    '<span class="drow-code mono">'+d.codigo+'</span>' +
    '<div class="drow-main"><h5>'+sem+' '+tituloConIteracion(d)+'</h5><span class="dc-nombre-inline">'+diseñoTitulo(d)+'</span><span>'+esc(d.laboratorio||'-')+' · IDs: '+idsDeReplicasHtml(d)+'</span></div>' +
    '<div class="drow-tags"><span class="tag-pill '+tagEstado+'">'+d.estado+'</span></div>' +
    '<div class="drow-actions">'+disenoActionsHtml(d,i)+'</div>' +
  '</div>';
}
function copyDiseno(d){
  var text = 'Nombre técnico: '+diseñoTitulo(d)+'\nCódigo: '+d.codigo+'\nPlanta: '+d.planta+(d.laboratorio?' ('+d.laboratorio+')':'')+'\nProyecto: '+(proyectoNombre(d.proyectoId)||'-')+'\nResistencia: '+d.resistencia+' MPa\nEstado: '+d.estado+'\nFecha: '+d.fecha+(d.cvdTotal?('\nCVD: S/. '+Number(d.cvdTotal).toFixed(2)):'');
  function ok(){ toast('Datos del diseño copiados'); }
  function fail(){ toast('No se pudo copiar'); }
  if(navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(text).then(ok).catch(fail);
  } else {
    try{
      var ta = document.createElement('textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      ok();
    }catch(e){ fail(); }
  }
}

function closeAllMenus(){
  document.querySelectorAll('.more-menu.show').forEach(function(m){ m.classList.remove('show'); });
  document.querySelectorAll('.menu-open-card').forEach(function(el){ el.classList.remove('menu-open-card'); });
}
document.addEventListener('click', function(e){
  if(!e.target.closest('.more-wrap')) closeAllMenus();
});

var pendingDuplicate = null;
function askConfirmDuplicate(d){
  try{
    pendingDuplicate = d;
    document.getElementById('confirm-modal-name').textContent = diseñoTitulo(d);
    document.getElementById('confirm-modal').classList.add('show');
  }catch(err){
    console.error('Error al abrir confirmación de duplicado:', err);
    toast('No se pudo abrir la confirmación de duplicado — probá de nuevo o avisá si persiste');
  }
}
document.getElementById('confirm-cancel').addEventListener('click', function(){
  pendingDuplicate = null;
  document.getElementById('confirm-modal').classList.remove('show');
});
document.getElementById('confirm-modal').addEventListener('click', function(e){
  if(e.target.id === 'confirm-modal'){
    pendingDuplicate = null;
    document.getElementById('confirm-modal').classList.remove('show');
  }
});
document.getElementById('confirm-accept').addEventListener('click', function(){
  document.getElementById('confirm-modal').classList.remove('show');
  if(pendingDuplicate){
    try{
      duplicateDesignToForm(pendingDuplicate);
    }catch(err){
      console.error('Error al duplicar diseño:', err);
      toast('Ocurrió un error al duplicar — revisá la consola o avisá si persiste');
    }
  }
  pendingDuplicate = null;
});

function duplicateDesignToForm(d){
  showPanel('disenos');
  showSubTab('calcular');
  fillProyectoCatalogoSelect(document.getElementById('pp-proyecto'), d.proyectoId || '');
  registrarIteracion(proyectoNombre(d.proyectoId), d.iteracionId);
  fillPpIteracionSelect(proyectoNombre(d.proyectoId), d.iteracionId);
  document.getElementById('dis-colaborador').value = d.colaborador || '';
  document.getElementById('dis-responsable').value = d.responsable || '';
  componentesAdicionales = (d.componentesAdicionales || []).slice();
  renderComponentesAdicionales();
  document.getElementById('dis-planta').value = d.planta || '';
  syncLaboratorio();
  document.getElementById('dis-ndiseno').value = disenos.length + 1;
  var tipoIdx = selectedTipoConcretoIndexByLabel(d.tipo);
  document.getElementById('dis-tipo-concreto').value = tipoIdx >= 0 ? tipoIdx : '';
  document.getElementById('dis-fc').value = d.fc || '';
  document.getElementById('dis-ft').value = d.ft || '';
  document.getElementById('dis-edad').value = d.edad || '';
  document.getElementById('dis-tmn').value = d.tmn || '';
  if(d.agregadoGrueso){
    var aggIdx = -1;
    for(var k=0;k<componentes.length;k++){ if(componentes[k].categoria==='Piedra' && componentes[k].nombre===d.agregadoGrueso){ aggIdx=k; break; } }
    document.getElementById('dis-agregado-grueso').value = aggIdx>=0 ? aggIdx : '';
  }
  document.getElementById('dis-slump').value = d.slump || '';
  document.getElementById('dis-exposicion').value = d.exposicion || '';
  document.getElementById('dis-aire').value = d.aire || '';
  document.getElementById('dis-desv-std').value = d.desvStd || '';
  document.getElementById('dis-amc-efectiva').value = d.amcEfectiva || '';
  document.getElementById('dis-agua-req').value = d.aguaReq || '';
  document.getElementById('dis-pct-fino').value = d.pctFino || '';
  document.getElementById('dis-pct-grueso').value = d.pctGrueso || '';
  document.getElementById('dis-sufijo').value = '';
  document.getElementById('hoja-nombre-editar-wrap').style.display = 'block';
  document.getElementById('dis-estado-view').value = 'Iniciado';
  if(d.extra){
    document.querySelectorAll('#sub-calcular [data-key]').forEach(function(el){
      if(d.extra[el.dataset.key] !== undefined) el.value = d.extra[el.dataset.key];
    });
  }
  function findIdxByNombre(nombre){
    for(var k=0;k<componentes.length;k++){ if(componentes[k].nombre === nombre) return k; }
    return -1;
  }
  if(d.cementoMat){ var cIdx = findIdxByNombre(d.cementoMat); document.getElementById('dis-cemento-mat').value = cIdx>=0?cIdx:''; }
  document.getElementById('dis-cemento-peso').value = d.cementoPeso || '';
  if(d.aguaMat){ var aIdx = findIdxByNombre(d.aguaMat); document.getElementById('dis-agua-mat').value = aIdx>=0?aIdx:''; }
  if(d.aditivoMat){ var dIdx = findIdxByNombre(d.aditivoMat); document.getElementById('dis-aditivo-mat').value = dIdx>=0?dIdx:''; }
  document.getElementById('dis-aditivo-peso').value = d.aditivoPeso || '';
  rebuildIncidenciaTable();
  recalcFcr();
  renderMezclaDisplay();
  refreshNombrePreview();
  toast('Diseño duplicado — editalo y presioná "Registrar Diseño" para guardarlo como uno nuevo');
  document.getElementById('sub-calcular').scrollIntoView({behavior:'smooth', block:'start'});
}

function handleCardAction(e){
  var btn = e.target.closest('.btn-icon, .more-menu button');
  if(!btn) return;
  var i = Number(btn.dataset.i);
  var act = btn.dataset.act;
  if(act === 'view'){
    openDesignModal(disenos[i]);
  } else if(act === 'results'){
    // Los ensayos en fresco se cargan en el cuaderno de cada réplica (paso 3); los resultados se cierran en Revisión (paso 5).
    elaboracionFiltroProyecto = proyectoNombre(disenos[i].proyectoId);
    showPanel('elaboracion');
    showElaboracionSub('elaboradas');
  } else if(act === 'expediente'){
    closeAllMenus();
    abrirExpediente(proyectoNombre(disenos[i].proyectoId));
  } else if(act === 'etiquetas'){
    closeAllMenus();
    abrirEtiquetas(disenos[i].codigo);
  } else if(act === 'evidencia'){
    closeAllMenus();
    abrirModalEvidencia(proyectoNombre(disenos[i].proyectoId), disenos[i].codigo);
  } else if(act === 'informe'){
    openInformeModal(disenos[i]);
  } else if(act === 'dup'){
    closeAllMenus();
    if(!exigir('disenos:crear')) return;
    askConfirmDuplicate(disenos[i]);
  } else if(act === 'fav'){
    disenos[i].favorito = !disenos[i].favorito;
    save('sid10_disenos', disenos);
    toast(disenos[i].favorito ? 'Agregado a favoritos' : 'Quitado de favoritos');
    renderAllDesignViews();
  } else if(act === 'more'){
    var menu = btn.parentElement.querySelector('.more-menu');
    var isOpen = menu.classList.contains('show');
    var card = btn.closest('.design-card, .design-row, .ih-card');
    closeAllMenus();
    if(!isOpen){
      menu.classList.add('show');
      if(card) card.classList.add('menu-open-card');
    }
  } else if(act === 'copy'){
    closeAllMenus();
    copyDiseno(disenos[i]);
  } else if(act === 'edit-iter'){
    closeAllMenus();
    if(!exigir('disenos:crear')) return;
    abrirEditIteracionModal(i);
  } else if(act === 'del'){
    closeAllMenus();
    if(!exigir('disenos:eliminar')) return;
    eliminarDiseno(disenos[i]);
  } else if(act === 'cancelar'){
    closeAllMenus();
    if(exigir('disenos:editar')) cancelarDiseno(disenos[i]);
  } else if(act === 'receta'){
    closeAllMenus();
    if(exigir('disenos:editar')) abrirEditarReceta(disenos[i]);
  } else if(act === 'replica'){
    closeAllMenus();
    if(exigir('disenos:editar')) agregarReplica(disenos[i]);
  } else if(act === 'elaborar'){
    closeAllMenus();
    elaboracionFiltroProyecto = proyectoNombre(disenos[i].proyectoId);
    showPanel('elaboracion');
    showElaboracionSub('programar');
  }
}
document.getElementById('dis-gallery').addEventListener('click', function(e){
  var toggleBtn = e.target.closest('.date-group-head');
  if(toggleBtn){
    toggleBtn.closest('.date-group').classList.toggle('collapsed');
    return;
  }
  handleCardAction(e);
});
document.getElementById('inicio-disenos-tbody').addEventListener('click', handleCardAction);
document.getElementById('favoritos-grid').addEventListener('click', handleCardAction);

var histView = 'cards';
function renderDisenosHistorico(){
  var wrap = document.getElementById('dis-gallery');
  var searchTxt = (document.getElementById('hist-search').value || '').trim().toLowerCase();
  var fechaFiltro = document.getElementById('hist-fecha-filtro').value;
  var proyFiltro = document.getElementById('hist-proyecto-filtro').value;
  var filtered = disenos.filter(function(d){
    if(searchTxt && diseñoTitulo(d).toLowerCase().indexOf(searchTxt) === -1) return false;
    if(proyFiltro && d.proyectoId !== proyFiltro) return false;
    if(fechaFiltro){
      var dIso = dmyToISO(d.fecha);
      if(dIso !== fechaFiltro) return false;
    }
    return true;
  }).sort(function(a,b){ return (b.ts||0) - (a.ts||0); });

  if(!filtered.length){
    wrap.innerHTML = '<div class="empty-note">Sin resultados.</div>';
    document.getElementById('disenos-count').textContent = disenos.length + ' registros';
    updateStats();
    return;
  }
  var renderFn = histView === 'list' ? disenoRowHtml : disenoCardHtml;
  var groups = [];
  var byKey = {};
  if(proyFiltro){
    // Con un Proyecto elegido: agrupar por Iteración (partición del proyecto), no por fecha.
    filtered.forEach(function(d){
      var key = d.iteracionId || 'Sin iteración';
      if(!byKey[key]){ byKey[key] = []; groups.push(key); }
      byKey[key].push(d);
    });
    groups.sort(function(a,b){
      var pa = partesDeIteracion(a==='Sin iteración'?'':a), pb = partesDeIteracion(b==='Sin iteración'?'':b);
      var ia = MES_NOMBRES.indexOf(pa.mes), ib = MES_NOMBRES.indexOf(pb.mes);
      if(ia !== ib) return ia - ib;
      return NUMERAL_ROMANO.indexOf(pa.numeral) - NUMERAL_ROMANO.indexOf(pb.numeral);
    });
    wrap.innerHTML = groups.map(function(iter){
      return '<div class="date-group">' +
        '<button class="date-group-head" data-toggle="1"><span class="dg-chevron">▾</span><span class="dg-fecha">'+esc(proyectoNombre(proyFiltro))+' — '+esc(iter)+'</span><span class="dg-count">'+byKey[iter].length+' diseño'+(byKey[iter].length===1?'':'s')+'</span></button>' +
        '<div class="gallery'+(histView==='list'?' list-view':'')+'">'+byKey[iter].map(renderFn).join('')+'</div>' +
      '</div>';
    }).join('');
  } else {
    filtered.forEach(function(d){
      var key = d.fecha || 'Sin fecha';
      if(!byKey[key]){ byKey[key] = []; groups.push(key); }
      byKey[key].push(d);
    });
    wrap.innerHTML = groups.map(function(fecha){
      return '<div class="date-group">' +
        '<button class="date-group-head" data-toggle="1"><span class="dg-chevron">▾</span><span class="dg-fecha">'+esc(fecha)+'</span><span class="dg-count">'+byKey[fecha].length+' diseño'+(byKey[fecha].length===1?'':'s')+'</span></button>' +
        '<div class="gallery'+(histView==='list'?' list-view':'')+'">'+byKey[fecha].map(renderFn).join('')+'</div>' +
      '</div>';
    }).join('');
  }
  document.getElementById('disenos-count').textContent = disenos.length + ' registros';
  updateStats();
}
document.getElementById('hist-search').addEventListener('input', renderDisenosHistorico);
document.getElementById('hist-fecha-filtro').addEventListener('change', renderDisenosHistorico);
document.getElementById('hist-proyecto-filtro').addEventListener('change', renderDisenosHistorico);
function rebuildHistProyectoFiltro(){
  var sel = document.getElementById('hist-proyecto-filtro');
  var current = sel.value;
  fillProyectoCatalogoSelect(sel, current);
  sel.insertAdjacentHTML('afterbegin', '<option value="">Todos los proyectos</option>');
}
document.getElementById('hist-view-toggle').addEventListener('click', function(e){
  var btn = e.target.closest('.view-toggle-btn');
  if(!btn) return;
  histView = btn.dataset.view;
  document.querySelectorAll('.view-toggle-btn').forEach(function(b){ b.classList.toggle('active', b===btn); });
  renderDisenosHistorico();
});
function renderInicioRecientes(){
  var wrap = document.getElementById('inicio-disenos-tbody');
  var limite = Date.now() - 7*DAY;
  var recientes = disenos.filter(function(d){ return (d.ts||0) >= limite; }).sort(function(a,b){ return (b.ts||0)-(a.ts||0); });
  var subEl = document.getElementById('inicio-disenos-sub');
  if(subEl) subEl.textContent = recientes.length ? ('· ' + recientes.length + ' esta semana') : '';
  if(!recientes.length){ wrap.innerHTML = '<div class="empty-note">No hay diseños de los últimos 7 días.</div>'; return; }
  var LIMITE = 6;
  wrap.innerHTML = recientes.slice(0, LIMITE).map(function(d){
    var i = disenos.indexOf(d);
    var estColor = d.estado === 'Completado' ? 'verde' : (d.estado === 'En desarrollo' ? 'naranja' : 'celeste');
    return '<div class="ih-card accent-'+estColor+'">' +
      '<div class="ih-main">' +
        '<div class="ih-top-line"><span class="ih-nombre">'+diseñoTitulo(d)+'</span><span class="ih-badge '+estColor+'">'+d.estado+'</span></div>' +
        '<span class="ih-meta">'+d.codigo+' · '+d.fecha+'</span>' +
      '</div>' +
      '<button class="btn-icon view" data-act="view" data-i="'+i+'" title="Ver diseño">'+EYE_ICON+'</button>' +
    '</div>';
  }).join('');
}
var DIA_NOMBRES = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
function actualizarRelojInicio(){
  var el = document.getElementById('inicio-fecha-hora');
  if(!el) return;
  var d = new Date();
  var dia = DIA_NOMBRES[d.getDay()];
  dia = dia.charAt(0).toUpperCase() + dia.slice(1);
  var fecha = String(d.getDate()).padStart(2,'0')+' de '+MES_NOMBRES[d.getMonth()].toLowerCase();
  var hora = String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0')+':'+String(d.getSeconds()).padStart(2,'0');
  el.innerHTML = dia+', '+fecha+' · <b>'+hora+'</b>';
}
setInterval(actualizarRelojInicio, 1000);

function renderInicioKpis(){
  var wrap = document.getElementById('inicio-kpi-strip');
  if(!wrap) return;
  var todayStr = todayISO();
  var pendHoy = roturaCargas.filter(function(c){ return c.estado==='pendiente' && c.fechaEnsayo===todayStr; }).length;
  var activos = disenos.filter(function(d){ return d.estado!=='Completado'; }).length;
  var limite = Date.now() - 7*DAY;
  var completadosSemana = disenos.filter(function(d){ return d.estado==='Completado' && (d.ts||0)>=limite; }).length;
  var favoritos = disenos.filter(function(d){ return d.favorito; }).length;
  wrap.innerHTML =
    '<div class="kpi-card kpi-rojo"><div class="kpi-icon">'+TESTTUBE_ICON+'</div><div><div class="kpi-num">'+pendHoy+'</div><div class="kpi-label">Roturas pendientes hoy</div></div></div>' +
    '<div class="kpi-card kpi-naranja"><div class="kpi-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="7" x2="16" y2="7"/></svg></div><div><div class="kpi-num">'+activos+'</div><div class="kpi-label">Diseños activos</div></div></div>' +
    '<div class="kpi-card kpi-verde"><div class="kpi-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="10"/></svg></div><div><div class="kpi-num">'+completadosSemana+'</div><div class="kpi-label">Completados esta semana</div></div></div>' +
    '<div class="kpi-card kpi-negro"><div class="kpi-icon" style="color:#f5c518;">'+STAR_FILLED+'</div><div><div class="kpi-num">'+favoritos+'</div><div class="kpi-label">Favoritos</div></div></div>';
}
function resultadosRealesDiseno(d){
  var cargas = roturaCargas.filter(function(c){ return c.disenoCodigoDiseno === d.codigo; });
  var completas = cargas.filter(function(c){ return c.estado === 'completado'; });
  var proms = completas.map(function(c){ return Number(c.promedio); }).filter(function(v){ return v>0; });
  var promedioReal = proms.length ? (proms.reduce(function(a,b){return a+b;},0)/proms.length).toFixed(1) : '-';
  return {completadas: completas.length, total: cargas.length, promedioReal: promedioReal};
}
function renderInicioFavoritos(){
  var wrap = document.getElementById('favoritos-grid');
  var favs = disenos.filter(function(d){ return d.favorito; }).sort(function(a,b){ return (b.ts||0)-(a.ts||0); });
  if(!favs.length){ wrap.innerHTML = '<div class="empty-note">Todavía no marcaste diseños como favoritos.</div>'; return; }
  wrap.innerHTML = favs.map(function(d){
    var i = disenos.indexOf(d);
    var res = resultadosRealesDiseno(d);
    return '<div class="ih-card accent-dorado">' +
      '<button class="btn-icon fav active" data-act="fav" data-i="'+i+'" title="Quitar de favoritos" style="flex-shrink:0;">'+STAR_FILLED+'</button>' +
      '<div class="ih-main">' +
        '<div class="ih-top-line"><span class="ih-nombre">'+diseñoTitulo(d)+'</span></div>' +
        '<span class="ih-meta">'+d.codigo+' · '+res.completadas+'/'+(res.total||'—')+' roturas · '+res.promedioReal+' kg/cm² real</span>' +
      '</div>' +
      '<button class="btn-icon view" data-act="view" data-i="'+i+'" title="Ver ficha">'+EYE_ICON+'</button>' +
      '<button class="btn-icon edit" data-perm="disenos:crear" data-act="dup" data-i="'+i+'" title="Duplicar">'+DUP_ICON+'</button>' +
    '</div>';
  }).join('');
}
function renderAllDesignViews(){
  renderDisenosHistorico();
  renderInicioKpis();
  renderInicioRecientes();
  renderInicioFavoritos();
  renderPendientesHoyInicio();
  updateStats();
  updateNavBadges();
}
/* El correlativo sale del número más alto existente (no de la cantidad): así no se repite tras eliminar. */
function nextCodigoDiseno(){
  var max = disenos.reduce(function(m, d){ var x = parseInt(String(d.codigo||'').replace(/[^0-9]/g,''), 10); return isNaN(x) ? m : Math.max(m, x); }, 0);
  return 'DID-' + String(max + 1).padStart(4,'0');
}
/* Eliminar un diseño también elimina sus roturas y fotos asociadas (antes quedaban huérfanas). */
function eliminarDiseno(d){
  var cargas = roturaCargas.filter(function(c){ return c.disenoCodigoDiseno === d.codigo; });
  var msg = '¿Eliminar el diseño "' + diseñoTitulo(d) + '" (' + d.codigo + ')?';
  if(cargas.length) msg += '\n\nTambién se eliminarán sus ' + cargas.length + ' registros de rotura.';
  if(!confirm(msg)) return;
  cargas.forEach(function(c){ [1,2,3].forEach(function(m){ if(c['evid'+m]) deleteEvidencia(c['evid'+m]).catch(function(){}); }); });
  roturaCargas = roturaCargas.filter(function(c){ return c.disenoCodigoDiseno !== d.codigo; });
  saveRoturaCargas();
  evidenciasIdx.filter(function(ev){ return ev.disenoCodigo === d.codigo; }).forEach(function(ev){ deleteEvidencia(ev.key).catch(function(){}); });
  evidenciasIdx = evidenciasIdx.filter(function(ev){ return ev.disenoCodigo !== d.codigo; });
  saveEvidenciasIdx();
  disenos.splice(disenos.indexOf(d), 1);
  save('sid10_disenos', disenos);
  registrarHistorial('Eliminó', 'Diseño', d.codigo + ' · ' + diseñoTitulo(d) + (cargas.length ? ' (+' + cargas.length + ' roturas)' : ''), {proyecto: proyectoNombre(d.proyectoId), ref: d.codigo});
  toast('Diseño eliminado');
  renderAllDesignViews();
  renderRoturasAll();
}

var editIterIdx = null;
function abrirEditIteracionModal(i){
  editIterIdx = i;
  document.getElementById('edit-iter-modal-name').textContent = diseñoTitulo(disenos[i]);
  var partes = partesDeIteracion(disenos[i].iteracionId);
  fillMesSelect(document.getElementById('ei-mes'), partes.mes);
  fillNumeralSelect(document.getElementById('ei-numeral'), partes.numeral);
  document.getElementById('ei-usar-numeral').checked = partes.tieneNumeral;
  document.getElementById('ei-numeral').disabled = !partes.tieneNumeral;
  document.getElementById('edit-iter-modal').classList.add('show');
}
document.getElementById('ei-usar-numeral').addEventListener('change', function(){
  document.getElementById('ei-numeral').disabled = !this.checked;
});
document.getElementById('ei-cancelar').addEventListener('click', function(){ document.getElementById('edit-iter-modal').classList.remove('show'); });
document.getElementById('edit-iter-modal').addEventListener('click', function(e){ if(e.target.id==='edit-iter-modal') document.getElementById('edit-iter-modal').classList.remove('show'); });
document.getElementById('ei-guardar').addEventListener('click', function(){
  if(editIterIdx===null) return;
  var mes = document.getElementById('ei-mes').value;
  var usarNumeral = document.getElementById('ei-usar-numeral').checked;
  var numeral = document.getElementById('ei-numeral').value;
  if(!mes){ toast('Elegí el mes'); return; }
  var nuevaIteracion = construirIteracion(mes, usarNumeral, numeral);
  registrarIteracion(proyectoNombre(disenos[editIterIdx].proyectoId), nuevaIteracion);
  var iterAnterior = disenos[editIterIdx].iteracionId;
  disenos[editIterIdx].iteracionId = nuevaIteracion;
  save('sid10_disenos', disenos);
  registrarHistorial('Editó', 'Diseño', disenos[editIterIdx].codigo + ' · iteración ' + (iterAnterior||'-') + ' → ' + nuevaIteracion, {proyecto: proyectoNombre(disenos[editIterIdx].proyectoId), ref: disenos[editIterIdx].codigo});
  document.getElementById('edit-iter-modal').classList.remove('show');
  toast('Iteración actualizada');
  renderAllDesignViews();
});

/* ---- RF-DIS-15: cancelar diseño (con motivo; sus roturas pendientes se cancelan; no se borra) ---- */
function cancelarDiseno(d){
  pedirMotivo('Cancelar diseño ' + d.codigo, 'El diseño queda en el expediente como Cancelado y sus roturas pendientes se cancelan.', function(motivo){
    var pend = roturaCargas.filter(function(c){ return c.disenoCodigoDiseno === d.codigo && c.estado === 'pendiente'; });
    pend.forEach(function(c){ c.estado = 'cancelada'; c.motivoCancelacion = motivo; });
    d.estadoAnterior = d.estado;
    d.estado = 'Cancelado';
    d.cancelacion = {ts:Date.now(), motivo:motivo, usuario:usuarioActual.id};
    save('sid10_disenos', disenos);
    saveRoturaCargas();
    registrarHistorial('Canceló', 'Diseño', d.codigo + ' · ' + pend.length + ' roturas pendientes canceladas · motivo: ' + motivo, {proyecto: proyectoNombre(d.proyectoId), ref: d.codigo});
    toast('Diseño cancelado');
    renderAllDesignViews();
    renderRoturasAll();
  });
}

/* ---- RF-DIS-11/13: editar la receta. Libre mientras ninguna réplica esté elaborada; después, solo por
   versión nueva con motivo. Las réplicas ya elaboradas conservan la versión con la que se hicieron. ---- */
function abrirEditarReceta(d){
  var conVersion = replicasElaboradas(d).length > 0;
  var items = (d.mix || []).map(function(it, k){ return {k:k, nombre:it.nombre, pesoSeco:n(it.pesoSeco)}; });
  abrirDialogo({titulo:(conVersion ? 'Nueva versión de receta · ' : 'Editar receta · ') + d.codigo + ' (v' + (d.version || 1) + ')', ancho:'grande',
    html:'<p class="nota-sm">' + (conVersion ? 'Ya hay réplicas elaboradas: el cambio crea la versión ' + ((d.version || 1) + 1) + ' y se aplica a las réplicas que falta elaborar.' : 'Ninguna réplica está elaborada: el cambio se aplica directamente.') + '</p>' +
      '<div class="table-scroll"><table class="data-table"><thead><tr><th>Material</th><th>Dosis actual (kg/m³)</th><th>Nueva dosis</th></tr></thead><tbody>' +
      items.map(function(it){ return '<tr><td>' + esc(it.nombre) + '</td><td>' + fmt(it.pesoSeco, 2) + '</td><td><input type="text" inputmode="decimal" data-rec="' + it.k + '" value="' + it.pesoSeco + '"></td></tr>'; }).join('') +
      '</tbody></table></div>' +
      '<div class="pred-form"><div class="pp-field"><label>a/mc</label><input type="text" inputmode="decimal" id="rec-amc" value="' + esc(d.amcEfectiva || '') + '"></div></div>' +
      (conVersion ? '<div class="pp-field"><label>Motivo del cambio (obligatorio)</label><textarea id="rec-motivo" rows="2"></textarea></div>' : '') + '<p class="campo-error" id="rec-err"></p>',
    botones:[{label: conVersion ? 'Crear versión ' + ((d.version || 1) + 1) : 'Guardar receta', accion:function(c){
      var amc = parseNumero(c.querySelector('#rec-amc').value);
      if(!(amc >= 0.2 && amc <= 1.2)){ c.querySelector('#rec-err').textContent = 'a/mc entre 0.20 y 1.20.'; return false; }
      var nuevos = {}, error = '';
      c.querySelectorAll('[data-rec]').forEach(function(el){ var v = parseNumero(el.value); if(!(v >= 0)) error = 'Las cantidades deben ser números ≥ 0.'; nuevos[el.dataset.rec] = v; });
      if(error){ c.querySelector('#rec-err').textContent = error; return false; }
      var motivo = conVersion ? c.querySelector('#rec-motivo').value.trim() : '';
      if(conVersion && motivo.length < 5){ c.querySelector('#rec-err').textContent = 'Indicá el motivo del cambio.'; return false; }
      var cambios = [];
      var anterior = {version: d.version || 1, mix: JSON.parse(JSON.stringify(d.mix || [])), amcEfectiva: d.amcEfectiva, cvdTotal: d.cvdTotal};
      (d.mix || []).forEach(function(it, k){
        var nv = nuevos[k];
        if(nv === undefined || Math.abs(nv - n(it.pesoSeco)) < 1e-9) return;
        var factor = n(it.pesoSeco) ? nv / n(it.pesoSeco) : 0;
        cambios.push(it.nombre + ' ' + fmt(n(it.pesoSeco), 2) + ' → ' + fmt(nv, 2));
        ['volAbs', 'pesoSSS', 'pesoHumedo', 'batch', 'cvd'].forEach(function(f){ if(it[f] !== undefined) it[f] = n(it[f]) * factor; });
        it.pesoSeco = nv;
      });
      if(String(amc) !== String(d.amcEfectiva)) cambios.push('a/mc ' + d.amcEfectiva + ' → ' + amc);
      if(!cambios.length){ toast('Sin cambios'); return; }
      d.amcEfectiva = String(amc);
      d.cvdTotal = Number((d.mix || []).reduce(function(a, it){ return a + n(it.cvd); }, 0).toFixed(2));
      if(conVersion){
        d.versiones = (d.versiones || []).concat([Object.assign(anterior, {hasta: Date.now()})]);
        d.version = (d.version || 1) + 1;
        d.versiones[d.versiones.length - 1].motivo = motivo;
        d.versiones[d.versiones.length - 1].aVersion = d.version;
        (d.replicaObjs || []).forEach(function(r){ if(!r.elaboracion) r.version = d.version; });
      }
      d.editedAt = Date.now();
      save('sid10_disenos', disenos);
      registrarHistorial('Editó', 'Diseño', d.codigo + (conVersion ? ' · versión ' + d.version + ' · motivo: ' + motivo : '') + ' · ' + cambios.join('; '), {proyecto: proyectoNombre(d.proyectoId), ref: d.codigo});
      toast(conVersion ? 'Versión ' + d.version + ' creada' : 'Receta actualizada');
      renderAllDesignViews();
    }}]});
}

/* ---- RF-DIS-14: agregar réplica posterior (R3…) con la versión vigente ---- */
function agregarReplica(d){
  var reps = d.replicaObjs || (d.replicaObjs = []);
  if(reps.length >= 5){ toast('Un diseño tiene como máximo 5 réplicas'); return; }
  if(!confirm('¿Agregar la réplica R' + (reps.length + 1) + ' a ' + d.codigo + ' con la receta v' + (d.version || 1) + '?')) return;
  var nro = reps.reduce(function(m, r){ return Math.max(m, r.n || 0); }, 0) + 1;
  reps.push({n:nro, nombre:diseñoTitulo(d) + '-R' + nro, codigo:'', version:d.version || 1, repeticion:true});
  d.replicas = reps.length;
  save('sid10_disenos', disenos);
  registrarHistorial('Agregó', 'Réplica', d.codigo + ' · R' + nro + ' (repetición, v' + (d.version || 1) + ')', {proyecto: proyectoNombre(d.proyectoId), ref: d.codigo});
  toast('Réplica R' + nro + ' creada en Por elaborar');
  renderAllDesignViews();
}
