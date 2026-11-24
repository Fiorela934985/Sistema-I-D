/* Sistema I+D — Fase 5: Planificación (sección 9). Una sola entrada con tres botones:
   [Plan de trabajo] generador de Gantt por proyecto · [Asignar actividades] tablero lun–dom por usuario · [Calendario].
   · Semanas lunes–domingo partidas en el cambio de mes (respuesta: "partir la semana"): el lunes 30/11/2026 es W5 de
     noviembre (solo ese día) y 01–06/12 es W1 de diciembre. Un primer tramo de un solo día (domingo) se suma a W1.
   · Los avisos al asignar recursos avisan, no bloquean.
   · Notificaciones: cada evento deja su correo en la bandeja (uno por usuario y con el enlace a la pantalla exacta).
     Se envían con Gmail desde la bandeja; el envío automático por el servidor llega con las integraciones (Fase 7). */
'use strict';

var planesTrabajo = load('sid_planes', []);
var actividades = load('sid_actividades', []);
var correos = load('sid_correos', []);
var semanasPublicadas = load('sid_semanas_publicadas', {});
function savePlanes(){ save('sid_planes', planesTrabajo); }
function saveActividades(){ save('sid_actividades', actividades); }
function saveCorreos(){ save('sid_correos', correos); }
function saveSemanas(){ save('sid_semanas_publicadas', semanasPublicadas); }

var MARCAS_PLAN = {ejecucion:'Ejecución', preliminar:'Preliminar', reporte:'Reporte'};
var PRIORIDADES = {alta:'Alta', media:'Media', baja:'Baja'};
var PASOS_ACTIVIDAD = {'':'—', agregados:'Agregados', elaboracion:'Elaboración', fresco:'Estado fresco', endurecido:'Estado endurecido'};
var HITOS_DISENO = [7, 28, 56];

/* ================= SEMANAS PARTIDAS POR MES ================= */
function finDeMes(ym){ var p = ym.split('-').map(Number); var d = new Date(p[0], p[1], 0); return isoDe(d); }
function semanasDelMes(ym){
  var ini = ym + '-01', fin = finDeMes(ym), out = [], d = ini;
  while(d <= fin){
    var dom = addDaysISO(lunesDe(d), 6);
    var hasta = dom < fin ? dom : fin;
    out.push({mes:ym, desde:d, hasta:hasta});
    d = addDaysISO(hasta, 1);
  }
  // Un primer tramo de un solo día (domingo) se suma a la semana siguiente
  if(out.length > 1 && out[0].desde === out[0].hasta){ out[1].desde = out[0].desde; out.shift(); }
  out.forEach(function(s, i){ s.etiqueta = 'W' + (i + 1); });
  return out;
}
function mesesEntre(desde, hasta){
  var out = [], p = desde.split('-').map(Number), q = hasta.split('-').map(Number);
  var y = p[0], m = p[1];
  while(y < q[0] || (y === q[0] && m <= q[1])){ out.push(y + '-' + String(m).padStart(2, '0')); m++; if(m > 12){ m = 1; y++; } if(out.length > 36) break; }
  return out;
}
function semanasEntre(mesIni, mesFin){ var s = []; mesesEntre(mesIni, mesFin).forEach(function(m){ s = s.concat(semanasDelMes(m)); }); return s; }
function semanaDe(iso){ var ss = semanasDelMes(iso.slice(0, 7)); return ss.filter(function(s){ return iso >= s.desde && iso <= s.hasta; })[0]; }
function nombreMes(ym){ var p = ym.split('-'); return MES_NOMBRES[Number(p[1]) - 1] + ' ' + p[0]; }

/* ================= CORREOS (bandeja de notificaciones) ================= */
function correoDe(uid){ var u = usuarioPorId(uid); return u ? (u.correo || '') : ''; }
function urlSistema(hash){ return location.origin + location.pathname + (hash || ''); }
function encolarCorreo(paraId, evento, asunto, lineas, hash){
  if(!paraId) return null;
  var c = {id:Lab.idNuevo('mail'), para_id:paraId, para:nombreDe(paraId), correo:correoDe(paraId), evento:evento, asunto:asunto,
    cuerpo:lineas.join('\n') + '\n\nAbrir en el sistema: ' + urlSistema(hash), enlace:hash || '', estado:'pendiente',
    creado_en:new Date().toISOString(), creado_por:usuarioActual ? usuarioActual.id : ''};
  correos.unshift(c);
  saveCorreos();
  return c;
}
function lideres(){ return usuariosActivos().filter(function(u){ return u.rol === 'lider' || u.rol === 'admin'; }).map(function(u){ return u.id; }); }
function enlaceGmail(c){
  return 'https://mail.google.com/mail/?view=cm&fs=1&to=' + encodeURIComponent(c.correo || '') + '&su=' + encodeURIComponent(c.asunto) + '&body=' + encodeURIComponent(c.cuerpo);
}
/* Lista diaria (5:30 a. m.): cada quien sus diseños pendientes y las roturas de hoy; las atrasadas también al líder.
   Se arma una vez por día, la primera vez que el líder o el administrador abre el sistema. */
function generarListaDiaria(forzar){
  var hoy = todayISO();
  if(!forzar && load('sid_lista_diaria', '') === hoy) return 0;
  save('sid_lista_diaria', hoy);
  var n = 0;
  usuariosActivos().forEach(function(u){
    var mios = disenos.filter(function(d){ return d.asignadoA === u.id && estadoCalculado(d) === 'Abierto'; });
    var hoyR = roturaCargas.filter(function(c){ return c.estado === 'pendiente' && c.aCargoDeId === u.id && cargaActiva(c) && !cargaAtrasada(c); });
    var atr = roturaCargas.filter(function(c){ return c.estado === 'pendiente' && c.aCargoDeId === u.id && cargaAtrasada(c); });
    if(!mios.length && !hoyR.length && !atr.length) return;
    var l = ['Hola ' + (u.nombre || u.usuario) + ', esta es tu lista del ' + isoToDMY(hoy) + '.'];
    if(hoyR.length){ l.push('', 'Roturas de hoy:'); hoyR.forEach(function(c){ l.push('· ' + c.codigo + ' ' + c.dia + 'd ' + textoVentana(c) + ' → registrar: ' + urlSistema('#rotura=' + encodeURIComponent(c.codigo) + '&edad=' + c.dia)); }); }
    if(atr.length){ l.push('', 'Roturas atrasadas:'); atr.forEach(function(c){ l.push('· ' + c.codigo + ' ' + c.dia + 'd (ventana ' + textoVentana(c) + ')'); }); }
    if(mios.length){ l.push('', 'Diseños pendientes:'); mios.forEach(function(d){ l.push('· ' + d.codigo + ' ' + diseñoTitulo(d) + ' — ' + faltaDiseno(d).map(function(f){ return f.texto; }).join(', ')); }); }
    encolarCorreo(u.id, 'Lista diaria', 'Tu lista del ' + isoToDMY(hoy) + (hoyR.length ? ' · ' + hoyR.length + ' rotura(s) hoy' : ''), l, '#inicio');
    n++;
  });
  var atrTodas = roturaCargas.filter(function(c){ return c.estado === 'pendiente' && cargaAtrasada(c); });
  if(atrTodas.length) lideres().forEach(function(id){
    encolarCorreo(id, 'Rotura atrasada', atrTodas.length + ' rotura(s) atrasada(s) en el laboratorio', ['Roturas cuya ventana de tolerancia ya pasó:'].concat(atrTodas.slice(0, 30).map(function(c){ return '· ' + c.codigo + ' ' + c.dia + 'd · ' + (c.proyecto || '') + ' · ' + (c.aCargoDe || ''); })), '#roturas');
    n++;
  });
  return n;
}

/* ================= PANTALLA DE PLANIFICACIÓN ================= */
var planVista = 'hub';
function mostrarVistaPlan(v){
  planVista = v;
  document.getElementById('panel-planificacion').classList.toggle('plan-subvista', v !== 'hub');
  document.getElementById('plan-hub').style.display = v === 'hub' ? '' : 'none';
  document.getElementById('plan-vista-plan').style.display = v === 'plan' ? '' : 'none';
  document.getElementById('plan-vista-actividades').style.display = v === 'actividades' ? '' : 'none';
  document.querySelectorAll('#panel-planificacion [data-plan-vista]').forEach(function(b){ b.classList.toggle('activo', b.dataset.planVista === v); });
  if(v === 'hub') renderPlanHub();
  if(v === 'plan') renderPlanes();
  if(v === 'actividades') renderTablero();
}
function planesVisibles(){
  var yo = usuarioActual ? usuarioActual.id : '';
  var todos = usuarioActual && (usuarioActual.rol === 'admin' || usuarioActual.rol === 'lider');
  return planesTrabajo.filter(function(p){
    if(p.anulado) return false;
    if(todos) return true;
    return p.creado_por === yo || (p.etapas || []).some(function(e){ return e.items.some(function(i){ return i.responsable_id === yo; }); });
  });
}
function hitosProximos(dias){
  var hoy = todayISO(), lim = addDaysISO(hoy, dias || 30), out = [];
  planesVisibles().forEach(function(p){
    (p.etapas || []).forEach(function(e){ e.items.forEach(function(it){
      if(it.marca === 'reporte' && it.fin >= hoy && it.fin <= lim) out.push({fecha:it.fin, texto:'Reporte · ' + it.nombre, plan:p});
      hitosDeItem(it).forEach(function(h){ if(h.fecha >= hoy && h.fecha <= lim) out.push({fecha:h.fecha, texto:h.etiqueta + ' · ' + it.nombre, plan:p}); });
    }); });
  });
  return out.sort(function(a,b){ return a.fecha.localeCompare(b.fecha); });
}
function renderPlanHub(){
  var lunes = lunesDe(todayISO());
  var sinPublicar = actividades.filter(function(a){ return !a.anulada && a.semana === lunes && a.estado === 'borrador'; }).length;
  var hitos = hitosProximos(30);
  var pend = correos.filter(function(c){ return c.estado === 'pendiente'; });
  var semana = roturaCargas.filter(function(c){ return c.estado === 'pendiente' && c.fechaEnsayo >= lunes && c.fechaEnsayo <= addDaysISO(lunes, 6); }).length;
  document.getElementById('plan-resumen').innerHTML =
    kpiCard('kpi-negro', ICO_DISENO, planesVisibles().length, 'Planes de trabajo activos') +
    kpiCard('kpi-naranja', ICO_ACTIVO, sinPublicar, 'Actividades de esta semana sin publicar') +
    kpiCard('kpi-verde', ICO_RESIST, hitos.length, 'Hitos en los próximos 30 días') +
    kpiCard('kpi-rojo', ICO_ALERTA, semana, 'Roturas programadas esta semana');
  document.getElementById('plan-hitos').innerHTML = '<div class="section-num">Próximos hitos</div>' + (hitos.length ? '<ul class="plan-lista">' + hitos.slice(0, 8).map(function(h){
    return '<li><span class="chip-edad">' + isoToDMY(h.fecha).slice(0, 5) + '</span> ' + esc(h.texto) + ' <span class="nota-sm">' + esc(h.plan.proyecto) + '</span></li>'; }).join('') + '</ul>' : '<p class="nota-sm">Sin hitos en los próximos 30 días.</p>');
  renderBandeja();
}
function renderBandeja(){
  var wrap = document.getElementById('plan-correos');
  var yo = usuarioActual ? usuarioActual.id : '';
  var lider = can('actividades:publicar');
  var lista = correos.filter(function(c){ return lider || c.para_id === yo; });
  var pend = lista.filter(function(c){ return c.estado === 'pendiente'; });
  wrap.innerHTML = '<div class="ev-toolbar"><span class="section-num" style="margin:0;">Correos por enviar <span class="badge-pill">' + pend.length + '</span></span>' +
    (lider ? '<button class="btn-add ghost" data-correo-acc="diaria">Armar lista diaria</button>' : '') + '</div>' +
    (lista.length ? '<div class="table-scroll"><table class="data-table"><thead><tr><th>Evento</th><th>Para</th><th>Asunto</th><th>Creado</th><th>Estado</th><th></th></tr></thead><tbody>' + lista.slice(0, 40).map(function(c){
      return '<tr><td>' + esc(c.evento) + '</td><td>' + esc(c.para) + (c.correo ? '<div class="nota-sm">' + esc(c.correo) + '</div>' : '<div class="nota-sm chip-falta">sin correo</div>') + '</td>' +
        '<td>' + esc(c.asunto) + '</td><td>' + new Date(c.creado_en).toLocaleString('es-PE', {dateStyle:'short', timeStyle:'short'}) + '</td>' +
        '<td>' + (c.estado === 'enviado' ? '<span class="chip-ok">Enviado</span>' : '<span class="chip-falta">Pendiente</span>') + '</td>' +
        '<td class="acciones-fila"><button class="btn-add ghost" data-correo-acc="ver" data-id="' + esc(c.id) + '">Ver</button>' +
        (c.estado === 'pendiente' && lider ? '<a class="btn-add" target="_blank" rel="noopener" href="' + esc(enlaceGmail(c)) + '" data-correo-acc="gmail" data-id="' + esc(c.id) + '">Enviar con Gmail</a>' : '') + '</td></tr>';
    }).join('') + '</tbody></table></div>' : '<p class="nota-sm">Sin correos.</p>');
}
function marcarCorreoEnviado(id){
  var c = correos.filter(function(x){ return x.id === id; })[0];
  if(!c || c.estado === 'enviado') return;
  c.estado = 'enviado'; c.enviado_en = new Date().toISOString(); c.enviado_por = usuarioActual.id;
  saveCorreos();
  registrarHistorial('Envió', 'Correos', c.evento + ' · ' + c.para + ' · ' + c.asunto, {ref:c.id});
}

/* ================= PLAN DE TRABAJO (Gantt) ================= */
var planSelId = null, planEd = null;
function siguienteCodigoPlan(){
  var anio = new Date().getFullYear(), max = 0;
  planesTrabajo.forEach(function(p){ var m = /^PT-(\d{4})-(\d+)$/.exec(p.codigo || ''); if(m && Number(m[1]) === anio) max = Math.max(max, Number(m[2])); });
  return 'PT-' + anio + '-' + String(max + 1).padStart(3, '0');
}
function nuevoPlan(proyecto){
  var hoy = todayISO();
  return {id:Lab.idNuevo('pt'), codigo:siguienteCodigoPlan(), proyecto:proyecto || proyectoFlujo || PROYECTO_CATALOGO[0] || '', nombre:'Plan de trabajo', origen:'generador',
    mes_inicio:hoy.slice(0, 7), mes_fin:addDaysISO(hoy, 90).slice(0, 7), etapas:[{id:Lab.idNuevo('et'), nombre:'Etapa 1', items:[]}],
    archivo:null, creado_por:usuarioActual.id, creado_en:new Date().toISOString(), nuevo:true};
}
function itemNuevo(){
  var hoy = todayISO();
  return {id:Lab.idNuevo('it'), nombre:'', inicio:hoy, fin:addDaysISO(hoy, 6), marca:'ejecucion', responsable_id:'', ensayo_id:'', diseno_codigo:'', recursos:''};
}
function hitosDeItem(it){
  var d = it.diseno_codigo ? disenoPorCodigo(it.diseno_codigo) : null;
  if(!d) return [];
  var el = (d.replicaObjs || []).map(function(r){ return r.elaboracion && r.elaboracion.fecha; }).filter(Boolean).sort()[0] || it.inicio;
  return HITOS_DISENO.map(function(dias){ return {etiqueta:'R' + dias, fecha:addDaysISO(el, dias)}; });
}
/* Avisos al asignar recursos: avisan, no bloquean */
function avisosItem(plan, it){
  var av = [];
  var u = it.responsable_id ? usuarioPorId(it.responsable_id) : null;
  if(u && it.ensayo_id && u.rol === 'tecnico' && !Lab.estaAutorizado(u.id, it.ensayo_id, it.inicio)) av.push((u.nombre || u.usuario) + ' no está autorizado para ' + ((Lab.ensayo(it.ensayo_id) || {}).nombre || 'ese ensayo'));
  if(it.inicio && it.fin && it.fin < it.inicio) av.push('La fecha de fin es anterior al inicio');
  if(it.inicio && (it.inicio < plan.mes_inicio + '-01' || it.fin > finDeMes(plan.mes_fin))) av.push('Fuera del rango del plan');
  var recursos = String(it.recursos || '').split(',').map(function(x){ return normalizar(x); }).filter(Boolean);
  if(recursos.length) planesTrabajo.forEach(function(p){
    if(p.id === plan.id || p.anulado) return;
    (p.etapas || []).forEach(function(e){ e.items.forEach(function(o){
      var cruza = o.inicio <= it.fin && o.fin >= it.inicio;
      var comun = String(o.recursos || '').split(',').map(function(x){ return normalizar(x); }).filter(function(x){ return x && recursos.indexOf(x) > -1; });
      if(cruza && comun.length) av.push('Recurso «' + comun[0] + '» ocupado en ' + p.codigo + ' (' + o.nombre + ')');
    }); });
  });
  return av;
}
function renderPlanes(){
  var cont = document.getElementById('plan-vista-plan');
  var lista = planesVisibles();
  if(planSelId && !planEd){ var p0 = lista.filter(function(p){ return p.id === planSelId; })[0]; planEd = p0 ? JSON.parse(JSON.stringify(p0)) : null; }
  cont.innerHTML = '<div class="plan-cab"><button class="btn-link" data-plan-vista="hub">← Planificación</button><h3>Plan de trabajo</h3>' +
      '<button class="btn-add verde" data-plan-acc="nuevo" data-perm="planes:gestionar">+ Nuevo plan</button></div>' +
    '<div class="plan-layout"><aside class="plan-lista-planes">' + (lista.length ? lista.map(function(p){
      return '<button class="plan-item-lista' + (planEd && planEd.id === p.id ? ' activo' : '') + '" data-plan-sel="' + esc(p.id) + '"><b>' + esc(p.nombre) + '</b><span class="mono">' + esc(p.codigo) + '</span><span>' + esc(p.proyecto) + ' · ' + nombreMes(p.mes_inicio).slice(0, 3) + '–' + nombreMes(p.mes_fin) + '</span></button>';
    }).join('') : '<p class="nota-sm">Sin planes.</p>') + '</aside>' +
    '<div class="plan-editor" id="plan-editor">' + (planEd ? editorPlanHtml(planEd) : '<div class="empty-note">Sin plan seleccionado.</div>') + '</div></div>';
  if(planEd) renderGantt();
}
function editorPlanHtml(p){
  var editable = can('planes:gestionar');
  var dis = editable ? '' : ' disabled';
  var disenosProy = disenos.filter(function(d){ return proyectoNombre(d.proyectoId) === p.proyecto; });
  var ensayos = Lab.ensayos(true);
  var filaItem = function(e, it){
    var av = avisosItem(p, it);
    return '<tr data-et="' + esc(e.id) + '" data-it="' + esc(it.id) + '">' +
      '<td><input class="fmt-in fmt-largo" data-pf="nombre" value="' + esc(it.nombre) + '" placeholder="Ítem"' + dis + '></td>' +
      '<td><input type="date" class="fmt-in fmt-fecha-in" data-pf="inicio" value="' + esc(it.inicio) + '"' + dis + '></td>' +
      '<td><input type="date" class="fmt-in fmt-fecha-in" data-pf="fin" value="' + esc(it.fin) + '" min="' + esc(it.inicio) + '"' + (it.mismo_dia ? ' disabled' : dis) + '>' +
        '<label class="mismo-dia"><input type="checkbox" data-pf-mismo' + (it.mismo_dia ? ' checked' : '') + dis + '> Mismo día</label></td>' +
      '<td><select class="fmt-in" data-pf="marca"' + dis + '>' + Object.keys(MARCAS_PLAN).map(function(k){ return '<option value="' + k + '"' + (it.marca === k ? ' selected' : '') + '>' + MARCAS_PLAN[k] + '</option>'; }).join('') + '</select></td>' +
      '<td><select class="fmt-in" data-pf="responsable_id"' + dis + '>' + opcionesUsuariosHtml(it.responsable_id, '—') + '</select></td>' +
      '<td><select class="fmt-in" data-pf="ensayo_id"' + dis + '><option value="">—</option>' + ensayos.map(function(x){ return '<option value="' + x.id + '"' + (it.ensayo_id === x.id ? ' selected' : '') + '>' + esc(x.nombre) + '</option>'; }).join('') + '</select></td>' +
      '<td><select class="fmt-in" data-pf="diseno_codigo"' + dis + '><option value="">—</option>' + disenosProy.map(function(d){ return '<option value="' + esc(d.codigo) + '"' + (it.diseno_codigo === d.codigo ? ' selected' : '') + '>' + esc(d.codigo + ' ' + diseñoTitulo(d)) + '</option>'; }).join('') + '</select></td>' +
      '<td><input class="fmt-in fmt-medio" data-pf="recursos" value="' + esc(it.recursos) + '" placeholder="Equipos, materiales"' + dis + '></td>' +
      '<td>' + (av.length ? av.map(function(a){ return '<span class="chip-falta">' + esc(a) + '</span>'; }).join(' ') : '<span class="nota-sm">—</span>') + '</td>' +
      '<td class="acciones-fila">' + (p.nuevo ? '' : '<button class="btn-add ghost" data-plan-acc="actividad" data-perm="actividades:publicar" title="Pasar a actividades de la semana">→ Actividad</button>') +
        (editable ? '<button class="btn-icon danger" data-plan-acc="quitar-item" title="Quitar ítem">×</button>' : '') + '</td></tr>';
  };
  return '<div class="pred-form plan-datos">' +
      '<div class="pp-field"><label>Proyecto</label><select id="pl-proyecto"' + dis + '>' + PROYECTO_CATALOGO.map(function(x){ return '<option' + (x === p.proyecto ? ' selected' : '') + '>' + esc(x) + '</option>'; }).join('') + '</select></div>' +
      '<div class="pp-field"><label>Nombre</label><input id="pl-nombre" value="' + esc(p.nombre) + '"' + dis + '></div>' +
      '<div class="pp-field span-2"><label>Origen</label><div class="elab-tipo"><label class="pp-check-inline"><input type="radio" name="pl-origen" value="generador"' + (p.origen !== 'archivo' ? ' checked' : '') + dis + '> Crear con el generador</label><label class="pp-check-inline"><input type="radio" name="pl-origen" value="archivo"' + (p.origen === 'archivo' ? ' checked' : '') + dis + '> Subir un plan existente</label></div></div>' +
      '<div class="pp-field"><label>Mes de inicio</label><input type="month" id="pl-mes-ini" value="' + esc(p.mes_inicio) + '"' + dis + '></div>' +
      '<div class="pp-field"><label>Mes de fin</label><input type="month" id="pl-mes-fin" value="' + esc(p.mes_fin) + '"' + dis + '></div>' +
      '<div class="pp-field"><label>Código</label><input value="' + esc(p.codigo) + '" disabled></div>' +
    '</div>' +
    (p.origen === 'archivo' ? '<div class="card plan-archivo"><div class="section-num">Plan subido</div>' + (p.archivo ? '<p><b>' + esc(p.archivo.nombre) + '</b> · ' + Math.round(p.archivo.tam / 1024) + ' KB · <button class="btn-link" data-plan-acc="descargar">Descargar</button></p>' : '<p class="nota-sm">Sin archivo.</p>') +
      (editable ? '<input type="file" id="pl-archivo" accept=".pdf,.pptx,.xlsx,application/pdf,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet">' : '') + '</div>' : '') +
    (p.origen !== 'archivo' ? '<div class="plan-etapas">' + p.etapas.map(function(e){
      return '<div class="card plan-etapa" data-et="' + esc(e.id) + '"><div class="ev-toolbar"><input class="fmt-in plan-etapa-nombre" data-ef="nombre" value="' + esc(e.nombre) + '"' + dis + '>' +
        (editable ? '<span class="ch-actions"><button class="btn-add ghost" data-plan-acc="item">+ Ítem</button><button class="btn-icon danger" data-plan-acc="quitar-etapa" title="Quitar etapa">×</button></span>' : '') + '</div>' +
        '<div class="table-scroll"><table class="data-table plan-items"><thead><tr><th>Ítem</th><th>Inicio</th><th>Fin</th><th>Marca</th><th>Responsable</th><th>Ensayo</th><th>Diseño ligado</th><th>Recursos</th><th>Avisos</th><th></th></tr></thead><tbody>' +
        (e.items.length ? e.items.map(function(it){ return filaItem(e, it); }).join('') : '<tr><td colspan="10" class="nota-sm">Sin ítems.</td></tr>') + '</tbody></table></div></div>';
    }).join('') + (editable ? '<button class="btn-add ghost" data-plan-acc="etapa">+ Etapa</button>' : '') + '</div>' : '') +
    '<div class="plan-acciones">' + (editable ? '<button class="btn-add verde" data-plan-acc="guardar">Guardar plan</button>' : '') +
      (p.origen !== 'archivo' ? '<button class="btn-add ghost" data-plan-acc="pdf">Descargar PDF</button><button class="btn-add ghost" data-plan-acc="pptx">Descargar PPTX</button>' : '') + '</div>' +
    (p.origen !== 'archivo' ? '<div class="card"><div class="section-num">Gantt</div><div class="gantt-leyenda"><span><i class="gl-ejec"></i>Ejecución</span><span><i class="gl-prel"></i>Preliminar</span><span><i class="gl-rep">R</i>Reporte</span><span><i class="gl-hito">◆</i>Hitos R7 · R28 · R56</span></div><div class="table-scroll" id="gantt-wrap"></div></div>' : '');
}
function diasEntre(a, b){ return Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / DAY); }
/* Posición de un tramo dentro de la celda de una semana: la celda representa sus días, la barra solo los días que dura */
function tramoEnSemana(s, ini, fin){
  var n = diasEntre(s.desde, s.hasta) + 1;
  var oi = ini > s.desde ? ini : s.desde, of = fin < s.hasta ? fin : s.hasta;
  return {left:diasEntre(s.desde, oi) / n * 100, width:(diasEntre(oi, of) + 1) / n * 100};
}
function posDia(s, iso){ var n = diasEntre(s.desde, s.hasta) + 1; return (diasEntre(s.desde, iso) + .5) / n * 100; }
function renderGantt(){
  var wrap = document.getElementById('gantt-wrap');
  if(!wrap || !planEd) return;
  if(!planEd.mes_inicio || !planEd.mes_fin || planEd.mes_fin < planEd.mes_inicio){ wrap.innerHTML = '<p class="nota-sm">Revisá el rango de meses.</p>'; return; }
  var sem = semanasEntre(planEd.mes_inicio, planEd.mes_fin);
  var hoy = todayISO();
  var meses = mesesEntre(planEd.mes_inicio, planEd.mes_fin);
  var cab1 = '<tr><th class="g-nombre" rowspan="2">' + esc(planEd.nombre) + '<div class="nota-sm">' + esc(planEd.proyecto) + '</div></th>' + meses.map(function(m){ return '<th colspan="' + sem.filter(function(s){ return s.mes === m; }).length + '" class="g-mes">' + esc(nombreMes(m)) + '</th>'; }).join('') + '</tr>';
  var cab2 = '<tr>' + sem.map(function(s){ return '<th class="g-sem' + (hoy >= s.desde && hoy <= s.hasta ? ' g-hoy' : '') + '" title="' + isoToDMY(s.desde) + ' – ' + isoToDMY(s.hasta) + '">' + s.etiqueta + '<small>' + Number(s.desde.slice(8)) + '–' + Number(s.hasta.slice(8)) + '</small></th>'; }).join('') + '</tr>';
  var filas = planEd.etapas.map(function(e){
    var r = '<tr class="g-etapa"><td class="g-nombre"><b>' + esc(e.nombre) + '</b></td>' + sem.map(function(){ return '<td></td>'; }).join('') + '</tr>';
    return r + e.items.map(function(it){
      var hitos = hitosDeItem(it);
      var ultimo = -1;
      sem.forEach(function(s, i){ if(it.inicio <= s.hasta && it.fin >= s.desde) ultimo = i; });
      return '<tr><td class="g-nombre">' + esc(it.nombre || '(sin nombre)') + '<div class="nota-sm">' + esc(nombreDe(it.responsable_id) || '') + '</div></td>' + sem.map(function(s, i){
        var en = it.inicio && it.fin && it.inicio <= s.hasta && it.fin >= s.desde;
        var hito = hitos.filter(function(h){ return h.fecha >= s.desde && h.fecha <= s.hasta; });
        var arr = can('planes:gestionar') ? 'true' : 'false';
        var dur = diasEntre(it.inicio, it.fin) + 1;
        var tip = esc(it.nombre) + ' · ' + isoToDMY(it.inicio) + (dur > 1 ? ' – ' + isoToDMY(it.fin) + ' (' + dur + ' días)' : ' (1 día)');
        var barras = '';
        if(en){
          var t = tramoEnSemana(s, it.inicio, it.fin);
          var cls = it.marca === 'ejecucion' ? 'g-ejec' : 'g-prel';
          barras = '<span class="g-bar ' + cls + '" style="left:' + t.left.toFixed(2) + '%;width:' + t.width.toFixed(2) + '%" title="' + tip + '" draggable="' + arr + '" data-g-drag="' + esc(it.id) + '" data-g-sem="' + i + '"></span>';
          if(it.marca === 'reporte' && i === ultimo) barras += '<span class="g-bar g-rep" style="left:' + posDia(s, it.fin).toFixed(2) + '%" title="' + tip + '" draggable="' + arr + '" data-g-drag="' + esc(it.id) + '" data-g-sem="' + i + '">R</span>';
        }
        return '<td class="g-celda' + (hoy >= s.desde && hoy <= s.hasta ? ' g-hoy' : '') + '" data-g-sem="' + i + '" data-g-item="' + esc(it.id) + '">' + barras +
          hito.map(function(h){ return '<span class="g-hito" style="left:' + posDia(s, h.fecha).toFixed(2) + '%" title="' + h.etiqueta + ' · ' + isoToDMY(h.fecha) + '">◆' + h.etiqueta + '</span>'; }).join('') + '</td>';
      }).join('') + '</tr>';
    }).join('');
  }).join('');
  wrap.innerHTML = '<table class="gantt" id="gantt-tabla"><thead>' + cab1 + cab2 + '</thead><tbody>' + filas + '</tbody></table>';
  wrap.dataset.semanas = JSON.stringify(sem);
}
function buscarItem(id){ var r = null; (planEd ? planEd.etapas : []).forEach(function(e){ e.items.forEach(function(it){ if(it.id === id) r = {etapa:e, item:it}; }); }); return r; }
function leerCabeceraPlan(){
  if(!planEd) return;
  var v = function(id){ var el = document.getElementById(id); return el ? el.value : ''; };
  planEd.proyecto = v('pl-proyecto') || planEd.proyecto;
  planEd.nombre = v('pl-nombre').trim() || planEd.nombre;
  planEd.mes_inicio = v('pl-mes-ini') || planEd.mes_inicio;
  planEd.mes_fin = v('pl-mes-fin') || planEd.mes_fin;
  var o = document.querySelector('input[name="pl-origen"]:checked'); if(o) planEd.origen = o.value;
}
function guardarPlan(){
  if(!exigir('planes:gestionar')) return;
  leerCabeceraPlan();
  if(planEd.mes_fin < planEd.mes_inicio){ toast('El mes de fin es anterior al de inicio'); return; }
  var sinNombre = planEd.etapas.some(function(e){ return e.items.some(function(it){ return !it.nombre.trim(); }); });
  if(sinNombre){ toast('Cada ítem necesita un nombre'); return; }
  var esNuevo = !!planEd.nuevo;
  delete planEd.nuevo;
  planEd.actualizado_en = new Date().toISOString();
  var i = planesTrabajo.findIndex(function(p){ return p.id === planEd.id; });
  var copia = JSON.parse(JSON.stringify(planEd));
  if(i === -1) planesTrabajo.push(copia); else planesTrabajo[i] = copia;
  savePlanes();
  var nItems = planEd.etapas.reduce(function(a, e){ return a + e.items.length; }, 0);
  registrarHistorial(esNuevo ? 'Creó' : 'Editó', 'Planificación', planEd.codigo + ' · ' + planEd.nombre + ' · ' + planEd.etapas.length + ' etapa(s), ' + nItems + ' ítem(s)', {codigo:planEd.codigo, proyecto:planEd.proyecto, ref:planEd.id});
  planSelId = planEd.id;
  toast('Plan guardado');
  renderPlanes();
}
function exportarGantt(formato){
  var tabla = document.getElementById('gantt-tabla');
  if(!tabla){ toast('Agregá ítems para generar el plan'); return; }
  if(typeof html2canvas === 'undefined'){ toast('No se pudo cargar la librería de imágenes'); return; }
  toast('Generando ' + formato.toUpperCase() + '…');
  var nombre = 'Plan de trabajo ' + planEd.codigo + ' - ' + planEd.proyecto;
  html2canvas(tabla, {backgroundColor:'#ffffff', scale:2}).then(function(canvas){
    var img = canvas.toDataURL('image/png');
    var titulo = 'Plan de trabajo · ' + planEd.proyecto + ' · ' + planEd.codigo + ' · ' + nombreMes(planEd.mes_inicio) + ' – ' + nombreMes(planEd.mes_fin);
    if(formato === 'pdf'){
      var pdf = new window.jspdf.jsPDF({orientation:'landscape', unit:'mm', format:'a4'});
      var w = 277, h = Math.min(180, w * canvas.height / canvas.width);
      pdf.setFontSize(13); pdf.text(titulo, 10, 12);
      pdf.addImage(img, 'PNG', 10, 18, h < 180 ? w : 180 * canvas.width / canvas.height, h);
      pdf.save(nombre + '.pdf');
    } else {
      cargarScript('https://cdnjs.cloudflare.com/ajax/libs/pptxgenjs/3.12.0/pptxgen.bundle.js', function(){ return typeof PptxGenJS !== 'undefined'; }).then(function(){
        var pptx = new PptxGenJS();
        pptx.layout = 'LAYOUT_WIDE';
        var s = pptx.addSlide();
        s.addText(titulo, {x:0.4, y:0.25, w:12.5, h:0.5, fontSize:18, bold:true, color:'14181A'});
        s.addText('Ejecución ▬   Preliminar ┄   Reporte R   Hitos ◆ R7 · R28 · R56', {x:0.4, y:0.75, w:12.5, h:0.3, fontSize:10, color:'555555'});
        var w2 = 12.5, h2 = Math.min(6.2, w2 * canvas.height / canvas.width);
        s.addImage({data:img, x:0.4, y:1.1, w:h2 < 6.2 ? w2 : 6.2 * canvas.width / canvas.height, h:h2});
        return pptx.writeFile({fileName:nombre + '.pptx'});
      }).catch(function(){ toast('No se pudo cargar la librería de PowerPoint'); });
    }
    registrarHistorial('Exportó', 'Planificación', planEd.codigo + ' · ' + formato.toUpperCase(), {codigo:planEd.codigo, proyecto:planEd.proyecto, ref:planEd.id});
  });
}
function cargarScript(url, listo){
  if(listo()) return Promise.resolve();
  return new Promise(function(ok, mal){ var s = document.createElement('script'); s.src = url; s.onload = function(){ listo() ? ok() : mal(); }; s.onerror = mal; document.head.appendChild(s); });
}

/* ================= ACTIVIDADES DE LA SEMANA ================= */
var semanaTablero = lunesDe(todayISO());
function actividadesDeSemana(lunes){
  var dom = addDaysISO(lunes, 6);
  return actividades.filter(function(a){ return !a.anulada && a.desde <= dom && a.hasta >= lunes; });
}
/* Si la actividad está ligada a un diseño y a un paso, se marca sola cuando el diseño completa ese paso */
function actividadHecha(a){
  if(a.hecha) return true;
  if(a.diseno_codigo && a.paso){ var d = disenoPorCodigo(a.diseno_codigo); return !!d && estadoPaso(d, a.paso) === 'hecho'; }
  return false;
}
function personasTablero(){
  return usuariosActivos().filter(function(u){ return u.rol !== 'admin' || actividadesDeSemana(semanaTablero).some(function(a){ return a.responsable_id === u.id; }); });
}
function renderTablero(){
  var cont = document.getElementById('plan-vista-actividades');
  var lunes = semanaTablero, dom = addDaysISO(lunes, 6);
  var lista = actividadesDeSemana(lunes);
  var pub = semanasPublicadas[lunes];
  var borr = lista.filter(function(a){ return a.estado === 'borrador'; }).length;
  var puede = can('actividades:publicar');
  var yo = usuarioActual ? usuarioActual.id : '';
  var personas = puede ? personasTablero() : usuariosActivos().filter(function(u){ return u.id === yo; });
  var dias = []; for(var i = 0; i < 7; i++) dias.push(addDaysISO(lunes, i));
  cont.innerHTML = '<div class="plan-cab"><button class="btn-link" data-plan-vista="hub">← Planificación</button><h3>Asignar actividades</h3>' +
      '<div class="cal-toolbar plan-semana"><button class="cal-nav" data-act-sem="-7">‹</button><b>' + isoToDMY(lunes).slice(0, 5) + ' – ' + isoToDMY(dom) + '</b><button class="cal-nav" data-act-sem="7">›</button><button class="btn-ghost" data-act-sem="hoy">Esta semana</button>' +
      '<span class="tag-pill ' + (pub ? 'tag-verde' : 'tag-gris') + '">' + (pub ? 'Publicada ' + new Date(pub.publicada_en).toLocaleDateString('es-PE') : 'Borrador') + '</span>' + (borr && pub ? '<span class="chip-falta">' + borr + ' nueva(s) sin enviar</span>' : '') + '</div>' +
      (puede ? '<span class="ch-actions"><button class="btn-add ghost" data-act-acc="nueva" data-perm="actividades:publicar">+ Actividad</button><button class="btn-add verde" data-act-acc="publicar" data-perm="actividades:publicar">' + (pub ? 'Enviar novedades' : 'Publicar semana') + '</button></span>' : '') + '</div>' +
    '<div class="tablero" style="--cols:' + Math.max(1, personas.length) + '">' + personas.map(function(u){
      var suyas = lista.filter(function(a){ return a.responsable_id === u.id; }).sort(function(a,b){ return a.desde.localeCompare(b.desde) || ({alta:0, media:1, baja:2}[a.prioridad] - {alta:0, media:1, baja:2}[b.prioridad]); });
      return '<div class="tab-col"><div class="tab-col-cab"><b>' + esc(u.nombre || u.usuario) + '</b><span class="nota-sm">' + esc(rolLabel(u.rol)) + ' · ' + suyas.length + '</span></div>' +
        (suyas.length ? suyas.map(function(a){
          var hecha = actividadHecha(a), d = a.diseno_codigo ? disenoPorCodigo(a.diseno_codigo) : null;
          var propia = a.responsable_id === yo;
          return '<div class="act-card p-' + a.prioridad + (hecha ? ' hecha' : '') + '" data-act-id="' + esc(a.id) + '">' +
            '<label class="act-check"><input type="checkbox" data-act-acc="hecha"' + (hecha ? ' checked' : '') + ((propia || puede) && !(a.diseno_codigo && a.paso) ? '' : ' disabled') + '> <b>' + esc(a.titulo) + '</b></label>' +
            '<div class="nota-sm">' + esc(a.proyecto) + ' · ' + (a.desde === a.hasta ? DIA_NOMBRES[new Date(a.desde + 'T00:00:00').getDay()] + ' ' + isoToDMY(a.desde).slice(0, 5) : isoToDMY(a.desde).slice(0, 5) + '–' + isoToDMY(a.hasta).slice(0, 5)) + '</div>' +
            '<div class="act-chips"><span class="chip-edad">' + PRIORIDADES[a.prioridad] + '</span>' + (d ? '<span class="chip-edad mono">' + esc(d.codigo) + (a.paso ? ' · ' + PASOS_ACTIVIDAD[a.paso] : '') + '</span>' : '') +
              '<span class="tag-pill ' + (a.estado === 'publicada' ? 'tag-verde' : 'tag-gris') + '">' + (a.estado === 'publicada' ? 'Publicada' : 'Borrador') + '</span></div>' +
            (puede ? '<div class="act-acc"><button class="btn-link" data-act-acc="editar">Editar</button><button class="btn-link" data-act-acc="anular">Anular</button></div>' : '') + '</div>';
        }).join('') : '<p class="nota-sm">Sin actividades.</p>') + '</div>';
    }).join('') + '</div>';
}
var actEditId = null;
function abrirActividad(a, base){
  if(!exigir('actividades:publicar')) return;
  actEditId = a ? a.id : null;
  var x = a || Object.assign({titulo:'', responsable_id:'', proyecto:proyectoFlujo || '', desde:semanaTablero, hasta:semanaTablero, prioridad:'media', diseno_codigo:'', paso:''}, base || {});
  if(!document.getElementById('act-modal')){
    document.body.insertAdjacentHTML('beforeend', '<div id="act-modal" class="sid-modal"><div class="modal-card wide"><div class="modal-header"><h3 id="act-titulo-modal">Actividad</h3><button class="modal-close" data-close="act-modal">×</button></div><div class="modal-body" id="act-body"></div>' +
      '<div class="modal-actions"><button class="btn-add verde" id="act-guardar">Guardar</button><button class="btn-add ghost" data-close="act-modal">Cancelar</button></div></div></div>');
    document.getElementById('act-guardar').addEventListener('click', guardarActividad);
    document.getElementById('act-modal').addEventListener('change', function(e){
      if(e.target.id === 'act-proyecto') document.getElementById('act-diseno').innerHTML = opcionesDisenoProyecto(e.target.value, '');
      var mismo = document.getElementById('act-mismo'), hasta = document.getElementById('act-hasta'), desde = document.getElementById('act-desde');
      if(e.target.id === 'act-mismo' || e.target.id === 'act-desde'){ hasta.disabled = mismo.checked; if(mismo.checked) hasta.value = desde.value; }
    });
  }
  document.getElementById('act-titulo-modal').textContent = a ? 'Editar actividad' : '+ Actividad';
  document.getElementById('act-body').innerHTML = '<div class="pred-form">' +
    '<div class="pp-field span-2"><label>Título</label><input id="act-titulo" value="' + esc(x.titulo) + '" placeholder="Ej. Vaciado a/mc 0.40"></div>' +
    '<div class="pp-field"><label>Responsable</label><select id="act-responsable">' + opcionesUsuariosHtml(x.responsable_id, 'Elegí un usuario') + '</select></div>' +
    '<div class="pp-field"><label>Proyecto</label><select id="act-proyecto"><option value="">Elegí el proyecto</option>' + PROYECTO_CATALOGO.map(function(p){ return '<option' + (p === x.proyecto ? ' selected' : '') + '>' + esc(p) + '</option>'; }).join('') + '</select></div>' +
    '<div class="pp-field"><label>Desde</label><input type="date" id="act-desde" value="' + esc(x.desde) + '"></div>' +
    '<div class="pp-field"><label>Hasta</label><input type="date" id="act-hasta" value="' + esc(x.hasta) + '" min="' + esc(x.desde) + '"' + (x.desde === x.hasta ? ' disabled' : '') + '>' +
      '<label class="mismo-dia"><input type="checkbox" id="act-mismo"' + (x.desde === x.hasta ? ' checked' : '') + '> Mismo día</label></div>' +
    '<div class="pp-field"><label>Prioridad</label><select id="act-prioridad">' + Object.keys(PRIORIDADES).map(function(k){ return '<option value="' + k + '"' + (x.prioridad === k ? ' selected' : '') + '>' + PRIORIDADES[k] + '</option>'; }).join('') + '</select></div>' +
    '<div class="pp-field"><label>Diseño ligado (opcional)</label><select id="act-diseno">' + opcionesDisenoProyecto(x.proyecto, x.diseno_codigo) + '</select></div>' +
    '<div class="pp-field"><label>Paso del diseño (se marca sola)</label><select id="act-paso">' + Object.keys(PASOS_ACTIVIDAD).map(function(k){ return '<option value="' + k + '"' + (x.paso === k ? ' selected' : '') + '>' + PASOS_ACTIVIDAD[k] + '</option>'; }).join('') + '</select></div>' +
  '</div>';
  abrirModal('act-modal');
}
function opcionesDisenoProyecto(proyecto, sel){
  return '<option value="">—</option>' + disenos.filter(function(d){ return proyectoNombre(d.proyectoId) === proyecto; }).map(function(d){ return '<option value="' + esc(d.codigo) + '"' + (d.codigo === sel ? ' selected' : '') + '>' + esc(d.codigo + ' ' + diseñoTitulo(d)) + '</option>'; }).join('');
}
function guardarActividad(){
  var v = function(id){ return document.getElementById(id).value.trim(); };
  var x = {titulo:v('act-titulo'), responsable_id:v('act-responsable'), proyecto:v('act-proyecto'), desde:v('act-desde'), hasta:v('act-hasta') || v('act-desde'), prioridad:v('act-prioridad'), diseno_codigo:v('act-diseno'), paso:v('act-paso')};
  if(!x.titulo){ toast('Escribí el título'); return; }
  if(!x.responsable_id){ toast('Elegí el responsable (usuario de la plataforma)'); return; }
  if(!x.proyecto){ toast('El proyecto es obligatorio'); return; }
  if(!x.desde || x.hasta < x.desde){ toast('Revisá las fechas'); return; }
  if(x.paso && !x.diseno_codigo){ toast('Para ligar un paso elegí el diseño'); return; }
  var lunes = lunesDe(x.desde);
  if(actEditId){
    var a = actividades.filter(function(y){ return y.id === actEditId; })[0];
    var antes = {}, despues = {};
    Object.keys(x).forEach(function(k){ if(String(a[k] || '') !== String(x[k] || '')){ antes[k] = a[k]; despues[k] = x[k]; } });
    if(!Object.keys(despues).length){ cerrarModal('act-modal'); return; }
    var aplicar = function(motivo){
      Object.assign(a, x, {semana:lunes});
      if(a.estado === 'publicada' && (despues.responsable_id || despues.desde || despues.hasta)) a.estado = 'borrador';
      saveActividades();
      registrarHistorial('Editó', 'Actividades', a.titulo, {proyecto:a.proyecto, ref:a.id, antes:antes, despues:despues, motivo:motivo || ''});
      cerrarModal('act-modal'); renderTablero();
    };
    if(a.estado === 'publicada') pedirMotivo('Editar una actividad publicada', resumenCambioHtml({antes:antes, despues:despues}), aplicar); else aplicar('');
    return;
  }
  var nueva = Object.assign({id:Lab.idNuevo('act'), semana:lunes, estado:'borrador', hecha:false, creado_por:usuarioActual.id, creado_en:new Date().toISOString()}, x, base_plan_item);
  base_plan_item = {};
  actividades.push(nueva);
  saveActividades();
  registrarHistorial('Creó', 'Actividades', nueva.titulo + ' · ' + nombreDe(nueva.responsable_id) + ' · ' + isoToDMY(nueva.desde), {proyecto:nueva.proyecto, ref:nueva.id});
  cerrarModal('act-modal');
  semanaTablero = lunes;
  toast(semanasPublicadas[lunes] ? 'Actividad creada: queda para «Enviar novedades»' : 'Actividad creada en Borrador');
  if(planVista !== 'actividades') mostrarVistaPlan('actividades'); else renderTablero();
}
var base_plan_item = {};
/* Publicar: un solo correo por usuario con todas sus actividades; después, solo lo nuevo */
function publicarSemana(){
  if(!exigir('actividades:publicar')) return;
  var lunes = semanaTablero, dom = addDaysISO(lunes, 6);
  var yaPublicada = !!semanasPublicadas[lunes];
  var nuevas = actividadesDeSemana(lunes).filter(function(a){ return a.estado === 'borrador'; });
  if(!nuevas.length){ toast(yaPublicada ? 'No hay novedades para enviar' : 'No hay actividades en la semana'); return; }
  var porUsuario = {};
  (yaPublicada ? nuevas : actividadesDeSemana(lunes)).forEach(function(a){ (porUsuario[a.responsable_id] = porUsuario[a.responsable_id] || []).push(a); });
  Object.keys(porUsuario).forEach(function(uid){
    var l = [(yaPublicada ? 'Se agregaron actividades a tu semana ' : 'Tus actividades de la semana ') + isoToDMY(lunes) + ' – ' + isoToDMY(dom) + ':', ''];
    porUsuario[uid].sort(function(a,b){ return a.desde.localeCompare(b.desde); }).forEach(function(a){
      l.push('· ' + (a.desde === a.hasta ? isoToDMY(a.desde) : isoToDMY(a.desde) + ' a ' + isoToDMY(a.hasta)) + ' — ' + a.titulo + ' (' + a.proyecto + ', prioridad ' + PRIORIDADES[a.prioridad].toLowerCase() + ')');
    });
    encolarCorreo(uid, yaPublicada ? 'Novedades de la semana' : 'Semana publicada', (yaPublicada ? 'Novedades de tu semana ' : 'Tu semana ') + isoToDMY(lunes).slice(0, 5) + '–' + isoToDMY(dom).slice(0, 5), l, '#inicio');
  });
  nuevas.forEach(function(a){ a.estado = 'publicada'; a.publicada_en = new Date().toISOString(); });
  if(!yaPublicada) semanasPublicadas[lunes] = {publicada_en:new Date().toISOString(), por:usuarioActual.id};
  saveActividades(); saveSemanas();
  registrarHistorial(yaPublicada ? 'Envió novedades' : 'Publicó', 'Actividades', 'Semana ' + isoToDMY(lunes) + ' · ' + nuevas.length + ' actividad(es) · ' + Object.keys(porUsuario).length + ' correo(s)', {ref:lunes});
  toast((yaPublicada ? 'Novedades enviadas a la bandeja: ' : 'Semana publicada: ') + Object.keys(porUsuario).length + ' correo(s), uno por usuario');
  renderTablero();
}
function marcarActividad(a, hecha){
  var yo = usuarioActual.id;
  if(a.responsable_id !== yo && !can('actividades:publicar')){ toast('Solo el responsable marca su actividad'); return; }
  a.hecha = hecha; a.hecha_en = hecha ? new Date().toISOString() : ''; a.hecha_por = hecha ? yo : '';
  saveActividades();
  registrarHistorial(hecha ? 'Completó' : 'Reabrió', 'Actividades', a.titulo, {proyecto:a.proyecto, ref:a.id});
}

/* ================= EVENTOS ================= */
document.getElementById('panel-planificacion').addEventListener('click', function(e){
  var v = e.target.closest('[data-plan-vista]');
  if(v){ mostrarVistaPlan(v.dataset.planVista); return; }
  var c = e.target.closest('[data-correo-acc]');
  if(c){
    if(c.dataset.correoAcc === 'gmail'){ marcarCorreoEnviado(c.dataset.id); setTimeout(renderBandeja, 200); return; }
    if(c.dataset.correoAcc === 'diaria'){ var n = generarListaDiaria(true); toast(n ? n + ' correo(s) de la lista diaria en la bandeja' : 'No hay pendientes para nadie hoy'); renderPlanHub(); return; }
    if(c.dataset.correoAcc === 'ver'){ var m = correos.filter(function(x){ return x.id === c.dataset.id; })[0]; if(m) verCorreo(m); return; }
  }
  var s = e.target.closest('[data-plan-sel]');
  if(s){ planSelId = s.dataset.planSel; planEd = null; renderPlanes(); return; }
  var pa = e.target.closest('[data-plan-acc]');
  if(pa){
    var acc = pa.dataset.planAcc;
    if(acc === 'nuevo'){ if(!exigir('planes:gestionar')) return; planEd = nuevoPlan(); planSelId = planEd.id; renderPlanes(); return; }
    if(!planEd) return;
    leerCabeceraPlan();
    var et = pa.closest('[data-et]'), etapa = et ? planEd.etapas.filter(function(x){ return x.id === et.dataset.et; })[0] : null;
    var tr = pa.closest('[data-it]'), item = tr && etapa ? etapa.items.filter(function(x){ return x.id === tr.dataset.it; })[0] : null;
    if(acc === 'etapa'){ planEd.etapas.push({id:Lab.idNuevo('et'), nombre:'Etapa ' + (planEd.etapas.length + 1), items:[]}); renderPlanes(); }
    else if(acc === 'item' && etapa){ etapa.items.push(itemNuevo()); renderPlanes(); }
    else if(acc === 'quitar-item' && etapa && item){ if(confirm('¿Quitar el ítem «' + (item.nombre || 'sin nombre') + '» del plan?')){ etapa.items = etapa.items.filter(function(x){ return x !== item; }); renderPlanes(); } }
    else if(acc === 'quitar-etapa' && etapa){ if(!etapa.items.length || confirm('¿Quitar la etapa «' + etapa.nombre + '» con sus ítems?')){ planEd.etapas = planEd.etapas.filter(function(x){ return x !== etapa; }); renderPlanes(); } }
    else if(acc === 'guardar') guardarPlan();
    else if(acc === 'pdf') exportarGantt('pdf');
    else if(acc === 'pptx') exportarGantt('pptx');
    else if(acc === 'descargar' && planEd.archivo) loadEvidenciaURL(planEd.archivo.key).then(function(url){ if(!url){ toast('El archivo no está en este navegador'); return; } var a = document.createElement('a'); a.href = url; a.download = planEd.archivo.nombre; document.body.appendChild(a); a.click(); a.remove(); });
    else if(acc === 'actividad' && item){
      var lunes = lunesDe(item.inicio < todayISO() ? todayISO() : item.inicio);
      var desde = item.inicio > lunes ? item.inicio : lunes, hasta = item.fin < addDaysISO(lunes, 6) ? item.fin : addDaysISO(lunes, 6);
      base_plan_item = {plan_id:planEd.id, plan_item_id:item.id};
      semanaTablero = lunes;
      abrirActividad(null, {titulo:item.nombre, responsable_id:item.responsable_id, proyecto:planEd.proyecto, desde:desde, hasta:hasta < desde ? desde : hasta, diseno_codigo:item.diseno_codigo, prioridad:'media'});
    }
    return;
  }
  var sem = e.target.closest('[data-act-sem]');
  if(sem){ semanaTablero = sem.dataset.actSem === 'hoy' ? lunesDe(todayISO()) : addDaysISO(semanaTablero, Number(sem.dataset.actSem)); renderTablero(); return; }
  var aa = e.target.closest('[data-act-acc]');
  if(aa && aa.tagName !== 'INPUT'){
    var card = aa.closest('[data-act-id]'), act = card ? actividades.filter(function(x){ return x.id === card.dataset.actId; })[0] : null;
    if(aa.dataset.actAcc === 'nueva') abrirActividad(null);
    else if(aa.dataset.actAcc === 'publicar') publicarSemana();
    else if(aa.dataset.actAcc === 'editar' && act) abrirActividad(act);
    else if(aa.dataset.actAcc === 'anular' && act) pedirMotivo('Anular la actividad', '<p>' + esc(act.titulo) + '</p>', function(m){
      act.anulada = true; act.motivo_anulacion = m; saveActividades();
      registrarHistorial('Anuló', 'Actividades', act.titulo, {proyecto:act.proyecto, ref:act.id, motivo:m}); renderTablero();
    });
  }
});
document.getElementById('panel-planificacion').addEventListener('change', function(e){
  if(e.target.dataset.actAcc === 'hecha'){
    var act = actividades.filter(function(x){ return x.id === e.target.closest('[data-act-id]').dataset.actId; })[0];
    if(act) marcarActividad(act, e.target.checked);
    renderTablero(); return;
  }
  if(!planEd) return;
  if(e.target.id === 'pl-archivo'){
    var f = e.target.files[0];
    if(!f) return;
    if(!/\.(pdf|pptx|xlsx)$/i.test(f.name)){ toast('Subí un PDF, PPTX o XLSX'); return; }
    var key = 'plan_' + planEd.id;
    saveEvidenciaBlob(key, f).then(function(){ planEd.archivo = {nombre:f.name, tipo:f.type, tam:f.size, key:key, subido_en:new Date().toISOString()}; toast('Archivo listo: guardá el plan'); renderPlanes(); });
    return;
  }
  if(e.target.name === 'pl-origen' || e.target.id === 'pl-proyecto' || e.target.id === 'pl-mes-ini' || e.target.id === 'pl-mes-fin'){ leerCabeceraPlan(); renderPlanes(); return; }
  var tr = e.target.closest('[data-it]');
  if(tr && e.target.hasAttribute('data-pf-mismo')){ var rm = buscarItem(tr.dataset.it); if(rm){ rm.item.mismo_dia = e.target.checked; if(rm.item.mismo_dia) rm.item.fin = rm.item.inicio; leerCabeceraPlan(); renderPlanes(); } return; }
  if(tr && e.target.dataset.pf){ var r = buscarItem(tr.dataset.it); if(r){ r.item[e.target.dataset.pf] = e.target.value; if(e.target.dataset.pf === 'inicio' && (r.item.fin < r.item.inicio || r.item.mismo_dia)) r.item.fin = r.item.inicio; leerCabeceraPlan(); renderPlanes(); } return; }
  var et = e.target.closest('[data-et]');
  if(et && e.target.dataset.ef){ var etapa = planEd.etapas.filter(function(x){ return x.id === et.dataset.et; })[0]; if(etapa){ etapa.nombre = e.target.value; renderGantt(); } }
});
document.getElementById('panel-planificacion').addEventListener('input', function(e){
  if(planEd && e.target.id === 'pl-nombre'){ planEd.nombre = e.target.value; renderGantt(); }
});
/* Arrastrar una barra a otra semana mueve sus fechas */
var gDrag = null;
document.getElementById('panel-planificacion').addEventListener('dragstart', function(e){
  var b = e.target.closest && e.target.closest('[data-g-drag]');
  if(!b) return;
  gDrag = {item:b.dataset.gDrag, sem:Number(b.dataset.gSem)};
  try{ e.dataTransfer.setData('text/plain', gDrag.item); }catch(x){}
});
document.getElementById('panel-planificacion').addEventListener('dragover', function(e){ if(gDrag && e.target.closest('.g-celda')) e.preventDefault(); });
document.getElementById('panel-planificacion').addEventListener('drop', function(e){
  var td = e.target.closest('.g-celda');
  if(!gDrag || !td) return;
  e.preventDefault();
  moverItemGantt(gDrag.item, gDrag.sem, Number(td.dataset.gSem));
  gDrag = null;
});
function moverItemGantt(itemId, desdeSem, haciaSem){
  if(!can('planes:gestionar') || desdeSem === haciaSem) return;
  var sem = JSON.parse(document.getElementById('gantt-wrap').dataset.semanas || '[]');
  var r = buscarItem(itemId);
  if(!r || !sem[desdeSem] || !sem[haciaSem]) return;
  var dias = Math.round((new Date(sem[haciaSem].desde + 'T00:00:00') - new Date(sem[desdeSem].desde + 'T00:00:00')) / DAY);
  r.item.inicio = addDaysISO(r.item.inicio, dias);
  r.item.fin = addDaysISO(r.item.fin, dias);
  toast('«' + r.item.nombre + '» movido ' + (dias > 0 ? '+' : '') + dias + ' días · guardá el plan');
  leerCabeceraPlan();
  renderPlanes();
}
function verCorreo(m){
  if(!document.getElementById('correo-modal')) document.body.insertAdjacentHTML('beforeend', '<div id="correo-modal" class="sid-modal"><div class="modal-card"><div class="modal-header"><h3 id="correo-asunto"></h3><button class="modal-close" data-close="correo-modal">×</button></div><div class="modal-body"><p class="nota-sm" id="correo-para"></p><pre class="correo-cuerpo" id="correo-cuerpo"></pre></div></div></div>');
  document.getElementById('correo-asunto').textContent = m.asunto;
  document.getElementById('correo-para').textContent = 'Para: ' + m.para + (m.correo ? ' <' + m.correo + '>' : ' (sin correo registrado)') + ' · ' + m.evento;
  document.getElementById('correo-cuerpo').textContent = m.cuerpo;
  abrirModal('correo-modal');
}

/* ================= CALENDARIO: actividades e hitos junto a las roturas ================= */
function eventosPlanDia(iso){
  var usr = (document.getElementById('cal-usuario') || {}).value || '';
  var proy = (document.getElementById('cal-proyecto') || {}).value || '';
  var acts = actividades.filter(function(a){ return !a.anulada && a.desde <= iso && a.hasta >= iso && (!usr || a.responsable_id === usr) && (!proy || a.proyecto === proy); });
  var hitos = [];
  planesVisibles().forEach(function(p){
    if(proy && p.proyecto !== proy) return;
    (p.etapas || []).forEach(function(e){ e.items.forEach(function(it){
      if(usr && it.responsable_id !== usr) return;
      if(it.marca === 'reporte' && it.fin === iso) hitos.push('Reporte · ' + it.nombre);
      hitosDeItem(it).forEach(function(h){ if(h.fecha === iso) hitos.push(h.etiqueta + ' · ' + it.nombre); });
    }); });
  });
  return {actividades:acts, hitos:hitos};
}
function chipsPlanDia(iso){
  var ev = eventosPlanDia(iso);
  return (ev.actividades.length ? '<span class="cal-plan">' + ev.actividades.length + ' act.</span>' : '') + (ev.hitos.length ? '<span class="cal-plan hito">◆ ' + ev.hitos.length + '</span>' : '');
}
function detallePlanDia(iso){
  var ev = eventosPlanDia(iso);
  if(!ev.actividades.length && !ev.hitos.length) return '';
  return '<div class="cdg"><div class="cdg-head">Actividades<span>' + ev.actividades.length + '</span></div>' + ev.actividades.map(function(a){
      return '<div class="cdr' + (actividadHecha(a) ? ' hecho' : '') + '"><div class="cdr-txt"><b>' + esc(a.titulo) + '</b><small>' + esc(nombreDe(a.responsable_id)) + ' · ' + esc(a.proyecto) + (a.estado === 'borrador' ? ' · borrador' : '') + '</small></div></div>';
    }).join('') + '</div>' +
    (ev.hitos.length ? '<div class="cdg"><div class="cdg-head">Hitos de planes<span>' + ev.hitos.length + '</span></div>' + ev.hitos.map(function(h){ return '<div class="cdr"><div class="cdr-txt"><b>◆ ' + esc(h) + '</b></div></div>'; }).join('') + '</div>' : '');
}

/* ================= ENLACES DE LOS CORREOS ================= */
function abrirEnlaceSistema(){
  var h = location.hash || '';
  if(!usuarioActual || !h) return false;
  var m = /^#diseno=([^&]+)/.exec(h);
  if(m){ try{ history.replaceState(null, '', location.pathname + location.search); }catch(x){} var d = disenoPorCodigo(decodeURIComponent(m[1])); if(d) abrirFlujoDiseno(d); return true; }
  if(/^#(inicio|roturas|no-conforme|planificacion)$/.test(h)){ try{ history.replaceState(null, '', location.pathname + location.search); }catch(x){} showPanel(h.slice(1)); return true; }
  return abrirDesdeEnlace();
}
window.addEventListener('hashchange', abrirEnlaceSistema);

/* ================= GANCHOS DE NOTIFICACIÓN ================= */
function avisarDisenoAsignado(d){
  if(!d.asignadoA) return;
  encolarCorreo(d.asignadoA, 'Diseño asignado', 'Te asignaron el diseño ' + d.codigo, ['Diseño: ' + diseñoTitulo(d) + ' (' + d.codigo + ')', 'Proyecto: ' + proyectoNombre(d.proyectoId), 'Lo que falta: ' + (faltaDiseno(d).map(function(f){ return f.texto; }).join(', ') || '—')], '#diseno=' + encodeURIComponent(d.codigo));
}
var _abrirTncBase = abrirTncAutomatico;
abrirTncAutomatico = function(tipo, detalle, carga){
  var t = _abrirTncBase(tipo, detalle, carga);
  var ficha = carga.proyecto ? fichaDeProyecto(carga.proyecto) : null;
  var para = ficha && ficha.responsable_id ? [ficha.responsable_id] : lideres();
  para.forEach(function(id){ encolarCorreo(id, 'Trabajo no conforme', t.codigo + ' · ' + (TIPOS_TNC[tipo] || tipo), [t.codigo + ': ' + (TIPOS_TNC[tipo] || tipo), 'Afecta a: ' + carga.codigo + ' · ' + carga.dia + ' d · ' + (carga.proyecto || ''), detalle], '#no-conforme'); });
  return t;
};

/* ================= PESTAÑA PLAN DE TRABAJO DEL PROYECTO ================= */
function expPlanHtml(ficha){
  var planes = planesTrabajo.filter(function(p){ return !p.anulado && p.proyecto === ficha.nombre; });
  var lunes = lunesDe(todayISO()), dom = addDaysISO(lunes, 6);
  var acts = actividades.filter(function(a){ return !a.anulada && a.proyecto === ficha.nombre && a.desde <= dom && a.hasta >= lunes; });
  return '<div class="card"><div class="ev-toolbar"><span class="section-num" style="margin:0;">Planes de trabajo</span><button class="btn-add verde" data-nuevo-plan="' + esc(ficha.nombre) + '" data-perm="planes:gestionar">+ Plan de trabajo</button></div>' +
    (planes.length ? '<div class="table-scroll"><table class="data-table"><thead><tr><th>Código</th><th>Nombre</th><th>Origen</th><th>Rango</th><th>Ítems</th><th></th></tr></thead><tbody>' + planes.map(function(p){
      var n = (p.etapas || []).reduce(function(a, e){ return a + e.items.length; }, 0);
      return '<tr><td class="mono"><b>' + esc(p.codigo) + '</b></td><td>' + esc(p.nombre) + '</td><td>' + (p.origen === 'archivo' ? 'Archivo' : 'Generador') + '</td><td>' + esc(nombreMes(p.mes_inicio)) + ' – ' + esc(nombreMes(p.mes_fin)) + '</td><td>' + n + '</td><td><button class="btn-add ghost" data-abrir-plan="' + esc(p.id) + '">Abrir</button></td></tr>';
    }).join('') + '</tbody></table></div>' : '<div class="empty-note">Sin planes.</div>') + '</div>' +
    '<div class="card" style="margin-top:12px;"><div class="section-num">Actividades de la semana</div>' + (acts.length ? '<div class="table-scroll"><table class="data-table"><thead><tr><th>Actividad</th><th>Responsable</th><th>Fecha</th><th>Estado</th></tr></thead><tbody>' + acts.map(function(a){
      return '<tr><td>' + esc(a.titulo) + '</td><td>' + esc(nombreDe(a.responsable_id)) + '</td><td>' + isoToDMY(a.desde).slice(0, 5) + (a.hasta !== a.desde ? '–' + isoToDMY(a.hasta).slice(0, 5) : '') + '</td><td>' + (actividadHecha(a) ? '<span class="chip-ok">Hecha</span>' : '<span class="tag-pill ' + (a.estado === 'publicada' ? 'tag-verde' : 'tag-gris') + '">' + (a.estado === 'publicada' ? 'Publicada' : 'Borrador') + '</span>') + '</td></tr>';
    }).join('') + '</tbody></table></div>' : '<div class="empty-note">Sin actividades.</div>') + '</div>';
}
document.addEventListener('click', function(e){
  var np = e.target.closest('[data-nuevo-plan]');
  if(np){ if(!exigir('planes:gestionar')) return; planVista = 'plan'; planEd = nuevoPlan(np.dataset.nuevoPlan); planSelId = planEd.id; showPanel('planificacion'); return; }
  var ap = e.target.closest('[data-abrir-plan]');
  if(ap){ planVista = 'plan'; planSelId = ap.dataset.abrirPlan; planEd = null; showPanel('planificacion'); }
});

PANEL_HOOKS.planificacion = function(){ mostrarVistaPlan(planVista); };
