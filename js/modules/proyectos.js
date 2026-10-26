/* Sistema I+D — Entidad PROYECTO (sección 5): ficha, estados, iteraciones, plan de trabajo, bitácora y documentos.
   El proyecto es el eje: todo diseño, ensayo, consumo, costo y reporte cuelga de un proyecto.
   Los demás módulos siguen identificando el proyecto por su nombre (PROYECTO_CATALOGO), que se deriva de acá. */
'use strict';

var MES_NOMBRES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
var NUMERAL_ROMANO = ['I','II','III','IV','V','VI'];
var TIPOS_PROYECTO = ['Desarrollo de producto', 'Mejora', 'Estudio comparativo', 'Soporte a planta', 'Validación de proveedor', 'Otro'];
var LINEAS_PROYECTO = ['Concreto', 'Mortero', 'Adhesivo', 'Cemento', 'Aditivo', 'Otro'];
var PRIORIDADES = ['Alta', 'Media', 'Baja'];
var ESTADOS_PROYECTO = ['Planificado', 'En curso', 'En pausa', 'Completado', 'Cancelado'];

/* ================= PROYECTOS ================= */
var proyectos = load('sid10_proyectos', null);
if(!proyectos){
  // Migración: la versión anterior guardaba solo una lista de nombres. Cada nombre pasa a ser un proyecto
  // con su ficha marcada como incompleta, para que el responsable la complete.
  var nombresViejos = load('sid10_proyecto_catalogo_flat', null);
  if(!nombresViejos){
    var viejo = load('sid10_proyecto_catalogo', null);
    nombresViejos = [];
    if(viejo && !Array.isArray(viejo)) Object.keys(viejo).forEach(function(t){ viejo[t].forEach(function(nm){ if(nombresViejos.indexOf(nm) === -1) nombresViejos.push(nm); }); });
  }
  proyectos = [];
  (nombresViejos || []).forEach(function(nm){ proyectos.push(proyectoNuevoBase(nm, true)); });
  save('sid10_proyectos', proyectos);
}
function saveProyectos(){ save('sid10_proyectos', proyectos); PROYECTO_CATALOGO = proyectos.map(function(p){ return p.nombre; }); }

/* Código PRY-AAAA-NNN: correlativo por año, nunca se reutiliza (aunque el proyecto se cancele). */
function nextCodigoProyecto(){
  var anio = new Date().getFullYear();
  var cont = load('sid_contadores', {});
  var clave = 'PRY-' + anio;
  var max = proyectos.reduce(function(m, p){
    var r = String(p.codigo || '').match(/^PRY-(\d{4})-(\d+)$/);
    return r && Number(r[1]) === anio ? Math.max(m, Number(r[2])) : m;
  }, 0);
  cont[clave] = Math.max(cont[clave] || 0, max) + 1;
  save('sid_contadores', cont);
  return clave + '-' + String(cont[clave]).padStart(3, '0');
}
function proyectoNuevoBase(nombre, migrado){
  return {
    codigo: nextCodigoProyectoMigracion(), nombre: nombre, tipo: 'Desarrollo de producto', linea: 'Concreto',
    laboratorio: (usuarioActual && usuarioActual.laboratorio) || 'LAB-DINO-TRUJILLO',
    equipoLider: (usuarioActual && (usuarioActual.equipos || [])[0]) || '', equiposApoyo: [],
    responsable: '', solicitante: '', objetivo: '', hipotesis: '', fechaInicio: '', fechaFin: '',
    presupuesto: '', ceco: '', prioridad: 'Media', estado: 'Planificado',
    conclusion: '', recomendacion: '', fichaIncompleta: !!migrado, motivos: [],
    creado: Date.now(), creadoPor: usuarioActual ? usuarioActual.id : ''
  };
}
function nextCodigoProyectoMigracion(){
  if(!proyectos){
    nextCodigoProyectoMigracion.n = (nextCodigoProyectoMigracion.n || 0) + 1;
    return 'PRY-' + new Date().getFullYear() + '-' + String(nextCodigoProyectoMigracion.n).padStart(3, '0');
  }
  return nextCodigoProyecto();
}
/* Proyectos que solo existían como nombre dentro de un diseño (datos importados) pasan a tener ficha. */
function asegurarProyectosDeDisenos(){
  var nuevos = 0;
  disenos.forEach(function(d){
    var nm = proyectoNombre(d.proyectoId);
    if(nm && !proyectoPorNombre(nm)){ proyectos.push(proyectoNuevoBase(nm, true)); nuevos++; }
  });
  proyectos.forEach(function(p){ if(p.estado === 'Planificado') actualizarEstadoAutomatico(p.nombre); });
  if(nuevos) saveProyectos();
}

var PROYECTO_CATALOGO = proyectos.map(function(p){ return p.nombre; });
/* Compatibilidad: módulos viejos agregan nombres a PROYECTO_CATALOGO y llaman saveCatalogo(). */
function saveCatalogo(){
  PROYECTO_CATALOGO.forEach(function(nm){ if(!proyectoPorNombre(nm)) proyectos.push(proyectoNuevoBase(nm, true)); });
  proyectos = proyectos.filter(function(p){ return PROYECTO_CATALOGO.indexOf(p.nombre) > -1 || diseñosDeProyecto(p.nombre).length; });
  saveProyectos();
}
function proyectoPorNombre(nombre){
  var k = normalizar(nombre);
  return proyectos.filter(function(p){ return normalizar(p.nombre) === k; })[0] || null;
}
function proyectoPorCodigo(codigo){ return proyectos.filter(function(p){ return p.codigo === codigo; })[0] || null; }
function proyectoId(nombre){ return nombre; }
function proyectoNombre(pid){ if(!pid) return ''; var idx = pid.indexOf('::'); return idx>-1 ? pid.slice(idx+2) : pid; }
function iteracionNombre(val){ return val || ''; }
function todosLosProyectoIds(){ return PROYECTO_CATALOGO.slice(); }
function diseñosDeProyecto(pid){ return (typeof disenos !== 'undefined' ? disenos : []).filter(function(d){ return d.proyectoId === pid; }); }

/* Un proyecto Completado o Cancelado es de solo lectura y no admite diseños nuevos (5.4). */
function proyectoAbierto(p){ return p && ['Completado', 'Cancelado'].indexOf(p.estado) === -1; }
function proyectoAdmiteDisenos(nombre){ var p = proyectoPorNombre(nombre); return !p || proyectoAbierto(p) && p.estado !== 'En pausa'; }

/* Alcance (sección 3): ADM ve todo; los demás, los proyectos de sus laboratorios; TEC, solo los de su equipo. */
function proyectoVisible(p){
  if(!usuarioActual) return false;
  var rol = rolDe(usuarioActual);
  if(rol === 'ADM') return true;
  if(!veoLaboratorio(p.laboratorio)) return false;
  if(rol === 'TEC') return esDeMiEquipo(p) || !p.equipoLider;
  return true;
}
/* Quién puede editar la ficha: JEF de su laboratorio; ANA solo si es de su equipo (RF-PRY-02 "ANA propio"). */
function puedeEditarProyecto(p){
  if(!p || !can('proyectos:editar')) return false;
  var rol = rolDe(usuarioActual);
  if(rol === 'ADM' || rol === 'JEF') return true;
  return esDeMiEquipo(p) || p.responsable === usuarioActual.id;
}
function proyectosVisibles(){ return proyectos.filter(proyectoVisible); }

/* ================= ITERACIONES (RF-PRY-03/04) ================= */
var PROYECTO_ITERACIONES = load('sid10_proyecto_iteraciones', {});
var ITERACIONES_INFO = load('sid10_iteraciones_info', {});   // "proyecto::iteración" → {objetivo, cerrada, conclusion, …}
function saveProyectoIteraciones(){ save('sid10_proyecto_iteraciones', PROYECTO_ITERACIONES); }
function saveIteracionesInfo(){ save('sid10_iteraciones_info', ITERACIONES_INFO); }
function iteracionesDeProyecto(nombre){ return PROYECTO_ITERACIONES[nombre] || []; }
function infoIteracion(proyecto, iter){ return ITERACIONES_INFO[proyecto + '::' + iter] || {}; }
function registrarIteracion(nombreProyecto, iteracionStr, objetivo){
  if(!nombreProyecto || !iteracionStr) return;
  if(!PROYECTO_ITERACIONES[nombreProyecto]) PROYECTO_ITERACIONES[nombreProyecto] = [];
  if(PROYECTO_ITERACIONES[nombreProyecto].indexOf(iteracionStr) === -1){
    PROYECTO_ITERACIONES[nombreProyecto].push(iteracionStr);
    saveProyectoIteraciones();
  }
  if(objetivo){
    var k = nombreProyecto + '::' + iteracionStr;
    ITERACIONES_INFO[k] = Object.assign({}, ITERACIONES_INFO[k], {objetivo: objetivo});
    saveIteracionesInfo();
  }
}
function iteracionCerrada(proyecto, iter){ return !!infoIteracion(proyecto, iter).cerrada; }
/* RF-PRY-04: solo si todos sus diseños están Completados o Cancelados; pide conclusión (mín. 20). */
function validarCierreIteracion(proyecto, iter, conclusion){
  var abiertos = diseñosDeProyecto(proyecto).filter(function(d){ return d.iteracionId === iter && ['Completado', 'Validado', 'Cancelado'].indexOf(d.estado) === -1; });
  if(abiertos.length) return 'Hay ' + abiertos.length + ' diseño(s) sin completar ni cancelar: ' + abiertos.map(function(d){ return d.codigo; }).join(', ');
  if(String(conclusion || '').trim().length < 20) return 'La conclusión debe tener al menos 20 caracteres.';
  return '';
}
function cerrarIteracion(proyecto, iter, conclusion){
  var err = validarCierreIteracion(proyecto, iter, conclusion);
  if(err) return err;
  var k = proyecto + '::' + iter;
  ITERACIONES_INFO[k] = Object.assign({}, ITERACIONES_INFO[k], {cerrada:true, conclusion:conclusion.trim(), fechaCierre:Date.now(), cerradaPor: usuarioActual.id});
  saveIteracionesInfo();
  registrarHistorial('Cerró', 'Iteración', proyecto + ' — ' + iter, {proyecto:proyecto});
  return '';
}
function mesActual(){ return MES_NOMBRES[new Date().getMonth()]; }
function fillMesSelect(sel, selected){
  sel.innerHTML = '<option value="">Mes…</option>' + MES_NOMBRES.map(function(m){ return '<option'+(m===selected?' selected':'')+'>'+m+'</option>'; }).join('');
}
function fillNumeralSelect(sel, selected){
  sel.innerHTML = NUMERAL_ROMANO.map(function(r){ return '<option'+(r===selected?' selected':'')+'>'+r+'</option>'; }).join('');
}
function partesDeIteracion(iteracionStr){
  if(!iteracionStr) return {mes:'', numeral:'I', tieneNumeral:false};
  var m = iteracionStr.match(/^(.*?)\s*-\s*([IVX]{1,4})$/);
  if(m) return {mes: m[1].trim(), numeral: m[2], tieneNumeral: true};
  return {mes: iteracionStr.trim(), numeral: 'I', tieneNumeral: false};
}
function construirIteracion(mes, usarNumeral, numeral){ return usarNumeral ? (mes + ' - ' + numeral) : mes; }

/* Al renombrar un proyecto se actualizan todas las entidades que lo referencian por nombre. */
function renombrarProyectoEnTodo(viejo, nuevo){
  disenos.forEach(function(d){ if(d.proyectoId === viejo) d.proyectoId = nuevo; });
  save('sid10_disenos', disenos);
  roturaCargas.forEach(function(c){ if(c.proyecto === viejo) c.proyecto = nuevo; });
  saveRoturaCargas();
  rrEstudios.forEach(function(e){ if(e.proyectoId === viejo) e.proyectoId = nuevo; });
  save('sid10_rr', rrEstudios);
  evidenciasIdx.forEach(function(ev){ if(ev.proyecto === viejo) ev.proyecto = nuevo; });
  saveEvidenciasIdx();
  [bitacora, actividades, documentosProyecto].forEach(function(lista){ lista.forEach(function(x){ if(x.proyecto === viejo) x.proyecto = nuevo; }); });
  saveBitacora(); saveActividades(); saveDocumentos();
  if(PROYECTO_ITERACIONES[viejo]){ PROYECTO_ITERACIONES[nuevo] = PROYECTO_ITERACIONES[viejo]; delete PROYECTO_ITERACIONES[viejo]; saveProyectoIteraciones(); }
  Object.keys(ITERACIONES_INFO).forEach(function(k){
    if(k.indexOf(viejo + '::') === 0){ ITERACIONES_INFO[nuevo + k.slice(viejo.length)] = ITERACIONES_INFO[k]; delete ITERACIONES_INFO[k]; }
  });
  saveIteracionesInfo();
}

/* ================= VALIDACIÓN DE LA FICHA (5.1) ================= */
function validarFichaProyecto(f, codigoActual){
  var e = {};
  var nombre = String(f.nombre || '').trim();
  if(nombre.length < 5 || nombre.length > 120) e.nombre = 'Entre 5 y 120 caracteres.';
  else if(proyectos.some(function(p){ return p.codigo !== codigoActual && p.laboratorio === f.laboratorio && normalizar(p.nombre) === normalizar(nombre); })) e.nombre = 'Ya existe un proyecto con ese nombre en el laboratorio.';
  ['tipo', 'linea', 'laboratorio', 'equipoLider', 'responsable', 'prioridad'].forEach(function(k){ if(!f[k]) e[k] = 'Obligatorio.'; });
  if(String(f.objetivo || '').trim().length < 20) e.objetivo = 'Mínimo 20 caracteres.';
  if(!f.fechaInicio) e.fechaInicio = 'Obligatoria.';
  if(!f.fechaFin) e.fechaFin = 'Obligatoria.';
  else if(f.fechaInicio && f.fechaFin <= f.fechaInicio) e.fechaFin = 'Debe ser posterior al inicio.';
  if(f.presupuesto !== '' && f.presupuesto !== undefined && !(Number(f.presupuesto) >= 0)) e.presupuesto = 'Número mayor o igual a 0.';
  var resp = usuarioPorId(f.responsable);
  if(f.responsable && (!resp || !resp.activo || ['ANA', 'JEF'].indexOf(rolDe(resp)) === -1)) e.responsable = 'Debe ser un ANA o JEF activo.';
  return e;
}

/* ================= ESTADOS DEL PROYECTO (5.4) ================= */
/* Planificado → En curso: automático al registrar el primer diseño. */
function actualizarEstadoAutomatico(nombre){
  var p = proyectoPorNombre(nombre);
  if(p && p.estado === 'Planificado' && diseñosDeProyecto(nombre).length){
    p.estado = 'En curso';
    p.motivos.push({ts:Date.now(), de:'Planificado', a:'En curso', motivo:'Primer diseño registrado', usuario:'sistema'});
    saveProyectos();
  }
}
function reporteFinalGenerado(nombre){ return reportesProyecto.some(function(r){ return r.proyecto === nombre && r.final; }); }
/* Devuelve '' si la transición es válida, o el motivo del bloqueo. */
function validarCambioEstado(p, nuevo, motivo){
  if(!can('proyectos:aprobar')) return 'Solo Jefatura cambia el estado del proyecto.';
  var m = String(motivo || '').trim();
  if(nuevo === 'En pausa'){
    if(p.estado !== 'En curso') return 'Solo un proyecto En curso puede pausarse.';
    if(m.length < 5) return 'Indicá el motivo de la pausa.';
  }
  if(nuevo === 'En curso' && ['En pausa', 'Completado', 'Cancelado'].indexOf(p.estado) > -1 && m.length < 5) return 'Indicá el motivo para reanudar o reabrir.';
  if(nuevo === 'Completado'){
    if(p.estado !== 'En curso') return 'Solo un proyecto En curso puede completarse.';
    var abiertas = iteracionesDeProyecto(p.nombre).filter(function(it){ return !iteracionCerrada(p.nombre, it); });
    if(abiertas.length) return 'Hay iteraciones abiertas: ' + abiertas.join(', ') + '.';   // regla de bloqueo 8
    if(!reporteFinalGenerado(p.nombre)) return 'Falta generar el reporte final del proyecto.';
  }
  if(nuevo === 'Cancelado' && m.length < 5) return 'Indicá el motivo de la cancelación.';
  return '';
}
function cambiarEstadoProyecto(p, nuevo, motivo){
  var err = validarCambioEstado(p, nuevo, motivo);
  if(err) return err;
  p.motivos.push({ts:Date.now(), de:p.estado, a:nuevo, motivo:String(motivo || '').trim(), usuario:usuarioActual.id});
  var antes = p.estado;
  p.estado = nuevo;
  saveProyectos();
  registrarHistorial('Cambió estado', 'Proyecto', p.codigo + ' · ' + antes + ' → ' + nuevo + (motivo ? ' · motivo: ' + motivo : ''), {proyecto:p.nombre});
  return '';
}

/* ================= AVANCE, COSTO Y SEMÁFORO (RF-PRY-09/10/11) ================= */
function disenosActivos(nombre){ return diseñosDeProyecto(nombre).filter(function(d){ return d.estado !== 'Cancelado'; }); }
function avanceProyecto(nombre){
  var act = disenosActivos(nombre);
  var comp = act.filter(function(d){ return d.estado === 'Completado' || d.estado === 'Validado'; }).length;
  var pctDis = act.length ? comp / act.length * 100 : 0;
  var plan = actividades.filter(function(a){ return a.proyecto === nombre; });
  if(!plan.length) return Math.round(pctDis);
  var pctPlan = promedio(plan.map(function(a){ return n(a.avance); }));
  return Math.round(act.length ? (pctDis + pctPlan) / 2 : pctPlan);
}
/* Costo de un diseño = costo por m³ (CVD) × volumen de la tanda × réplicas elaboradas. */
function costoDiseno(d){
  var porM3 = n(d.cvdTotal);
  if(!porM3) return 0;
  var volM3 = (n(d.batchVol) || 30) / 1000;
  var elaboradas = (d.replicaObjs || []).filter(function(r){ return r.elaboracion; }).length || (d.replicaObjs || []).length || 1;
  return porM3 * volM3 * elaboradas;
}
function costoProyecto(nombre){
  var dis = diseñosDeProyecto(nombre).reduce(function(a, d){ return a + costoDiseno(d); }, 0);
  var egr = (typeof egresosInventario !== 'undefined' ? egresosInventario : []).filter(function(e){ return e.proyecto === nombre; })
    .reduce(function(a, e){ return a + n(e.costo); }, 0);
  return {disenos: dis, egresos: egr, total: dis + egr};
}
function semaforoProyecto(nombre){
  var p = proyectoPorNombre(nombre);
  var hoy = todayISO(), limite = addDaysISO(hoy, Number(ajuste('diasAvisoPlan')) || 3);
  var codigos = {}; diseñosDeProyecto(nombre).forEach(function(d){ codigos[d.codigo] = true; });
  var pend = roturaCargas.filter(function(c){ return codigos[c.disenoCodigoDiseno] && c.estado === 'pendiente'; });
  var plan = actividades.filter(function(a){ return a.proyecto === nombre && n(a.avance) < 100; });
  var costo = costoProyecto(nombre).total, pres = p ? n(p.presupuesto) : 0;
  var motivos = [];
  if(pend.some(function(c){ return c.fechaEnsayo < hoy; })) motivos.push('roturas vencidas');
  if(plan.some(function(a){ return a.fin && a.fin < hoy; })) motivos.push('actividades vencidas');
  if(p && p.fechaFin && p.fechaFin < hoy && proyectoAbierto(p)) motivos.push('fecha fin superada');
  if(pres && costo > pres) motivos.push('costo sobre el presupuesto');
  if(motivos.length) return {color:'rojo', motivos:motivos};
  if(pend.some(function(c){ return c.fechaEnsayo <= limite; })) motivos.push('roturas por vencer');
  if(plan.some(function(a){ return a.fin && a.fin <= limite; })) motivos.push('actividades por vencer');
  if(pres && costo > pres * 0.9) motivos.push('costo > 90 % del presupuesto');
  if(motivos.length) return {color:'naranja', motivos:motivos};
  return {color:'verde', motivos:['a tiempo']};
}
function diasRestantes(p){
  if(!p || !p.fechaFin) return null;
  return Math.round((new Date(p.fechaFin + 'T00:00:00') - new Date(todayISO() + 'T00:00:00')) / DAY);
}

/* ================= PLAN DE TRABAJO, BITÁCORA, DOCUMENTOS, REPORTES ================= */
var actividades = load('sid_actividades', []);          // RF-PRY-05
var bitacora = load('sid_bitacora', []);                // RF-PRY-06
var documentosProyecto = load('sid_documentos', []);    // RF-PRY-07/08 (enlaces a Google Drive)
var reportesProyecto = load('sid_reportes_proyecto', []); // RF-PRY-15
function saveActividades(){ save('sid_actividades', actividades); }
function saveBitacora(){ save('sid_bitacora', bitacora); }
function saveDocumentos(){ save('sid_documentos', documentosProyecto); }
function saveReportesProyecto(){ save('sid_reportes_proyecto', reportesProyecto); }
function nuevoId(prefijo){ return prefijo + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

function validarActividad(a){
  if(String(a.nombre || '').trim().length < 3) return 'Nombre de la actividad (mín. 3 caracteres).';
  if(!a.responsable) return 'Elegí el responsable.';
  if(!a.inicio || !a.fin) return 'Fechas de inicio y fin obligatorias.';
  if(a.fin < a.inicio) return 'La fecha fin debe ser igual o posterior al inicio.';
  var av = Number(a.avance);
  if(!(av >= 0 && av <= 100)) return 'El avance va de 0 a 100 %.';
  return '';
}
/* La bitácora no se borra: se edita y queda el historial de versiones. */
function guardarNotaBitacora(nota){
  if(String(nota.texto || '').trim().length < 5) return 'La nota debe tener al menos 5 caracteres.';
  var existente = nota.id ? bitacora.filter(function(b){ return b.id === nota.id; })[0] : null;
  if(existente){
    if(existente.texto === nota.texto && existente.adjunto === nota.adjunto) return '';
    existente.versiones = (existente.versiones || []).concat([{ts: existente.editado || existente.ts, texto: existente.texto, adjunto: existente.adjunto, usuario: existente.editadoPor || existente.autor}]);
    existente.texto = nota.texto.trim(); existente.adjunto = nota.adjunto || '';
    existente.editado = Date.now(); existente.editadoPor = usuarioActual.id;
  } else {
    bitacora.unshift({id: nuevoId('b'), proyecto: nota.proyecto, fecha: nota.fecha || todayISO(), texto: nota.texto.trim(),
      adjunto: nota.adjunto || '', autor: usuarioActual.id, ts: Date.now(), versiones: []});
  }
  saveBitacora();
  registrarHistorial(existente ? 'Editó' : 'Registró', 'Bitácora', nota.texto.trim().slice(0, 80), {proyecto: nota.proyecto});
  return '';
}
var TIPOS_DOCUMENTO = ['Norma', 'Ficha técnica', 'Presentación semanal', 'Informe', 'Foto de evidencia', 'Hoja de cálculo', 'Otro'];
function validarDocumento(doc){
  if(String(doc.nombre || '').trim().length < 3) return 'El nombre del documento es obligatorio.';
  if(!doc.tipo) return 'Elegí el tipo de documento.';
  if(!/^https?:\/\/\S+$/.test(doc.url || '')) return 'Pegá el enlace del archivo en Google Drive (https://…).';
  if(doc.tipo === 'Presentación semanal'){
    if(!doc.semana) return 'Indicá la semana (fecha) de la presentación.';
    var p = proyectoPorNombre(doc.proyecto);
    var semana = lunesDe(doc.semana);
    var repetida = documentosProyecto.some(function(x){
      if(x.id === doc.id || x.tipo !== 'Presentación semanal' || lunesDe(x.semana) !== semana) return false;
      var px = proyectoPorNombre(x.proyecto);
      return px && p && px.equipoLider === p.equipoLider;
    });
    if(repetida) return 'Ya hay una presentación de ese equipo para esa semana (RF-PRY-08).';
  }
  return '';
}

/* ================= SELECTORES COMPARTIDOS ================= */
/* Para registrar diseños o roturas solo se ofrecen proyectos visibles y abiertos. */
function fillProyectoCatalogoSelect(sel, selectedId, incluirCerrados){
  var lista = proyectosVisibles().filter(function(p){ return incluirCerrados || proyectoAbierto(p) || p.nombre === selectedId; });
  sel.innerHTML = '<option value="">Elegí un proyecto…</option>' + lista.map(function(p){
    return '<option value="'+esc(p.nombre)+'"'+(p.nombre===selectedId?' selected':'')+'>'+esc(p.nombre)+(p.estado !== 'En curso' && p.estado !== 'Planificado' ? ' ('+p.estado+')' : '')+'</option>';
  }).join('');
}
function refreshAllProyectoSelects(){
  fillProyectoCatalogoSelect(document.getElementById('pp-proyecto'), document.getElementById('pp-proyecto').value);
  fillProyectoCatalogoSelect(document.getElementById('ro-proyecto'), document.getElementById('ro-proyecto').value);
  fillProyectoCatalogoSelect(document.getElementById('rrg-proyecto'), document.getElementById('rrg-proyecto').value, true);
}
document.getElementById('ro-proyecto').addEventListener('change', function(){ rebuildRoDisenoSelect(); });
document.getElementById('rrg-proyecto').addEventListener('change', function(){ renderRRGDisponibles(); });

/* ================= Registro > Proyecto: ahora remite a la ficha completa ================= */
function renderProyCrud(){
  var tbody = document.getElementById('proy-tbody');
  tbody.innerHTML = proyectosVisibles().map(function(p){
    return '<tr><td><b>'+esc(p.nombre)+'</b><br><small class="mono">'+esc(p.codigo)+'</small></td>' +
      '<td class="mono">'+diseñosDeProyecto(p.nombre).length+'</td><td>'+iteracionesDeProyecto(p.nombre).length+'</td>' +
      '<td><button class="btn-add ghost" data-abrir-exp="'+esc(p.nombre)+'">Abrir expediente →</button></td></tr>';
  }).join('') || '<tr><td colspan="4" class="nota-sm">Sin proyectos.</td></tr>';
}
document.getElementById('proy-tbody').addEventListener('click', function(e){
  var b = e.target.closest('[data-abrir-exp]');
  if(b) abrirExpediente(b.dataset.abrirExp);
});
['proy-add', 'proy-cancel'].forEach(function(id){
  var el = document.getElementById(id);
  if(el) el.addEventListener('click', function(ev){ ev.preventDefault(); abrirFichaProyecto(null); });
});
