/* Sistema I+D — Usuarios, roles, permisos y sesión */
'use strict';

/* ================= SHA-256 (síncrono, sin dependencias) ================= */
function sha256(ascii){
  function rr(v, a){ return (v >>> a) | (v << (32 - a)); }
  var maxWord = Math.pow(2, 32), result = '', words = [], i, j;
  var asciiBitLength = ascii.length * 8;
  var hash = sha256.h = sha256.h || [], k = sha256.k = sha256.k || [], primeCounter = k.length;
  var isComposite = {};
  for(var candidate = 2; primeCounter < 64; candidate++){
    if(!isComposite[candidate]){
      for(i = 0; i < 313; i += candidate) isComposite[i] = candidate;
      hash[primeCounter] = (Math.pow(candidate, .5) * maxWord) | 0;
      k[primeCounter++] = (Math.pow(candidate, 1/3) * maxWord) | 0;
    }
  }
  hash = hash.slice(0, 8);
  ascii += '\x80';
  while(ascii.length % 64 - 56) ascii += '\x00';
  for(i = 0; i < ascii.length; i++){
    j = ascii.charCodeAt(i);
    if(j >> 8) return '';
    words[i >> 2] |= j << ((3 - i) % 4) * 8;
  }
  words[words.length] = ((asciiBitLength / maxWord) | 0);
  words[words.length] = (asciiBitLength);
  for(j = 0; j < words.length;){
    var w = words.slice(j, j += 16), oldHash = hash;
    hash = hash.slice(0, 8);
    for(i = 0; i < 64; i++){
      var w15 = w[i - 15], w2 = w[i - 2];
      var a = hash[0], e = hash[4];
      var temp1 = hash[7] + (rr(e, 6) ^ rr(e, 11) ^ rr(e, 25)) + ((e & hash[5]) ^ ((~e) & hash[6])) + k[i] +
        (w[i] = (i < 16) ? w[i] : (w[i - 16] + (rr(w15, 7) ^ rr(w15, 18) ^ (w15 >>> 3)) + w[i - 7] + (rr(w2, 17) ^ rr(w2, 19) ^ (w2 >>> 10))) | 0);
      var temp2 = (rr(a, 2) ^ rr(a, 13) ^ rr(a, 22)) + ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));
      hash = [(temp1 + temp2) | 0].concat(hash);
      hash[4] = (hash[4] + temp1) | 0;
    }
    for(i = 0; i < 8; i++) hash[i] = (hash[i] + oldHash[i]) | 0;
  }
  for(i = 0; i < 8; i++){
    for(j = 3; j + 1; j--){
      var b = (hash[i] >> (j * 8)) & 255;
      result += ((b < 16) ? 0 : '') + b.toString(16);
    }
  }
  return result;
}
function hashPassword(pass, salt){ return sha256(unescape(encodeURIComponent(salt + '::' + pass))); }
function nuevaSal(){ return Math.random().toString(36).slice(2) + Date.now().toString(36); }

/* ================= PERMISOS Y ROLES ================= */
var PANELES = [
  {id:'inicio', label:'Inicio', grupo:'General'},
  {id:'componentes', label:'Registro (componentes)', grupo:'Flujo del ensayo'},
  {id:'disenos', label:'Diseños y resultados', grupo:'Flujo del ensayo'},
  {id:'roturas', label:'Roturas', grupo:'Flujo del ensayo'},
  {id:'calendario', label:'Calendario de roturas', grupo:'Flujo del ensayo'},
  {id:'reporte-rr', label:'Reporte RR', grupo:'Flujo del ensayo'},
  {id:'archivador', label:'Archivador', grupo:'Flujo del ensayo'},
  {id:'proyectos', label:'Proyectos', grupo:'Seguimiento'},
  {id:'reportes', label:'Dashboard y KPIs', grupo:'Seguimiento'},
  {id:'base-historica', label:'Base histórica', grupo:'Seguimiento'},
  {id:'prediccion', label:'Predicción', grupo:'Inteligencia'},
  {id:'asistente', label:'Asistente I+D', grupo:'Inteligencia'},
  {id:'usuarios', label:'Usuarios y roles', grupo:'Administración'},
  {id:'historial', label:'Historial', grupo:'Administración'},
  {id:'ajustes', label:'Ajustes', grupo:'Administración'}
];
var ACCIONES = [
  {id:'disenos:crear', label:'Calcular, registrar y duplicar diseños'},
  {id:'disenos:eliminar', label:'Eliminar diseños'},
  {id:'resultados:registrar', label:'Registrar resultados de ensayo'},
  {id:'roturas:registrar', label:'Registrar elaboración y cargas de rotura'},
  {id:'roturas:eliminar', label:'Eliminar registros de rotura'},
  {id:'componentes:editar', label:'Crear y editar componentes'},
  {id:'proyectos:editar', label:'Crear y editar proyectos e iteraciones'},
  {id:'rr:editar', label:'Crear y editar reportes RR'},
  {id:'evidencias:subir', label:'Subir y borrar evidencias fotográficas'},
  {id:'datos:exportar', label:'Exportar datos (Excel / CSV)'},
  {id:'datos:respaldo', label:'Respaldar y restaurar la base completa'}
];
var TODOS_LOS_PERMISOS = PANELES.map(function(p){ return 'ver:' + p.id; }).concat(ACCIONES.map(function(a){ return a.id; }));

var ROLES_DEF = {
  admin: {label:'Administrador', desc:'Acceso total: usuarios, permisos, respaldo y todas las funciones.'},
  jefatura: {label:'Jefatura', desc:'Supervisión: reportes, métricas, expedientes, predicción e historial. No registra ensayos.'},
  tecnico: {label:'Técnico', desc:'Operación diaria: calcula diseños, registra roturas, resultados y evidencias.'}
};
var PERMISOS_POR_DEFECTO = {
  admin: TODOS_LOS_PERMISOS.slice(),
  jefatura: ['ver:inicio','ver:reportes','ver:proyectos','ver:disenos','ver:roturas','ver:calendario','ver:componentes',
    'ver:reporte-rr','ver:archivador','ver:base-historica','ver:prediccion','ver:asistente','ver:historial','ver:ajustes',
    'proyectos:editar','rr:editar','datos:exportar'],
  tecnico: ['ver:inicio','ver:proyectos','ver:disenos','ver:roturas','ver:calendario','ver:componentes','ver:reporte-rr',
    'ver:archivador','ver:asistente','ver:ajustes',
    'disenos:crear','resultados:registrar','roturas:registrar','componentes:editar','rr:editar','evidencias:subir']
};
var permisosPorRol = load('sid_roles_permisos', null) || JSON.parse(JSON.stringify(PERMISOS_POR_DEFECTO));
permisosPorRol.admin = TODOS_LOS_PERMISOS.slice(); // el administrador siempre conserva todo
function savePermisosPorRol(){ save('sid_roles_permisos', permisosPorRol); }

/* ================= USUARIOS ================= */
var usuarios = load('sid_usuarios', null);
if(!usuarios){
  // Primer arranque: se crea el administrador con las credenciales que ya usaba el sistema.
  var salAdmin = nuevaSal();
  usuarios = [{id:'u1', usuario:'FSANTOS', nombre:'F. Santos', iniciales:'FS', rol:'admin', activo:true,
    sal:salAdmin, hash:hashPassword('12345678', salAdmin), creado:Date.now(), ultimoAcceso:null}];
  save('sid_usuarios', usuarios);
}
/* Una versión de prueba guardó roles con otro formato (ADM, JEF, ANA, TEC, INV, CON): se devuelven a los de
   este sistema para que nadie se quede sin acceso. */
var ROL_EQUIVALENTE = {ADM:'admin', JEF:'jefatura', ANA:'tecnico', TEC:'tecnico', INV:'jefatura', CON:'jefatura'};
var rolesCorregidos = false;
usuarios.forEach(function(u){
  if(ROL_EQUIVALENTE[u.rol]){ u.rol = ROL_EQUIVALENTE[u.rol]; rolesCorregidos = true; }
  if(!ROLES_DEF[u.rol]){ u.rol = u.usuario === 'FSANTOS' ? 'admin' : 'tecnico'; rolesCorregidos = true; }
});
if(rolesCorregidos) save('sid_usuarios', usuarios);
function saveUsuarios(){ save('sid_usuarios', usuarios); }
function usuarioPorId(id){ return usuarios.filter(function(u){ return u.id === id; })[0] || null; }
function usuarioPorNombre(nombre){
  var key = String(nombre||'').trim().toUpperCase();
  return usuarios.filter(function(u){ return u.usuario.toUpperCase() === key; })[0] || null;
}

/* ================= SESIÓN ================= */
var usuarioActual = null;
function iniciarSesion(nombre, pass){
  var u = usuarioPorNombre(nombre);
  if(!u || !u.activo) return null;
  if(u.hash !== hashPassword(pass, u.sal)) return null;
  u.ultimoAcceso = Date.now();
  saveUsuarios();
  usuarioActual = u;
  sessionStorage.setItem('sid_sesion', u.id);
  return u;
}
function restaurarSesion(){
  var id = sessionStorage.getItem('sid_sesion');
  var u = id ? usuarioPorId(id) : null;
  if(u && u.activo){ usuarioActual = u; return u; }
  sessionStorage.removeItem('sid_sesion');
  return null;
}
function cerrarSesion(){
  sessionStorage.removeItem('sid_sesion');
  usuarioActual = null;
}
function can(permiso){
  if(!usuarioActual) return false;
  if(usuarioActual.rol === 'admin') return true;
  return (permisosPorRol[usuarioActual.rol] || []).indexOf(permiso) > -1;
}
function rolLabel(rol){ return (ROLES_DEF[rol] || {label:rol}).label; }
function inicialesUsuario(u){
  if(!u) return '';
  if(u.iniciales) return u.iniciales.toUpperCase();
  return (u.nombre||u.usuario).split(/\s+/).map(function(p){ return p.charAt(0); }).join('').slice(0,3).toUpperCase();
}

/* Oculta en toda la interfaz (incluido el contenido que se genera después) los elementos marcados con
   data-perm="..." para los que el usuario no tiene permiso. */
function aplicarPermisos(){
  var faltantes = TODOS_LOS_PERMISOS.filter(function(p){ return !can(p); });
  var css = faltantes.map(function(p){ return '[data-perm="'+p+'"]'; }).join(',');
  var styleEl = document.getElementById('perm-style');
  if(!styleEl){ styleEl = document.createElement('style'); styleEl.id = 'perm-style'; document.head.appendChild(styleEl); }
  styleEl.textContent = css ? css + '{display:none !important;}' : '';
  document.querySelectorAll('.side-nav .nav-item[data-panel]').forEach(function(btn){
    btn.style.display = can('ver:' + btn.dataset.panel) ? '' : 'none';
  });
  document.querySelectorAll('.side-nav .sn-group').forEach(function(g){
    var visibles = Array.prototype.some.call(g.querySelectorAll('.nav-item'), function(b){ return b.style.display !== 'none'; });
    g.style.display = visibles ? '' : 'none';
  });
  document.body.dataset.rol = usuarioActual ? usuarioActual.rol : '';
}
function exigir(permiso, mensaje){
  if(can(permiso)) return true;
  toast(mensaje || 'Tu rol no tiene permiso para esta acción');
  return false;
}
