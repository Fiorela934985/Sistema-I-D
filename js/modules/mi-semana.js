/* Sistema I+D — Fase 6: Inicio "Mi semana" (sección 5). Nadie lo llena: junta lo de Proyectos, Planificación y Formatos.
   Grilla de 12: barra (12) · Mis pendientes (8) + Poza de curado (4) · Calendario semanal (12) ·
   Actividades (8) + Diseños de la semana (4) + Proyectos de esta semana (4). Cada bloque muestra 3 a 5 y tiene Ver todo.
   Mío / Todo el equipo: el técnico entra a Mío (el equipo lo ve en solo lectura); el líder entra a Todo el equipo.
   Poza: lectura diaria con semáforo; fuera del rango abre un trabajo no conforme con las probetas que estaban curando. */
'use strict';

var lecturasPoza = load('sid_poza', []);
function savePoza(){ save('sid_poza', lecturasPoza); }
var msAlcance = null;
var msLunes = lunesDe(todayISO());
var msExpandido = {};
var MS_MAX = 5;

function esEquipo(){ return msAlcance === 'equipo'; }
function yoId(){ return usuarioActual ? usuarioActual.id : ''; }
function puedeActuar(uid){ return !uid || uid === yoId() || can('inicio:equipo'); }
function rangoSemanaTexto(lunes){
  var a = new Date(lunes + 'T00:00:00'), b = new Date(addDaysISO(lunes, 6) + 'T00:00:00');
  return a.getDate() + (a.getMonth() !== b.getMonth() ? ' ' + MES_NOMBRES[a.getMonth()].slice(0, 3).toLowerCase() : '') + '–' + b.getDate() + ' ' + MES_NOMBRES[b.getMonth()].slice(0, 3).toLowerCase() + ' ' + b.getFullYear();
}

/* ================= DATOS DE LA SEMANA ================= */
function cargaEsMia(c){
  if(c.aCargoDeId) return c.aCargoDeId === yoId();
  var d = c.disenoCodigoDiseno ? disenoPorCodigo(c.disenoCodigoDiseno) : null;
  return !!d && d.asignadoA === yoId();
}
function pendientesInicio(){
  var hoy = todayISO();
  var roturas = roturaCargas.filter(function(c){
    if(c.estado !== 'pendiente' || !c.codigo) return false;
    if(!esEquipo() && !cargaEsMia(c)) return false;
    return cargaAtrasada(c) || cargaActiva(c) || !c.horaElaboracion && c.fechaEnsayo <= hoy;
  }).map(function(c){ return {tipo:'rotura', c:c, hoy:!cargaAtrasada(c), orden:cargaAtrasada(c) ? 1 : 0}; });
  var dis = disenos.filter(function(d){ return (esEquipo() ? !!d.asignadoA || !!d.flujo : d.asignadoA === yoId()) && estadoCalculado(d) === 'Abierto'; })
    .map(function(d){ return {tipo:'diseno', d:d, orden:2}; });
  return roturas.sort(function(a,b){ return a.orden - b.orden || (diaDeActivacion(a.c) || '').localeCompare(diaDeActivacion(b.c) || ''); })
    .concat(dis.sort(function(a,b){ return (b.d.ts || 0) - (a.d.ts || 0); }));
}
function actividadesInicio(lunes){
  return actividadesDeSemana(lunes).filter(function(a){ return (esEquipo() || a.responsable_id === yoId()) && (a.estado === 'publicada' || can('actividades:publicar')); })
    .sort(function(a,b){ return a.desde.localeCompare(b.desde); });
}
function fechaElabDiseno(d){
  var f = (d.replicaObjs || []).map(function(r){ return r.elaboracion && r.elaboracion.fecha; }).filter(Boolean).sort();
  return f[0] || d.fechaElaboracionISO || dmyToISO(d.fecha) || '';
}
function disenosSemana(lunes){
  var dom = addDaysISO(lunes, 6);
  return disenos.filter(function(d){
    if(!esEquipo() && d.asignadoA !== yoId()) return false;
    var reps = (d.replicaObjs || []).map(function(r){ return r.elaboracion && r.elaboracion.fecha; }).filter(Boolean);
    var fechas = reps.length ? reps : [fechaElabDiseno(d)];
    return fechas.some(function(f){ return f >= lunes && f <= dom; });
  });
}
function roturasSemana(lunes){
  var dom = addDaysISO(lunes, 6);
  return roturaCargas.filter(function(c){ return c.fechaEnsayo >= lunes && c.fechaEnsayo <= dom && (esEquipo() || cargaEsMia(c)); });
}
/* Proyectos de la semana = unión sin repetir de los proyectos de actividades, diseños y roturas de la semana */
function proyectosSemana(lunes){
  var set = {};
  actividadesInicio(lunes).forEach(function(a){ if(a.proyecto) set[a.proyecto] = true; });
  disenosSemana(lunes).forEach(function(d){ var p = proyectoNombre(d.proyectoId); if(p) set[p] = true; });
  roturasSemana(lunes).forEach(function(c){ if(c.proyecto) set[c.proyecto] = true; });
  return Object.keys(set).map(function(n){ var f = fichaDeProyecto(n); return {nombre:n, avance:f ? resumenProyecto(f).avancePct : 0}; });
}

/* ================= POZA DE CURADO ================= */
function lecturaDelDia(iso){ return lecturasPoza.filter(function(l){ return l.fecha === iso && !l.anulada; }).sort(function(a,b){ return (b.hora || '').localeCompare(a.hora || ''); })[0] || null; }
function enRango(t){ return Lab.pozaEnRango(Number(t)); }
/* Probetas que estaban curando un día: elaboradas hasta ese día y todavía sin romper */
function probetasCurando(iso){
  var vistos = {};
  roturaCargas.concat(roturasAnuladas).forEach(function(c){
    if(!c.codigo || !c.fechaElaboracion || c.fechaElaboracion > iso) return;
    var hasta = c.estado === 'completado' ? (c.fechaEnsayoReal || c.fechaEnsayo) : addDaysISO(todayISO(), 1);
    if(iso <= hasta) vistos[c.codigo] = c.proyecto || '';
  });
  return Object.keys(vistos).sort().map(function(k){ return {codigo:k, proyecto:vistos[k]}; });
}
function abrirTncPoza(l){
  var afectadas = probetasCurando(l.fecha);
  var t = {id:Lab.idNuevo('tnc'), codigo:siguienteCodigoTnc(), tipo:'poza', origen:'automatico', alerta:false, estado:'Abierto', codigos:afectadas.map(function(a){ return a.codigo; }),
    lectura_id:l.id, proyecto:'', detalle:'Poza a ' + l.temp + ' °C el ' + isoToDMY(l.fecha) + ' ' + (l.hora || '') + ' (rango ' + Lab.configNum('poza_min') + '–' + Lab.configNum('poza_max') + ' °C) · ' + afectadas.length + ' código(s) curando',
    creado_en:new Date().toISOString(), creado_por:yoId()};
  trabajosNoConformes.unshift(t);
  saveTnc();
  registrarHistorial('Abrió', 'Trabajo no conforme', t.codigo + ' · Poza de curado fuera de rango · ' + l.temp + ' °C', {ref:t.codigo});
  if(typeof encolarCorreo === 'function') lideres().forEach(function(id){ encolarCorreo(id, 'Trabajo no conforme', t.codigo + ' · Poza de curado fuera de rango', [t.detalle, 'Códigos: ' + (t.codigos.join(', ') || '—')], '#no-conforme'); });
  return t;
}
function abrirRegistroPoza(){
  if(!exigir('resultados:registrar')) return;
  if(!document.getElementById('poza-modal')){
    document.body.insertAdjacentHTML('beforeend', '<div id="poza-modal" class="sid-modal"><div class="modal-card"><div class="modal-header"><h3>Lectura de la poza</h3><button class="modal-close" data-close="poza-modal">×</button></div>' +
      '<div class="modal-body"><div class="pred-form"><div class="pp-field"><label>Fecha</label><input type="date" id="poza-fecha"></div><div class="pp-field"><label>Hora</label><input type="time" id="poza-hora"></div>' +
      '<div class="pp-field"><label>T° del agua (°C)</label><input type="text" inputmode="decimal" id="poza-temp"></div><div class="pp-field"><label>Observación</label><input type="text" id="poza-obs"></div></div></div>' +
      '<div class="modal-actions"><button class="btn-add verde" id="poza-guardar">Registrar</button><button class="btn-add ghost" data-close="poza-modal">Cancelar</button></div></div></div>');
    document.getElementById('poza-guardar').addEventListener('click', guardarLecturaPoza);
  }
  var t = new Date();
  document.getElementById('poza-fecha').value = todayISO();
  document.getElementById('poza-hora').value = String(t.getHours()).padStart(2, '0') + ':' + String(t.getMinutes()).padStart(2, '0');
  document.getElementById('poza-temp').value = '';
  document.getElementById('poza-obs').value = '';
  abrirModal('poza-modal');
  setTimeout(function(){ document.getElementById('poza-temp').focus(); }, 60);
}
function guardarLecturaPoza(){
  var temp = document.getElementById('poza-temp').value.trim().replace(',', '.');
  var fecha = document.getElementById('poza-fecha').value, hora = document.getElementById('poza-hora').value;
  if(!fecha || !hora){ toast('Indicá fecha y hora'); return; }
  if(!temp || !isFinite(Number(temp)) || Number(temp) < 0 || Number(temp) > 60){ toast('T° inválida'); return; }
  var l = {id:Lab.idNuevo('pz'), fecha:fecha, hora:hora, temp:Number(temp), observacion:document.getElementById('poza-obs').value.trim(), registrado_por:yoId(), creado_en:new Date().toISOString()};
  lecturasPoza.push(l);
  savePoza();
  registrarHistorial('Registró', 'Poza de curado', isoToDMY(fecha) + ' ' + hora + ' · ' + l.temp + ' °C', {ref:l.id, despues:{temp:l.temp}});
  cerrarModal('poza-modal');
  if(!enRango(l.temp)){ var t = abrirTncPoza(l); l.tnc = t.codigo; savePoza(); toast('Fuera de rango: se abrió ' + t.codigo); }
  else toast('Lectura registrada');
  renderMiSemana();
  if(document.getElementById('poza-detalle') && document.getElementById('poza-detalle').classList.contains('show')) renderPozaDetalle();
}
var pozaCharts = {};
function serieDias(dias){
  var out = [], hoy = todayISO();
  for(var i = dias - 1; i >= 0; i--){ var iso = addDaysISO(hoy, -i); var l = lecturaDelDia(iso); out.push({iso:iso, l:l}); }
  return out;
}
function dibujarPoza(canvasId, dias, grande){
  if(typeof Chart === 'undefined') return;
  if(pozaCharts[canvasId]){ pozaCharts[canvasId].destroy(); delete pozaCharts[canvasId]; }
  var el = document.getElementById(canvasId);
  if(!el) return;
  var s = serieDias(dias), min = Lab.configNum('poza_min'), max = Lab.configNum('poza_max');
  var datos = s.map(function(x){ return x.l ? x.l.temp : null; });
  pozaCharts[canvasId] = new Chart(el, {type:'line', data:{labels:s.map(function(x){ return isoToDMY(x.iso).slice(0, 5); }), datasets:[
      {label:'Máx', data:s.map(function(){ return max; }), borderWidth:0, pointRadius:0, fill:false},
      {label:'Rango', data:s.map(function(){ return min; }), borderWidth:0, pointRadius:0, fill:'-1', backgroundColor:'rgba(76,175,62,.16)'},
      {label:'T° agua', data:datos, borderColor:'#0099cc', borderWidth:2, spanGaps:false, tension:.25,
        pointRadius:grande ? 4 : 2.5, pointBackgroundColor:datos.map(function(v){ return v === null || enRango(v) ? '#0099cc' : '#dc2626'; }), pointBorderColor:datos.map(function(v){ return v === null || enRango(v) ? '#0099cc' : '#dc2626'; })}]},
    options:{responsive:true, maintainAspectRatio:false, animation:false, plugins:{legend:{display:false},
      tooltip:{filter:function(i){ return i.datasetIndex === 2; }, callbacks:{label:function(ctx){ var l = s[ctx.dataIndex].l; return l ? l.temp + ' °C · ' + (l.hora || '') + ' · ' + (nombreDe(l.registrado_por) || '') : ''; }}}},
      scales:{x:{display:grande, ticks:{maxTicksLimit:grande ? 12 : 7}}, y:{display:grande, suggestedMin:min - 3, suggestedMax:max + 3}}}});
}
var pozaRango = 7;
function abrirPozaDetalle(){
  if(!document.getElementById('poza-detalle')){
    document.body.insertAdjacentHTML('beforeend', '<div id="poza-detalle" class="sid-modal"><div class="modal-card wide"><div class="modal-header"><h3>Poza de curado</h3><button class="modal-close" data-close="poza-detalle">×</button></div><div class="modal-body" id="poza-detalle-body"></div></div></div>');
    document.getElementById('poza-detalle').addEventListener('click', function(e){
      var r = e.target.closest('[data-poza-rango]');
      if(r){ pozaRango = Number(r.dataset.pozaRango); renderPozaDetalle(); return; }
      if(e.target.closest('[data-poza-acc="registrar"]')){ abrirRegistroPoza(); return; }
      if(e.target.closest('[data-poza-acc="excel"]')) exportarPoza();
      if(e.target.closest('[data-poza-acc="tnc"]')){ cerrarModal('poza-detalle'); showPanel('no-conforme'); }
    });
  }
  renderPozaDetalle();
  abrirModal('poza-detalle');
}
function renderPozaDetalle(){
  var s = serieDias(pozaRango);
  var lecturas = s.filter(function(x){ return x.l; }).map(function(x){ return x.l; }).reverse();
  var fuera = s.filter(function(x){ return x.l && !enRango(x.l.temp); });
  var afectadas = {};
  fuera.forEach(function(x){ probetasCurando(x.iso).forEach(function(p){ (afectadas[p.codigo] = afectadas[p.codigo] || []).push(isoToDMY(x.iso).slice(0, 5)); }); });
  var codigos = Object.keys(afectadas).sort();
  document.getElementById('poza-detalle-body').innerHTML =
    '<div class="ev-toolbar"><div class="view-toggle">' + [[7, '7 días'], [30, '30 días'], [90, '3 meses']].map(function(r){ return '<button class="view-toggle-btn' + (pozaRango === r[0] ? ' active' : '') + '" data-poza-rango="' + r[0] + '">' + r[1] + '</button>'; }).join('') + '</div>' +
      '<span class="nota-sm">Rango ' + Lab.configNum('poza_min') + '–' + Lab.configNum('poza_max') + ' °C</span><span class="ch-actions"><button class="btn-add verde" data-poza-acc="registrar" data-perm="resultados:registrar">Registrar lectura</button><button class="btn-add ghost" data-poza-acc="excel" data-perm="datos:exportar">Excel</button></span></div>' +
    '<div class="poza-grafica-grande"><canvas id="poza-chart-grande"></canvas></div>' +
    '<div class="poza-detalle-grid"><div><div class="section-num">Lecturas</div><div class="table-scroll poza-tabla"><table class="data-table"><thead><tr><th>Fecha</th><th>Hora</th><th>T° agua</th><th>Registró</th><th>Observación</th></tr></thead><tbody>' +
      (lecturas.length ? lecturas.map(function(l){ return '<tr><td>' + isoToDMY(l.fecha) + '</td><td>' + esc(l.hora || '') + '</td><td class="' + (enRango(l.temp) ? '' : 'cv-alto') + '"><b>' + l.temp + ' °C</b></td><td>' + esc(nombreDe(l.registrado_por) || '') + '</td><td>' + esc(l.observacion || '') + (l.tnc ? ' <span class="chip-falta atrasado">' + esc(l.tnc) + '</span>' : '') + '</td></tr>'; }).join('') : '<tr><td colspan="5" class="nota-sm">Sin lecturas.</td></tr>') + '</tbody></table></div></div>' +
    '<div><div class="section-num">Probetas afectadas <span class="badge-pill">' + codigos.length + '</span></div>' + (codigos.length ? '<div class="poza-afectadas">' + codigos.map(function(c){ return '<span class="chip-falta atrasado" title="Fuera de rango: ' + afectadas[c].join(', ') + '">' + esc(c) + '</span>'; }).join('') + '</div><button class="btn-link" data-poza-acc="tnc">Ver trabajos no conformes</button>' : '<p class="nota-sm">Sin días fuera de rango.</p>') + '</div></div>';
  dibujarPoza('poza-chart-grande', pozaRango, true);
}
function exportarPoza(){
  if(!exigir('datos:exportar')) return;
  var filas = [['Fecha', 'Hora', 'T° agua (°C)', 'En rango', 'Registró', 'Observación', 'Trabajo no conforme']];
  serieDias(pozaRango).forEach(function(x){
    var l = x.l;
    filas.push(l ? [isoToDMY(x.iso), l.hora || '', l.temp, enRango(l.temp) ? 'Sí' : 'No', nombreDe(l.registrado_por) || '', l.observacion || '', l.tnc || ''] : [isoToDMY(x.iso), '', '', 'Sin lectura', '', '', '']);
  });
  if(exportarExcel('Poza de curado.xlsx', [{nombre:'Poza', filas:filas}])) registrarHistorial('Exportó', 'Poza de curado', pozaRango + ' días');
}

/* ================= RENDER ================= */
function verTodoBtn(clave, total){ return total > MS_MAX ? '<button class="ms-vertodo" data-ms-vertodo="' + clave + '">Ver todo (' + total + ')</button>' : ''; }
function filaActividadMs(a){
  var hecha = actividadHecha(a), automatica = !!(a.diseno_codigo && a.paso);
  return '<li class="ms-fila' + (hecha ? ' hecha' : '') + '"><input type="checkbox" data-ms-hecha="' + esc(a.id) + '"' + (hecha ? ' checked' : '') + (automatica || !(a.responsable_id === yoId() || can('actividades:publicar')) ? ' disabled' : '') + '>' +
    '<span class="ms-cod">' + esc(a.titulo) + '</span><span class="ms-txt">' + esc(a.proyecto) + ' · ' + DIAS_SEMANA_CORTOS[(new Date(a.desde + 'T00:00:00').getDay() + 6) % 7] + (a.hasta !== a.desde ? '–' + DIAS_SEMANA_CORTOS[(new Date(a.hasta + 'T00:00:00').getDay() + 6) % 7] : '') + (esEquipo() ? ' · ' + esc(nombreDe(a.responsable_id)) : '') + '</span></li>';
}
/* Ver todo: pantalla nueva con la lista completa */
function abrirVerTodoMs(clave){
  var t, html;
  if(clave === 'pend'){ var p = pendientesInicio(); t = (esEquipo() ? 'Pendientes del equipo' : 'Mis pendientes') + ' · ' + p.length; html = '<div class="card"><ul class="ms-lista">' + p.map(filaPendienteMs).join('') + '</ul></div>'; }
  else if(clave === 'act'){ var a = actividadesInicio(msLunes); t = 'Actividades de la semana · ' + a.length; html = '<div class="card"><ul class="ms-lista">' + a.map(filaActividadMs).join('') + '</ul></div>'; }
  else if(clave === 'dis'){ var d = disenosSemana(msLunes); t = 'Diseños de la semana · ' + d.length; html = '<div class="card"><ul class="ms-chips">' + d.map(function(x){ return '<li><button class="ms-chip" data-ms-acc="flujo" data-codigo="' + esc(x.codigo) + '">' + semaforoDotHtml(semaforoChecklist(x)) + esc(diseñoTitulo(x)) + '</button></li>'; }).join('') + '</ul></div>'; }
  else { var pr = proyectosSemana(msLunes); t = 'Proyectos de esta semana · ' + pr.length; html = '<div class="card"><ul class="ms-chips">' + pr.map(function(x){ return '<li><button class="ms-chip" data-ms-proy="' + esc(x.nombre) + '"><b>' + esc(x.nombre) + '</b><span class="ms-pct">' + x.avance + '%</span></button></li>'; }).join('') + '</ul></div>'; }
  abrirPantalla(t, '<div id="ms-pantalla">' + html + '</div>', renderMiSemana);
}
function recortar(clave, lista){ return msExpandido[clave] ? lista : lista.slice(0, MS_MAX); }
function filaPendienteMs(p){
  if(p.tipo === 'rotura'){
    var c = p.c, atr = cargaAtrasada(c), sinHora = !c.horaElaboracion;
    var accion = !puedeActuar(c.aCargoDeId) ? '' : sinHora ? '<button class="btn-add ghost" data-ms-acc="flujo" data-codigo="' + esc(c.disenoCodigoDiseno) + '">Poner hora</button>'
      : '<button class="btn-add" data-ms-acc="rotura" data-id="' + esc(c.id) + '" data-perm="roturas:registrar">Registrar</button>';
    return '<li class="ms-fila' + (atr ? ' atrasada' : ' hoy') + '"><span class="ms-tag ' + (atr ? 'rojo' : 'hoy') + '">' + (atr ? 'Atrasado' : 'Hoy') + '</span>' +
      '<span class="ms-cod mono">' + esc(c.codigo) + '</span><span class="ms-txt">' + c.dia + 'd · ' + esc(textoVentana(c)) + (esEquipo() && c.aCargoDe ? ' · ' + esc(c.aCargoDe) : '') + '</span>' + accion + '</li>';
  }
  var d = p.d, falta = faltaDiseno(d)[0];
  return '<li class="ms-fila">' + semaforoDotHtml(semaforoChecklist(d)) + '<span class="ms-cod nombre-tecnico">' + esc(diseñoTitulo(d)) + '</span>' +
    '<span class="ms-txt">' + (falta ? '<span class="chip-falta' + (falta.atrasado ? ' atrasado' : '') + '">' + esc(falta.texto) + '</span>' : '') + (esEquipo() ? ' <span class="nota-sm">' + esc(nombreDe(d.asignadoA) || '') + '</span>' : '') + '</span>' +
    '<button class="btn-add ghost" data-ms-acc="flujo" data-codigo="' + esc(d.codigo) + '">Continuar</button></li>';
}
function renderMiSemana(){
  var cont = document.getElementById('mi-semana');
  if(!cont || !usuarioActual) return;
  if(msAlcance === null) msAlcance = (usuarioActual.rol === 'admin' || usuarioActual.rol === 'lider') ? 'equipo' : 'mio';
  var lunes = msLunes, hoy = todayISO();
  var pend = pendientesInicio();
  var nHoy = pend.filter(function(p){ return p.tipo === 'rotura' && p.hoy; }).length;
  var acts = actividadesInicio(lunes);
  var dis = disenosSemana(lunes);
  var proys = proyectosSemana(lunes);
  var lh = lecturaDelDia(hoy);
  var dias = []; for(var i = 0; i < 7; i++) dias.push(addDaysISO(lunes, i));
  var roturasSem = roturasSemana(lunes);
  cont.innerHTML =
    '<div class="ms-grid">' + heroInicioHtml(pend.length, nHoy, lunes) + kpisInicioHtml(pend, acts, lh) +
      '<section class="ms-bloque ms-pend"><div class="ms-cab"><h3>' + (esEquipo() ? 'Pendientes del equipo' : 'Mis pendientes') + ' <span class="ms-n">' + pend.length + '</span></h3>' + verTodoBtn('pend', pend.length) + '</div>' +
        (pend.length ? '<ul class="ms-lista' + (msExpandido.pend ? ' expandida' : '') + '">' + recortar('pend', pend).map(filaPendienteMs).join('') + '</ul>' : '<div class="empty-note">Sin pendientes.</div>') + '</section>' +
      '<section class="ms-bloque ms-poza" data-ms-acc="poza"><div class="ms-cab"><h3>Poza de curado</h3><button class="btn-add ghost" data-ms-acc="poza-registrar" data-perm="resultados:registrar">Registrar lectura</button></div>' +
        '<div class="ms-poza-hoy">' + (lh ? '<span class="semaforo-dot semaforo-' + (enRango(lh.temp) ? 'verde' : 'rojo') + '"></span><b>' + lh.temp + ' °C</b><span class="' + (enRango(lh.temp) ? 'chip-ok' : 'chip-falta atrasado') + '">' + (enRango(lh.temp) ? 'en rango' : 'fuera de rango') + '</span>'
          : '<span class="semaforo-dot semaforo-gris"></span><b>— °C</b><span class="chip-falta">Sin lectura hoy</span>') + '</div>' +
        '<div class="ms-poza-graf"><canvas id="poza-chart-mini"></canvas></div><div class="nota-sm">Últimos 7 días · ' + Lab.configNum('poza_min') + '–' + Lab.configNum('poza_max') + ' °C</div></section>' +
      '<section class="ms-bloque ms-cal"><div class="ms-dias">' + dias.map(function(iso, k){
        var na = acts.filter(function(a){ return a.desde <= iso && a.hasta >= iso; }).length;
        var nr = roturasSem.filter(function(c){ return c.fechaEnsayo === iso; });
        var np = nr.filter(function(c){ return c.estado === 'pendiente'; }).length;
        return '<button class="ms-dia' + (iso === hoy ? ' hoy' : '') + '" data-ms-dia="' + iso + '"><span class="ms-dia-n">' + DIAS_SEMANA_CORTOS[k] + ' ' + Number(iso.slice(8)) + '</span>' +
          (na ? '<span class="ms-dia-c act">' + na + ' act.</span>' : '') + (nr.length ? '<span class="ms-dia-c rot' + (np && iso < hoy ? ' atr' : '') + '">' + nr.length + ' rot.</span>' : '') + (!na && !nr.length ? '<span class="ms-dia-c vacio">—</span>' : '') + '</button>';
      }).join('') + '</div></section>' +
      '<section class="ms-bloque ms-act"><div class="ms-cab"><h3>Actividades de la semana <span class="ms-n">' + acts.length + '</span></h3><span>' + verTodoBtn('act', acts.length) + '<button class="ms-vertodo" data-ms-acc="tablero">Tablero</button></span></div>' +
        (acts.length ? '<ul class="ms-lista' + (msExpandido.act ? ' expandida' : '') + '">' + recortar('act', acts).map(function(a){
          var hecha = actividadHecha(a), automatica = !!(a.diseno_codigo && a.paso);
          return '<li class="ms-fila' + (hecha ? ' hecha' : '') + '"><input type="checkbox" data-ms-hecha="' + esc(a.id) + '"' + (hecha ? ' checked' : '') + (automatica || !(a.responsable_id === yoId() || can('actividades:publicar')) ? ' disabled' : '') + '>' +
            '<span class="ms-cod">' + esc(a.titulo) + '</span><span class="ms-txt">' + esc(a.proyecto) + ' · ' + DIAS_SEMANA_CORTOS[(new Date(a.desde + 'T00:00:00').getDay() + 6) % 7] + (a.hasta !== a.desde ? '–' + DIAS_SEMANA_CORTOS[(new Date(a.hasta + 'T00:00:00').getDay() + 6) % 7] : '') + (esEquipo() ? ' · ' + esc(nombreDe(a.responsable_id)) : '') + '</span></li>';
        }).join('') + '</ul>' : '<div class="empty-note">Sin actividades.</div>') + '</section>' +
      '<section class="ms-bloque ms-dis"><div class="ms-cab"><h3>Diseños de la semana <span class="ms-n">' + dis.length + '</span></h3>' + verTodoBtn('dis', dis.length) + '</div>' +
        (dis.length ? '<ul class="ms-chips">' + recortar('dis', dis).map(function(d){ return '<li><button class="ms-chip" data-ms-acc="flujo" data-codigo="' + esc(d.codigo) + '">' + semaforoDotHtml(semaforoChecklist(d)) + esc(diseñoTitulo(d)) + '</button></li>'; }).join('') + '</ul>' : '<div class="empty-note">Sin diseños.</div>') + '</section>' +
      '<section class="ms-bloque ms-proy"><div class="ms-cab"><h3>Proyectos de esta semana <span class="ms-n">' + proys.length + '</span></h3>' + verTodoBtn('proy', proys.length) + '</div>' +
        (proys.length ? '<ul class="ms-chips">' + recortar('proy', proys).map(function(p){ return '<li><button class="ms-chip" data-ms-proy="' + esc(p.nombre) + '"><b>' + esc(p.nombre) + '</b><span class="ms-pct">' + p.avance + '%</span></button></li>'; }).join('') + '</ul>' : '<div class="empty-note">Sin proyectos.</div>') + '</section>' +
    '</div>';
  dibujarPoza('poza-chart-mini', 7, false);
}
function abrirDiaMs(iso){
  if(!document.getElementById('ms-dia-modal')) document.body.insertAdjacentHTML('beforeend', '<div id="ms-dia-modal" class="sid-modal"><div class="modal-card"><div class="modal-header"><h3 id="ms-dia-titulo"></h3><button class="modal-close" data-close="ms-dia-modal">×</button></div><div class="modal-body" id="ms-dia-body"></div></div></div>');
  var d = new Date(iso + 'T00:00:00');
  var acts = actividadesInicio(msLunes).filter(function(a){ return a.desde <= iso && a.hasta >= iso; });
  var rots = roturasSemana(msLunes).filter(function(c){ return c.fechaEnsayo === iso; });
  document.getElementById('ms-dia-titulo').textContent = DIA_NOMBRES[d.getDay()].charAt(0).toUpperCase() + DIA_NOMBRES[d.getDay()].slice(1) + ' ' + d.getDate() + ' de ' + MES_NOMBRES[d.getMonth()].toLowerCase();
  document.getElementById('ms-dia-body').innerHTML = '<div class="section-num">Actividades</div>' + (acts.length ? '<ul class="ms-lista">' + acts.map(function(a){ return '<li class="ms-fila' + (actividadHecha(a) ? ' hecha' : '') + '"><span class="ms-cod">' + esc(a.titulo) + '</span><span class="ms-txt">' + esc(a.proyecto) + ' · ' + esc(nombreDe(a.responsable_id)) + '</span></li>'; }).join('') + '</ul>' : '<div class="empty-note">Sin actividades.</div>') +
    '<div class="section-num" style="margin-top:10px;">Roturas</div>' + (rots.length ? '<ul class="ms-lista">' + rots.map(function(c){
      return '<li class="ms-fila"><span class="ms-cod mono">' + esc(c.codigo) + '</span><span class="ms-txt">' + c.dia + 'd · ' + esc(textoVentana(c)) + ' · ' + esc(c.proyecto || '') + '</span>' +
        (c.estado === 'completado' ? '<span class="chip-ok">' + esc(c.promedio || '✓') + '</span>' : (puedeActuar(c.aCargoDeId) && cargaActiva(c) ? '<button class="btn-add" data-ms-acc="rotura" data-id="' + esc(c.id) + '" data-perm="roturas:registrar">Registrar</button>' : '')) + '</li>';
    }).join('') + '</ul>' : '<div class="empty-note">Sin roturas.</div>');
  abrirModal('ms-dia-modal');
}
function accionMs(e){
  var b = e.target.closest('[data-ms-acc]');
  if(!b) return false;
  var acc = b.dataset.msAcc;
  if(acc === 'rotura'){ cerrarModal('ms-dia-modal'); if(exigir('roturas:registrar')){ showPanel('roturas'); openRoturaCargaModal(b.dataset.id); } }
  else if(acc === 'flujo'){ var d = disenoPorCodigo(b.dataset.codigo); if(d) abrirFlujoDiseno(d); }
  else if(acc === 'poza-registrar'){ e.stopPropagation(); abrirRegistroPoza(); }
  else if(acc === 'poza'){ abrirPozaDetalle(); }
  else if(acc === 'tablero'){ planVista = 'actividades'; semanaTablero = msLunes; showPanel('planificacion'); }
  return true;
}
document.addEventListener('click', function(e){
  if(!e.target.closest('#mi-semana') && !e.target.closest('#ms-dia-modal') && !e.target.closest('#ms-pantalla')) return;
  var al = e.target.closest('[data-ms-alcance]');
  if(al){ msAlcance = al.dataset.msAlcance; msExpandido = {}; renderMiSemana(); return; }
  var s = e.target.closest('[data-ms-sem]');
  if(s){ msLunes = s.dataset.msSem === 'hoy' ? lunesDe(todayISO()) : addDaysISO(msLunes, Number(s.dataset.msSem)); renderMiSemana(); return; }
  var v = e.target.closest('[data-ms-vertodo]');
  if(v){ abrirVerTodoMs(v.dataset.msVertodo); return; }
  var dia = e.target.closest('[data-ms-dia]');
  if(dia){ abrirDiaMs(dia.dataset.msDia); return; }
  var p = e.target.closest('[data-ms-proy]');
  if(p){ if(pantallaAbierta()) cerrarPantalla(); abrirExpediente(p.dataset.msProy, 'resumen'); return; }
  if(e.target.closest('input[type=checkbox]')) return;
  accionMs(e);
});
document.addEventListener('change', function(e){
  var id = e.target.dataset && e.target.dataset.msHecha;
  if(!id) return;
  var a = actividades.filter(function(x){ return x.id === id; })[0];
  if(a) marcarActividad(a, e.target.checked);
  renderMiSemana();
});

/* ================= PORTADA: saludo y fila de indicadores ================= */
var ICO_MS = {
  proy:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"/></svg>',
  dis:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="2"/><path d="M8 7h8M8 12h8M8 17h4"/></svg>',
  hoy:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l3 6-5 4 6 2-8 8 2-7-5-2 4-4-3-5z"/></svg>',
  atr:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  act:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3 8-8"/><path d="M20 12v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9"/></svg>',
  poza:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"/></svg>'
};
function heroInicioHtml(nPend, nHoy, lunes){
  var h = new Date().getHours();
  var saludo = h < 12 ? 'Buenos días' : (h < 19 ? 'Buenas tardes' : 'Buenas noches');
  var nombre = (usuarioActual.nombre || usuarioActual.usuario).split(' ')[0];
  var d = new Date();
  var fecha = DIA_NOMBRES[d.getDay()].charAt(0).toUpperCase() + DIA_NOMBRES[d.getDay()].slice(1) + ' ' + d.getDate() + ' de ' + MES_NOMBRES[d.getMonth()].toLowerCase() + ' de ' + d.getFullYear();
  return '<div class="ms-hero ms-barra"><div><h2>' + saludo + ', ' + esc(nombre) + '</h2>' +
      '<div class="ms-fecha">' + fecha + ' · <span class="ms-alcance-t">' + (esEquipo() ? 'Semana del equipo' : 'Mi semana') + '</span> · <b>' + nPend + '</b> pendientes · <b>' + nHoy + '</b> hoy</div></div>' +
    '<span class="ms-vivo">En vivo</span>' +
    '<div class="ms-semana"><button class="cal-nav" data-ms-sem="-7">‹</button><span class="ms-rango">' + rangoSemanaTexto(lunes) + '</span><button class="cal-nav" data-ms-sem="7">›</button>' +
      (lunes !== lunesDe(todayISO()) ? '<button class="cal-nav" data-ms-sem="hoy">Hoy</button>' : '') +
      '<div class="view-toggle"><button class="view-toggle-btn' + (!esEquipo() ? ' active' : '') + '" data-ms-alcance="mio">Mío</button><button class="view-toggle-btn' + (esEquipo() ? ' active' : '') + '" data-ms-alcance="equipo">Todo el equipo</button></div></div></div>';
}
function kpisInicioHtml(pend, acts, lh){
  var abiertos = fichasProyecto.filter(function(f){ return !f.anulado && resumenProyecto(f).estado === 'Abierto'; }).length;
  var disAb = disenos.filter(function(d){ return (esEquipo() || d.asignadoA === yoId()) && estadoCalculado(d) === 'Abierto'; }).length;
  var hoyN = pend.filter(function(p){ return p.tipo === 'rotura' && p.hoy; }).length;
  var atrN = pend.filter(function(p){ return p.tipo === 'rotura' && !p.hoy; }).length;
  var hechas = acts.filter(actividadHecha).length;
  var k = function(dest, tono, ico, valor, etiqueta){ return '<button class="ms-kpi" data-ms-kpi="' + dest + '"><i class="' + tono + '">' + ICO_MS[ico] + '</i><div><b>' + valor + '</b><span>' + etiqueta + '</span></div></button>'; };
  return '<div class="ms-kpis">' +
    k('proyectos', 't-celeste', 'proy', abiertos, 'Proyectos activos') +
    k('disenos', 't-verde', 'dis', disAb, 'Diseños abiertos') +
    k('roturas', 't-indigo', 'hoy', hoyN, 'Roturas de hoy') +
    k('roturas', atrN ? 't-rojo' : 't-verde', 'atr', atrN, 'Roturas atrasadas') +
    k('tablero', 't-ambar', 'act', hechas + '/' + acts.length, 'Actividades hechas') +
    k('poza', lh ? (enRango(lh.temp) ? 't-verde' : 't-rojo') : 't-ambar', 'poza', lh ? lh.temp + ' °C' : '—', 'Poza de curado hoy') + '</div>';
}
document.addEventListener('click', function(e){
  var k = e.target.closest('[data-ms-kpi]');
  if(!k) return;
  var d = k.dataset.msKpi;
  if(d === 'proyectos') showPanel('proyectos');
  else if(d === 'disenos'){ showPanel('disenos'); showSubTab('tabla'); }
  else if(d === 'roturas'){ roturasSoloProyecto = false; showPanel('roturas'); showRoturasSub('pendientes'); }
  else if(d === 'tablero'){ planVista = 'actividades'; semanaTablero = msLunes; showPanel('planificacion'); }
  else if(d === 'poza') abrirPozaDetalle();
});

PANEL_HOOKS.inicio = function(){ renderUsuarioShell(); renderMiSemana(); };
