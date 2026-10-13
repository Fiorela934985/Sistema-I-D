/* Sistema I+D — Catálogos fijos: NTP 339.034, plantas/laboratorios, días de rotura y tipos de concreto */
'use strict';

/* ================= NTP 339.034 — Tolerancia de rotura ================= */
var NTP_TABLE = {1:0.5, 3:2, 4:3, 7:6, 28:20, 90:48};
function toleranciaHoras(diaEdad){
  if(NTP_TABLE[diaEdad] !== undefined) return NTP_TABLE[diaEdad];
  return +(diaEdad*24*0.02).toFixed(2);
}
function calcularFechaEnsayo(fechaElabISO, dia){
  if(!fechaElabISO) return '';
  var d = new Date(fechaElabISO + 'T00:00:00');
  d.setDate(d.getDate() + Number(dia));
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}
function ventanaHoraria(horaElab, toleranciaH){
  if(!horaElab) return '';
  var parts = horaElab.split(':');
  var base = new Date(2000,0,1, Number(parts[0]||0), Number(parts[1]||0));
  var ini = new Date(base.getTime() - toleranciaH*3600000);
  var fin = new Date(base.getTime() + toleranciaH*3600000);
  function hm(t){ return String(t.getHours()).padStart(2,'0')+':'+String(t.getMinutes()).padStart(2,'0'); }
  return hm(ini) + ' – ' + hm(fin);
}

var DIAS_PERSONALIZADOS = [1,3,4,7,28,90,180,360];

/* ================= PLANTA -> LABORATORIO ================= */
var PLANTA_LAB = [
  {nombre:'1203 Concreto Piura', codigo:'1203', lab:'1203-PIU'},
  {nombre:'1211 Industrial Pacasmayo', codigo:'1211', lab:'1211-PAC'},
  {nombre:'1213 Industrial Trujillo', codigo:'1213', lab:'1213-TRU'},
  {nombre:'1217 Concreto Chimbote', codigo:'1217', lab:'1217-CHI'},
  {nombre:'1209 Concreto Chiclayo', codigo:'1209', lab:'1209-CIX'},
  {nombre:'1207 Industrial Cajamarca', codigo:'1207', lab:'1207-CAX'},
  {nombre:'1219 Industrial Moche', codigo:'1219', lab:'1219-MCH'},
  {nombre:'1502 Concreto Rioja', codigo:'1502', lab:'1502-RIO'},
  {nombre:'5202 Concreto Tarapoto', codigo:'5202', lab:'5202-TAR'},
  {nombre:'5212 Concreto Moyobamba', codigo:'5212', lab:'5212-MOY'},
  {nombre:'5206 Concreto Iquitos', codigo:'5206', lab:'5206-IQT'},
  {nombre:'KAM-Coam', codigo:'KAM', lab:'KAM-Coa'},
  {nombre:'KAM-Salaverry', codigo:'KAM', lab:'KAM-Sal'}
];
function buildPlantaSelect(){
  var sel = document.getElementById('dis-planta');
  sel.innerHTML = PLANTA_LAB.map(function(p){ return '<option value="'+esc(p.nombre)+'">'+esc(p.nombre)+'</option>'; }).join('');
}
function syncLaboratorio(){
  var planta = document.getElementById('dis-planta').value;
  var info = PLANTA_LAB.filter(function(p){ return p.nombre === planta; })[0];
  document.getElementById('dis-laboratorio').value = info ? info.lab : '';
}
document.getElementById('dis-planta').addEventListener('change', syncLaboratorio);

/* ================= DÍAS DE ROTURA (predeterminado / personalizado) ================= */
function buildDiasCustomChecks(containerId, prefix){
  var wrap = document.getElementById(containerId);
  wrap.innerHTML = DIAS_PERSONALIZADOS.map(function(d){
    return '<label style="display:flex;align-items:center;gap:5px;"><input type="checkbox" data-dia="'+d+'" class="'+prefix+'-dia-check">'+d+' d</label>';
  }).join('');
}
buildDiasCustomChecks('ro-dias-custom-checks', 'ro');

document.getElementById('ro-dias-preset').addEventListener('change', function(){
  document.getElementById('ro-dias-custom-wrap').style.display = this.value === 'custom' ? 'block' : 'none';
  renderRoFechasPreview();
});
function getDiasSeleccionados(prefix){
  var preset = document.getElementById(prefix+'-dias-preset').value;
  if(preset !== 'custom') return preset.split(',').map(Number);
  var checks = document.querySelectorAll('.'+prefix+'-dia-check:checked');
  return Array.prototype.map.call(checks, function(c){ return Number(c.dataset.dia); });
}

/* ---- Tipo de concreto ---- */
var TIPO_CONCRETO_DEFS = [
  {label:'Concreto convencional', code:'C'},
  {label:'Especificado por resistencia a la flexión (Mr)', code:'CF'},
  {label:'Concreto Tremie (bajo agua)', code:'CT'},
  {label:'Concreto autocompactante', code:'CA'},
  {label:'Concreto ligero', code:'CL'},
  {label:'Concreto pesado', code:'CP'},
  {label:'Grout', code:'G'},
  {label:'Mortero', code:'M'},
  {label:'Mortero por volumen', code:'Mv'},
  {label:'Mortero ligero', code:'ML'},
  {label:'Shotcrete', code:'SC'},
  {label:'Relleno fluido', code:'RF'},
  {label:'Concreto por relación a/mc', code:'C'},
  {label:'Concreto de alta resistencia', code:'C'}
];
function buildTipoConcretoSelect(){
  var sel = document.getElementById('dis-tipo-concreto');
  sel.innerHTML = '<option value="">Elegí un tipo…</option>' + TIPO_CONCRETO_DEFS.map(function(t,i){
    return '<option value="'+i+'">'+esc(t.label)+' ('+t.code+')</option>';
  }).join('');
}
function selectedTipoConcretoIndexByLabel(label){
  for(var i=0;i<TIPO_CONCRETO_DEFS.length;i++){ if(TIPO_CONCRETO_DEFS[i].label === label) return i; }
  return -1;
}
