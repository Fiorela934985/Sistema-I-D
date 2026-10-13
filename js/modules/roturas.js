/* Sistema I+D — Entidad ROTURA: códigos correlativos, elaboración, cargas, formato y notificaciones */
'use strict';

/* ================= CÓDIGO CORRELATIVO (ID-XXX) — un contador independiente por Tipo (Cubos/Probetas) ================= */
var CODIGO_COUNTERS = load('sid10_codigo_counters', {Probetas:0, Cubos:0});
function nextCodigoRotura(tipo){
  tipo = (tipo === 'Cubos') ? 'Cubos' : 'Probetas';
  CODIGO_COUNTERS[tipo] = (CODIGO_COUNTERS[tipo]||0) + 1;
  save('sid10_codigo_counters', CODIGO_COUNTERS);
  return 'ID-' + pad4(CODIGO_COUNTERS[tipo]);
}
function peekNextCodigoRotura(tipo){
  tipo = (tipo === 'Cubos') ? 'Cubos' : 'Probetas';
  return 'ID-' + pad4((CODIGO_COUNTERS[tipo]||0) + 1);
}

/* ================= ROTURAS ================= */
var TIPO_ROTURA_IMG_URL = 'assets/tipos-rotura.jpg';
var roturaCargas = load('sid10_rotura_cargas', []); // una fila por (réplica x edad)
function saveRoturaCargas(){ save('sid10_rotura_cargas', roturaCargas); }
function nextRoturaId(){ return 'rc' + Date.now() + Math.floor(Math.random()*1000); }

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
document.getElementById('ro-formato-nuevo').addEventListener('click', function(){ showRoturasSub('registrar'); });

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
function renderRoturasPendientes(){
  var wrap = document.getElementById('roturas-pendientes-list');
  var pend = roturaCargas.filter(function(c){ return c.estado === 'pendiente'; }).sort(function(a,b){ return (a.fechaEnsayo||'').localeCompare(b.fechaEnsayo||''); });
  if(!pend.length){ wrap.innerHTML = '<div class="empty-note">No hay roturas pendientes.</div>'; return; }
  var todayStr = todayISO();
  wrap.innerHTML = pend.map(function(c){
    var d = disenos.filter(function(x){ return x.codigo === c.disenoCodigoDiseno; })[0];
    var sem = d ? semaforoDotHtml(semaforoDiseno(d), 'Avance del diseño') : '';
    var badge = c.fechaEnsayo === todayStr ? '<span class="pendiente-badge hoy">Hoy</span>' :
      (c.fechaEnsayo < todayStr ? '<span class="pendiente-badge vencido">Vencida</span>' : '');
    var tipoEsProbeta = (c.tipo||'Probetas') !== 'Cubos';
    return '<div class="pendiente-row">' +
      sem +
      '<div class="id-card"><span class="id-card-tipo">'+(tipoEsProbeta?'Probeta':'Cubo')+'</span><span class="id-card-codigo">'+c.codigo+'</span></div>' +
      '<div class="pr-info">' +
        badge +
        '<h5>'+esc(c.replicaNombre)+' · día '+c.dia+'</h5>' +
        '<span>'+esc(c.proyecto||'-')+' · Ensayo: '+isoToDMY(c.fechaEnsayo)+'</span>' +
      '</div>' +
      '<button class="btn-add ghost" data-act="etiquetas" data-codigo="'+esc(c.disenoCodigoDiseno)+'" title="Imprimir etiquetas">Etiquetas</button>' +
      '<button class="btn-add" data-perm="roturas:registrar" data-act="registrar-carga" data-id="'+c.id+'">+ Registrar carga</button>' +
    '</div>';
  }).join('');
}
document.getElementById('roturas-pendientes-list').addEventListener('click', function(e){
  var etq = e.target.closest('[data-act="etiquetas"]');
  if(etq){ abrirEtiquetas(etq.dataset.codigo); return; }
  var btn = e.target.closest('[data-act="registrar-carga"]');
  if(!btn) return;
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

function filaRoturaHtml(c, i){
  return '<tr data-i="'+i+'">' +
    '<td class="ro-locked mono"><div class="id-card"><span class="id-card-tipo">'+((c.tipo||'Probetas')!=='Cubos'?'Probeta':'Cubo')+'</span><span class="id-card-codigo">'+c.codigo+'</span></div></td>' +
    '<td>'+esc(c.producto)+'</td><td>'+esc(c.proyecto||'-')+'</td><td>'+esc(c.iteracion||'-')+'</td><td>'+esc(c.aCargoDe||'-')+'</td>' +
    '<td class="ro-locked">'+isoToDMY(c.fechaElaboracion)+'</td><td class="ro-locked">'+c.dia+'</td>' +
    '<td class="ro-locked">'+isoToDMY(c.fechaEnsayo)+'</td><td class="ro-locked">±'+c.toleranciaHoras+'h</td>' +
    '<td><input type="checkbox" data-f="correoEnviado" '+(c.correoEnviado?'checked':'')+'></td>' +
    '<td><input type="time" data-f="horaEnsayo" value="'+esc(c.horaEnsayo)+'"></td>' +
    '<td><input type="text" data-f="a1" value="'+esc(c.a1)+'"></td><td><input type="text" data-f="a2" value="'+esc(c.a2)+'"></td><td><input type="text" data-f="a3" value="'+esc(c.a3)+'"></td>' +
    '<td><input type="text" data-f="m1kN" value="'+esc(c.m1kN)+'"></td><td><input type="text" data-f="m2kN" value="'+esc(c.m2kN)+'"></td><td><input type="text" data-f="m3kN" value="'+esc(c.m3kN)+'"></td>' +
    '<td><input type="text" data-f="m1kg" value="'+esc(c.m1kg)+'"></td><td><input type="text" data-f="m2kg" value="'+esc(c.m2kg)+'"></td><td><input type="text" data-f="m3kg" value="'+esc(c.m3kg)+'"></td>' +
    '<td><input type="text" data-f="tipoRoturaM1" value="'+esc(c.tipoRoturaM1)+'"></td><td><input type="text" data-f="tipoRoturaM2" value="'+esc(c.tipoRoturaM2)+'"></td><td><input type="text" data-f="tipoRoturaM3" value="'+esc(c.tipoRoturaM3)+'"></td>' +
    '<td class="ro-locked">'+(c.m1kgcm2||'-')+'</td><td class="ro-locked">'+(c.m2kgcm2||'-')+'</td><td class="ro-locked">'+(c.m3kgcm2||'-')+'</td>' +
    '<td class="ro-locked">'+(c.promedio||'-')+'</td><td class="ro-locked">'+(c.coefVar||'-')+'</td><td class="ro-locked">'+(c.desvest||'-')+'</td>' +
    '<td><input type="text" data-f="comentarios" value="'+esc(c.comentarios)+'" style="width:110px;"></td>' +
    '<td><button class="btn-icon danger" data-perm="roturas:eliminar" data-act="del-carga" title="Eliminar">×</button></td>' +
  '</tr>';
}
function renderRoturasFormato(){
  var searchTxt = (document.getElementById('ro-formato-search').value||'').trim().toLowerCase();
  var filtro = function(c){
    if(!searchTxt) return true;
    return (c.codigo||'').toLowerCase().indexOf(searchTxt)>-1 || (c.producto||'').toLowerCase().indexOf(searchTxt)>-1;
  };
  var cubos = [], probetas = [];
  roturaCargas.forEach(function(c, i){
    if(!filtro(c)) return;
    ((c.tipo||'Probetas')==='Cubos' ? cubos : probetas).push({c:c, i:i});
  });
  document.getElementById('ro-formato-count-cubos').textContent = cubos.length;
  document.getElementById('ro-formato-count-probetas').textContent = probetas.length;
  document.getElementById('ro-formato-tbody-cubos').innerHTML = cubos.length
    ? cubos.map(function(x){ return filaRoturaHtml(x.c, x.i); }).join('')
    : '<tr><td colspan="30" style="color:var(--text-muted);">Sin registros de Cubos.</td></tr>';
  document.getElementById('ro-formato-tbody-probetas').innerHTML = probetas.length
    ? probetas.map(function(x){ return filaRoturaHtml(x.c, x.i); }).join('')
    : '<tr><td colspan="30" style="color:var(--text-muted);">Sin registros de Probetas.</td></tr>';
}
document.getElementById('ro-formato-search').addEventListener('input', renderRoturasFormato);
document.getElementById('ro-formato-tipo-tabs').addEventListener('click', function(e){
  var btn = e.target.closest('.view-toggle-btn');
  if(!btn) return;
  document.querySelectorAll('#ro-formato-tipo-tabs .view-toggle-btn').forEach(function(b){ b.classList.toggle('active', b===btn); });
  document.getElementById('ro-formato-wrap-probetas').style.display = btn.dataset.tipo === 'Probetas' ? 'block' : 'none';
  document.getElementById('ro-formato-wrap-cubos').style.display = btn.dataset.tipo === 'Cubos' ? 'block' : 'none';
});
function onFormatoChange(e){
  var tr = e.target.closest('tr');
  if(!tr || tr.dataset.i === undefined) return;
  var i = Number(tr.dataset.i);
  var c = roturaCargas[i];
  var f = e.target.dataset.f;
  if(!f) return;
  if(!exigir('roturas:registrar')){ renderRoturasFormato(); return; }
  if(usaEnRRGenerado(c) ){
    if(!confirm('Este resultado ya fue incluido en un reporte RR generado. ¿Deseás continuar con la edición?')) { renderRoturasFormato(); return; }
  }
  c[f] = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
  var estadoAntes = c.estado;
  recalcCarga(c);
  saveRoturaCargas();
  registrarHistorial('Editó', 'Rotura', c.codigo + ' · día ' + c.dia + ' · campo ' + f + (c.estado !== estadoAntes ? ' (rotura completada)' : ''), {proyecto: c.proyecto, ref: c.disenoCodigoDiseno});
  renderRoturasFormato();
  updateNavBadges();
}
function onFormatoClick(e){
  var delBtn = e.target.closest('[data-act="del-carga"]');
  if(!delBtn) return;
  if(!exigir('roturas:eliminar')) return;
  var tr = delBtn.closest('tr');
  var i = Number(tr.dataset.i);
  if(!confirm('¿Eliminar el registro ' + roturaCargas[i].codigo + ' · día ' + roturaCargas[i].dia + '?')) return;
  if(usaEnRRGenerado(roturaCargas[i]) && !confirm('Este resultado ya fue incluido en un reporte RR generado. ¿Deseás eliminarlo igual?')) return;
  var removedCarga = roturaCargas[i];
  [1,2,3].forEach(function(mIdx){ if(removedCarga['evid'+mIdx]) deleteEvidencia(removedCarga['evid'+mIdx]); });
  roturaCargas.splice(i,1);
  saveRoturaCargas();
  sincronizarEvidenciasRoturas();
  registrarHistorial('Eliminó', 'Rotura', removedCarga.codigo + ' · ' + removedCarga.replicaNombre + ' · día ' + removedCarga.dia, {proyecto: removedCarga.proyecto, ref: removedCarga.disenoCodigoDiseno});
  renderRoturasFormato();
  toast('Registro eliminado');
}
['ro-formato-tbody-cubos','ro-formato-tbody-probetas'].forEach(function(id){
  document.getElementById(id).addEventListener('change', onFormatoChange);
  document.getElementById(id).addEventListener('click', onFormatoClick);
});
function usaEnRRGenerado(c){
  return rrEstudios.some(function(e){ return e.tipos.some(function(t){ return t.origenDisenoCodigo === c.disenoCodigoDiseno && e.generado; }); });
}

/* ---- Registrar la Rotura (Momento 2, panel modal) ---- */
var roturaCargaModalId = null;
function openRoturaCargaModal(id){
  roturaCargaModalId = id;
  var c = roturaCargas.filter(function(x){ return x.id === id; })[0];
  if(!c) return;
  var d = disenos.filter(function(x){ return x.codigo === c.disenoCodigoDiseno; })[0];
  document.getElementById('rotura-carga-title').textContent = 'Registrar la Rotura';
  document.getElementById('rotura-carga-recap').innerHTML =
    '<div class="rc-recap-info"><span class="rc-recap-nombre">'+(d?diseñoTitulo(d):esc(c.producto))+'</span><span class="rc-recap-meta">'+esc(c.replicaNombre)+' · día '+c.dia+'</span></div>' +
    '<div class="rc-recap-codigo">'+c.codigo+'</div>';
  function especimenBlock(mIdx, label){
    var areaKey = 'a'+mIdx, kNKey = 'm'+mIdx+'kN', kgKey = 'm'+mIdx+'kg', tipoKey = 'tipoRoturaM'+mIdx, evidKey = 'evid'+mIdx;
    return '<div class="m-especimen-block">' +
      '<h5>'+label+'</h5>' +
      '<div class="m-especimen-grid">' +
        '<div class="field-mini"><label>Área (cm²)</label><input type="text" id="mc-'+areaKey+'" value="'+esc(c[areaKey]||'83')+'"></div>' +
        '<div class="field-mini"><label>Carga (kN)</label><input type="text" id="mc-'+kNKey+'" value="'+esc(c[kNKey])+'"></div>' +
        '<div class="field-mini"><label>Carga (kg)</label><input type="text" id="mc-'+kgKey+'" value="'+esc(c[kgKey])+'"></div>' +
        '<div class="field-mini"><label>Tipo de rotura</label><select id="mc-'+tipoKey+'">' +
          ['','Tipo 1','Tipo 2','Tipo 3','Tipo 4','Tipo 5','Tipo 6'].map(function(t){ return '<option'+(c[tipoKey]===t?' selected':'')+'>'+t+'</option>'; }).join('') +
        '</select></div>' +
        '<div class="field-mini"><label>Evidencia</label><div class="evidencia-drop" id="mc-drop-'+mIdx+'" data-evid-key="'+(c[evidKey]||'')+'">'+(c[evidKey]?'Cargando…':'Subir foto')+'<input type="file" accept="image/*" id="mc-file-'+mIdx+'" style="display:none;"></div></div>' +
      '</div>' +
    '</div>';
  }
  document.getElementById('rotura-carga-body').innerHTML =
    '<button type="button" class="btn-add ghost" id="mc-toggle-guia" style="margin-bottom:12px;">Ver guía de tipos de fractura (1–6)</button>' +
    '<div id="mc-guia-imagen" style="display:none;margin-bottom:16px;text-align:center;">' +
      '<img src="'+TIPO_ROTURA_IMG_URL+'" alt="Guía de tipos de fractura NTP 339.034" style="max-width:420px;width:100%;border:1px solid var(--line);border-radius:6px;">' +
    '</div>' +
    '<div class="mc-unidad-toggle">' +
      '<span class="mc-unidad-label">Unidad de carga a registrar:</span>' +
      '<label class="pp-check-inline"><input type="radio" name="mc-unidad" value="kg" checked> KG</label>' +
      '<label class="pp-check-inline"><input type="radio" name="mc-unidad" value="kn"> KN</label>' +
    '</div>' +
    '<div class="form-row"><div class="field-mini" style="flex:1;"><label>Hora de Ensayo</label><input type="time" id="mc-horaEnsayo" value="'+esc(c.horaEnsayo)+'"></div></div>' +
    especimenBlock(1,'M1') + especimenBlock(2,'M2') + especimenBlock(3,'M3') +
    '<div class="field-mini"><label>Comentarios</label><input type="text" id="mc-comentarios" value="'+esc(c.comentarios)+'"></div>';
  document.getElementById('mc-toggle-guia').addEventListener('click', function(){
    var img = document.getElementById('mc-guia-imagen');
    var showing = img.style.display !== 'none';
    img.style.display = showing ? 'none' : 'block';
    this.textContent = showing ? 'Ver guía de tipos de fractura (1–6)' : 'Ocultar guía de tipos de fractura';
  });

  /* Unidad KN/KG: al elegir una, se bloquea la otra y se convierte en automático (1 kN = 101.9716 kgf) */
  var KGF_POR_KN = 101.9716;
  function aplicarUnidadBloqueo(unidad){
    [1,2,3].forEach(function(mIdx){
      var kgEl = document.getElementById('mc-m'+mIdx+'kg');
      var knEl = document.getElementById('mc-m'+mIdx+'kN');
      kgEl.disabled = (unidad === 'kn');
      knEl.disabled = (unidad === 'kg');
    });
  }
  [1,2,3].forEach(function(mIdx){
    var kgEl = document.getElementById('mc-m'+mIdx+'kg');
    var knEl = document.getElementById('mc-m'+mIdx+'kN');
    kgEl.addEventListener('input', function(){
      if(kgEl.disabled) return;
      var v = Number(kgEl.value);
      knEl.value = v ? (v/KGF_POR_KN).toFixed(2) : '';
    });
    knEl.addEventListener('input', function(){
      if(knEl.disabled) return;
      var v = Number(knEl.value);
      kgEl.value = v ? (v*KGF_POR_KN).toFixed(2) : '';
    });
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
    dropEl.addEventListener('click', function(){ fileEl.click(); });
    fileEl.addEventListener('change', function(){
      var f = fileEl.files[0];
      if(!f) return;
      var url = URL.createObjectURL(f);
      dropEl.innerHTML = 'Guardando…';
      var newKey = c.id + '_m' + mIdx;
      saveEvidenciaBlob(newKey, f).then(function(){
        dropEl.dataset.evidKey = newKey;
        dropEl.dataset.pendingSave = '1';
        dropEl.innerHTML = '<img src="'+url+'"><br>Cambiar foto';
        dropEl.appendChild(fileEl);
      });
    });
  });

  document.getElementById('rotura-carga-modal').classList.add('show');
}
document.getElementById('rotura-carga-close').addEventListener('click', function(){ document.getElementById('rotura-carga-modal').classList.remove('show'); });
document.getElementById('rotura-carga-cancel').addEventListener('click', function(){ document.getElementById('rotura-carga-modal').classList.remove('show'); });
document.getElementById('rotura-carga-save').addEventListener('click', function(){
  var c = roturaCargas.filter(function(x){ return x.id === roturaCargaModalId; })[0];
  if(!c) return;
  if(!exigir('roturas:registrar')) return;
  c.horaEnsayo = document.getElementById('mc-horaEnsayo').value;
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
  saveRoturaCargas();
  sincronizarEvidenciasRoturas();
  registrarHistorial('Registró', 'Rotura', 'Carga ' + c.codigo + ' · ' + c.replicaNombre + ' · día ' + c.dia + (c.promedio ? ' · ' + c.promedio + ' kg/cm²' : ''), {proyecto: c.proyecto, ref: c.disenoCodigoDiseno});
  document.getElementById('rotura-carga-modal').classList.remove('show');
  toast('Carga registrada — ' + c.codigo);
  renderRoturasAll();
  updateNavBadges();
});

/* ---- Bell / notificaciones ---- */
function updateNavBadges(){
  var todayStr = todayISO();
  var countBacklog = roturaCargas.filter(function(c){ return c.estado==='pendiente' && c.fechaEnsayo <= todayStr; }).length;
  var badge = document.getElementById('nav-roturas-badge');
  badge.style.display = countBacklog ? 'inline-block' : 'none';
  badge.textContent = countBacklog;
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
