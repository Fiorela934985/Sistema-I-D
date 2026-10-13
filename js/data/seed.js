/* Sistema I+D — Siembra única de datos de muestra y datos reales (CSV) */
'use strict';

/* ================= DATOS DE MUESTRA (siembra única, para ver el sistema con contenido real) ================= */
function seedMoreDesigns(){
  if(load('sid10_seed_v5', false)) return;
  var proyectoPool = ['Aditivos in House','Adhesivo Cementante','Benchmarking Ad. Cementante','P.I. Adhesivo Cementante','Estudio HE','Estudio HE + Fly Ash','Estudio HE Aditivado','Estudio LH','Estudio Aditivo','Estudio Escoria','Aditivos Chiclayo'];
  var tipoIdxPool = [0,4,1,3,0,4];
  var fcPool = [175,210,245,280,350,210,280];
  var amcPool = ['0.40','0.45','0.50','0.55','0.60','0.65'];
  var cementoPool = ['I','HE','V'];
  var sufijoPool = ['A1','A2','B1','B2','C1','X1','X2','R5','K1','K2'];
  var numeralPool = ['I','I','II','I','III','II'];
  // diasAtras controlado: el índice 0 cae exactamente HOY en el día 1 de rotura, y queda pendiente a propósito.
  // El resto usa fechas recientes (máx. 9 días) para que el backlog de pendientes sea realista, no una mochila de 50.
  var diasAtrasPool = [1,2,4,9,6,3,5,8,2,7,4,9,3,6,5,8];
  var estadoPool  = ['Iniciado','En desarrollo','Completado','En desarrollo','Completado','Iniciado','Completado','En desarrollo','Iniciado','Completado','En desarrollo','Iniciado','Completado','En desarrollo','Completado','Iniciado'];

  for(var k=0; k<16; k++){
    var proyNombre = proyectoPool[k % proyectoPool.length];
    var tipoDef = TIPO_CONCRETO_DEFS[tipoIdxPool[k % tipoIdxPool.length]];
    var fc = fcPool[k % fcPool.length];
    var amc = amcPool[k % amcPool.length];
    var cementoTipo = cementoPool[k % cementoPool.length];
    var planta = PLANTA_LAB[k % PLANTA_LAB.length];
    var diasAtras = diasAtrasPool[k];
    var fechaISO = (function(dias){ var d=new Date(Date.now()-dias*DAY); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); })(diasAtras);
    var sufijo = sufijoPool[k % sufijoPool.length] + k;
    var nombreTecnico = tipoDef.code+'-'+amc+'-'+cementoTipo+'-'+sufijo;
    if(disenos.some(function(x){ return x.nombreTecnico===nombreTecnico; })) continue;
    var estado = k===0 ? 'Iniciado' : estadoPool[k % estadoPool.length];
    var pid = proyectoId(proyNombre);
    var mesNombre = MES_NOMBRES[new Date(fechaISO+'T00:00:00').getMonth()];
    var tipoEspecSeed = (k % 3 === 0) ? 'Cubos' : 'Probetas';
    var d = {
      codigo: nextCodigoDiseno(tipoEspecSeed),
      proyectoId: pid, iteracionId: mesNombre + ' ' + numeralPool[k % numeralPool.length],
      nombreTecnico: nombreTecnico,
      planta: planta.nombre, laboratorio: planta.lab,
      uso: 'General / Radio local', ndiseno: String(70+k), negocio:'Pacasmayo Profesional',
      tipo: tipoDef.label, fc: String(fc), resistencia: (fc/10).toFixed(1),
      cementoTipo: cementoTipo, amcEfectiva: amc,
      mix: [], cvdTotal: +(150 + (k*13.7)%180).toFixed(2),
      estado: estado,
      replicas: 2 + (k%2),
      diasRotura: [1,3,7,28],
      tipoRotura: tipoEspecSeed,
      fechaElaboracionISO: fechaISO, horaElaboracion:'10:00',
      fecha: isoToDMY(fechaISO), ts: new Date(fechaISO+'T00:00:00').getTime(), favorito: (k % 5 === 0)
    };
    disenos.push(d);
    d.replicaObjs = [];
    for(var i=1;i<=d.replicas;i++){ d.replicaObjs.push({n:i, nombre:diseñoTitulo(d)+'-R'+i, codigo:''}); }
    crearCargasParaDiseno(d, 'automatico');
    if(k !== 0 && estado !== 'Iniciado'){
      var cargasDeEste = roturaCargas.filter(function(c){ return c.disenoCodigoDiseno===d.codigo; });
      var completarN = estado === 'Completado' ? cargasDeEste.length : Math.ceil(cargasDeEste.length * 0.5);
      cargasDeEste.slice(0, completarN).forEach(function(c){
        var area = 78.5;
        var cargaKg = Math.round((fc*0.9 + (k*37)%(fc*0.3)) * area);
        c.a1=c.a2=c.a3=String(area);
        c.m1kg=c.m2kg=c.m3kg=String(cargaKg);
        c.horaEnsayo = '10:00';
        recalcCarga(c);
      });
      // Datos de slump/temperatura de muestra, para que el informe tenga gráficos reales.
      var slumpBase = 6 + (k%4);
      d.resultados = { replicas: d.replicaObjs.map(function(rep, ri){
        return {
          contacto:'10:0'+ri, pesoUnitario:String(2380+ri*15), aire:'1.'+(5+ri), thermoIni:String(24+ri), thermoFin:String(22+ri),
          cohesividad:'Buena', apariencia:'Homogénea', observaciones:'-',
          slump: SLUMP_ROWS.map(function(_,rowIdx){
            return { hora:String(rowIdx*30), slump:(slumpBase-rowIdx*0.5-ri*0.2).toFixed(1), tempc:String(24-rowIdx+ri), tempa:String(21+rowIdx) };
          })
        };
      })};
    }
  }
  save('sid10_disenos', disenos);
  saveRoturaCargas();
  save('sid10_seed_v5', true);
}
seedMoreDesigns();


/* ================= REAL CSV DESIGNS (PRIMER_REGISTRO, SEGUNDO_REGISTRO, CARGAS) ================= */
var REAL_CSV_DESIGNS = window.SID_REAL_CSV_DESIGNS || []; // definido en data/disenos-reales.js

function seedRealCsvData(){
  if(load('sid10_seed_real_csv_v3', false)) return;

  ['ESTUDIO HE', 'ESTUDIO HE + FLY ASH'].forEach(function(pName){
    if(PROYECTO_CATALOGO.indexOf(pName) === -1){
      PROYECTO_CATALOGO.push(pName);
    }
  });
  saveCatalogo();

  REAL_CSV_DESIGNS.forEach(function(item, k){
    var pid = proyectoId(item.proyecto);
    var fechaISO = item.fecha || '2026-08-12';
    var dmy = isoToDMY(fechaISO);
    var mesNombre = MES_NOMBRES[new Date(fechaISO+'T00:00:00').getMonth()] || 'Agosto';
    var iteracion = mesNombre + ' I';
    registrarIteracion(item.proyecto, iteracion);

    var amcNum = parseFloat(item.amc) || 0.70;
    var fcEst = amcNum <= 0.45 ? '350' : (amcNum <= 0.60 ? '280' : (amcNum <= 0.75 ? '210' : '175'));

    var d = {
      codigo: 'DID-' + String(item.recetaId.replace(/[^0-9]/g,'')).padStart(4,'0'),
      recetaId: item.recetaId,
      proyectoId: pid,
      iteracionId: iteracion,
      nombreTecnico: item.nombreUnificado,
      planta: item.planta || 'Trujillo',
      laboratorio: 'Laboratorio I+D',
      colaborador: item.colaborador || 'JPA/WC',
      responsable: item.responsable || 'KVR',
      uso: 'General / Aplicaciones I+D',
      ndiseno: String(item.recetaId.replace(/[^0-9]/g,'') || (k+1)),
      negocio: 'Pacasmayo Profesional',
      tipo: 'Bombeable',
      fc: fcEst,
      resistencia: (parseFloat(fcEst)/10).toFixed(1),
      cementoTipo: item.nombreUnificado.indexOf('HE') > -1 ? 'HE-PAC' : 'I-PAC',
      amcEfectiva: String(item.amc),
      mix: item.mix || [],
      cvdTotal: item.cvd || 0,
      estado: 'Completado',
      replicas: item.replicaObjs.length,
      diasRotura: [1, 3, 7, 28],
      tipoRotura: 'Probetas',
      fechaElaboracionISO: fechaISO,
      horaElaboracion: '08:00',
      fecha: dmy,
      ts: new Date(fechaISO+'T00:00:00').getTime(),
      favorito: (k === 0 || item.recetaId === 'R-23' || item.recetaId === 'R-25')
    };

    d.replicaObjs = item.replicaObjs.map(function(rep, ri){
      return {
        n: ri + 1,
        nombre: rep.nombre,
        codigo: rep.codigo || ''
      };
    });

    d.resultados = {
      replicas: item.replicaResults || []
    };

    var existingIdx = disenos.findIndex(function(x){ return x.recetaId === d.recetaId || x.codigo === d.codigo; });
    if(existingIdx > -1){
      disenos[existingIdx] = d;
    } else {
      disenos.push(d);
    }

    (item.cargasList || []).forEach(function(cargaItem){
      var area = 78.54;
      var prom = cargaItem.promedio || 0;
      var mKg = Math.round(prom * area);
      var fechaEns = new Date(new Date(fechaISO+'T00:00:00').getTime() + cargaItem.dia * DAY);
      var fechaEnsISO = fechaEns.getFullYear() + '-' + String(fechaEns.getMonth()+1).padStart(2,'0') + '-' + String(fechaEns.getDate()).padStart(2,'0');

      var cExist = roturaCargas.find(function(c){
        return c.replicaNombre === cargaItem.replicaNombre && c.dia === cargaItem.dia;
      });

      if(cExist){
        cExist.disenoCodigoDiseno = d.codigo;
        cExist.codigo = cargaItem.replicaCodigo;
        cExist.producto = cargaItem.replicaNombre;
        cExist.replicaNombre = cargaItem.replicaNombre;
        cExist.proyecto = item.proyecto;
        cExist.iteracion = iteracion;
        cExist.aCargoDe = item.colaborador;
        cExist.fechaElaboracion = fechaISO;
        cExist.fechaEnsayo = fechaEnsISO;
        cExist.estado = 'completado';
        cExist.promedio = String(prom);
        cExist.m1kg = cExist.m2kg = cExist.m3kg = String(mKg);
        cExist.m1kgcm2 = cExist.m2kgcm2 = cExist.m3kgcm2 = String(prom);
        cExist.a1 = cExist.a2 = cExist.a3 = String(area);
      } else {
        roturaCargas.push({
          id: nextRoturaId(),
          codigo: cargaItem.replicaCodigo,
          tipo: 'Probetas',
          disenoCodigoDiseno: d.codigo,
          replicaNombre: cargaItem.replicaNombre,
          producto: cargaItem.replicaNombre,
          proyecto: item.proyecto,
          iteracion: iteracion,
          aCargoDe: item.colaborador,
          fechaElaboracion: fechaISO,
          horaElaboracion: '08:00',
          dia: cargaItem.dia,
          fechaEnsayo: fechaEnsISO,
          toleranciaHoras: toleranciaHoras(cargaItem.dia),
          correoEnviado: false,
          origen: 'manual',
          horaEnsayo: '09:00',
          a1: String(area), a2: String(area), a3: String(area),
          m1kN: '', m2kN: '', m3kN: '',
          m1kg: String(mKg), m2kg: String(mKg), m3kg: String(mKg),
          tipoRoturaM1: 'Cono', tipoRoturaM2: 'Cono', tipoRoturaM3: 'Cono',
          evid1: '', evid2: '', evid3: '',
          m1kgcm2: String(prom), m2kgcm2: String(prom), m3kgcm2: String(prom),
          promedio: String(prom),
          coefVar: '0.00%',
          desvest: '0.00',
          comentarios: '-',
          estado: 'completado'
        });
      }
    });
  });

  save('sid10_disenos', disenos);
  saveRoturaCargas();
  save('sid10_seed_real_csv_v3', true);
}

seedRealCsvData();
