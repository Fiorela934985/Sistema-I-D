/* Sistema I+D — Roles y matriz de permisos (sección 3 de los Requerimientos funcionales).
   Un solo archivo para el navegador (window.SIDPermisos) y el servidor (require/import):
   lo que se oculta en pantalla es exactamente lo que el servidor rechaza. */
(function(raiz, fabrica){
  if(typeof module === 'object' && module.exports) module.exports = fabrica();
  else raiz.SIDPermisos = fabrica();
})(typeof self !== 'undefined' ? self : this, function(){
  'use strict';

  var ROLES = {
    ADM: {label:'Administrador', desc:'Sistemas: usuarios, catálogos, respaldos. Ve todo, en todas las sedes.'},
    JEF: {label:'Jefatura I+D', desc:'Jefe o coordinador de I+D: todos los proyectos de sus laboratorios; aprueba, valida y firma.'},
    ANA: {label:'Analista / Investigador', desc:'Proyectos de su equipo (y lectura de los demás de su sede): diseños, réplicas, revisión y RR.'},
    TEC: {label:'Técnico de laboratorio', desc:'Réplicas y roturas asignadas a él o a su equipo: elaborar, desmoldar, romper.'},
    INV: {label:'Responsable de inventario', desc:'Recursos de su laboratorio: productos, lotes, muestras, equipos y envíos.'},
    CON: {label:'Consulta', desc:'Gerencia, calidad, comercial: solo lectura de reportes de proyecto, resultados y paneles.'}
  };
  var ORDEN_ROLES = ['ADM', 'JEF', 'ANA', 'TEC', 'INV', 'CON'];

  /* V ver · C crear · E editar · A aprobar/cerrar · X eliminar. "*" = solo lo asignado / propio. */
  var MATRIZ = {
    panel:          {ADM:'V',     JEF:'V',    ANA:'V',    TEC:'',     INV:'V',   CON:'V'},
    proyectos:      {ADM:'VCEAX', JEF:'VCEA', ANA:'VCE',  TEC:'V*',   INV:'V',   CON:'V'},
    reporteProyecto:{ADM:'V',     JEF:'VA',   ANA:'VC',   TEC:'',     INV:'',    CON:'V'},
    bitacora:       {ADM:'V',     JEF:'VCE',  ANA:'VCE',  TEC:'VC*',  INV:'',    CON:''},
    normas:         {ADM:'VCEX',  JEF:'VCE',  ANA:'V',    TEC:'V',    INV:'',    CON:''},
    disenos:        {ADM:'VCEX',  JEF:'VCEA', ANA:'VCE',  TEC:'V',    INV:'',    CON:''},
    elaboracion:    {ADM:'VE',    JEF:'VE',   ANA:'VCE',  TEC:'VCE*', INV:'',    CON:''},
    etiquetas:      {ADM:'VC',    JEF:'VC',   ANA:'VC',   TEC:'VC',   INV:'VC',  CON:''},
    roturas:        {ADM:'VEX',   JEF:'VEA',  ANA:'VCE',  TEC:'VCE*', INV:'',    CON:''},
    rr:             {ADM:'V',     JEF:'VA',   ANA:'VCE',  TEC:'',     INV:'',    CON:'V'},
    archivador:     {ADM:'V',     JEF:'V',    ANA:'V',    TEC:'',     INV:'',    CON:'V'},
    prediccion:     {ADM:'V',     JEF:'V',    ANA:'V',    TEC:'',     INV:'',    CON:''},
    materiales:     {ADM:'VCEX',  JEF:'VCE',  ANA:'VCE',  TEC:'V',    INV:'VCE', CON:''},
    productos:      {ADM:'VCEX',  JEF:'V',    ANA:'V',    TEC:'V',    INV:'VCE', CON:''},
    muestras:       {ADM:'VCEX',  JEF:'V',    ANA:'VCE',  TEC:'V',    INV:'VCE', CON:''},
    equipos:        {ADM:'VCEX',  JEF:'V',    ANA:'V',    TEC:'V',    INV:'VCE', CON:''},
    envios:         {ADM:'VCE',   JEF:'V',    ANA:'VC',   TEC:'V',    INV:'VCE', CON:''},
    usuarios:       {ADM:'VCEX',  JEF:'V',    ANA:'',     TEC:'',     INV:'',    CON:''},
    historial:      {ADM:'V',     JEF:'V',    ANA:'V*',   TEC:'',     INV:'V*',  CON:''},
    ajustes:        {ADM:'VCEX',  JEF:'VE',   ANA:'',     TEC:'',     INV:'',    CON:''}
  };

  /* Cada colección de datos pertenece a un módulo de la matriz. */
  var COLECCION_MODULO = {
    proyectos:'proyectos', iteraciones:'proyectos', actividades:'proyectos', documentos:'proyectos',
    reportesProyecto:'reporteProyecto', bitacora:'bitacora',
    normas:'normas', tiposEnsayo:'normas',
    disenos:'disenos', materiales:'materiales',
    roturas:'roturas', evidencias:'roturas',
    rr:'rr', predicciones:'prediccion', ajustes:'ajustes', egresosPendientes:'productos'
  };

  function letras(rol, modulo){
    var fila = MATRIZ[modulo];
    return fila ? (fila[rol] || '') : '';
  }
  /* puede('ANA','disenos','E') → true. El asterisco (solo asignado) lo resuelve quien llama. */
  function puede(rol, modulo, accion){
    return letras(rol, modulo).indexOf(accion) > -1;
  }
  function soloAsignado(rol, modulo){ return letras(rol, modulo).indexOf('*') > -1; }

  /* Secciones de la interfaz: qué módulo hay que poder Ver para entrar. */
  var PANELES = [
    {id:'inicio', label:'Inicio', grupo:'General', modulo:null},
    {id:'reportes', label:'Panel de control', grupo:'General', modulo:'panel'},
    {id:'proyectos', label:'1 · Proyectos', grupo:'Proceso I+D', modulo:'proyectos'},
    {id:'disenos', label:'2 · Diseños', grupo:'Proceso I+D', modulo:'disenos'},
    {id:'elaboracion', label:'3 · Elaboración', grupo:'Proceso I+D', modulo:'elaboracion'},
    {id:'roturas', label:'4 · Roturas', grupo:'Proceso I+D', modulo:'roturas'},
    {id:'calendario', label:'Calendario de roturas', grupo:'Proceso I+D', modulo:'roturas'},
    {id:'revision', label:'5 · Revisión', grupo:'Proceso I+D', modulo:'disenos', letra:'E'},
    {id:'reporte-rr', label:'6 · Reporte RR', grupo:'Proceso I+D', modulo:'rr'},
    {id:'archivador', label:'7 · Archivador', grupo:'Proceso I+D', modulo:'archivador'},
    {id:'inventario', label:'Inventario', grupo:'Recursos', modulo:'productos'},
    {id:'componentes', label:'Materiales del diseño', grupo:'Recursos', modulo:'materiales'},
    {id:'normas', label:'Normas y ensayos', grupo:'Recursos', modulo:'normas'},
    {id:'base-historica', label:'Base histórica', grupo:'Inteligencia', modulo:'prediccion'},
    {id:'prediccion', label:'Predicción', grupo:'Inteligencia', modulo:'prediccion'},
    {id:'asistente', label:'Asistente I+D', grupo:'Inteligencia', modulo:'prediccion'},
    {id:'usuarios', label:'Usuarios y roles', grupo:'Administración', modulo:'usuarios'},
    {id:'historial', label:'Historial', grupo:'Administración', modulo:'historial'},
    {id:'ajustes', label:'Ajustes', grupo:'Administración', modulo:null}
  ];
  function puedeVerPanel(rol, panelId){
    var p = PANELES.filter(function(x){ return x.id === panelId; })[0];
    if(!p) return false;
    if(!p.modulo) return !!rol;
    return puede(rol, p.modulo, p.letra || 'V');
  }

  /* Rol predeterminado según el puesto del organigrama (RF-USR-06). El ADM puede cambiarlo por persona. */
  var REGLAS_PUESTO = [
    {re:/SISTEMAS/, rol:'ADM'},
    {re:/SUBGERENTE|GERENTE DE I\+D|JEFE DE (I\+D|SSCC)|COORDINADOR/, rol:'JEF'},
    {re:/ANALISTA|INVESTIGADOR|INGENIER/, rol:'ANA'},
    {re:/ALMAC|ENCARGADO|INVENTARIO|CALIBRACI/, rol:'INV'},
    {re:/T[ÉE]CNICO|AUXILIAR|PRACTICANTE/, rol:'TEC'},
    {re:/GERENTE|GERENCIA|CALIDAD|COMERCIAL/, rol:'CON'}
  ];
  function rolPorPuesto(puesto){
    var p = String(puesto || '').toUpperCase();
    for(var i = 0; i < REGLAS_PUESTO.length; i++){ if(REGLAS_PUESTO[i].re.test(p)) return REGLAS_PUESTO[i].rol; }
    return 'CON';
  }

  var LABORATORIOS = ['LAB-DINO-TRUJILLO', 'LAB-DINO-PACASMAYO', 'LAB-CEMENTOS-PACASMAYO'];
  var LAB_LABEL = {'LAB-DINO-TRUJILLO':'DINO Trujillo', 'LAB-DINO-PACASMAYO':'DINO Pacasmayo', 'LAB-CEMENTOS-PACASMAYO':'Cementos Pacasmayo'};
  /* Mismo criterio que el sistema de inventario: el dominio del correo define la sede. */
  function laboratoriosPorCorreo(email){
    var dominio = String(email || '').split('@')[1] || '';
    if(/^dino\./i.test(dominio)) return ['LAB-DINO-TRUJILLO', 'LAB-DINO-PACASMAYO'];
    if(/^cpsaa\./i.test(dominio)) return ['LAB-CEMENTOS-PACASMAYO'];
    return [];
  }

  return {
    ROLES: ROLES, ORDEN_ROLES: ORDEN_ROLES, MATRIZ: MATRIZ, COLECCION_MODULO: COLECCION_MODULO, PANELES: PANELES,
    LABORATORIOS: LABORATORIOS, LAB_LABEL: LAB_LABEL,
    letras: letras, puede: puede, soloAsignado: soloAsignado, puedeVerPanel: puedeVerPanel,
    rolPorPuesto: rolPorPuesto, laboratoriosPorCorreo: laboratoriosPorCorreo
  };
});
