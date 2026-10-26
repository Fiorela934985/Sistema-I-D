/* Sistema I+D — Administración de usuarios, organigrama y matriz de permisos (RF-USR-04 a 09). */
'use strict';

var usuarioEditandoId = null;

function showUsuariosSub(name){
  document.querySelectorAll('#usr-subtabs .subtab').forEach(function(b){ b.classList.toggle('active', b.dataset.usub === name); });
  ['lista', 'organigrama', 'matriz'].forEach(function(s){ document.getElementById('usr-sub-' + s).style.display = s === name ? 'block' : 'none'; });
  if(name === 'organigrama') renderOrganigrama();
  if(name === 'matriz') renderMatrizRoles();
}
document.getElementById('usr-subtabs').addEventListener('click', function(e){
  var b = e.target.closest('[data-usub]');
  if(b) showUsuariosSub(b.dataset.usub);
});

function chipRol(u){ var r = rolDe(u); return '<span class="tb-rol-chip rol-' + r + '">' + esc(rolLabel(r)) + '</span>'; }
function renderUsuarios(){
  var selRol = document.getElementById('usr-f-rol');
  if(selRol.options.length <= 1) selRol.innerHTML += PERM.ORDEN_ROLES.map(function(r){ return '<option value="' + r + '">' + esc(ROLES_DEF[r].label) + '</option>'; }).join('');
  var q = normalizar(document.getElementById('usr-buscar').value);
  var fRol = selRol.value, fEst = document.getElementById('usr-f-estado').value;
  var lista = usuarios.filter(function(u){
    if(fRol && rolDe(u) !== fRol) return false;
    if(fEst !== '' && String(u.activo ? 1 : 0) !== fEst) return false;
    return !q || normalizar([u.usuario, u.nombre, u.correo, u.puesto].join(' ')).indexOf(q) > -1;
  });
  var puedeEditar = can('usuarios:editar');
  document.getElementById('usr-tabla').innerHTML = '<thead><tr><th></th><th>Usuario</th><th>Nombre</th><th>Puesto</th><th>Laboratorio</th><th>Equipos</th><th>Rol</th><th>Estado</th><th>Último acceso</th><th></th></tr></thead><tbody>' +
    (lista.length ? lista.map(function(u){
      var yo = usuarioActual && u.id === usuarioActual.id;
      var bloqueado = u.bloqueadoHasta && u.bloqueadoHasta > Date.now();
      return '<tr><td><span class="sb-avatar chico rol-' + rolDe(u) + '">' + esc(inicialesUsuario(u)) + '</span></td>' +
        '<td class="mono"><b>' + esc(u.usuario) + '</b>' + (yo ? ' <span class="tag-pill tag-celeste">vos</span>' : '') + '<br><small>' + esc(u.correo || '') + '</small></td>' +
        '<td>' + esc(u.nombre || '-') + '</td><td>' + esc(u.puesto || '-') + '</td><td>' + esc(labLabel(u.laboratorio)) + '</td>' +
        '<td><small>' + esc((u.equipos || []).join(', ') || '—') + '</small></td><td>' + chipRol(u) + '</td>' +
        '<td>' + (u.activo ? '<span class="tag-pill tag-verde">Activo</span>' : '<span class="tag-pill tag-gris">Inactivo</span>') +
          (bloqueado ? ' <span class="tag-pill tag-naranja">Bloqueado</span>' : '') + (u.debeCambiarClave ? ' <span class="tag-pill tag-celeste">Clave temporal</span>' : '') + '</td>' +
        '<td>' + (u.ultimoAcceso ? fechaHora(u.ultimoAcceso) : '<span class="nota-sm">Nunca</span>') + '</td>' +
        '<td class="acciones-fila">' + (puedeEditar ? '<button class="btn-icon edit" data-usr-editar="' + u.id + '" title="Editar">' + EDIT_ICON + '</button>' +
          '<button class="btn-icon" data-usr-clave="' + u.id + '" title="Restablecer contraseña">🔑</button>' +
          (yo ? '' : '<button class="btn-icon danger" data-usr-borrar="' + u.id + '" title="Eliminar o desactivar">×</button>') : '') + '</td></tr>';
    }).join('') : '<tr><td colspan="10" class="nota-sm">Sin usuarios con esos filtros.</td></tr>') + '</tbody>';
}
['usr-buscar', 'usr-f-rol', 'usr-f-estado'].forEach(function(id){
  document.getElementById(id).addEventListener(id === 'usr-buscar' ? 'input' : 'change', renderUsuarios);
});

/* RF-USR-09: puestos de Cementos Pacasmayo y DINO SRL con quién ocupa cada uno; vacío = vacante. */
function renderOrganigrama(){
  var html = catalogo('empresas').map(function(emp){
    var gente = usuarios.filter(function(u){ return u.activo && u.empresa === emp; });
    var puestos = catalogo('puestos');
    var filas = puestos.map(function(p){
      var ocupan = gente.filter(function(u){ return (u.puesto || '').toUpperCase() === p.toUpperCase(); });
      return {puesto:p, ocupan:ocupan};
    }).filter(function(f){ return f.ocupan.length || /I\+D|SSCC|T[ÉE]CNICO|ANALISTA|PRACTICANTE|COORDINADOR|SUBGERENTE/.test(f.puesto); });
    return '<div class="card org-empresa"><div class="section-num">' + esc(emp) + '</div><div class="org-grid">' +
      filas.map(function(f){
        return '<div class="org-puesto' + (f.ocupan.length ? '' : ' vacante') + '"><b>' + esc(f.puesto) + '</b>' +
          '<span class="nota-sm">Rol sugerido: ' + esc(rolLabel(PERM.rolPorPuesto(f.puesto))) + '</span>' +
          (f.ocupan.length ? f.ocupan.map(function(u){ return '<span class="org-persona"><span class="sb-avatar chico rol-' + rolDe(u) + '">' + esc(inicialesUsuario(u)) + '</span>' + esc(nombreUsuario(u)) + '<small>' + esc((u.equipos || []).join(', ')) + '</small></span>'; }).join('')
            : '<span class="tag-pill tag-gris">Vacante</span>') + '</div>';
      }).join('') + '</div></div>';
  }).join('');
  document.getElementById('usr-organigrama').innerHTML = html;
}

function renderMatrizRoles(){
  var NOMBRES = {panel:'Panel de control', proyectos:'Proyectos', reporteProyecto:'Reporte de proyecto', bitacora:'Bitácora',
    normas:'Normas y tipos de ensayo', disenos:'Diseños', elaboracion:'Elaboración y cuaderno', etiquetas:'Etiquetas',
    roturas:'Roturas', rr:'Reporte RR e informe final', archivador:'Archivador y base histórica', prediccion:'Predicción y asistente',
    materiales:'Materiales del diseño', productos:'Productos y lotes', muestras:'Muestras', equipos:'Equipos y calibración',
    envios:'Trazabilidad de envíos', usuarios:'Usuarios, organigrama', historial:'Historial', ajustes:'Ajustes y catálogos'};
  document.getElementById('usr-matriz').innerHTML = '<thead><tr><th>Módulo</th>' + PERM.ORDEN_ROLES.map(function(r){ return '<th title="' + esc(ROLES_DEF[r].desc) + '">' + r + '<br><small>' + esc(ROLES_DEF[r].label) + '</small></th>'; }).join('') + '</tr></thead><tbody>' +
    Object.keys(PERM.MATRIZ).map(function(m){
      return '<tr><td>' + esc(NOMBRES[m] || m) + '</td>' + PERM.ORDEN_ROLES.map(function(r){
        var l = PERM.letras(r, m);
        return '<td class="centro mono">' + (l ? esc(l.split('').join(' ')) : '—') + '</td>';
      }).join('') + '</tr>';
    }).join('') + '</tbody>';
}

/* ---- Alta y edición (RF-USR-05/06/07) ---- */
function chipsCheckHtml(valores, marcados, nombre, etiqueta){
  return valores.map(function(v){
    return '<label class="chip-check"><input type="checkbox" name="' + nombre + '" value="' + esc(v) + '"' + (marcados.indexOf(v) > -1 ? ' checked' : '') + '> ' + esc(etiqueta ? etiqueta(v) : v) + '</label>';
  }).join('');
}
function marcadosDe(nombre){ return Array.prototype.map.call(document.querySelectorAll('input[name="' + nombre + '"]:checked'), function(i){ return i.value; }); }
function abrirUsuarioModal(u){
  usuarioEditandoId = u ? u.id : null;
  document.querySelectorAll('#usuario-modal .campo-error').forEach(function(el){ el.textContent = ''; });
  document.getElementById('usuario-modal-title').textContent = u ? 'Editar usuario' : 'Nuevo usuario';
  document.getElementById('um-usuario').value = u ? u.usuario : '';
  document.getElementById('um-usuario').disabled = !!u;
  document.getElementById('um-nombre').value = u ? (u.nombre || '') : '';
  document.getElementById('um-iniciales').value = u ? (u.iniciales || '') : '';
  document.getElementById('um-correo').value = u ? (u.correo || '') : '';
  document.getElementById('um-empresa').innerHTML = opcionesHtml(catalogo('empresas'), u ? u.empresa : '', 'Elegí…');
  document.getElementById('um-laboratorio').innerHTML = catalogo('laboratorios').map(function(l){ return '<option value="' + esc(l) + '"' + (u && u.laboratorio === l ? ' selected' : '') + '>' + esc(labLabel(l)) + '</option>'; }).join('');
  document.getElementById('um-sector').value = u ? (u.sector || '') : '';
  document.getElementById('um-puesto').innerHTML = opcionesHtml(catalogo('puestos'), u ? u.puesto : '', 'Elegí…');
  document.getElementById('um-rol').innerHTML = PERM.ORDEN_ROLES.map(function(r){ return '<option value="' + r + '"' + (u && rolDe(u) === r ? ' selected' : '') + '>' + r + ' · ' + esc(ROLES_DEF[r].label) + '</option>'; }).join('');
  if(!u) document.getElementById('um-rol').value = 'CON';
  document.getElementById('um-telefono').value = u ? (u.telefono || '') : '';
  document.getElementById('um-activo').value = !u || u.activo ? '1' : '0';
  document.getElementById('um-labs').innerHTML = chipsCheckHtml(catalogo('laboratorios'), u ? (u.laboratorios || []) : [], 'um-lab', labLabel);
  document.getElementById('um-equipos').innerHTML = chipsCheckHtml(catalogo('equipos'), u ? (u.equipos || []) : [], 'um-eq');
  var yo = u && usuarioActual && u.id === usuarioActual.id;
  document.getElementById('um-rol').disabled = yo;
  document.getElementById('um-activo').disabled = yo;
  document.getElementById('um-clave-nota').textContent = u ? '' : 'Al guardar se genera una contraseña temporal que la persona debe cambiar en su primer ingreso.';
  actualizarDescRol();
  abrirModal('usuario-modal');
}
function actualizarDescRol(){ document.getElementById('um-rol-desc').textContent = (ROLES_DEF[document.getElementById('um-rol').value] || {}).desc || ''; }
document.getElementById('um-rol').addEventListener('change', actualizarDescRol);
document.getElementById('um-puesto').addEventListener('change', function(){
  if(!this.value) return;
  document.getElementById('um-rol').value = PERM.rolPorPuesto(this.value);   // RF-USR-06: se propone; el ADM puede cambiarlo
  actualizarDescRol();
});
document.getElementById('um-correo').addEventListener('change', function(){
  var labs = PERM.laboratoriosPorCorreo(this.value);
  if(labs.length && !marcadosDe('um-lab').length){
    document.querySelectorAll('input[name="um-lab"]').forEach(function(c){ c.checked = labs.indexOf(c.value) > -1; });
    document.getElementById('um-laboratorio').value = labs[0];
  }
});
document.getElementById('usr-nuevo').addEventListener('click', function(){ if(exigir('usuarios:editar')) abrirUsuarioModal(null); });

/* Un usuario con registros no se elimina: pasa a Inactivo y conserva su historial (RF-USR-08). */
function tieneRegistros(u){
  return historial.some(function(h){ return h.usuarioId === u.id; }) ||
    disenos.some(function(d){ return d.creadoPor === u.id; }) ||
    roturaCargas.some(function(c){ return c.registradoPor === u.id || c.tecnicoId === u.id; });
}
/* Al desactivar, sus réplicas y roturas pendientes se reasignan. */
function reasignarPendientes(u, nuevoId){
  var n = 0;
  disenos.forEach(function(d){ (d.replicaObjs || []).forEach(function(r){
    if(r.programacion && r.programacion.tecnicoId === u.id && !r.elaboracion){ r.programacion.tecnicoId = nuevoId; n++; }
  }); });
  roturaCargas.forEach(function(c){ if(c.tecnicoId === u.id && c.estado === 'pendiente'){ c.tecnicoId = nuevoId; n++; } });
  if(n){ save('sid10_disenos', disenos); saveRoturaCargas(); }
  return n;
}
function desactivarUsuario(u){
  var otros = usuariosActivos(['TEC', 'ANA', 'JEF']).filter(function(x){ return x.id !== u.id; });
  var destino = null;
  if(otros.length){
    var opciones = otros.map(function(x, i){ return (i + 1) + '. ' + nombreUsuario(x) + ' (' + rolDe(x) + ')'; }).join('\n');
    var r = prompt('Desactivar a ' + nombreUsuario(u) + '. Sus tareas pendientes se reasignan a:\n' + opciones + '\n\nEscribí el número (vacío = sin reasignar):', '1');
    if(r === null) return false;
    destino = otros[Number(r) - 1] || null;
  }
  u.activo = false;
  var n = destino ? reasignarPendientes(u, destino.id) : 0;
  saveUsuarios();
  registrarHistorial('Desactivó', 'Usuario', u.usuario + (n ? ' · ' + n + ' tareas reasignadas a ' + destino.usuario : ''));
  toast('Usuario desactivado' + (n ? ' · ' + n + ' tareas reasignadas' : ''));
  return true;
}
document.getElementById('usr-tabla').addEventListener('click', function(e){
  if(!exigir('usuarios:editar')) return;
  var ed = e.target.closest('[data-usr-editar]');
  if(ed){ abrirUsuarioModal(usuarioPorId(ed.dataset.usrEditar)); return; }
  var cl = e.target.closest('[data-usr-clave]');
  if(cl){
    var uc = usuarioPorId(cl.dataset.usrClave);
    if(!uc || !confirm('¿Generar una contraseña temporal para ' + uc.usuario + '?')) return;
    var tmp = claveTemporal();
    uc.sal = nuevaSal(); uc.hash = hashPassword(tmp, uc.sal); uc.debeCambiarClave = true; uc.bloqueadoHasta = 0; uc.intentosFallidos = 0;
    saveUsuarios();
    registrarHistorial('Editó', 'Usuario', uc.usuario + ' · contraseña restablecida (temporal)');
    alert('Contraseña temporal de ' + uc.usuario + ':\n\n' + tmp + '\n\nComunícasela por un medio seguro. Deberá cambiarla al ingresar.');
    renderUsuarios();
    return;
  }
  var bo = e.target.closest('[data-usr-borrar]');
  if(bo){
    var u = usuarioPorId(bo.dataset.usrBorrar);
    if(!u) return;
    var admins = usuarios.filter(function(x){ return rolDe(x) === 'ADM' && x.activo; });
    if(rolDe(u) === 'ADM' && admins.length <= 1){ toast('Tiene que quedar al menos un administrador activo'); return; }
    if(tieneRegistros(u)){
      if(!u.activo){ toast('El usuario ya está inactivo y tiene registros: no se elimina'); return; }
      if(desactivarUsuario(u)) renderUsuarios();
      return;
    }
    if(!confirm('¿Eliminar al usuario ' + u.usuario + '? No tiene registros en el sistema.')) return;
    usuarios = usuarios.filter(function(x){ return x.id !== u.id; });
    saveUsuarios();
    registrarHistorial('Eliminó', 'Usuario', u.usuario + ' (' + rolLabel(u.rol) + ')');
    renderUsuarios();
    toast('Usuario eliminado');
  }
});
document.getElementById('um-guardar').addEventListener('click', function(){
  if(!exigir('usuarios:editar')) return;
  var datos = {
    usuario: document.getElementById('um-usuario').value.trim().toUpperCase(),
    nombre: document.getElementById('um-nombre').value.trim().replace(/\s+/g, ' '),
    iniciales: document.getElementById('um-iniciales').value.trim().toUpperCase(),
    correo: document.getElementById('um-correo').value.trim().toLowerCase(),
    empresa: document.getElementById('um-empresa').value,
    laboratorio: document.getElementById('um-laboratorio').value,
    sector: document.getElementById('um-sector').value.trim(),
    puesto: document.getElementById('um-puesto').value,
    rol: document.getElementById('um-rol').value,
    telefono: document.getElementById('um-telefono').value.trim()
  };
  var activo = document.getElementById('um-activo').value === '1';
  var labs = marcadosDe('um-lab');
  if(labs.indexOf(datos.laboratorio) === -1) labs.unshift(datos.laboratorio);
  var equiposSel = marcadosDe('um-eq');
  var errores = validarUsuario(datos, usuarioEditandoId);
  document.querySelectorAll('#usuario-modal .campo-error').forEach(function(el){ el.textContent = errores[el.dataset.err] || ''; });
  if(Object.keys(errores).length){ toast('Revisá los campos marcados'); return; }
  var u = usuarioEditandoId ? usuarioPorId(usuarioEditandoId) : null;
  if(!u){
    var tmp = claveTemporal(), sal = nuevaSal();
    u = Object.assign({id:'u' + Date.now(), activo:activo, sal:sal, hash:hashPassword(tmp, sal), debeCambiarClave:true, creado:Date.now(), creadoPor: usuarioActual.id, ultimoAcceso:null}, datos, {laboratorios:labs, equipos:equiposSel});
    usuarios.push(u);
    registrarHistorial('Creó', 'Usuario', datos.usuario + ' (' + rolLabel(datos.rol) + ')');
    alert('Usuario creado.\n\nContraseña temporal de ' + datos.usuario + ':\n\n' + tmp + '\n\nDeberá cambiarla en su primer ingreso.');
  } else {
    var esUltimoAdmin = rolDe(u) === 'ADM' && (datos.rol !== 'ADM' || !activo) && usuarios.filter(function(x){ return rolDe(x) === 'ADM' && x.activo; }).length <= 1;
    if(esUltimoAdmin){ toast('Tiene que quedar al menos un administrador activo'); return; }
    if(u.activo && !activo && !desactivarUsuario(u)) return;
    var cambios = [];
    if(rolDe(u) !== datos.rol) cambios.push('rol ' + rolLabel(u.rol) + ' → ' + rolLabel(datos.rol));
    if(!u.activo && activo) cambios.push('activado');
    Object.assign(u, datos, {laboratorios:labs, equipos:equiposSel, activo:activo, modificadoPor:usuarioActual.id, modificado:Date.now()});
    registrarHistorial('Editó', 'Usuario', u.usuario + (cambios.length ? ' · ' + cambios.join(', ') : ''));
  }
  saveUsuarios();
  cerrarModal('usuario-modal');
  if(usuarioActual && u.id === usuarioActual.id){ usuarioActual = u; renderUsuarioShell(); }
  renderUsuarios();
  toast('Usuario guardado');
});
PANEL_HOOKS.usuarios = function(){ renderUsuarios(); };
