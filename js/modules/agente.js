/* Sistema I+D — Agente I+D con Claude (API de Anthropic).
   Claude responde consultando los datos del sistema mediante herramientas (no inventa cifras):
   cada pregunta puede disparar varias consultas (diseños, roturas, proyectos, predicción, KPIs) y la
   respuesta final se arma con esos resultados. Si no hay clave configurada o no hay conexión,
   el asistente usa el motor local (asistente.js).
   La clave se guarda solo en este navegador y las llamadas van directo a la API de Anthropic. */
'use strict';

var AGENTE_MODELO = 'claude-opus-5-5';
var AGENTE_SDK_URL = 'https://cdn.jsdelivr.net/npm/@anthropic-ai/sdk@0.133.0/+esm';
var AGENTE_MAX_PASOS = 10;
var AGENTE_MAX_TURNOS = 20;
var agenteCfg = load('sid_claude_cfg', {apiKey:'', activo:true});
function saveAgenteCfg(){ save('sid_claude_cfg', agenteCfg); }
function agenteDisponible(){ return !!(agenteCfg.apiKey && agenteCfg.activo); }

var agenteSdkPromesa = null;
function cargarSdkAnthropic(){
  if(!agenteSdkPromesa){
    agenteSdkPromesa = import(AGENTE_SDK_URL).then(function(mod){ return mod.default; })
      .catch(function(e){ agenteSdkPromesa = null; throw e; });
  }
  return agenteSdkPromesa;
}
function clienteAnthropic(Anthropic){
  // Acceso directo desde el navegador: la clave es del propio usuario y vive solo en este equipo.
  return new Anthropic({apiKey: agenteCfg.apiKey, dangerouslyAllowBrowser: true, maxRetries: 2});
}

/* ================= Herramientas ================= */
var DEMO_CODIGOS = null;
function esDemo(d){
  if(!DEMO_CODIGOS){ DEMO_CODIGOS = {}; disenosDeDemostracion().forEach(function(x){ DEMO_CODIGOS[x.codigo] = true; }); }
  return !!DEMO_CODIGOS[d.codigo];
}
function redondear(v, dec){ return isFinite(v) ? +Number(v).toFixed(dec === undefined ? 1 : dec) : null; }
function resistenciasObj(d){
  var r = resistenciaPorEdad(d), out = {};
  Object.keys(r).map(Number).sort(function(a,b){ return a-b; }).forEach(function(e){ out[e + 'd'] = redondear(r[e]); });
  return out;
}
function disenoResumen(d){
  return {codigo: d.codigo, receta: d.recetaId || null, nombre: diseñoTitulo(d), proyecto: proyectoNombre(d.proyectoId) || null,
    iteracion: d.iteracionId || null, estado: d.estado, fecha: d.fecha || null, fc_kgcm2: n(d.fc) || null, amc: n(d.amcEfectiva) || null,
    cemento: tipoCementoNormalizado(d), resistencia_kgcm2_por_edad: resistenciasObj(d), demostracion: esDemo(d) || undefined};
}
function roturaResumen(c){
  return {codigo: c.codigo, replica: c.replicaNombre, diseno: c.disenoCodigoDiseno, proyecto: c.proyecto || null, edad_dias: c.dia,
    fecha_ensayo: c.fechaEnsayo, tolerancia_h: c.toleranciaHoras, estado: c.estado, resistencia_kgcm2: c.promedio ? Number(c.promedio) : null};
}
function requierePermiso(p){ if(!can(p)) throw new Error('El rol del usuario no tiene acceso a esta información.'); }
function textoObligatorio(v, campo){ if(typeof v !== 'string' || !v.trim()) throw new Error('Falta el campo "' + campo + '".'); return v.trim(); }

var AGENTE_HERRAMIENTAS = [
  {name:'buscar_registros', description:'Busca por texto en diseños (código DID-xxxx, receta R-xx o nombre), proyectos, códigos de rotura (ID-xxxx / P-ID-xxx) y materiales. Úsala primero cuando el usuario menciona algo por nombre aproximado.',
   input_schema:{type:'object', properties:{texto:{type:'string', description:'Texto a buscar'}}, required:['texto']},
   run:function(i){
     var q = normalizar(textoObligatorio(i.texto, 'texto')), out = {disenos:[], proyectos:[], roturas:[], materiales:[]};
     var tk = q.split(' ').filter(function(t){ return t.length > 1; });
     var coincide = function(){ var h = normalizar(Array.prototype.join.call(arguments, ' ')); return tk.every(function(t){ return h.indexOf(t) > -1; }); };
     if(can('ver:disenos')) disenos.forEach(function(d){ if(coincide(d.codigo, d.recetaId, diseñoTitulo(d), proyectoNombre(d.proyectoId))) out.disenos.push(disenoResumen(d)); });
     if(can('ver:proyectos')) nombresDeProyectos().forEach(function(p){ if(coincide(p)) out.proyectos.push(p); });
     if(can('ver:roturas')){ var vistos = {}; roturaCargas.forEach(function(c){ var k = c.codigo + c.replicaNombre; if(!vistos[k] && coincide(c.codigo, c.replicaNombre)){ vistos[k] = 1; out.roturas.push({codigo:c.codigo, replica:c.replicaNombre, diseno:c.disenoCodigoDiseno}); } }); }
     if(can('ver:componentes')) componentes.forEach(function(c){ if(coincide(c.nombre, c.categoria, c.sap)) out.materiales.push({nombre:c.nombre, categoria:c.categoria}); });
     out.disenos = out.disenos.slice(0, 15); out.roturas = out.roturas.slice(0, 15);
     return out;
   }},
  {name:'detalle_diseno', description:'Ficha completa de un diseño: parámetros, composición de la mezcla (kg/m³), resistencia por edad combinando réplicas, estado de roturas y ensayos en estado fresco.',
   input_schema:{type:'object', properties:{codigo:{type:'string', description:'Código DID-xxxx o receta R-xx'}}, required:['codigo']},
   run:function(i){
     requierePermiso('ver:disenos');
     var cod = textoObligatorio(i.codigo, 'codigo').toUpperCase();
     var d = disenoPorCodigo(cod) || disenos.filter(function(x){ return (x.recetaId || '').toUpperCase() === cod; })[0];
     if(!d) return {error: 'No existe un diseño con código ' + cod};
     var cs = cargasDeDiseno(d);
     var fresco = ((d.resultados && d.resultados.replicas) || []).map(function(r, k){
       return {replica: k + 1, peso_unitario: r.pesoUnitario || null, aire_pct: r.aire || null, fragua_inicial: r.thermoIni || null, fragua_final: r.thermoFin || null,
         slump: (r.slump || []).filter(function(s){ return s.slump; }).map(function(s){ return s.hora + "': " + s.slump; })};
     });
     return Object.assign(disenoResumen(d), {planta: d.planta || null, colaborador: d.colaborador || null, responsable: d.responsable || null,
       tipo_concreto: d.tipo || null, cvd_soles: n(d.cvdTotal) || null,
       mezcla_kg_m3: (d.mix || []).filter(function(m){ return n(m.pesoSeco) > 0; }).map(function(m){ return {material: m.nombre, peso_seco: redondear(m.pesoSeco, 2)}; }),
       roturas: {total: cs.length, registradas: cs.filter(function(c){ return c.estado === 'completado'; }).length, pendientes: cs.filter(function(c){ return c.estado === 'pendiente'; }).length},
       ensayos_estado_fresco: fresco});
   }},
  {name:'resumen_proyecto', description:'Resumen de un proyecto: estado, iteraciones, diseños con su resistencia por edad, avance de roturas, vencidas y próxima rotura.',
   input_schema:{type:'object', properties:{nombre:{type:'string', description:'Nombre del proyecto (exacto o aproximado)'}}, required:['nombre']},
   run:function(i){
     requierePermiso('ver:proyectos');
     var q = normalizar(textoObligatorio(i.nombre, 'nombre'));
     var nombres = nombresDeProyectos();
     var p = nombres.filter(function(x){ return normalizar(x) === q; })[0] || nombres.filter(function(x){ return normalizar(x).indexOf(q) > -1 || q.indexOf(normalizar(x)) > -1; })[0];
     if(!p) return {error: 'No hay un proyecto llamado "' + i.nombre + '"', proyectos_existentes: nombres};
     var m = metricasProyecto(p);
     return {proyecto: p, estado: m.estado, iteraciones: m.iteraciones, disenos: m.nDisenos, completados: m.completados,
       roturas_registradas: m.cargasCompletas, roturas_totales: m.cargas.length, vencidas: m.vencidas, proxima_rotura: m.proximaRotura || null,
       resistencia_maxima_kgcm2: redondear(m.resistMax), cvd_promedio_soles: redondear(m.costoProm, 2),
       lista_disenos: m.disenos.map(disenoResumen)};
   }},
  {name:'listar_disenos', description:'Lista diseños con filtros opcionales. Devuelve resistencia por edad de cada uno.',
   input_schema:{type:'object', properties:{
     proyecto:{type:'string', description:'Filtra por proyecto (texto aproximado)'},
     estado:{type:'string', enum:['Iniciado','En desarrollo','Completado']},
     cemento:{type:'string', enum:['I','HE']},
     amc_min:{type:'number'}, amc_max:{type:'number'},
     incluir_demostracion:{type:'boolean', description:'Incluir diseños de demostración (por defecto no)'},
     limite:{type:'integer', description:'Máximo de resultados (por defecto 30)'}}},
   run:function(i){
     requierePermiso('ver:disenos');
     var lista = disenos.filter(function(d){
       if(!i.incluir_demostracion && esDemo(d)) return false;
       if(i.proyecto && normalizar(proyectoNombre(d.proyectoId)).indexOf(normalizar(i.proyecto)) === -1) return false;
       if(i.estado && d.estado !== i.estado) return false;
       if(i.cemento && tipoCementoNormalizado(d) !== i.cemento) return false;
       var a = n(d.amcEfectiva);
       if(isFinite(i.amc_min) && a < i.amc_min) return false;
       if(isFinite(i.amc_max) && a > i.amc_max) return false;
       return true;
     });
     return {total: lista.length, disenos: lista.slice(0, Math.min(60, i.limite || 30)).map(disenoResumen)};
   }},
  {name:'consultar_roturas', description:'Roturas (ensayos de compresión) programadas: para hoy, mañana, esta semana, vencidas o todas las pendientes. La fecha de hoy está en el contexto.',
   input_schema:{type:'object', properties:{
     filtro:{type:'string', enum:['hoy','manana','esta_semana','proximos_7_dias','vencidas','pendientes']},
     proyecto:{type:'string', description:'Opcional: filtra por proyecto'}}, required:['filtro']},
   run:function(i){
     requierePermiso('ver:roturas');
     var hoy = todayISO(), lun = lunesDe(hoy), dom = addDaysISO(lun, 6), en7 = addDaysISO(hoy, 7), man = addDaysISO(hoy, 1);
     var lista = roturaCargas.filter(function(c){
       if(i.proyecto && normalizar(c.proyecto).indexOf(normalizar(i.proyecto)) === -1) return false;
       var pend = c.estado === 'pendiente';
       switch(i.filtro){
         case 'hoy': return pend && c.fechaEnsayo === hoy;
         case 'manana': return pend && c.fechaEnsayo === man;
         case 'esta_semana': return c.fechaEnsayo >= lun && c.fechaEnsayo <= dom;
         case 'proximos_7_dias': return pend && c.fechaEnsayo >= hoy && c.fechaEnsayo <= en7;
         case 'vencidas': return pend && c.fechaEnsayo < hoy;
         default: return pend;
       }
     }).sort(function(a, b){ return a.fechaEnsayo.localeCompare(b.fechaEnsayo); });
     return {hoy: hoy, total: lista.length, pendientes: lista.filter(function(c){ return c.estado === 'pendiente'; }).length, roturas: lista.slice(0, 40).map(roturaResumen)};
   }},
  {name:'ranking_resistencia', description:'Diseños ordenados por resistencia a una edad (o por la máxima alcanzada si no se indica edad). Excluye diseños de demostración salvo que se pida.',
   input_schema:{type:'object', properties:{edad:{type:'integer', description:'Edad en días (1, 3, 7, 28…)'}, proyecto:{type:'string'}, orden:{type:'string', enum:['mayor','menor']},
     limite:{type:'integer'}, incluir_demostracion:{type:'boolean'}}},
   run:function(i){
     requierePermiso('ver:disenos');
     var lista = disenos.filter(function(d){ return (i.incluir_demostracion || !esDemo(d)) && (!i.proyecto || normalizar(proyectoNombre(d.proyectoId)).indexOf(normalizar(i.proyecto)) > -1); })
       .map(function(d){ var r = resistenciaPorEdad(d); return {d: d, v: i.edad ? r[i.edad] : resistenciaMaxima(d)}; })
       .filter(function(x){ return isFinite(x.v); })
       .sort(function(a, b){ return i.orden === 'menor' ? a.v - b.v : b.v - a.v; });
     return {criterio: i.edad ? 'resistencia a ' + i.edad + ' días' : 'resistencia máxima alcanzada', total: lista.length,
       ranking: lista.slice(0, Math.min(20, i.limite || 10)).map(function(x){ return Object.assign(disenoResumen(x.d), {valor_kgcm2: redondear(x.v)}); })};
   }},
  {name:'comparar_disenos', description:'Compara dos o más diseños: parámetros, mezcla y resistencia por edad lado a lado.',
   input_schema:{type:'object', properties:{codigos:{type:'array', items:{type:'string'}, description:'Códigos DID-xxxx o recetas R-xx'}}, required:['codigos']},
   run:function(i){
     if(!Array.isArray(i.codigos) || i.codigos.length < 2) throw new Error('Indicá al menos dos códigos.');
     return {disenos: i.codigos.slice(0, 8).map(function(c){ return AGENTE_HERRAMIENTAS[1].run({codigo: String(c)}); })};
   }},
  {name:'predecir_resistencia', description:'Estima la resistencia a la compresión de un diseño nuevo con el modelo entrenado sobre la base histórica real. Devuelve el valor, la curva por edad, el error esperado (validado con diseños no vistos) y avisos si los datos están fuera del rango conocido.',
   input_schema:{type:'object', properties:{amc:{type:'number', description:'Relación agua/material cementante, ej. 0.55'}, cemento:{type:'string', enum:['I','HE']},
     cementante_kg:{type:'number', description:'Cemento + adiciones en kg/m³ (por defecto 350)'}, fly_ash_pct:{type:'number', description:'% de fly ash sobre el cementante (por defecto 0)'},
     aditivo_pct:{type:'number', description:'% de aditivo sobre el cementante (por defecto 1)'}, edad:{type:'integer', description:'Edad en días (por defecto 28)'}}, required:['amc','cemento']},
   run:function(i){
     requierePermiso('ver:prediccion');
     if(!(i.amc > 0 && i.amc < 2)) throw new Error('a/mc fuera de rango.');
     var r = predecirResistencia({amc: i.amc, cemento: i.cemento, cementante: i.cementante_kg || 350, flyAshPct: i.fly_ash_pct || 0, aditivoPct: i.aditivo_pct === undefined ? 1 : i.aditivo_pct, edad: i.edad || 28});
     if(r.error) return {error: r.error};
     return {resistencia_kgcm2: r.valor, edad_dias: i.edad || 28, error_esperado_kgcm2: redondear(r.mae), modelo: r.modelo.nombre,
       entrenado_con: r.modelo.disenos + ' diseños reales, ' + r.modelo.filas + ' resultados', curva: r.curva, fuera_de_rango: r.fueraDeRango};
   }},
  {name:'proyectar_diseno', description:'Proyecta la resistencia a 28, 56 y 90 días de un diseño existente usando sus roturas ya registradas (curva de madurez) y el modelo histórico, con la precisión histórica de cada método.',
   input_schema:{type:'object', properties:{codigo:{type:'string'}}, required:['codigo']},
   run:function(i){
     requierePermiso('ver:prediccion');
     var d = disenoPorCodigo(textoObligatorio(i.codigo, 'codigo').toUpperCase()) || disenos.filter(function(x){ return (x.recetaId || '').toUpperCase() === String(i.codigo).toUpperCase(); })[0];
     if(!d) return {error: 'No existe el diseño ' + i.codigo};
     var aj = ajusteMadurez(d), pm = prediccionModeloDiseno(d, 28), bt = backtestMadurez();
     return {diseno: disenoResumen(d), fc_kgcm2: n(d.fc) || null,
       curva_madurez: aj ? {metodo: aj.metodo, '28d': redondear(aj.predecir(28)), '56d': redondear(aj.predecir(56)), '90d': redondear(aj.predecir(90)), error_historico_kgcm2: bt.metricas ? redondear(bt.metricas.mae) : null} : 'sin roturas registradas',
       modelo_historico: pm ? {'28d': pm.valor, error_esperado_kgcm2: redondear(pm.mae), modelo: pm.modelo.nombre} : null};
   }},
  {name:'kpis_laboratorio', description:'Indicadores generales: diseños, % completados, roturas pendientes y vencidas, resistencia promedio a 28 d, cumplimiento de f\'c, proyectos activos.',
   input_schema:{type:'object', properties:{}},
   run:function(){
     requierePermiso('ver:reportes');
     var hoy = todayISO(), reales = disenos.filter(function(d){ return !esDemo(d); });
     var k = kpisCalidad(reales);
     return {disenos_reales: reales.length, disenos_demostracion: disenos.length - reales.length,
       completados_pct: reales.length ? Math.round(reales.filter(function(d){ return d.estado === 'Completado'; }).length / reales.length * 100) : 0,
       roturas_pendientes: roturaCargas.filter(function(c){ return c.estado === 'pendiente'; }).length,
       roturas_vencidas: roturaCargas.filter(function(c){ return c.estado === 'pendiente' && c.fechaEnsayo < hoy; }).length,
       resistencia_promedio_28d_kgcm2: redondear(k.r28), cumplimiento_fc_28d_pct: isFinite(k.cumplimiento) ? k.cumplimiento : null,
       disenos_evaluados_fc: k.evaluados, proyectos_en_curso: metricasTodosLosProyectos().filter(function(m){ return m.estado === 'En curso'; }).length};
   }},
  {name:'listar_componentes', description:'Materiales registrados (cemento, adición, agua, pigmento, piedra, arena, aditivo) con sus propiedades.',
   input_schema:{type:'object', properties:{categoria:{type:'string', enum:['Cemento','Adición','Agua','Pigmento','Piedra','Arena','Aditivo']}}},
   run:function(i){
     requierePermiso('ver:componentes');
     return {materiales: componentes.filter(function(c){ return !i.categoria || c.categoria === i.categoria; }).map(function(c){
       var o = {}; Object.keys(c).forEach(function(k){ if(c[k] && c[k] !== '-') o[k] = c[k]; }); return o; })};
   }},
  {name:'estudios_rr', description:'Estudios del Reporte RR (comparativos de mezclas de prueba) con su tabla de resistencia por edad.',
   input_schema:{type:'object', properties:{proyecto:{type:'string'}}},
   run:function(i){
     requierePermiso('ver:reporte-rr');
     return {estudios: rrEstudios.filter(function(e){ return !i.proyecto || normalizar(proyectoNombre(e.proyectoId) || e.nombre).indexOf(normalizar(i.proyecto)) > -1; }).map(function(e){
       return {nombre: e.nombre, fecha: e.fecha, proyecto: e.proyectoId ? proyectoNombre(e.proyectoId) : null, disenos: e.tipos.map(function(t){ return t.nombre + (t.origenDisenoCodigo ? ' (' + t.origenDisenoCodigo + ')' : ''); }),
         resistencia_por_edad: e.edades.map(function(ed){ var o = {edad: ed.edad}; e.tipos.forEach(function(t){ o[t.nombre] = ed.valores[t.id] === '' ? null : Number(ed.valores[t.id]); }); return o; })};
     })};
   }},
  {name:'consultar_historial', description:'Movimientos recientes del sistema (quién hizo qué y cuándo).',
   input_schema:{type:'object', properties:{proyecto:{type:'string'}, usuario:{type:'string'}, limite:{type:'integer'}}},
   run:function(i){
     requierePermiso('ver:historial');
     return {movimientos: historial.filter(function(h){
       return (!i.proyecto || normalizar(h.proyecto).indexOf(normalizar(i.proyecto)) > -1) && (!i.usuario || normalizar(h.usuario) === normalizar(i.usuario));
     }).slice(0, Math.min(50, i.limite || 20)).map(function(h){ return {fecha: fechaHora(h.ts), usuario: h.usuario, accion: h.accion, entidad: h.entidad, detalle: h.detalle}; })};
   }},
  {name:'abrir_seccion', description:'Abre una sección del sistema en pantalla para el usuario (acceso directo). Úsala cuando el usuario pida ir o abrir algo.',
   input_schema:{type:'object', properties:{seccion:{type:'string', enum:PANELES.map(function(p){ return p.id; })}, proyecto:{type:'string', description:'Para abrir el expediente de un proyecto'}}, required:['seccion']},
   run:function(i){
     if(!can('ver:' + i.seccion)) return {error: 'El rol del usuario no tiene acceso a esa sección.'};
     setTimeout(function(){
       if(i.seccion === 'proyectos' && i.proyecto) abrirExpediente(nombresDeProyectos().filter(function(p){ return normalizar(p).indexOf(normalizar(i.proyecto)) > -1; })[0] || i.proyecto);
       else { showPanel(i.seccion); if(i.seccion === 'disenos') showSubTab('historico'); }
     }, 600);
     return {ok: true, abierta: panelInfo(i.seccion).label};
   }}
];
var AGENTE_TOOLS_API = AGENTE_HERRAMIENTAS.map(function(t){ return {name: t.name, description: t.description, input_schema: t.input_schema}; });

var AGENTE_SISTEMA = [
  'Eres el Asistente I+D del Laboratorio I+D (Gestión de Calidad, Cementos Pacasmayo). Ayudas a técnicos y jefatura con diseños de mezcla de concreto, roturas (ensayos de compresión NTP 339.034), proyectos, Reporte RR y predicciones.',
  '',
  'Reglas:',
  '- Toda cifra, código, fecha o nombre que menciones debe salir de las herramientas. No inventes ni completes datos; si una herramienta no trae algo, dilo claramente.',
  '- Cuando el usuario mencione algo por nombre aproximado, usa primero buscar_registros para identificarlo.',
  '- Resistencia en kg/cm² (f\'c, a/mc = relación agua/material cementante). Cita los códigos (DID-xxxx, ID-xxxx) y el proyecto.',
  '- Los diseños marcados con demostracion: true son datos de ejemplo, no reales: no los uses en conclusiones salvo que el usuario lo pida, y avisa si aparecen.',
  '- Para predicciones, da siempre el error esperado del modelo y advierte si los datos están fuera del rango con el que fue entrenado. Presenta el resultado como estimación, no como valor medido.',
  '- Para comparar varios diseños o edades usa una tabla en Markdown. Sé breve: primero la respuesta directa, luego el detalle necesario.',
  '- Si la pregunta no se puede responder con los datos del sistema, dilo y sugiere dónde buscar.',
  '- Responde en español neutro y profesional.'
].join('\n');

/* ================= Conversación ================= */
var agenteMensajes = [];
var agenteOcupado = false;
function contextoUsuario(){
  var hoy = new Date();
  return '[Contexto: hoy es ' + DIA_NOMBRES[hoy.getDay()] + ' ' + isoToDMY(todayISO()) + '. Usuario: ' + (usuarioActual ? (usuarioActual.nombre || usuarioActual.usuario) + ', rol ' + rolLabel(usuarioActual.rol) : 'sin sesión') + '.]';
}
function nuevaConversacionAgente(){ agenteMensajes = []; }
function ejecutarHerramienta(bloque){
  var def = AGENTE_HERRAMIENTAS.filter(function(t){ return t.name === bloque.name; })[0];
  if(!def) return {type:'tool_result', tool_use_id: bloque.id, is_error: true, content: 'Herramienta desconocida: ' + bloque.name};
  try{
    var entrada = (bloque.input && typeof bloque.input === 'object') ? bloque.input : {};
    var res = def.run(entrada);
    var texto = JSON.stringify(res);
    if(texto.length > 60000) texto = texto.slice(0, 60000) + '…(recortado)';
    return {type:'tool_result', tool_use_id: bloque.id, content: texto};
  }catch(e){
    return {type:'tool_result', tool_use_id: bloque.id, is_error: true, content: e.message || String(e)};
  }
}
var NOMBRES_PASOS = {buscar_registros:'Buscando en los registros', detalle_diseno:'Leyendo la ficha del diseño', resumen_proyecto:'Revisando el proyecto',
  listar_disenos:'Filtrando diseños', consultar_roturas:'Consultando roturas', ranking_resistencia:'Ordenando por resistencia', comparar_disenos:'Comparando diseños',
  predecir_resistencia:'Estimando con el modelo', proyectar_diseno:'Proyectando resistencia', kpis_laboratorio:'Calculando indicadores', listar_componentes:'Revisando materiales',
  estudios_rr:'Leyendo el Reporte RR', consultar_historial:'Revisando el historial', abrir_seccion:'Abriendo la sección'};

/* Una pregunta: ciclo pedir → ejecutar herramientas → devolver resultados, hasta que Claude termina. */
function preguntarAgente(texto, alPaso){
  if(agenteMensajes.filter(function(m){ return m.role === 'user' && typeof m.content === 'string'; }).length >= AGENTE_MAX_TURNOS){
    agenteMensajes = [];
    if(alPaso) alPaso('Se inició una conversación nueva (se alcanzó el máximo de preguntas seguidas).');
  }
  var primero = !agenteMensajes.length;
  agenteMensajes.push({role:'user', content: (primero ? contextoUsuario() + '\n\n' : '') + texto});
  DEMO_CODIGOS = null;
  return cargarSdkAnthropic().then(function(Anthropic){
    var client = clienteAnthropic(Anthropic);
    var pasos = 0;
    function paso(){
      if(pasos++ >= AGENTE_MAX_PASOS) return Promise.resolve({texto: 'Se alcanzó el máximo de consultas para esta pregunta. Probá reformularla de forma más concreta.'});
      return client.beta.messages.create({
        model: AGENTE_MODELO,
        max_tokens: 16000,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        output_config: {effort: 'medium'},
        cache_control: {type: 'ephemeral'},
        system: AGENTE_SISTEMA,
        tools: AGENTE_TOOLS_API,
        messages: agenteMensajes
      }).then(function(resp){
        // Historial solo se agrega (nunca se edita) y se guarda el contenido completo, incluidos los bloques de razonamiento.
        agenteMensajes.push({role:'assistant', content: resp.content});
        if(resp.stop_reason === 'refusal') return {texto: 'El modelo no pudo responder esta consulta. Probá reformularla.'};
        if(resp.stop_reason === 'pause_turn') return paso();
        var usos = resp.content.filter(function(b){ return b.type === 'tool_use'; });
        if(resp.stop_reason === 'tool_use' && usos.length){
          if(alPaso) alPaso(usos.map(function(u){ return NOMBRES_PASOS[u.name] || u.name; }).join(' · ') + '…');
          agenteMensajes.push({role:'user', content: usos.map(ejecutarHerramienta)});
          return paso();
        }
        var textoFinal = resp.content.filter(function(b){ return b.type === 'text'; }).map(function(b){ return b.text; }).join('\n\n').trim();
        if(resp.stop_reason === 'max_tokens') textoFinal += '\n\n_(La respuesta se cortó por longitud.)_';
        return {texto: textoFinal || 'No obtuve una respuesta.', uso: resp.usage};
      });
    }
    return paso();
  }).catch(function(err){
    // Se descarta la pregunta sin respuesta para que el historial quede consistente.
    while(agenteMensajes.length && agenteMensajes[agenteMensajes.length - 1].role !== 'assistant') agenteMensajes.pop();
    var Anthropic = null;
    return cargarSdkAnthropic().then(function(A){ Anthropic = A; }, function(){}).then(function(){ throw traducirErrorAgente(err, Anthropic); });
  });
}
function traducirErrorAgente(err, Anthropic){
  var e = new Error('No se pudo consultar al agente.');
  e.local = true;
  if(Anthropic){
    if(err instanceof Anthropic.AuthenticationError){ e.message = 'La clave de API no es válida. Revisala en Ajustes → Asistente con IA.'; e.local = false; }
    else if(err instanceof Anthropic.PermissionDeniedError){ e.message = 'La clave no tiene permiso para usar el modelo.'; e.local = false; }
    else if(err instanceof Anthropic.RateLimitError){ e.message = 'Se alcanzó el límite de uso de la API. Esperá un momento e intentá de nuevo.'; }
    else if(err instanceof Anthropic.BadRequestError){ e.message = 'La API rechazó la consulta (' + (err.message || '400') + ').'; }
    else if(err instanceof Anthropic.APIConnectionError){ e.message = 'Sin conexión con la API de Anthropic.'; }
    else if(err instanceof Anthropic.APIError){ e.message = 'Error de la API (' + (err.status || '') + ').'; }
  } else {
    e.message = 'No se pudo cargar la librería de Anthropic (¿sin internet?).';
  }
  return e;
}

/* ================= Formato de la respuesta (Markdown simple y seguro) ================= */
function mdEnLinea(s){
  return s.replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
    .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<i>$2</i>')
    .replace(/_([^_]+)_/g, '<i>$1</i>')
    .replace(/\b(DID-\d{4})\b/g, '<button class="chat-codigo" data-chat-informe="$1">$1</button>');
}
function markdownAHtml(md){
  var lineas = esc(md).split('\n'), html = [], i = 0;
  while(i < lineas.length){
    var l = lineas[i];
    if(/^\s*\|.*\|\s*$/.test(l) && i + 1 < lineas.length && /^\s*\|?\s*:?-{2,}/.test(lineas[i + 1])){
      var celdas = function(x){ return x.trim().replace(/^\||\|$/g, '').split('|').map(function(c){ return mdEnLinea(c.trim()); }); };
      var cab = celdas(l); i += 2;
      var filas = [];
      while(i < lineas.length && /^\s*\|.*\|\s*$/.test(lineas[i])){ filas.push(celdas(lineas[i])); i++; }
      html.push('<div class="table-scroll"><table class="data-table chat-tabla"><thead><tr>' + cab.map(function(c){ return '<th>' + c + '</th>'; }).join('') + '</tr></thead><tbody>' +
        filas.map(function(f){ return '<tr>' + f.map(function(c){ return '<td>' + c + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div>');
      continue;
    }
    if(/^\s*([-*•]|\d+[.)])\s+/.test(l)){
      var ordenada = /^\s*\d+[.)]/.test(l), items = [];
      while(i < lineas.length && /^\s*([-*•]|\d+[.)])\s+/.test(lineas[i])){ items.push(mdEnLinea(lineas[i].replace(/^\s*([-*•]|\d+[.)])\s+/, ''))); i++; }
      html.push((ordenada ? '<ol' : '<ul') + ' class="chat-lista">' + items.map(function(x){ return '<li>' + x + '</li>'; }).join('') + (ordenada ? '</ol>' : '</ul>'));
      continue;
    }
    var h = l.match(/^\s*#{1,4}\s+(.*)$/);
    if(h){ html.push('<p class="chat-h"><b>' + mdEnLinea(h[1]) + '</b></p>'); i++; continue; }
    if(!l.trim()){ i++; continue; }
    var parrafo = [];
    while(i < lineas.length && lineas[i].trim() && !/^\s*([-*•]|\d+[.)])\s+/.test(lineas[i]) && !/^\s*\|/.test(lineas[i]) && !/^\s*#{1,4}\s/.test(lineas[i])){ parrafo.push(mdEnLinea(lineas[i])); i++; }
    html.push('<p>' + parrafo.join('<br>') + '</p>');
  }
  return html.join('');
}
