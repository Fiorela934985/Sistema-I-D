CREATE TABLE IF NOT EXISTS registros (
  coleccion TEXT NOT NULL,
  id TEXT NOT NULL,
  proyecto TEXT,
  codigo TEXT,
  datos TEXT NOT NULL,
  anulado INTEGER NOT NULL DEFAULT 0,
  version INTEGER NOT NULL DEFAULT 1,
  actualizado_por TEXT REFERENCES usuarios(id),
  actualizado_en TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (coleccion, id)
);
CREATE INDEX IF NOT EXISTS idx_registros_proyecto ON registros(coleccion, proyecto);
