/* Sistema I+D — Administración: usuarios y funciones por rol. */
'use strict';

var usuarioEditandoId = null;

function renderUsuarios(){
  var tabla = document.getElementById('usr-tabla');
  tabla.innerHTML = '<thead><tr><th></th><th>Usuario</th><th>Nombre</th><th>Rol</th><th>Estado</th><th>Último acceso</th><th></th></tr></thead><tbody>' +
    usuarios.map(function(u){
      var yo = usuarioActual && u.id === usuarioActual.id;
      return '<tr><td><span class="sb-avatar chico rol-'+u.rol+'">'+esc(inicialesUsuario(u))+'</span></td>' +
        '<td class="mono"><b>'+esc(u.usuario)+'</b>'+(yo?' <span class="tag-pill tag-celeste">vos</span>':'')+'</td><td>'+esc(u.nombre||'-')+'</td>' +
        '<td><span class="tb-rol-chip rol-'+u.rol+'">'+esc(rolLabel(u.rol))+'</span></td>' +
        '<td>'+(u.activo?'<span class="tag-pill tag-verde">Activo</span>':'<span class="tag-pill tag-gris">Inactivo</span>')+'</td>' +
        '<td>'+(u.ultimoAcceso ? fechaHora(u.ultimoAcceso) : '<span class="nota-sm">Nunca</span>')+'</td>' +
        '<td class="acciones-fila"><button class="btn-icon edit" data-usr-editar="'+u.id+'" title="Editar">'+EDIT_ICON+'</button>' +
        (yo ? '' : '<button class="btn-icon danger" data-usr-borrar="'+u.id+'" title="Eliminar">×</button>') + '</td></tr>';
    }).join('') + '</tbody>';
  renderMatrizRoles();
}
function renderMatrizRoles(){
  var roles = Object.keys(ROLES_DEF);
  var filas = PANELES.map(function(p){ return {id:'ver:'+p.id, label:'Ver: '+p.label, grupo:'Secciones'}; })
    .concat(ACCIONES.map(function(a){ return {id:a.id, label:a.label, grupo:'Acciones'}; }));
  var grupoActual = '';
  document.getElementById('usr-matriz').innerHTML = '<thead><tr><th>Función</th>' + roles.map(function(r){ return '<th>'+esc(ROLES_DEF[r].label)+'</th>'; }).join('') + '</tr></thead><tbody>' +
    filas.map(function(f){
      var cab = '';
      if(f.grupo !== grupoActual){ grupoActual = f.grupo; cab = '<tr class="rr-subsection"><td colspan="'+(roles.length+1)+'">'+f.grupo+'</td></tr>'; }
      return cab + '<tr><td>'+esc(f.label)+'</td>' + roles.map(function(r){
        var on = r === 'admin' || (permisosPorRol[r] || []).indexOf(f.id) > -1;
        var bloqueado = r === 'admin' || f.id === 'ver:usuarios';
        return '<td class="centro"><input type="checkbox" data-rol="'+r+'" data-perm-id="'+f.id+'"'+(on?' checked':'')+(bloqueado?' disabled':'')+'></td>';
      }).join('') + '</tr>';
    }).join('') + '</tbody>';
}
document.getElementById('usr-matriz').addEventListener('change', function(e){
  var rol = e.target.dataset.rol, perm = e.target.dataset.permId;
  if(!rol || !perm || rol === 'admin') return;
  var lista = permisosPorRol[rol] || (permisosPorRol[rol] = []);
  if(e.target.checked){ if(lista.indexOf(perm) === -1) lista.push(perm); }
  else permisosPorRol[rol] = lista.filter(function(p){ return p !== perm; });
  savePermisosPorRol();
  registrarHistorial('Editó', 'Permisos', rolLabel(rol) + ': ' + (e.target.checked ? 'habilitó ' : 'quitó ') + perm);
  toast('Permisos de ' + rolLabel(rol) + ' actualizados');
});
function abrirUsuarioModal(u){
  usuarioEditandoId = u ? u.id : null;
  document.getElementById('usuario-modal-title').textContent = u ? 'Editar usuario' : 'Nuevo usuario';
  document.getElementById('um-usuario').value = u ? u.usuario : '';
  document.getElementById('um-usuario').disabled = !!u;
  document.getElementById('um-nombre').value = u ? (u.nombre||'') : '';
  document.getElementById('um-iniciales').value = u ? (u.iniciales||'') : '';
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
document.getElementById('usr-nuevo').addEventListener('click', function(){ abrirUsuarioModal(null); });
document.getElementById('usr-tabla').addEventListener('click', function(e){
  var ed = e.target.closest('[data-usr-editar]');
  if(ed){ abrirUsuarioModal(usuarioPorId(ed.dataset.usrEditar)); return; }
  var bo = e.target.closest('[data-usr-borrar]');
  if(bo){
    var u = usuarioPorId(bo.dataset.usrBorrar);
    if(!u) return;
    var admins = usuarios.filter(function(x){ return x.rol === 'admin' && x.activo; });
    if(u.rol === 'admin' && admins.length <= 1){ toast('No se puede eliminar al único administrador'); return; }
    if(!confirm('¿Eliminar al usuario ' + u.usuario + '? Su historial se conserva.')) return;
    usuarios = usuarios.filter(function(x){ return x.id !== u.id; });
    saveUsuarios();
    registrarHistorial('Eliminó', 'Usuario', u.usuario + ' (' + rolLabel(u.rol) + ')');
    renderUsuarios();
    toast('Usuario eliminado');
  }
});
document.getElementById('um-guardar').addEventListener('click', function(){
  var usuario = document.getElementById('um-usuario').value.trim().toUpperCase();
  var nombre = document.getElementById('um-nombre').value.trim();
  var iniciales = document.getElementById('um-iniciales').value.trim().toUpperCase();
  var rol = document.getElementById('um-rol').value;
  var activo = document.getElementById('um-activo').value === '1';
  var pass = document.getElementById('um-pass').value;
  if(!/^[A-Z0-9._-]{3,30}$/.test(usuario)){ toast('Usuario: 3 a 30 caracteres, sin espacios'); return; }
  if(!nombre){ toast('Ingresá el nombre completo'); return; }
  var u = usuarioEditandoId ? usuarioPorId(usuarioEditandoId) : null;
  if(!u){
    if(usuarioPorNombre(usuario)){ toast('Ya existe un usuario con ese nombre'); return; }
    if(pass.length < 6){ toast('La contraseña debe tener al menos 6 caracteres'); return; }
    var sal = nuevaSal();
    u = {id:'u' + Date.now(), usuario:usuario, nombre:nombre, iniciales:iniciales, rol:rol, activo:activo, sal:sal, hash:hashPassword(pass, sal), creado:Date.now(), ultimoAcceso:null};
    usuarios.push(u);
    registrarHistorial('Creó', 'Usuario', usuario + ' (' + rolLabel(rol) + ')');
  } else {
    if(pass && pass.length < 6){ toast('La contraseña debe tener al menos 6 caracteres'); return; }
    var esUltimoAdmin = u.rol === 'admin' && (rol !== 'admin' || !activo) && usuarios.filter(function(x){ return x.rol === 'admin' && x.activo; }).length <= 1;
    if(esUltimoAdmin){ toast('Tiene que quedar al menos un administrador activo'); return; }
    var cambios = [];
    if(u.rol !== rol) cambios.push('rol ' + rolLabel(u.rol) + ' → ' + rolLabel(rol));
    if(u.activo !== activo) cambios.push(activo ? 'activado' : 'desactivado');
    if(pass) cambios.push('contraseña restablecida');
    u.nombre = nombre; u.iniciales = iniciales; u.rol = rol; u.activo = activo;
    if(pass){ u.sal = nuevaSal(); u.hash = hashPassword(pass, u.sal); }
    registrarHistorial('Editó', 'Usuario', u.usuario + (cambios.length ? ' · ' + cambios.join(', ') : ''));
  }
  saveUsuarios();
  cerrarModal('usuario-modal');
  if(usuarioActual && u.id === usuarioActual.id){ usuarioActual = u; renderUsuarioShell(); }
  renderUsuarios();
  toast('Usuario guardado');
});
PANEL_HOOKS.usuarios = function(){ renderUsuarios(); };
