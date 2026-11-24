/* Sistema I+D — Fase 3: flujo de 5 pasos por diseño (Agregados · Diseño · Elaboración · Estado fresco · Estado endurecido).
   · Agregados: lote compartido entre proyectos (Caracterizar · Usar lote existente).
   · Diseño: réplicas R1..RN que nacen juntas y se asignan a un usuario de la plataforma.
   · Elaboración: Iniciar marca el 0'; recién ahí nace el código ID de la réplica y sus roturas (una por edad).
   · Ventana de rotura NTP 339.034 = fecha y hora de elaboración + edad ± tolerancia (Ensayos y métodos).
   · Regla 4: el técnico solo registra lo asignado y para lo que está autorizado (Recursos › Personal).
   · Regla 6: rotura fuera de la ventana y CV alto abren un trabajo no conforme automático. */
'use strict';

/* ================= DATOS ================= */
var lotesAgregado = load('sid_lotes_agregado', []);
function saveLotes(){ save('sid_lotes_agregado', lotesAgregado); }
var trabajosNoConformes = load('sid_tnc', []);
function saveTnc(){ save('sid_tnc', trabajosNoConformes); }

var EMPRESA_ETIQUETA = 'DINO S.R.L';
var PASOS_DISENO = [
  {id:'agregados', etapa:'caracterizacion', nombre:'Agregados', cuando:'Antes del diseño'},
  {id:'diseno', etapa:'diseno', nombre:'Diseño', cuando:'Día 0'},
  {id:'elaboracion', etapa:'elaboracion', nombre:'Elaboración', cuando:'Día del vaciado'},
  {id:'fresco', etapa:'fresco', nombre:'Estado fresco', cuando:'Mismo día'},
  {id:'endurecido', etapa:'endurecido', nombre:'Estado endurecido', cuando:'Según edades'}
];

/* ================= AYUDAS ================= */
function hm(fecha){ return fecha.getHours() + ':' + String(fecha.getMinutes()).padStart(2, '0'); }
function ahoraHM(){ var d = new Date(); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); }
function usuariosActivos(){ return (usuarios || []).filter(function(u){ return u.activo !== false; }); }
function opcionesUsuariosHtml(seleccion, vacio, soloAsignables){
  var lista = usuariosActivos().filter(function(u){
    return !soloAsignables || !usuarioActual || usuarioActual.rol !== 'tecnico' || u.rol === 'tecnico' || u.id === seleccion;
  });
  return (vacio ? '<option value="">' + esc(vacio) + '</option>' : '') + lista.map(function(u){
    return '<option value="' + esc(u.id) + '"' + (u.id === seleccion ? ' selected' : '') + '>' + esc(u.nombre || u.usuario) + ' · ' + esc(rolLabel(u.rol)) + '</option>';
  }).join('');
}
function cargasActivas(d){ return cargasDeDiseno(d).filter(function(c){ return !c.anulada; }); }
function ensayoDeRotura(tipo){ return tipo === 'Cubos' ? 'ens-compresion-cubos' : 'ens-compresion'; }
function fichaDeDiseno(d){ return fichaDeProyecto(proyectoNombre(d.proyectoId)); }
function edadesDelProtocolo(proyecto){
  var f = fichaDeProyecto(proyecto);
  return f && f.edades && f.edades.length ? f.edades.slice().sort(function(a,b){ return a - b; }) : [1, 3, 7, 28];
}

/* ---------- ventana de rotura de cada fila de Roturas ---------- */
function ventanaDeCarga(c){
  if(!c || !c.fechaElaboracion || !c.horaElaboracion) return null;
  return Lab.ventanaRotura(c.fechaElaboracion + 'T' + c.horaElaboracion, Number(c.dia) * 24);
}
function textoVentana(c){
  var v = ventanaDeCarga(c);
  if(!v) return (c.fechaEnsayo ? fechaCorta(c.fechaEnsayo) : '—') + ' (falta hora)';
  var d1 = isoDe(v.desde), d2 = isoDe(v.hasta);
  return d1 === d2 ? fechaCorta(d1) + ' (' + hm(v.desde) + '–' + hm(v.hasta) + ')'
    : fechaCorta(d1) + ' ' + hm(v.desde) + ' – ' + fechaCorta(d2) + ' ' + hm(v.hasta);
}
function cargaAtrasada(c){
  if(c.estado !== 'pendiente') return false;
  var v = ventanaDeCarga(c);
  return v ? Date.now() > v.hasta.getTime() : !!(c.fechaEnsayo && c.fechaEnsayo < todayISO());
}
/* "Registrar rotura" se activa el día que toca (el día en que abre la ventana) */
function diaDeActivacion(c){ var v = ventanaDeCarga(c); return v ? isoDe(v.desde) : (c.fechaEnsayo || ''); }
function cargaActiva(c){ var dia = diaDeActivacion(c); return !!dia && todayISO() >= dia; }

/* ---------- regla 4: asignado y autorizado ---------- */
function faltanAutorizaciones(ensayoIds){
  if(!usuarioActual || usuarioActual.rol !== 'tecnico') return [];
  return ensayoIds.filter(function(id){ return Lab.ensayo(id) && !Lab.estaAutorizado(usuarioActual.id, id); });
}
function exigirEnsayos(ensayoIds, d, aCargoId){
  if(!usuarioActual) return false;
  if(usuarioActual.rol !== 'tecnico') return true;
  var faltan = faltanAutorizaciones(ensayoIds);
  if(faltan.length){
    toast('No estás autorizado para: ' + faltan.map(function(id){ return Lab.ensayo(id).nombre; }).join(', ') + '. Pedí la autorización en Recursos › Personal.');
    return false;
  }
  if(d && d.asignadoA && d.asignadoA !== usuarioActual.id && aCargoId !== usuarioActual.id){
    toast('Este diseño está asignado a ' + (nombreDe(d.asignadoA) || 'otro usuario') + '.');
    return false;
  }
  return true;
}
function ensayosDeEtapaEnProyecto(d, etapa){
  var f = fichaDeDiseno(d);
  var ids = f ? f.ensayos : ensayosDelFlujo(FLUJO_POR_DEFECTO);
  return ids.filter(function(id){ var e = Lab.ensayo(id); return e && e.etapa === etapa; });
}

/* ---------- estados calculados guardados en el diseño (para indicadores y vistas anteriores) ---------- */
function estadoGuardadoDe(d){
  if(estadoCalculado(d) === 'Cerrado') return 'Completado';
  return semaforoChecklist(d) === 'naranja' ? 'En desarrollo' : 'Iniciado';
}
function sincronizarEstadosCalculados(){
  var cambio = false;
  disenos.forEach(function(d){ var e = estadoGuardadoDe(d); if(d.estado !== e){ d.estado = e; cambio = true; } });
  if(cambio) save('sid10_disenos', disenos);
}

/* ================= TRABAJO NO CONFORME AUTOMÁTICO (regla 6) ================= */
var TIPOS_TNC = {
  'fuera-ventana':'Rotura fuera de la ventana de tolerancia',
  'cv-alto':'Coeficiente de variación alto entre M1, M2 y M3',
  'poza':'Poza de curado fuera de rango',
  'equipo':'Equipo con calibración vencida'
};
function siguienteCodigoTnc(){
  var anio = new Date().getFullYear(), max = 0;
  trabajosNoConformes.forEach(function(t){ var m = /^TNC-(\d{4})-(\d+)$/.exec(t.codigo || ''); if(m && Number(m[1]) === anio) max = Math.max(max, Number(m[2])); });
  return 'TNC-' + anio + '-' + String(max + 1).padStart(3, '0');
}
function abrirTncAutomatico(tipo, detalle, carga){
  var t = {id:Lab.idNuevo('tnc'), codigo:siguienteCodigoTnc(), tipo:tipo, origen:'automatico', alerta:tipo === 'cv-alto',
    estado:'Abierto', codigos:[carga.codigo], carga_id:carga.id, edad:carga.dia, proyecto:carga.proyecto || '', diseno:carga.disenoCodigoDiseno || '',
    detalle:detalle, creado_en:new Date().toISOString(), creado_por:usuarioActual ? usuarioActual.id : ''};
  trabajosNoConformes.unshift(t);
  saveTnc();
  registrarHistorial('Abrió', 'Trabajo no conforme', t.codigo + ' · ' + TIPOS_TNC[tipo] + ' · ' + carga.codigo + ' ' + carga.dia + 'd', {codigo:carga.codigo, proyecto:carga.proyecto, ref:t.codigo});
  return t;
}
function tncAbiertoDeCarga(c){ return trabajosNoConformes.filter(function(t){ return t.carga_id === c.id && t.estado === 'Abierto' && !t.alerta; })[0] || null; }
function chipNoConformeHtml(c){ return tncAbiertoDeCarga(c) ? '<span class="chip-falta atrasado">No conforme</span>' : ''; }
function renderTncPanel(){
  var sec = document.getElementById('panel-no-conforme');
  if(!sec) return;
  var card = document.getElementById('tnc-lista');
  if(!card){ card = document.createElement('div'); card.id = 'tnc-lista'; card.className = 'card'; card.style.marginTop = '16px'; sec.appendChild(card); }
  card.innerHTML = '<div class="section-num">Trabajos no conformes</div>' +
    (trabajosNoConformes.length ? '<div class="table-scroll"><table class="data-table"><thead><tr><th>Código</th><th>Caso</th><th>Afecta a</th><th>Proyecto</th><th>Detalle</th><th>Abierto</th><th>Estado</th></tr></thead><tbody>' +
      trabajosNoConformes.map(function(t){
        return '<tr><td class="mono"><b>' + esc(t.codigo) + '</b></td><td>' + esc(TIPOS_TNC[t.tipo] || t.tipo) + (t.alerta ? ' <span class="fase-chip">alerta</span>' : '') + '</td>' +
          '<td class="mono">' + esc(t.codigos.join(', ')) + (t.edad ? ' · ' + t.edad + ' d' : '') + '</td><td>' + esc(t.proyecto || '—') + '</td><td>' + esc(t.detalle) + '</td>' +
          '<td>' + new Date(t.creado_en).toLocaleString('es-PE', {dateStyle:'short', timeStyle:'short'}) + '</td><td><span class="chip-falta' + (t.estado === 'Abierto' ? ' atrasado' : '') + '">' + esc(t.estado) + '</span></td></tr>';
      }).join('') + '</tbody></table></div>' : '<p class="nota-sm">Sin registros.</p>');
}

/* ================= LOTES DE AGREGADO (lote compartido) ================= */
var CAMPOS_LOTE = [
  {k:'modulo_finura', l:'Módulo de finura (fino)', ens:'ens-granulometria'},
  {k:'tmn', l:'TMN grueso (pulg)', ens:'ens-granulometria', texto:true},
  {k:'pe_fino', l:'Peso específico fino', ens:'ens-pe-fino'},
  {k:'abs_fino', l:'Absorción fino (%)', ens:'ens-pe-fino'},
  {k:'pe_grueso', l:'Peso específico grueso', ens:'ens-pe-grueso'},
  {k:'abs_grueso', l:'Absorción grueso (%)', ens:'ens-pe-grueso'},
  {k:'pus_grueso', l:'PU suelto grueso (kg/m³)', ens:'ens-pu-agregado'},
  {k:'puc_grueso', l:'PU compactado grueso (kg/m³)', ens:'ens-pu-agregado'},
  {k:'hum_fino', l:'Humedad fino (%)', ens:'ens-humedad'},
  {k:'hum_grueso', l:'Humedad grueso (%)', ens:'ens-humedad'}
];
function siguienteCodigoLote(){
  var anio = new Date().getFullYear(), max = 0;
  lotesAgregado.forEach(function(l){ var m = /^LOT-(\d{4})-(\d+)$/.exec(l.codigo || ''); if(m && Number(m[1]) === anio) max = Math.max(max, Number(m[2])); });
  return 'LOT-' + anio + '-' + String(max + 1).padStart(3, '0');
}
function lotePorId(id){ return lotesAgregado.filter(function(l){ return l.id === id; })[0] || null; }
function disenosDeLote(id){ return disenos.filter(function(d){ return d.loteAgregadoId === id; }); }
var loteDisenoCodigo = null;
function abrirLoteModal(d, modo){
  loteDisenoCodigo = d.codigo;
  var lista = lotesAgregado.filter(function(l){ return !l.anulado; }).slice().sort(function(a,b){ return (b.creado_en || '').localeCompare(a.creado_en || ''); });
  var tabla = lista.length ? '<div class="table-scroll"><table class="data-table"><thead><tr><th>Lote</th><th>Fino</th><th>Grueso</th><th>Procedencia</th><th>Muestreo</th><th>MF</th><th>Usado en</th><th></th></tr></thead><tbody>' +
    lista.map(function(l){
      return '<tr><td class="mono"><b>' + esc(l.codigo) + '</b></td><td>' + esc(l.fino || '—') + '</td><td>' + esc(l.grueso || '—') + '</td><td>' + esc(l.procedencia || '—') + '</td>' +
        '<td>' + (l.fecha ? isoToDMY(l.fecha) : '—') + '</td><td>' + esc(l.resultados.modulo_finura || '—') + '</td><td>' + disenosDeLote(l.id).length + ' diseño(s)</td>' +
        '<td><button class="btn-add" data-lote-usar="' + esc(l.id) + '"' + (d.loteAgregadoId === l.id ? ' disabled' : '') + '>' + (d.loteAgregadoId === l.id ? 'En uso' : 'Usar') + '</button></td></tr>';
    }).join('') + '</tbody></table></div>' : '<p class="nota-sm">Sin lotes.</p>';
  var ensayosCar = ensayosDeEtapaEnProyecto(d, 'caracterizacion');
  var campos = CAMPOS_LOTE.filter(function(c){ return !ensayosCar.length || ensayosCar.indexOf(c.ens) > -1; });
  var form = '<div class="pred-form">' +
    '<div class="pp-field"><label>Código</label><input type="text" id="lote-codigo" value="' + siguienteCodigoLote() + '" disabled></div>' +
    '<div class="pp-field"><label>Fecha de muestreo</label><input type="date" id="lote-fecha" value="' + todayISO() + '"></div>' +
    '<div class="pp-field"><label>Agregado fino</label><input type="text" id="lote-fino" placeholder="Ej. Arena gruesa"></div>' +
    '<div class="pp-field"><label>Agregado grueso</label><input type="text" id="lote-grueso" placeholder="Ej. Piedra H67"></div>' +
    '<div class="pp-field span-2"><label>Procedencia / cantera</label><input type="text" id="lote-procedencia"></div>' +
    campos.map(function(c){ return '<div class="pp-field"><label>' + esc(c.l) + '</label><input type="text" data-lote-campo="' + c.k + '" inputmode="' + (c.texto ? 'text' : 'decimal') + '"></div>'; }).join('') +
  '</div>';
  document.getElementById('lote-modal-sub').textContent = d.codigo + ' · ' + diseñoTitulo(d);
  document.getElementById('lote-modal-body').innerHTML =
    '<div class="view-toggle" id="lote-tabs"><button class="view-toggle-btn' + (modo === 'nuevo' ? '' : ' active') + '" data-lote-tab="usar">Usar lote existente (' + lista.length + ')</button>' +
    '<button class="view-toggle-btn' + (modo === 'nuevo' ? ' active' : '') + '" data-lote-tab="nuevo">Caracterizar nuevo lote</button></div>' +
    '<div id="lote-usar" style="margin-top:12px;' + (modo === 'nuevo' ? 'display:none;' : '') + '">' + tabla + '</div>' +
    '<div id="lote-nuevo" style="margin-top:12px;' + (modo === 'nuevo' ? '' : 'display:none;') + '">' + form +
      '<div class="form-actions"><button class="btn-add verde" id="lote-guardar" data-perm="resultados:registrar">Guardar lote y usarlo en este diseño</button></div></div>';
  abrirModal('lote-modal');
}
function asignarLote(d, lote){
  var antes = d.loteAgregadoId ? (lotePorId(d.loteAgregadoId) || {}).codigo : '';
  var aplicar = function(motivo){
    d.loteAgregadoId = lote.id;
    save('sid10_disenos', disenos);
    registrarHistorial(antes ? 'Editó' : 'Registró', 'Diseño', d.codigo + ' · lote de agregado ' + lote.codigo, {codigo:d.codigo, proyecto:proyectoNombre(d.proyectoId), ref:d.codigo,
      antes:antes ? {lote:antes} : undefined, despues:{lote:lote.codigo}, motivo:motivo || ''});
    cerrarModal('lote-modal');
    toast('Lote ' + lote.codigo + ' asignado al diseño');
    refrescarTodoFlujo(d);
  };
  if(antes) pedirMotivo('Cambiar el lote de agregado', resumenCambioHtml({antes:{lote:antes}, despues:{lote:lote.codigo}}, {lote:'Lote de agregado'}), aplicar);
  else aplicar('');
}

/* ================= FICHA DEL DISEÑO: línea de 5 pasos ================= */
var flujoDisenoCodigo = null;
function pasosAplicables(d){
  var f = fichaDeDiseno(d);
  var et = etapasDelChecklist(f || {ensayos:ensayosDelFlujo(FLUJO_POR_DEFECTO)});
  return PASOS_DISENO.filter(function(p){
    if(p.id === 'diseno') return true;
    if(p.id === 'elaboracion') return et.elaboracion || et.endurecido || et.fresco;
    return !!et[p.etapa];
  });
}
function frescoDeReplica(d, i){ return replicaTieneFresco(((d.resultados && d.resultados.replicas) || [])[i]); }
function estadoPaso(d, paso){
  var reps = d.replicaObjs || [];
  if(paso === 'agregados') return d.loteAgregadoId ? 'hecho' : (!d.flujo ? 'no-aplica' : 'pendiente');
  if(paso === 'diseno') return reps.length ? 'hecho' : 'pendiente';
  if(paso === 'elaboracion') return reps.length && reps.every(function(r){ return r.codigo; }) ? 'hecho' : 'pendiente';
  if(paso === 'fresco') return frescoCompleto(d) ? 'hecho' : 'pendiente';
  if(paso === 'endurecido'){
    var cs = cargasActivas(d);
    var total = reps.length * (d.diasRotura || []).length;
    return cs.length && cs.length >= total && cs.every(function(c){ return c.estado === 'completado'; }) ? 'hecho' : 'pendiente';
  }
  return 'pendiente';
}
function proximaCargaPendiente(d){
  return cargasActivas(d).filter(function(c){ return c.estado === 'pendiente'; })
    .sort(function(a,b){ return (diaDeActivacion(a) || '9').localeCompare(diaDeActivacion(b) || '9') || a.dia - b.dia; })[0] || null;
}
function botonesPaso(d, paso){
  var b = function(acc, texto, clase, extra){ return '<button class="btn-add' + (clase ? ' ' + clase : '') + '" data-flujo-acc="' + acc + '"' + (extra || '') + '>' + texto + '</button>'; };
  if(paso === 'agregados') return b('caracterizar', 'Caracterizar', 'verde', ' data-perm="resultados:registrar"') + b('usar-lote', 'Usar lote existente', 'ghost', ' data-perm="disenos:crear"');
  if(paso === 'diseno') return (d.replicaObjs && d.replicaObjs.length ? '' : b('replicas', 'Definir réplicas y asignar', 'verde', ' data-perm="disenos:crear"')) + b('ver-diseno', 'Ver cálculo del diseño', 'ghost');
  if(paso === 'elaboracion') return b('iniciar', 'Iniciar (0\')', 'verde', ' data-perm="roturas:registrar"') + b('elaborar', 'Registrar elaboración', 'ghost', ' data-perm="roturas:registrar"') + b('etiquetas', 'Imprimir etiquetas', 'ghost');
  if(paso === 'fresco') return b('fresco', 'Llenar fresco', 'verde', ' data-perm="resultados:registrar"');
  if(paso === 'endurecido'){
    var c = proximaCargaPendiente(d);
    if(!c) return b('roturas', 'Ver roturas', 'ghost');
    var activa = cargaActiva(c);
    return '<button class="btn-add verde" data-perm="roturas:registrar" data-flujo-acc="rotura" data-id="' + esc(c.id) + '"' + (activa ? '' : ' disabled') + '>' +
      (activa ? 'Registrar rotura ' + c.dia + 'd' : 'Registrar rotura · se activa el ' + fechaCorta(diaDeActivacion(c))) + '</button>';
  }
  return '';
}
function lineaPasosHtml(d){
  var pasos = pasosAplicables(d);
  var actual = -1;
  pasos.forEach(function(p, i){ if(actual === -1 && estadoPaso(d, p.id) === 'pendiente') actual = i; });
  return '<ol class="flujo-linea">' + pasos.map(function(p, i){
    var est = estadoPaso(d, p.id);
    var clase = i === actual ? 'actual' : est;
    return '<li class="' + clase + '" data-paso="' + p.id + '"><span class="fl-num">' + (est === 'hecho' ? '✓' : i + 1) + '</span>' +
      '<span class="fl-nombre">' + esc(p.nombre) + '</span><span class="fl-cuando">' + (est === 'no-aplica' ? 'Diseño anterior' : esc(p.cuando)) + '</span></li>';
  }).join('') + '</ol>' +
  (actual > -1 ? '<div class="flujo-accion"><span>Paso actual: <b>' + esc(pasos[actual].nombre) + '</b></span><div class="flujo-botones">' + botonesPaso(d, pasos[actual].id) + '</div></div>'
    : '<div class="flujo-accion cerrado"><span><b>Diseño cerrado:</b> no falta nada del checklist. Queda disponible para el RR.</span></div>');
}
function tablaReplicasHtml(d){
  var reps = d.replicaObjs || [];
  if(!reps.length) return '<p class="nota-sm">Sin réplicas.</p>';
  return '<div class="table-scroll"><table class="data-table flujo-reps"><thead><tr><th>Réplica</th><th>Código</th><th>Elaboración</th><th>A cargo de</th><th>Fresco</th><th>Roturas</th><th>Próxima ventana</th><th></th></tr></thead><tbody>' +
    reps.map(function(r, i){
      var cs = cargasActivas(d).filter(function(c){ return c.replicaNombre === r.nombre; });
      var hechas = cs.filter(function(c){ return c.estado === 'completado'; }).length;
      var prox = cs.filter(function(c){ return c.estado === 'pendiente'; }).sort(function(a,b){ return a.dia - b.dia; })[0];
      var el = r.elaboracion || {};
      var fechaEl = el.fecha || (cs[0] && cs[0].fechaElaboracion) || '';
      var horaEl = el.hora || (cs[0] && cs[0].horaElaboracion) || '';
      var celdaElab = !r.codigo ? '<span class="chip-falta">Por elaborar</span>'
        : isoToDMY(fechaEl) + ' ' + (horaEl ? '<b>' + esc(horaEl) + '</b> <button class="btn-link" data-flujo-acc="cambiar-hora" data-rep="' + i + '" data-perm="roturas:registrar">cambiar</button>'
          : '<span class="hora-pendiente"><input type="time" data-hora-rep="' + i + '"><button class="btn-add" data-flujo-acc="poner-hora" data-rep="' + i + '" data-perm="roturas:registrar">Guardar hora</button></span>');
      return '<tr><td><b>' + esc(r.nombre) + '</b></td>' +
        '<td>' + (r.codigo ? '<div class="id-card"><span class="id-card-tipo">' + ((r.tipo || d.tipoRotura) === 'Cubos' ? 'Cubo' : 'Probeta') + '</span><span class="id-card-codigo">' + esc(r.codigo) + '</span></div>' : '—') + '</td>' +
        '<td>' + celdaElab + '</td><td>' + esc(nombreDe(el.a_cargo_id) || (cs[0] && cs[0].aCargoDe) || '—') + '</td>' +
        '<td>' + (frescoDeReplica(d, i) ? '<span class="ok-mark">✓</span>' : (r.codigo ? '<span class="chip-falta">Falta</span>' : '—')) + '</td>' +
        '<td>' + (cs.length ? hechas + '/' + cs.length : '—') + '</td>' +
        '<td>' + (prox ? '<span class="chip-falta' + (cargaAtrasada(prox) ? ' atrasado' : '') + '">' + prox.dia + 'd ' + esc(textoVentana(prox)) + '</span>' : '—') + '</td>' +
        '<td class="acciones-fila">' + (!r.codigo ? '<button class="btn-add" data-flujo-acc="elaborar" data-rep="' + i + '" data-perm="roturas:registrar">Elaborar</button>' : '') + '</td></tr>';
    }).join('') + '</tbody></table></div>';
}
function abrirFlujoDiseno(d){
  if(!d) return;
  flujoDisenoCodigo = d.codigo;
  renderFlujoDiseno();
  abrirModal('disflujo-modal');
}
function renderFlujoDiseno(){
  var d = disenoPorCodigo(flujoDisenoCodigo);
  if(!d) return;
  var lote = d.loteAgregadoId ? lotePorId(d.loteAgregadoId) : null;
  document.getElementById('disflujo-modal-cab').innerHTML =
    '<div class="flujo-cab-main">' + semaforoDotHtml(semaforoChecklist(d), 'Semáforo del diseño') +
      '<div><b class="nombre-tecnico">' + esc(diseñoTitulo(d)) + '</b><div class="nota-sm">' + esc(proyectoNombre(d.proyectoId) || 'Sin proyecto') + (d.iteracionId ? ' · ' + esc(d.iteracionId) : '') + ' · ' + esc(d.fecha || '') + '</div></div>' +
      '<div class="id-card-simple">' + esc(d.codigo) + '</div></div>' +
    '<div class="chips-fila">' + (chipsFaltaHtml(d) || '<span class="chip-ok">Cerrado</span>') + '</div>';
  document.getElementById('disflujo-modal-body').innerHTML = lineaPasosHtml(d) +
    '<div class="flujo-datos">' +
      '<div class="pp-field"><label>Asignado a</label><div class="flujo-asignar"><select id="flujo-asignado">' + opcionesUsuariosHtml(d.asignadoA || '', 'Sin asignar', true) + '</select>' +
        '<button class="btn-add ghost" data-flujo-acc="asignar" data-perm="disenos:crear">Asignar</button></div></div>' +
      '<div class="pp-field"><label>Lote de agregado</label><div>' + (lote ? '<b class="mono">' + esc(lote.codigo) + '</b> · ' + esc([lote.fino, lote.grueso].filter(Boolean).join(' + ') || '—') : '<span class="nota-sm">' + 'Sin lote' + '</span>') + '</div></div>' +
      '<div class="pp-field"><label>Protocolo de edades</label><div>' + (d.diasRotura || []).map(function(x){ return '<span class="chip-edad">' + x + ' d</span>'; }).join('') + '</div></div>' +
    '</div>' +
    '<div class="section-num" style="margin-top:14px;">Réplicas</div>' + tablaReplicasHtml(d);
}
function refrescarTodoFlujo(d){
  sincronizarEstadosCalculados();
  if(typeof renderAllDesignViews === 'function') renderAllDesignViews();
  if(typeof renderRoturasAll === 'function') renderRoturasAll();
  if(document.getElementById('disflujo-modal').classList.contains('show') && (!d || d.codigo === flujoDisenoCodigo)) renderFlujoDiseno();
  if(typeof panelActual !== 'undefined' && panelActual === 'proyectos' && typeof renderProyectosPanel === 'function') renderProyectosPanel();
  if(typeof panelActual !== 'undefined' && panelActual === 'etiquetas') renderEtiquetasPanel();
}

/* ---------- asignar y hora de elaboración ---------- */
function asignarDiseno(d, usuarioId){
  if(!exigir('disenos:crear')) return;
  if((d.asignadoA || '') === usuarioId) return;
  var antes = d.asignadoA ? nombreDe(d.asignadoA) : '';
  var aplicar = function(motivo){
    d.asignadoA = usuarioId;
    save('sid10_disenos', disenos);
    registrarHistorial(antes ? 'Editó' : 'Asignó', 'Diseño', d.codigo + ' · asignado a ' + (nombreDe(usuarioId) || 'nadie'), {codigo:d.codigo, proyecto:proyectoNombre(d.proyectoId), ref:d.codigo,
      antes:antes ? {asignado:antes} : undefined, despues:{asignado:nombreDe(usuarioId) || ''}, motivo:motivo || ''});
    toast(usuarioId ? 'Diseño asignado a ' + nombreDe(usuarioId) : 'Diseño sin asignar');
    if(usuarioId && typeof avisarDisenoAsignado === 'function') avisarDisenoAsignado(d);
    refrescarTodoFlujo(d);
  };
  if(antes) pedirMotivo('Cambiar la asignación del diseño', resumenCambioHtml({antes:{asignado:antes}, despues:{asignado:nombreDe(usuarioId) || 'Sin asignar'}}, {asignado:'Asignado a'}), aplicar);
  else aplicar('');
}
function fijarHoraReplica(d, i, hora, motivo){
  var r = d.replicaObjs[i];
  var antes = (r.elaboracion && r.elaboracion.hora) || '';
  r.elaboracion = Object.assign({}, r.elaboracion || {}, {hora:hora});
  cargasActivas(d).forEach(function(c){ if(c.replicaNombre === r.nombre) c.horaElaboracion = hora; });
  var res = d.resultados && d.resultados.replicas && d.resultados.replicas[i];
  if(res && (!res.contacto || res.contacto === antes)) res.contacto = hora;
  save('sid10_disenos', disenos);
  saveRoturaCargas();
  registrarHistorial(antes ? 'Editó' : 'Registró', 'Elaboración', r.codigo + ' · ' + r.nombre + ' · hora ' + hora, {codigo:r.codigo, proyecto:proyectoNombre(d.proyectoId), ref:d.codigo,
    antes:antes ? {hora:antes} : undefined, despues:{hora:hora}, motivo:motivo || ''});
  toast('Hora de elaboración guardada: ya se calcula la ventana de rotura');
  refrescarTodoFlujo(d);
}

/* ================= ELABORACIÓN (paso 3): nace el código y sus roturas ================= */
var elabDisenoCodigo = null;
function abrirElaboracion(d, repIdx, iniciar){
  if(!exigir('roturas:registrar')) return;
  var pend = (d.replicaObjs || []).map(function(r, i){ return {r:r, i:i}; }).filter(function(x){ return !x.r.codigo; });
  if(!(d.replicaObjs || []).length){ toast('Primero definí las réplicas del diseño'); askReplicasThenPrint(d); return; }
  if(!pend.length){ toast('Todas las réplicas ya están elaboradas'); return; }
  elabDisenoCodigo = d.codigo;
  var sel = repIdx !== undefined && repIdx !== null && !d.replicaObjs[repIdx].codigo ? Number(repIdx) : pend[0].i;
  var tipo = d.tipoRotura || 'Probetas';
  document.getElementById('elab-modal-sub').textContent = d.codigo + ' · ' + diseñoTitulo(d);
  document.getElementById('elab-modal-body').innerHTML =
    '<div class="pred-form">' +
      '<div class="pp-field"><label>Réplica que se elabora</label><select id="elab-replica">' + pend.map(function(x){ return '<option value="' + x.i + '"' + (x.i === sel ? ' selected' : '') + '>' + esc(x.r.nombre) + '</option>'; }).join('') + '</select></div>' +
      '<div class="pp-field"><label>Tipo de espécimen</label><div class="elab-tipo">' +
        '<label class="pp-check-inline"><input type="radio" name="elab-tipo" value="Probetas"' + (tipo !== 'Cubos' ? ' checked' : '') + '> Probetas</label>' +
        '<label class="pp-check-inline"><input type="radio" name="elab-tipo" value="Cubos"' + (tipo === 'Cubos' ? ' checked' : '') + '> Cubos</label></div></div>' +
      '<div class="pp-field span-2"><div class="codigo-preview-destacado"><span class="cpd-label">Código que se asignará</span><span class="cpd-codigo" id="elab-codigo"></span></div></div>' +
      '<div class="pp-field"><label>A cargo de</label><select id="elab-acargo">' + opcionesUsuariosHtml(d.asignadoA || (usuarioActual && usuarioActual.id) || '') + '</select></div>' +
      '<div class="pp-field"><label>Fecha de elaboración</label><input type="date" id="elab-fecha" value="' + todayISO() + '"></div>' +
      '<div class="pp-field"><label>Hora de contacto (0\')</label><div class="hora-celda"><input type="time" id="elab-hora"><button type="button" class="btn-add verde" id="elab-iniciar">Iniciar (0\')</button></div>' +
        '</div>' +
      '<div class="pp-field span-2"><label>Edades del protocolo y ventanas de rotura</label><div id="elab-ventanas"></div></div>' +
      '<div class="pp-field span-2"><label>Ajustes a la receta en el momento (si hubo)</label><textarea id="elab-ajustes" rows="2" placeholder="Ej. se agregaron 0.5 L de agua para llegar al slump"></textarea></div>' +
    '</div>';
  if(iniciar) document.getElementById('elab-hora').value = ahoraHM();
  actualizarElabPreview();
  abrirModal('elab-modal');
}
function elabTipo(){ return (document.querySelector('input[name="elab-tipo"]:checked') || {}).value || 'Probetas'; }
function actualizarElabPreview(){
  var d = disenoPorCodigo(elabDisenoCodigo);
  if(!d) return;
  document.getElementById('elab-codigo').textContent = peekNextCodigoRotura(elabTipo());
  var fecha = document.getElementById('elab-fecha').value, hora = document.getElementById('elab-hora').value;
  document.getElementById('elab-ventanas').innerHTML = (d.diasRotura || []).map(function(dia){
    var c = {fechaElaboracion:fecha, horaElaboracion:hora, dia:dia, fechaEnsayo:calcularFechaEnsayo(fecha, dia)};
    return '<span class="chip-edad">' + dia + ' d · ' + esc(fecha ? textoVentana(c) : '—') + ' · ±' + toleranciaHoras(dia) + ' h</span>';
  }).join(' ');
}
function guardarElaboracion(){
  var d = disenoPorCodigo(elabDisenoCodigo);
  if(!d) return;
  var i = Number(document.getElementById('elab-replica').value);
  var r = d.replicaObjs[i];
  var aCargo = document.getElementById('elab-acargo').value;
  var fecha = document.getElementById('elab-fecha').value;
  var hora = document.getElementById('elab-hora').value;
  var ajustes = document.getElementById('elab-ajustes').value.trim();
  var tipo = elabTipo();
  if(!r || r.codigo){ toast('Esa réplica ya fue elaborada'); return; }
  if(!aCargo){ toast('Elegí quién está a cargo'); return; }
  if(!fecha){ toast('Indicá la fecha de elaboración'); return; }
  if(!exigirEnsayos(['ens-elaboracion'], d, aCargo)) return;
  var codigo = nextCodigoRotura(tipo);
  r.codigo = codigo;
  r.tipo = tipo;
  r.elaboracion = {fecha:fecha, hora:hora, a_cargo_id:aCargo, ajustes:ajustes, registrado_por:usuarioActual.id, registrado_en:new Date().toISOString()};
  if(!d.tipoRotura) d.tipoRotura = tipo;
  var e = Lab.ensayo(ensayoDeRotura(tipo));
  var creados = (d.diasRotura || []).map(function(dia){
    var c = {
      id:nextRoturaId(), codigo:codigo, tipo:tipo, disenoCodigoDiseno:d.codigo, replicaNombre:r.nombre, producto:r.nombre,
      proyecto:proyectoNombre(d.proyectoId), iteracion:iteracionNombre(d.iteracionId), aCargoDe:nombreDe(aCargo), aCargoDeId:aCargo,
      fechaElaboracion:fecha, horaElaboracion:hora, dia:dia, fechaEnsayo:calcularFechaEnsayo(fecha, dia), toleranciaHoras:toleranciaHoras(dia),
      correoEnviado:false, origen:'automatico', metodo:e ? e.metodo + ' (' + e.version + ')' : '', lote:d.loteAgregadoId ? (lotePorId(d.loteAgregadoId) || {}).codigo : '',
      horaEnsayo:'', a1:'', a2:'', a3:'', m1kN:'', m2kN:'', m3kN:'', m1kg:'', m2kg:'', m3kg:'',
      tipoRoturaM1:'', tipoRoturaM2:'', tipoRoturaM3:'', evid1:'', evid2:'', evid3:'',
      m1kgcm2:'', m2kgcm2:'', m3kgcm2:'', promedio:'', coefVar:'', desvest:'', comentarios:'', estado:'pendiente'
    };
    roturaCargas.push(c);
    return c;
  });
  d.resultados = d.resultados || {replicas:[]};
  d.resultados.replicas = d.resultados.replicas || [];
  if(!d.resultados.replicas[i]) d.resultados.replicas[i] = emptyReplicaExtras();
  if(hora && !d.resultados.replicas[i].contacto) d.resultados.replicas[i].contacto = hora;
  save('sid10_disenos', disenos);
  saveRoturaCargas();
  registrarHistorial('Registró', 'Elaboración', codigo + ' · ' + r.nombre + ' · ' + isoToDMY(fecha) + (hora ? ' ' + hora : ' (sin hora)') + ' · edades ' + (d.diasRotura || []).join(', ') + (ajustes ? ' · ajuste: ' + ajustes : ''),
    {codigo:codigo, proyecto:proyectoNombre(d.proyectoId), ref:d.codigo, despues:{codigo:codigo, replica:r.nombre, fecha:fecha, hora:hora, a_cargo:nombreDe(aCargo)}});
  cerrarModal('elab-modal');
  refrescarTodoFlujo(d);
  mostrarCodigosGenerados(d, r, creados);
}
function mostrarCodigosGenerados(d, r, creados){
  document.querySelector('#roturas-auto-modal h3').textContent = 'Códigos generados';
  document.getElementById('roturas-auto-modal-text').innerHTML =
    '<div class="rac-summary">' + creados.length + ' roturas creadas en el Formato de Roturas I+D (' + (r.tipo === 'Cubos' ? 'Cubos' : 'Probetas') + ').</div>' +
    '<div class="rac-replica-block"><b>' + esc(r.nombre) + ' <span class="rac-code">' + esc(r.codigo) + '</span></b>' +
      '<div class="rac-dia-chips">' + creados.map(function(c){ return '<span class="rac-dia-chip">' + c.dia + 'd · ' + esc(textoVentana(c)) + '</span>'; }).join('') + '</div></div>';
  document.getElementById('roturas-auto-modal-close').textContent = 'Volver al diseño';
  document.getElementById('roturas-auto-modal-close').onclick = function(){ cerrarModal('roturas-auto-modal'); abrirFlujoDiseno(d); };
  document.getElementById('roturas-auto-modal-etiquetas').onclick = function(){ cerrarModal('roturas-auto-modal'); abrirEtiquetas(d.codigo); };
  document.getElementById('roturas-auto-modal-go').onclick = function(){ cerrarModal('roturas-auto-modal'); cerrarModal('disflujo-modal'); showPanel('roturas'); showRoturasSub('pendientes'); };
  document.getElementById('roturas-auto-modal').classList.add('show');
}

/* ================= ENLACE DE LA ETIQUETA (QR) → registrar la rotura ================= */
function urlEtiqueta(c){ return location.origin + location.pathname + '#rotura=' + encodeURIComponent(c.codigo) + '&edad=' + c.dia; }
function abrirDesdeEnlace(){
  var m = /#rotura=([^&]+)&edad=(\d+)/.exec(location.hash || '');
  if(!m || !usuarioActual) return false;
  var codigo = decodeURIComponent(m[1]), edad = Number(m[2]);
  var c = roturaCargas.filter(function(x){ return x.codigo === codigo && Number(x.dia) === edad && !x.anulada; })[0];
  try{ history.replaceState(null, '', location.pathname + location.search); }catch(e){}
  if(!c){ toast('No se encontró la rotura ' + codigo + ' · ' + edad + ' d'); return false; }
  showPanel('roturas');
  showRoturasSub('pendientes');
  openRoturaCargaModal(c.id);
  return true;
}
window.addEventListener('hashchange', abrirDesdeEnlace);

/* ================= VENTANAS (HTML) ================= */
(function crearVentanasFase3(){
  var html =
    '<div id="disflujo-modal" class="sid-modal"><div class="modal-card wide flujo-card">' +
      '<div class="modal-header"><h3>Flujo del diseño</h3><button class="modal-close" data-close="disflujo-modal">×</button></div>' +
      '<div class="flujo-cab" id="disflujo-modal-cab"></div><div class="modal-body" id="disflujo-modal-body"></div></div></div>' +
    '<div id="elab-modal" class="sid-modal"><div class="modal-card wide">' +
      '<div class="modal-header"><div><h3>Elaboración</h3><div class="nota-sm" id="elab-modal-sub"></div></div><button class="modal-close" data-close="elab-modal">×</button></div>' +
      '<div class="modal-body" id="elab-modal-body"></div>' +
      '<div class="modal-actions"><button class="btn-add verde" id="elab-guardar" data-perm="roturas:registrar">Registrar elaboración</button><button class="btn-add ghost" data-close="elab-modal">Cancelar</button></div></div></div>' +
    '<div id="lote-modal" class="sid-modal"><div class="modal-card wide">' +
      '<div class="modal-header"><div><h3>Agregados del diseño</h3><div class="nota-sm" id="lote-modal-sub"></div></div><button class="modal-close" data-close="lote-modal">×</button></div>' +
      '<div class="modal-body" id="lote-modal-body"></div></div></div>';
  document.body.insertAdjacentHTML('beforeend', html);
})();

/* ================= EVENTOS ================= */
document.getElementById('disflujo-modal').addEventListener('click', function(e){
  var btn = e.target.closest('[data-flujo-acc]');
  if(!btn || btn.disabled) return;
  var d = disenoPorCodigo(flujoDisenoCodigo);
  if(!d) return;
  var acc = btn.dataset.flujoAcc;
  if(acc === 'caracterizar'){ if(exigir('resultados:registrar')) abrirLoteModal(d, 'nuevo'); }
  else if(acc === 'usar-lote'){ if(exigir('disenos:crear')) abrirLoteModal(d, 'usar'); }
  else if(acc === 'replicas'){ if(exigir('disenos:crear')){ cerrarModal('disflujo-modal'); askReplicasThenPrint(d); } }
  else if(acc === 'ver-diseno') openDesignModal(d);
  else if(acc === 'iniciar') abrirElaboracion(d, btn.dataset.rep, true);
  else if(acc === 'elaborar') abrirElaboracion(d, btn.dataset.rep, false);
  else if(acc === 'etiquetas') abrirEtiquetas(d.codigo);
  else if(acc === 'fresco'){
    if(!exigir('resultados:registrar')) return;
    if(!exigirEnsayos(ensayosDeEtapaEnProyecto(d, 'fresco'), d)) return;
    cerrarModal('disflujo-modal');
    openResultsModal(d, disenos.indexOf(d));
  }
  else if(acc === 'rotura'){ cerrarModal('disflujo-modal'); showPanel('roturas'); openRoturaCargaModal(btn.dataset.id); }
  else if(acc === 'roturas'){ cerrarModal('disflujo-modal'); showPanel('roturas'); showRoturasSub('formato'); }
  else if(acc === 'asignar') asignarDiseno(d, document.getElementById('flujo-asignado').value);
  else if(acc === 'poner-hora'){
    if(!exigir('roturas:registrar')) return;
    var hora = document.querySelector('[data-hora-rep="' + btn.dataset.rep + '"]').value;
    if(!hora){ toast('Escribí la hora de elaboración'); return; }
    fijarHoraReplica(d, Number(btn.dataset.rep), hora, '');
  }
  else if(acc === 'cambiar-hora'){
    if(!exigir('roturas:registrar')) return;
    var i = Number(btn.dataset.rep), r = d.replicaObjs[i];
    var actual = (r.elaboracion && r.elaboracion.hora) || '';
    var nueva = prompt('Nueva hora de elaboración de ' + r.nombre + ' (hh:mm)', actual);
    if(!nueva || nueva === actual) return;
    if(!/^\d{1,2}:\d{2}$/.test(nueva)){ toast('Usá el formato hh:mm'); return; }
    nueva = nueva.padStart(5, '0');
    pedirMotivo('Cambiar la hora de elaboración', resumenCambioHtml({antes:{hora:actual}, despues:{hora:nueva}}, {hora:'Hora de elaboración'}), function(motivo){ fijarHoraReplica(d, i, nueva, motivo); });
  }
});
document.getElementById('elab-modal').addEventListener('change', function(e){
  if(e.target.name === 'elab-tipo' || e.target.id === 'elab-fecha' || e.target.id === 'elab-hora') actualizarElabPreview();
});
document.getElementById('elab-modal').addEventListener('input', function(e){ if(e.target.id === 'elab-hora') actualizarElabPreview(); });
document.getElementById('elab-modal').addEventListener('click', function(e){
  if(e.target.closest('#elab-iniciar')){ document.getElementById('elab-hora').value = ahoraHM(); document.getElementById('elab-fecha').value = todayISO(); actualizarElabPreview(); }
});
document.getElementById('elab-guardar').addEventListener('click', guardarElaboracion);
document.getElementById('lote-modal').addEventListener('click', function(e){
  var tab = e.target.closest('[data-lote-tab]');
  if(tab){
    document.querySelectorAll('#lote-tabs .view-toggle-btn').forEach(function(b){ b.classList.toggle('active', b === tab); });
    document.getElementById('lote-usar').style.display = tab.dataset.loteTab === 'usar' ? '' : 'none';
    document.getElementById('lote-nuevo').style.display = tab.dataset.loteTab === 'nuevo' ? '' : 'none';
    return;
  }
  var d = disenoPorCodigo(loteDisenoCodigo);
  if(!d) return;
  var usar = e.target.closest('[data-lote-usar]');
  if(usar){ if(exigir('disenos:crear')) asignarLote(d, lotePorId(usar.dataset.loteUsar)); return; }
  if(e.target.closest('#lote-guardar')){
    if(!exigir('resultados:registrar')) return;
    var resultados = {}, llenos = [];
    document.querySelectorAll('[data-lote-campo]').forEach(function(el){
      var v = el.value.trim();
      resultados[el.dataset.loteCampo] = v;
      if(v){ var c = CAMPOS_LOTE.filter(function(x){ return x.k === el.dataset.loteCampo; })[0]; if(c && llenos.indexOf(c.ens) === -1) llenos.push(c.ens); }
    });
    var fino = document.getElementById('lote-fino').value.trim(), grueso = document.getElementById('lote-grueso').value.trim();
    if(!fino && !grueso){ toast('Indicá el agregado fino o el grueso del lote'); return; }
    if(!llenos.length){ toast('Registrá al menos un resultado de caracterización'); return; }
    var malos = CAMPOS_LOTE.filter(function(c){ return !c.texto && resultados[c.k] && !isFinite(Number(resultados[c.k])); });
    if(malos.length){ toast(malos[0].l + ' debe ser un número'); return; }
    if(!exigirEnsayos(llenos)) return;
    var lote = {id:Lab.idNuevo('lot'), codigo:siguienteCodigoLote(), fecha:document.getElementById('lote-fecha').value, fino:fino, grueso:grueso,
      procedencia:document.getElementById('lote-procedencia').value.trim(), resultados:resultados, ensayos:llenos,
      analista_id:usuarioActual.id, creado_en:new Date().toISOString()};
    lotesAgregado.push(lote);
    saveLotes();
    registrarHistorial('Registró', 'Lote de agregado', lote.codigo + ' · ' + [fino, grueso].filter(Boolean).join(' + ') + ' · ' + llenos.length + ' ensayo(s)', {codigo:lote.codigo, ref:lote.id, despues:resultados});
    asignarLote(d, lote);
  }
});

/* ================= ARRANQUE ================= */
sincronizarEstadosCalculados();
PANEL_HOOKS['no-conforme'] = renderTncPanel;
