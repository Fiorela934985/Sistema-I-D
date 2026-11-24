/* ERP Laboratorio I+D — API en Cloudflare Workers + D1.
   Reglas que se aplican aquí, en el servidor (no en el navegador):
   · los permisos se verifican en cada petición según el rol de la sesión;
   · nada se borra: los registros se anulan o desactivan con motivo;
   · toda edición exige motivo y queda en historial_cambios con el valor anterior y el nuevo. */

const VERSION = '1.1.0';
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

/* ---------------- Fase 2: proyectos con su ficha, objetivos y ensayos ---------------- */
async function proyectoCompleto(env, id) {
  const p = await env.DB.prepare('SELECT * FROM proyectos WHERE id = ?').bind(id).first();
  if (!p) return null;
  const [eq, ob, en] = await env.DB.batch([
    env.DB.prepare('SELECT usuario_id FROM proyecto_equipo WHERE proyecto_id = ? ORDER BY usuario_id').bind(id),
    env.DB.prepare('SELECT * FROM objetivos WHERE proyecto_id = ? ORDER BY rowid').bind(id),
    env.DB.prepare('SELECT pe.ensayo_id, pe.edades, e.etapa FROM proyecto_ensayos pe JOIN ensayos e ON e.id = pe.ensayo_id WHERE pe.proyecto_id = ? ORDER BY pe.rowid').bind(id)
  ]);
  const conEdades = en.results.find((r) => r.edades);
  return {
    id: p.id, codigo: p.codigo, nombre: p.nombre, tipo_flujo_id: p.tipo_flujo_id, responsable_id: p.responsable_id,
    fecha_inicio: p.fecha_inicio || '', fecha_fin: p.fecha_fin || '', creado_en: p.creado_en, anulado: p.anulado,
    equipo: eq.results.map((r) => r.usuario_id),
    objetivos: ob.results.map((o) => ({ id: o.id, descripcion: o.descripcion === '-' ? '' : o.descripcion, ensayo_id: o.ensayo_id, edad_dias: o.edad_dias, operador: o.operador, valor_min: o.valor_min, valor_max: o.valor_max ?? '', unidad: o.unidad || '' })),
    ensayos: en.results.map((r) => r.ensayo_id),
    edades: conEdades ? JSON.parse(conEdades.edades) : []
  };
}
ruta('GET', '/api/proyectos', async (req, env, s) => {
  exigir(s);
  const ids = (await env.DB.prepare('SELECT id FROM proyectos WHERE anulado = 0 ORDER BY nombre').all()).results;
  const out = [];
  for (const r of ids) out.push(await proyectoCompleto(env, r.id));
  return out;
});
ruta('PUT', '/api/proyectos/:id', async (req, env, s, p) => {
  exigir(s, 'proyectos:editar');
  const b = await cuerpo(req);
  const nombre = texto(b.nombre, 120), codigo = texto(b.codigo, 30)?.toUpperCase();
  if (!nombre) falla(400, 'Ingresá el nombre del proyecto');
  if (!codigo) falla(400, 'Ingresá el código');
  const fecha = (v) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v)) ? v : null;
  const ini = fecha(b.fecha_inicio), fin = fecha(b.fecha_fin);
  if (ini && fin && fin < ini) falla(400, 'La fecha de fin no puede ser anterior al inicio');
  const repetido = await env.DB.prepare('SELECT id FROM proyectos WHERE (nombre = ? OR codigo = ?) AND id <> ?').bind(nombre, codigo, p.id).first();
  if (repetido) falla(409, 'Ya existe un proyecto con ese nombre o código');
  if (!(await env.DB.prepare('SELECT id FROM flujos WHERE id = ?').bind(b.tipo_flujo_id || '').first())) falla(400, 'Tipo de proyecto inexistente');
  if (!(await env.DB.prepare('SELECT id FROM usuarios WHERE id = ? AND activo = 1').bind(b.responsable_id || '').first())) falla(400, 'Elegí un responsable activo');
  const equipo = [...new Set((b.equipo || []).map(String))];
  for (const u of equipo) if (!(await env.DB.prepare('SELECT id FROM usuarios WHERE id = ?').bind(u).first())) falla(400, 'Usuario del equipo inexistente');
  const ensayos = [...new Set((b.ensayos || []).map(String))];
  if (!ensayos.length) falla(400, 'Elegí al menos un ensayo');
  const etapas = {};
  for (const e of ensayos) {
    const fila = await env.DB.prepare('SELECT etapa FROM ensayos WHERE id = ?').bind(e).first();
    if (!fila) falla(400, 'Ensayo inexistente: ' + e);
    etapas[e] = fila.etapa;
  }
  const edades = [...new Set((b.edades || []).map(Number).filter((x) => x > 0))].sort((x, y) => x - y);
  if (Object.values(etapas).includes('endurecido') && !edades.length) falla(400, 'Elegí al menos una edad de rotura');
  const objetivos = (b.objetivos || []).map((o) => {
    if (!ensayos.includes(o.ensayo_id)) falla(400, 'Un objetivo usa un ensayo que no está en el proyecto');
    if (!['>=', '<=', 'entre', '='].includes(o.operador) || numero(o.valor_min) === null) falla(400, 'Objetivo incompleto');
    if (o.operador === 'entre' && !(numero(o.valor_max) > numero(o.valor_min))) falla(400, 'En un objetivo "entre", el valor hasta debe ser mayor');
    return { id: texto(o.id, 60) || nuevoId(), descripcion: texto(o.descripcion, 200) || '-', ensayo_id: o.ensayo_id, edad_dias: numero(o.edad_dias), operador: o.operador,
      valor_min: numero(o.valor_min), valor_max: o.operador === 'entre' ? numero(o.valor_max) : null, unidad: texto(o.unidad, 20) };
  });
  const nuevo = { codigo, nombre, tipo_flujo_id: b.tipo_flujo_id, responsable_id: b.responsable_id, fecha_inicio: ini || '', fecha_fin: fin || '', equipo: [...equipo].sort(),
    objetivos: objetivos.map((o) => ({ ...o, descripcion: o.descripcion === '-' ? '' : o.descripcion, valor_max: o.valor_max ?? '', unidad: o.unidad || '' })), ensayos, edades };
  const previo = await proyectoCompleto(env, p.id);
  let antes, despues;
  if (previo) {
    previo.equipo = [...previo.equipo].sort();
    antes = {}; despues = {};
    for (const k of Object.keys(nuevo)) if (JSON.stringify(previo[k] ?? '') !== JSON.stringify(nuevo[k] ?? '')) { antes[k] = previo[k]; despues[k] = nuevo[k]; }
    if (!Object.keys(despues).length) return { ok: true, sinCambios: true };
    if (!texto(b.motivo)) falla(400, 'Indicá el motivo del cambio');
  }
  const stmts = [];
  if (previo) stmts.push(env.DB.prepare('UPDATE proyectos SET codigo = ?, nombre = ?, tipo_flujo_id = ?, responsable_id = ?, fecha_inicio = ?, fecha_fin = ? WHERE id = ?')
    .bind(codigo, nombre, b.tipo_flujo_id, b.responsable_id, ini, fin, p.id));
  else stmts.push(env.DB.prepare('INSERT INTO proyectos (id, codigo, nombre, tipo_flujo_id, responsable_id, fecha_inicio, fecha_fin, creado_por) VALUES (?,?,?,?,?,?,?,?)')
    .bind(p.id, codigo, nombre, b.tipo_flujo_id, b.responsable_id, ini, fin, s.id));
  stmts.push(env.DB.prepare('DELETE FROM proyecto_equipo WHERE proyecto_id = ?').bind(p.id));
  stmts.push(env.DB.prepare('DELETE FROM objetivos WHERE proyecto_id = ?').bind(p.id));
  stmts.push(env.DB.prepare('DELETE FROM proyecto_ensayos WHERE proyecto_id = ?').bind(p.id));
  equipo.forEach((u) => stmts.push(env.DB.prepare('INSERT INTO proyecto_equipo (proyecto_id, usuario_id) VALUES (?,?)').bind(p.id, u)));
  objetivos.forEach((o) => stmts.push(env.DB.prepare('INSERT INTO objetivos (id, proyecto_id, descripcion, ensayo_id, edad_dias, operador, valor_min, valor_max, unidad) VALUES (?,?,?,?,?,?,?,?,?)')
    .bind(o.id, p.id, o.descripcion, o.ensayo_id, o.edad_dias, o.operador, o.valor_min, o.valor_max, o.unidad)));
  ensayos.forEach((e) => stmts.push(env.DB.prepare('INSERT INTO proyecto_ensayos (proyecto_id, ensayo_id, edades) VALUES (?,?,?)')
    .bind(p.id, e, etapas[e] === 'endurecido' ? JSON.stringify(edades) : null)));
  await env.DB.batch(stmts);
  await registrar(env, s, { accion: previo ? 'Editó' : 'Creó', modulo: 'Proyectos', entidadId: p.id, codigo, proyecto: nombre,
    antes: previo ? antes : undefined, despues: previo ? despues : { codigo, nombre, tipo: b.tipo_flujo_id, ensayos: ensayos.length, edades }, motivo: texto(b.motivo) });
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

/* ---------------- registros del laboratorio (Fase 4): diseños, roturas, lotes, informes, no conformes ----------------
   Cada documento se guarda completo en registros.datos. Nada se borra: se marca anulado con motivo.
   Regla 7: un informe solo pasa a aprobado o emitido con permiso de aprobar, y lo aprueba alguien distinto de quien lo elaboró. */
const COLECCIONES = {
  disenos: ['disenos:crear', 'resultados:registrar', 'roturas:registrar'],
  roturas: ['roturas:registrar'],
  lotes: ['resultados:registrar', 'disenos:crear'],
  informes: ['rr:editar', 'informes:aprobar'],
  tnc: ['roturas:registrar', 'tnc:reportar', 'tnc:cerrar'],
  contadores: ['roturas:registrar', 'disenos:crear']
};
function exigirAlguno(sesion, permisos) {
  if (!sesion) falla(401, 'Sesión vencida o inválida');
  if (sesion.rol !== 'admin' && !permisos.some((p) => sesion.permisos.includes(p))) falla(403, 'Tu rol no tiene permiso para esta acción');
}
const MODULO_COLECCION = { disenos: 'Diseño', roturas: 'Rotura', lotes: 'Lote de agregado', informes: 'Informes', tnc: 'Trabajo no conforme', contadores: 'Códigos' };

ruta('GET', '/api/registros', async (req, env, s) => {
  exigir(s);
  const filas = await env.DB.prepare('SELECT coleccion, datos FROM registros').all();
  const colecciones = {};
  Object.keys(COLECCIONES).forEach((c) => { colecciones[c] = []; });
  filas.results.forEach((f) => { try { colecciones[f.coleccion].push(JSON.parse(f.datos)); } catch { } });
  return { colecciones };
});

ruta('POST', '/api/registros', async (req, env, s) => {
  exigir(s);
  const b = await cuerpo(req);
  const items = Array.isArray(b.items) ? b.items : [];
  if (!items.length) return { ok: true, n: 0 };
  if (items.length > 200) falla(400, 'Demasiados registros en un envío');
  const sentencias = [];
  for (const it of items) {
    const col = String(it.coleccion || '');
    if (!COLECCIONES[col]) falla(400, 'Colección desconocida');
    exigirAlguno(s, COLECCIONES[col]);
    const id = texto(it.id, 120);
    if (!id) falla(400, 'Registro sin id');
    const datos = it.datos && typeof it.datos === 'object' ? it.datos : null;
    if (!datos) falla(400, 'Registro sin datos');
    const json = JSON.stringify(datos);
    if (json.length > 300000) falla(400, 'Registro demasiado grande');
    const anulado = bool(it.anulado || datos.anulado);
    const previa = await env.DB.prepare('SELECT datos, anulado FROM registros WHERE coleccion = ? AND id = ?').bind(col, id).first();
    const antes = previa ? JSON.parse(previa.datos) : null;
    if (col === 'informes') {
      const ePrev = (antes && antes.estado) || 'borrador';
      const eNuevo = datos.estado || 'borrador';
      if (ePrev === 'emitido' && eNuevo === 'emitido' && previa.datos !== json) falla(409, 'El informe ya fue emitido: crea una nueva versión para cambiarlo');
      if (!previa && (eNuevo === 'aprobado' || eNuevo === 'emitido')) {
        exigir(s, 'informes:aprobar');
      } else if (eNuevo !== ePrev && (eNuevo === 'aprobado' || eNuevo === 'emitido')) {
        exigir(s, 'informes:aprobar');
        if (eNuevo === 'emitido' && ePrev !== 'aprobado') falla(400, 'Un informe no se emite sin revisión y aprobación');
        if (eNuevo === 'aprobado') {
          if (datos.aprobado_por !== s.id) falla(400, 'La aprobación debe registrarse con tu usuario');
          if (datos.elaborado_por === s.id && s.rol !== 'admin') falla(403, 'Quien elaboró el informe no puede aprobarlo');
        }
      }
    }
    if (anulado && !(previa && previa.anulado) && !texto(datos.motivo_anulacion)) falla(400, 'Indicá el motivo de la anulación');
    sentencias.push(env.DB.prepare(
      'INSERT INTO registros (coleccion, id, proyecto, codigo, datos, anulado, version, actualizado_por, actualizado_en) VALUES (?,?,?,?,?,?,1,?,?) ' +
      'ON CONFLICT(coleccion, id) DO UPDATE SET proyecto = excluded.proyecto, codigo = excluded.codigo, datos = excluded.datos, anulado = excluded.anulado, version = registros.version + 1, actualizado_por = excluded.actualizado_por, actualizado_en = excluded.actualizado_en'
    ).bind(col, id, texto(datos.proyecto || datos.proyectoId, 200), texto(datos.codigo, 120), json, anulado, s.id, ahora()));
    if (anulado && !(previa && previa.anulado)) {
      sentencias.push(env.DB.prepare(
        'INSERT INTO historial_cambios (id, usuario_id, usuario, rol, accion, modulo, entidad_id, codigo, detalle, valor_anterior, valor_nuevo, motivo, proyecto) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)'
      ).bind(nuevoId(), s.id, s.usuario, s.rol, 'Anuló', MODULO_COLECCION[col], id, texto(datos.codigo, 120), null, JSON.stringify({ anulado: 0 }), JSON.stringify({ anulado: 1 }), texto(datos.motivo_anulacion), texto(datos.proyecto || datos.proyectoId, 200)));
    }
    if (col === 'informes' && antes && (antes.estado || 'borrador') !== (datos.estado || 'borrador')) {
      sentencias.push(env.DB.prepare(
        'INSERT INTO historial_cambios (id, usuario_id, usuario, rol, accion, modulo, entidad_id, codigo, detalle, valor_anterior, valor_nuevo, motivo, proyecto) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)'
      ).bind(nuevoId(), s.id, s.usuario, s.rol, 'Cambió estado', 'Informes', id, texto(datos.codigo, 120), texto(datos.nombre, 200), JSON.stringify({ estado: antes.estado || 'borrador' }), JSON.stringify({ estado: datos.estado }), texto(datos.motivo_estado), texto(datos.proyecto || datos.proyectoId, 200)));
    }
  }
  await env.DB.batch(sentencias);
  return { ok: true, n: items.length };
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
