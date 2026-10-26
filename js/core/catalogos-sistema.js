/* Sistema I+D — Catálogos del sistema (RF-CAT-01/02) y ajustes generales (RF-AJU-01).
   Los valores iniciales son los que ya usa el sistema de inventario (equipos, puestos, laboratorios),
   para que al unir los dos sistemas coincidan. Un valor en uso no se borra: se desactiva. */
'use strict';

var CATALOGO_DEFS = [
  {id:'laboratorios', label:'Laboratorios', desc:'Sedes con laboratorio I+D.'},
  {id:'empresas', label:'Empresas', desc:'Empresas del grupo.'},
  {id:'equipos', label:'Equipos de trabajo', desc:'Definen qué proyectos ve cada persona.'},
  {id:'puestos', label:'Puestos', desc:'Puestos del organigrama; cada uno propone un rol.'},
  {id:'plantas', label:'Plantas', desc:'Plantas donde se elaboran mezclas.'},
  {id:'ceco', label:'CECO', desc:'Centros de costo para el presupuesto del proyecto.'},
  {id:'proveedores', label:'Proveedores', desc:'Proveedores de materiales.'},
  {id:'canteras', label:'Canteras', desc:'Canteras de agregados.'},
  {id:'procedencias', label:'Procedencias', desc:'Procedencia de materiales.'},
  {id:'tiposFalla', label:'Tipos de falla', desc:'Tipos de fractura 1–6 (NTP 339.034).'},
  {id:'cohesividad', label:'Cohesividad', desc:'Lista para el ensayo en fresco.'},
  {id:'apariencia', label:'Apariencia', desc:'Lista para el ensayo en fresco.'}
];

var CATALOGOS_INICIALES = {
  laboratorios: ['LAB-DINO-TRUJILLO', 'LAB-DINO-PACASMAYO', 'LAB-CEMENTOS-PACASMAYO'],
  empresas: ['DINO SRL', 'CEMENTOS PACASMAYO'],
  equipos: ['EQUIPO DE SSCC CONCRETO', 'EQUIPO DE SSCC SUELOS', 'EQUIPO DE CEMENTOS PACASMAYO'],
  puestos: ['SUBGERENTE DE I+D', 'COORDINADOR DE I+D', 'JEFE DE SSCC', 'ANALISTA DE I+D', 'ANALISTA JUNIOR DE I+D',
    'TÉCNICO DE CALIDAD', 'PRACTICANTE', 'ENCARGADO DE LABORATORIO', 'ENCARGADO DE CALIBRACIÓN', 'ALMACÉN',
    'SISTEMAS', 'PRACTICANTE DE SISTEMAS', 'GERENCIA', 'CALIDAD', 'COMERCIAL'],
  plantas: ['1203 Concreto Piura', '1211 Industrial Pacasmayo', '1213 Industrial Trujillo', '1217 Concreto Chimbote',
    '1209 Concreto Chiclayo', '1207 Industrial Cajamarca', '1219 Industrial Moche', '1502 Concreto Rioja',
    '5202 Concreto Tarapoto', '5212 Concreto Moyobamba', '5206 Concreto Iquitos', 'KAM-Coam', 'KAM-Salaverry'],
  ceco: [],
  proveedores: ['BASF-Perú', 'CPSAA'],
  canteras: ['Cantera Quebrada León', 'Cantera Quebrada San Carlos'],
  procedencias: ['Red pública', 'Fabricante: CPSSA', 'Fabricante: BASF-Perú'],
  tiposFalla: ['Tipo 1', 'Tipo 2', 'Tipo 3', 'Tipo 4', 'Tipo 5', 'Tipo 6'],
  cohesividad: ['Buena', 'Regular', 'Mala'],
  apariencia: ['Buena', 'Regular', 'Mala']
};

/* Cada valor: {valor, activo}. Se guarda como una colección más del sistema. */
var catalogos = load('sid_catalogos', null);
if(!catalogos){
  catalogos = {};
  Object.keys(CATALOGOS_INICIALES).forEach(function(k){
    catalogos[k] = CATALOGOS_INICIALES[k].map(function(v){ return {valor:v, activo:true}; });
  });
  save('sid_catalogos', catalogos);
}
CATALOGO_DEFS.forEach(function(d){ if(!catalogos[d.id]) catalogos[d.id] = []; });
function saveCatalogos(){ save('sid_catalogos', catalogos); }
/* Valores activos de un catálogo (lo que se ofrece en las listas). */
function catalogo(id, incluirInactivos){
  return (catalogos[id] || []).filter(function(x){ return incluirInactivos || x.activo; }).map(function(x){ return x.valor; });
}
function opcionesHtml(valores, seleccionado, vacio){
  return (vacio ? '<option value="">' + esc(vacio) + '</option>' : '') + valores.map(function(v){
    return '<option value="' + esc(v) + '"' + (v === seleccionado ? ' selected' : '') + '>' + esc(v) + '</option>';
  }).join('');
}
function labLabel(lab){ return (window.SIDPermisos.LAB_LABEL || {})[lab] || lab || ''; }

/* ================= AJUSTES DEL SISTEMA (RF-AJU-01) ================= */
var AJUSTES_INICIALES = {
  dispersionEspecimenPct: 15,   // RF-ROT-07: un espécimen que se aleja más de este % del promedio
  dispersionCVPct: 10,          // RF-ROT-07: coeficiente de variación máximo
  stockBajoPct: 10,             // RF-INV-08
  diasAvisoVencimiento: 30,     // RF-INV-08
  diasAvisoDescarte: 7,         // RF-MUE-04
  diasAvisoPlan: 3,             // RF-PRY-10: actividades o roturas por vencer
  areaProbeta: 83,              // RF-ROT-05: cm²
  difDosisPct: 10,              // RF-ELA-06: dosis real vs teórica
  tamanoEtiqueta: 'mediano'     // RF-ETQ-03
};
var ajustesSistema = Object.assign({}, AJUSTES_INICIALES, load('sid_ajustes_sistema', {}));
function saveAjustesSistema(){ save('sid_ajustes_sistema', ajustesSistema); }
function ajuste(k){ var v = ajustesSistema[k]; return v === undefined || v === '' ? AJUSTES_INICIALES[k] : v; }
