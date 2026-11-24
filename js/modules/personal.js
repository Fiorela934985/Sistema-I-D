/* Sistema I+D — Recursos › Personal (ISO/IEC 17025: 6.2).
   Ficha por usuario (puesto, laboratorio, formación, capacitaciones) y matriz de autorización: qué ensayos puede
   hacer cada persona, desde qué fecha y quién la autorizó. La matriz es la que usarán los registros de ensayo
   (Fase 3) y el plan de trabajo (Fase 5). Una autorización no se edita ni se borra: se revoca con motivo. */
'use strict';

var perTab = 'fichas';
var perFichaUsuarioId = null;

function puedeAutorizar(){ return can('personal:autorizar'); }
function usuariosActivosOrdenados(){
  return usuarios.filter(function(u){ return u.activo; }).sort(function(a,b){ return (a.nombre||a.usuario).localeCompare(b.nombre||b.usuario); });
}
function nombreUsuario(id){ var u = usuarioPorId(id); return u ? (u.nombre || u.usuario) : '—'; }

function renderPersonal(){
  document.querySelectorAll('#per-tabs [data-per-tab]').forEach(function(b){ b.classList.toggle('active', b.dataset.perTab === perTab); });
  document.getElementById('per-fichas').style.display = perTab === 'fichas' ? '' : 'none';
  document.getElementById('per-matriz-wrap').style.display = perTab === 'matriz' ? '' : 'none';
  if(perTab === 'fichas') renderFichasPersonal(); else renderMatrizAutorizacion();
}

/* ---------------- Fichas ---------------- */
function renderFichasPersonal(){
  var lista = usuariosActivosOrdenados();
  document.getElementById('per-fichas').innerHTML = '<div class="table-scroll"><table class="data-table"><thead><tr><th></th><th>Nombre</th><th>Rol</th><th>Puesto</th><th>Laboratorio</th><th>Formación</th><th>Capacitaciones</th><th>Ensayos autorizados</th><th></th></tr></thead><tbody>' +
    (lista.length ? lista.map(function(u){
      var f = Lab.personalDe(u.id) || {};
      var caps = Lab.capacitacionesDe(u.id).length;
      var auts = Lab.autorizaciones().filter(function(a){ return a.usuario_id === u.id && a.vigente; }).length;
      return '<tr><td><span class="sb-avatar chico rol-'+u.rol+'">'+esc(inicialesUsuario(u))+'</span></td>' +
        '<td><b>'+esc(u.nombre || u.usuario)+'</b><div class="nota-sm mono">'+esc(u.usuario)+'</div></td>' +
        '<td><span class="tb-rol-chip rol-'+u.rol+'">'+esc(rolLabel(u.rol))+'</span></td>' +
        '<td>'+(f.puesto ? esc(f.puesto) : '<span class="chip-falta">Falta</span>')+'</td>' +
        '<td>'+(f.laboratorio ? esc(f.laboratorio) : '<span class="chip-falta">Falta</span>')+'</td>' +
        '<td class="celda-larga">'+esc(f.formacion || '—')+'</td>' +
        '<td class="centro">'+caps+'</td>' +
        '<td class="centro"><a href="#" data-per-ver-matriz>'+auts+'</a></td>' +
        '<td class="acciones-fila"><button class="btn-icon edit" data-per-ficha="'+u.id+'" title="'+(puedeAutorizar() ? 'Editar ficha' : 'Ver ficha')+'">'+(puedeAutorizar() ? EDIT_ICON : EYE_ICON)+'</button></td></tr>';
    }).join('') : '<tr><td colspan="9" class="empty-note">No hay usuarios activos.</td></tr>') + '</tbody></table></div>';
}

function asegurarModalFicha(){
  if(document.getElementById('ficha-modal')) return;
  var m = document.createElement('div');
  m.id = 'ficha-modal';
  m.className = 'sid-modal';
  m.innerHTML = '<div class="modal-card wide"><div class="modal-header"><h3 id="ficha-titulo">Ficha de personal</h3><button class="modal-close" data-close="ficha-modal">×</button></div>' +
    '<div class="modal-body">' +
      '<div class="pred-form">' +
        '<div class="pp-field"><label for="fi-puesto">Puesto</label><input type="text" id="fi-puesto" maxlength="120" placeholder="Ej. Técnico de laboratorio"></div>' +
        '<div class="pp-field"><label for="fi-lab">Laboratorio</label><input type="text" id="fi-lab" list="fi-lab-lista" maxlength="120"><datalist id="fi-lab-lista">' +
          LABORATORIOS.map(function(l){ return '<option value="'+esc(l)+'">'; }).join('') + '</datalist></div>' +
      '</div>' +
      '<div class="pp-field"><label for="fi-formacion">Formación</label><textarea id="fi-formacion" rows="2" maxlength="1000" placeholder="Ej. Técnico en construcción civil"></textarea></div>' +
      '<div class="form-actions" data-perm="personal:autorizar"><button class="btn-add" id="fi-guardar">Guardar ficha</button></div>' +
      '<div class="section-num" style="margin-top:18px;">Capacitaciones</div>' +
      '<div class="table-scroll"><table class="data-table" id="fi-caps"></table></div>' +
      '<div class="cap-nueva" data-perm="personal:autorizar">' +
        '<input type="text" id="cap-nombre" maxlength="200" placeholder="Nombre de la capacitación">' +
        '<input type="date" id="cap-fecha" title="Fecha">' +
        '<input type="number" id="cap-horas" min="0" step="0.5" placeholder="Horas">' +
        '<input type="text" id="cap-entidad" maxlength="120" placeholder="Entidad">' +
        '<button class="btn-add" id="cap-agregar">+ Agregar</button>' +
      '</div>' +
      '<div class="section-num" style="margin-top:18px;">Ensayos autorizados</div>' +
      '<div id="fi-auts"></div>' +
    '</div></div>';
  document.body.appendChild(m);
  document.getElementById('fi-guardar').addEventListener('click', guardarFichaPersonal);
  document.getElementById('cap-agregar').addEventListener('click', agregarCapacitacion);
  document.getElementById('fi-caps').addEventListener('click', function(e){
    var b = e.target.closest('[data-cap-anular]');
    if(!b) return;
    var c = Lab.datos().capacitaciones.filter(function(x){ return x.id === b.dataset.capAnular; })[0];
    pedirMotivo('Anular capacitación', '<p>' + esc(c ? c.nombre : '') + '</p>', function(motivo){
      Lab.anularCapacitacion(b.dataset.capAnular, motivo).then(function(){ renderFichaModal(); renderPersonal(); toast('Capacitación anulada'); }).catch(function(){});
    });
  });
}
function abrirFichaPersonal(usuarioId){
  asegurarModalFicha();
  perFichaUsuarioId = usuarioId;
  var u = usuarioPorId(usuarioId), f = Lab.personalDe(usuarioId) || {};
  document.getElementById('ficha-titulo').textContent = 'Ficha de personal · ' + (u.nombre || u.usuario);
  document.getElementById('fi-puesto').value = f.puesto || '';
  document.getElementById('fi-lab').value = f.laboratorio || '';
  document.getElementById('fi-formacion').value = f.formacion || '';
  ['fi-puesto','fi-lab','fi-formacion'].forEach(function(id){ document.getElementById(id).disabled = !puedeAutorizar(); });
  document.getElementById('cap-fecha').value = todayISO();
  renderFichaModal();
  abrirModal('ficha-modal');
}
function renderFichaModal(){
  var caps = Lab.capacitacionesDe(perFichaUsuarioId);
  document.getElementById('fi-caps').innerHTML = '<thead><tr><th>Capacitación</th><th>Fecha</th><th>Horas</th><th>Entidad</th><th></th></tr></thead><tbody>' +
    (caps.length ? caps.map(function(c){
      return '<tr><td>'+esc(c.nombre)+'</td><td>'+esc(c.fecha ? isoToDMY(c.fecha) : '—')+'</td><td>'+(c.horas != null && c.horas !== '' ? esc(c.horas) : '—')+'</td><td>'+esc(c.entidad || '—')+'</td>' +
        '<td class="acciones-fila"><button class="btn-icon danger" data-perm="personal:autorizar" data-cap-anular="'+esc(c.id)+'" title="Anular">×</button></td></tr>';
    }).join('') : '<tr><td colspan="5" class="empty-note">Sin capacitaciones registradas.</td></tr>') + '</tbody>';
  var auts = Lab.autorizaciones().filter(function(a){ return a.usuario_id === perFichaUsuarioId && a.vigente; });
  document.getElementById('fi-auts').innerHTML = auts.length ? '<div class="chips-fila">' + auts.map(function(a){
    var e = Lab.ensayo(a.ensayo_id);
    return '<span class="chip-aut" title="Autorizó: '+esc(nombreUsuario(a.autorizado_por))+'"><b>'+esc(e ? e.codigo : '?')+'</b> '+esc(e ? e.nombre : '')+' · desde '+isoToDMY(a.desde)+'</span>';
  }).join('') + '</div>' : '<p class="nota-sm">Sin ensayos autorizados.</p>';
}
function guardarFichaPersonal(){
  if(!exigir('personal:autorizar')) return;
  var ficha = {puesto:document.getElementById('fi-puesto').value.trim(), laboratorio:document.getElementById('fi-lab').value.trim(), formacion:document.getElementById('fi-formacion').value.trim()};
  var previo = Lab.personalDe(perFichaUsuarioId);
  var guardar = function(motivo){
    Lab.guardarPersonal(perFichaUsuarioId, ficha, motivo).then(function(r){
      toast(r === false ? 'No hubo cambios' : 'Ficha guardada');
      renderPersonal();
    }).catch(function(){});
  };
  if(!previo){ guardar(''); return; }
  var dif = diferencias(previo, ficha, ['puesto','laboratorio','formacion']);
  if(!dif){ toast('No hubo cambios'); return; }
  pedirMotivo('Editar ficha de personal', resumenCambioHtml(dif, {puesto:'Puesto', laboratorio:'Laboratorio', formacion:'Formación'}), guardar);
}
function agregarCapacitacion(){
  if(!exigir('personal:autorizar')) return;
  var nombre = document.getElementById('cap-nombre').value.trim();
  if(!nombre){ toast('Indicá el nombre de la capacitación'); return; }
  var horas = document.getElementById('cap-horas').value;
  Lab.guardarCapacitacion({id:Lab.idNuevo('cap'), usuario_id:perFichaUsuarioId, nombre:nombre, fecha:document.getElementById('cap-fecha').value,
    horas: horas === '' ? null : Number(horas), entidad:document.getElementById('cap-entidad').value.trim()}).then(function(){
    document.getElementById('cap-nombre').value = ''; document.getElementById('cap-horas').value = ''; document.getElementById('cap-entidad').value = '';
    renderFichaModal(); renderPersonal(); toast('Capacitación agregada');
  }).catch(function(){});
}

/* ---------------- Matriz de autorización ---------------- */
function renderMatrizAutorizacion(){
  var personas = usuariosActivosOrdenados();
  var ensayos = Lab.ensayos(true);
  var cab1 = '<tr><th rowspan="2" class="mat-persona">Persona</th>', cab2 = '<tr>';
  ETAPAS_ENSAYO.forEach(function(et){
    var del = ensayos.filter(function(e){ return e.etapa === et.id; });
    if(!del.length) return;
    cab1 += '<th colspan="'+del.length+'" class="mat-etapa">'+esc(et.label)+'</th>';
    del.forEach(function(e){ cab2 += '<th class="mat-ensayo" title="'+esc(e.nombre + ' · ' + (e.metodo || ''))+'">'+esc(e.codigo)+'</th>'; });
  });
  cab1 += '</tr>'; cab2 += '</tr>';
  var orden = [];
  ETAPAS_ENSAYO.forEach(function(et){ ensayos.forEach(function(e){ if(e.etapa === et.id) orden.push(e); }); });
  var filas = personas.map(function(u){
    return '<tr><td class="mat-persona"><b>'+esc(u.nombre || u.usuario)+'</b><span class="nota-sm"> '+esc(rolLabel(u.rol))+'</span></td>' + orden.map(function(e){
      var a = Lab.autorizacionVigente(u.id, e.id);
      var futura = a && a.desde > todayISO();
      var titulo = a ? ('Autorizado desde ' + isoToDMY(a.desde) + ' por ' + nombreUsuario(a.autorizado_por) + (puedeAutorizar() ? ' · clic para revocar' : ''))
        : (puedeAutorizar() ? 'Clic para autorizar' : 'No autorizado');
      return '<td class="mat-celda'+(a ? (futura ? ' futura' : ' si') : '')+'"><button '+(puedeAutorizar() ? '' : 'disabled ')+'data-mat-u="'+u.id+'" data-mat-e="'+e.id+'" title="'+esc(titulo)+'">' +
        (a ? '✓<small>'+isoToDMY(a.desde).slice(0,5)+'</small>' : '') + '</button></td>';
    }).join('') + '</tr>';
  }).join('');
  document.getElementById('per-matriz').innerHTML = '<thead>' + cab1 + cab2 + '</thead><tbody>' + (filas || '<tr><td class="empty-note">No hay usuarios activos.</td></tr>') + '</tbody>';
}
function asegurarModalAutorizar(){
  if(document.getElementById('autorizar-modal')) return;
  var m = document.createElement('div');
  m.id = 'autorizar-modal';
  m.className = 'sid-modal';
  m.innerHTML = '<div class="modal-card"><div class="modal-header"><h3>Autorizar ensayo</h3><button class="modal-close" data-close="autorizar-modal">×</button></div>' +
    '<div class="modal-body"><p id="aut-resumen"></p><div class="pp-field"><label for="aut-desde">Autorizado desde</label><input type="date" id="aut-desde"></div>' +
    '</div>' +
    '<div class="modal-actions"><button class="btn-add" id="aut-ok">Autorizar</button><button class="btn-add ghost" data-close="autorizar-modal">Cancelar</button></div></div>';
  document.body.appendChild(m);
}
document.getElementById('per-matriz').addEventListener('click', function(e){
  var b = e.target.closest('[data-mat-u]');
  if(!b || !puedeAutorizar()) return;
  var u = usuarioPorId(b.dataset.matU), ens = Lab.ensayo(b.dataset.matE);
  var vigente = Lab.autorizacionVigente(u.id, ens.id);
  if(vigente){
    pedirMotivo('Revocar autorización', '<p><b>' + esc(u.nombre || u.usuario) + '</b> · ' + esc(ens.codigo + ' ' + ens.nombre) + '<br><span class="nota-sm">Autorizado desde ' + isoToDMY(vigente.desde) + '</span></p>', function(motivo){
      Lab.revocarAutorizacion(vigente.id, motivo).then(function(){ renderMatrizAutorizacion(); toast('Autorización revocada'); }).catch(function(){});
    });
    return;
  }
  asegurarModalAutorizar();
  document.getElementById('aut-resumen').innerHTML = '<b>' + esc(u.nombre || u.usuario) + '</b> podrá registrar <b>' + esc(ens.nombre) + '</b> (' + esc(ens.metodo || '') + ').';
  document.getElementById('aut-desde').value = todayISO();
  var ok = document.getElementById('aut-ok'), nuevo = ok.cloneNode(true);
  ok.parentNode.replaceChild(nuevo, ok);
  nuevo.addEventListener('click', function(){
    var desde = document.getElementById('aut-desde').value;
    if(!desde){ toast('Indicá desde qué fecha'); return; }
    Lab.otorgarAutorizacion(u.id, ens.id, desde).then(function(){ cerrarModal('autorizar-modal'); renderMatrizAutorizacion(); toast('Autorización registrada'); }).catch(function(){});
  });
  abrirModal('autorizar-modal');
});
document.getElementById('per-tabs').addEventListener('click', function(e){
  var b = e.target.closest('[data-per-tab]');
  if(b){ perTab = b.dataset.perTab; renderPersonal(); }
});
document.getElementById('per-fichas').addEventListener('click', function(e){
  var f = e.target.closest('[data-per-ficha]');
  if(f){ abrirFichaPersonal(f.dataset.perFicha); return; }
  if(e.target.closest('[data-per-ver-matriz]')){ e.preventDefault(); perTab = 'matriz'; renderPersonal(); }
});
document.getElementById('per-exportar').addEventListener('click', function(){
  if(!exigir('datos:exportar')) return;
  var personas = usuariosActivosOrdenados();
  var fichas = [['Usuario','Nombre','Rol','Correo','Puesto','Laboratorio','Formación','Capacitaciones']].concat(personas.map(function(u){
    var f = Lab.personalDe(u.id) || {};
    return [u.usuario, u.nombre, rolLabel(u.rol), u.correo || '', f.puesto || '', f.laboratorio || '', f.formacion || '', Lab.capacitacionesDe(u.id).map(function(c){ return c.nombre; }).join('; ')];
  }));
  var auts = [['Usuario','Nombre','Ensayo','Método','Desde','Autorizado por','Estado','Revocada el','Motivo de revocación']].concat(Lab.autorizaciones().map(function(a){
    var u = usuarioPorId(a.usuario_id) || {}, e = Lab.ensayo(a.ensayo_id) || {};
    return [u.usuario || '', u.nombre || '', (e.codigo || '') + ' ' + (e.nombre || ''), e.metodo || '', isoToDMY(a.desde), nombreUsuario(a.autorizado_por),
      a.vigente ? 'Vigente' : 'Revocada', a.revocada_en ? fechaHora(Date.parse(a.revocada_en)) : '', a.motivo_revocacion || ''];
  }));
  if(exportarExcel('Personal y autorizaciones - ' + todayISO() + '.xlsx', [{nombre:'Fichas', filas:fichas}, {nombre:'Autorizaciones', filas:auts}])){
    registrarHistorial('Exportó', 'Personal', 'Fichas y matriz de autorización (Excel)');
    toast('Exportado a Excel');
  }
});
PANEL_HOOKS.personal = renderPersonal;
