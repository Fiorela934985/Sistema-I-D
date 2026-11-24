PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS usuarios (
  id TEXT PRIMARY KEY,
  usuario TEXT NOT NULL UNIQUE,
  nombre TEXT NOT NULL,
  iniciales TEXT,
  correo TEXT,
  rol TEXT NOT NULL CHECK (rol IN ('admin','lider','tecnico')),
  activo INTEGER NOT NULL DEFAULT 1,
  clave_hash TEXT NOT NULL,
  clave_sal TEXT NOT NULL,
  creado_en TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  ultimo_acceso TEXT
);

CREATE TABLE IF NOT EXISTS sesiones (
  token TEXT PRIMARY KEY,
  usuario_id TEXT NOT NULL REFERENCES usuarios(id),
  creada_en TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  expira_en TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sesiones_usuario ON sesiones(usuario_id);

CREATE TABLE IF NOT EXISTS permisos_rol (
  rol TEXT NOT NULL CHECK (rol IN ('admin','lider','tecnico')),
  permiso TEXT NOT NULL,
  PRIMARY KEY (rol, permiso)
);

CREATE TABLE IF NOT EXISTS personal (
  usuario_id TEXT PRIMARY KEY REFERENCES usuarios(id),
  puesto TEXT,
  laboratorio TEXT,
  formacion TEXT,
  actualizado_en TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS capacitaciones (
  id TEXT PRIMARY KEY,
  usuario_id TEXT NOT NULL REFERENCES usuarios(id),
  nombre TEXT NOT NULL,
  fecha TEXT,
  horas REAL,
  entidad TEXT,
  anulada INTEGER NOT NULL DEFAULT 0,
  motivo_anulacion TEXT
);
CREATE INDEX IF NOT EXISTS idx_capacitaciones_usuario ON capacitaciones(usuario_id);

CREATE TABLE IF NOT EXISTS ensayos (
  id TEXT PRIMARY KEY,
  codigo TEXT NOT NULL UNIQUE,
  nombre TEXT NOT NULL,
  etapa TEXT NOT NULL CHECK (etapa IN ('caracterizacion','diseno','elaboracion','fresco','endurecido','otro')),
  metodo TEXT,
  version TEXT,
  unidades TEXT,
  campos TEXT NOT NULL DEFAULT '[]',
  activo INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS autorizaciones (
  id TEXT PRIMARY KEY,
  usuario_id TEXT NOT NULL REFERENCES usuarios(id),
  ensayo_id TEXT NOT NULL REFERENCES ensayos(id),
  desde TEXT NOT NULL,
  autorizado_por TEXT NOT NULL REFERENCES usuarios(id),
  vigente INTEGER NOT NULL DEFAULT 1,
  revocada_en TEXT,
  revocada_por TEXT REFERENCES usuarios(id),
  motivo_revocacion TEXT
);
CREATE INDEX IF NOT EXISTS idx_autorizaciones_usuario ON autorizaciones(usuario_id, ensayo_id);

CREATE TABLE IF NOT EXISTS flujos (
  id TEXT PRIMARY KEY,
  tipo_proyecto TEXT NOT NULL UNIQUE,
  descripcion TEXT,
  edades_defecto TEXT NOT NULL DEFAULT '[1,3,7,28]',
  pasos TEXT NOT NULL DEFAULT '[]',
  activo INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS tolerancias (
  id TEXT PRIMARY KEY,
  edad_horas REAL NOT NULL UNIQUE,
  etiqueta TEXT NOT NULL,
  tolerancia_horas REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS configuracion (
  clave TEXT PRIMARY KEY,
  valor TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS proyectos (
  id TEXT PRIMARY KEY,
  codigo TEXT UNIQUE,
  nombre TEXT NOT NULL UNIQUE,
  tipo_flujo_id TEXT REFERENCES flujos(id),
  responsable_id TEXT REFERENCES usuarios(id),
  fecha_inicio TEXT,
  fecha_fin TEXT,
  anulado INTEGER NOT NULL DEFAULT 0,
  motivo_anulacion TEXT,
  creado_por TEXT REFERENCES usuarios(id),
  creado_en TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS proyecto_equipo (
  proyecto_id TEXT NOT NULL REFERENCES proyectos(id),
  usuario_id TEXT NOT NULL REFERENCES usuarios(id),
  PRIMARY KEY (proyecto_id, usuario_id)
);

CREATE TABLE IF NOT EXISTS objetivos (
  id TEXT PRIMARY KEY,
  proyecto_id TEXT NOT NULL REFERENCES proyectos(id),
  descripcion TEXT NOT NULL,
  ensayo_id TEXT REFERENCES ensayos(id),
  edad_dias REAL,
  operador TEXT CHECK (operador IN ('>=','<=','entre','=')),
  valor_min REAL,
  valor_max REAL,
  unidad TEXT
);

CREATE TABLE IF NOT EXISTS proyecto_ensayos (
  proyecto_id TEXT NOT NULL REFERENCES proyectos(id),
  ensayo_id TEXT NOT NULL REFERENCES ensayos(id),
  edades TEXT,
  PRIMARY KEY (proyecto_id, ensayo_id)
);

CREATE TABLE IF NOT EXISTS lotes_agregado (
  id TEXT PRIMARY KEY,
  codigo TEXT NOT NULL UNIQUE,
  material_inventario_id TEXT,
  tipo TEXT CHECK (tipo IN ('fino','grueso','global')),
  procedencia TEXT,
  fecha_muestreo TEXT,
  resultados TEXT NOT NULL DEFAULT '{}',
  caracterizado_por TEXT REFERENCES usuarios(id),
  anulado INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS disenos (
  id TEXT PRIMARY KEY,
  proyecto_id TEXT NOT NULL REFERENCES proyectos(id),
  nombre TEXT NOT NULL UNIQUE,
  nombre_unificado TEXT NOT NULL,
  iteracion TEXT,
  receta TEXT NOT NULL DEFAULT '{}',
  receta_real TEXT,
  lotes TEXT NOT NULL DEFAULT '[]',
  num_replicas INTEGER NOT NULL DEFAULT 1,
  edades TEXT NOT NULL DEFAULT '[1,3,7,28]',
  tipo_especimen TEXT CHECK (tipo_especimen IN ('probetas','cubos')),
  responsable_id TEXT REFERENCES usuarios(id),
  creado_por TEXT REFERENCES usuarios(id),
  creado_en TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  anulado INTEGER NOT NULL DEFAULT 0,
  motivo_anulacion TEXT
);
CREATE INDEX IF NOT EXISTS idx_disenos_proyecto ON disenos(proyecto_id);
CREATE INDEX IF NOT EXISTS idx_disenos_responsable ON disenos(responsable_id);

CREATE TABLE IF NOT EXISTS replicas (
  id TEXT PRIMARY KEY,
  diseno_id TEXT NOT NULL REFERENCES disenos(id),
  numero INTEGER NOT NULL,
  codigo TEXT UNIQUE,
  tipo_especimen TEXT CHECK (tipo_especimen IN ('probetas','cubos')),
  elaborado_por TEXT REFERENCES usuarios(id),
  fecha_elaboracion TEXT,
  hora_contacto TEXT,
  consumo_enviado INTEGER NOT NULL DEFAULT 0,
  correo_enviado INTEGER NOT NULL DEFAULT 0,
  UNIQUE (diseno_id, numero)
);

CREATE TABLE IF NOT EXISTS resultados_fresco (
  id TEXT PRIMARY KEY,
  replica_id TEXT NOT NULL REFERENCES replicas(id),
  ensayo_id TEXT NOT NULL REFERENCES ensayos(id),
  minuto INTEGER,
  valor REAL,
  valor_texto TEXT,
  unidad TEXT,
  analista_id TEXT NOT NULL REFERENCES usuarios(id),
  metodo TEXT,
  metodo_version TEXT,
  equipo_inventario_id TEXT,
  registrado_en TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  anulado INTEGER NOT NULL DEFAULT 0,
  motivo_anulacion TEXT
);
CREATE INDEX IF NOT EXISTS idx_fresco_replica ON resultados_fresco(replica_id);

CREATE TABLE IF NOT EXISTS roturas (
  id TEXT PRIMARY KEY,
  replica_id TEXT REFERENCES replicas(id),
  codigo TEXT NOT NULL,
  producto TEXT NOT NULL,
  proyecto_id TEXT REFERENCES proyectos(id),
  a_cargo_id TEXT REFERENCES usuarios(id),
  tipo_especimen TEXT NOT NULL CHECK (tipo_especimen IN ('probetas','cubos')),
  edad_horas REAL NOT NULL,
  fecha_elaboracion TEXT,
  fecha_ensayo_programada TEXT,
  tolerancia_horas REAL,
  fecha_ensayo_real TEXT,
  analista_id TEXT REFERENCES usuarios(id),
  metodo TEXT,
  metodo_version TEXT,
  equipo_inventario_id TEXT,
  unidad_carga TEXT CHECK (unidad_carga IN ('kN','kg')),
  promedio_kgcm2 REAL,
  desviacion REAL,
  coef_variacion REAL,
  comentarios TEXT,
  manual INTEGER NOT NULL DEFAULT 0,
  anulado INTEGER NOT NULL DEFAULT 0,
  motivo_anulacion TEXT,
  UNIQUE (codigo, edad_horas)
);
CREATE INDEX IF NOT EXISTS idx_roturas_programada ON roturas(fecha_ensayo_programada);
CREATE INDEX IF NOT EXISTS idx_roturas_proyecto ON roturas(proyecto_id);

CREATE TABLE IF NOT EXISTS roturas_especimenes (
  id TEXT PRIMARY KEY,
  rotura_id TEXT NOT NULL REFERENCES roturas(id),
  especimen TEXT NOT NULL CHECK (especimen IN ('M1','M2','M3')),
  area_cm2 REAL NOT NULL DEFAULT 83,
  carga REAL,
  kgcm2 REAL,
  tipo_fractura INTEGER CHECK (tipo_fractura BETWEEN 1 AND 6),
  foto_drive_id TEXT,
  UNIQUE (rotura_id, especimen)
);

CREATE TABLE IF NOT EXISTS reportes_rr (
  id TEXT PRIMARY KEY,
  proyecto_id TEXT NOT NULL REFERENCES proyectos(id),
  iteracion TEXT,
  tipo TEXT NOT NULL CHECK (tipo IN ('promediado','detallado')),
  nombre TEXT NOT NULL,
  requisito TEXT,
  estado TEXT NOT NULL DEFAULT 'borrador' CHECK (estado IN ('borrador','en_revision','aprobado','emitido','anulado')),
  revisado_por TEXT REFERENCES usuarios(id),
  revisado_en TEXT,
  aprobado_por TEXT REFERENCES usuarios(id),
  aprobado_en TEXT,
  creado_por TEXT REFERENCES usuarios(id),
  creado_en TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS reportes_rr_items (
  reporte_id TEXT NOT NULL REFERENCES reportes_rr(id),
  nombre_unificado TEXT NOT NULL,
  orden INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (reporte_id, nombre_unificado)
);

CREATE TABLE IF NOT EXISTS planes (
  id TEXT PRIMARY KEY,
  proyecto_id TEXT NOT NULL REFERENCES proyectos(id),
  origen TEXT NOT NULL CHECK (origen IN ('generador','subido')),
  archivo_drive_id TEXT,
  mes_inicio TEXT,
  mes_fin TEXT,
  creado_por TEXT REFERENCES usuarios(id),
  creado_en TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  anulado INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS plan_items (
  id TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL REFERENCES planes(id),
  etapa TEXT NOT NULL,
  titulo TEXT NOT NULL,
  orden INTEGER NOT NULL DEFAULT 0,
  inicio TEXT NOT NULL,
  fin TEXT NOT NULL,
  marca TEXT NOT NULL DEFAULT 'ejecucion' CHECK (marca IN ('ejecucion','preliminar','reporte')),
  responsable_id TEXT REFERENCES usuarios(id),
  diseno_id TEXT REFERENCES disenos(id),
  equipos TEXT NOT NULL DEFAULT '[]',
  materiales TEXT NOT NULL DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS actividades (
  id TEXT PRIMARY KEY,
  titulo TEXT NOT NULL,
  responsable_id TEXT NOT NULL REFERENCES usuarios(id),
  proyecto_id TEXT NOT NULL REFERENCES proyectos(id),
  dia_inicio TEXT NOT NULL,
  dia_fin TEXT,
  prioridad TEXT CHECK (prioridad IN ('alta','media','baja')),
  diseno_id TEXT REFERENCES disenos(id),
  paso_diseno TEXT,
  plan_item_id TEXT REFERENCES plan_items(id),
  semana TEXT NOT NULL,
  estado TEXT NOT NULL DEFAULT 'borrador' CHECK (estado IN ('borrador','publicada','anulada')),
  hecha INTEGER NOT NULL DEFAULT 0,
  hecha_en TEXT,
  publicada_en TEXT,
  creado_por TEXT REFERENCES usuarios(id)
);
CREATE INDEX IF NOT EXISTS idx_actividades_semana ON actividades(semana, responsable_id);

CREATE TABLE IF NOT EXISTS lecturas_poza (
  id TEXT PRIMARY KEY,
  fecha TEXT NOT NULL,
  hora TEXT NOT NULL,
  temperatura REAL NOT NULL,
  registrado_por TEXT NOT NULL REFERENCES usuarios(id),
  observacion TEXT,
  anulada INTEGER NOT NULL DEFAULT 0,
  motivo_anulacion TEXT
);
CREATE INDEX IF NOT EXISTS idx_poza_fecha ON lecturas_poza(fecha);

CREATE TABLE IF NOT EXISTS trabajos_no_conformes (
  id TEXT PRIMARY KEY,
  codigo TEXT NOT NULL UNIQUE,
  origen TEXT NOT NULL CHECK (origen IN ('rotura_fuera_ventana','equipo_vencido','poza_fuera_rango','cv_alto','probeta_perdida','receta_no_registrada','otro')),
  automatico INTEGER NOT NULL DEFAULT 0,
  descripcion TEXT NOT NULL,
  estado TEXT NOT NULL DEFAULT 'abierto' CHECK (estado IN ('abierto','evaluado','decidido','cerrado')),
  evaluacion TEXT,
  decision TEXT CHECK (decision IN ('aceptar_con_nota','repetir','anular_resultado')),
  nota TEXT,
  reportado_por TEXT REFERENCES usuarios(id),
  responsable_id TEXT REFERENCES usuarios(id),
  abierto_en TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  cerrado_en TEXT,
  cerrado_por TEXT REFERENCES usuarios(id)
);

CREATE TABLE IF NOT EXISTS tnc_codigos (
  tnc_id TEXT NOT NULL REFERENCES trabajos_no_conformes(id),
  codigo_afectado TEXT NOT NULL,
  PRIMARY KEY (tnc_id, codigo_afectado)
);

CREATE TABLE IF NOT EXISTS documentos (
  id TEXT PRIMARY KEY,
  codigo TEXT NOT NULL,
  titulo TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('procedimiento','formato','instructivo','otro')),
  version TEXT NOT NULL,
  fecha TEXT NOT NULL,
  archivo_drive_id TEXT,
  vigente INTEGER NOT NULL DEFAULT 1,
  proyecto_id TEXT REFERENCES proyectos(id),
  UNIQUE (codigo, version)
);

CREATE TABLE IF NOT EXISTS historial_cambios (
  id TEXT PRIMARY KEY,
  ts TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  usuario_id TEXT,
  usuario TEXT NOT NULL,
  rol TEXT,
  accion TEXT NOT NULL,
  modulo TEXT NOT NULL,
  entidad_id TEXT,
  codigo TEXT,
  detalle TEXT,
  valor_anterior TEXT,
  valor_nuevo TEXT,
  motivo TEXT,
  proyecto TEXT
);
CREATE INDEX IF NOT EXISTS idx_historial_ts ON historial_cambios(ts);
CREATE INDEX IF NOT EXISTS idx_historial_modulo ON historial_cambios(modulo, entidad_id);
CREATE INDEX IF NOT EXISTS idx_historial_codigo ON historial_cambios(codigo);

CREATE TABLE IF NOT EXISTS cola_consumos (
  id TEXT PRIMARY KEY,
  material_inventario_id TEXT NOT NULL,
  cantidad REAL NOT NULL,
  unidad TEXT NOT NULL,
  lote TEXT,
  referencia TEXT NOT NULL,
  estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente','enviado','error')),
  intentos INTEGER NOT NULL DEFAULT 0,
  ultimo_error TEXT,
  creado_en TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
