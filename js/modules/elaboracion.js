/* Sistema I+D — Paso 3: Elaboración, cuaderno digital (D-CC-F-214), etiquetas y desmolde (sección 8).
   Cada réplica se elabora en su propia fecha y guarda la dosificación realmente usada y sus ensayos en
   fresco. Al guardar: nacen sus roturas (ID-XXXX), sus etiquetas y el egreso de inventario. */
'use strict';

var elaboracionSub = 'hoy';
var elaboracionFiltroProyecto = '';
var LECTURAS_MIN = [0, 30, 60, 90, 120];

function showElaboracionSub(name){
  elaboracionSub = name;
  document.querySelectorAll('#ela-subtabs .subtab').forEach(function(b){ b.classList.toggle('active', b.dataset.esub === name); });
  renderElaboracion();
}
document.getElementById('ela-subtabs').addEventListener('click', function(e){
  var b = e.target.closest('[data-esub]');
  if(b) showElaboracionSub(b.dataset.esub);
});
['ela-f-proyecto', 'ela-f-fecha'].forEach(function(id){
  document.getElementById(id).addEventListener('change', function(){
    if(id === 'ela-f-proyecto') elaboracionFiltroProyecto = this.value;
    renderElaboracion();
  });
});

/* Alcance del técnico: lo asignado a él o a su equipo (sección 3). */
function replicaMeCorresponde(d, rep){
  if(!usuarioActual) return false;
  var rol = rolDe(usuarioActual);
  var p = proyectoPorNombre(proyectoNombre(d.proyectoId));
  if(p && !proyectoVisible(p)) return false;
  if(rol !== 'TEC') return true;
  if(rep.programacion && rep.programacion.tecnicoId) return rep.programacion.tecnicoId === usuarioActual.id || esDeMiEquipo(p);
  return !p || esDeMiEquipo(p);
}
function replicasEnAlcance(filtroEstado){
  return todasLasReplicas(function(d){
    if(elaboracionFiltroProyecto && proyectoNombre(d.proyectoId) !== elaboracionFiltroProyecto) return false;
    return true;
  }).filter(function(x){ return replicaMeCorresponde(x.d, x.rep) && (!filtroEstado || filtroEstado.indexOf(x.estado) > -1); });
}
function tecnicoNombre(id){ return nombreUsuario(usuarioPorId(id)) || '—'; }
function filaReplicaHtml(x, acciones){
  var p = proyectoNombre(x.d.proyectoId);
  var prog = x.rep.programacion;
  return '<div class="ela-fila">' +
    '<div class="ela-info"><b>' + esc(x.rep.nombre) + '</b> <span class="tag-pill tag-gris">v' + (x.rep.version || x.d.version || 1) + '</span>' +
      '<span class="nota-sm">' + esc(p) + ' · ' + esc(x.d.iteracionId || '') + ' · ' + esc(x.d.codigo) + (x.rep.codigo ? ' · <b class="mono">' + esc(x.rep.codigo) + '</b>' : '') + '</span>' +
      (prog ? '<span class="nota-sm">Programada: ' + isoToDMY(prog.fecha) + ' · técnico ' + esc(tecnicoNombre(prog.tecnicoId)) + '</span>' : '') +
      estadosReplicaHtml(x.estado) + '</div>' +
    '<div class="ela-acciones">' + acciones + '</div></div>';
}
function btn(label, data, clase, perm){ return '<button class="btn-add ' + (clase || '') + '" ' + data + (perm ? ' data-perm="' + perm + '"' : '') + '>' + label + '</button>'; }
function refDatos(x){ return 'data-dis="' + esc(x.d.codigo) + '" data-rep="' + x.idx + '"'; }

function renderElaboracion(){
  var selP = document.getElementById('ela-f-proyecto');
  fillProyectoCatalogoSelect(selP, elaboracionFiltroProyecto, true);
  selP.options[0].textContent = 'Todos los proyectos';
  document.getElementById('ela-flujo').innerHTML = flujoHtml(elaboracionFiltroProyecto, true);
  var cont = document.getElementById('ela-contenido');
  var hoy = todayISO();
  var fFecha = document.getElementById('ela-f-fecha').value;
  var html = '';
  if(elaboracionSub === 'hoy'){
    var paraHoy = replicasEnAlcance(['Programada']).filter(function(x){ return x.rep.programacion.fecha <= hoy; });
    var desm = replicasEnAlcance(['Elaborada']).filter(function(x){ return horasDesdeElaboracion(x.rep) >= 16; });
    var sinEtq = replicasEnAlcance(['Elaborada', 'Desmoldada']).filter(function(x){ return x.rep.elaboracion && !x.rep.etiquetado; });
    var fragua = replicasEnAlcance(['Elaborada', 'Desmoldada']).filter(function(x){ return x.rep.elaboracion && (!x.rep.elaboracion.fraguaIni || !x.rep.elaboracion.fraguaFin); });
    html += '<div class="tec-grid">' +
      '<div class="card tec-card"><div class="section-num">Elaborar hoy <span class="col-count-badge">' + paraHoy.length + '</span></div>' +
        (paraHoy.length ? paraHoy.map(function(x){ return filaReplicaHtml(x, btn('Elaborar', 'data-ela-abrir ' + refDatos(x), 'grande', 'resultados:registrar')); }).join('') : '<p class="nota-sm">Nada programado para hoy.</p>') + '</div>' +
      '<div class="card tec-card"><div class="section-num">Desmoldar <span class="col-count-badge">' + desm.length + '</span></div>' +
        (desm.length ? desm.map(function(x){ var h = horasDesdeElaboracion(x.rep); return filaReplicaHtml(x, '<span class="tag-pill ' + (h > 32 ? 'tag-rojo' : 'tag-verde') + '">' + Math.round(h) + ' h</span>' + btn('Desmoldar', 'data-ela-desmolde ' + refDatos(x), 'grande', 'resultados:registrar')); }).join('') : '<p class="nota-sm">Nada por desmoldar (ventana 16–32 h).</p>') + '</div>' +
      '<div class="card tec-card' + (sinEtq.length ? ' card-alerta' : '') + '"><div class="section-num">Confirmar etiquetado <span class="col-count-badge">' + sinEtq.length + '</span></div>' +
        (sinEtq.length ? sinEtq.map(function(x){ return filaReplicaHtml(x, btn('Imprimir', 'data-ela-etq ' + refDatos(x), 'ghost') + btn('Escanear etiqueta', 'data-ela-etq-ok ' + refDatos(x), 'grande')); }).join('') : '<p class="nota-sm">Todas las réplicas elaboradas están etiquetadas.</p>') + '</div>' +
      '<div class="card tec-card"><div class="section-num">Fragua por completar <span class="col-count-badge">' + fragua.length + '</span></div>' +
        (fragua.length ? fragua.map(function(x){ return filaReplicaHtml(x, btn('Cargar fragua', 'data-ela-abrir ' + refDatos(x), 'ghost')); }).join('') : '<p class="nota-sm">Sin fraguas pendientes.</p>') + '</div>' +
      '</div>' +
      '<div class="form-actions"><button class="btn-add grande" data-ela-escanear="1">Escanear QR</button><button class="btn-add ghost grande" data-goto="roturas" data-sub="pendientes">Romper hoy →</button></div>';
  } else if(elaboracionSub === 'programar'){
    var lista = replicasEnAlcance(['Por elaborar', 'Programada']).filter(function(x){ return !fFecha || (x.rep.programacion && x.rep.programacion.fecha === fFecha); });
    html += '<div class="card"><p class="nota-sm">Una réplica tiene un solo técnico responsable y una fecha (hoy o futura). Al programar se verifica el stock de los materiales del día; si falta, avisa a Inventario sin bloquear.</p>' +
      (lista.length ? lista.map(function(x){
        return filaReplicaHtml(x, (can('elaboracion:programar') ? btn(x.rep.programacion ? 'Reprogramar' : 'Programar', 'data-ela-prog ' + refDatos(x), 'ghost') : '') +
          btn('Elaborar', 'data-ela-abrir ' + refDatos(x), '', 'resultados:registrar'));
      }).join('') : '<div class="empty-note">No hay réplicas por elaborar' + (elaboracionFiltroProyecto ? ' en este proyecto' : '') + '. Se crean al registrar un diseño (paso 2).</div>') + '</div>';
  } else if(elaboracionSub === 'desmolde'){
    var lista2 = replicasEnAlcance(['Elaborada']);
    html += '<div class="card"><p class="nota-sm">La tarea aparece a las 24 h de la elaboración. Ventana válida: 16 a 32 h (NTP 339.183 / ASTM C192). Fuera de ventana se puede registrar con comentario.</p>' +
      (lista2.length ? lista2.map(function(x){
        var h = horasDesdeElaboracion(x.rep);
        var tag = h < 16 ? '<span class="tag-pill tag-gris">Faltan ' + Math.ceil(16 - h) + ' h</span>' : (h <= 32 ? '<span class="tag-pill tag-verde">En ventana (' + Math.round(h) + ' h)</span>' : '<span class="tag-pill tag-rojo">Fuera de ventana (' + Math.round(h) + ' h)</span>');
        return filaReplicaHtml(x, tag + btn('Confirmar desmolde', 'data-ela-desmolde ' + refDatos(x), '', 'resultados:registrar'));
      }).join('') : '<div class="empty-note">No hay réplicas por desmoldar.</div>') + '</div>';
  } else {
    var lista3 = replicasEnAlcance(['Elaborada', 'Desmoldada', 'Completa']).filter(function(x){ return !fFecha || (x.rep.elaboracion && x.rep.elaboracion.fecha === fFecha); })
      .sort(function(a, b){ return ((b.rep.elaboracion || {}).fecha || '').localeCompare((a.rep.elaboracion || {}).fecha || ''); });
    html += '<div class="card">' + (lista3.length ? lista3.slice(0, 200).map(function(x){
      var e = x.rep.elaboracion;
      return filaReplicaHtml(x, '<span class="nota-sm">' + (e ? 'Elaborada ' + isoToDMY(e.fecha) + ' ' + esc(e.hora || '') + ' · ' + esc(tecnicoNombre(e.elaboradoPor)) : 'Registro anterior') + '</span>' +
        btn('Ver cuaderno', 'data-ela-abrir ' + refDatos(x), 'ghost') + btn('Etiquetas', 'data-ela-etq ' + refDatos(x), 'ghost'));
    }).join('') : '<div class="empty-note">Sin réplicas elaboradas con ese filtro.</div>') + '</div>';
  }
  cont.innerHTML = html;
  actualizarBadgeElaboracion();
}
function actualizarBadgeElaboracion(){
  var b = document.getElementById('nav-elab-badge');
  if(!b || !usuarioActual) return;
  var hoy = todayISO();
  var n1 = replicasEnAlcance(['Programada']).filter(function(x){ return x.rep.programacion.fecha <= hoy; }).length +
    replicasEnAlcance(['Elaborada']).filter(function(x){ return horasDesdeElaboracion(x.rep) >= 16; }).length;
  b.style.display = n1 ? 'inline-block' : 'none';
  b.textContent = n1;
}
function replicaDesdeBoton(el){
  var d = disenoPorCodigo(el.dataset.dis);
  return d ? {d:d, rep:d.replicaObjs[Number(el.dataset.rep)], idx:Number(el.dataset.rep)} : null;
}
document.getElementById('ela-contenido').addEventListener('click', function(e){
  var t = function(s){ return e.target.closest(s); };
  var el;
  if((el = t('[data-ela-abrir]'))){ var x = replicaDesdeBoton(el); if(x) abrirCuaderno(x.d, x.idx); return; }
  if((el = t('[data-ela-prog]'))){ var y = replicaDesdeBoton(el); if(y) programarReplica(y.d, y.idx); return; }
  if((el = t('[data-ela-desmolde]'))){ var z = replicaDesdeBoton(el); if(z) confirmarDesmolde(z.d, z.idx); return; }
  if((el = t('[data-ela-etq]'))){ var w = replicaDesdeBoton(el); if(w) abrirEtiquetas(w.d.codigo); return; }
  if((el = t('[data-ela-etq-ok]'))){ var v = replicaDesdeBoton(el); if(v) confirmarEtiquetado(v.d, v.idx); return; }
  if(t('[data-ela-escanear]')) escanearQR('Escanear etiqueta', abrirDesdeQR);
});

/* ================= RF-ELA-01/02: programar réplica ================= */
function programarReplica(d, idx){
  if(!exigir('elaboracion:programar')) return;
  var rep = d.replicaObjs[idx];
  if(rep.elaboracion){ toast('La réplica ya fue elaborada'); return; }
  var p = proyectoPorNombre(proyectoNombre(d.proyectoId));
  var tecnicos = usuariosActivos('TEC').filter(function(u){ return !p || (u.laboratorios || []).indexOf(p.laboratorio) > -1; });
  if(!tecnicos.length) tecnicos = usuariosActivos(['TEC', 'ANA']);
  var prog = rep.programacion || {};
  abrirDialogo({titulo:'Programar ' + rep.nombre, html:'<div class="pred-form">' +
    campo('Técnico responsable', '<select id="pr-tec">' + tecnicos.map(function(u){ return '<option value="' + u.id + '"' + (u.id === prog.tecnicoId ? ' selected' : '') + '>' + esc(nombreUsuario(u)) + ' · ' + rolDe(u) + '</option>'; }).join('') + '</select>') +
    campo('Fecha de elaboración', '<input type="date" id="pr-fecha" min="' + todayISO() + '" value="' + esc(prog.fecha || todayISO()) + '">') +
    '</div><p class="campo-error" id="pr-err"></p>',
    botones:[{label:'Programar', accion:function(c){
      var fecha = c.querySelector('#pr-fecha').value, tec = c.querySelector('#pr-tec').value;
      if(!tec){ c.querySelector('#pr-err').textContent = 'Elegí el técnico.'; return false; }
      if(!fecha || fecha < todayISO()){ c.querySelector('#pr-err').textContent = 'La fecha debe ser hoy o futura.'; return false; }
      rep.programacion = {fecha:fecha, tecnicoId:tec, programadoPor:usuarioActual.id, ts:Date.now()};
      save('sid10_disenos', disenos);
      registrarHistorial('Programó', 'Réplica', rep.nombre + ' · ' + isoToDMY(fecha) + ' · ' + tecnicoNombre(tec), {proyecto: proyectoNombre(d.proyectoId), ref: d.codigo});
      var aviso = typeof verificarStockDia === 'function' ? verificarStockDia(fecha) : '';
      if(aviso){ toast('Programada. Atención: ' + aviso); notificar('INV', 'Stock insuficiente para elaborar el ' + isoToDMY(fecha), aviso, 'inventario'); }
      else toast('Réplica programada');
      notificarUsuario(tec, 'Te asignaron una elaboración', rep.nombre + ' para el ' + isoToDMY(fecha), 'elaboracion');
      renderElaboracion();
    }}]});
}

/* ================= CUADERNO DIGITAL (RF-ELA-05 a 16) ================= */
function claveBorrador(d, idx){ return 'sid_borrador_elab_' + d.codigo + '_' + idx; }
function dosisTeoricaTanda(it, tandaL){ return n(it.pesoSeco) * tandaL / 1000; }
/* RF-ELA-16: TEC corrige hasta el fin del mismo día; después solo ANA/JEF con motivo. */
function modoEdicionCuaderno(rep){
  if(!rep.elaboracion) return can('resultados:registrar') ? 'nuevo' : 'lectura';
  var rol = rolDe(usuarioActual);
  var mismoDia = new Date(rep.elaboracion.guardado || 0).toDateString() === new Date().toDateString();
  if(rol === 'TEC') return mismoDia ? 'correccion-libre' : 'fragua';
  if(rol === 'ANA' || rol === 'JEF') return mismoDia ? 'correccion-libre' : 'correccion-motivo';
  return 'lectura';
}
function abrirCuaderno(d, idx){
  var rep = d.replicaObjs[idx];
  if(!replicaMeCorresponde(d, rep)){ toast('Esta réplica no está asignada a vos ni a tu equipo'); return; }
  if(d.estado === 'Cancelado'){ toast('El diseño está cancelado'); return; }
  var modo = modoEdicionCuaderno(rep);
  var guardado = rep.elaboracion || {};
  var borrador = load(claveBorrador(d, idx), null);
  var e = borrador && modo === 'nuevo' ? borrador : guardado;
  var tandaL = n(e.tandaL) || n(d.batchVol) || 30;
  var soloFragua = modo === 'fragua', lectura = modo === 'lectura';
  var dis = function(extra){ return (lectura || soloFragua) && !extra ? ' disabled' : ''; };
  var version = rep.version || d.version || 1;
  var mix = (d.mix || []).filter(function(it){ return n(it.pesoSeco) > 0; });
  var dosis = e.dosis || [];
  var req = requisitoDiseno(d);
  var lect = e.lecturas || [];
  var html =
    '<div class="cuaderno-cab">' + estadosReplicaHtml(estadoReplica(d, rep)) +
      '<p class="nota-sm"><b>Proyecto:</b> ' + esc(proyectoNombre(d.proyectoId)) + ' · <b>Diseño:</b> ' + esc(d.codigo + ' ' + diseñoTitulo(d)) + ' · <b>Réplica:</b> ' + esc(rep.nombre) + ' · <b>Receta:</b> v' + version +
      ' · <a href="#" data-ver-norma="1">Norma y parámetros</a></p>' +
      (borrador && modo === 'nuevo' ? '<p class="aviso-borrador">Se recuperó un borrador guardado en este equipo (' + fechaHora(borrador._ts) + ').</p>' : '') +
      (modo === 'correccion-motivo' ? '<p class="aviso-borrador">Elaboración guardada: corregirla pide motivo.</p>' : '') +
      (soloFragua ? '<p class="aviso-borrador">Ya pasó el día de la elaboración: solo podés completar la fragua.</p>' : '') + '</div>' +
    '<div class="results-section-label">1. Datos de elaboración</div><div class="pred-form">' +
      campo('Fecha (no futura)', '<input type="date" id="cu-fecha" max="' + todayISO() + '" value="' + esc(e.fecha || todayISO()) + '"' + dis() + '>', 'fecha') +
      campo('Hora de contacto a/mc', '<div class="input-con-btn"><input type="time" id="cu-hora" value="' + esc(e.hora || '') + '"' + dis() + '><button type="button" class="btn-add ghost" data-ahora="cu-hora"' + dis() + '>Ahora</button></div>', 'hora') +
      campo('Elaborado por', '<input type="text" value="' + esc(tecnicoNombre(e.elaboradoPor || usuarioActual.id)) + '" disabled>') +
      campo('Planta', '<select id="cu-planta"' + dis() + '>' + opcionesHtml(catalogo('plantas'), e.planta || d.planta) + '</select>') +
      campo('Tamaño de tanda (L)', '<input type="text" inputmode="decimal" id="cu-tanda" value="' + tandaL + '"' + dis() + '>', 'tanda') +
    '</div>' +
    '<div class="results-section-label">2. Dosificación real (kg por tanda)</div>' +
    '<p class="nota-sm">Se precarga la receta teórica. Si un material difiere más de ' + ajuste('difDosisPct') + ' % se pide confirmación.</p>' +
    '<div class="table-scroll"><table class="data-table" id="cu-dosis"><thead><tr><th>Material</th><th>Teórico</th><th>Real</th><th>Lote</th><th>Motivo (si cambia)</th></tr></thead><tbody>' +
      mix.map(function(it, k){
        var prev = dosis[k] || {};
        var teo = dosisTeoricaTanda(it, tandaL);
        return '<tr><td>' + esc(it.nombre) + '</td><td class="mono" data-teo="' + k + '">' + fmt(teo, 3) + '</td>' +
          '<td><input type="text" inputmode="decimal" data-real="' + k + '" value="' + esc(prev.real !== undefined ? prev.real : fmt(teo, 3)) + '"' + dis() + '></td>' +
          '<td><select data-lote="' + k + '"' + dis() + '>' + opcionesLote(it.nombre, prev.lote) + '</select></td>' +
          '<td><input type="text" data-motivo="' + k + '" value="' + esc(prev.motivo || '') + '"' + dis() + '></td></tr>';
      }).join('') + '</tbody></table></div>' +
    '<div class="results-section-label">3. Pérdida de asentamiento <span class="nota-sm">(mínimo la lectura 0; acepta 8 1/2)</span></div>' +
    '<div class="table-scroll"><table class="data-table"><thead><tr><th>Minuto</th><th>Hora</th><th>Slump / flow' + (req.slump ? ' <span class="nota-sm">req. ' + esc(req.slumpTxt) + '</span>' : '') + '</th><th>T° concreto (5–45 °C)</th><th>T° ambiente (0–45 °C)</th></tr></thead><tbody>' +
      LECTURAS_MIN.map(function(mn, r){
        var l = lect[r] || {};
        return '<tr><td>' + mn + "'</td>" +
          '<td><div class="input-con-btn"><input type="time" data-lec="' + r + '" data-col="hora" value="' + esc(l.hora || '') + '"' + dis() + '><button type="button" class="btn-add ghost mini" data-ahora-lec="' + r + '"' + dis() + '>Ahora</button></div></td>' +
          '<td><input type="text" data-lec="' + r + '" data-col="slump" value="' + esc(l.slump || '') + '"' + dis() + '></td>' +
          '<td><input type="text" inputmode="decimal" data-lec="' + r + '" data-col="tc" value="' + esc(l.tc || '') + '"' + dis() + '></td>' +
          '<td><input type="text" inputmode="decimal" data-lec="' + r + '" data-col="ta" value="' + esc(l.ta || '') + '"' + dis() + '></td></tr>';
      }).join('') + '</tbody></table></div>' +
    (!rep.elaboracion && !lectura ? '<button type="button" class="btn-add ghost" id="cu-avisar">Avisarme para la próxima lectura (30 min)</button>' : '') +
    '<div class="results-section-label">4. Propiedades en fresco</div><div class="pred-form">' +
      campo('Peso unitario (1500–2700 kg/m³)', '<input type="text" inputmode="decimal" id="cu-pu" value="' + esc(e.pesoUnitario || '') + '"' + dis() + '>', 'pu') +
      campo('Contenido de aire (0–15 %)' + (req.aire ? ' · req. ' + esc(req.aire) : ''), '<input type="text" inputmode="decimal" id="cu-aire" value="' + esc(e.aire || '') + '"' + dis() + '>', 'aire') +
      campo('Cohesividad', '<select id="cu-coh"' + dis() + '>' + opcionesHtml(catalogo('cohesividad'), e.cohesividad, '—') + '</select><input type="text" id="cu-coh-txt" placeholder="Detalle" value="' + esc(e.cohesividadTxt || '') + '"' + dis() + '>') +
      campo('Apariencia', '<select id="cu-apa"' + dis() + '>' + opcionesHtml(catalogo('apariencia'), e.apariencia, '—') + '</select><input type="text" id="cu-apa-txt" placeholder="Detalle" value="' + esc(e.aparienciaTxt || '') + '"' + dis() + '>') +
    '</div>' +
    '<div class="results-section-label">5. Fragua <span class="nota-sm">(se puede completar después de guardar)</span></div><div class="pred-form">' +
      campo('Fragua inicial (hh:mm)', '<input type="time" id="cu-fi" value="' + esc(e.fraguaIni || '') + '"' + (lectura ? ' disabled' : '') + '>', 'fragua') +
      campo('Fragua final (hh:mm)', '<input type="time" id="cu-ff" value="' + esc(e.fraguaFin || '') + '"' + (lectura ? ' disabled' : '') + '>') +
    '</div>' +
    '<div class="results-section-label">6. Observaciones y fotos</div>' +
    '<textarea id="cu-obs" rows="3" placeholder="Observaciones"' + dis() + '>' + esc(e.observaciones || '') + '</textarea>' +
    (!lectura && !soloFragua ? '<div class="form-row"><label class="btn-add ghost">Agregar fotos (máx. 5, incluida la hoja física)<input type="file" id="cu-fotos" accept="image/*" multiple style="display:none;"></label><span class="nota-sm" id="cu-fotos-n">' + ((e.fotos || []).length) + ' foto(s)</span></div>' : '') +
    '<div id="cu-avisos"></div><p class="campo-error" id="cu-err"></p>';
  var titulo = (rep.elaboracion ? 'Cuaderno · ' : 'Elaborar · ') + rep.nombre;
  var botones = lectura ? [] : [{label: rep.elaboracion ? (soloFragua ? 'Guardar fragua' : 'Guardar corrección') : 'Guardar elaboración', clase:'grande', accion:function(c){ return guardarCuaderno(d, idx, c, modo); }}];
  var dlg = abrirDialogo({titulo:titulo, ancho:'grande', html:html, botones:botones, cancelar: lectura ? 'Cerrar' : 'Cerrar (queda el borrador)'});
  var body = dlg.el.querySelector('.modal-body');
  body.dataset.fotos = JSON.stringify(e.fotos || []);
  marcarFueraDeRequisito(body, req);
  body.addEventListener('click', function(ev){
    var a = ev.target.closest('[data-ahora]');
    if(a){ body.querySelector('#' + a.dataset.ahora).value = ahoraHHMM(); guardarBorradorCuaderno(d, idx, body); return; }
    var al = ev.target.closest('[data-ahora-lec]');
    if(al){ body.querySelector('[data-lec="' + al.dataset.ahoraLec + '"][data-col="hora"]').value = ahoraHHMM(); guardarBorradorCuaderno(d, idx, body); return; }
    if(ev.target.closest('#cu-avisar')){ programarAvisoLectura(rep.nombre); return; }
    if(ev.target.closest('[data-ver-norma]')){ ev.preventDefault(); verNormaDeEnsayo(d.tipoEnsayo || 'Compresión en probetas'); }
  });
  body.addEventListener('input', function(ev){
    if(ev.target.id === 'cu-tanda'){
      var t = parseNumero(ev.target.value) || 0;
      mix.forEach(function(it, k){ var td = body.querySelector('[data-teo="' + k + '"]'); if(td) td.textContent = fmt(dosisTeoricaTanda(it, t), 3); });
    }
    marcarFueraDeRequisito(body, req);
    if(modo === 'nuevo') guardarBorradorCuaderno(d, idx, body);
  });
  body.addEventListener('change', function(ev){
    if(ev.target.id !== 'cu-fotos') return;
    var files = Array.prototype.slice.call(ev.target.files || []);
    var fotos = JSON.parse(body.dataset.fotos || '[]');
    if(fotos.length + files.length > 5){ toast('Máximo 5 fotos por elaboración'); return; }
    var grandes = files.filter(function(f){ return f.size > 10 * 1024 * 1024; });
    if(grandes.length){ toast('Cada foto debe pesar como máximo 10 MB'); return; }
    Promise.all(files.map(function(f, i){
      var key = 'ela_' + d.codigo + '_' + idx + '_' + Date.now() + '_' + i;
      return comprimirImagen(f).then(function(blob){ return saveEvidenciaBlob(key, blob); }).then(function(){
        indexarEvidencia({key:key, origen:'elaboracion', seccion:'Elaboración de mezcla', proyecto:proyectoNombre(d.proyectoId), disenoCodigo:d.codigo, nombre:f.name, replica:rep.nombre});
        return key;
      });
    })).then(function(keys){
      fotos = fotos.concat(keys);
      body.dataset.fotos = JSON.stringify(fotos);
      body.querySelector('#cu-fotos-n').textContent = fotos.length + ' foto(s)';
      if(modo === 'nuevo') guardarBorradorCuaderno(d, idx, body);
    });
  });
}
/* Lo que el diseño pide (para marcar en ámbar lo que queda fuera, RF-ELA-13). */
function requisitoDiseno(d){
  var ex = d.extra || {};
  var sTxt = ex.slumpReq || d.slump || '';
  var s = parseNumero(sTxt);
  return {slump: isFinite(s) ? s : null, slumpTxt: sTxt, tolSlump: s > 30 ? 50 : 1, aire: d.aire || ex.aireReq || ''};
}
function marcarFueraDeRequisito(body, req){
  var avisos = [];
  body.querySelectorAll('[data-col="slump"]').forEach(function(el){
    var v = parseNumero(el.value);
    var fuera = req.slump !== null && isFinite(v) && Math.abs(v - req.slump) > req.tolSlump;
    el.classList.toggle('fuera-requisito', fuera);
    if(fuera && el.dataset.lec === '0') avisos.push('Slump inicial ' + el.value + ' fuera del requisito (' + req.slumpTxt + ').');
  });
  var aire = body.querySelector('#cu-aire');
  if(aire && req.aire){
    var va = parseNumero(aire.value), ra = parseNumero(String(req.aire).replace('%', ''));
    var fa = isFinite(va) && isFinite(ra) && Math.abs(va - ra) > 1;
    aire.classList.toggle('fuera-requisito', fa);
    if(fa) avisos.push('Aire ' + aire.value + ' % fuera del requisito (' + req.aire + ').');
  }
  var box = body.querySelector('#cu-avisos');
  if(box) box.innerHTML = avisos.length ? '<div class="aviso-ambar">' + avisos.map(esc).join('<br>') + '</div>' : '';
}
function leerCuaderno(body, d){
  var q = function(s){ var el = body.querySelector(s); return el ? el.value.trim() : ''; };
  var mix = (d.mix || []).filter(function(it){ return n(it.pesoSeco) > 0; });
  var tandaL = parseNumero(q('#cu-tanda'));
  return {
    fecha: q('#cu-fecha'), hora: q('#cu-hora'), planta: q('#cu-planta'), tandaL: tandaL,
    dosis: mix.map(function(it, k){
      return {nombre: it.nombre, teorico: dosisTeoricaTanda(it, tandaL || 0), real: q('[data-real="' + k + '"]'), lote: q('[data-lote="' + k + '"]'), motivo: q('[data-motivo="' + k + '"]')};
    }),
    lecturas: LECTURAS_MIN.map(function(mn, r){
      return {min: mn, hora: q('[data-lec="' + r + '"][data-col="hora"]'), slump: q('[data-lec="' + r + '"][data-col="slump"]'), tc: q('[data-lec="' + r + '"][data-col="tc"]'), ta: q('[data-lec="' + r + '"][data-col="ta"]')};
    }),
    pesoUnitario: q('#cu-pu'), aire: q('#cu-aire'), cohesividad: q('#cu-coh'), cohesividadTxt: q('#cu-coh-txt'),
    apariencia: q('#cu-apa'), aparienciaTxt: q('#cu-apa-txt'), fraguaIni: q('#cu-fi'), fraguaFin: q('#cu-ff'),
    observaciones: q('#cu-obs'), fotos: JSON.parse(body.dataset.fotos || '[]')
  };
}
/* RF-ELA-14: cada cambio queda en el equipo; si se cae la señal o se cierra, se retoma. */
function guardarBorradorCuaderno(d, idx, body){
  var b = leerCuaderno(body, d);
  b._ts = Date.now();
  try{ localStorage.setItem(claveBorrador(d, idx), JSON.stringify(b)); }catch(e){}
}
/* Validaciones del cuaderno (RF-ELA-06/07/08/10/11/15 y sección 14). Devuelve {errores:{}, avisos:[]}. */
function validarCuaderno(x, d, soloFragua){
  var e = {}, avisos = [];
  if(!soloFragua){
    if(!x.fecha) e.fecha = 'Obligatoria.'; else if(x.fecha > todayISO()) e.fecha = 'No puede ser futura.';
    if(!horaValida(x.hora)) e.hora = 'Hora de contacto obligatoria (hh:mm).';
    if(!(x.tandaL > 0)) e.tanda = 'Mayor a 0 L.';
    x.dosis.forEach(function(ds){
      var r = parseNumero(ds.real);
      if(!(r >= 0)){ e.dosis = 'Cada material debe tener un valor ≥ 0 (' + ds.nombre + ').'; return; }
      ds.real = r;
      var dif = ds.teorico ? Math.abs(r - ds.teorico) / ds.teorico * 100 : 0;
      ds.difPct = dif;
      if(dif > Number(ajuste('difDosisPct'))) avisos.push(ds.nombre + ': real ' + fmt(r, 3) + ' vs teórico ' + fmt(ds.teorico, 3) + ' (' + fmt(dif, 1) + ' %)');
    });
    var l0 = x.lecturas[0];
    if(!horaValida(l0.hora) || !isFinite(parseNumero(l0.slump))) e.lecturas = 'La lectura 0 (hora y slump/flow) es obligatoria.';
    var horaPrev = '';
    x.lecturas.forEach(function(l){
      if(!l.hora && !l.slump && !l.tc && !l.ta) return;
      if(l.hora && !horaValida(l.hora)) e.lecturas = 'Hora inválida en la lectura de ' + l.min + "'.";
      if(l.hora && horaPrev && l.hora <= horaPrev) e.lecturas = 'Las horas de las lecturas deben ser crecientes.';
      if(l.hora) horaPrev = l.hora;
      if(l.slump){ var s = parseNumero(l.slump); if(!isFinite(s) || s < 0 || s > 900) e.lecturas = 'Slump/flow inválido en ' + l.min + "' (acepta 8 1/2)."; else l.slump = String(s); }
      if(l.tc){ var tc = parseNumero(l.tc); if(!(tc >= 5 && tc <= 45)) e.lecturas = 'T° del concreto entre 5 y 45 °C (' + l.min + "')."; }
      if(l.ta){ var ta = parseNumero(l.ta); if(!(ta >= 0 && ta <= 45)) e.lecturas = 'T° ambiente entre 0 y 45 °C (' + l.min + "')."; }
    });
    if(x.pesoUnitario){ var pu = parseNumero(x.pesoUnitario); if(!(pu >= 1500 && pu <= 2700)) e.pu = 'Entre 1500 y 2700 kg/m³.'; }
    if(x.aire){ var ai = parseNumero(x.aire); if(!(ai >= 0 && ai <= 15)) e.aire = 'Entre 0 y 15 %.'; }
  }
  if((x.fraguaIni && !horaValida(x.fraguaIni)) || (x.fraguaFin && !horaValida(x.fraguaFin))) e.fragua = 'Formato hh:mm.';
  else if(x.fraguaIni && x.fraguaFin && x.fraguaFin <= x.fraguaIni) e.fragua = 'La fragua final debe ser posterior a la inicial.';
  return {errores: e, avisos: avisos};
}
function guardarCuaderno(d, idx, body, modo){
  var rep = d.replicaObjs[idx];
  var soloFragua = modo === 'fragua';
  var x = leerCuaderno(body, d);
  var v = validarCuaderno(x, d, soloFragua);
  if(!mostrarErrores(body, v.errores)){
    body.querySelector('#cu-err').textContent = Object.keys(v.errores).map(function(k){ return v.errores[k]; }).join(' ');
    return false;
  }
  if(v.avisos.length && !body.dataset.confirmado){
    body.dataset.confirmado = '1';
    body.querySelector('#cu-avisos').innerHTML = '<div class="aviso-ambar"><b>La dosis real difiere más de ' + ajuste('difDosisPct') + ' % de la teórica:</b><br>' + v.avisos.map(esc).join('<br>') + '<br>Revisá y presioná guardar de nuevo para confirmar (podés anotar el motivo en cada material).</div>';
    return false;
  }
  x.desviaciones = v.avisos.map(function(a, i){ var ds = x.dosis.filter(function(dd){ return a.indexOf(dd.nombre) === 0; })[0]; return a + (ds && ds.motivo ? ' · motivo: ' + ds.motivo : ''); });
  if(soloFragua){
    rep.elaboracion.fraguaIni = x.fraguaIni; rep.elaboracion.fraguaFin = x.fraguaFin;
    sincronizarResultadosDiseno(d, idx);
    save('sid10_disenos', disenos);
    registrarHistorial('Registró', 'Fragua', rep.nombre + ' · ' + x.fraguaIni + ' / ' + x.fraguaFin, {proyecto: proyectoNombre(d.proyectoId), ref: d.codigo});
    toast('Fragua guardada');
    renderElaboracion();
    return;
  }
  if(modo === 'correccion-motivo'){
    setTimeout(function(){ pedirMotivo('Corregir elaboración de ' + rep.nombre, 'La elaboración ya fue guardada en otro día: la corrección queda registrada.', function(m){ aplicarGuardadoCuaderno(d, idx, x, m); return ''; }); }, 0);
    return;
  }
  aplicarGuardadoCuaderno(d, idx, x, '');
}
function aplicarGuardadoCuaderno(d, idx, x, motivoCorreccion){
  var rep = d.replicaObjs[idx];
  var nueva = !rep.elaboracion;
  if(!nueva){
    rep.elaboracion.correcciones = (rep.elaboracion.correcciones || []).concat([{ts:Date.now(), usuario:usuarioActual.id, motivo:motivoCorreccion || 'Corrección del mismo día', anterior:JSON.stringify(rep.elaboracion).slice(0, 4000)}]);
    Object.assign(rep.elaboracion, x, {modificado:Date.now(), modificadoPor:usuarioActual.id});
  } else {
    rep.elaboracion = Object.assign(x, {elaboradoPor:usuarioActual.id, guardado:Date.now(), sinProgramar: !rep.programacion, version: rep.version || d.version || 1});
    rep.version = rep.elaboracion.version;
  }
  sincronizarResultadosDiseno(d, idx);
  var creadas = [];
  if(nueva){
    creadas = generarRoturasReplica(d, rep);                     // 8.3
    rep.etiquetado = null;                                        // RF-ETQ-04: queda pendiente hasta escanear
    if(d.estado === 'Iniciado') d.estado = 'En desarrollo';
    if(typeof registrarEgresoAutomatico === 'function') registrarEgresoAutomatico(d, rep);   // RF-INV-06
  } else {
    actualizarFechasRoturas(d, rep);
  }
  save('sid10_disenos', disenos);
  saveRoturaCargas();
  try{ localStorage.removeItem(claveBorrador(d, idx)); }catch(e){}
  registrarHistorial(nueva ? 'Elaboró' : 'Corrigió', 'Elaboración', rep.nombre + (nueva ? ' · ' + creadas.length + ' roturas generadas (' + rep.codigo + ')' : '') + (motivoCorreccion ? ' · motivo: ' + motivoCorreccion : ''), {proyecto: proyectoNombre(d.proyectoId), ref: d.codigo});
  renderElaboracion();
  renderAllDesignViews();
  renderRoturasAll();
  if(nueva){
    abrirDialogo({titulo:'Elaboración guardada', html:'<p><b>' + esc(rep.nombre) + '</b> pasó a <b>Elaborada</b>.</p>' + estadosReplicaHtml('Elaborada') +
      '<p>Se generaron <b>' + creadas.length + ' roturas</b> con el código <b class="mono">' + esc(rep.codigo) + '</b>: ' + creadas.map(function(c){ return c.dia + ' d (' + isoToDMY(c.fechaEnsayo) + ')'; }).join(', ') + '.</p>' +
      '<p class="nota-sm">Siguiente: imprimí las etiquetas y escaneá una para confirmar el etiquetado. Mañana aparece la tarea de desmolde.</p>',
      cancelar:'Más tarde', botones:[{label:'Imprimir etiquetas', accion:function(){ abrirEtiquetas(d.codigo); }}]});
  } else toast('Elaboración corregida');
}
/* El informe, el RR y la base histórica leen d.resultados: se mantiene sincronizado con el cuaderno. */
function sincronizarResultadosDiseno(d, idx){
  var e = d.replicaObjs[idx].elaboracion;
  if(!d.resultados) d.resultados = {replicas: []};
  d.resultados.replicas[idx] = {
    contacto: e.hora, pesoUnitario: e.pesoUnitario, aire: e.aire, thermoIni: e.fraguaIni, thermoFin: e.fraguaFin,
    cohesividad: [e.cohesividad, e.cohesividadTxt].filter(Boolean).join(' · '), apariencia: [e.apariencia, e.aparienciaTxt].filter(Boolean).join(' · '),
    observaciones: e.observaciones,
    slump: e.lecturas.map(function(l){ return {hora: l.hora, slump: l.slump, tempc: l.tc, tempa: l.ta}; })
  };
  for(var i = 0; i < d.replicaObjs.length; i++) if(!d.resultados.replicas[i]) d.resultados.replicas[i] = emptyReplicaExtras();
}
/* 8.3: una rotura por edad, código ID-XXXX correlativo (uno por réplica), fecha de ensayo = elaboración + edad,
   ventana = ± tolerancia del tipo de ensayo; hereda proyecto, iteración, diseño, réplica, versión, laboratorio y técnico. */
function generarRoturasReplica(d, rep){
  var existentes = cargasDeReplicaObj(d, rep);
  if(existentes.length) return existentes;
  var tipo = d.tipoRotura || 'Probetas';
  if(!rep.codigo) rep.codigo = nextCodigoRotura(tipo);
  var e = rep.elaboracion;
  var p = proyectoPorNombre(proyectoNombre(d.proyectoId)) || {};
  return (d.diasRotura || []).map(function(dia){
    var c = {
      id: nextRoturaId(), codigo: rep.codigo, tipo: tipo, disenoCodigoDiseno: d.codigo, replicaNombre: rep.nombre, producto: rep.nombre,
      proyecto: proyectoNombre(d.proyectoId), iteracion: iteracionNombre(d.iteracionId), version: rep.version || 1,
      laboratorio: p.laboratorio || '', tecnicoId: (rep.programacion && rep.programacion.tecnicoId) || e.elaboradoPor,
      aCargoDe: tecnicoNombre((rep.programacion && rep.programacion.tecnicoId) || e.elaboradoPor),
      fechaElaboracion: e.fecha, horaElaboracion: e.hora, dia: dia, fechaEnsayo: calcularFechaEnsayo(e.fecha, dia),
      toleranciaHoras: toleranciaHoras(dia), correoEnviado: false, origen: 'elaboracion',
      horaEnsayo:'', a1:'', a2:'', a3:'', m1kN:'', m2kN:'', m3kN:'', m1kg:'', m2kg:'', m3kg:'',
      tipoRoturaM1:'', tipoRoturaM2:'', tipoRoturaM3:'', evid1:'', evid2:'', evid3:'',
      m1kgcm2:'', m2kgcm2:'', m3kgcm2:'', promedio:'', coefVar:'', desvest:'', comentarios:'', estado:'pendiente', creado: Date.now()
    };
    roturaCargas.push(c);
    return c;
  });
}
function actualizarFechasRoturas(d, rep){
  var e = rep.elaboracion;
  cargasDeReplicaObj(d, rep).forEach(function(c){
    if(c.estado !== 'pendiente') return;
    c.fechaElaboracion = e.fecha; c.horaElaboracion = e.hora;
    c.fechaEnsayo = calcularFechaEnsayo(e.fecha, c.dia);
  });
}

/* ================= DESMOLDE (8.5) ================= */
function confirmarDesmolde(d, idx){
  if(!exigir('resultados:registrar')) return;
  var rep = d.replicaObjs[idx];
  if(!rep.elaboracion){ toast('Primero se elabora la réplica'); return; }
  var h = horasDesdeElaboracion(rep);
  var aplicar = function(comentario){
    rep.desmolde = {ts:Date.now(), por:usuarioActual.id, horas:Math.round(h * 10) / 10, fueraVentana: h < 16 || h > 32, comentario:comentario || ''};
    save('sid10_disenos', disenos);
    registrarHistorial('Desmoldó', 'Réplica', rep.nombre + ' · ' + Math.round(h) + ' h' + (rep.desmolde.fueraVentana ? ' (fuera de ventana: ' + comentario + ')' : ''), {proyecto: proyectoNombre(d.proyectoId), ref: d.codigo});
    toast(rep.nombre + ' desmoldada');
    renderElaboracion();
    return '';
  };
  var verificar = function(){
    if(h < 16 || h > 32) pedirMotivo('Desmolde fuera de ventana', 'Pasaron ' + Math.round(h) + ' h desde la elaboración (ventana 16–32 h). Se registra con la desviación marcada.', aplicar);
    else aplicar('');
  };
  // RF-DES-02: se confirma escaneando las probetas de la réplica (o escribiendo su código).
  escanearQR('Escaneá una probeta de ' + rep.nombre, function(dato){
    if(!dato || dato.codigo !== rep.codigo){ toast('La etiqueta no corresponde a ' + rep.nombre + ' (' + rep.codigo + ')'); return; }
    verificar();
  });
}
/* RF-ETQ-04: el técnico escanea al menos una etiqueta de la réplica. */
function confirmarEtiquetado(d, idx){
  var rep = d.replicaObjs[idx];
  escanearQR('Escaneá una etiqueta de ' + rep.nombre, function(dato){
    if(!dato || dato.codigo !== rep.codigo){ toast('La etiqueta no corresponde a ' + rep.nombre + ' (' + rep.codigo + ')'); return; }
    rep.etiquetado = {ts:Date.now(), por:usuarioActual.id};
    save('sid10_disenos', disenos);
    registrarHistorial('Confirmó', 'Etiquetado', rep.nombre + ' · ' + rep.codigo, {proyecto: proyectoNombre(d.proyectoId), ref: d.codigo});
    toast('Etiquetado confirmado');
    renderElaboracion();
  });
}

/* RF-ELA-09: aviso de próxima lectura a los 30 min (se puede posponer cerrándolo). */
function programarAvisoLectura(nombre){
  var lanzar = function(){
    setTimeout(function(){
      var msg = 'Toca la próxima lectura de asentamiento de ' + nombre;
      if('Notification' in window && Notification.permission === 'granted') new Notification('Sistema I+D', {body: msg});
      toast(msg);
      if(confirm(msg + '.\n\n¿Posponer 5 minutos?')) setTimeout(function(){ toast(msg); }, 5 * 60000);
    }, 30 * 60000);
    toast('Te aviso en 30 minutos');
  };
  if('Notification' in window && Notification.permission === 'default') Notification.requestPermission().then(lanzar); else lanzar();
}
/* Fotos: se comprimen al subir (sección 14). */
function comprimirImagen(file){
  return new Promise(function(resolve){
    if(!/^image\//.test(file.type) || file.size < 400 * 1024){ resolve(file); return; }
    var img = new Image(), url = URL.createObjectURL(file);
    img.onload = function(){
      var esc2 = Math.min(1, 1600 / Math.max(img.width, img.height));
      var cv = document.createElement('canvas');
      cv.width = Math.round(img.width * esc2); cv.height = Math.round(img.height * esc2);
      cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
      URL.revokeObjectURL(url);
      cv.toBlob(function(b){ resolve(b || file); }, 'image/jpeg', 0.8);
    };
    img.onerror = function(){ resolve(file); };
    img.src = url;
  });
}

/* ================= RF-ELA-03: hoja de trabajo imprimible (varias réplicas del día) ================= */
document.getElementById('ela-hoja').addEventListener('click', function(){
  var fecha = document.getElementById('ela-f-fecha').value || todayISO();
  var lista = replicasEnAlcance(['Programada', 'Por elaborar']).filter(function(x){ return x.rep.programacion && x.rep.programacion.fecha === fecha; });
  if(!lista.length){ toast('No hay réplicas programadas para el ' + isoToDMY(fecha)); return; }
  var materiales = {};
  lista.forEach(function(x){ (x.d.mix || []).forEach(function(it){ if(n(it.pesoSeco)) materiales[it.nombre] = true; }); });
  var nombres = Object.keys(materiales);
  var col = function(x){ return '<th>' + esc(x.rep.nombre) + '<br><small>' + esc(x.d.codigo) + ' · v' + (x.rep.version || 1) + '</small><div class="qr">' + qrSvg(urlQR(x.d.codigo, '', '')) + '</div></th>'; };
  var html = '<!doctype html><html><head><meta charset="utf-8"><title>Hoja de trabajo D-CC-F-214 ' + fecha + '</title><style>body{font-family:Arial;font-size:11px;margin:10mm;}table{border-collapse:collapse;width:100%;}th,td{border:1px solid #888;padding:4px;text-align:center;}th{background:#e6f6fb;}.qr{width:20mm;height:20mm;margin:2px auto;}.qr svg{width:100%;height:100%;}td.l{text-align:left;font-weight:bold;}h1{font-size:15px;}</style></head><body>' +
    '<h1>Hoja de trabajo · Elaboración de mezclas (D-CC-F-214) · ' + isoToDMY(fecha) + '</h1><table><thead><tr><th>Concepto</th>' + lista.map(col).join('') + '</tr></thead><tbody>' +
    '<tr><td class="l">Proyecto</td>' + lista.map(function(x){ return '<td>' + esc(proyectoNombre(x.d.proyectoId)) + '</td>'; }).join('') + '</tr>' +
    '<tr><td class="l">Técnico</td>' + lista.map(function(x){ return '<td>' + esc(tecnicoNombre(x.rep.programacion.tecnicoId)) + '</td>'; }).join('') + '</tr>' +
    '<tr><td class="l">Tanda (L)</td>' + lista.map(function(x){ return '<td>' + (n(x.d.batchVol) || 30) + '</td>'; }).join('') + '</tr>' +
    nombres.map(function(nm){ return '<tr><td class="l">' + esc(nm) + ' (kg/tanda)</td>' + lista.map(function(x){ var it = (x.d.mix || []).filter(function(m){ return m.nombre === nm; })[0]; return '<td>' + (it ? fmt(dosisTeoricaTanda(it, n(x.d.batchVol) || 30), 3) + '<br>Real: ______' : '—') + '</td>'; }).join('') + '</tr>'; }).join('') +
    ['Hora contacto a/mc', "Slump 0'", "Slump 30'", "Slump 60'", "Slump 90'", "Slump 120'", 'T° concreto / ambiente', 'Peso unitario', 'Aire %', 'Cohesividad', 'Apariencia', 'Fragua inicial / final', 'Observaciones'].map(function(r){
      return '<tr><td class="l">' + r + '</td>' + lista.map(function(){ return '<td style="height:20px;"></td>'; }).join('') + '</tr>';
    }).join('') + '</tbody></table></body></html>';
  var w = window.open('', '_blank');
  if(!w){ toast('Permití ventanas emergentes para imprimir'); return; }
  w.document.write(html); w.document.close(); setTimeout(function(){ w.print(); }, 300);
  registrarHistorial('Imprimió', 'Hoja de trabajo', isoToDMY(fecha) + ' · ' + lista.length + ' réplicas');
});

PANEL_HOOKS.elaboracion = function(){ renderElaboracion(); };
