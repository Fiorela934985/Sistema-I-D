/* Sistema I+D — Entidad ROTURA: códigos correlativos, elaboración, cargas, formato y notificaciones */
'use strict';

/* ================= CÓDIGO CORRELATIVO (ID-XXX) — un contador independiente por Tipo (Cubos/Probetas) ================= */
var CODIGO_COUNTERS = load('sid10_codigo_counters', {Probetas:0, Cubos:0});
/* El contador nunca baja del código más alto que ya existe (incluidos los anulados): un código no se repite */
function maxCodigoExistente(tipo){
  var m = 0;
  roturaCargas.concat(typeof roturasAnuladas !== 'undefined' ? roturasAnuladas : []).forEach(function(c){
    if(((c.tipo === 'Cubos') ? 'Cubos' : 'Probetas') !== tipo) return;
    var x = /^ID-(\d+)$/.exec(c.codigo || ''); if(x) m = Math.max(m, Number(x[1]));
  });
  return m;
}
function nextCodigoRotura(tipo){
  tipo = (tipo === 'Cubos') ? 'Cubos' : 'Probetas';
  CODIGO_COUNTERS[tipo] = Math.max(CODIGO_COUNTERS[tipo]||0, maxCodigoExistente(tipo)) + 1;
  save('sid10_codigo_counters', CODIGO_COUNTERS);
  return 'ID-' + pad4(CODIGO_COUNTERS[tipo]);
}
function peekNextCodigoRotura(tipo){
  tipo = (tipo === 'Cubos') ? 'Cubos' : 'Probetas';
  return 'ID-' + pad4(Math.max(CODIGO_COUNTERS[tipo]||0, maxCodigoExistente(tipo)) + 1);
}

/* ================= ROTURAS ================= */
var TIPO_ROTURA_IMG_URL = 'assets/tipos-rotura.jpg';
var roturaCargas = load('sid10_rotura_cargas', []); // una fila por (réplica x edad)
function saveRoturaCargas(){ save('sid10_rotura_cargas', roturaCargas); }
var roturasAnuladas = load('sid_roturas_anuladas', []);
/* Id único de cada fila: tiempo + contador + azar (antes se repetía al crear varias filas en el mismo milisegundo) */
var roturaIdContador = 0;
function nextRoturaId(){ roturaIdContador++; return 'rc' + Date.now().toString(36) + '-' + roturaIdContador.toString(36) + '-' + Math.random().toString(36).slice(2, 7); }
/* Reparación de datos guardados con ids repetidos: cada fila recibe un id propio */
(function repararIdsRepetidos(){
  var vistos = {}, cambio = false;
  roturaCargas.forEach(function(c){ if(!c.id || vistos[c.id]){ c.id = nextRoturaId(); cambio = true; } vistos[c.id] = true; });
  if(cambio) saveRoturaCargas();
})();

function crearCargasParaDiseno(d, origen){
  // Un único Código por réplica — se repite en todas sus edades (días). El correlativo es independiente según Tipo (Cubos/Probetas).
  var creados = [];
  var tipoDiseno = d.tipoRotura || 'Probetas';
  (d.replicaObjs||[]).forEach(function(rep){
    var codigo = nextCodigoRotura(tipoDiseno);
    rep.codigo = codigo;
    (d.diasRotura||[]).forEach(function(dia){
      var fechaBaseISO = d.fechaElaboracionISO || dmyToISO(d.fecha) || todayISO();
      var fechaEnsayo = calcularFechaEnsayo(fechaBaseISO, dia);
      var tolH = toleranciaHoras(dia);
      var carga = {
        id: nextRoturaId(),
        codigo: codigo,
        tipo: d.tipoRotura || 'Probetas',
        disenoCodigoDiseno: d.codigo,
        replicaNombre: rep.nombre,
        producto: rep.nombre,
        proyecto: proyectoNombre(d.proyectoId),
        iteracion: iteracionNombre(d.iteracionId),
        aCargoDe: d.aCargoDe || '',
        fechaElaboracion: d.fechaElaboracionISO || dmyToISO(d.fecha) || todayISO(),
        horaElaboracion: d.horaElaboracion || '',
        dia: dia,
        fechaEnsayo: fechaEnsayo,
        toleranciaHoras: tolH,
        correoEnviado: false,
        origen: origen,
        horaEnsayo:'', a1:'', a2:'', a3:'',
        m1kN:'', m2kN:'', m3kN:'', m1kg:'', m2kg:'', m3kg:'',
        tipoRoturaM1:'', tipoRoturaM2:'', tipoRoturaM3:'',
        evid1:'', evid2:'', evid3:'',
        m1kgcm2:'', m2kgcm2:'', m3kgcm2:'', promedio:'', coefVar:'', desvest:'',
        comentarios:'',
        estado:'pendiente'
      };
      roturaCargas.push(carga);
      creados.push(carga);
    });
  });
  saveRoturaCargas();
  return creados;
}

/* ---- Subtabs de Roturas ---- */
function showRoturasSub(name){
  if(name === 'registrar'){ abrirRegistroManual(); return; }
  document.querySelectorAll('#roturas-subtabs .subtab').forEach(function(b){ b.classList.toggle('active', b.dataset.rosub === name); });
  document.getElementById('ro-sub-pendientes').style.display = name === 'pendientes' ? 'block' : 'none';
  document.getElementById('ro-sub-registrar').style.display = name === 'registrar' ? 'block' : 'none';
  document.getElementById('ro-sub-formato').style.display = name === 'formato' ? 'block' : 'none';
  if(name === 'formato') renderRoturasFormato();
  if(name === 'pendientes') renderRoturasPendientes();
  if(name === 'registrar') {
    refreshAllProyectoSelects(); rebuildRoDisenoSelect(); renderRoCodigoPreview(); renderRoFechasPreview();
    var aCargo = document.getElementById('ro-acargode');
    if(!aCargo.value && usuarioActual) aCargo.value = usuarioActual.nombre || usuarioActual.usuario;
  }
}
document.querySelectorAll('#roturas-subtabs .subtab').forEach(function(btn){
  btn.addEventListener('click', function(){ showRoturasSub(btn.dataset.rosub); });
});

function renderRoturasAll(){
  document.getElementById('roturas-count').textContent = roturaCargas.length + ' registros';
  renderRoturasPendientes();
  renderRoturasFormato();
  updateNavBadges();
}

/* ---- Registrar (Momento 1) ---- */
function rebuildRoDisenoSelect(){
  var sel = document.getElementById('ro-diseno');
  var proyId = document.getElementById('ro-proyecto').value;
  var list = disenos.filter(function(d){ return !proyId || d.proyectoId === proyId; });
  sel.innerHTML = '<option value="">Elegí un diseño…</option>' + list.map(function(d,idx){
    return '<option value="'+disenos.indexOf(d)+'">'+esc(diseñoTitulo(d))+'</option>';
  }).join('');
  rebuildRoReplicaSelect();
}
document.getElementById('ro-diseno').addEventListener('change', function(){
  rebuildRoReplicaSelect();
  var didx = this.value;
  var d = didx !== '' ? disenos[Number(didx)] : null;
  var tipoEl = document.getElementById('ro-tipo-display');
  if(d){
    var fISO = d.fechaElaboracionISO || dmyToISO(d.fecha);
    if(fISO) document.getElementById('ro-fecha-elab').value = fISO;
    if(d.horaElaboracion) document.getElementById('ro-hora-elab').value = d.horaElaboracion;
    tipoEl.value = (d.tipoRotura || 'Probetas') === 'Cubos' ? 'Cubo' : 'Probeta';
    renderRoFechasPreview();
  } else {
    tipoEl.value = '';
  }
  renderRoCodigoPreview();
});
function rebuildRoReplicaSelect(){
  var sel = document.getElementById('ro-replica');
  var didx = document.getElementById('ro-diseno').value;
  var d = didx !== '' ? disenos[Number(didx)] : null;
  var reps = d && d.replicaObjs ? d.replicaObjs : [];
  sel.innerHTML = '<option value="">Elegí la réplica…</option>' + reps.map(function(r,ri){
    return '<option value="'+ri+'">'+esc(r.nombre)+'</option>';
  }).join('');
}
function tipoDeDisenoActivo(){
  var didx = document.getElementById('ro-diseno').value;
  var d = didx !== '' ? disenos[Number(didx)] : null;
  return d ? (d.tipoRotura || 'Probetas') : 'Probetas';
}
function renderRoCodigoPreview(){
  var el = document.getElementById('ro-codigo-preview');
  var didx = document.getElementById('ro-diseno').value;
  var repIdx = document.getElementById('ro-replica').value;
  if(didx === ''){ el.innerHTML = ''; return; }
  var tipo = tipoDeDisenoActivo();
  var repCodigoExistente = '';
  if(didx !== '' && repIdx !== ''){
    var d = disenos[Number(didx)];
    var rep = d && d.replicaObjs ? d.replicaObjs[Number(repIdx)] : null;
    if(rep && rep.codigo) repCodigoExistente = rep.codigo;
  }
  var codigo = repCodigoExistente || peekNextCodigoRotura(tipo);
  el.innerHTML = '<div class="codigo-preview-destacado"><span class="cpd-label">'+(repCodigoExistente?'Código de esta réplica':'Código a asignar')+'</span><span class="cpd-codigo">'+codigo+'</span></div>';
}
document.getElementById('ro-diseno').addEventListener('change', renderRoCodigoPreview);
document.getElementById('ro-replica').addEventListener('change', renderRoCodigoPreview);

function renderRoFechasPreview(){
  var fechaElab = document.getElementById('ro-fecha-elab').value;
  var dias = getDiasSeleccionados('ro');
  var wrap = document.getElementById('ro-fechas-preview');
  if(!fechaElab || !dias.length){ wrap.innerHTML = ''; return; }
  wrap.innerHTML = dias.map(function(dia){
    var fe = calcularFechaEnsayo(fechaElab, dia);
    var tol = toleranciaHoras(dia);
    return '<div class="ntp-tolerancia-box">Día '+dia+' → Fecha de Ensayo <b>'+isoToDMY(fe)+'</b> · Tolerancia ±<b>'+tol+' h</b></div>';
  }).join(' ');
}
['ro-fecha-elab','ro-hora-elab'].forEach(function(id){ document.getElementById(id).addEventListener('input', renderRoFechasPreview); });
document.querySelectorAll('.ro-dia-check').forEach(function(c){ c.addEventListener('change', renderRoFechasPreview); });

document.getElementById('ro-registrar-btn').addEventListener('click', function(){
  if(!exigir('roturas:registrar')) return;
  var didx = document.getElementById('ro-diseno').value;
  var repIdx = document.getElementById('ro-replica').value;
  var fechaElab = document.getElementById('ro-fecha-elab').value;
  var horaElab = document.getElementById('ro-hora-elab').value;
  var dias = getDiasSeleccionados('ro');
  var aCargoDe = document.getElementById('ro-acargode').value.trim();
  if(didx === '' || repIdx === '' || !fechaElab || !dias.length){
    toast('Completá diseño, réplica, fecha de elaboración y días de rotura');
    return;
  }
  var d = disenos[Number(didx)];
  var tipo = d.tipoRotura || 'Probetas';
  var rep = d.replicaObjs[Number(repIdx)];
  var codigo = rep.codigo || nextCodigoRotura(tipo);
  if(!rep.codigo){ rep.codigo = codigo; save('sid10_disenos', disenos); }
  var creados = [];
  dias.forEach(function(dia){
    var fechaEnsayo = calcularFechaEnsayo(fechaElab, dia);
    var carga = {
      id: nextRoturaId(), codigo: codigo, tipo: tipo,
      disenoCodigoDiseno: d.codigo, replicaNombre: rep.nombre,
      producto: rep.nombre, proyecto: proyectoNombre(d.proyectoId), iteracion: iteracionNombre(d.iteracionId),
      aCargoDe: aCargoDe, fechaElaboracion: fechaElab, horaElaboracion: horaElab,
      dia: dia, fechaEnsayo: fechaEnsayo, toleranciaHoras: toleranciaHoras(dia), correoEnviado:false,
      origen:'manual', horaEnsayo:'', a1:'',a2:'',a3:'', m1kN:'',m2kN:'',m3kN:'',m1kg:'',m2kg:'',m3kg:'',
      tipoRoturaM1:'',tipoRoturaM2:'',tipoRoturaM3:'', evid1:'',evid2:'',evid3:'',
      m1kgcm2:'',m2kgcm2:'',m3kgcm2:'',promedio:'',coefVar:'',desvest:'', comentarios:'', estado:'pendiente'
    };
    roturaCargas.push(carga);
    creados.push(carga);
  });
  saveRoturaCargas();
  registrarHistorial('Registró', 'Rotura', 'Elaboración ' + codigo + ' · ' + rep.nombre + ' · días ' + dias.join(', '), {proyecto: proyectoNombre(d.proyectoId), ref: d.codigo});
  document.getElementById('ro-acargode').value = '';
  toast('Registrado correctamente — códigos: ' + creados.map(function(c){ return c.codigo; }).join(', '));
  renderRoturasAll();
  showRoturasSub('pendientes');
});

/* ---- Pendientes ---- */
/* Pendientes agrupadas por urgencia (vencidas / hoy / próximas) con filtro por chips. */
var roturasFiltroEstado = 'todas';
var GRUPOS_PENDIENTES = [
  {id:'vencidas', titulo:'Atrasadas', desc:'La ventana de tolerancia ya pasó'},
  {id:'hoy', titulo:'Para hoy', desc:'La ventana ya abrió o abre hoy'},
  {id:'proximas', titulo:'Próximas', desc:'Programadas para los próximos días'}
];
function grupoPendiente(c){ return cargaAtrasada(c) ? 'vencidas' : (cargaActiva(c) ? 'hoy' : 'proximas'); }
function renderRoturasPendientes(){
  var wrap = document.getElementById('roturas-pendientes-list');
  // Con un proyecto en curso se muestran solo sus roturas (el chip permite ver las de todos)
  var soloProyecto = proyectoFlujo && roturasSoloProyecto;
  var chipProyecto = proyectoFlujo ? '<button class="filtro-chip'+(soloProyecto?' on':'')+'" data-solo-proyecto>'+(soloProyecto ? 'Solo '+esc(proyectoFlujo) : 'Todos los proyectos')+'</button>' : '';
  var pend = roturaCargas.filter(function(c){ return c.estado === 'pendiente' && !c.anulada && (!soloProyecto || c.proyecto === proyectoFlujo); }).sort(function(a,b){ return (a.fechaEnsayo||'').localeCompare(b.fechaEnsayo||''); });
  if(!pend.length){ wrap.innerHTML = (chipProyecto ? '<div class="filtro-chips">'+chipProyecto+'</div>' : '') + '<div class="empty-note">No hay roturas pendientes'+(soloProyecto ? ' en este proyecto' : '')+'.</div>'; return; }
  var todayStr = todayISO();
  var porGrupo = {vencidas:[], hoy:[], proximas:[]};
  pend.forEach(function(c){ porGrupo[grupoPendiente(c)].push(c); });
  var chips = '<div class="filtro-chips">' + chipProyecto + [{id:'todas', titulo:'Todas', n:pend.length}].concat(GRUPOS_PENDIENTES.map(function(g){ return {id:g.id, titulo:g.titulo, n:porGrupo[g.id].length}; }))
    .map(function(f){ return '<button class="filtro-chip f-'+f.id+(roturasFiltroEstado===f.id?' on':'')+'" data-filtro-pend="'+f.id+'">'+f.titulo+' <b>'+f.n+'</b></button>'; }).join('') + '</div>';
  var grupos = GRUPOS_PENDIENTES.filter(function(g){ return (roturasFiltroEstado === 'todas' || roturasFiltroEstado === g.id) && porGrupo[g.id].length; });
  wrap.innerHTML = chips + (grupos.length ? grupos.map(function(g){
    return '<div class="pend-grupo g-'+g.id+'"><div class="pend-grupo-head"><h4>'+g.titulo+' <span>'+porGrupo[g.id].length+'</span></h4><small>'+g.desc+'</small></div>' +
      porGrupo[g.id].map(filaPendienteHtml).join('') + '</div>';
  }).join('') : '<div class="empty-note">No hay roturas en este grupo.</div>');
}
function filaPendienteHtml(c){
  var d = disenos.filter(function(x){ return x.codigo === c.disenoCodigoDiseno; })[0];
  var sem = d ? semaforoDotHtml(semaforoDiseno(d), 'Semáforo del diseño') : '';
  var atrasada = cargaAtrasada(c), activa = cargaActiva(c), sinHora = !c.horaElaboracion;
  var badge = atrasada ? '<span class="pendiente-badge vencido">Atrasada</span>' : (activa ? '<span class="pendiente-badge hoy">Hoy</span>' : '');
  var tipoEsProbeta = (c.tipo||'Probetas') !== 'Cubos';
  var activacion = fechaCorta(diaDeActivacion(c));
  var accion = sinHora
    ? '<button class="btn-add ghost" data-act="poner-hora" data-codigo="'+esc(c.disenoCodigoDiseno)+'">Falta hora de elaboración</button>'
    : '<button class="btn-add" data-perm="roturas:registrar" data-act="registrar-carga" data-id="'+c.id+'"'+(activa ? '' : ' disabled title="Se activa el '+activacion+'"')+'>'+(activa ? 'Registrar rotura' : 'Se activa el '+activacion)+'</button>';
  return '<div class="pendiente-row g-'+grupoPendiente(c)+'">' +
    sem +
    '<div class="id-card"><span class="id-card-tipo">'+(tipoEsProbeta?'Probeta':'Cubo')+'</span><span class="id-card-codigo">'+c.codigo+'</span></div>' +
    '<div class="pr-info">' +
      '<h5>'+esc(c.replicaNombre)+' <span class="pr-dia">'+c.dia+' d</span> '+chipNoConformeHtml(c)+'</h5>' +
      '<span>'+esc(c.proyecto||'-')+' · Ventana '+esc(textoVentana(c))+' · ±'+c.toleranciaHoras+' h'+(c.aCargoDe ? ' · '+esc(c.aCargoDe) : '')+'</span>' +
    '</div>' +
    badge +
    '<button class="btn-icon" data-act="etiquetas" data-codigo="'+esc(c.disenoCodigoDiseno)+'" data-proyecto="'+esc(c.proyecto||'')+'" title="Imprimir etiquetas">'+TAG_ICON+'</button>' +
    accion +
  '</div>';
}
document.getElementById('roturas-pendientes-list').addEventListener('click', function(e){
  var filtro = e.target.closest('[data-filtro-pend]');
  if(filtro){ roturasFiltroEstado = filtro.dataset.filtroPend; renderRoturasPendientes(); return; }
  var etq = e.target.closest('[data-act="etiquetas"]');
  if(etq){ if(etq.dataset.codigo) abrirEtiquetas(etq.dataset.codigo); else abrirPanelEtiquetas(etq.dataset.proyecto); return; }
  var hora = e.target.closest('[data-act="poner-hora"]');
  if(hora){ abrirFlujoDiseno(disenoPorCodigo(hora.dataset.codigo)); return; }
  var btn = e.target.closest('[data-act="registrar-carga"]');
  if(!btn || btn.disabled) return;
  if(!exigir('roturas:registrar')) return;
  openRoturaCargaModal(btn.dataset.id);
});


function renderPendientesHoyInicio(){
  var wrap = document.getElementById('pendientes-hoy-inicio');
  var todayStr = todayISO();
  var lista = roturaCargas.filter(function(c){ return c.estado === 'pendiente' && c.fechaEnsayo === todayStr; }).sort(function(a,b){ return (a.dia-b.dia) || (a.codigo||'').localeCompare(b.codigo||''); });
  var badgeEl = document.getElementById('rh-count-badge');
  if(badgeEl) badgeEl.textContent = lista.length;
  if(!lista.length){ wrap.innerHTML = '<div class="empty-note">Hoy no toca romper ninguna probeta o cubo.</div>'; return; }
  wrap.innerHTML = lista.map(function(c, idx){
    var esUrgente = c.dia === 1;
    var tipoEsProbeta = (c.tipo||'Probetas') !== 'Cubos';
    var accentClass = esUrgente ? 'accent-rojo' : 'accent-dorado';
    return '<div class="ih-card '+accentClass+'">' +
      '<div class="id-card"><span class="id-card-tipo">'+(tipoEsProbeta?'Probeta':'Cubo')+'</span><span class="id-card-codigo">'+c.codigo+'</span></div>' +
      '<div class="ih-main">' +
        '<span class="ih-nombre">'+esc(c.replicaNombre)+' (Día '+c.dia+')</span>' +
        '<div class="ih-badges" style="margin-top:6px;">' +
          (esUrgente ? '<span class="ih-badge urgente">Urgente</span>' : '<span class="ih-badge hoy">Hoy</span>') +
        '</div>' +
      '</div>' +
      '<button class="btn-add" data-perm="roturas:registrar" data-act="registrar-carga-inicio" data-id="'+c.id+'">Registrar Rotura '+REGISTRAR_ICON+'</button>' +
    '</div>';
  }).join('');
}
document.getElementById('pendientes-hoy-inicio').addEventListener('click', function(e){
  var btn = e.target.closest('[data-act="registrar-carga-inicio"]');
  if(!btn) return;
  showPanel('roturas');
  openRoturaCargaModal(btn.dataset.id);
});
document.getElementById('btn-ver-todos-disenos-inicio').addEventListener('click', function(){ showPanel('disenos'); showSubTab('historico'); });

/* ---- Formato de Roturas I+D (tabla grande, 2 momentos) ---- */
function calcKgCm2(cargaKgVal, areaVal){
  var carga = n(cargaKgVal), area = n(areaVal);
  if(!carga || !area) return '';
  return (carga/area).toFixed(2);
}
function statsFromValues(vals){
  var nums = vals.map(n).filter(function(v){ return v>0; });
  if(!nums.length) return {promedio:'', coefVar:'', desvest:''};
  var prom = nums.reduce(function(a,b){return a+b;},0)/nums.length;
  var variance = nums.reduce(function(a,b){ return a + Math.pow(b-prom,2); },0)/nums.length;
  var desv = Math.sqrt(variance);
  var cv = prom ? (desv/prom*100) : 0;
  return {promedio:prom.toFixed(2), coefVar:cv.toFixed(2)+'%', desvest:desv.toFixed(2)};
}
function recalcCarga(c){
  c.m1kgcm2 = calcKgCm2(c.m1kg, c.a1);
  c.m2kgcm2 = calcKgCm2(c.m2kg, c.a2);
  c.m3kgcm2 = calcKgCm2(c.m3kg, c.a3);
  var st = statsFromValues([c.m1kgcm2, c.m2kgcm2, c.m3kgcm2]);
  c.promedio = st.promedio; c.coefVar = st.coefVar; c.desvest = st.desvest;
  if(c.m1kgcm2 && c.m2kgcm2 && c.m3kgcm2) c.estado = 'completado';
}

/* La tabla del Formato de Roturas I+D vive en formatos.js (Fase 4) */

/* ---- Registrar la Rotura (Momento 2, panel modal) ---- */
var roturaCargaModalId = null;
function kgfPorKn(){ return Lab.configNum('kn_a_kgf') || 101.9716; }
function cvAlerta(){ return Lab.configNum('cv_alerta_pct') || 10; }
function estadoVentanaHtml(c, fechaISO, hora){
  var v = ventanaDeCarga(c);
  if(!v) return '<span class="chip-falta atrasado">Falta la hora de elaboración: no se puede calcular la ventana</span>';
  var txt = 'Ventana ' + textoVentana(c) + ' · ±' + v.toleranciaHoras + ' h';
  if(!fechaISO || !hora) return '<span class="chip-edad">' + esc(txt) + '</span>';
  var t = new Date(fechaISO + 'T' + hora).getTime();
  var dentro = t >= v.desde.getTime() && t <= v.hasta.getTime();
  return '<span class="' + (dentro ? 'chip-ok' : 'chip-falta atrasado') + '">' + esc(txt) + (dentro ? ' · dentro' : ' · fuera de la ventana: se abrirá un trabajo no conforme') + '</span>';
}
function openRoturaCargaModal(id){
  roturaCargaModalId = id;
  var c = roturaCargas.filter(function(x){ return x.id === id; })[0];
  if(!c) return;
  var d = disenos.filter(function(x){ return x.codigo === c.disenoCodigoDiseno; })[0];
  var areaDef = String(Lab.configNum('area_defecto_cm2') || 83);
  document.getElementById('rotura-carga-title').textContent = 'Registrar la rotura · ' + c.dia + ' d';
  document.getElementById('rotura-carga-recap').innerHTML =
    '<div class="rc-recap-info"><span class="rc-recap-nombre">'+(d?esc(diseñoTitulo(d)):esc(c.producto))+'</span><span class="rc-recap-meta">'+esc(c.replicaNombre)+' · '+esc(c.proyecto || '')+' · elaborada '+isoToDMY(c.fechaElaboracion)+' '+esc(c.horaElaboracion || '')+'</span></div>' +
    '<div class="rc-recap-codigo">'+c.codigo+'</div>';
  function especimenBlock(mIdx, label){
    var areaKey = 'a'+mIdx, kNKey = 'm'+mIdx+'kN', kgKey = 'm'+mIdx+'kg', tipoKey = 'tipoRoturaM'+mIdx, evidKey = 'evid'+mIdx;
    return '<div class="m-especimen-block">' +
      '<h5>'+label+' <span class="mc-res" id="mc-res-'+mIdx+'"></span></h5>' +
      '<div class="m-especimen-grid">' +
        '<div class="field-mini"><label>Área (cm²)</label><input type="text" inputmode="decimal" id="mc-'+areaKey+'" value="'+esc(c[areaKey]||areaDef)+'"></div>' +
        '<div class="field-mini"><label>Carga (kN)</label><input type="text" inputmode="decimal" id="mc-'+kNKey+'" value="'+esc(c[kNKey])+'"></div>' +
        '<div class="field-mini"><label>Carga (kg)</label><input type="text" inputmode="decimal" id="mc-'+kgKey+'" value="'+esc(c[kgKey])+'"></div>' +
        '<div class="field-mini"><label>Tipo de rotura</label><select id="mc-'+tipoKey+'">' +
          ['','Tipo 1','Tipo 2','Tipo 3','Tipo 4','Tipo 5','Tipo 6'].map(function(t){ return '<option'+(c[tipoKey]===t?' selected':'')+'>'+t+'</option>'; }).join('') +
        '</select></div>' +
        '<div class="field-mini"><label>Evidencia</label><div class="evidencia-drop" id="mc-drop-'+mIdx+'" data-evid-key="'+(c[evidKey]||'')+'">'+(c[evidKey]?'Cargando…':'Subir foto')+'<input type="file" accept="image/*" capture="environment" id="mc-file-'+mIdx+'" style="display:none;"></div></div>' +
      '</div>' +
    '</div>';
  }
  document.getElementById('rotura-carga-body').innerHTML =
    '<div id="mc-ventana" class="mc-ventana"></div>' +
    '<div class="form-row">' +
      '<div class="field-mini"><label>Fecha de ensayo</label><input type="date" id="mc-fechaEnsayoReal" min="'+esc(c.fechaElaboracion || '')+'" value="'+esc(c.fechaEnsayoReal || todayISO())+'"></div>' +
      '<div class="field-mini"><label>Hora de ensayo</label><div class="hora-celda"><input type="time" id="mc-horaEnsayo" value="'+esc(c.horaEnsayo)+'"><button type="button" class="btn-ahora" id="mc-ahora">Ahora</button></div></div>' +
      '<div class="field-mini" style="flex:1;"><label>Equipo usado</label>'+campoEquipoHtml('mc-equipo', c.equipo)+'</div>' +
    '</div>' +
    '<div class="mc-unidad-toggle">' +
      '<span class="mc-unidad-label">Unidad de carga:</span>' +
      '<label class="pp-check-inline"><input type="radio" name="mc-unidad" value="kg" checked> kg</label>' +
      '<label class="pp-check-inline"><input type="radio" name="mc-unidad" value="kn"> kN</label>' +
      '<span class="nota-sm">1 kN = '+kgfPorKn()+' kgf</span>' +
      '<button type="button" class="btn-add ghost" id="mc-toggle-guia">Guía de tipos de rotura (1–6)</button>' +
    '</div>' +
    '<div id="mc-guia-imagen" style="display:none;margin-bottom:16px;text-align:center;">' +
      '<img src="'+TIPO_ROTURA_IMG_URL+'" alt="Guía de tipos de fractura NTP 339.034" style="max-width:420px;width:100%;border:1px solid var(--line);border-radius:6px;">' +
    '</div>' +
    especimenBlock(1,'M1') + especimenBlock(2,'M2') + especimenBlock(3,'M3') +
    '<div id="mc-calculos" class="mc-calculos"></div>' +
    '<div class="field-mini"><label>Comentarios</label><input type="text" id="mc-comentarios" value="'+esc(c.comentarios)+'"></div>';
  document.getElementById('mc-toggle-guia').addEventListener('click', function(){
    var img = document.getElementById('mc-guia-imagen');
    img.style.display = img.style.display !== 'none' ? 'none' : 'block';
  });
  document.getElementById('mc-ahora').addEventListener('click', function(){
    var t = new Date();
    document.getElementById('mc-horaEnsayo').value = String(t.getHours()).padStart(2,'0') + ':' + String(t.getMinutes()).padStart(2,'0');
    document.getElementById('mc-fechaEnsayoReal').value = todayISO();
    actualizarCalculosRotura();
  });
  ['mc-fechaEnsayoReal','mc-horaEnsayo'].forEach(function(idEl){
    document.getElementById(idEl).addEventListener('input', actualizarCalculosRotura);
    document.getElementById(idEl).addEventListener('change', actualizarCalculosRotura);
  });

  /* Unidad kN/kg: se escribe en una y la otra se convierte sola (1 kN = 101.9716 kgf, de Ensayos y métodos) */
  function aplicarUnidadBloqueo(unidad){
    [1,2,3].forEach(function(mIdx){
      document.getElementById('mc-m'+mIdx+'kg').disabled = (unidad === 'kn');
      document.getElementById('mc-m'+mIdx+'kN').disabled = (unidad === 'kg');
    });
  }
  [1,2,3].forEach(function(mIdx){
    var kgEl = document.getElementById('mc-m'+mIdx+'kg');
    var knEl = document.getElementById('mc-m'+mIdx+'kN');
    kgEl.addEventListener('input', function(){
      if(kgEl.disabled) return;
      var v = Number(kgEl.value);
      knEl.value = v ? (v/kgfPorKn()).toFixed(2) : '';
      actualizarCalculosRotura();
    });
    knEl.addEventListener('input', function(){
      if(knEl.disabled) return;
      var v = Number(knEl.value);
      kgEl.value = v ? (v*kgfPorKn()).toFixed(2) : '';
      actualizarCalculosRotura();
    });
    document.getElementById('mc-a'+mIdx).addEventListener('input', actualizarCalculosRotura);
  });
  document.querySelectorAll('input[name="mc-unidad"]').forEach(function(radio){
    radio.addEventListener('change', function(){ aplicarUnidadBloqueo(this.value); });
  });
  aplicarUnidadBloqueo('kg');

  [1,2,3].forEach(function(mIdx){
    var dropEl = document.getElementById('mc-drop-'+mIdx);
    var fileEl = document.getElementById('mc-file-'+mIdx);
    var existingKey = dropEl.dataset.evidKey;
    if(existingKey){
      loadEvidenciaURL(existingKey).then(function(url){
        if(url) dropEl.innerHTML = '<img src="'+url+'"><br>Cambiar foto';
        else dropEl.innerHTML = 'Subir foto';
        dropEl.appendChild(fileEl);
      }).catch(function(){ dropEl.innerHTML = 'Subir foto'; dropEl.appendChild(fileEl); });
    }
    dropEl.addEventListener('click', function(ev){ if(ev.target !== fileEl) fileEl.click(); });
    fileEl.addEventListener('change', function(){
      var f = fileEl.files[0];
      if(!f) return;
      var url = URL.createObjectURL(f);
      dropEl.innerHTML = 'Guardando…';
      var newKey = c.id + '_m' + mIdx;
      saveEvidenciaBlob(newKey, f).then(function(){
        dropEl.dataset.evidKey = newKey;
        dropEl.innerHTML = '<img src="'+url+'"><br>Cambiar foto';
        dropEl.appendChild(fileEl);
      });
    });
  });
  actualizarCalculosRotura();
  document.getElementById('rotura-carga-modal').classList.add('show');
}
/* Cálculos automáticos: kg/cm² por M, promedio f'c, desviación estándar y CV (con alerta si el CV es alto) */
function actualizarCalculosRotura(){
  var c = roturaCargas.filter(function(x){ return x.id === roturaCargaModalId; })[0];
  if(!c) return;
  var vals = [1,2,3].map(function(mIdx){
    var v = calcKgCm2(document.getElementById('mc-m'+mIdx+'kg').value, document.getElementById('mc-a'+mIdx).value);
    document.getElementById('mc-res-'+mIdx).textContent = v ? v + ' kg/cm²' : '';
    return v;
  });
  var st = statsFromValues(vals);
  var cv = parseFloat(st.coefVar);
  document.getElementById('mc-calculos').innerHTML = st.promedio
    ? '<span>f\'c promedio <b>'+st.promedio+' kg/cm²</b></span><span>Desv. estándar <b>'+st.desvest+'</b></span><span class="'+(cv > cvAlerta() ? 'cv-alto' : '')+'">CV <b>'+st.coefVar+'</b>'+(cv > cvAlerta() ? ' · alto (más de '+cvAlerta()+' %)' : '')+'</span>'
    : '';
  document.getElementById('mc-ventana').innerHTML = estadoVentanaHtml(c, document.getElementById('mc-fechaEnsayoReal').value, document.getElementById('mc-horaEnsayo').value);
}
/* Regla 6: al completarse una rotura, fuera de la ventana abre un trabajo no conforme y un CV alto, una alerta */
function evaluarRoturaCompletada(c){
  var avisos = [];
  var v = ventanaDeCarga(c), t = new Date((c.fechaEnsayoReal || todayISO()) + 'T' + (c.horaEnsayo || '00:00')).getTime();
  if(v && c.horaEnsayo && (t < v.desde.getTime() || t > v.hasta.getTime())){
    var tnc = abrirTncAutomatico('fuera-ventana', 'Ensayada el ' + isoToDMY(c.fechaEnsayoReal || todayISO()) + ' ' + c.horaEnsayo + '; ventana ' + textoVentana(c) + ' (±' + v.toleranciaHoras + ' h)', c);
    c.fueraVentana = true;
    avisos.push('fuera de la ventana: se abrió ' + tnc.codigo);
  }
  if(parseFloat(c.coefVar) > cvAlerta()){
    var al = abrirTncAutomatico('cv-alto', 'CV ' + c.coefVar + ' (alerta sobre ' + cvAlerta() + ' %) · M1 ' + (c.m1kgcm2 || '-') + ', M2 ' + (c.m2kgcm2 || '-') + ', M3 ' + (c.m3kgcm2 || '-'), c);
    avisos.push('CV alto: alerta ' + al.codigo);
  }
  return avisos;
}
document.getElementById('rotura-carga-close').addEventListener('click', function(){ document.getElementById('rotura-carga-modal').classList.remove('show'); });
document.getElementById('rotura-carga-cancel').addEventListener('click', function(){ document.getElementById('rotura-carga-modal').classList.remove('show'); });
document.getElementById('rotura-carga-save').addEventListener('click', function(){
  var c = roturaCargas.filter(function(x){ return x.id === roturaCargaModalId; })[0];
  if(!c) return;
  if(!exigir('roturas:registrar')) return;
  var d = disenoPorCodigo(c.disenoCodigoDiseno);
  if(!exigirEnsayos([ensayoDeRotura(c.tipo)], d, c.aCargoDeId)) return;
  if(!c.horaElaboracion){ toast('Falta la hora de elaboración de ' + c.replicaNombre + ': complétala en el flujo del diseño'); return; }
  if(c.estado === 'pendiente' && !cargaActiva(c)){ toast('Esta rotura se activa el ' + fechaCorta(diaDeActivacion(c))); return; }
  var fechaReal = document.getElementById('mc-fechaEnsayoReal').value;
  var horaReal = document.getElementById('mc-horaEnsayo').value;
  var hayCargas = [1,2,3].some(function(m){ return document.getElementById('mc-m'+m+'kg').value || document.getElementById('mc-m'+m+'kN').value; });
  var eqSel = document.getElementById('mc-equipo').value.trim(), eqInv = Inventario.equipo(eqSel);
  if(hayCargas && Inventario.conectado() && !eqSel){ toast('Elegí el equipo usado'); return; }
  if(eqInv && !eqInv.vigente){ toast(eqInv.codigo + ': ' + eqInv.motivo.toLowerCase() + '. No se puede usar.'); return; }
  if(hayCargas && (!fechaReal || !horaReal)){ toast('Indicá la fecha y la hora de ensayo'); return; }
  var antes = {promedio:c.promedio, horaEnsayo:c.horaEnsayo, fechaEnsayoReal:c.fechaEnsayoReal || ''};
  var eraCompleta = c.estado === 'completado';
  c.fechaEnsayoReal = fechaReal;
  c.horaEnsayo = horaReal;
  c.equipo = document.getElementById('mc-equipo').value.trim();
  c.comentarios = document.getElementById('mc-comentarios').value;
  [1,2,3].forEach(function(mIdx){
    c['a'+mIdx] = document.getElementById('mc-a'+mIdx).value;
    c['m'+mIdx+'kN'] = document.getElementById('mc-m'+mIdx+'kN').value;
    c['m'+mIdx+'kg'] = document.getElementById('mc-m'+mIdx+'kg').value;
    c['tipoRoturaM'+mIdx] = document.getElementById('mc-tipoRoturaM'+mIdx).value;
    var dropEl = document.getElementById('mc-drop-'+mIdx);
    if(dropEl.dataset.evidKey) c['evid'+mIdx] = dropEl.dataset.evidKey;
  });
  recalcCarga(c);
  /* Regla 3: cada resultado guarda su contexto (analista, método y versión, fecha y hora, equipo y lote) */
  var e = Lab.ensayo(ensayoDeRotura(c.tipo));
  c.contexto = {analista_id:usuarioActual.id, analista:usuarioActual.nombre || usuarioActual.usuario, metodo:e ? e.metodo : '', version:e ? e.version : '',
    registrado_en:new Date().toISOString(), equipo:c.equipo, lote:c.lote || ''};
  var avisos = c.estado === 'completado' && !eraCompleta ? evaluarRoturaCompletada(c) : [];
  saveRoturaCargas();
  sincronizarEvidenciasRoturas();
  registrarHistorial(eraCompleta ? 'Editó' : 'Registró', 'Rotura', c.codigo + ' · ' + c.replicaNombre + ' · ' + c.dia + ' d' + (c.promedio ? ' · ' + c.promedio + ' kg/cm²' : ''),
    {codigo:c.codigo, proyecto:c.proyecto, ref:c.disenoCodigoDiseno, antes:eraCompleta ? antes : undefined, despues:{promedio:c.promedio, cv:c.coefVar, horaEnsayo:c.horaEnsayo, equipo:c.equipo}});
  document.getElementById('rotura-carga-modal').classList.remove('show');
  toast('Rotura registrada — ' + c.codigo + (avisos.length ? ' · ' + avisos.join(' · ') : ''));
  refrescarTodoFlujo(d);
  updateNavBadges();
});

/* ---- Bell / notificaciones ---- */
function updateNavBadges(){
  var todayStr = todayISO();
  var countBacklog = roturaCargas.filter(function(c){ return c.estado==='pendiente' && !c.anulada && c.fechaEnsayo <= todayStr; }).length;
  var badge = document.getElementById('nav-roturas-badge');
  badge.style.display = countBacklog ? 'inline-block' : 'none';
  badge.textContent = countBacklog;
  if(typeof actualizarMenuSecciones === 'function') actualizarMenuSecciones();
  var listaHoy = roturaCargas.filter(function(c){ return c.estado==='pendiente' && c.fechaEnsayo === todayStr; });
  var vencidas = roturaCargas.filter(function(c){ return c.estado==='pendiente' && c.fechaEnsayo < todayStr; });
  var notifOn = typeof settings === 'undefined' || settings.notif !== false;
  document.getElementById('nav-bell-dot').style.display = (notifOn && (listaHoy.length || vencidas.length)) ? 'block' : 'none';
  var bellList = document.getElementById('bell-list');
  if(!notifOn){ bellList.innerHTML = '<div class="bell-empty">Las notificaciones están desactivadas en Ajustes.</div>'; return; }
  var html = listaHoy.map(function(c){
    return '<div class="bell-item"><b>'+c.codigo+' · '+esc(c.replicaNombre)+'</b><span>'+esc(c.proyecto||'-')+' · día '+c.dia+' · hoy '+isoToDMY(c.fechaEnsayo)+'</span></div>';
  }).join('');
  if(vencidas.length){
    html += '<div class="bell-item bell-vencida"><b>'+vencidas.length+' rotura'+(vencidas.length===1?'':'s')+' vencida'+(vencidas.length===1?'':'s')+'</b><span>Pendientes con fecha de ensayo pasada — revisalas en Roturas.</span></div>';
  }
  bellList.innerHTML = html || '<div class="bell-empty">Hoy no toca romper nada.</div>';
}
document.getElementById('nav-bell-btn').addEventListener('click', function(e){
  e.stopPropagation();
  document.getElementById('bell-dropdown').classList.toggle('show');
});
document.addEventListener('click', function(e){
  if(!e.target.closest('#bell-dropdown') && !e.target.closest('#nav-bell-btn')) document.getElementById('bell-dropdown').classList.remove('show');
});
document.getElementById('bell-footer').addEventListener('click', function(){
  document.getElementById('bell-dropdown').classList.remove('show');
  showPanel('roturas');
  showRoturasSub('pendientes');
});
