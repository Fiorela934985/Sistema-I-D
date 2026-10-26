/* Sistema I+D — Acceso: usuarios, sesión, roles y permisos (RF-USR, sección 3) */
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
function nuevaSal(){
  var a = new Uint8Array(12);
  (window.crypto || window.msCrypto).getRandomValues(a);
  return Array.prototype.map.call(a, function(b){ return ('0' + b.toString(16)).slice(-2); }).join('');
}

/* ================= ROLES Y PERMISOS (sección 3 — shared/permisos.js) =================
   Seis roles: ADM, JEF, ANA, TEC, INV, CON. La matriz no se edita por pantalla: es la del documento,
   y la misma que valida el servidor. */
var PERM = window.SIDPermisos;
var ROLES_DEF = PERM.ROLES;
var PANELES = PERM.PANELES;
var ROL_VIEJO = {admin:'ADM', jefatura:'JEF', tecnico:'TEC'};

/* Las acciones de la interfaz (data-perm="…") se traducen a módulo + letra de la matriz. */
var ACCIONES = {
  'proyectos:crear':      ['proyectos', 'C'],
  'proyectos:editar':     ['proyectos', 'E'],
  'proyectos:aprobar':    ['proyectos', 'A'],
  'proyectos:eliminar':   ['proyectos', 'X'],
  'bitacora:escribir':    ['bitacora', 'C'],
  'reporte:generar':      ['reporteProyecto', 'C'],
  'normas:editar':        ['normas', 'E'],
  'disenos:crear':        ['disenos', 'C'],
  'disenos:editar':       ['disenos', 'E'],
  'disenos:aprobar':      ['disenos', 'A'],
  'disenos:eliminar':     ['disenos', 'X'],
  'elaboracion:programar':['elaboracion', 'C'],
  'resultados:registrar': ['elaboracion', 'E'],
  'etiquetas:imprimir':   ['etiquetas', 'C'],
  'roturas:crear':        ['roturas', 'C'],
  'roturas:registrar':    ['roturas', 'E'],
  'roturas:aprobar':      ['roturas', 'A'],
  'roturas:eliminar':     ['roturas', 'X'],
  'evidencias:subir':     ['roturas', 'E'],
  'rr:editar':            ['rr', 'E'],
  'rr:aprobar':           ['rr', 'A'],
  'componentes:editar':   ['materiales', 'E'],
  'inventario:editar':    ['productos', 'E'],
  'equipos:editar':       ['equipos', 'E'],
  'usuarios:editar':      ['usuarios', 'E'],
  'ajustes:editar':       ['ajustes', 'E']
};
var TODOS_LOS_PERMISOS = PANELES.map(function(p){ return 'ver:' + p.id; }).concat(Object.keys(ACCIONES)).concat(['datos:exportar', 'datos:respaldo']);

function rolDe(u){ return u ? (ROL_VIEJO[u.rol] || u.rol) : ''; }
function can(permiso){
  if(!usuarioActual) return false;
  var rol = rolDe(usuarioActual);
  if(permiso.indexOf('ver:') === 0) return PERM.puedeVerPanel(rol, permiso.slice(4));
  if(permiso === 'datos:exportar') return ['ADM', 'JEF', 'ANA', 'INV'].indexOf(rol) > -1;   // RNF-09
  if(permiso === 'datos:respaldo') return rol === 'ADM';                                     // RF-BAK-02
  if(permiso === 'elaboracion:programar') return rol === 'ANA' || rol === 'JEF';             // RF-ELA-01 (más específico que la matriz)
  var a = ACCIONES[permiso];
  return a ? PERM.puede(rol, a[0], a[1]) : false;
}
function rolLabel(rol){ rol = ROL_VIEJO[rol] || rol; return (ROLES_DEF[rol] || {label:rol || ''}).label; }

/* ================= USUARIOS (RF-USR-05) ================= */
var usuarios = load('sid_usuarios', null);
if(!usuarios){
  // Primer arranque: un administrador con clave temporal, que obliga a cambiarla al primer ingreso (RF-USR-04).
  var salAdmin = nuevaSal();
  usuarios = [{id:'u1', usuario:'FSANTOS', nombre:'F. Santos', iniciales:'FS', correo:'', empresa:'DINO SRL',
    laboratorio:'LAB-DINO-TRUJILLO', laboratorios:['LAB-DINO-TRUJILLO'], sector:'', puesto:'Sistemas', rol:'ADM', equipos:[],
    activo:true, sal:salAdmin, hash:hashPassword('Cambiar2026', salAdmin), debeCambiarClave:true, creado:Date.now(), ultimoAcceso:null}];
  save('sid_usuarios', usuarios);
}
/* Usuarios creados con la versión anterior (roles admin/jefatura/tecnico, sin correo ni laboratorio). */
usuarios.forEach(function(u){
  if(ROL_VIEJO[u.rol]) u.rol = ROL_VIEJO[u.rol];
  if(!u.laboratorios) u.laboratorios = u.laboratorio ? [u.laboratorio] : ['LAB-DINO-TRUJILLO'];
  if(!u.laboratorio) u.laboratorio = u.laboratorios[0];
  if(!u.equipos) u.equipos = [];
});
function saveUsuarios(){ save('sid_usuarios', usuarios); }
function usuarioPorId(id){ return usuarios.filter(function(u){ return u.id === id; })[0] || null; }
function usuarioPorNombre(nombre){
  var key = String(nombre||'').trim().toUpperCase();
  return usuarios.filter(function(u){ return u.usuario.toUpperCase() === key || (u.correo && u.correo.toUpperCase() === key); })[0] || null;
}
function usuariosActivos(rol){ return usuarios.filter(function(u){ return u.activo && (!rol || rolDe(u) === rol || (Array.isArray(rol) && rol.indexOf(rolDe(u)) > -1)); }); }
function nombreUsuario(u){ return u ? (u.nombre || u.usuario) : ''; }

/* Validaciones del alta de usuario: RF-USR-05 y validaciones transversales (sección 14). */
function validarUsuario(datos, idActual){
  var e = {};
  if(!/^[A-Za-z0-9._-]{3,30}$/.test(datos.usuario || '')) e.usuario = 'De 3 a 30 caracteres, sin espacios.';
  else if(usuarios.some(function(u){ return u.id !== idActual && u.usuario.toUpperCase() === datos.usuario.toUpperCase(); })) e.usuario = 'Ya existe ese usuario.';
  if(!/^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ .'-]{3,}$/.test((datos.nombre || '').trim())) e.nombre = 'Solo letras, espacios, tildes y guion.';
  if(!/^[A-Za-z]{2,4}$/.test(datos.iniciales || '')) e.iniciales = 'De 2 a 4 letras.';
  else if(usuarios.some(function(u){ return u.id !== idActual && (u.iniciales||'').toUpperCase() === datos.iniciales.toUpperCase(); })) e.iniciales = 'Esas iniciales ya las usa otra persona.';
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(datos.correo || '')) e.correo = 'Correo con formato válido.';
  else if(usuarios.some(function(u){ return u.id !== idActual && (u.correo||'').toLowerCase() === datos.correo.toLowerCase(); })) e.correo = 'Ese correo ya está registrado.';
  ['empresa', 'laboratorio', 'puesto', 'rol'].forEach(function(k){ if(!String(datos[k] || '').trim()) e[k] = 'Obligatorio.'; });
  return e;
}
/* RF-USR-03: mínimo 8 caracteres, con letras y números. */
function validarClaveNueva(nueva, actual){
  if(nueva.length < 8) return 'Mínimo 8 caracteres.';
  if(!/[A-Za-z]/.test(nueva) || !/[0-9]/.test(nueva)) return 'Debe tener letras y números.';
  if(actual && nueva === actual) return 'Debe ser distinta de la actual.';
  return '';
}
function claveTemporal(){ return 'Tmp' + nuevaSal().slice(0, 6) + Math.floor(Math.random()*90 + 10); }

/* ================= SESIÓN (RF-USR-01 y 02) ================= */
var MAX_INTENTOS = 5, MINUTOS_BLOQUEO = 15;
var SESION_MAX_MS = 8 * 3600 * 1000, INACTIVIDAD_MS = 60 * 60 * 1000;
var usuarioActual = null;

/* Devuelve {u} o {error}. El mensaje es genérico salvo el bloqueo, que dice cuánto falta. */
function iniciarSesion(nombre, pass){
  var u = usuarioPorNombre(nombre);
  var generico = {error:'Usuario o contraseña incorrectos.'};
  if(!u || !u.activo || !rolDe(u)) return generico;
  if(u.bloqueadoHasta && u.bloqueadoHasta > Date.now()){
    return {error:'Demasiados intentos fallidos. Probá de nuevo en ' + Math.ceil((u.bloqueadoHasta - Date.now())/60000) + ' min.'};
  }
  if(u.hash !== hashPassword(pass, u.sal)){
    u.intentosFallidos = (u.intentosFallidos || 0) + 1;
    if(u.intentosFallidos >= MAX_INTENTOS){ u.intentosFallidos = 0; u.bloqueadoHasta = Date.now() + MINUTOS_BLOQUEO*60000; }
    saveUsuarios();
    return generico;
  }
  u.intentosFallidos = 0; u.bloqueadoHasta = 0;
  u.ultimoAcceso = Date.now();
  saveUsuarios();
  usuarioActual = u;
  sessionStorage.setItem('sid_sesion', JSON.stringify({id:u.id, inicio:Date.now(), actividad:Date.now()}));
  return {u:u};
}
function datosSesion(){ try{ return JSON.parse(sessionStorage.getItem('sid_sesion') || 'null'); }catch(e){ return null; } }
function sesionVencida(s){ return !s || (Date.now() - s.inicio) > SESION_MAX_MS || (Date.now() - s.actividad) > INACTIVIDAD_MS; }
function restaurarSesion(){
  var s = datosSesion();
  var u = s ? usuarioPorId(s.id) : null;
  if(u && u.activo && !sesionVencida(s)){ usuarioActual = u; return u; }
  sessionStorage.removeItem('sid_sesion');
  return null;
}
function marcarActividad(){
  var s = datosSesion();
  if(s && !sesionVencida(s)){ s.actividad = Date.now(); sessionStorage.setItem('sid_sesion', JSON.stringify(s)); }
}
function cerrarSesion(){
  sessionStorage.removeItem('sid_sesion');
  usuarioActual = null;
}
function inicialesUsuario(u){
  if(!u) return '';
  if(u.iniciales) return u.iniciales.toUpperCase();
  return (u.nombre||u.usuario).split(/\s+/).map(function(p){ return p.charAt(0); }).join('').slice(0,3).toUpperCase();
}

/* Lo que el rol no permite no se muestra: ni menú ni botón (sección 3, Reglas). */
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
  document.body.dataset.rol = usuarioActual ? rolDe(usuarioActual) : '';
}
function exigir(permiso, mensaje){
  if(can(permiso)) return true;
  toast(mensaje || 'Tu rol no tiene permiso para esta acción');
  return false;
}

/* ================= ALCANCE DE DATOS (sección 3: rol + laboratorio + equipo) ================= */
function esDeMiEquipo(proy){
  if(!usuarioActual || !proy) return false;
  var mios = usuarioActual.equipos || [];
  var suyos = [proy.equipoLider].concat(proy.equiposApoyo || []);
  return mios.some(function(e){ return suyos.indexOf(e) > -1; }) || proy.responsable === usuarioActual.id;
}
function veoLaboratorio(lab){
  if(!usuarioActual || rolDe(usuarioActual) === 'ADM' || !lab) return true;
  return (usuarioActual.laboratorios || []).indexOf(lab) > -1;
}
