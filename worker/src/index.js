/* ERP Laboratorio I+D — API en Cloudflare Workers + D1.
   Reglas que se aplican aquí, en el servidor (no en el navegador):
   · los permisos se verifican en cada petición según el rol de la sesión;
   · nada se borra: los registros se anulan o desactivan con motivo;
   · toda edición exige motivo y queda en historial_cambios con el valor anterior y el nuevo. */

const VERSION = '1.0.0';
const PBKDF2_ITERACIONES = 100000;
const SESION_HORAS = 12;

const ROLES = ['admin', 'lider', 'tecnico'];
const ETAPAS = ['caracterizacion', 'diseno', 'elaboracion', 'fresco', 'endurecido', 'otro'];

/* ---------------- utilidades ---------------- */
const enc = new TextEncoder();
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
const aleatorio = (n = 32) => hex(crypto.getRandomValues(new Uint8Array(n)));
const ahora = () => new Date().toISOString();
const nuevoId = () => crypto.randomUUID();

async function sha256(texto) { return hex(await crypto.subtle.digest('SHA-256', enc.encode(texto))); }
async function hashClave(clave, sal) {
  const llave = await crypto.subtle.importKey('raw', enc.encode(clave), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(sal), iterations: PBKDF2_ITERACIONES }, llave, 256);
  return hex(bits);
}
function igualSeguro(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

class ErrorApi extends Error {
  constructor(estado, mensaje) { super(mensaje); this.estado = estado; }
}
const falla = (estado, mensaje) => { throw new ErrorApi(estado, mensaje); };

function cabecerasCors(req, env) {
  const origen = req.headers.get('Origin') || '';
  const permitidos = String(env.ORIGENES_PERMITIDOS || '').split(',').map((s) => s.trim()).filter(Boolean);
  const ok = permitidos.includes('*') || permitidos.includes(origen);
  return ok && origen ? {
    'Access-Control-Allow-Origin': origen,
    'Access-Control-Allow-Methods': 'GET,POST,PUT,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  } : {};
}
function json(datos, estado, cors) {
  return new Response(JSON.stringify(datos), { status: estado || 200, headers: { 'Content-Type': 'application/json; charset=utf-8', ...cors } });
}
async function cuerpo(req) {
  try { return await req.json(); } catch { return {}; }
}
const texto = (v, max = 500) => (v === undefined || v === null) ? null : String(v).trim().slice(0, max);
const numero = (v) => (v === '' || v === null || v === undefined || !isFinite(Number(v))) ? null : Number(v);
const bool = (v) => (v === true || v === 1 || v === '1' || v === 'true') ? 1 : 0;

/* ---------------- sesión y permisos ---------------- */
async function sesionDe(req, env) {
  const auth = req.headers.get('Authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) return null;
  const fila = await env.DB.prepare(
    'SELECT u.id, u.usuario, u.nombre, u.iniciales, u.correo, u.rol, u.activo FROM sesiones s JOIN usuarios u ON u.id = s.usuario_id WHERE s.token = ? AND s.expira_en > ?'
  ).bind(await sha256(token), ahora()).first();
  if (!fila || !fila.activo) return null;
  const permisos = await env.DB.prepare('SELECT permiso FROM permisos_rol WHERE rol = ?').bind(fila.rol).all();
  fila.permisos = permisos.results.map((p) => p.permiso);
  return fila;
}
function exigir(sesion, permiso) {
  if (!sesion) falla(401, 'Sesión vencida o inválida');
  if (permiso && sesion.rol !== 'admin' && !sesion.permisos.includes(permiso)) falla(403, 'Tu rol no tiene permiso para esta acción');
}

/* ---------------- historial (7.5, 7.11, 8.4) ---------------- */
async function registrar(env, sesion, d) {
  await env.DB.prepare(
    'INSERT INTO historial_cambios (id, usuario_id, usuario, rol, accion, modulo, entidad_id, codigo, detalle, valor_anterior, valor_nuevo, motivo, proyecto) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)'
  ).bind(nuevoId(), sesion ? sesion.id : null, sesion ? sesion.usuario : 'sistema', sesion ? sesion.rol : null,
    d.accion, d.modulo, d.entidadId || null, d.codigo || null, d.detalle || null,
    d.antes === undefined ? null : JSON.stringify(d.antes), d.despues === undefined ? null : JSON.stringify(d.despues),
    d.motivo || null, d.proyecto || null).run();
}

/* Crea o actualiza una fila. Si ya existe exige motivo y guarda solo los campos que cambiaron. */
async function guardar(env, sesion, { tabla, clave = 'id', id, valores, modulo, codigo, motivo }) {
  const previa = await env.DB.prepare(`SELECT * FROM ${tabla} WHERE ${clave} = ?`).bind(id).first();
  const columnas = Object.keys(valores);
  if (!previa) {
    await env.DB.prepare(`INSERT INTO ${tabla} (${clave}, ${columnas.join(', ')}) VALUES (?${', ?'.repeat(columnas.length)})`)
      .bind(id, ...columnas.map((c) => valores[c])).run();
    await registrar(env, sesion, { accion: 'Creó', modulo, entidadId: id, codigo, despues: valores, motivo: motivo || null });
    return { creado: true };
  }
  const antes = {}, despues = {};
  columnas.forEach((c) => { if (String(previa[c] ?? '') !== String(valores[c] ?? '')) { antes[c] = previa[c]; despues[c] = valores[c]; } });
  if (!Object.keys(despues).length) return { creado: false, sinCambios: true };
  if (!texto(motivo)) falla(400, 'Indicá el motivo del cambio');
  const cambiadas = Object.keys(despues);
  await env.DB.prepare(`UPDATE ${tabla} SET ${cambiadas.map((c) => c + ' = ?').join(', ')} WHERE ${clave} = ?`)
    .bind(...cambiadas.map((c) => despues[c]), id).run();
  await registrar(env, sesion, { accion: 'Editó', modulo, entidadId: id, codigo, antes, despues, motivo: texto(motivo) });
  return { creado: false };
}

/* ---------------- rutas ---------------- */
const rutas = [];
const ruta = (metodo, patron, fn) => rutas.push({ metodo, partes: patron.split('/').filter(Boolean), fn });

ruta('GET', '/api/estado', async (req, env) => {
  const n = await env.DB.prepare('SELECT COUNT(*) AS n FROM usuarios').first();
  return { instalado: n.n > 0, version: VERSION };
});

ruta('POST', '/api/instalar', async (req, env) => {
  const n = await env.DB.prepare('SELECT COUNT(*) AS n FROM usuarios').first();
  if (n.n > 0) falla(409, 'El sistema ya está instalado');
  const b = await cuerpo(req);
  const usuario = texto(b.usuario, 30)?.toUpperCase();
  if (!usuario || !/^[A-Z0-9._-]{3,30}$/.test(usuario)) falla(400, 'Usuario: 3 a 30 caracteres, sin espacios');
  if (!texto(b.nombre)) falla(400, 'Ingresá el nombre completo');
  if (String(b.clave || '').length < 8) falla(400, 'La contraseña debe tener al menos 8 caracteres');
  const id = texto(b.id, 60) || nuevoId();
  const sal = aleatorio(16);
  await env.DB.prepare('INSERT INTO usuarios (id, usuario, nombre, iniciales, correo, rol, activo, clave_hash, clave_sal) VALUES (?,?,?,?,?,?,1,?,?)')
    .bind(id, usuario, texto(b.nombre, 120), texto(b.iniciales, 8), texto(b.correo, 160), 'admin', await hashClave(b.clave, sal), sal).run();
  await registrar(env, { id, usuario, rol: 'admin' }, { accion: 'Creó', modulo: 'Usuarios', entidadId: id, codigo: usuario, detalle: 'Instalación del sistema: primer administrador' });
  return { ok: true };
});

ruta('POST', '/api/login', async (req, env) => {
  const b = await cuerpo(req);
  const u = await env.DB.prepare('SELECT * FROM usuarios WHERE usuario = ?').bind(String(b.usuario || '').trim().toUpperCase()).first();
  const hash = u ? await hashClave(String(b.clave || ''), u.clave_sal) : await hashClave('x', 'x');
  if (!u || !u.activo || !igualSeguro(hash, u.clave_hash)) falla(401, 'Usuario o contraseña incorrectos');
  const token = aleatorio(32);
  const expira = new Date(Date.now() + SESION_HORAS * 3600e3).toISOString();
  await env.DB.batch([
    env.DB.prepare('INSERT INTO sesiones (token, usuario_id, expira_en) VALUES (?,?,?)').bind(await sha256(token), u.id, expira),
    env.DB.prepare('UPDATE usuarios SET ultimo_acceso = ? WHERE id = ?').bind(ahora(), u.id),
    env.DB.prepare('DELETE FROM sesiones WHERE expira_en < ?').bind(ahora())
  ]);
  await registrar(env, u, { accion: 'Ingresó', modulo: 'Sesión', entidadId: u.id, codigo: u.usuario });
  const sesion = await sesionDe(new Request('http://x', { headers: { Authorization: 'Bearer ' + token } }), env);
  return { token, expira, usuario: sesion };
});

ruta('POST', '/api/logout', async (req, env, s) => {
  const auth = req.headers.get('Authorization') || '';
  if (auth.startsWith('Bearer ')) await env.DB.prepare('DELETE FROM sesiones WHERE token = ?').bind(await sha256(auth.slice(7))).run();
  if (s) await registrar(env, s, { accion: 'Salió', modulo: 'Sesión', entidadId: s.id, codigo: s.usuario });
  return { ok: true };
});

ruta('GET', '/api/yo', async (req, env, s) => { exigir(s); return s; });

ruta('PUT', '/api/yo/clave', async (req, env, s) => {
  exigir(s);
  const b = await cuerpo(req);
  const u = await env.DB.prepare('SELECT * FROM usuarios WHERE id = ?').bind(s.id).first();
  if (!igualSeguro(await hashClave(String(b.actual || ''), u.clave_sal), u.clave_hash)) falla(400, 'La contraseña actual no es correcta');
  if (String(b.nueva || '').length < 8) falla(400, 'La nueva contraseña debe tener al menos 8 caracteres');
  const sal = aleatorio(16);
  await env.DB.prepare('UPDATE usuarios SET clave_hash = ?, clave_sal = ? WHERE id = ?').bind(await hashClave(b.nueva, sal), sal, s.id).run();
  await registrar(env, s, { accion: 'Editó', modulo: 'Usuarios', entidadId: s.id, codigo: s.usuario, detalle: 'Cambió su contraseña', motivo: 'Cambio de contraseña propio' });
  return { ok: true };
});

/* Todo lo que el laboratorio configura (Fase 1), en una sola lectura */
ruta('GET', '/api/laboratorio', async (req, env, s) => {
  exigir(s);
  const [ensayos, flujos, tolerancias, config, permisos, usuarios, personal, capacitaciones, autorizaciones] = await env.DB.batch([
    env.DB.prepare('SELECT * FROM ensayos ORDER BY etapa, nombre'),
    env.DB.prepare('SELECT * FROM flujos ORDER BY tipo_proyecto'),
    env.DB.prepare('SELECT * FROM tolerancias ORDER BY edad_horas'),
    env.DB.prepare('SELECT * FROM configuracion'),
    env.DB.prepare('SELECT * FROM permisos_rol'),
    env.DB.prepare('SELECT id, usuario, nombre, iniciales, correo, rol, activo, creado_en, ultimo_acceso FROM usuarios ORDER BY nombre'),
    env.DB.prepare('SELECT * FROM personal'),
    env.DB.prepare('SELECT * FROM capacitaciones ORDER BY fecha DESC'),
    env.DB.prepare('SELECT * FROM autorizaciones ORDER BY desde DESC')
  ]);
  const parse = (f, campos) => { campos.forEach((c) => { try { f[c] = JSON.parse(f[c]); } catch { f[c] = []; } }); return f; };
  return {
    ensayos: ensayos.results.map((f) => parse(f, ['campos'])),
    flujos: flujos.results.map((f) => parse(f, ['edades_defecto', 'pasos'])),
    tolerancias: tolerancias.results,
    configuracion: Object.fromEntries(config.results.map((c) => [c.clave, c.valor])),
    permisos: permisos.results,
    usuarios: usuarios.results,
    personal: personal.results,
    capacitaciones: capacitaciones.results,
    autorizaciones: autorizaciones.results
  };
});

ruta('PUT', '/api/usuarios/:id', async (req, env, s, p) => {
  exigir(s, 'config:laboratorio');
  const b = await cuerpo(req);
  const usuario = texto(b.usuario, 30)?.toUpperCase();
  if (!usuario || !/^[A-Z0-9._-]{3,30}$/.test(usuario)) falla(400, 'Usuario: 3 a 30 caracteres, sin espacios');
  if (!ROLES.includes(b.rol)) falla(400, 'Rol inválido');
  if (!texto(b.nombre)) falla(400, 'Ingresá el nombre completo');
  const previa = await env.DB.prepare('SELECT * FROM usuarios WHERE id = ?').bind(p.id).first();
  const valores = { usuario, nombre: texto(b.nombre, 120), iniciales: texto(b.iniciales, 8), correo: texto(b.correo, 160), rol: b.rol, activo: bool(b.activo ?? 1) };
  if (previa && previa.usuario !== usuario) falla(400, 'El nombre de usuario no se cambia');
  if (previa && previa.rol === 'admin' && (valores.rol !== 'admin' || !valores.activo)) {
    const admins = await env.DB.prepare("SELECT COUNT(*) AS n FROM usuarios WHERE rol = 'admin' AND activo = 1").first();
    if (admins.n <= 1) falla(400, 'Tiene que quedar al menos un administrador activo');
  }
  if (!previa) {
    if (String(b.clave || '').length < 8) falla(400, 'La contraseña debe tener al menos 8 caracteres');
    const existe = await env.DB.prepare('SELECT id FROM usuarios WHERE usuario = ?').bind(usuario).first();
    if (existe) falla(409, 'Ya existe un usuario con ese nombre');
    valores.clave_sal = aleatorio(16);
    valores.clave_hash = await hashClave(b.clave, valores.clave_sal);
    await env.DB.prepare('INSERT INTO usuarios (id, usuario, nombre, iniciales, correo, rol, activo, clave_hash, clave_sal) VALUES (?,?,?,?,?,?,?,?,?)')
      .bind(p.id, valores.usuario, valores.nombre, valores.iniciales, valores.correo, valores.rol, valores.activo, valores.clave_hash, valores.clave_sal).run();
    await registrar(env, s, { accion: 'Creó', modulo: 'Usuarios', entidadId: p.id, codigo: usuario, despues: { nombre: valores.nombre, rol: valores.rol, correo: valores.correo } });
    return { ok: true };
  }
  await guardar(env, s, { tabla: 'usuarios', id: p.id, valores, modulo: 'Usuarios', codigo: usuario, motivo: b.motivo });
  if (b.clave) {
    if (String(b.clave).length < 8) falla(400, 'La contraseña debe tener al menos 8 caracteres');
    const sal = aleatorio(16);
    await env.DB.prepare('UPDATE usuarios SET clave_hash = ?, clave_sal = ? WHERE id = ?').bind(await hashClave(b.clave, sal), sal, p.id).run();
    await env.DB.prepare('DELETE FROM sesiones WHERE usuario_id = ?').bind(p.id).run();
    await registrar(env, s, { accion: 'Editó', modulo: 'Usuarios', entidadId: p.id, codigo: usuario, detalle: 'Contraseña restablecida', motivo: texto(b.motivo) || 'Restablecimiento de contraseña' });
  }
  if (!valores.activo) await env.DB.prepare('DELETE FROM sesiones WHERE usuario_id = ?').bind(p.id).run();
  return { ok: true };
});

ruta('PUT', '/api/permisos/:rol', async (req, env, s, p) => {
  exigir(s, 'config:laboratorio');
  if (!['lider', 'tecnico'].includes(p.rol)) falla(400, 'Solo se editan los permisos de Líder y Técnico');
  const b = await cuerpo(req);
  if (!texto(b.motivo)) falla(400, 'Indicá el motivo del cambio');
  const nuevos = [...new Set((b.permisos || []).map(String))];
  const previos = (await env.DB.prepare('SELECT permiso FROM permisos_rol WHERE rol = ?').bind(p.rol).all()).results.map((r) => r.permiso);
  await env.DB.batch([env.DB.prepare('DELETE FROM permisos_rol WHERE rol = ?').bind(p.rol)]
    .concat(nuevos.map((perm) => env.DB.prepare('INSERT INTO permisos_rol (rol, permiso) VALUES (?,?)').bind(p.rol, perm))));
  await registrar(env, s, { accion: 'Editó', modulo: 'Permisos', codigo: p.rol, antes: previos, despues: nuevos, motivo: texto(b.motivo) });
  return { ok: true };
});

ruta('PUT', '/api/personal/:usuarioId', async (req, env, s, p) => {
  exigir(s, 'personal:autorizar');
  const b = await cuerpo(req);
  const u = await env.DB.prepare('SELECT usuario FROM usuarios WHERE id = ?').bind(p.usuarioId).first();
  if (!u) falla(404, 'Usuario no encontrado');
  await guardar(env, s, { tabla: 'personal', clave: 'usuario_id', id: p.usuarioId, modulo: 'Personal', codigo: u.usuario, motivo: b.motivo,
    valores: { puesto: texto(b.puesto, 120), laboratorio: texto(b.laboratorio, 120), formacion: texto(b.formacion, 1000), actualizado_en: ahora() } });
  return { ok: true };
});

ruta('PUT', '/api/capacitaciones/:id', async (req, env, s, p) => {
  exigir(s, 'personal:autorizar');
  const b = await cuerpo(req);
  if (!texto(b.nombre)) falla(400, 'Indicá el nombre de la capacitación');
  await guardar(env, s, { tabla: 'capacitaciones', id: p.id, modulo: 'Personal', codigo: texto(b.nombre, 120), motivo: b.motivo,
    valores: { usuario_id: texto(b.usuario_id, 60), nombre: texto(b.nombre, 200), fecha: texto(b.fecha, 10), horas: numero(b.horas), entidad: texto(b.entidad, 120) } });
  return { ok: true };
});

ruta('POST', '/api/capacitaciones/:id/anular', async (req, env, s, p) => {
  exigir(s, 'personal:autorizar');
  const b = await cuerpo(req);
  if (!texto(b.motivo)) falla(400, 'Indicá el motivo');
  await guardar(env, s, { tabla: 'capacitaciones', id: p.id, modulo: 'Personal', motivo: b.motivo, valores: { anulada: 1, motivo_anulacion: texto(b.motivo) } });
  return { ok: true };
});

ruta('PUT', '/api/autorizaciones/:id', async (req, env, s, p) => {
  exigir(s, 'personal:autorizar');
  const b = await cuerpo(req);
  const previa = await env.DB.prepare('SELECT id FROM autorizaciones WHERE id = ?').bind(p.id).first();
  if (previa) falla(409, 'Una autorización no se edita: revocala y otorgá una nueva');
  const u = await env.DB.prepare('SELECT usuario FROM usuarios WHERE id = ?').bind(b.usuario_id).first();
  const e = await env.DB.prepare('SELECT codigo FROM ensayos WHERE id = ?').bind(b.ensayo_id).first();
  if (!u || !e) falla(400, 'Usuario o ensayo inexistente');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(b.desde || ''))) falla(400, 'Fecha "desde" inválida');
  await env.DB.prepare('UPDATE autorizaciones SET vigente = 0, revocada_en = ?, revocada_por = ?, motivo_revocacion = ? WHERE usuario_id = ? AND ensayo_id = ? AND vigente = 1')
    .bind(ahora(), s.id, 'Reemplazada por una nueva autorización', b.usuario_id, b.ensayo_id).run();
  await guardar(env, s, { tabla: 'autorizaciones', id: p.id, modulo: 'Personal', codigo: u.usuario + ' · ' + e.codigo,
    valores: { usuario_id: b.usuario_id, ensayo_id: b.ensayo_id, desde: b.desde, autorizado_por: s.id, vigente: 1 } });
  return { ok: true };
});

ruta('POST', '/api/autorizaciones/:id/revocar', async (req, env, s, p) => {
  exigir(s, 'personal:autorizar');
  const b = await cuerpo(req);
  if (!texto(b.motivo)) falla(400, 'Indicá el motivo');
  const a = await env.DB.prepare('SELECT a.*, u.usuario, e.codigo FROM autorizaciones a JOIN usuarios u ON u.id = a.usuario_id JOIN ensayos e ON e.id = a.ensayo_id WHERE a.id = ?').bind(p.id).first();
  if (!a) falla(404, 'Autorización no encontrada');
  await guardar(env, s, { tabla: 'autorizaciones', id: p.id, modulo: 'Personal', codigo: a.usuario + ' · ' + a.codigo, motivo: b.motivo,
    valores: { vigente: 0, revocada_en: ahora(), revocada_por: s.id, motivo_revocacion: texto(b.motivo) } });
  return { ok: true };
});

ruta('PUT', '/api/ensayos/:id', async (req, env, s, p) => {
  exigir(s, 'config:laboratorio');
  const b = await cuerpo(req);
  if (!texto(b.codigo) || !texto(b.nombre)) falla(400, 'Código y nombre son obligatorios');
  if (!ETAPAS.includes(b.etapa)) falla(400, 'Etapa inválida');
  await guardar(env, s, { tabla: 'ensayos', id: p.id, modulo: 'Ensayos y métodos', codigo: texto(b.codigo, 20), motivo: b.motivo,
    valores: { codigo: texto(b.codigo, 20).toUpperCase(), nombre: texto(b.nombre, 200), etapa: b.etapa, metodo: texto(b.metodo, 120), version: texto(b.version, 20),
      unidades: texto(b.unidades, 60), campos: JSON.stringify(Array.isArray(b.campos) ? b.campos : []), activo: bool(b.activo ?? 1) } });
  return { ok: true };
});

ruta('PUT', '/api/flujos/:id', async (req, env, s, p) => {
  exigir(s, 'config:laboratorio');
  const b = await cuerpo(req);
  if (!texto(b.tipo_proyecto)) falla(400, 'Indicá el tipo de proyecto');
  const edades = (b.edades_defecto || []).map(Number).filter((x) => x > 0);
  if (!edades.length) falla(400, 'Indicá al menos una edad de rotura');
  await guardar(env, s, { tabla: 'flujos', id: p.id, modulo: 'Ensayos y métodos', codigo: texto(b.tipo_proyecto, 80), motivo: b.motivo,
    valores: { tipo_proyecto: texto(b.tipo_proyecto, 80), descripcion: texto(b.descripcion, 300), edades_defecto: JSON.stringify(edades),
      pasos: JSON.stringify(Array.isArray(b.pasos) ? b.pasos : []), activo: bool(b.activo ?? 1) } });
  return { ok: true };
});

ruta('PUT', '/api/tolerancias/:id', async (req, env, s, p) => {
  exigir(s, 'config:laboratorio');
  const b = await cuerpo(req);
  if (!(numero(b.edad_horas) > 0) || !(numero(b.tolerancia_horas) > 0)) falla(400, 'Edad y tolerancia deben ser mayores que cero');
  await guardar(env, s, { tabla: 'tolerancias', id: p.id, modulo: 'Ensayos y métodos', codigo: texto(b.etiqueta, 20), motivo: b.motivo,
    valores: { edad_horas: numero(b.edad_horas), etiqueta: texto(b.etiqueta, 20), tolerancia_horas: numero(b.tolerancia_horas) } });
  return { ok: true };
});

ruta('PUT', '/api/configuracion/:clave', async (req, env, s, p) => {
  exigir(s, 'config:laboratorio');
  const b = await cuerpo(req);
  await guardar(env, s, { tabla: 'configuracion', clave: 'clave', id: p.clave, modulo: 'Ensayos y métodos', codigo: p.clave, motivo: b.motivo,
    valores: { valor: texto(b.valor, 200) } });
  return { ok: true };
});

/* Eventos que registran los módulos que todavía guardan en el navegador (fases 2 a 7) */
ruta('POST', '/api/historial', async (req, env, s) => {
  exigir(s);
  const b = await cuerpo(req);
  if (!texto(b.accion) || !texto(b.modulo)) falla(400, 'Faltan acción y módulo');
  await registrar(env, s, { accion: texto(b.accion, 40), modulo: texto(b.modulo, 60), entidadId: texto(b.entidad_id, 80), codigo: texto(b.codigo, 80),
    detalle: texto(b.detalle, 1000), antes: b.antes, despues: b.despues, motivo: texto(b.motivo, 500), proyecto: texto(b.proyecto, 120) });
  return { ok: true };
});

ruta('GET', '/api/historial', async (req, env, s) => {
  exigir(s);
  const q = new URL(req.url).searchParams;
  const filtros = [], valores = [];
  if (q.get('modulo')) { filtros.push('modulo = ?'); valores.push(q.get('modulo')); }
  if (q.get('usuario')) { filtros.push('usuario = ?'); valores.push(q.get('usuario')); }
  if (q.get('codigo')) { filtros.push('codigo LIKE ?'); valores.push('%' + q.get('codigo') + '%'); }
  if (q.get('desde')) { filtros.push('ts >= ?'); valores.push(q.get('desde')); }
  if (q.get('hasta')) { filtros.push('ts < ?'); valores.push(q.get('hasta') + 'T99'); }
  const limite = Math.min(2000, Math.max(1, Number(q.get('limite')) || 500));
  const filas = await env.DB.prepare(`SELECT * FROM historial_cambios ${filtros.length ? 'WHERE ' + filtros.join(' AND ') : ''} ORDER BY ts DESC LIMIT ${limite}`).bind(...valores).all();
  return filas.results;
});

/* ---------------- despacho ---------------- */
export default {
  async fetch(req, env) {
    const cors = cabecerasCors(req, env);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    const partes = new URL(req.url).pathname.split('/').filter(Boolean);
    try {
      for (const r of rutas) {
        if (r.metodo !== req.method || r.partes.length !== partes.length) continue;
        const params = {};
        const coincide = r.partes.every((seg, i) => {
          if (seg.startsWith(':')) { params[seg.slice(1)] = decodeURIComponent(partes[i]); return true; }
          return seg === partes[i];
        });
        if (!coincide) continue;
        const sesion = await sesionDe(req, env);
        return json(await r.fn(req, env, sesion, params), 200, cors);
      }
      return json({ error: 'Ruta no encontrada' }, 404, cors);
    } catch (e) {
      if (e instanceof ErrorApi) return json({ error: e.message }, e.estado, cors);
      return json({ error: 'Error interno' }, 500, cors);
    }
  }
};
