/* Sistema I+D — Paso 5: Revisión de resultados (RF-RES-01 a 05). Los resultados se revisan y se bloquean
   por diseño; de ahí salen el RR, el informe final y el archivo, sin volver a digitar nada. */
'use strict';

var revisionSub = 'bandeja';
function disenosParaRevision(){
  return disenos.filter(function(d){
    var p = proyectoPorNombre(proyectoNombre(d.proyectoId));
    return (!p || proyectoVisible(p)) && disenoListoParaRevision(d);
  });
}
function showRevisionSub(name){
  revisionSub = name;
  document.querySelectorAll('#rev-subtabs .subtab').forEach(function(b){ b.classList.toggle('active', b.dataset.rsub === name); });
  renderRevision();
}
document.getElementById('rev-subtabs').addEventListener('click', function(e){
  var b = e.target.closest('[data-rsub]');
  if(b) showRevisionSub(b.dataset.rsub);
});
function filaDisenoRevision(d, acciones){
  var r = resistenciaPorEdad(d);
  var edades = Object.keys(r).map(Number).sort(function(a, b){ return a - b; });
  return '<div class="ela-fila"><div class="ela-info"><b>' + esc(d.codigo + ' · ' + diseñoTitulo(d)) + '</b>' +
    '<span class="nota-sm">' + esc(proyectoNombre(d.proyectoId) + ' · ' + (d.iteracionId || '') + ' · v' + (d.version || 1) + " · f'c " + (d.fc || '-')) + '</span>' +
    '<span class="nota-sm">' + (edades.length ? edades.map(function(e){ return e + ' d: <b>' + fmt(r[e], 1) + '</b>'; }).join(' · ') : 'Sin resultados') + '</span>' +
    (d.revision ? '<span class="nota-sm">Revisado por ' + esc(nombreUsuario(usuarioPorId(d.revision.por))) + ' el ' + fechaHora(d.revision.ts) + '</span>' : '') +
    (d.validacion ? '<span class="nota-sm txt-verde">Validado por ' + esc(d.validacion.nombre) + ' el ' + fechaHora(d.validacion.ts) + '</span>' : '') +
    '</div><div class="ela-acciones">' + acciones + '</div></div>';
}
function renderRevision(){
  var c = document.getElementById('rev-contenido');
  if(revisionSub === 'bandeja'){
    var lista = disenosParaRevision();
    c.innerHTML = '<div class="card"><p class="nota-sm">Aparecen cuando todas las réplicas del diseño están Completas (cada edad registrada, no ubicada o invalidada).</p>' +
      (lista.length ? lista.map(function(d){
        return filaDisenoRevision(d, '<button class="btn-add ghost" data-rev-informe="' + esc(d.codigo) + '">Informe</button>' +
          (can('disenos:editar') ? '<button class="btn-add" data-rev-revisar="' + esc(d.codigo) + '">' + (d.revision ? 'Ver revisión' : 'Revisar') + '</button>' : '') +
          (can('disenos:editar') && d.revision ? '<button class="btn-add" data-rev-completar="' + esc(d.codigo) + '">Completar diseño</button>' : ''));
      }).join('') : '<div class="empty-note">No hay diseños pendientes de revisión.</div>') + '</div>';
  } else if(revisionSub === 'validar'){
    var porValidar = disenos.filter(function(d){ return d.estado === 'Completado' && !d.validacion && (proyectoPorNombre(proyectoNombre(d.proyectoId)) ? proyectoVisible(proyectoPorNombre(proyectoNombre(d.proyectoId))) : true); });
    c.innerHTML = '<div class="card"><p class="nota-sm">Jefatura valida (firma) cada diseño completado: queda su nombre, fecha y hora.</p>' +
      (porValidar.length ? porValidar.map(function(d){
        return filaDisenoRevision(d, '<button class="btn-add ghost" data-rev-informe="' + esc(d.codigo) + '">Informe</button>' +
          (can('disenos:aprobar') ? '<button class="btn-add" data-rev-validar="' + esc(d.codigo) + '">Validar (firma)</button>' : ''));
      }).join('') : '<div class="empty-note">No hay diseños por validar.</div>') + '</div>';
  } else {
    var cerrados = disenos.filter(function(d){ return d.estado === 'Completado'; }).sort(function(a, b){ return ((b.completado || {}).ts || 0) - ((a.completado || {}).ts || 0); });
    c.innerHTML = '<div class="card">' + (cerrados.length ? cerrados.slice(0, 200).map(function(d){
      return filaDisenoRevision(d, '<button class="btn-add ghost" data-rev-informe="' + esc(d.codigo) + '">Informe</button>' +
        (can('disenos:editar') ? '<button class="btn-add ghost" data-rev-reabrir="' + esc(d.codigo) + '">Reabrir</button>' : ''));
    }).join('') : '<div class="empty-note">Todavía no hay diseños completados.</div>') + '</div>';
  }
  updateNavBadges();
}
document.getElementById('rev-contenido').addEventListener('click', function(e){
  var t = function(s){ return e.target.closest(s); };
  var el;
  if((el = t('[data-rev-informe]'))){ openInformeModal(disenoPorCodigo(el.dataset.revInforme)); return; }
  if((el = t('[data-rev-revisar]'))){ abrirRevision(disenoPorCodigo(el.dataset.revRevisar)); return; }
  if((el = t('[data-rev-completar]'))){ completarDiseno(disenoPorCodigo(el.dataset.revCompletar)); return; }
  if((el = t('[data-rev-validar]'))){ validarDiseno(disenoPorCodigo(el.dataset.revValidar)); return; }
  if((el = t('[data-rev-reabrir]'))){ reabrirDiseno(disenoPorCodigo(el.dataset.revReabrir)); return; }
});

/* Hoja de revisión: todas las edades, réplicas y especímenes; se invalida con motivo (RF-RES-03). */
function abrirRevision(d){
  var cargas = cargasDeDiseno(d).sort(function(a, b){ return a.dia - b.dia || (a.replicaNombre || '').localeCompare(b.replicaNombre || ''); });
  var comb = nombreUnificadoPromedio(d);
  var bloqueado = d.estado === 'Completado';
  var html = '<p class="nota-sm">El promedio por nombre unificado combina las cargas de todas las réplicas válidas (R1 + R2…). Lo invalidado queda visible tachado.</p>' +
    '<div class="table-scroll"><table class="data-table"><thead><tr><th>Edad</th><th>Réplica</th><th>ID</th><th>Estado</th><th>M1</th><th>M2</th><th>M3</th><th>CV</th><th>Prensa</th><th>Observaciones</th><th></th></tr></thead><tbody>' +
    cargas.map(function(c){
      var celdaM = function(m){
        var v = c['m' + m + 'kgcm2'];
        var ok = especimenValido(c, m);
        return '<td class="' + (ok ? '' : 'tachado') + '">' + esc(v || '-') + (v && ok && !bloqueado && c.estado === 'completado' ? ' <button class="btn-icon mini danger" data-inv-esp="' + c.id + '" data-m="' + m + '" title="Invalidar M' + m + '">×</button>' : '') + '</td>';
      };
      var obs = [c.fueraTolerancia ? 'Fuera de ventana: ' + c.motivoFueraTolerancia : '', c.alertaDispersion ? 'Dispersión: ' + c.comentarioDispersion : '', c.estado === 'no-ubicada' ? 'No ubicada: ' + c.comentarios : '']
        .concat((c.invalidaciones || []).map(function(iv){ return 'Invalidado ' + iv.especimen + ': ' + iv.motivo; })).filter(Boolean).join(' · ');
      return '<tr><td>' + c.dia + ' d</td><td>' + esc(c.replicaNombre) + '</td><td class="mono">' + esc(c.codigo) + '</td><td>' + esc(etiquetaEstadoCarga(c)) + '</td>' +
        celdaM(1) + celdaM(2) + celdaM(3) + '<td>' + esc(c.coefVar || '-') + '</td><td>' + esc(c.prensa ? c.prensa.nombre : '-') + '</td><td class="nota-sm">' + esc(obs) + '</td>' +
        '<td>' + (!bloqueado && c.estado === 'completado' ? '<button class="btn-add ghost mini" data-inv-edad="' + c.id + '">Invalidar edad</button>' : '') + '</td></tr>';
    }).join('') + '</tbody></table></div>' +
    '<div class="results-section-label">Promedio por nombre unificado</div><div class="table-scroll"><table class="data-table"><thead><tr><th>Edad</th><th>Promedio (kg/cm²)</th><th>Desv. est.</th><th>CV</th><th>Cumple f\'c</th></tr></thead><tbody>' +
    Object.keys(comb).map(Number).sort(function(a, b){ return a - b; }).map(function(e){
      var st = comb[e];
      return '<tr><td>' + e + ' d</td><td><b>' + esc(st.promedio) + '</b></td><td>' + esc(st.desvest) + '</td><td>' + esc(st.coefVar) + '</td><td>' + (e >= 28 && n(d.fc) ? (n(st.promedio) >= n(d.fc) ? '<span class="txt-verde">Sí</span>' : '<span class="txt-rojo">No</span>') : '—') + '</td></tr>';
    }).join('') + '</tbody></table></div>';
  var dlg = abrirDialogo({titulo:'Revisión · ' + d.codigo + ' · ' + diseñoTitulo(d), ancho:'grande', html:html, cancelar:'Cerrar',
    botones: bloqueado || !can('disenos:editar') ? [] : [{label: d.revision ? 'Revisión hecha ✓' : 'Marcar como revisado', accion:function(){
      if(d.revision) return;
      d.revision = {ts:Date.now(), por:usuarioActual.id};
      save('sid10_disenos', disenos);
      registrarHistorial('Revisó', 'Diseño', d.codigo + ' · resultados revisados', {proyecto: proyectoNombre(d.proyectoId), ref: d.codigo});
      toast('Diseño revisado. Ya podés completarlo.');
      renderRevision();
    }}]});
  dlg.el.addEventListener('click', function(ev){
    var b = ev.target.closest('[data-inv-esp], [data-inv-edad]');
    if(!b) return;
    var c = roturaCargas.filter(function(x){ return x.id === (b.dataset.invEsp || b.dataset.invEdad); })[0];
    var especimen = b.dataset.invEsp ? 'M' + b.dataset.m : 'edad';
    pedirMotivo('Invalidar ' + (especimen === 'edad' ? 'la edad ' + c.dia + ' d' : especimen) + ' de ' + c.codigo, 'Se excluye del promedio y queda visible tachado.', function(m){
      c.invalidaciones = (c.invalidaciones || []).concat([{especimen: especimen, motivo: m, ts: Date.now(), usuario: usuarioActual.id}]);
      if(especimen === 'edad') c.estado = 'invalidada';
      recalcCarga(c);
      saveRoturaCargas();
      registrarHistorial('Invalidó', 'Resultado', c.codigo + ' día ' + c.dia + ' · ' + especimen + ' · motivo: ' + m, {proyecto: c.proyecto, ref: d.codigo});
      dlg.cerrar();
      abrirRevision(d);
      return '';
    });
  });
}
/* RF-RES-04: pregunta si los datos están completos; exige revisión; bloquea resultados; pasa a Completado y al Archivador.
   Regla de bloqueo 6: no se completa sin todas las réplicas Completas o invalidadas con motivo. */
function completarDiseno(d){
  if(!exigir('disenos:editar')) return;
  if(!d.revision){ toast('Primero revisá el diseño'); return; }
  var incompletas = (d.replicaObjs || []).filter(function(r){ return estadoReplica(d, r) !== 'Completa'; });
  if(incompletas.length){ toast('Hay réplicas sin completar: ' + incompletas.map(function(r){ return r.nombre; }).join(', ')); return; }
  abrirDialogo({titulo:'Completar ' + d.codigo, html:'<p>¿Los datos del diseño están completos? Al completarlo, sus resultados quedan <b>bloqueados</b> y pasa al <b>Archivador</b>. Después solo se reabre con motivo.</p>',
    botones:[{label:'Sí, completar', accion:function(){
      d.estado = 'Completado';
      d.completado = {ts:Date.now(), por:usuarioActual.id};
      d.editedAt = Date.now();
      save('sid10_disenos', disenos);
      registrarHistorial('Completó', 'Diseño', d.codigo + ' · resultados bloqueados', {proyecto: proyectoNombre(d.proyectoId), ref: d.codigo});
      notificar('JEF', 'Diseño por validar', d.codigo + ' · ' + diseñoTitulo(d), 'revision');
      toast('Diseño completado y archivado');
      renderRevision();
      renderAllDesignViews();
    }}]});
}
/* RF-RES-05: Jefatura valida (firma) el diseño completado. */
function validarDiseno(d){
  if(!exigir('disenos:aprobar')) return;
  if(d.estado !== 'Completado'){ toast('Solo se validan diseños completados'); return; }
  if(!confirm('¿Validar con tu firma el diseño ' + d.codigo + '?')) return;
  d.validacion = {nombre: nombreUsuario(usuarioActual), usuario: usuarioActual.id, ts: Date.now()};
  save('sid10_disenos', disenos);
  registrarHistorial('Validó', 'Diseño', d.codigo + ' · firma de Jefatura', {proyecto: proyectoNombre(d.proyectoId), ref: d.codigo});
  toast('Diseño validado');
  renderRevision();
}
function reabrirDiseno(d){
  if(!exigir('disenos:editar')) return;
  pedirMotivo('Reabrir ' + d.codigo, 'Los resultados vuelven a poder corregirse (siempre con motivo). Se quita la validación.', function(m){
    d.estado = 'En desarrollo';
    d.reaperturas = (d.reaperturas || []).concat([{ts:Date.now(), motivo:m, usuario:usuarioActual.id, validacionAnterior:d.validacion || null}]);
    d.validacion = null;
    save('sid10_disenos', disenos);
    registrarHistorial('Reabrió', 'Diseño', d.codigo + ' · motivo: ' + m, {proyecto: proyectoNombre(d.proyectoId), ref: d.codigo});
    renderRevision();
    renderAllDesignViews();
    return '';
  });
}
PANEL_HOOKS.revision = function(){ renderRevision(); };
