/* Sistema I+D — Administración › Usuarios y roles (Administrador, Líder, Técnico).
   Nada se borra: un usuario se desactiva con motivo. Toda edición pide el motivo y queda en el Historial de cambios.
   Con servidor conectado, los usuarios y los permisos de acciones viven en D1 y el servidor valida cada cambio. */
'use strict';

var usuarioEditandoId = null;
var permisosBorrador = null; // cambios pendientes en la matriz de funciones por rol

var ETIQUETAS_USUARIO = {nombre:'Nombre', iniciales:'Iniciales', correo:'Correo', rol:'Rol', activo:'Activo'};

function renderUsuarios(){
  var tabla = document.getElementById('usr-tabla');
  tabla.innerHTML = '<thead><tr><th></th><th>Usuario</th><th>Nombre</th><th>Correo</th><th>Rol</th><th>Estado</th><th>Último acceso</th><th></th></tr></thead><tbody>' +
    usuarios.slice().sort(function(a,b){ return (b.activo - a.activo) || (a.nombre||'').localeCompare(b.nombre||''); }).map(function(u){
      var yo = usuarioActual && u.id === usuarioActual.id;
      return '<tr' + (u.activo ? '' : ' class="fila-inactiva"') + '><td><span class="sb-avatar chico rol-'+u.rol+'">'+esc(inicialesUsuario(u))+'</span></td>' +
        '<td class="mono"><b>'+esc(u.usuario)+'</b>'+(yo?' <span class="tag-pill tag-celeste">vos</span>':'')+'</td><td>'+esc(u.nombre||'-')+'</td>' +
        '<td>'+(u.correo ? esc(u.correo) : '<span class="chip-falta">Falta</span>')+'</td>' +
        '<td><span class="tb-rol-chip rol-'+u.rol+'">'+esc(rolLabel(u.rol))+'</span></td>' +
        '<td>'+(u.activo?'<span class="tag-pill tag-verde">Activo</span>':'<span class="tag-pill tag-gris">Inactivo</span>')+'</td>' +
        '<td>'+(u.ultimoAcceso ? fechaHora(u.ultimoAcceso) : '<span class="nota-sm">Nunca</span>')+'</td>' +
        '<td class="acciones-fila"><button class="btn-icon edit" data-usr-editar="'+u.id+'" title="Editar">'+EDIT_ICON+'</button>' +
        (yo ? '' : '<button class="btn-ghost chico" data-usr-estado="'+u.id+'">'+(u.activo ? 'Desactivar' : 'Reactivar')+'</button>') + '</td></tr>';
    }).join('') + '</tbody>';
  permisosBorrador = null;
  renderMatrizRoles();
}

/* ---------------- matriz de funciones por rol ---------------- */
function permisosVigentes(rol){ return permisosBorrador ? permisosBorrador[rol] : (permisosPorRol[rol] || []); }
function renderMatrizRoles(){
  var roles = Object.keys(ROLES_DEF);
  var filas = PANELES.map(function(p){ return {id:'ver:'+p.id, label:'Ver: '+p.label, grupo:'Secciones'}; })
    .concat(ACCIONES.map(function(a){ return {id:a.id, label:a.label, grupo:'Acciones'}; }));
  var grupoActual = '';
  var editable = can('config:laboratorio');
  document.getElementById('usr-matriz').innerHTML = '<thead><tr><th>Función</th>' + roles.map(function(r){ return '<th>'+esc(ROLES_DEF[r].label)+'</th>'; }).join('') + '</tr></thead><tbody>' +
    filas.map(function(f){
      var cab = '';
      if(f.grupo !== grupoActual){ grupoActual = f.grupo; cab = '<tr class="rr-subsection"><td colspan="'+(roles.length+1)+'">'+f.grupo+'</td></tr>'; }
      return cab + '<tr><td>'+esc(f.label)+'</td>' + roles.map(function(r){
        var on = r === 'admin' || permisosVigentes(r).indexOf(f.id) > -1;
        var bloqueado = !editable || r === 'admin' || f.id === 'ver:usuarios' || f.id === 'config:laboratorio';
        return '<td class="centro"><input type="checkbox" data-rol="'+r+'" data-perm-id="'+f.id+'"'+(on?' checked':'')+(bloqueado?' disabled':'')+'></td>';
      }).join('') + '</tr>';
    }).join('') + '</tbody>';
  actualizarBotonPermisos();
}
function cambiosPermisos(){
  if(!permisosBorrador) return [];
  return ['lider','tecnico'].filter(function(r){
    var a = (permisosPorRol[r] || []).slice().sort().join('|'), b = permisosBorrador[r].slice().sort().join('|');
    return a !== b;
  });
}
function actualizarBotonPermisos(){
  var n = cambiosPermisos().length;
  var b = document.getElementById('usr-matriz-guardar');
  b.style.display = n ? '' : 'none';
}
document.getElementById('usr-matriz').addEventListener('change', function(e){
  var rol = e.target.dataset.rol, perm = e.target.dataset.permId;
  if(!rol || !perm || rol === 'admin') return;
  if(!permisosBorrador) permisosBorrador = {lider:(permisosPorRol.lider || []).slice(), tecnico:(permisosPorRol.tecnico || []).slice()};
  var lista = permisosBorrador[rol];
  if(e.target.checked){ if(lista.indexOf(perm) === -1) lista.push(perm); }
  else permisosBorrador[rol] = lista.filter(function(p){ return p !== perm; });
  actualizarBotonPermisos();
});
document.getElementById('usr-matriz-guardar').addEventListener('click', function(){
  if(!exigir('config:laboratorio')) return;
  var roles = cambiosPermisos();
  if(!roles.length) return;
  var resumen = {antes:{}, despues:{}};
  roles.forEach(function(r){
    var antes = permisosPorRol[r] || [], despues = permisosBorrador[r];
    var mas = despues.filter(function(p){ return antes.indexOf(p) === -1; }), menos = antes.filter(function(p){ return despues.indexOf(p) === -1; });
    resumen.antes[rolLabel(r)] = menos.length ? 'Quita: ' + menos.join(', ') : '—';
    resumen.despues[rolLabel(r)] = mas.length ? 'Agrega: ' + mas.join(', ') : '—';
  });
  pedirMotivo('Guardar permisos por rol', resumenCambioHtml(resumen), function(motivo){
    var cadena = Promise.resolve();
    roles.forEach(function(r){
      cadena = cadena.then(function(){
        var acciones = permisosBorrador[r].filter(function(p){ return p.indexOf('ver:') !== 0; });
        return Nube.activa() ? Nube.enviar('PUT', '/api/permisos/' + r, {permisos:acciones, motivo:motivo}) : null;
      }).then(function(){
        var antes = permisosPorRol[r] || [];
        permisosPorRol[r] = permisosBorrador[r].slice();
        registrarHistorial('Editó', 'Permisos', rolLabel(r), {codigo:r, antes:antes, despues:permisosPorRol[r], motivo:motivo, servidor:Nube.activa()});
      });
    });
    cadena.then(function(){
      savePermisosPorRol(); permisosBorrador = null; aplicarPermisos(); renderMatrizRoles(); toast('Permisos actualizados');
    }).catch(function(){});
  });
});

/* ---------------- alta y edición ---------------- */
function abrirUsuarioModal(u){
  usuarioEditandoId = u ? u.id : null;
  document.getElementById('usuario-modal-title').textContent = u ? 'Editar usuario' : 'Nuevo usuario';
  document.getElementById('um-usuario').value = u ? u.usuario : '';
  document.getElementById('um-usuario').disabled = !!u;
  document.getElementById('um-nombre').value = u ? (u.nombre||'') : '';
  document.getElementById('um-iniciales').value = u ? (u.iniciales||'') : '';
  document.getElementById('um-correo').value = u ? (u.correo||'') : '';
  document.getElementById('um-rol').innerHTML = Object.keys(ROLES_DEF).map(function(r){ return '<option value="'+r+'"'+(u && u.rol===r?' selected':'')+'>'+ROLES_DEF[r].label+'</option>'; }).join('');
  if(!u) document.getElementById('um-rol').value = 'tecnico';
  document.getElementById('um-activo').value = !u || u.activo ? '1' : '0';
  var yo = u && usuarioActual && u.id === usuarioActual.id;
  document.getElementById('um-rol').disabled = yo;
  document.getElementById('um-activo').disabled = yo;
  document.getElementById('um-pass').value = '';
  document.getElementById('um-pass-label').textContent = u ? 'Nueva contraseña (dejar vacío para no cambiarla)' : 'Contraseña';
  actualizarDescRol();
  abrirModal('usuario-modal');
}
function actualizarDescRol(){ document.getElementById('um-rol-desc').textContent = (ROLES_DEF[document.getElementById('um-rol').value] || {}).desc || ''; }
document.getElementById('um-rol').addEventListener('change', actualizarDescRol);
document.getElementById('usr-nuevo').addEventListener('click', function(){ if(exigir('config:laboratorio')) abrirUsuarioModal(null); });

function hayOtroAdminActivo(exceptoId){ return usuarios.some(function(x){ return x.rol === 'admin' && x.activo && x.id !== exceptoId; }); }

/* Guarda en el servidor (si hay) y luego en este navegador */
function persistirUsuario(u, previo, clave, motivo){
  var aplicar = function(){
    if(!Nube.activa() && clave){ u.sal = nuevaSal(); u.hash = hashPassword(clave, u.sal); }
    var i = usuarios.findIndex(function(x){ return x.id === u.id; });
    if(i === -1) usuarios.push(u); else usuarios[i] = u;
    saveUsuarios();
    var dif = previo ? diferencias(previo, u, ['nombre','iniciales','correo','rol','activo']) : null;
    registrarHistorial(previo ? 'Editó' : 'Creó', 'Usuarios', u.usuario + (clave && previo ? ' · contraseña restablecida' : ''),
      {codigo:u.usuario, ref:u.id, antes: dif ? dif.antes : undefined, despues: dif ? dif.despues : {nombre:u.nombre, rol:u.rol, correo:u.correo}, motivo:motivo || '', servidor:Nube.activa()});
    if(usuarioActual && u.id === usuarioActual.id){ usuarioActual = u; renderUsuarioShell(); }
    renderUsuarios();
  };
  if(!Nube.activa()){ aplicar(); return Promise.resolve(); }
  return Nube.enviar('PUT', '/api/usuarios/' + encodeURIComponent(u.id), {usuario:u.usuario, nombre:u.nombre, iniciales:u.iniciales, correo:u.correo, rol:u.rol, activo:u.activo ? 1 : 0, clave:clave || undefined, motivo:motivo})
    .then(aplicar);
}

document.getElementById('usr-tabla').addEventListener('click', function(e){
  var ed = e.target.closest('[data-usr-editar]');
  if(ed){ if(exigir('config:laboratorio')) abrirUsuarioModal(usuarioPorId(ed.dataset.usrEditar)); return; }
  var es = e.target.closest('[data-usr-estado]');
  if(es){
    if(!exigir('config:laboratorio')) return;
    var u = usuarioPorId(es.dataset.usrEstado);
    if(!u) return;
    if(u.activo && u.rol === 'admin' && !hayOtroAdminActivo(u.id)){ toast('Tiene que quedar al menos un administrador activo'); return; }
    var accion = u.activo ? 'Desactivar' : 'Reactivar';
    pedirMotivo(accion + ' usuario', '<p><b>' + esc(u.usuario) + '</b> · ' + esc(u.nombre || '') + (u.activo ? '<br><span class="nota-sm">No podrá ingresar. Su historial y sus registros se conservan.</span>' : '') + '</p>', function(motivo){
      var previo = JSON.parse(JSON.stringify(u));
      var nuevo = Object.assign({}, u, {activo:!u.activo});
      persistirUsuario(nuevo, previo, '', motivo).then(function(){ toast('Usuario ' + (nuevo.activo ? 'reactivado' : 'desactivado')); }).catch(function(){});
    });
  }
});
document.getElementById('um-guardar').addEventListener('click', function(){
  if(!exigir('config:laboratorio')) return;
  var usuario = document.getElementById('um-usuario').value.trim().toUpperCase();
  var nombre = document.getElementById('um-nombre').value.trim();
  var iniciales = document.getElementById('um-iniciales').value.trim().toUpperCase();
  var correo = document.getElementById('um-correo').value.trim();
  var rol = document.getElementById('um-rol').value;
  var activo = document.getElementById('um-activo').value === '1';
  var pass = document.getElementById('um-pass').value;
  if(!/^[A-Z0-9._-]{3,30}$/.test(usuario)){ toast('Usuario: 3 a 30 caracteres, sin espacios'); return; }
  if(!nombre){ toast('Ingresá el nombre completo'); return; }
  if(correo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)){ toast('El correo no es válido'); return; }
  var previo = usuarioEditandoId ? usuarioPorId(usuarioEditandoId) : null;
  if(!previo){
    if(usuarioPorNombre(usuario)){ toast('Ya existe un usuario con ese nombre'); return; }
    if(pass.length < 8){ toast('La contraseña debe tener al menos 8 caracteres'); return; }
    var nuevo = {id:Lab.idNuevo('u'), usuario:usuario, nombre:nombre, iniciales:iniciales, correo:correo, rol:rol, activo:activo, creado:Date.now(), ultimoAcceso:null};
    persistirUsuario(nuevo, null, pass, '').then(function(){ cerrarModal('usuario-modal'); toast('Usuario creado'); }).catch(function(){});
    return;
  }
  if(pass && pass.length < 8){ toast('La contraseña debe tener al menos 8 caracteres'); return; }
  if(previo.rol === 'admin' && (rol !== 'admin' || !activo) && !hayOtroAdminActivo(previo.id)){ toast('Tiene que quedar al menos un administrador activo'); return; }
  var editado = Object.assign({}, previo, {nombre:nombre, iniciales:iniciales, correo:correo, rol:rol, activo:activo});
  var dif = diferencias(previo, editado, ['nombre','iniciales','correo','rol','activo']);
  if(!dif && !pass){ toast('No hubo cambios'); return; }
  var resumen = resumenCambioHtml(dif, ETIQUETAS_USUARIO) + (pass ? '<p class="nota-sm">Se restablece la contraseña.</p>' : '');
  pedirMotivo('Editar usuario ' + previo.usuario, resumen, function(motivo){
    persistirUsuario(editado, JSON.parse(JSON.stringify(previo)), pass, motivo).then(function(){ cerrarModal('usuario-modal'); toast('Usuario guardado'); }).catch(function(){});
  });
});
PANEL_HOOKS.usuarios = function(){ renderUsuarios(); };
