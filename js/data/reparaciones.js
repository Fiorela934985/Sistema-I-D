/* Sistema I+D — Reparaciones de integridad de datos. Se ejecutan al iniciar y son idempotentes:
   solo corrigen lo que sigue con el error original, nunca datos editados a mano. */
'use strict';

/* 1) Roturas huérfanas: la siembra de datos reales reutilizó códigos de diseños de demostración
      (DID-0015…0021) y las roturas de esos diseños quedaron colgadas del diseño real. */
function repararRoturasHuerfanas(){
  var porCodigo = {};
  disenos.forEach(function(d){ porCodigo[d.codigo] = d; });
  var antes = roturaCargas.length;
  roturaCargas = roturaCargas.filter(function(c){
    var d = porCodigo[c.disenoCodigoDiseno];
    if(!d) return false;
    if(!(d.replicaObjs || []).length) return true;
    var propia = d.replicaObjs.some(function(r){ return r.nombre === c.replicaNombre; });
    if(!propia){ [1,2,3].forEach(function(m){ if(c['evid'+m]) deleteEvidencia(c['evid'+m]).catch(function(){}); }); }
    return propia;
  });
  if(roturaCargas.length !== antes) saveRoturaCargas();
  return antes - roturaCargas.length;
}

/* 2) Proyectos duplicados que solo difieren en mayúsculas ("Estudio HE" / "ESTUDIO HE"):
      se unifican en el que tiene más diseños. */
function unificarProyectosDuplicados(){
  var grupos = {};
  nombresDeProyectos().forEach(function(p){ var k = normalizar(p); (grupos[k] = grupos[k] || []).push(p); });
  var unificados = 0;
  Object.keys(grupos).forEach(function(k){
    var nombres = grupos[k];
    if(nombres.length < 2) return;
    var cuenta = function(p){ return disenos.filter(function(d){ return proyectoNombre(d.proyectoId) === p; }).length; };
    nombres.sort(function(a,b){ return cuenta(b) - cuenta(a); });
    var canon = nombres[0];
    nombres.slice(1).forEach(function(viejo){
      disenos.forEach(function(d){ if(proyectoNombre(d.proyectoId) === viejo) d.proyectoId = proyectoId(canon); });
      (PROYECTO_ITERACIONES[viejo] || []).forEach(function(it){ registrarIteracion(canon, it); });
      delete PROYECTO_ITERACIONES[viejo];
      PROYECTO_CATALOGO = PROYECTO_CATALOGO.filter(function(p){ return p !== viejo; });
      if(PROYECTO_CATALOGO.indexOf(canon) === -1) PROYECTO_CATALOGO.push(canon);
      renombrarProyectoEnTodo(viejo, canon);
      unificados++;
    });
  });
  if(unificados){
    save('sid10_disenos', disenos);
    saveProyectoIteraciones();
    saveCatalogo();
    registrarHistorial('Unificó', 'Proyecto', unificados + ' proyecto(s) duplicado(s) por mayúsculas');
  }
  return unificados;
}

/* 3) Resultados importados del CSV: la columna de resistencia se leyó corrida (todos los diseños
      quedaron con ~11 / 9 / 5 / 3 kg/cm²). Los valores correctos están en los estudios del Reporte RR
      de esos mismos diseños (R-15…R-34). Donde el RR no tiene la edad, el resultado queda pendiente. */
function corregirResultadosImportadosCSV(){
  if(load('sid_fix_csv_v1', false)) return 0;
  var csvPorReplicaDia = {};
  (window.SID_REAL_CSV_DESIGNS || []).forEach(function(item){
    (item.cargasList || []).forEach(function(c){ csvPorReplicaDia[c.replicaNombre + '|' + c.dia] = String(c.promedio); });
  });
  var rrPorReceta = {};
  rrEstudios.forEach(function(e){
    e.tipos.forEach(function(t){
      if(!t.origenDisenoCodigo || rrPorReceta[t.origenDisenoCodigo]) return;
      var porEdad = {};
      e.edades.forEach(function(ed){
        var dia = parseInt(String(ed.edad).replace(/[^\d]/g,''), 10);
        var v = Number(ed.valores[t.id]);
        if(dia && v > 0) porEdad[dia] = v;
      });
      rrPorReceta[t.origenDisenoCodigo] = porEdad;
    });
  });
  var corregidas = 0, sinDato = 0;
  disenos.filter(function(d){ return d.recetaId; }).forEach(function(d){
    var rr = rrPorReceta[d.recetaId] || {};
    cargasDeDiseno(d).forEach(function(c){
      var csv = csvPorReplicaDia[c.replicaNombre + '|' + c.dia];
      if(csv === undefined || String(c.promedio) !== csv) return; // ya fue editada: no se toca
      var v = rr[Number(c.dia)];
      var area = n(c.a1) || 78.54;
      if(v){
        c.m1kgcm2 = c.m2kgcm2 = c.m3kgcm2 = c.promedio = String(v);
        c.m1kg = c.m2kg = c.m3kg = String(Math.round(v * area));
        c.coefVar = '0.00%'; c.desvest = '0.00';
        c.comentarios = 'Valor del Reporte RR (corregido de la importación CSV)';
        c.estado = 'completado';
        corregidas++;
      } else {
        ['m1kgcm2','m2kgcm2','m3kgcm2','promedio','m1kg','m2kg','m3kg','coefVar','desvest'].forEach(function(k){ c[k] = ''; });
        c.comentarios = 'Sin resultado en el registro original — completar';
        c.estado = 'pendiente';
        sinDato++;
      }
    });
  });
  saveRoturaCargas();
  save('sid_fix_csv_v1', true);
  if(corregidas || sinDato){
    registrarHistorial('Corrigió', 'Rotura', corregidas + ' resultados importados tomados del Reporte RR; ' + sinDato + ' sin dato quedaron pendientes');
  }
  return corregidas;
}

/* ---- Datos de demostración: se pueden quitar desde Base histórica (solo administración) ---- */
function disenosDeDemostracion(){ return disenos.filter(function(d){ return !d.recetaId && !d.colaborador; }); }
function eliminarDatosDemostracion(){
  var demo = disenosDeDemostracion();
  var codigos = {}; demo.forEach(function(d){ codigos[d.codigo] = true; });
  var cargas = roturaCargas.filter(function(c){ return codigos[c.disenoCodigoDiseno]; });
  cargas.forEach(function(c){ [1,2,3].forEach(function(m){ if(c['evid'+m]) deleteEvidencia(c['evid'+m]).catch(function(){}); }); });
  roturaCargas = roturaCargas.filter(function(c){ return !codigos[c.disenoCodigoDiseno]; });
  disenos = disenos.filter(function(d){ return !codigos[d.codigo]; });
  evidenciasIdx = evidenciasIdx.filter(function(e){ return !codigos[e.disenoCodigo]; });
  saveRoturaCargas(); save('sid10_disenos', disenos); saveEvidenciasIdx();
  registrarHistorial('Eliminó', 'Diseño', demo.length + ' diseños de demostración y ' + cargas.length + ' roturas asociadas');
  return {disenos: demo.length, cargas: cargas.length};
}

/* 4) Tipo de cemento de los diseños importados: se había deducido del nombre ("EST HE …") y quedaban
      todos como HE; se toma del cemento de la mezcla (I-PAC / HE-PAC). */
function corregirTipoCementoImportado(){
  var cambios = 0;
  disenos.filter(function(d){ return d.recetaId; }).forEach(function(d){
    var tipo = tipoCementoNormalizado(d) === 'HE' ? 'HE-PAC' : 'I-PAC';
    if(d.cementoTipo !== tipo){ d.cementoTipo = tipo; cambios++; }
  });
  if(cambios) save('sid10_disenos', disenos);
  return cambios;
}

repararRoturasHuerfanas();
unificarProyectosDuplicados();
corregirResultadosImportadosCSV();
corregirTipoCementoImportado();
