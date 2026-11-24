/* Sistema I+D — Configuración del laboratorio (Fase 1): catálogo de ensayos y métodos, flujos por tipo de
   proyecto, tolerancias de rotura (NTP 339.034), rango de la poza, fichas de personal, capacitaciones y matriz
   de autorización (ISO/IEC 17025: 6.2). Los datos iniciales son los mismos de worker/seed.sql.
   Con servidor conectado, cada cambio se guarda primero en el servidor (que verifica el permiso y exige el
   motivo) y luego aquí; si no hay red, queda en la cola y se aplica igual en este navegador. */
'use strict';

var ETAPAS_ENSAYO = [
  {id:'caracterizacion', label:'Caracterización de agregados'},
  {id:'diseno', label:'Diseño'},
  {id:'elaboracion', label:'Elaboración'},
  {id:'fresco', label:'Estado fresco'},
  {id:'endurecido', label:'Estado endurecido'},
  {id:'otro', label:'Otro'}
];
var LABORATORIOS = ['DINO Pacasmayo', 'Cementos Pacasmayo'];

function campo(clave, etiqueta, unidad, tipo){ return {clave:clave, etiqueta:etiqueta, unidad:unidad || '', tipo:tipo || 'numero'}; }
var LAB_SEMILLA = {
  ensayos: [
    {id:'ens-granulometria', codigo:'GRA', nombre:'Análisis granulométrico de agregados', etapa:'caracterizacion', metodo:'NTP 400.012', version:'2013', unidades:'%', campos:[campo('modulo_finura','Módulo de finura'), campo('tmn','Tamaño máximo nominal','pulg','texto')]},
    {id:'ens-pe-grueso', codigo:'PEG', nombre:'Peso específico y absorción del agregado grueso', etapa:'caracterizacion', metodo:'NTP 400.021', version:'2013', unidades:'g/cm³ · %', campos:[campo('peso_especifico','Peso específico','g/cm³'), campo('absorcion','Absorción','%')]},
    {id:'ens-pe-fino', codigo:'PEF', nombre:'Peso específico y absorción del agregado fino', etapa:'caracterizacion', metodo:'NTP 400.022', version:'2013', unidades:'g/cm³ · %', campos:[campo('peso_especifico','Peso específico','g/cm³'), campo('absorcion','Absorción','%')]},
    {id:'ens-pu-agregado', codigo:'PUA', nombre:'Peso unitario y vacíos de los agregados', etapa:'caracterizacion', metodo:'NTP 400.017', version:'2011', unidades:'kg/m³', campos:[campo('pu_suelto','P.U. suelto','kg/m³'), campo('pu_compactado','P.U. compactado','kg/m³')]},
    {id:'ens-humedad', codigo:'HUM', nombre:'Contenido de humedad total de agregados', etapa:'caracterizacion', metodo:'NTP 339.185', version:'2013', unidades:'%', campos:[campo('humedad','Humedad','%')]},
    {id:'ens-diseno', codigo:'DIS', nombre:'Diseño de mezcla de concreto', etapa:'diseno', metodo:'D-CC-F-148 (ACI 211.1)', version:'1', unidades:'kg/m³', campos:[]},
    {id:'ens-elaboracion', codigo:'ELA', nombre:'Elaboración y curado de especímenes', etapa:'elaboracion', metodo:'NTP 339.033', version:'2015', unidades:'', campos:[campo('hora_contacto',"Hora de contacto (0')",'','texto')]},
    {id:'ens-slump', codigo:'SLU', nombre:'Asentamiento (slump)', etapa:'fresco', metodo:'NTP 339.035', version:'2015', unidades:'pulg', campos:[campo('min_0','0 min','pulg'), campo('min_30','30 min','pulg'), campo('min_60','60 min','pulg'), campo('min_90','90 min','pulg'), campo('min_120','120 min','pulg')]},
    {id:'ens-temp-concreto', codigo:'TCO', nombre:'Temperatura del concreto', etapa:'fresco', metodo:'NTP 339.184', version:'2013', unidades:'°C', campos:[campo('temperatura','T° del concreto','°C')]},
    {id:'ens-temp-ambiente', codigo:'TAM', nombre:'Temperatura ambiente', etapa:'fresco', metodo:'NTP 339.184', version:'2013', unidades:'°C', campos:[campo('temperatura','T° ambiente','°C')]},
    {id:'ens-pu-concreto', codigo:'PUC', nombre:'Peso unitario del concreto', etapa:'fresco', metodo:'NTP 339.046', version:'2008', unidades:'kg/m³', campos:[campo('peso_unitario','Peso unitario','kg/m³')]},
    {id:'ens-aire', codigo:'AIR', nombre:'Contenido de aire (método de presión)', etapa:'fresco', metodo:'NTP 339.083', version:'2003', unidades:'%', campos:[campo('aire','Aire','%')]},
    {id:'ens-fragua', codigo:'FRA', nombre:'Tiempo de fragua', etapa:'fresco', metodo:'NTP 339.082', version:'2011', unidades:'h:min', campos:[campo('inicial','Fragua inicial','h:min','texto'), campo('final','Fragua final','h:min','texto')]},
    {id:'ens-cohesividad', codigo:'COH', nombre:'Cohesividad y apariencia', etapa:'fresco', metodo:'Inspección visual', version:'1', unidades:'', campos:[campo('cohesividad','Cohesividad','','texto'), campo('apariencia','Apariencia','','texto')]},
    {id:'ens-compresion', codigo:'RCP', nombre:'Resistencia a la compresión en probetas cilíndricas', etapa:'endurecido', metodo:'NTP 339.034', version:'2015', unidades:'kg/cm²', campos:[campo('carga','Carga','kN'), campo('area','Área','cm²'), campo('tipo_fractura','Tipo de fractura (1–6)')]},
    {id:'ens-compresion-cubos', codigo:'RCC', nombre:'Resistencia a la compresión en cubos', etapa:'endurecido', metodo:'NTP 334.051', version:'2013', unidades:'kg/cm²', campos:[campo('carga','Carga','kN'), campo('area','Área','cm²')]}
  ],
  flujos: [
    {id:'flu-concreto', tipo_proyecto:'Concreto (nuevo producto)', descripcion:'Diseño de mezcla con estado fresco y roturas', edades_defecto:[1,3,7,28], pasos:[
      {id:'agregados', nombre:'Agregados', ensayos:['ens-granulometria','ens-pe-grueso','ens-pe-fino','ens-pu-agregado','ens-humedad']},
      {id:'diseno', nombre:'Diseño', ensayos:['ens-diseno']},
      {id:'elaboracion', nombre:'Elaboración', ensayos:['ens-elaboracion']},
      {id:'fresco', nombre:'Estado fresco', ensayos:['ens-slump','ens-temp-concreto','ens-temp-ambiente','ens-pu-concreto','ens-aire','ens-fragua','ens-cohesividad']},
      {id:'endurecido', nombre:'Estado endurecido', ensayos:['ens-compresion']}]},
    {id:'flu-scm', tipo_proyecto:'SCM', descripcion:'Materiales cementantes suplementarios en cubos de mortero', edades_defecto:[3,7,28], pasos:[
      {id:'diseno', nombre:'Diseño', ensayos:['ens-diseno']},
      {id:'elaboracion', nombre:'Elaboración', ensayos:['ens-elaboracion']},
      {id:'fresco', nombre:'Estado fresco', ensayos:['ens-temp-ambiente','ens-fragua']},
      {id:'endurecido', nombre:'Estado endurecido', ensayos:['ens-compresion-cubos']}]},
    {id:'flu-aditivos', tipo_proyecto:'Aditivos', descripcion:'Concreto con aditivo: retención de slump y resistencia', edades_defecto:[1,3,7,28], pasos:[
      {id:'agregados', nombre:'Agregados', ensayos:['ens-granulometria','ens-humedad']},
      {id:'diseno', nombre:'Diseño', ensayos:['ens-diseno']},
      {id:'elaboracion', nombre:'Elaboración', ensayos:['ens-elaboracion']},
      {id:'fresco', nombre:'Estado fresco', ensayos:['ens-slump','ens-temp-concreto','ens-temp-ambiente','ens-aire','ens-fragua']},
      {id:'endurecido', nombre:'Estado endurecido', ensayos:['ens-compresion']}]},
    {id:'flu-adhesivos', tipo_proyecto:'Adhesivos', descripcion:'Adhesivos cementantes en cubos', edades_defecto:[1,7,28], pasos:[
      {id:'elaboracion', nombre:'Elaboración', ensayos:['ens-elaboracion']},
      {id:'fresco', nombre:'Estado fresco', ensayos:['ens-cohesividad']},
      {id:'endurecido', nombre:'Estado endurecido', ensayos:['ens-compresion-cubos']}]}
  ],
  tolerancias: [
    {id:'tol-24h', edad_horas:24, etiqueta:'24 h', tolerancia_horas:0.5},
    {id:'tol-3d', edad_horas:72, etiqueta:'3 d', tolerancia_horas:2},
    {id:'tol-7d', edad_horas:168, etiqueta:'7 d', tolerancia_horas:6},
    {id:'tol-28d', edad_horas:672, etiqueta:'28 d', tolerancia_horas:20},
    {id:'tol-90d', edad_horas:2160, etiqueta:'90 d', tolerancia_horas:48}
  ],
  configuracion: {tolerancia_otras_pct:'2', poza_min:'21', poza_max:'25', poza_objetivo:'23', area_defecto_cm2:'83', cv_alerta_pct:'10',
    agregados_modo:'lote_compartido', semanas_corte_mes:'partir', kn_a_kgf:'101.9716'},
  personal: [], capacitaciones: [], autorizaciones: []
};
var CONFIG_ETIQUETAS = {
  tolerancia_otras_pct:'Tolerancia de otras edades (% de la edad)', poza_min:'Poza: T° mínima (°C)', poza_max:'Poza: T° máxima (°C)',
  poza_objetivo:'Poza: T° objetivo (°C)', area_defecto_cm2:'Área por defecto de la probeta (cm²)', cv_alerta_pct:'Alerta de coef. de variación (%)'
};

var Lab = (function(){
  var datos = load('sid_lab', null);
  if(!datos){ datos = JSON.parse(JSON.stringify(LAB_SEMILLA)); save('sid_lab', datos); }
  ['ensayos','flujos','tolerancias','personal','capacitaciones','autorizaciones'].forEach(function(k){ if(!Array.isArray(datos[k])) datos[k] = []; });
  datos.configuracion = Object.assign({}, LAB_SEMILLA.configuracion, datos.configuracion || {});
  datos.ensayos.forEach(function(e){ if(e.activo === undefined) e.activo = 1; });
  datos.flujos.forEach(function(f){ if(f.activo === undefined) f.activo = 1; });
  function persistirLocal(){ save('sid_lab', datos); }

  function idNuevo(prefijo){ return (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : (prefijo + Date.now() + Math.random().toString(36).slice(2, 8)); }
  function porId(lista, id){ return lista.filter(function(x){ return x.id === id; })[0] || null; }
  function copia(o){ return o ? JSON.parse(JSON.stringify(o)) : null; }

  /* Guardado común: servidor primero (si hay), luego local + historial */
  function persistir(remoto, aplicar, hist){
    var tras = function(){
      aplicar();
      persistirLocal();
      if(hist) registrarHistorial(hist.accion, hist.modulo, hist.detalle || '', {codigo:hist.codigo, antes:hist.antes, despues:hist.despues, motivo:hist.motivo, ref:hist.ref, servidor:Nube.activa()});
    };
    if(!Nube.activa()){ tras(); return Promise.resolve(true); }
    return Nube.enviar(remoto.metodo, remoto.ruta, remoto.cuerpo).then(function(){ tras(); return true; });
  }
  function upsert(lista, obj){ var i = lista.findIndex(function(x){ return x.id === obj.id; }); if(i === -1) lista.push(obj); else lista[i] = obj; }

  return {
    datos: function(){ return datos; },
    idNuevo: idNuevo,
    ensayos: function(soloActivos){ return datos.ensayos.filter(function(e){ return !soloActivos || e.activo; }); },
    ensayo: function(id){ return porId(datos.ensayos, id); },
    flujos: function(soloActivos){ return datos.flujos.filter(function(f){ return !soloActivos || f.activo; }); },
    flujo: function(id){ return porId(datos.flujos, id); },
    tolerancias: function(){ return datos.tolerancias.slice().sort(function(a,b){ return a.edad_horas - b.edad_horas; }); },
    config: function(clave){ return datos.configuracion[clave]; },
    configNum: function(clave){ return Number(datos.configuracion[clave]); },
    personalDe: function(usuarioId){ return datos.personal.filter(function(p){ return p.usuario_id === usuarioId; })[0] || null; },
    capacitacionesDe: function(usuarioId){ return datos.capacitaciones.filter(function(c){ return c.usuario_id === usuarioId && !c.anulada; }); },
    autorizaciones: function(){ return datos.autorizaciones; },
    autorizacionVigente: function(usuarioId, ensayoId){
      return datos.autorizaciones.filter(function(a){ return a.usuario_id === usuarioId && a.ensayo_id === ensayoId && a.vigente; })[0] || null;
    },
    /* Regla 4: solo registra un ensayo quien está autorizado (desde la fecha indicada) */
    estaAutorizado: function(usuarioId, ensayoId, fechaISO){
      var a = this.autorizacionVigente(usuarioId, ensayoId);
      return !!a && a.desde <= (fechaISO || todayISO());
    },

    /* Tolerancia NTP 339.034: tabla por edad; otras edades, ± % de la edad */
    toleranciaHoras: function(edadHoras){
      var t = datos.tolerancias.filter(function(x){ return Math.abs(x.edad_horas - edadHoras) < 1e-6; })[0];
      return t ? Number(t.tolerancia_horas) : edadHoras * Number(datos.configuracion.tolerancia_otras_pct || 2) / 100;
    },
    /* Ventana de rotura: fecha y hora de elaboración + edad, ± tolerancia */
    ventanaRotura: function(elaboracion, edadHoras){
      var t0 = elaboracion instanceof Date ? elaboracion.getTime() : new Date(elaboracion).getTime();
      if(!isFinite(t0)) return null;
      var tol = this.toleranciaHoras(edadHoras);
      var prog = t0 + edadHoras * 3600e3;
      return {programada:new Date(prog), desde:new Date(prog - tol * 3600e3), hasta:new Date(prog + tol * 3600e3), toleranciaHoras:tol};
    },
    pozaEnRango: function(temp){ return temp >= this.configNum('poza_min') && temp <= this.configNum('poza_max'); },

    /* ---------- escrituras (cada una valida, pide motivo si edita y deja historial) ---------- */
    guardarEnsayo: function(e, motivo){
      var previo = copia(porId(datos.ensayos, e.id));
      var dif = previo ? diferencias(previo, e, ['codigo','nombre','etapa','metodo','version','unidades','campos','activo']) : null;
      if(previo && !dif) return Promise.resolve(false);
      return persistir({metodo:'PUT', ruta:'/api/ensayos/' + encodeURIComponent(e.id), cuerpo:Object.assign({}, e, {motivo:motivo})},
        function(){ upsert(datos.ensayos, e); },
        {accion: previo ? 'Editó' : 'Creó', modulo:'Ensayos y métodos', codigo:e.codigo, ref:e.id, detalle:e.nombre,
         antes: dif ? dif.antes : undefined, despues: dif ? dif.despues : e, motivo:motivo});
    },
    guardarFlujo: function(f, motivo){
      var previo = copia(porId(datos.flujos, f.id));
      var dif = previo ? diferencias(previo, f, ['tipo_proyecto','descripcion','edades_defecto','pasos','activo']) : null;
      if(previo && !dif) return Promise.resolve(false);
      return persistir({metodo:'PUT', ruta:'/api/flujos/' + encodeURIComponent(f.id), cuerpo:Object.assign({}, f, {motivo:motivo})},
        function(){ upsert(datos.flujos, f); },
        {accion: previo ? 'Editó' : 'Creó', modulo:'Ensayos y métodos', codigo:f.tipo_proyecto, ref:f.id, detalle:'Flujo ' + f.tipo_proyecto,
         antes: dif ? dif.antes : undefined, despues: dif ? dif.despues : f, motivo:motivo});
    },
    guardarTolerancia: function(t, motivo){
      var previo = copia(porId(datos.tolerancias, t.id));
      var dif = previo ? diferencias(previo, t, ['edad_horas','etiqueta','tolerancia_horas']) : null;
      if(previo && !dif) return Promise.resolve(false);
      return persistir({metodo:'PUT', ruta:'/api/tolerancias/' + encodeURIComponent(t.id), cuerpo:Object.assign({}, t, {motivo:motivo})},
        function(){ upsert(datos.tolerancias, t); },
        {accion: previo ? 'Editó' : 'Creó', modulo:'Ensayos y métodos', codigo:'Tolerancia ' + t.etiqueta, ref:t.id,
         antes: dif ? dif.antes : undefined, despues: dif ? dif.despues : t, motivo:motivo});
    },
    guardarConfig: function(clave, valor, motivo){
      var previo = datos.configuracion[clave];
      if(String(previo) === String(valor)) return Promise.resolve(false);
      return persistir({metodo:'PUT', ruta:'/api/configuracion/' + encodeURIComponent(clave), cuerpo:{valor:String(valor), motivo:motivo}},
        function(){ datos.configuracion[clave] = String(valor); },
        {accion:'Editó', modulo:'Ensayos y métodos', codigo:clave, detalle:CONFIG_ETIQUETAS[clave] || clave, antes:{valor:previo}, despues:{valor:String(valor)}, motivo:motivo});
    },
    guardarPersonal: function(usuarioId, ficha, motivo){
      var previo = copia(this.personalDe(usuarioId));
      var nuevo = {usuario_id:usuarioId, puesto:ficha.puesto || '', laboratorio:ficha.laboratorio || '', formacion:ficha.formacion || '', actualizado_en:new Date().toISOString()};
      var dif = previo ? diferencias(previo, nuevo, ['puesto','laboratorio','formacion']) : null;
      if(previo && !dif) return Promise.resolve(false);
      var u = usuarioPorId(usuarioId);
      return persistir({metodo:'PUT', ruta:'/api/personal/' + encodeURIComponent(usuarioId), cuerpo:Object.assign({}, nuevo, {motivo:motivo})},
        function(){ datos.personal = datos.personal.filter(function(p){ return p.usuario_id !== usuarioId; }); datos.personal.push(nuevo); },
        {accion: previo ? 'Editó' : 'Creó', modulo:'Personal', codigo:u ? u.usuario : usuarioId, ref:usuarioId, detalle:'Ficha de personal',
         antes: dif ? dif.antes : undefined, despues: dif ? dif.despues : nuevo, motivo:motivo});
    },
    guardarCapacitacion: function(c){
      var u = usuarioPorId(c.usuario_id);
      return persistir({metodo:'PUT', ruta:'/api/capacitaciones/' + encodeURIComponent(c.id), cuerpo:c},
        function(){ upsert(datos.capacitaciones, Object.assign({anulada:0}, c)); },
        {accion:'Creó', modulo:'Personal', codigo:u ? u.usuario : '', ref:c.id, detalle:'Capacitación: ' + c.nombre, despues:c});
    },
    anularCapacitacion: function(id, motivo){
      var c = porId(datos.capacitaciones, id);
      if(!c) return Promise.resolve(false);
      var u = usuarioPorId(c.usuario_id);
      return persistir({metodo:'POST', ruta:'/api/capacitaciones/' + encodeURIComponent(id) + '/anular', cuerpo:{motivo:motivo}},
        function(){ c.anulada = 1; c.motivo_anulacion = motivo; },
        {accion:'Anuló', modulo:'Personal', codigo:u ? u.usuario : '', ref:id, detalle:'Capacitación: ' + c.nombre, antes:{anulada:0}, despues:{anulada:1}, motivo:motivo});
    },
    otorgarAutorizacion: function(usuarioId, ensayoId, desde){
      var u = usuarioPorId(usuarioId), e = porId(datos.ensayos, ensayoId);
      var a = {id:idNuevo('aut'), usuario_id:usuarioId, ensayo_id:ensayoId, desde:desde, autorizado_por:usuarioActual.id, vigente:1};
      return persistir({metodo:'PUT', ruta:'/api/autorizaciones/' + encodeURIComponent(a.id), cuerpo:a},
        function(){
          datos.autorizaciones.forEach(function(x){ if(x.usuario_id === usuarioId && x.ensayo_id === ensayoId && x.vigente){ x.vigente = 0; x.revocada_en = new Date().toISOString(); x.revocada_por = usuarioActual.id; x.motivo_revocacion = 'Reemplazada por una nueva autorización'; } });
          datos.autorizaciones.push(a);
        },
        {accion:'Autorizó', modulo:'Personal', codigo:(u ? u.usuario : '') + ' · ' + (e ? e.codigo : ''), ref:a.id, detalle:(e ? e.nombre : '') + ' desde ' + isoToDMY(desde), despues:{desde:desde}});
    },
    revocarAutorizacion: function(id, motivo){
      var a = porId(datos.autorizaciones, id);
      if(!a) return Promise.resolve(false);
      var u = usuarioPorId(a.usuario_id), e = porId(datos.ensayos, a.ensayo_id);
      return persistir({metodo:'POST', ruta:'/api/autorizaciones/' + encodeURIComponent(id) + '/revocar', cuerpo:{motivo:motivo}},
        function(){ a.vigente = 0; a.revocada_en = new Date().toISOString(); a.revocada_por = usuarioActual.id; a.motivo_revocacion = motivo; },
        {accion:'Revocó', modulo:'Personal', codigo:(u ? u.usuario : '') + ' · ' + (e ? e.codigo : ''), ref:id, detalle:e ? e.nombre : '', antes:{vigente:1}, despues:{vigente:0}, motivo:motivo});
    },

    /* Con servidor: lo que devuelve GET /api/laboratorio reemplaza la copia local */
    cargarDesdeServidor: function(d){
      datos.ensayos = d.ensayos || [];
      datos.flujos = d.flujos || [];
      datos.tolerancias = d.tolerancias || [];
      datos.configuracion = Object.assign({}, LAB_SEMILLA.configuracion, d.configuracion || {});
      datos.personal = d.personal || [];
      datos.capacitaciones = d.capacitaciones || [];
      datos.autorizaciones = d.autorizaciones || [];
      persistirLocal();
    }
  };
})();

/* Descarga del servidor todo lo configurado (usuarios incluidos) después de ingresar */
function sincronizarLaboratorio(){
  if(!Nube.activa() || !Nube.tieneToken()) return Promise.resolve(false);
  return Nube.pedir('GET', '/api/laboratorio').then(function(d){
    Lab.cargarDesdeServidor(d);
    usuarios = (d.usuarios || []).map(function(u){
      var previo = usuarioPorId(u.id) || {};
      return {id:u.id, usuario:u.usuario, nombre:u.nombre, iniciales:u.iniciales || '', correo:u.correo || '', rol:u.rol, activo:!!u.activo,
        creado:u.creado_en ? Date.parse(u.creado_en) : (previo.creado || null), ultimoAcceso:u.ultimo_acceso ? Date.parse(u.ultimo_acceso) : null, servidor:true};
    });
    saveUsuarios();
    if(usuarioActual){ var yo = usuarioPorId(usuarioActual.id); if(yo){ usuarioActual = yo; } }
    aplicarPermisosServidor(d.permisos || []);
    Nube.procesarCola();
    return true;
  }).catch(function(e){ if(!e.red) toast('No se pudo leer la configuración del servidor: ' + e.mensaje); return false; });
}
