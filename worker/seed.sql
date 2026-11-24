INSERT OR IGNORE INTO ensayos (id, codigo, nombre, etapa, metodo, version, unidades, campos) VALUES
('ens-granulometria','GRA','Análisis granulométrico de agregados','caracterizacion','NTP 400.012','2013','%','[{"clave":"modulo_finura","etiqueta":"Módulo de finura","unidad":"","tipo":"numero"},{"clave":"tmn","etiqueta":"Tamaño máximo nominal","unidad":"pulg","tipo":"texto"}]'),
('ens-pe-grueso','PEG','Peso específico y absorción del agregado grueso','caracterizacion','NTP 400.021','2013','g/cm³ · %','[{"clave":"peso_especifico","etiqueta":"Peso específico","unidad":"g/cm³","tipo":"numero"},{"clave":"absorcion","etiqueta":"Absorción","unidad":"%","tipo":"numero"}]'),
('ens-pe-fino','PEF','Peso específico y absorción del agregado fino','caracterizacion','NTP 400.022','2013','g/cm³ · %','[{"clave":"peso_especifico","etiqueta":"Peso específico","unidad":"g/cm³","tipo":"numero"},{"clave":"absorcion","etiqueta":"Absorción","unidad":"%","tipo":"numero"}]'),
('ens-pu-agregado','PUA','Peso unitario y vacíos de los agregados','caracterizacion','NTP 400.017','2011','kg/m³','[{"clave":"pu_suelto","etiqueta":"P.U. suelto","unidad":"kg/m³","tipo":"numero"},{"clave":"pu_compactado","etiqueta":"P.U. compactado","unidad":"kg/m³","tipo":"numero"}]'),
('ens-humedad','HUM','Contenido de humedad total de agregados','caracterizacion','NTP 339.185','2013','%','[{"clave":"humedad","etiqueta":"Humedad","unidad":"%","tipo":"numero"}]'),
('ens-diseno','DIS','Diseño de mezcla de concreto','diseno','D-CC-F-148 (ACI 211.1)','1','kg/m³','[]'),
('ens-elaboracion','ELA','Elaboración y curado de especímenes','elaboracion','NTP 339.033','2015','','[{"clave":"hora_contacto","etiqueta":"Hora de contacto (0'')","unidad":"","tipo":"texto"}]'),
('ens-slump','SLU','Asentamiento (slump)','fresco','NTP 339.035','2015','pulg','[{"clave":"min_0","etiqueta":"0 min","unidad":"pulg","tipo":"numero"},{"clave":"min_30","etiqueta":"30 min","unidad":"pulg","tipo":"numero"},{"clave":"min_60","etiqueta":"60 min","unidad":"pulg","tipo":"numero"},{"clave":"min_90","etiqueta":"90 min","unidad":"pulg","tipo":"numero"},{"clave":"min_120","etiqueta":"120 min","unidad":"pulg","tipo":"numero"}]'),
('ens-temp-concreto','TCO','Temperatura del concreto','fresco','NTP 339.184','2013','°C','[{"clave":"temperatura","etiqueta":"T° del concreto","unidad":"°C","tipo":"numero"}]'),
('ens-temp-ambiente','TAM','Temperatura ambiente','fresco','NTP 339.184','2013','°C','[{"clave":"temperatura","etiqueta":"T° ambiente","unidad":"°C","tipo":"numero"}]'),
('ens-pu-concreto','PUC','Peso unitario del concreto','fresco','NTP 339.046','2008','kg/m³','[{"clave":"peso_unitario","etiqueta":"Peso unitario","unidad":"kg/m³","tipo":"numero"}]'),
('ens-aire','AIR','Contenido de aire (método de presión)','fresco','NTP 339.083','2003','%','[{"clave":"aire","etiqueta":"Aire","unidad":"%","tipo":"numero"}]'),
('ens-fragua','FRA','Tiempo de fragua','fresco','NTP 339.082','2011','h:min','[{"clave":"inicial","etiqueta":"Fragua inicial","unidad":"h:min","tipo":"texto"},{"clave":"final","etiqueta":"Fragua final","unidad":"h:min","tipo":"texto"}]'),
('ens-cohesividad','COH','Cohesividad y apariencia','fresco','Inspección visual','1','','[{"clave":"cohesividad","etiqueta":"Cohesividad","unidad":"","tipo":"texto"},{"clave":"apariencia","etiqueta":"Apariencia","unidad":"","tipo":"texto"}]'),
('ens-compresion','RCP','Resistencia a la compresión en probetas cilíndricas','endurecido','NTP 339.034','2015','kg/cm²','[{"clave":"carga","etiqueta":"Carga","unidad":"kN","tipo":"numero"},{"clave":"area","etiqueta":"Área","unidad":"cm²","tipo":"numero"},{"clave":"tipo_fractura","etiqueta":"Tipo de fractura (1–6)","unidad":"","tipo":"numero"}]'),
('ens-compresion-cubos','RCC','Resistencia a la compresión en cubos','endurecido','NTP 334.051','2013','kg/cm²','[{"clave":"carga","etiqueta":"Carga","unidad":"kN","tipo":"numero"},{"clave":"area","etiqueta":"Área","unidad":"cm²","tipo":"numero"}]');

INSERT OR IGNORE INTO flujos (id, tipo_proyecto, descripcion, edades_defecto, pasos) VALUES
('flu-concreto','Concreto (nuevo producto)','Diseño de mezcla con estado fresco y roturas','[1,3,7,28]','[{"id":"agregados","nombre":"Agregados","ensayos":["ens-granulometria","ens-pe-grueso","ens-pe-fino","ens-pu-agregado","ens-humedad"]},{"id":"diseno","nombre":"Diseño","ensayos":["ens-diseno"]},{"id":"elaboracion","nombre":"Elaboración","ensayos":["ens-elaboracion"]},{"id":"fresco","nombre":"Estado fresco","ensayos":["ens-slump","ens-temp-concreto","ens-temp-ambiente","ens-pu-concreto","ens-aire","ens-fragua","ens-cohesividad"]},{"id":"endurecido","nombre":"Estado endurecido","ensayos":["ens-compresion"]}]'),
('flu-scm','SCM','Materiales cementantes suplementarios en cubos de mortero','[3,7,28]','[{"id":"diseno","nombre":"Diseño","ensayos":["ens-diseno"]},{"id":"elaboracion","nombre":"Elaboración","ensayos":["ens-elaboracion"]},{"id":"fresco","nombre":"Estado fresco","ensayos":["ens-temp-ambiente","ens-fragua"]},{"id":"endurecido","nombre":"Estado endurecido","ensayos":["ens-compresion-cubos"]}]'),
('flu-aditivos','Aditivos','Concreto con aditivo: retención de slump y resistencia','[1,3,7,28]','[{"id":"agregados","nombre":"Agregados","ensayos":["ens-granulometria","ens-humedad"]},{"id":"diseno","nombre":"Diseño","ensayos":["ens-diseno"]},{"id":"elaboracion","nombre":"Elaboración","ensayos":["ens-elaboracion"]},{"id":"fresco","nombre":"Estado fresco","ensayos":["ens-slump","ens-temp-concreto","ens-temp-ambiente","ens-aire","ens-fragua"]},{"id":"endurecido","nombre":"Estado endurecido","ensayos":["ens-compresion"]}]'),
('flu-adhesivos','Adhesivos','Adhesivos cementantes en cubos','[1,7,28]','[{"id":"elaboracion","nombre":"Elaboración","ensayos":["ens-elaboracion"]},{"id":"fresco","nombre":"Estado fresco","ensayos":["ens-cohesividad"]},{"id":"endurecido","nombre":"Estado endurecido","ensayos":["ens-compresion-cubos"]}]');

INSERT OR IGNORE INTO tolerancias (id, edad_horas, etiqueta, tolerancia_horas) VALUES
('tol-24h',24,'24 h',0.5),
('tol-3d',72,'3 d',2),
('tol-7d',168,'7 d',6),
('tol-28d',672,'28 d',20),
('tol-90d',2160,'90 d',48);

INSERT OR IGNORE INTO configuracion (clave, valor) VALUES
('tolerancia_otras_pct','2'),
('poza_min','21'),
('poza_max','25'),
('poza_objetivo','23'),
('area_defecto_cm2','83'),
('cv_alerta_pct','10'),
('agregados_modo','lote_compartido'),
('semanas_corte_mes','partir'),
('kn_a_kgf','101.9716'),
('doc_formato_disenos','D-CC-F-148 · v1'),
('doc_formato_fresco','Código por definir'),
('doc_formato_roturas','Código por definir'),
('doc_formato_cargas','Código por definir'),
('doc_formato_rr','Código por definir');

INSERT OR IGNORE INTO permisos_rol (rol, permiso) VALUES
('admin','config:laboratorio'),('admin','personal:autorizar'),('admin','proyectos:editar'),('admin','planes:gestionar'),('admin','actividades:publicar'),('admin','disenos:crear'),('admin','disenos:eliminar'),('admin','resultados:registrar'),('admin','roturas:registrar'),('admin','roturas:eliminar'),('admin','informes:aprobar'),('admin','tnc:cerrar'),('admin','tnc:reportar'),('admin','inicio:equipo'),('admin','componentes:editar'),('admin','rr:editar'),('admin','evidencias:subir'),('admin','datos:exportar'),('admin','datos:respaldo'),
('lider','personal:autorizar'),('lider','proyectos:editar'),('lider','planes:gestionar'),('lider','actividades:publicar'),('lider','disenos:crear'),('lider','disenos:eliminar'),('lider','resultados:registrar'),('lider','roturas:registrar'),('lider','roturas:eliminar'),('lider','informes:aprobar'),('lider','tnc:cerrar'),('lider','tnc:reportar'),('lider','inicio:equipo'),('lider','componentes:editar'),('lider','rr:editar'),('lider','evidencias:subir'),('lider','datos:exportar'),
('tecnico','disenos:crear'),('tecnico','resultados:registrar'),('tecnico','roturas:registrar'),('tecnico','tnc:reportar'),('tecnico','componentes:editar'),('tecnico','rr:editar'),('tecnico','evidencias:subir');
