/* Sistema I+D — Reporte RR: estudios comparativos y generación curada */
'use strict';

/* ================= REPORTE RR ================= */
var RR_ROWS = [
  {t:'row', key:'ipac', label:'I-PAC', unit:'kg'},
  {t:'row', key:'hepac', label:'HE-PAC', unit:'kg'},
  {t:'row', key:'flyash', label:'Fly Ash', unit:'kg'},
  {t:'row', key:'agua', label:'Agua', unit:'kg', hl:true},
  {t:'row', key:'arena_qsc', label:'VI-ARENA(0/4.75)-R-QSC-(J)-V', unit:'kg'},
  {t:'row', key:'arena_lvd', label:'VI-ARENA(0/4.75)-R-LVD-(B)-V', unit:'kg'},
  {t:'row', key:'piedra_h67', label:'VI-H67-MQLE-(E)-V', unit:'kg'},
  {t:'row', key:'mrb2025', label:'Master Rheobuild 2025', unit:'kg'},
  {t:'row', key:'mrb1201', label:'Master Rheobuild 1201', unit:'kg'},
  {t:'row', key:'iddnhe', label:'ID-DNHE-10-25', unit:'kg'},
  {t:'row', key:'sika', label:'Sika Plastiment R175', unit:'kg'},
  {t:'row', key:'sikaplast740', label:'Sikaplast 740', unit:'kg'},
  {t:'row', key:'ac', label:'Relación a/c', unit:'', hl:true},
  {t:'row', key:'cvd', label:'CVD', unit:'S/.'},
  {t:'section', label:'Dosis aditivo (% masa cemento)'},
  {t:'row', key:'d_mrb2025', label:'Master Rheobuild 2025', unit:'%'},
  {t:'row', key:'d_mrb1201', label:'Master Rheobuild 1201', unit:'%'},
  {t:'row', key:'d_iddnhe', label:'ID-DNHE-10-25', unit:'%'},
  {t:'row', key:'d_sika', label:'Sika Plastiment R175', unit:'%'},
  {t:'row', key:'d_sikaplast740', label:'Sikaplast 740', unit:'%'},
  {t:'section', label:'Parámetros de diseño'},
  {t:'subsection', label:'Consistencia (pulg)'},
  {t:'row', key:'cons_0', label:'0 pulg'},
  {t:'row', key:'cons_30', label:'30 pulg'},
  {t:'row', key:'cons_60', label:'60 pulg'},
  {t:'row', key:'cons_90', label:'90 pulg'},
  {t:'row', key:'cons_120', label:'120 pulg'},
  {t:'subsection', label:'T° Concreto'},
  {t:'row', key:'tc_0', label:'0 °C'},
  {t:'row', key:'tc_30', label:'30 °C'},
  {t:'row', key:'tc_60', label:'60 °C'},
  {t:'row', key:'tc_90', label:'90 °C'},
  {t:'row', key:'tc_120', label:'120 °C'},
  {t:'subsection', label:'T° Ambiente'},
  {t:'row', key:'ta_0', label:'0 °C'},
  {t:'row', key:'ta_30', label:'30 °C'},
  {t:'row', key:'ta_60', label:'60 °C'},
  {t:'row', key:'ta_90', label:'90 °C'},
  {t:'row', key:'ta_120', label:'120 °C'},
  {t:'row', key:'pu', label:'Peso Unitario', unit:'kg/m3'},
  {t:'row', key:'fragua_i', label:'Fragua inicial', unit:'horas'},
  {t:'row', key:'fragua_f', label:'Fragua final', unit:'horas'},
  {t:'row', key:'aire', label:'Contenido de Aire', unit:'%'},
  {t:'row', key:'cohesividad', label:'Cohesividad', unit:'Visual'},
  {t:'row', key:'apariencia', label:'Apariencia', unit:'Visual'},
  {t:'row', key:'comentarios', label:'Comentarios', unit:''}
];

var rrEstudios = load('sid10_rr', [{
  id:'e1', nombre:'TIPO I VS HE', fecha:'10/08/2026', proyectoId:'ESTUDIO HE', generado:true,
  cabecera:{planta:'Trujillo', ubicacion:'Laboratorio I+D', colaborador:'JPA/WC', responsable:'KVR', fecha:'2026-08-10'},
  tipos:[
    {id:'t1', nombre:'EST HE 0.85 TIPO I', origenDisenoCodigo:'R-23', valores:{ipac:'231',hepac:'-',agua:'194',arena_qsc:'496',arena_lvd:'502',piedra_h67:'971',mrb2025:'3',mrb1201:'2.87',iddnhe:'-',sika:'-',ac:'0.85',cvd:'171.76',d_mrb2025:'1.30%',d_mrb1201:'1.24%',d_iddnhe:'-',d_sika:'-',cons_0:'8 1/2',cons_30:'8',cons_60:'7 1/2',cons_90:'6 1/2',cons_120:'-',tc_0:'25.75',tc_30:'25.7',tc_60:'25.5',tc_90:'25',tc_120:'-',ta_0:'25.85',ta_30:'26.2',ta_60:'26.15',ta_90:'26',ta_120:'-',pu:'2352',fragua_i:'08:29',fragua_f:'10:31',aire:'1.85',cohesividad:'Conforme',apariencia:'Normal',comentarios:'-'}},
    {id:'t2', nombre:'EST HE 0.85 TIPO HE', origenDisenoCodigo:'R-24', valores:{ipac:'-',hepac:'231',agua:'195',arena_qsc:'497',arena_lvd:'502',piedra_h67:'972',mrb2025:'-',mrb1201:'-',iddnhe:'3.79',sika:'0.58',ac:'0.85',cvd:'181.69',d_mrb2025:'-',d_mrb1201:'-',d_iddnhe:'1.64%',d_sika:'0.25%',cons_0:'8 1/2',cons_30:'7 1/2',cons_60:'4 1/4',cons_90:'2 1/4',cons_120:'-',tc_0:'26.25',tc_30:'25.75',tc_60:'25.25',tc_90:'25.25',tc_120:'-',ta_0:'26.25',ta_30:'26.15',ta_60:'26.5',ta_90:'26.7',ta_120:'-',pu:'2354.5',fragua_i:'05:50',fragua_f:'07:38',aire:'1.9',cohesividad:'Conforme',apariencia:'Normal',comentarios:'-'}},
    {id:'t3', nombre:'EST HE 0.70 TIPO I', origenDisenoCodigo:'R-25', valores:{ipac:'281',hepac:'-',agua:'194',arena_qsc:'516',arena_lvd:'501',piedra_h67:'913',mrb2025:'2.81',mrb1201:'2.1',iddnhe:'-',sika:'-',ac:'0.70',cvd:'189.39',d_mrb2025:'1.00%',d_mrb1201:'0.75%',d_iddnhe:'-',d_sika:'-',cons_0:'8 1/2',cons_30:'7 3/4',cons_60:'7 1/2',cons_90:'5 1/2',cons_120:'-',tc_0:'26',tc_30:'26',tc_60:'25.5',tc_90:'25.25',tc_120:'-',ta_0:'25.9',ta_30:'26.15',ta_60:'26.25',ta_90:'26.1',ta_120:'-',pu:'2361.5',fragua_i:'08:30',fragua_f:'10:26',aire:'2.1',cohesividad:'Conforme',apariencia:'Normal',comentarios:'-'}},
    {id:'t4', nombre:'EST HE 0.70 TIPO HE', origenDisenoCodigo:'R-26', valores:{ipac:'-',hepac:'281',agua:'194',arena_qsc:'516',arena_lvd:'501',piedra_h67:'913',mrb2025:'-',mrb1201:'-',iddnhe:'3.15',sika:'1.12',ac:'0.70',cvd:'198.70',d_mrb2025:'-',d_mrb1201:'-',d_iddnhe:'1.12%',d_sika:'0.40%',cons_0:'8 1/2',cons_30:'5 1/2',cons_60:'3 3/4',cons_90:'2 3/4',cons_120:'-',tc_0:'26.5',tc_30:'26.25',tc_60:'24.75',tc_90:'25.25',tc_120:'-',ta_0:'26.25',ta_30:'26.15',ta_60:'26.2',ta_90:'26.2',ta_120:'-',pu:'2378',fragua_i:'07:40',fragua_f:'09:34',aire:'2.25',cohesividad:'Conforme',apariencia:'Normal',comentarios:'-'}}
  ],
  obs:{},
  edades:[
    {edad:'1 d', requisito:'', valores:{t1:'87', t2:'82', t3:'125', t4:'121'}},
    {edad:'3 d', requisito:'', valores:{t1:'152', t2:'140', t3:'193', t4:'199'}},
    {edad:'7 d', requisito:'', valores:{t1:'176', t2:'167', t3:'237', t4:'228'}}
  ]
},
{
  id:'e2', nombre:'TIPO I VS HE (SIN ADITIVO)', fecha:'15/08/2026', proyectoId:'ESTUDIO HE', generado:true,
  cabecera:{planta:'Trujillo', ubicacion:'Laboratorio I+D', colaborador:'JPA/WC', responsable:'KVR', fecha:'2026-08-15'},
  tipos:[
    {id:'t1', nombre:'EST HE 0.70 TIPO I (S/A)', origenDisenoCodigo:'R-27', valores:{ipac:'330',hepac:'-',agua:'220',arena_qsc:'-',arena_lvd:'861',piedra_h67:'986',mrb2025:'-',mrb1201:'-',iddnhe:'-',sika:'-',ac:'0.70',cvd:'0.00',cons_0:'4 3/4',cons_30:'-',cons_60:'-',cons_90:'-',cons_120:'-',tc_0:'25',tc_30:'-',tc_60:'-',tc_90:'-',tc_120:'-',ta_0:'23.4',ta_30:'-',ta_60:'-',ta_90:'-',ta_120:'-',pu:'2348',fragua_i:'04:38',fragua_f:'06:18',aire:'0.9',cohesividad:'Conforme',apariencia:'Normal',comentarios:'-'}},
    {id:'t2', nombre:'EST HE 0.70 TIPO HE (S/A)', origenDisenoCodigo:'R-28', valores:{ipac:'-',hepac:'330',agua:'220',arena_qsc:'-',arena_lvd:'861',piedra_h67:'986',mrb2025:'-',mrb1201:'-',iddnhe:'-',sika:'-',ac:'0.70',cvd:'0.00',cons_0:'4',cons_30:'-',cons_60:'-',cons_90:'-',cons_120:'-',tc_0:'26',tc_30:'-',tc_60:'-',tc_90:'-',tc_120:'-',ta_0:'24.2',ta_30:'-',ta_60:'-',ta_90:'-',ta_120:'-',pu:'2359',fragua_i:'04:24',fragua_f:'06:12',aire:'1.4',cohesividad:'Conforme',apariencia:'Normal',comentarios:'-'}},
    {id:'t3', nombre:'EST HE 0.70 HE 500 (S/A)', origenDisenoCodigo:'R-29', valores:{ipac:'-',hepac:'330',agua:'220',arena_qsc:'-',arena_lvd:'861',piedra_h67:'986',mrb2025:'-',mrb1201:'-',iddnhe:'-',sika:'-',ac:'0.70',cvd:'0.00',cons_0:'4 1/2',cons_30:'-',cons_60:'-',cons_90:'-',cons_120:'-',tc_0:'25',tc_30:'-',tc_60:'-',tc_90:'-',tc_120:'-',ta_0:'22.5',ta_30:'-',ta_60:'-',ta_90:'-',ta_120:'-',pu:'2350',fragua_i:'04:52',fragua_f:'06:46',aire:'1.2',cohesividad:'Conforme',apariencia:'Normal',comentarios:'-'}}
  ],
  obs:{},
  edades:[
    {edad:'1 d', requisito:'', valores:{t1:'66', t2:'98', t3:'116'}},
    {edad:'3 d', requisito:'', valores:{t1:'127', t2:'171', t3:'129'}},
    {edad:'7 d', requisito:'', valores:{t1:'164', t2:'208', t3:''}}
  ]
},
{
  id:'e3', nombre:'TIPO I (TRUJILLO VS MOCHE)', fecha:'14/08/2026', proyectoId:'ESTUDIO HE', generado:true,
  cabecera:{planta:'Trujillo', ubicacion:'Laboratorio I+D', colaborador:'JPA/WC', responsable:'KVR', fecha:'2026-08-14'},
  tipos:[
    {id:'t1', nombre:'EST HE 0.70 TIPO I (TRUJILLO)', origenDisenoCodigo:'R-30', valores:{ipac:'281',hepac:'-',agua:'194',arena_qsc:'516',arena_lvd:'501',piedra_h67:'913',mrb2025:'2.81',mrb1201:'2.1',iddnhe:'-',sika:'-',ac:'0.70',cvd:'0.00',d_mrb2025:'1.00%',d_mrb1201:'0.75%',cons_0:'9',cons_30:'8',cons_60:'7 1/4',cons_90:'7',cons_120:'-',tc_0:'26',tc_30:'25',tc_60:'25',tc_90:'24',tc_120:'-',ta_0:'24.4',ta_30:'24.2',ta_60:'23.8',ta_90:'23.8',ta_120:'-',pu:'2345',fragua_i:'10:05',fragua_f:'11:55',aire:'2.1',cohesividad:'Conforme',apariencia:'Normal',comentarios:'-'}},
    {id:'t2', nombre:'EST HE 0.70 TIPO I (MOCHE)', origenDisenoCodigo:'R-31', valores:{ipac:'281',hepac:'-',agua:'194',arena_qsc:'516',arena_lvd:'501',piedra_h67:'913',mrb2025:'2.81',mrb1201:'2.1',iddnhe:'-',sika:'-',ac:'0.70',cvd:'0.00',d_mrb2025:'1.00%',d_mrb1201:'0.75%',cons_0:'8 1/2',cons_30:'7 1/2',cons_60:'4 3/4',cons_90:'4 1/2',cons_120:'-',tc_0:'26',tc_30:'25.5',tc_60:'24.5',tc_90:'24.5',tc_120:'-',ta_0:'24.2',ta_30:'23.8',ta_60:'23.8',ta_90:'23.6',ta_120:'-',pu:'2345',fragua_i:'07:40',fragua_f:'09:34',aire:'2.4',cohesividad:'Conforme',apariencia:'Normal',comentarios:'-'}}
  ],
  obs:{},
  edades:[
    {edad:'1 d', requisito:'', valores:{t1:'101', t2:'108'}},
    {edad:'3 d', requisito:'', valores:{t1:'189', t2:'203'}},
    {edad:'7 d', requisito:'', valores:{t1:'234', t2:'231'}}
  ]
},
{
  id:'e4', nombre:'COMPARATIVO HE', fecha:'14/08/2026', proyectoId:'ESTUDIO HE', generado:true,
  cabecera:{planta:'Trujillo', ubicacion:'Laboratorio I+D', colaborador:'WC/JPA', responsable:'KVR', fecha:'2026-08-14'},
  tipos:[
    {id:'t1', nombre:'EST HE 0.70 TIPO HE (M3 - M10)', origenDisenoCodigo:'R-33', valores:{ipac:'-',hepac:'281',agua:'194',arena_qsc:'516',arena_lvd:'501',piedra_h67:'913',mrb2025:'-',mrb1201:'-',iddnhe:'3.15',sika:'1.12',ac:'0.70',cvd:'198.70',d_iddnhe:'1.12%',d_sika:'0.40%',cons_0:'8 1/4',cons_30:'4',cons_60:'3',cons_90:'-',cons_120:'-',tc_0:'26',tc_30:'26',tc_60:'25.5',tc_90:'-',tc_120:'-',ta_0:'24.7',ta_30:'25',ta_60:'25',ta_90:'-',ta_120:'-',pu:'2365',fragua_i:'06:14',fragua_f:'08:06',aire:'2.1',cohesividad:'Conforme',apariencia:'Normal',comentarios:'-'}},
    {id:'t2', nombre:'EST HE 0.70 TIPO HE (M1 - M2)', origenDisenoCodigo:'R-34', valores:{ipac:'-',hepac:'281',agua:'194',arena_qsc:'516',arena_lvd:'501',piedra_h67:'913',mrb2025:'-',mrb1201:'-',iddnhe:'3.15',sika:'1.12',ac:'0.70',cvd:'198.70',d_iddnhe:'1.12%',d_sika:'0.40%',cons_0:'6',cons_30:'3 1/4',cons_60:'-',cons_90:'-',cons_120:'-',tc_0:'26.5',tc_30:'25.5',tc_60:'-',tc_90:'-',tc_120:'-',ta_0:'25',ta_30:'25.1',ta_60:'-',ta_90:'-',ta_120:'-',pu:'2350',fragua_i:'05:58',fragua_f:'07:48',aire:'2.5',cohesividad:'Conforme',apariencia:'Normal',comentarios:'-'}}
  ],
  obs:{},
  edades:[
    {edad:'1 d', requisito:'', valores:{t1:'106', t2:'105'}},
    {edad:'3 d', requisito:'', valores:{t1:'205', t2:'205'}},
    {edad:'7 d', requisito:'', valores:{t1:'242', t2:'234'}}
  ]
},
{
  id:'e5', nombre:'TIPO HE + FA', fecha:'14/07/2026', proyectoId:'ESTUDIO HE + FLY ASH', generado:true,
  cabecera:{planta:'Trujillo', ubicacion:'Laboratorio I+D', colaborador:'GAL/WC', responsable:'KVR', fecha:'2026-07-14'},
  tipos:[
    {id:'t1', nombre:'EST HE 0.40 HEV2.0 PATRON', origenDisenoCodigo:'R-15', valores:{hepac:'490',agua:'194',arena_qsc:'521',arena_lvd:'366',piedra_h67:'864',iddnhe:'2.36',sikaplast740:'1.23',ac:'0.40',cvd:'282.49',cons_0:'8.63',cons_30:'7.63',cons_60:'6.13',cons_90:'5.25',tc_0:'24.5',tc_30:'24.5',tc_60:'24.5',tc_90:'24.5',ta_0:'24.4',ta_30:'24.8',ta_60:'25.45',ta_90:'25.75',pu:'2381',fragua_i:'08:09',fragua_f:'10:09',aire:'1.9',cohesividad:'Conforme',apariencia:'Normal',comentarios:'-'}},
    {id:'t2', nombre:'EST HE 0.40 HEV2.0 + FA', origenDisenoCodigo:'R-16', valores:{hepac:'431',flyash:'59',agua:'194',arena_qsc:'515',arena_lvd:'362',piedra_h67:'854',iddnhe:'2.7',sika:'1.23',ac:'0.40',cvd:'261.49',cons_0:'8.63',cons_30:'7.13',cons_60:'5',cons_90:'2.75',tc_0:'24.5',tc_30:'24.75',tc_60:'24.75',tc_90:'24.75',ta_0:'24.65',ta_30:'25.1',ta_60:'25.4',ta_90:'26.1',pu:'2322',fragua_i:'07:38',fragua_f:'09:42',aire:'3.4',cohesividad:'Conforme',apariencia:'Normal',comentarios:'-'}},
    {id:'t3', nombre:'EST HE 0.55 HEV2.0 PATRON', origenDisenoCodigo:'R-17', valores:{hepac:'356',agua:'194',arena_qsc:'576',arena_lvd:'388',piedra_h67:'902',iddnhe:'2.74',sika:'0.89',ac:'0.55',cvd:'227.40',cons_0:'8 3/4',cons_30:'7.63',cons_60:'6.25',cons_90:'4.5',tc_0:'26.25',tc_30:'26',tc_60:'26',tc_90:'25.5',ta_0:'25.6',ta_30:'25.85',ta_60:'25.75',ta_90:'25.65',pu:'2361',fragua_i:'07:52',fragua_f:'09:56',aire:'2.15',cohesividad:'Conforme',apariencia:'Normal',comentarios:'-'}},
    {id:'t4', nombre:'EST HE 0.55 HE + FA', origenDisenoCodigo:'R-18', valores:{hepac:'313',flyash:'43',agua:'194',arena_qsc:'572',arena_lvd:'386',piedra_h67:'896',iddnhe:'2.74',sika:'0.89',ac:'0.55',cvd:'210.28',cons_0:'8 3/4',cons_30:'7.75',cons_60:'7.38',cons_90:'4.38',tc_0:'26.25',tc_30:'26',tc_60:'25.5',tc_90:'25',ta_0:'25.6',ta_30:'25.6',ta_60:'25.8',ta_90:'25.45',pu:'2292',fragua_i:'07:24',fragua_f:'09:32',aire:'3.9',cohesividad:'Conforme',apariencia:'Normal',comentarios:'-'}},
    {id:'t5', nombre:'EST HE 0.70 HEV2.0 PATRON', origenDisenoCodigo:'R-19', valores:{hepac:'281',agua:'194',arena_qsc:'516',arena_lvd:'501',piedra_h67:'913',iddnhe:'3.4',sika:'0.7',ac:'0.70',cvd:'201.61',cons_0:'8.25',cons_30:'6.5',cons_60:'4',cons_90:'2.38',tc_0:'27.25',tc_30:'26.5',tc_60:'25.75',tc_90:'25.5',ta_0:'26.8',ta_30:'26.35',ta_60:'26.05',ta_90:'25.65',pu:'2342.5',fragua_i:'06:03',fragua_f:'07:57',aire:'2.3',cohesividad:'Conforme',apariencia:'Normal',comentarios:'-'}},
    {id:'t6', nombre:'EST HE 0.70 HEV2.0 + FA', origenDisenoCodigo:'R-20', valores:{hepac:'247',flyash:'34',agua:'194',arena_qsc:'513',arena_lvd:'499',piedra_h67:'908',iddnhe:'3.4',sika:'0.7',ac:'0.70',cvd:'188.10',cons_0:'8 1/2',cons_30:'7.25',cons_60:'4',cons_90:'2.38',tc_0:'27',tc_30:'26.5',tc_60:'25.75',tc_90:'25.5',ta_0:'26.4',ta_30:'26.05',ta_60:'25.75',ta_90:'25.15',pu:'2282',fragua_i:'06:09',fragua_f:'08:15',aire:'3.9',cohesividad:'Conforme',apariencia:'Normal',comentarios:'-'}},
    {id:'t7', nombre:'EST HE 0.85 HE PATRON', origenDisenoCodigo:'R-21', valores:{hepac:'231',agua:'195',arena_qsc:'528',arena_lvd:'534',piedra_h67:'909',iddnhe:'3.12',sika:'0.81',ac:'0.85',cvd:'176.21',cons_0:'8 63/100',cons_30:'8.13',cons_60:'6.38',cons_90:'3.75',tc_0:'25',tc_30:'24.5',tc_60:'24.75',tc_90:'24.75',ta_0:'23.85',ta_30:'24.15',ta_60:'24.45',ta_90:'24.85',pu:'2337',fragua_i:'07:03',fragua_f:'08:54',aire:'2',cohesividad:'Conforme',apariencia:'Normal',comentarios:'-'}},
    {id:'t8', nombre:'EST HE 0.85 HEV2.0 + FA', origenDisenoCodigo:'R-22', valores:{hepac:'203',flyash:'28',agua:'194',arena_qsc:'525',arena_lvd:'531',piedra_h67:'903',iddnhe:'4.77',sika:'0.81',ac:'0.85',cvd:'177.27',cons_0:'8 1/2',cons_30:'8',cons_60:'7',cons_90:'3.25',tc_0:'25',tc_30:'24.75',tc_60:'24.5',tc_90:'24.5',ta_0:'23.95',ta_30:'24.2',ta_60:'24.65',ta_90:'24.75',pu:'2305.5',fragua_i:'06:59',fragua_f:'08:58',aire:'2.95',cohesividad:'Conforme',apariencia:'Normal',comentarios:'-'}}
  ],
  obs:{},
  edades:[
    {edad:'1 d', requisito:'', valores:{t1:'270', t2:'229', t3:'160', t4:'128', t5:'106', t6:'86', t7:'69', t8:'56'}},
    {edad:'3 d', requisito:'', valores:{t1:'337', t2:'311', t3:'247', t4:'232', t5:'191', t6:'156', t7:'135', t8:'110'}},
    {edad:'7 d', requisito:'', valores:{t1:'393', t2:'353', t3:'299', t4:'264', t5:'215', t6:'196', t7:'155', t8:'128'}},
    {edad:'28 d', requisito:'', valores:{t1:'445', t2:'430', t3:'315', t4:'342', t5:'257', t6:'233', t7:'195', t8:'177'}}
  ]
}]);
var rrActiveId = rrEstudios.length ? rrEstudios[0].id : null;

function rrFind(id){ return rrEstudios.filter(function(e){ return e.id === id; })[0]; }

function renderRRStudyList(){
  var wrap = document.getElementById('rr-study-list');
  wrap.innerHTML = rrEstudios.map(function(e){
    return '<div class="rr-study-card'+(e.id===rrActiveId?' active':'')+'" data-id="'+e.id+'">' +
      '<h5>'+esc(e.nombre)+'</h5><span>'+e.tipos.length+' tipos · '+e.fecha+(e.proyectoId?(' · '+esc(proyectoNombre(e.proyectoId))):'')+'</span>' +
    '</div>';
  }).join('');
  document.getElementById('rr-count').textContent = rrEstudios.length + ' estudios';
  updateStats();
}
document.getElementById('rr-study-list').addEventListener('click', function(e){
  var card = e.target.closest('.rr-study-card');
  if(!card) return;
  rrActiveId = card.dataset.id;
  renderRRStudyList();
  renderRRDetail();
});
document.getElementById('rr-new-btn').addEventListener('click', function(){
  var input = document.getElementById('rr-new-name');
  var nombre = input.value.trim();
  if(!nombre){ toast('Ingresá el nombre del estudio'); return; }
  var hoy = new Date();
  var fecha = String(hoy.getDate()).padStart(2,'0') + '/' + String(hoy.getMonth()+1).padStart(2,'0') + '/' + hoy.getFullYear();
  var newId = 'e' + Date.now();
  rrEstudios.push({id:newId, nombre:'Estudio '+nombre, fecha:fecha, tipos:[{id:'t'+Date.now(), nombre:'Tipo 1', valores:{}}], obs:{}, edades:[]});
  save('sid10_rr', rrEstudios);
  rrActiveId = newId;
  input.value = '';
  renderRRStudyList();
  renderRRDetail();
  toast('Estudio creado');
});

function renderRRDetail(){
  var estudio = rrFind(rrActiveId);
  var titleEl = document.getElementById('rr-current-title');
  var addTipoBtn = document.getElementById('rr-add-tipo');
  if(!estudio){
    titleEl.textContent = '—';
    addTipoBtn.style.display = 'none';
    document.getElementById('rr-table-holder').innerHTML = '<div class="empty-note">Creá un estudio para empezar a comparar tipos.</div>';
    document.getElementById('rr-edad-holder').innerHTML = '';
    return;
  }
  titleEl.textContent = estudio.nombre;
  addTipoBtn.style.display = 'inline-block';

  if(!estudio.cabecera) estudio.cabecera = {planta:'', ubicacion:'Laboratorio I+D', colaborador:'', responsable:'', fecha:todayISO()};
  var cab = estudio.cabecera;
  document.getElementById('rr-print-head').innerHTML =
    '<div class="rrp-logo"><img src="'+DINO_LOGO_URL+'" alt="DINO"></div>' +
    '<div class="rrp-body">' +
      '<div class="rrp-title">Resumen de reporte de resultados de mezclas de prueba</div>' +
      '<div class="rrp-grid">' +
        '<div class="rrp-field"><b>Planta</b><input data-cab="planta" value="'+esc(cab.planta||'')+'" placeholder="Ej. Trujillo"></div>' +
        '<div class="rrp-field"><b>Fecha</b><input type="date" data-cab="fecha" value="'+esc(cab.fecha||'')+'"></div>' +
        '<div class="rrp-field"><b>Ubicación</b><input data-cab="ubicacion" value="'+esc(cab.ubicacion||'')+'"></div>' +
        '<div class="rrp-field"><b>Colaborador</b><input data-cab="colaborador" value="'+esc(cab.colaborador||'')+'" placeholder="Iniciales"></div>' +
        '<div class="rrp-field"><b>Proyecto</b><input value="'+esc(estudio.proyectoId ? proyectoNombre(estudio.proyectoId) : estudio.nombre)+'" readonly></div>' +
        '<div class="rrp-field"><b>Responsable</b><input data-cab="responsable" value="'+esc(cab.responsable||'')+'" placeholder="Nombre"></div>' +
      '</div>' +
    '</div>';

  var theadCols = '<th>Diseño</th>' + estudio.tipos.map(function(t,ti){
    return '<th><div class="rr-th-inner">' +
      '<input class="rr-tipo-name" data-ti="'+ti+'" value="'+esc(t.nombre)+'">' +
      (estudio.tipos.length>1 ? '<button class="rr-del-col" data-ti="'+ti+'" title="Eliminar tipo">×</button>' : '') +
    '</div></th>';
  }).join('') + '<th>Observ.</th>';

  var rowsHtml = RR_ROWS.map(function(r){
    if(r.t === 'section') return '<tr class="rr-section"><td colspan="'+(estudio.tipos.length+2)+'">'+r.label+'</td></tr>';
    if(r.t === 'subsection') return '<tr class="rr-subsection"><td colspan="'+(estudio.tipos.length+2)+'">'+r.label+'</td></tr>';
    var cells = estudio.tipos.map(function(t,ti){
      var val = t.valores[r.key] !== undefined ? t.valores[r.key] : '';
      return '<td><input class="rr-cell" data-row="'+r.key+'" data-ti="'+ti+'" value="'+esc(val)+'"></td>';
    }).join('');
    var obsVal = estudio.obs[r.key] !== undefined ? estudio.obs[r.key] : '-';
    return '<tr'+(r.hl?' class="rr-highlight"':'')+'>' +
      '<td class="rr-label">'+r.label+(r.unit?' <span class="unit mono">('+r.unit+')</span>':'')+'</td>' +
      cells +
      '<td><input class="rr-cell" data-obs="'+r.key+'" value="'+esc(obsVal)+'"></td>' +
    '</tr>';
  }).join('');

  document.getElementById('rr-table-holder').innerHTML =
    '<table class="rr-table"><thead><tr>'+theadCols+'</tr></thead><tbody>'+rowsHtml+'</tbody></table>';

  var edadHead = '<th>Edad</th>' + estudio.tipos.map(function(t){ return '<th>'+esc(t.nombre)+'</th>'; }).join('') + '<th>Requisito/Parámetro</th>';
  var edadRows = estudio.edades.map(function(e, ei){
    var cells = estudio.tipos.map(function(t){
      var val = e.valores[t.id] !== undefined ? e.valores[t.id] : '';
      return '<td><input class="rr-cell" data-edad="'+ei+'" data-tid="'+t.id+'" value="'+esc(val)+'"></td>';
    }).join('');
    return '<tr><td><input class="rr-cell" data-edad-label="'+ei+'" value="'+esc(e.edad)+'"></td>'+cells+'<td><input class="rr-cell" data-edad-req="'+ei+'" value="'+esc(e.requisito||'')+'"></td></tr>';
  }).join('');
  document.getElementById('rr-edad-holder').innerHTML = estudio.edades.length
    ? '<table class="rr-table"><thead><tr>'+edadHead+'</tr></thead><tbody>'+edadRows+'</tbody></table>'
    : '<div class="empty-note">Sin edades registradas todavía.</div>';

  renderRRCharts(estudio);
}

document.getElementById('rr-print-head').addEventListener('input', function(e){
  var estudio = rrFind(rrActiveId);
  if(!estudio || !e.target.dataset.cab) return;
  estudio.cabecera[e.target.dataset.cab] = e.target.value;
  save('sid10_rr', rrEstudios);
});

var rrCharts = [];
function rrChartCanvas(id, titulo){
  return '<div class="rr-chart-card"><h5>'+titulo+'</h5><canvas id="'+id+'"></canvas></div>';
}
function renderRRCharts(estudio){
  var wrap = document.getElementById('rr-charts-grid');
  rrCharts.forEach(function(c){ c.destroy(); });
  rrCharts = [];
  if(typeof Chart === 'undefined' || !estudio.tipos.length){
    wrap.innerHTML = '<div class="empty-note">Completá al menos un tipo con datos para ver los gráficos.</div>';
    return;
  }
  Chart.defaults.color = '#14181a';
  Chart.defaults.plugins.legend.labels.color = '#14181a';
  wrap.innerHTML =
    rrChartCanvas('rr-chart-fragua', 'Tiempo de fragua (hh:mm)') +
    rrChartCanvas('rr-chart-resist', 'Resistencia vs Tiempo') +
    rrChartCanvas('rr-chart-slump', 'Trabajabilidad (pérdida de asentamiento)');

  var colores = ['#0099cc','#0a3d4d','#4caf3e','#7c3aed','#ea580c'];
  function hmToMin(s){
    if(s === null || s === undefined || s === '' || s === '-') return null;
    s = String(s).trim();
    if(!s || s === '-') return null;
    if(s.indexOf(':') > -1){
      var p = s.split(':');
      var h = parseFloat(p[0]) || 0;
      var m = parseFloat(p[1]) || 0;
      return h * 60 + m;
    }
    var val = parseFloat(s);
    if(!isNaN(val) && val > 0) return val * 60;
    return null;
  }

  // Tiempo de fragua: barras horizontales apiladas bicolores con etiquetas
  var labelsFragua = estudio.tipos.map(function(t){ return t.nombre; });
  var iniMin = estudio.tipos.map(function(t){ return hmToMin(t.valores.fragua_i) || 0; });
  var durMin = estudio.tipos.map(function(t,i){
    var f = hmToMin(t.valores.fragua_f);
    if(f === null) return 0;
    return f > iniMin[i] ? f - iniMin[i] : f;
  });
  rrCharts.push(new Chart(document.getElementById('rr-chart-fragua'), {
    type:'bar',
    data:{
      labels:labelsFragua,
      datasets:[
        {label:'Fragua Inicial', data:iniMin, backgroundColor:'#1688fe', hoverBackgroundColor:'#1273d8'},
        {label:'Fragua Final', data:durMin, backgroundColor:'#0c2288', hoverBackgroundColor:'#091a6d'}
      ]
    },
    options:{
      indexAxis:'y',
      responsive:true,
      maintainAspectRatio:false,
      plugins:{
        legend:{
          display:true,
          position:'top',
          labels:{usePointStyle:true, pointStyle:'circle', boxWidth:8, boxHeight:8, padding:12, font:{weight:600, size:11}}
        },
        tooltip:{
          callbacks:{
            label:function(ctx){
              var dIdx = ctx.datasetIndex;
              var i = ctx.dataIndex;
              var ini = iniMin[i];
              var dur = durMin[i];
              if(dIdx === 0){
                return 'Fragua Inicial: ' + minToHm(ini);
              } else {
                return 'Fragua Final: ' + minToHm(ini + dur) + ' (Lapso: ' + minToHm(dur) + ')';
              }
            }
          }
        }
      },
      scales:{
        x:{
          stacked:true,
          title:{display:true, text:'Minutos desde elaboración', font:{weight:600}},
          ticks:{
            callback:function(val){
              var h = Math.floor(val/60);
              var m = Math.round(val%60);
              return (h<10?'0':'')+h+':'+(m<10?'0':'')+m;
            }
          }
        },
        y:{stacked:true, title:{display:true, text:'DISEÑO', font:{weight:700}}}
      }
    },
    plugins:[fraguaDataLabelsPlugin]
  }));

  // Resistencia vs Tiempo (línea) — usa la tabla de Edad
  var datasetsResist = estudio.tipos.map(function(t, ti){
    var pts = estudio.edades.map(function(e){ return {x:Number((e.edad||'0').replace(/[^\d.]/g,'')) || 0, y:Number(e.valores[t.id])||0}; }).sort(function(a,b){return a.x-b.x;});
    return {label:t.nombre, data:pts, borderColor:colores[ti%5], backgroundColor:colores[ti%5], pointRadius:5, pointHoverRadius:7, borderWidth:2.5, tension:.3};
  });
  rrCharts.push(new Chart(document.getElementById('rr-chart-resist'), {
    type:'line', data:{datasets:datasetsResist},
    options:{responsive:true, maintainAspectRatio:false, scales:{x:{type:'linear', title:{display:true,text:'Días'}}, y:{title:{display:true,text:'Carga (kg)'}}}}
  }));

  // Trabajabilidad — consistencia a 0/30/60/90 min por tipo
  var minutos = ['cons_0','cons_30','cons_60','cons_90'];
  var minutosLbl = ['0','30','60','90'];
  function pulgToNum(s){ if(!s || s==='-') return 0; if(s.indexOf(' ')>-1){ var pp=s.split(' '); var fr=pp[1].split('/'); return Number(pp[0])+Number(fr[0])/Number(fr[1]); } if(s.indexOf('/')>-1){ var fr2=s.split('/'); return Number(fr2[0])/Number(fr2[1]); } return Number(s)||0; }
  var datasetsSlump = minutos.map(function(key, mi){
    return {label:minutosLbl[mi]+"'", data: estudio.tipos.map(function(t){ return pulgToNum(t.valores[key]); }), backgroundColor: colores[mi%5]};
  });
  rrCharts.push(new Chart(document.getElementById('rr-chart-slump'), {
    type:'bar', data:{labels:labelsFragua, datasets:datasetsSlump},
    options:{responsive:true, maintainAspectRatio:false, scales:{y:{title:{display:true,text:'Slump (pulgadas)'}}}}
  }));
}

document.getElementById('rr-table-holder').addEventListener('input', function(e){
  var estudio = rrFind(rrActiveId);
  if(!estudio) return;
  var el = e.target;
  if(el.classList.contains('rr-tipo-name')){
    estudio.tipos[Number(el.dataset.ti)].nombre = el.value;
  } else if(el.dataset.obs){
    estudio.obs[el.dataset.obs] = el.value;
  } else if(el.dataset.row){
    estudio.tipos[Number(el.dataset.ti)].valores[el.dataset.row] = el.value;
  }
  save('sid10_rr', rrEstudios);
  renderRRCharts(estudio);
});
document.getElementById('rr-table-holder').addEventListener('click', function(e){
  var btn = e.target.closest('.rr-del-col');
  if(!btn) return;
  var estudio = rrFind(rrActiveId);
  var removed = estudio.tipos.splice(Number(btn.dataset.ti), 1)[0];
  estudio.edades.forEach(function(ed){ delete ed.valores[removed.id]; });
  save('sid10_rr', rrEstudios);
  renderRRDetail();
  toast('Tipo eliminado');
});
document.getElementById('rr-add-tipo').addEventListener('click', function(){
  var estudio = rrFind(rrActiveId);
  if(!estudio) return;
  var id = 't' + Date.now();
  estudio.tipos.push({id:id, nombre:'Nuevo tipo', valores:{}});
  save('sid10_rr', rrEstudios);
  renderRRDetail();
});
document.getElementById('rr-edad-holder').addEventListener('input', function(e){
  var estudio = rrFind(rrActiveId);
  if(!estudio) return;
  var el = e.target;
  if(el.dataset.edadLabel !== undefined){ estudio.edades[Number(el.dataset.edadLabel)].edad = el.value; }
  else if(el.dataset.edadReq !== undefined){ estudio.edades[Number(el.dataset.edadReq)].requisito = el.value; }
  else if(el.dataset.edad !== undefined){ estudio.edades[Number(el.dataset.edad)].valores[el.dataset.tid] = el.value; }
  save('sid10_rr', rrEstudios);
  renderRRCharts(estudio);
});
document.getElementById('rr-add-edad').addEventListener('click', function(){
  var estudio = rrFind(rrActiveId);
  if(!estudio) return;
  var valores = {};
  estudio.tipos.forEach(function(t){ valores[t.id] = ''; });
  estudio.edades.push({edad:'Nueva edad', requisito:'', valores:valores});
  save('sid10_rr', rrEstudios);
  renderRRDetail();
});

/* ---- Generar Reporte RR (curado): selección manual de diseños promediados ---- */
var rrgTabActive = 'pendientes';
document.getElementById('btn-generar-rr').addEventListener('click', function(){
  refreshAllProyectoSelects();
  renderRRGDisponibles();
  document.getElementById('rr-generar-modal').classList.add('show');
});
document.getElementById('rr-generar-close').addEventListener('click', function(){ document.getElementById('rr-generar-modal').classList.remove('show'); });
document.getElementById('rrg-cancelar-btn').addEventListener('click', function(){ document.getElementById('rr-generar-modal').classList.remove('show'); });
document.querySelectorAll('.rr-disponibles-tabs button').forEach(function(btn){
  btn.addEventListener('click', function(){
    rrgTabActive = btn.dataset.tab;
    document.querySelectorAll('.rr-disponibles-tabs button').forEach(function(b){ b.classList.toggle('active', b===btn); });
    renderRRGDisponibles();
  });
});
var rrgSeleccion = [];
function disenoYaGenerado(codigo){
  return rrEstudios.some(function(e){ return e.generado && e.tipos.some(function(t){ return t.origenDisenoCodigo === codigo; }); });
}
function renderRRGDisponibles(){
  var proyId = document.getElementById('rrg-proyecto').value;
  var candidatos = disenos.filter(function(d){
    if(proyId && d.proyectoId !== proyId) return false;
    return semaforoDiseno(d) !== 'rojo';
  });
  candidatos = candidatos.filter(function(d){ return rrgTabActive === 'generados' ? disenoYaGenerado(d.codigo) : !disenoYaGenerado(d.codigo); });
  var tbody = document.getElementById('rrg-disponibles-tbody');
  if(!candidatos.length){ tbody.innerHTML = '<tr><td colspan="5" style="color:var(--text-muted);">Sin registros promediados disponibles.</td></tr>'; return; }
  tbody.innerHTML = candidatos.map(function(d){
    var combinado = nombreUnificadoPromedio(d);
    var resumen = Object.keys(combinado).sort(function(a,b){return a-b;}).map(function(dia){ return dia+'d: '+combinado[dia].promedio+' kg/cm²'; }).join(' · ') || 'Sin cargas aún';
    var yaSel = rrgSeleccion.indexOf(d.codigo) > -1;
    return '<tr>' +
      '<td>'+semaforoDotHtml(semaforoDiseno(d))+' '+esc(diseñoTitulo(d))+'</td>' +
      '<td>'+esc(proyectoNombre(d.proyectoId)||'-')+'</td>' +
      '<td class="mono">'+resumen+'</td>' +
      '<td>'+esc(d.fecha)+'</td>' +
      '<td><button class="btn-add ghost" data-act="anadir-rrg" data-codigo="'+d.codigo+'">'+(yaSel?'Añadido':'+ Añadir')+'</button></td>' +
    '</tr>';
  }).join('');
}
document.getElementById('rrg-disponibles-tbody').addEventListener('click', function(e){
  var btn = e.target.closest('[data-act="anadir-rrg"]');
  if(!btn) return;
  var codigo = btn.dataset.codigo;
  if(rrgSeleccion.indexOf(codigo) === -1){ rrgSeleccion.push(codigo); toast('Diseño añadido al reporte'); }
  else { rrgSeleccion = rrgSeleccion.filter(function(c){ return c!==codigo; }); toast('Diseño quitado del reporte'); }
  renderRRGDisponibles();
});
document.getElementById('rrg-generar-btn').addEventListener('click', function(){
  var nombre = document.getElementById('rrg-nombre').value.trim();
  if(!nombre){ toast('Ingresá el nombre del RR'); return; }
  if(!rrgSeleccion.length){ toast('Añadí al menos un diseño promediado'); return; }
  var hoy = new Date();
  var fecha = String(hoy.getDate()).padStart(2,'0') + '/' + String(hoy.getMonth()+1).padStart(2,'0') + '/' + hoy.getFullYear();
  var tipos = rrgSeleccion.map(function(codigo){
    var d = disenos.filter(function(x){ return x.codigo===codigo; })[0];
    var combinado = nombreUnificadoPromedio(d);
    var valores = {ac: d.amcEfectiva||'', cvd: d.cvdTotal||''};
    return {id:'t'+Date.now()+Math.floor(Math.random()*1000), nombre: diseñoTitulo(d), valores: valores, origenDisenoCodigo: d.codigo, combinadoPorEdad: combinado};
  });
  var edadesSet = {};
  tipos.forEach(function(t){ Object.keys(t.combinadoPorEdad||{}).forEach(function(dia){ edadesSet[dia]=true; }); });
  var edades = Object.keys(edadesSet).sort(function(a,b){return a-b;}).map(function(dia){
    var valores = {};
    tipos.forEach(function(t){ valores[t.id] = (t.combinadoPorEdad[dia]||{}).promedio || ''; });
    return {edad: dia+' d', requisito: document.getElementById('rrg-requisito').value.trim(), valores: valores};
  });
  var newId = 'e' + Date.now();
  rrEstudios.push({id:newId, nombre:nombre, fecha:fecha, proyectoId: document.getElementById('rrg-proyecto').value, tipo:document.querySelector('input[name="rrg-tipo"]:checked').value, generado:true, tipos:tipos, obs:{}, edades:edades});
  save('sid10_rr', rrEstudios);
  rrActiveId = newId;
  rrgSeleccion = [];
  document.getElementById('rrg-nombre').value = '';
  document.getElementById('rrg-requisito').value = '';
  document.getElementById('rr-generar-modal').classList.remove('show');
  renderRRStudyList();
  renderRRDetail();
  toast('Reporte RR generado');
  showPanel('reporte-rr');
});
