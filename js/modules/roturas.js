/* Sistema I+D — Paso 4: ROTURAS (sección 9). Se programan solas al guardar la elaboración (8.3) y se
   registran escaneando la probeta, con prensa calibrada, tolerancia por edad y alertas de dispersión. */
'use strict';

/* ================= CÓDIGO CORRELATIVO ID-XXXX — un contador por tipo (Cubos/Probetas); nunca se reutiliza ================= */
var CODIGO_COUNTERS = load('sid10_codigo_counters', {Probetas:0, Cubos:0});
function maxCodigoExistente(tipo){
  return roturaCargas.filter(function(c){ return (c.tipo || 'Probetas') === tipo; }).reduce(function(m, c){
    var x = parseInt(String(c.codigo || '').replace(/[^0-9]/g, ''), 10); return isNaN(x) ? m : Math.max(m, x);
  }, 0);
}
function nextCodigoRotura(tipo){
  tipo = (tipo === 'Cubos') ? 'Cubos' : 'Probetas';
  CODIGO_COUNTERS[tipo] = Math.max(CODIGO_COUNTERS[tipo] || 0, maxCodigoExistente(tipo)) + 1;
  save('sid10_codigo_counters', CODIGO_COUNTERS);
  return 'ID-' + pad4(CODIGO_COUNTERS[tipo]);
}
function peekNextCodigoRotura(tipo){
  tipo = (tipo === 'Cubos') ? 'Cubos' : 'Probetas';
  return 'ID-' + pad4(Math.max(CODIGO_COUNTERS[tipo] || 0, maxCodigoExistente(tipo)) + 1);
}

var TIPO_ROTURA_IMG_URL = 'assets/tipos-rotura.jpg';
var KGF_POR_KN = 101.9716;
var roturaCargas = load('sid10_rotura_cargas', []); // una fila por (réplica × edad)
function saveRoturaCargas(){ save('sid10_rotura_cargas', roturaCargas); }
function nextRoturaId(){ return 'rc' + Date.now() + Math.floor(Math.random()*1000); }
function etiquetaEstadoCarga(c){ return {pendiente:'Pendiente', completado:'Registrada', 'no-ubicada':'No ubicada', invalidada:'Invalidada', cancelada:'Cancelada'}[c.estado] || c.estado; }

/* Datos de diseños creados con la versión anterior (roturas generadas al registrar el diseño). */
function crearCargasParaDiseno(d, origen){
  var creados = [];
  (d.replicaObjs||[]).forEach(function(rep){
    var codigo = rep.codigo || nextCodigoRotura(d.tipoRotura || 'Probetas');
    rep.codigo = codigo;
    (d.diasRotura||[]).forEach(function(dia){
      var fechaBaseISO = d.fechaElaboracionISO || dmyToISO(d.fecha) || todayISO();
      var carga = {id: nextRoturaId(), codigo: codigo, tipo: d.tipoRotura || 'Probetas', disenoCodigoDiseno: d.codigo, replicaNombre: rep.nombre,
        producto: rep.nombre, proyecto: proyectoNombre(d.proyectoId), iteracion: iteracionNombre(d.iteracionId), aCargoDe: d.aCargoDe || '',
        fechaElaboracion: fechaBaseISO, horaElaboracion: d.horaElaboracion || '', dia: dia, fechaEnsayo: calcularFechaEnsayo(fechaBaseISO, dia),
        toleranciaHoras: toleranciaHoras(dia), correoEnviado: false, origen: origen, horaEnsayo:'', a1:'', a2:'', a3:'',
        m1kN:'', m2kN:'', m3kN:'', m1kg:'', m2kg:'', m3kg:'', tipoRoturaM1:'', tipoRoturaM2:'', tipoRoturaM3:'', evid1:'', evid2:'', evid3:'',
        m1kgcm2:'', m2kgcm2:'', m3kgcm2:'', promedio:'', coefVar:'', desvest:'', comentarios:'', estado:'pendiente'};
      roturaCargas.push(carga);
      creados.push(carga);
    });
  });
  saveRoturaCargas();
  return creados;
}

/* Alcance: TEC ve solo las roturas asignadas a él o a su equipo (sección 3). */
function roturaVisible(c){
  if(!usuarioActual) return false;
  var p = proyectoPorNombre(c.proyecto);
  if(p && !proyectoVisible(p)) return false;
  if(rolDe(usuarioActual) !== 'TEC') return true;
  return c.tecnicoId === usuarioActual.id || !p || esDeMiEquipo(p);
}
function roturasVisibles(){ return roturaCargas.filter(roturaVisible); }

/* Ventana de ensayo: fecha y hora de elaboración + edad ± tolerancia (8.3, RF-ROT-08). */
function ventanaEnsayo(c){
  var base = new Date((c.fechaEnsayo || todayISO()) + 'T' + (c.horaElaboracion || '08:00') + ':00').getTime();
  var tol = n(c.toleranciaHoras) * 3600000;
  return {centro: base, desde: base - tol, hasta: base + tol};
}
function hhmm(ts){ var d = new Date(ts); return String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0'); }
function ventanaTexto(c){
  var v = ventanaEnsayo(c);
  var mismoDia = new Date(v.desde).toDateString() === new Date(v.hasta).toDateString();
  return mismoDia ? hhmm(v.desde) + '–' + hhmm(v.hasta) : isoDe(new Date(v.desde)).slice(5).split('-').reverse().join('/') + ' ' + hhmm(v.desde) + ' – ' + isoDe(new Date(v.hasta)).slice(5).split('-').reverse().join('/') + ' ' + hhmm(v.hasta);
}

/* ---- Subtabs ---- */
function showRoturasSub(name){
  document.querySelectorAll('#roturas-subtabs .subtab').forEach(function(b){ b.classList.toggle('active', b.dataset.rosub === name); });
  document.getElementById('ro-sub-pendientes').style.display = name === 'pendientes' ? 'block' : 'none';
  document.getElementById('ro-sub-registrar').style.display = name === 'registrar' ? 'block' : 'none';
  document.getElementById('ro-sub-formato').style.display = name === 'formato' ? 'block' : 'none';
  if(name === 'formato') renderRoturasFormato();
  if(name === 'pendientes') renderRoturasPendientes();
  if(name === 'registrar'){
    refreshAllProyectoSelects(); rebuildRoIteracionSelect(); rebuildRoDisenoSelect(); renderRoCodigoPreview(); renderRoFechasPreview();
    var aCargo = document.getElementById('ro-acargode');
    if(!aCargo.value && usuarioActual) aCargo.value = nombreUsuario(usuarioActual);
  }
}
document.querySelectorAll('#roturas-subtabs .subtab').forEach(function(btn){
  btn.addEventListener('click', function(){ showRoturasSub(btn.dataset.rosub); });
});
document.getElementById('ro-formato-nuevo').addEventListener('click', function(){ showRoturasSub('registrar'); });
document.getElementById('ro-escanear').addEventListener('click', function(){ escanearQR('Escanear probeta', abrirDesdeQR); });

function renderRoturasAll(){
  document.getElementById('roturas-count').textContent = roturasVisibles().length + ' registros';
  renderRoturasPendientes();
  renderRoturasFormato();
  updateNavBadges();
}

/* ---- RF-ROT-12: registro independiente (roturas sin diseño en el sistema) ---- */
function rebuildRoIteracionSelect(){
  var proy = document.getElementById('ro-proyecto').value;
  var sel = document.getElementById('ro-iteracion');
  sel.innerHTML = '<option value="">Elegí la iteración…</option>' + iteracionesDeProyecto(proy).map(function(it){ return '<option>' + esc(it) + '</option>'; }).join('');
}
function rebuildRoDisenoSelect(){
  var sel = document.getElementById('ro-diseno');
  var proyId = document.getElementById('ro-proyecto').value;
  var list = disenos.filter(function(d){ return (!proyId || d.proyectoId === proyId) && disenoEditable(d); });
  sel.innerHTML = '<option value="">Sin diseño en el sistema</option>' + list.map(function(d){
    return '<option value="'+disenos.indexOf(d)+'">'+esc(d.codigo + ' · ' + diseñoTitulo(d))+'</option>';
  }).join('');
  rebuildRoReplicaSelect();
}
document.getElementById('ro-proyecto').addEventListener('change', rebuildRoIteracionSelect);
document.getElementById('ro-diseno').addEventListener('change', function(){
  rebuildRoReplicaSelect();
  var d = this.value !== '' ? disenos[Number(this.value)] : null;
  document.getElementById('ro-producto').disabled = !!d;
  if(d){
    document.getElementById('ro-tipo-display').value = (d.tipoRotura || 'Probetas') === 'Cubos' ? 'Cubo' : 'Probeta';
    document.getElementById('ro-iteracion').value = d.iteracionId || '';
  }
  renderRoCodigoPreview();
});
function rebuildRoReplicaSelect(){
  var sel = document.getElementById('ro-replica');
  var didx = document.getElementById('ro-diseno').value;
  var d = didx !== '' ? disenos[Number(didx)] : null;
  var reps = d && d.replicaObjs ? d.replicaObjs : [];
  sel.innerHTML = '<option value="">' + (d ? 'Elegí la réplica…' : '—') + '</option>' + reps.map(function(r,ri){
    return '<option value="'+ri+'">'+esc(r.nombre)+'</option>';
  }).join('');
}
function tipoDeRegistroActivo(){ return document.getElementById('ro-tipo-display').value === 'Cubo' ? 'Cubos' : 'Probetas'; }
function renderRoCodigoPreview(){
  var el = document.getElementById('ro-codigo-preview');
  var didx = document.getElementById('ro-diseno').value, repIdx = document.getElementById('ro-replica').value;
  var existente = '';
  if(didx !== '' && repIdx !== ''){ var rep = (disenos[Number(didx)].replicaObjs || [])[Number(repIdx)]; if(rep && rep.codigo) existente = rep.codigo; }
  el.innerHTML = '<div class="codigo-preview-destacado"><span class="cpd-label">'+(existente?'Código de esta réplica':'Código a asignar')+'</span><span class="cpd-codigo">'+(existente || peekNextCodigoRotura(tipoDeRegistroActivo()))+'</span></div>';
}
document.getElementById('ro-replica').addEventListener('change', renderRoCodigoPreview);
document.getElementById('ro-tipo-display').addEventListener('change', renderRoCodigoPreview);
function renderRoFechasPreview(){
  var fechaElab = document.getElementById('ro-fecha-elab').value;
  var dias = getDiasSeleccionados('ro');
  var wrap = document.getElementById('ro-fechas-preview');
  if(!fechaElab || !dias.length){ wrap.innerHTML = ''; return; }
  wrap.innerHTML = dias.map(function(dia){
    return '<div class="ntp-tolerancia-box">Día '+dia+' → ensayo <b>'+isoToDMY(calcularFechaEnsayo(fechaElab, dia))+'</b> · tolerancia ±<b>'+toleranciaHoras(dia)+' h</b></div>';
  }).join(' ');
}
['ro-fecha-elab','ro-hora-elab'].forEach(function(id){ document.getElementById(id).addEventListener('input', renderRoFechasPreview); });
document.querySelectorAll('.ro-dia-check').forEach(function(c){ c.addEventListener('change', renderRoFechasPreview); });

document.getElementById('ro-registrar-btn').addEventListener('click', function(){
  if(!exigir('roturas:crear')) return;
  var proyecto = document.getElementById('ro-proyecto').value;
  var iteracion = document.getElementById('ro-iteracion').value;
  var didx = document.getElementById('ro-diseno').value, repIdx = document.getElementById('ro-replica').value;
  var fechaElab = document.getElementById('ro-fecha-elab').value, horaElab = document.getElementById('ro-hora-elab').value;
  var dias = getDiasSeleccionados('ro');
  var aCargoDe = document.getElementById('ro-acargode').value.trim();
  var d = didx !== '' ? disenos[Number(didx)] : null;
  var rep = d && repIdx !== '' ? d.replicaObjs[Number(repIdx)] : null;
  var producto = d ? (rep ? rep.nombre : '') : document.getElementById('ro-producto').value.trim();
  var err = [];
  if(!proyecto) err.push('Elegí el proyecto.');
  else if(!proyectoAdmiteDisenos(proyecto)) err.push('El proyecto no admite registros nuevos.');
  if(!iteracion) err.push('Elegí la iteración.');
  if(d && !rep) err.push('Elegí la réplica del diseño.');
  if(!d && producto.length < 3) err.push('Describí el producto ensayado.');
  if(!aCargoDe) err.push('Indicá quién está a cargo.');
  if(!fechaElab) err.push('Fecha de elaboración obligatoria.'); else if(fechaElab > todayISO()) err.push('La fecha de elaboración no puede ser futura.');
  if(horaElab && !horaValida(horaElab)) err.push('Hora inválida.');
  if(!dias.length || dias.some(function(x){ return !(x >= 1 && x <= 365); })) err.push('Elegí edades entre 1 y 365 días.');
  if(rep && cargasDeReplicaObj(d, rep).length) err.push('Esa réplica ya tiene sus roturas generadas.');
  if(err.length){ toast(err.join(' ')); return; }
  var tipo = d ? (d.tipoRotura || 'Probetas') : tipoDeRegistroActivo();
  var codigo = (rep && rep.codigo) || nextCodigoRotura(tipo);
  if(rep && !rep.codigo){ rep.codigo = codigo; save('sid10_disenos', disenos); }
  var p = proyectoPorNombre(proyecto) || {};
  var creados = dias.slice().sort(function(a, b){ return a - b; }).map(function(dia){
    var carga = {id: nextRoturaId(), codigo: codigo, tipo: tipo, disenoCodigoDiseno: d ? d.codigo : '', replicaNombre: producto, producto: producto,
      proyecto: proyecto, iteracion: iteracion, aCargoDe: aCargoDe, laboratorio: p.laboratorio || '', tecnicoId: usuarioActual.id,
      fechaElaboracion: fechaElab, horaElaboracion: horaElab, dia: dia, fechaEnsayo: calcularFechaEnsayo(fechaElab, dia),
      toleranciaHoras: toleranciaHoras(dia), correoEnviado:false, origen: d ? 'manual' : 'independiente', horaEnsayo:'', a1:'',a2:'',a3:'',
      m1kN:'',m2kN:'',m3kN:'',m1kg:'',m2kg:'',m3kg:'', tipoRoturaM1:'',tipoRoturaM2:'',tipoRoturaM3:'', evid1:'',evid2:'',evid3:'',
      m1kgcm2:'',m2kgcm2:'',m3kgcm2:'',promedio:'',coefVar:'',desvest:'', comentarios:'', estado:'pendiente', creado: Date.now()};
    roturaCargas.push(carga);
    return carga;
  });
  saveRoturaCargas();
  registrarHistorial('Registró', 'Rotura', 'Registro independiente ' + codigo + ' · ' + producto + ' · días ' + dias.join(', '), {proyecto: proyecto, ref: d ? d.codigo : codigo});
  document.getElementById('ro-producto').value = '';
  toast('Registrado — código ' + codigo + ' (' + creados.length + ' edades)');
  renderRoturasAll();
  showRoturasSub('pendientes');
});

/* ---- RF-ROT-01: lo que toca hoy y lo vencido, con su ventana horaria, ordenado por hora ---- */
var roturasFiltroEstado = 'todas';
var GRUPOS_PENDIENTES = [
  {id:'vencidas', titulo:'Vencidas', desc:'La ventana de ensayo ya pasó'},
  {id:'hoy', titulo:'Para hoy', desc:'Dentro de la tolerancia de hoy'},
  {id:'manana', titulo:'Mañana', desc:'Aviso del día anterior'},
  {id:'proximas', titulo:'Próximas', desc:'Programadas para los próximos días'}
];
function grupoPendiente(c, hoy){
  if(c.fechaEnsayo < hoy) return 'vencidas';
  if(c.fechaEnsayo === hoy) return 'hoy';
  return c.fechaEnsayo === addDaysISO(hoy, 1) ? 'manana' : 'proximas';
}
function renderRoturasPendientes(){
  var wrap = document.getElementById('roturas-pendientes-list');
  var pend = roturasVisibles().filter(function(c){ return c.estado === 'pendiente'; })
    .sort(function(a,b){ return ventanaEnsayo(a).centro - ventanaEnsayo(b).centro; });
  if(!pend.length){ wrap.innerHTML = '<div class="empty-note">No hay roturas pendientes.</div>'; return; }
  var hoy = todayISO();
  var porGrupo = {vencidas:[], hoy:[], manana:[], proximas:[]};
  pend.forEach(function(c){ porGrupo[grupoPendiente(c, hoy)].push(c); });
  var chips = '<div class="filtro-chips">' + [{id:'todas', titulo:'Todas', n:pend.length}].concat(GRUPOS_PENDIENTES.map(function(g){ return {id:g.id, titulo:g.titulo, n:porGrupo[g.id].length}; }))
    .map(function(f){ return '<button class="filtro-chip f-'+f.id+(roturasFiltroEstado===f.id?' on':'')+'" data-filtro-pend="'+f.id+'">'+f.titulo+' <b>'+f.n+'</b></button>'; }).join('') + '</div>';
  var grupos = GRUPOS_PENDIENTES.filter(function(g){ return (roturasFiltroEstado === 'todas' || roturasFiltroEstado === g.id) && porGrupo[g.id].length; });
  wrap.innerHTML = chips + (grupos.length ? grupos.map(function(g){
    return '<div class="pend-grupo g-'+g.id+'"><div class="pend-grupo-head"><h4>'+g.titulo+' <span>'+porGrupo[g.id].length+'</span></h4><small>'+g.desc+'</small></div>' +
      porGrupo[g.id].map(filaPendienteHtml).join('') + '</div>';
  }).join('') : '<div class="empty-note">No hay roturas en este grupo.</div>');
}
function filaPendienteHtml(c){
  var hoy = todayISO();
  var d = disenoPorCodigo(c.disenoCodigoDiseno);
  var sem = d ? semaforoDotHtml(semaforoDiseno(d), 'Avance del diseño') : '';
  var badge = c.fechaEnsayo === hoy ? '<span class="pendiente-badge hoy">Hoy</span>' : (c.fechaEnsayo < hoy ? '<span class="pendiente-badge vencido">Vencida</span>' : '');
  var tipoEsProbeta = (c.tipo||'Probetas') !== 'Cubos';
  return '<div class="pendiente-row g-'+grupoPendiente(c, hoy)+'">' + sem +
    '<div class="id-card"><span class="id-card-tipo">'+(tipoEsProbeta?'Probeta':'Cubo')+'</span><span class="id-card-codigo">'+esc(c.codigo)+'</span></div>' +
    '<div class="pr-info"><h5>'+esc(c.replicaNombre)+' <span class="pr-dia">Día '+c.dia+'</span></h5>' +
      '<span>'+esc(c.proyecto||'-')+' · '+isoToDMY(c.fechaEnsayo)+' · ventana <b>'+esc(ventanaTexto(c))+'</b> · '+esc(c.aCargoDe || '')+'</span></div>' + badge +
    '<button class="btn-icon" data-act="etiquetas" data-codigo="'+esc(c.disenoCodigoDiseno)+'" title="Imprimir etiquetas">'+TAG_ICON+'</button>' +
    '<button class="btn-add ghost" data-perm="roturas:registrar" data-act="no-ubicada" data-id="'+c.id+'">No ubicada</button>' +
    '<button class="btn-add" data-perm="roturas:registrar" data-act="registrar-carga" data-id="'+c.id+'">Registrar carga</button></div>';
}
document.getElementById('roturas-pendientes-list').addEventListener('click', function(e){
  var filtro = e.target.closest('[data-filtro-pend]');
  if(filtro){ roturasFiltroEstado = filtro.dataset.filtroPend; renderRoturasPendientes(); return; }
  var etq = e.target.closest('[data-act="etiquetas"]');
  if(etq){ if(etq.dataset.codigo) abrirEtiquetas(etq.dataset.codigo); else toast('Registro sin diseño: sus etiquetas se imprimen desde el formato'); return; }
  var nu = e.target.closest('[data-act="no-ubicada"]');
  if(nu){ marcarNoUbicada(nu.dataset.id); return; }
  var btn = e.target.closest('[data-act="registrar-carga"]');
  if(btn && exigir('roturas:registrar')) openRoturaCargaModal(btn.dataset.id);
});

function renderPendientesHoyInicio(){
  var wrap = document.getElementById('pendientes-hoy-inicio');
  var hoy = todayISO();
  var lista = roturasVisibles().filter(function(c){ return c.estado === 'pendiente' && c.fechaEnsayo <= hoy; })
    .sort(function(a,b){ return ventanaEnsayo(a).centro - ventanaEnsayo(b).centro; });
  var badgeEl = document.getElementById('rh-count-badge');
  if(badgeEl) badgeEl.textContent = lista.length;
  if(!lista.length){ wrap.innerHTML = '<div class="empty-note">Hoy no toca romper ninguna probeta o cubo.</div>'; return; }
  wrap.innerHTML = lista.map(function(c){
    var vencida = c.fechaEnsayo < hoy;
    return '<div class="ih-card '+(vencida ? 'accent-rojo' : 'accent-dorado')+'">' +
      '<div class="id-card"><span class="id-card-tipo">'+((c.tipo||'Probetas') !== 'Cubos'?'Probeta':'Cubo')+'</span><span class="id-card-codigo">'+esc(c.codigo)+'</span></div>' +
      '<div class="ih-main"><span class="ih-nombre">'+esc(c.replicaNombre)+' (Día '+c.dia+')</span>' +
        '<div class="ih-badges" style="margin-top:6px;">'+(vencida ? '<span class="ih-badge urgente">Vencida</span>' : '<span class="ih-badge hoy">'+esc(ventanaTexto(c))+'</span>')+'</div></div>' +
      '<button class="btn-add" data-perm="roturas:registrar" data-act="registrar-carga-inicio" data-id="'+c.id+'">Registrar '+REGISTRAR_ICON+'</button></div>';
  }).join('');
}
document.getElementById('pendientes-hoy-inicio').addEventListener('click', function(e){
  var btn = e.target.closest('[data-act="registrar-carga-inicio"]');
  if(!btn) return;
  showPanel('roturas');
  openRoturaCargaModal(btn.dataset.id);
});
document.getElementById('btn-ver-todos-disenos-inicio').addEventListener('click', function(){ showPanel('disenos'); showSubTab('historico'); });

/* ---- RF-ROT-06: cálculos ---- */
function calcKgCm2(cargaKgVal, areaVal){
  var carga = n(cargaKgVal), area = n(areaVal);
  if(!carga || !area) return '';
  return (carga/area).toFixed(2);
}
function statsFromValues(vals){
  var nums = vals.map(n).filter(function(v){ return v>0; });
  if(!nums.length) return {promedio:'', coefVar:'', desvest:''};
  var prom = nums.reduce(function(a,b){return a+b;},0)/nums.length;
  var variance = nums.length > 1 ? nums.reduce(function(a,b){ return a + Math.pow(b-prom,2); },0)/(nums.length - 1) : 0;
  var desv = Math.sqrt(variance);
  var cv = prom ? (desv/prom*100) : 0;
  return {promedio:prom.toFixed(2), coefVar:cv.toFixed(2)+'%', desvest:desv.toFixed(2)};
}
/* Los especímenes invalidados con motivo no entran al promedio (RF-RES-03). */
function especimenValido(c, m){ return !(c.invalidaciones || []).some(function(iv){ return iv.especimen === 'M' + m || iv.especimen === 'edad'; }); }
function recalcCarga(c){
  c.m1kgcm2 = calcKgCm2(c.m1kg, c.a1);
  c.m2kgcm2 = calcKgCm2(c.m2kg, c.a2);
  c.m3kgcm2 = calcKgCm2(c.m3kg, c.a3);
  var st = statsFromValues([1, 2, 3].filter(function(m){ return especimenValido(c, m); }).map(function(m){ return c['m' + m + 'kgcm2']; }));
  c.promedio = st.promedio; c.coefVar = st.coefVar; c.desvest = st.desvest;
  if(c.estado === 'pendiente' && c.m1kgcm2 && c.m2kgcm2 && c.m3kgcm2) c.estado = 'completado';
}
/* RF-ROT-07: un espécimen que difiere más del umbral respecto del promedio, o CV alto. */
function evaluarDispersion(vals){
  var nums = vals.map(Number).filter(function(v){ return v > 0; });
  if(nums.length < 2) return {alta:false, fuera:[]};
  var prom = promedio(nums);
  var umbralEsp = Number(ajuste('dispersionEspecimenPct')), umbralCV = Number(ajuste('dispersionCVPct'));
  var fuera = [];
  vals.forEach(function(v, i){ if(Number(v) > 0 && Math.abs(Number(v) - prom) / prom * 100 > umbralEsp) fuera.push(i + 1); });
  var cv = parseFloat(statsFromValues(nums).coefVar) || 0;
  return {alta: fuera.length > 0 || cv > umbralCV, fuera: fuera, cv: cv, prom: prom};
}

/* ---- RF-ROT-11: formato de roturas I+D (solo lectura; se edita con el registro, que aplica las reglas) ---- */
function filaRoturaHtml(c){
  var celda = function(v){ return '<td>' + esc(v === undefined || v === '' ? '-' : v) + '</td>'; };
  var fuera = c.fueraTolerancia ? ' class="fila-desvio"' : '';
  return '<tr data-id="'+c.id+'"'+fuera+'>' +
    '<td class="ro-locked mono"><div class="id-card"><span class="id-card-tipo">'+((c.tipo||'Probetas')!=='Cubos'?'Probeta':'Cubo')+'</span><span class="id-card-codigo">'+esc(c.codigo)+'</span></div></td>' +
    celda(c.producto) + celda(c.proyecto) + celda(c.iteracion) + celda(c.aCargoDe) +
    celda(isoToDMY(c.fechaElaboracion)) + celda(c.dia) + celda(isoToDMY(c.fechaEnsayo)) + celda('±'+c.toleranciaHoras+'h') +
    '<td><span class="tag-pill '+(c.estado==='completado'?'tag-verde':(c.estado==='pendiente'?'tag-celeste':'tag-gris'))+'">'+esc(etiquetaEstadoCarga(c))+'</span>'+(c.fueraTolerancia?' <span class="tag-pill tag-naranja">Fuera</span>':'')+(c.alertaDispersion?' <span class="tag-pill tag-naranja">Dispersión</span>':'')+'</td>' +
    celda(c.prensa ? c.prensa.nombre : '') + celda(c.horaEnsayo) + celda(c.a1) + celda(c.a2) + celda(c.a3) +
    celda(c.m1kN) + celda(c.m2kN) + celda(c.m3kN) + celda(c.m1kg) + celda(c.m2kg) + celda(c.m3kg) +
    celda(c.tipoRoturaM1) + celda(c.tipoRoturaM2) + celda(c.tipoRoturaM3) +
    [1,2,3].map(function(m){ return '<td class="ro-locked'+(especimenValido(c, m)?'':' tachado')+'">'+esc(c['m'+m+'kgcm2']||'-')+'</td>'; }).join('') +
    '<td class="ro-locked"><b>'+esc(c.promedio||'-')+'</b></td>' + celda(c.coefVar) + celda(c.desvest) + celda(c.comentarios) +
    '<td class="acciones-fila"><button class="btn-icon edit" data-act="abrir-carga" title="Ver / corregir">'+EDIT_ICON+'</button>' +
      '<button class="btn-icon danger" data-perm="roturas:eliminar" data-act="del-carga" title="Eliminar">×</button></td></tr>';
}
function roturasFormatoFiltradas(){
  var txt = (document.getElementById('ro-formato-search').value||'').trim().toLowerCase();
  return roturasVisibles().filter(function(c){ return !txt || [c.codigo, c.producto, c.proyecto, c.iteracion].join(' ').toLowerCase().indexOf(txt) > -1; });
}
function renderRoturasFormato(){
  var cubos = [], probetas = [];
  roturasFormatoFiltradas().forEach(function(c){ ((c.tipo||'Probetas')==='Cubos' ? cubos : probetas).push(c); });
  document.getElementById('ro-formato-count-cubos').textContent = cubos.length;
  document.getElementById('ro-formato-count-probetas').textContent = probetas.length;
  document.getElementById('ro-formato-tbody-cubos').innerHTML = cubos.length ? cubos.map(filaRoturaHtml).join('') : '<tr><td colspan="32" style="color:var(--text-muted);">Sin registros de Cubos.</td></tr>';
  document.getElementById('ro-formato-tbody-probetas').innerHTML = probetas.length ? probetas.map(filaRoturaHtml).join('') : '<tr><td colspan="32" style="color:var(--text-muted);">Sin registros de Probetas.</td></tr>';
}
document.getElementById('ro-formato-search').addEventListener('input', renderRoturasFormato);
document.getElementById('ro-formato-tipo-tabs').addEventListener('click', function(e){
  var btn = e.target.closest('.view-toggle-btn');
  if(!btn) return;
  document.querySelectorAll('#ro-formato-tipo-tabs .view-toggle-btn').forEach(function(b){ b.classList.toggle('active', b===btn); });
  document.getElementById('ro-formato-wrap-probetas').style.display = btn.dataset.tipo === 'Probetas' ? 'block' : 'none';
  document.getElementById('ro-formato-wrap-cubos').style.display = btn.dataset.tipo === 'Cubos' ? 'block' : 'none';
});
document.getElementById('ro-formato-excel').addEventListener('click', function(){
  if(!exigir('datos:exportar')) return;
  var cab = ['Código ID','Producto','Proyecto','Iteración','A cargo de','F. elaboración','Días','F. ensayo','Tolerancia (h)','Estado','Prensa','Calibración prensa','Hora ensayo','A1','A2','A3','M1 kN','M2 kN','M3 kN','M1 kg','M2 kg','M3 kg','Tipo M1','Tipo M2','Tipo M3','M1 kg/cm²','M2 kg/cm²','M3 kg/cm²','Promedio','CV','Desvest','Fuera de tolerancia','Motivo','Comentarios'];
  var fila = function(c){ return [c.codigo,c.producto,c.proyecto,c.iteracion,c.aCargoDe,c.fechaElaboracion,c.dia,c.fechaEnsayo,c.toleranciaHoras,etiquetaEstadoCarga(c),c.prensa?c.prensa.nombre:'',c.prensa?c.prensa.calibracion:'',c.horaEnsayo,c.a1,c.a2,c.a3,c.m1kN,c.m2kN,c.m3kN,c.m1kg,c.m2kg,c.m3kg,c.tipoRoturaM1,c.tipoRoturaM2,c.tipoRoturaM3,c.m1kgcm2,c.m2kgcm2,c.m3kgcm2,c.promedio,c.coefVar,c.desvest,c.fueraTolerancia?'Sí':'',c.motivoFueraTolerancia||'',c.comentarios]; };
  var lista = roturasFormatoFiltradas();
  if(exportarExcel('Formato de roturas I+D ' + todayISO() + '.xlsx', [
    {nombre:'Probetas', filas:[cab].concat(lista.filter(function(c){ return (c.tipo||'Probetas') !== 'Cubos'; }).map(fila))},
    {nombre:'Cubos', filas:[cab].concat(lista.filter(function(c){ return c.tipo === 'Cubos'; }).map(fila))}
  ])) registrarHistorial('Exportó', 'Rotura', lista.length + ' registros (formato I+D)');
});
function onFormatoClick(e){
  var tr = e.target.closest('tr[data-id]');
  if(!tr) return;
  var c = roturaCargas.filter(function(x){ return x.id === tr.dataset.id; })[0];
  if(!c) return;
  if(e.target.closest('[data-act="abrir-carga"]')){ openRoturaCargaModal(c.id); return; }
  if(!e.target.closest('[data-act="del-carga"]') || !exigir('roturas:eliminar')) return;
  if(c.estado === 'completado' || usaEnRRGenerado(c)){ toast('La rotura tiene resultados: no se elimina. Se puede invalidar con motivo en Revisión.'); return; }
  pedirMotivo('Eliminar ' + c.codigo + ' · día ' + c.dia, 'Solo se eliminan roturas sin resultado. Queda registrado en el historial.', function(m){
    roturaCargas = roturaCargas.filter(function(x){ return x !== c; });
    saveRoturaCargas();
    registrarHistorial('Eliminó', 'Rotura', c.codigo + ' · ' + c.replicaNombre + ' · día ' + c.dia + ' · motivo: ' + m, {proyecto: c.proyecto, ref: c.disenoCodigoDiseno});
    renderRoturasAll();
    return '';
  });
}
['ro-formato-tbody-cubos','ro-formato-tbody-probetas'].forEach(function(id){ document.getElementById(id).addEventListener('click', onFormatoClick); });
function usaEnRRGenerado(c){
  return rrEstudios.some(function(e){ return e.generado && e.tipos.some(function(t){ return t.origenDisenoCodigo === c.disenoCodigoDiseno; }); });
}

/* ---- RF-ROT-10: probeta no ubicada ---- */
function marcarNoUbicada(id){
  if(!exigir('roturas:registrar')) return;
  var c = roturaCargas.filter(function(x){ return x.id === id; })[0];
  if(!c || c.estado !== 'pendiente') return;
  pedirMotivo('Probeta no ubicada · ' + c.codigo + ' día ' + c.dia, 'La edad queda incompleta y se avisa al analista.', function(m){
    c.estado = 'no-ubicada'; c.comentarios = m; c.registradoPor = usuarioActual.id; c.registradoTs = Date.now();
    saveRoturaCargas();
    registrarHistorial('Marcó', 'Rotura', c.codigo + ' día ' + c.dia + ' como No ubicada · ' + m, {proyecto: c.proyecto, ref: c.disenoCodigoDiseno});
    notificarResponsablesProyecto(c.proyecto, 'Probeta no ubicada', c.codigo + ' · ' + c.replicaNombre + ' · día ' + c.dia + ': ' + m, 'roturas');
    alCompletarEdad(c);
    renderRoturasAll();
    return '';
  });
}

/* ---- Registrar la rotura (RF-ROT-03 a 09, 14) ---- */
var roturaCargaModalId = null;
/* RF-ROT-14: TEC corrige hasta el fin del día del registro; después solo ANA/JEF con motivo. */
function modoEdicionRotura(c){
  if(c.estado === 'pendiente') return can('roturas:registrar') ? 'nuevo' : 'lectura';
  if(c.estado === 'cancelada' || c.estado === 'invalidada') return 'lectura';
  var rol = rolDe(usuarioActual);
  var d = disenoPorCodigo(c.disenoCodigoDiseno);
  if(d && (d.estado === 'Completado' || d.estado === 'Validado')) return 'lectura';
  if(d && d.revision){ return rol === 'ANA' || rol === 'JEF' ? 'correccion-motivo' : 'lectura'; }   // regla de bloqueo 9
  var mismoDia = new Date(c.registradoTs || 0).toDateString() === new Date().toDateString();
  if(rol === 'TEC') return mismoDia && c.registradoPor === usuarioActual.id ? 'correccion-libre' : 'lectura';
  if(rol === 'ANA' || rol === 'JEF') return mismoDia ? 'correccion-libre' : 'correccion-motivo';
  return 'lectura';
}
function openRoturaCargaModal(id){
  roturaCargaModalId = id;
  var c = roturaCargas.filter(function(x){ return x.id === id; })[0];
  if(!c) return;
  if(!roturaVisible(c)){ toast('Esta rotura no está asignada a vos ni a tu equipo'); return; }
  var modo = modoEdicionRotura(c);
  var lectura = modo === 'lectura';
  var d = disenoPorCodigo(c.disenoCodigoDiseno);
  var p = proyectoPorNombre(c.proyecto) || {};
  var prensas = typeof prensasDisponibles === 'function' ? prensasDisponibles(c.laboratorio || p.laboratorio) : [];
  var dis = lectura ? ' disabled' : '';
  var area = ajuste('areaProbeta');
  document.getElementById('rotura-carga-title').textContent = c.estado === 'pendiente' ? 'Registrar la rotura' : (lectura ? 'Resultado de la rotura' : 'Corregir la rotura');
  document.getElementById('rotura-carga-recap').innerHTML =
    '<div class="rc-recap-info"><span class="rc-recap-nombre">'+(d?esc(diseñoTitulo(d)):esc(c.producto))+'</span><span class="rc-recap-meta">'+esc(c.replicaNombre)+' · día '+c.dia+' · ensayo '+isoToDMY(c.fechaEnsayo)+' · ventana '+esc(ventanaTexto(c))+'</span></div>' +
    '<div class="rc-recap-codigo">'+esc(c.codigo)+'</div>';
  function especimenBlock(mIdx){
    var tipoKey = 'tipoRoturaM'+mIdx, evidKey = 'evid'+mIdx;
    var invalido = !especimenValido(c, mIdx);
    return '<div class="m-especimen-block'+(invalido?' tachado':'')+'" data-m="'+mIdx+'"><h5>M'+mIdx+(invalido?' · invalidado':'')+'</h5><div class="m-especimen-grid">' +
      '<div class="field-mini"><label>Área (cm²)</label><input type="text" inputmode="decimal" id="mc-a'+mIdx+'" value="'+esc(c['a'+mIdx]||area)+'"'+dis+'></div>' +
      '<div class="field-mini"><label>Carga (kN)</label><input type="text" inputmode="decimal" id="mc-m'+mIdx+'kN" value="'+esc(c['m'+mIdx+'kN'])+'"'+dis+'></div>' +
      '<div class="field-mini"><label>Carga (kg)</label><input type="text" inputmode="decimal" id="mc-m'+mIdx+'kg" value="'+esc(c['m'+mIdx+'kg'])+'"'+dis+'></div>' +
      '<div class="field-mini"><label>Tipo de falla</label><select id="mc-'+tipoKey+'"'+dis+'>'+opcionesHtml(catalogo('tiposFalla'), c[tipoKey], '—')+'</select></div>' +
      '<div class="field-mini"><label>kg/cm²</label><input type="text" id="mc-r'+mIdx+'" value="'+esc(c['m'+mIdx+'kgcm2']||'')+'" disabled></div>' +
      '<div class="field-mini"><label>Foto (opcional)</label><div class="evidencia-drop" id="mc-drop-'+mIdx+'" data-evid-key="'+(c[evidKey]||'')+'">'+(c[evidKey]?'Cargando…':(lectura?'—':'Subir foto'))+(lectura?'':'<input type="file" accept="image/*" capture="environment" id="mc-file-'+mIdx+'" style="display:none;">')+'</div></div>' +
    '</div></div>';
  }
  var prensaActual = c.prensa ? c.prensa.id : '';
  var avisoPrensa = !prensas.length ? '<div class="aviso-rojo">No hay prensas habilitadas con calibración vigente en este laboratorio. No se puede registrar la rotura; se avisó a Inventario.</div>' : '';
  document.getElementById('rotura-carga-body').innerHTML =
    (modo === 'correccion-motivo' ? '<p class="aviso-borrador">Rotura registrada en otro día: la corrección pide motivo.</p>' : '') + avisoPrensa +
    '<div class="form-row">' +
      '<div class="field-mini" style="flex:2;"><label>Prensa (habilitada y calibrada)</label><select id="mc-prensa"'+dis+'><option value="">Elegí la prensa…</option>' +
        prensas.map(function(x){ return '<option value="'+esc(x.id)+'"'+(x.id===prensaActual?' selected':'')+'>'+esc(x.nombre)+' · '+esc(x.identificacion)+' · cal. '+isoToDMY(x.calibracion)+'</option>'; }).join('') +
        (c.prensa && !prensas.some(function(x){ return x.id === prensaActual; }) ? '<option value="'+esc(prensaActual)+'" selected>'+esc(c.prensa.nombre)+' (registrada)</option>' : '') + '</select></div>' +
      '<div class="field-mini" style="flex:1;"><label>Hora de ensayo</label><div class="input-con-btn"><input type="time" id="mc-horaEnsayo" value="'+esc(c.horaEnsayo)+'"'+dis+'><button type="button" class="btn-add ghost mini" id="mc-ahora"'+dis+'>Ahora</button></div></div>' +
      '<div class="field-mini" style="flex:1;"><label>Fecha de ensayo</label><input type="date" id="mc-fechaReal" max="'+todayISO()+'" value="'+esc(c.fechaEnsayoReal || (c.fechaEnsayo <= todayISO() ? todayISO() : c.fechaEnsayo))+'"'+dis+'></div>' +
    '</div>' +
    '<div class="mc-unidad-toggle"><span class="mc-unidad-label">Unidad de carga:</span>' +
      '<label class="pp-check-inline"><input type="radio" name="mc-unidad" value="kg"'+((c.unidad||'kg')==='kg'?' checked':'')+dis+'> kg</label>' +
      '<label class="pp-check-inline"><input type="radio" name="mc-unidad" value="kn"'+(c.unidad==='kn'?' checked':'')+dis+'> kN</label>' +
      '<span class="nota-sm">1 kN = 101.9716 kgf</span>' +
      '<button type="button" class="btn-add ghost mini" id="mc-toggle-guia">Guía de tipos de falla</button></div>' +
    '<div id="mc-guia-imagen" style="display:none;margin-bottom:16px;text-align:center;"><img src="'+TIPO_ROTURA_IMG_URL+'" alt="Tipos de falla 1–6" style="max-width:420px;width:100%;border:1px solid var(--line);border-radius:6px;"></div>' +
    especimenBlock(1) + especimenBlock(2) + especimenBlock(3) +
    '<div id="mc-resumen" class="mc-resumen"></div>' +
    '<div class="field-mini" id="mc-disp-wrap" style="display:none;"><label>Comentario por dispersión (obligatorio)</label><input type="text" id="mc-disp" value="'+esc(c.comentarioDispersion||'')+'"'+dis+'></div>' +
    '<div class="field-mini" id="mc-tol-wrap" style="display:none;"><label>Motivo: ensayo fuera de la ventana (obligatorio)</label><input type="text" id="mc-tol" value="'+esc(c.motivoFueraTolerancia||'')+'"'+dis+'></div>' +
    '<div class="field-mini"><label>Comentarios</label><input type="text" id="mc-comentarios" value="'+esc(c.comentarios)+'"'+dis+'></div>' +
    (c.registradoTs ? '<p class="nota-sm">Registrada por '+esc(nombreUsuario(usuarioPorId(c.registradoPor)))+' el '+fechaHora(c.registradoTs)+(c.correcciones && c.correcciones.length ? ' · '+c.correcciones.length+' corrección(es)' : '')+'</p>' : '') +
    '<p class="campo-error" id="mc-err"></p>';
  document.getElementById('rotura-carga-save').style.display = lectura || !prensas.length && c.estado === 'pendiente' ? 'none' : '';
  if(!prensas.length && c.estado === 'pendiente' && typeof notificar === 'function') notificar('INV', 'Sin prensa calibrada', 'No hay prensas habilitadas y calibradas en ' + labLabel(c.laboratorio || p.laboratorio) + ' para romper ' + c.codigo, 'inventario');
  var body = document.getElementById('rotura-carga-body');
  body.querySelector('#mc-toggle-guia').addEventListener('click', function(){
    var img = body.querySelector('#mc-guia-imagen'); img.style.display = img.style.display === 'none' ? 'block' : 'none';
  });
  if(!lectura){
    body.querySelector('#mc-ahora').addEventListener('click', function(){ body.querySelector('#mc-horaEnsayo').value = ahoraHHMM(); actualizarResumenCarga(c); });
    var aplicarUnidad = function(u){ [1,2,3].forEach(function(m){ body.querySelector('#mc-m'+m+'kg').disabled = u === 'kn'; body.querySelector('#mc-m'+m+'kN').disabled = u === 'kg'; }); };
    body.querySelectorAll('input[name="mc-unidad"]').forEach(function(r){ r.addEventListener('change', function(){ aplicarUnidad(this.value); }); });
    aplicarUnidad(c.unidad || 'kg');
    [1,2,3].forEach(function(m){
      var kg = body.querySelector('#mc-m'+m+'kg'), kn = body.querySelector('#mc-m'+m+'kN');
      kg.addEventListener('input', function(){ var v = parseNumero(kg.value); kn.value = v ? (v/KGF_POR_KN).toFixed(2) : ''; actualizarResumenCarga(c); });
      kn.addEventListener('input', function(){ var v = parseNumero(kn.value); kg.value = v ? (v*KGF_POR_KN).toFixed(2) : ''; actualizarResumenCarga(c); });
      body.querySelector('#mc-a'+m).addEventListener('input', function(){ actualizarResumenCarga(c); });
    });
    ['#mc-horaEnsayo', '#mc-fechaReal'].forEach(function(s){ body.querySelector(s).addEventListener('input', function(){ actualizarResumenCarga(c); }); });
  }
  [1,2,3].forEach(function(mIdx){
    var dropEl = body.querySelector('#mc-drop-'+mIdx);
    var fileEl = body.querySelector('#mc-file-'+mIdx);
    if(dropEl.dataset.evidKey){
      loadEvidenciaURL(dropEl.dataset.evidKey).then(function(url){
        dropEl.innerHTML = url ? '<img src="'+url+'">'+(lectura?'':'<br>Cambiar foto') : (lectura ? '—' : 'Subir foto');
        if(fileEl) dropEl.appendChild(fileEl);
      }).catch(function(){});
    }
    if(!fileEl) return;
    dropEl.addEventListener('click', function(){ fileEl.click(); });
    fileEl.addEventListener('change', function(){
      var f = fileEl.files[0];
      if(!f) return;
      if(f.size > 10 * 1024 * 1024){ toast('La foto debe pesar como máximo 10 MB'); return; }
      dropEl.innerHTML = 'Guardando…';
      var newKey = c.id + '_m' + mIdx;
      comprimirImagen(f).then(function(b){ return saveEvidenciaBlob(newKey, b); }).then(function(){
        dropEl.dataset.evidKey = newKey;
        dropEl.innerHTML = '<img src="'+URL.createObjectURL(f)+'"><br>Cambiar foto';
        dropEl.appendChild(fileEl);
      });
    });
  });
  actualizarResumenCarga(c);
  document.getElementById('rotura-carga-modal').classList.add('show');
}
/* Cálculo en vivo + alertas de dispersión (RF-ROT-07) y de ventana (RF-ROT-08). */
function leerFormularioCarga(){
  var body = document.getElementById('rotura-carga-body');
  var q = function(s){ var el = body.querySelector(s); return el ? el.value.trim() : ''; };
  var x = {prensa:q('#mc-prensa'), horaEnsayo:q('#mc-horaEnsayo'), fechaReal:q('#mc-fechaReal'), comentarios:q('#mc-comentarios'),
    comentarioDispersion:q('#mc-disp'), motivoFueraTolerancia:q('#mc-tol'), unidad:(body.querySelector('input[name="mc-unidad"]:checked')||{}).value || 'kg'};
  [1,2,3].forEach(function(m){
    x['a'+m] = q('#mc-a'+m); x['m'+m+'kg'] = q('#mc-m'+m+'kg'); x['m'+m+'kN'] = q('#mc-m'+m+'kN'); x['tipoRoturaM'+m] = q('#mc-tipoRoturaM'+m);
    var dz = body.querySelector('#mc-drop-'+m);
    x['evid'+m] = dz ? dz.dataset.evidKey || '' : '';
  });
  return x;
}
function fueraDeVentana(c, fechaReal, hora){
  if(!fechaReal || !horaValida(hora)) return false;
  var t = new Date(fechaReal + 'T' + hora + ':00').getTime();
  var v = ventanaEnsayo(c);
  return t < v.desde || t > v.hasta;
}
function actualizarResumenCarga(c){
  var body = document.getElementById('rotura-carga-body');
  var x = leerFormularioCarga();
  var vals = [1,2,3].map(function(m){ var r = calcKgCm2(parseNumero(x['m'+m+'kg']), parseNumero(x['a'+m])); var el = body.querySelector('#mc-r'+m); if(el) el.value = r; return r; });
  var st = statsFromValues(vals.filter(function(v, i){ return especimenValido(c, i + 1); }));
  var disp = evaluarDispersion(vals);
  [1,2,3].forEach(function(m){ var b = body.querySelector('.m-especimen-block[data-m="'+m+'"]'); if(b) b.classList.toggle('alerta-dispersion', disp.fuera.indexOf(m) > -1); });
  var fuera = fueraDeVentana(c, x.fechaReal, x.horaEnsayo);
  body.querySelector('#mc-disp-wrap').style.display = disp.alta ? '' : 'none';
  body.querySelector('#mc-tol-wrap').style.display = fuera ? '' : 'none';
  body.querySelector('#mc-resumen').innerHTML = st.promedio ? '<b>Promedio f\'c: ' + st.promedio + ' kg/cm²</b> · desv. est. ' + st.desvest + ' · CV ' + st.coefVar +
    (disp.alta ? ' · <span class="txt-naranja">Dispersión alta' + (disp.fuera.length ? ' (M' + disp.fuera.join(', M') + ' se aleja más de ' + ajuste('dispersionEspecimenPct') + ' %)' : ' (CV > ' + ajuste('dispersionCVPct') + ' %)') + '</span>' : '') +
    (fuera ? ' · <span class="txt-naranja">Fuera de la ventana de ensayo</span>' : '') : '';
}
function validarCarga(c, x){
  var e = [];
  if(!x.prensa) e.push('Elegí la prensa (equipo habilitado con calibración vigente).');
  if(!horaValida(x.horaEnsayo)) e.push('Hora de ensayo obligatoria (hh:mm).');
  if(!x.fechaReal || x.fechaReal > todayISO()) e.push('La fecha de ensayo no puede ser futura.');
  [1,2,3].forEach(function(m){
    if(!especimenValido(c, m)) return;
    var a = parseNumero(x['a'+m]), kg = parseNumero(x['m'+m+'kg']);
    if(!(a >= 50 && a <= 250)) e.push('M'+m+': área entre 50 y 250 cm².');
    if(!(kg > 0)) e.push('M'+m+': la carga debe ser mayor a 0.');
    if(!x['tipoRoturaM'+m]) e.push('M'+m+': elegí el tipo de falla (1–6).');
  });
  return e;
}
document.getElementById('rotura-carga-close').addEventListener('click', function(){ document.getElementById('rotura-carga-modal').classList.remove('show'); });
document.getElementById('rotura-carga-cancel').addEventListener('click', function(){ document.getElementById('rotura-carga-modal').classList.remove('show'); });
document.getElementById('rotura-carga-save').addEventListener('click', function(){
  var c = roturaCargas.filter(function(x){ return x.id === roturaCargaModalId; })[0];
  if(!c || !exigir('roturas:registrar')) return;
  var modo = modoEdicionRotura(c);
  if(modo === 'lectura') return;
  var x = leerFormularioCarga();
  var errores = validarCarga(c, x);
  var vals = [1,2,3].map(function(m){ return calcKgCm2(parseNumero(x['m'+m+'kg']), parseNumero(x['a'+m])); });
  var disp = evaluarDispersion(vals);
  var fuera = fueraDeVentana(c, x.fechaReal, x.horaEnsayo);
  if(disp.alta && x.comentarioDispersion.length < 3) errores.push('Dispersión alta: escribí un comentario.');
  if(fuera && x.motivoFueraTolerancia.length < 3) errores.push('Ensayo fuera de la ventana: indicá el motivo.');
  if(errores.length){ document.getElementById('mc-err').textContent = errores.join(' '); return; }
  var aplicar = function(motivoCorreccion){
    var antes = {promedio:c.promedio, m1kg:c.m1kg, m2kg:c.m2kg, m3kg:c.m3kg};
    var primera = c.estado === 'pendiente';
    var prensa = (typeof prensasDisponibles === 'function' ? prensasDisponibles(c.laboratorio || (proyectoPorNombre(c.proyecto)||{}).laboratorio) : []).filter(function(p){ return p.id === x.prensa; })[0];
    ['horaEnsayo','comentarios','a1','a2','a3','m1kg','m2kg','m3kg','m1kN','m2kN','m3kN','tipoRoturaM1','tipoRoturaM2','tipoRoturaM3','evid1','evid2','evid3','unidad'].forEach(function(k){ c[k] = x[k]; });
    [1,2,3].forEach(function(m){ ['a'+m, 'm'+m+'kg', 'm'+m+'kN'].forEach(function(k){ var v = parseNumero(c[k]); if(isFinite(v)) c[k] = String(v); }); });
    if(prensa) c.prensa = {id:prensa.id, nombre:prensa.nombre, identificacion:prensa.identificacion, calibracion:prensa.calibracion};   // RF-EQU-04
    c.fechaEnsayoReal = x.fechaReal;
    c.fueraTolerancia = fuera; c.motivoFueraTolerancia = fuera ? x.motivoFueraTolerancia : '';
    c.alertaDispersion = disp.alta; c.comentarioDispersion = disp.alta ? x.comentarioDispersion : '';
    if(primera){ c.registradoPor = usuarioActual.id; c.registradoTs = Date.now(); }
    else c.correcciones = (c.correcciones || []).concat([{ts:Date.now(), usuario:usuarioActual.id, motivo:motivoCorreccion || 'Corrección del mismo día', antes:antes}]);
    recalcCarga(c);
    saveRoturaCargas();
    sincronizarEvidenciasRoturas();
    registrarHistorial(primera ? 'Registró' : 'Corrigió', 'Rotura', c.codigo + ' · ' + c.replicaNombre + ' · día ' + c.dia + (c.promedio ? ' · ' + c.promedio + ' kg/cm²' : '') + (fuera ? ' · fuera de ventana' : '') + (motivoCorreccion ? ' · motivo: ' + motivoCorreccion : ''), {proyecto: c.proyecto, ref: c.disenoCodigoDiseno});
    document.getElementById('rotura-carga-modal').classList.remove('show');
    toast((primera ? 'Rotura registrada — ' : 'Rotura corregida — ') + c.codigo + (c.promedio ? ' · ' + c.promedio + ' kg/cm²' : ''));
    if(primera) alCompletarEdad(c);
    renderRoturasAll();
    if(typeof renderExpediente === 'function' && expedienteProyecto) renderExpediente();
    return '';
  };
  if(modo === 'correccion-motivo') pedirMotivo('Corregir rotura ' + c.codigo + ' día ' + c.dia, 'La rotura se registró otro día: la corrección queda con su motivo.', aplicar);
  else aplicar('');
});
/* RF-ROT-15: al registrar la última edad la réplica pasa a Completa y, si el diseño quedó listo, se avisa al ANA. */
function alCompletarEdad(c){
  var d = disenoPorCodigo(c.disenoCodigoDiseno);
  if(!d) return;
  var rep = (d.replicaObjs || []).filter(function(r){ return r.nombre === c.replicaNombre; })[0];
  if(rep && estadoReplica(d, rep) === 'Completa'){
    registrarHistorial('Completó', 'Réplica', rep.nombre + ' (todas sus edades registradas)', {proyecto: c.proyecto, ref: d.codigo});
    if(disenoListoParaRevision(d)) notificarResponsablesProyecto(c.proyecto, 'Diseño listo para revisión', d.codigo + ' · ' + diseñoTitulo(d) + ': todas sus réplicas están completas.', 'revision');
  }
}

/* ---- Insignias del menú ---- */
function updateNavBadges(){
  var hoy = todayISO();
  var countBacklog = roturasVisibles().filter(function(c){ return c.estado==='pendiente' && c.fechaEnsayo <= hoy; }).length;
  var badge = document.getElementById('nav-roturas-badge');
  if(badge){ badge.style.display = countBacklog ? 'inline-block' : 'none'; badge.textContent = countBacklog; }
  var rb = document.getElementById('nav-revision-badge');
  if(rb && typeof disenosParaRevision === 'function'){ var nr = disenosParaRevision().length; rb.style.display = nr ? 'inline-block' : 'none'; rb.textContent = nr; }
  if(typeof actualizarBadgeElaboracion === 'function') actualizarBadgeElaboracion();
  if(typeof actualizarCampana === 'function') actualizarCampana();
}
