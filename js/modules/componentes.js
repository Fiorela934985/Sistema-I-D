/* Sistema I+D — Entidad COMPONENTE: materiales por categoría (Registro) */
'use strict';

/* ================= COMPONENTES ================= */
var FIELD_LABELS = {
  norma:'Norma', tipo:'Tipo', sap:'Código SAP', rho:'ρ Bseca (kg/m³)',
  absorcion:'Absorción (%)', humedad:'Humedad (%)', mfinura:'Módulo de Finura', tmn:'TMN A.G.',
  pasa200:'Pasa 200 <0.075mm', pasa100:'Pasa 100 <0.15mm', pus:'PUS (kg/m³)', wr:'WR',
  costo:'Costo (S./kg)', procedencia:'Procedencia', dosis:'Dosis (%)', funcion:'Función'
};
var CAT_DEFS = [
  {id:'Cemento', desc:'Cementos y precursores cementantes usados como base del diseño.', icon:'<path d="M21 8l-9-5-9 5 9 5 9-5z"/><path d="M3 8v8l9 5 9-5V8"/><path d="M12 13v8"/>', fields:['norma','tipo','sap','rho','pus','costo','procedencia']},
  {id:'Adición', desc:'Adiciones minerales y puzolánicas.', icon:'<path d="M9 2v6L4 20a1 1 0 0 0 1 2h14a1 1 0 0 0 1-2L15 8V2"/><line x1="8" y1="2" x2="16" y2="2"/>', fields:['norma','sap','rho','pus','costo','procedencia']},
  {id:'Agua', desc:'Agua de mezcla y hielo.', icon:'<path d="M12 2s7 8.5 7 13a7 7 0 0 1-14 0c0-4.5 7-13 7-13z"/>', fields:['sap','rho','pus','costo','procedencia']},
  {id:'Pigmento', desc:'Pigmentos para concreto decorativo.', icon:'<path d="M12 3a9 9 0 1 0 0 18c1.1 0 2-.9 2-2 0-.5-.2-1-.5-1.4-.3-.4-.5-.9-.5-1.4 0-1.1.9-2 2-2h2a4 4 0 0 0 4-4c0-4.4-4-7.2-9-7.2z"/><circle cx="7.5" cy="10.5" r="1"/><circle cx="12" cy="7.5" r="1"/><circle cx="16.5" cy="10.5" r="1"/>', fields:['sap','rho','pus','costo','procedencia']},
  {id:'Piedra', desc:'Agregado grueso: piedra chancada y grava.', icon:'<path d="M3 20l6-10 4 6 3-4 5 8H3z"/>', fields:['norma','tipo','sap','rho','absorcion','humedad','mfinura','tmn','pasa200','pasa100','pus','wr','costo','procedencia']},
  {id:'Arena', desc:'Agregado fino: arenas naturales y combinadas.', icon:'<circle cx="6" cy="6" r="1.6"/><circle cx="12" cy="6" r="1.6"/><circle cx="18" cy="6" r="1.6"/><circle cx="6" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="18" cy="12" r="1.6"/><circle cx="6" cy="18" r="1.6"/><circle cx="12" cy="18" r="1.6"/><circle cx="18" cy="18" r="1.6"/>', fields:['norma','tipo','sap','rho','absorcion','humedad','mfinura','tmn','pasa200','pasa100','pus','wr','costo','procedencia']},
  {id:'Aditivo', desc:'Aditivos químicos: plastificantes, reductores y modificadores.', icon:'<path d="M9 2h6"/><path d="M10 2v6.5l-4.5 9A2 2 0 0 0 7.3 20h9.4a2 2 0 0 0 1.8-2.5l-4.5-9V2"/>', fields:['norma','tipo','sap','rho','dosis','funcion','costo','procedencia']}
];
function catDef(id){ return CAT_DEFS.filter(function(c){ return c.id === id; })[0]; }

var componentes = load('sid10_componentes', [
  {categoria:'Cemento', nombre:'MS(MH)-PAC', peso:'1500', norma:'NTP 334.088', tipo:'Performance', sap:'002-00066', rho:'2910', pus:'1500', costo:'0.49363', procedencia:'Fabricante: CPSSA'},
  {categoria:'Adición', nombre:'AMNA Filler', peso:'1300', norma:'-', sap:'002-01218', rho:'2700', pus:'1300', costo:'0.15289', procedencia:'-'},
  {categoria:'Agua', nombre:'Agua', peso:'1000', sap:'Código', rho:'1000', pus:'1000', costo:'0.00', procedencia:'Red pública'},
  {categoria:'Agua', nombre:'Hielo', peso:'1000', sap:'Código', rho:'1000', pus:'1000', costo:'0.40', procedencia:'Fábrica'},
  {categoria:'Pigmento', nombre:'Pigmento Amarillo', peso:'25', sap:'238-00041', rho:'2000', pus:'-', costo:'4.01', procedencia:'-'},
  {categoria:'Piedra', nombre:'VI-H67-M-QLE-(E)-V', peso:'913', norma:'NTP 400.037', tipo:'Z', sap:'002-00622', rho:'2690', absorcion:'1.00', humedad:'0.38', mfinura:'6.93', tmn:'0.75', pasa200:'0.60', pasa100:'-8.33', pus:'1450', wr:'-', costo:'0.03251', procedencia:'Cantera Quebrada León'},
  {categoria:'Arena', nombre:'VI-ARENA(0/4.75)-R-QSC-(J)-V', peso:'656', norma:'NTP 400.037', tipo:'Z', sap:'002-00573', rho:'2650', absorcion:'0.70', humedad:'0.80', mfinura:'2.27', tmn:'4.75', pasa200:'2.60', pasa100:'21.78', pus:'1486', wr:'-', costo:'0.0171', procedencia:'Cantera Quebrada San Carlos'},
  {categoria:'Aditivo', nombre:'Master Rheobuild 1201', peso:'3.28', norma:'C494', tipo:'F', sap:'902-00940', rho:'1230', dosis:'0.60', funcion:'Reductor de agua', costo:'3.30', procedencia:'Fabricante: BASF-Perú'},
  {categoria:'Aditivo', nombre:'Master Rheobuild 2025', peso:'4.91', norma:'C494', tipo:'D', sap:'902-00989', rho:'1250', dosis:'0.90', funcion:'Superplastificante', costo:'3.30', procedencia:'Fabricante: BASF-Perú'}
]);
var activeCompCat = null;
var compEditingIndex = null;

function renderCompCatGrid(){
  var grid = document.getElementById('comp-cat-grid');
  var tiles = CAT_DEFS.map(function(c){
    var count = componentes.filter(function(x){ return x.categoria === c.id; }).length;
    return '<button class="comp-cat-tile" data-cat="'+c.id+'">' +
      '<span class="icon-wrap"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'+c.icon+'</svg></span>' +
      '<span class="cct-txt"><h4>'+c.id+'</h4><small>'+esc(c.desc)+'</small></span><span class="cct-count">'+count+'</span>' +
    '</button>';
  }).join('');
  var proyCount = todosLosProyectoIds().length;
  tiles += '<button class="comp-cat-tile" data-cat="Proyecto">' +
    '<span class="icon-wrap"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"/></svg></span>' +
    '<span class="cct-txt"><h4>Proyecto</h4><small>Proyectos de investigación y sus iteraciones mensuales.</small></span><span class="cct-count">'+proyCount+'</span>' +
  '</button>';
  grid.innerHTML = tiles;
}
document.getElementById('comp-cat-grid').addEventListener('click', function(e){
  var tile = e.target.closest('.comp-cat-tile');
  if(!tile) return;
  activeCompCat = tile.dataset.cat;
  compEditingIndex = null;
  proyEditing = null;
  renderComponentesPanel();
});
document.getElementById('comp-back-btn').addEventListener('click', function(){
  activeCompCat = null;
  renderComponentesPanel();
});
document.getElementById('proy-back-btn').addEventListener('click', function(){
  activeCompCat = null;
  renderComponentesPanel();
});

function buildCompForm(def){
  var wrap = document.getElementById('comp-field-grid');
  wrap.innerHTML = def.fields.map(function(k){
    return '<div class="field-mini"><label>'+FIELD_LABELS[k]+'</label><input type="text" id="comp-f-'+k+'" placeholder="'+FIELD_LABELS[k]+'"></div>';
  }).join('');
}
function resetCompForm(){
  document.getElementById('comp-nombre').value = '';
  document.getElementById('comp-peso').value = '';
  var def = catDef(activeCompCat);
  if(def) def.fields.forEach(function(k){ var el = document.getElementById('comp-f-'+k); if(el) el.value = ''; });
  compEditingIndex = null;
  document.getElementById('comp-add').textContent = '+ Agregar componente';
  document.getElementById('comp-cancel').style.display = 'none';
}
function renderComponentesPanel(){
  var def = catDef(activeCompCat);
  var gridEl = document.getElementById('comp-cat-grid');
  var bodyEl = document.getElementById('comp-body');
  var proyEl = document.getElementById('proy-body');
  if(activeCompCat === 'Proyecto'){
    gridEl.style.display = 'none';
    bodyEl.style.display = 'none';
    proyEl.style.display = 'block';
    document.getElementById('comp-title').textContent = 'Proyecto';
    document.getElementById('comp-count').textContent = todosLosProyectoIds().length + ' registros';
    renderProyCrud();
    return;
  }
  proyEl.style.display = 'none';
  if(!def){
    gridEl.style.display = 'grid';
    bodyEl.style.display = 'none';
    document.getElementById('comp-title').textContent = 'Registro';
    document.getElementById('comp-count').textContent = componentes.length + ' registros';
    renderCompCatGrid();
    return;
  }
  gridEl.style.display = 'none';
  bodyEl.style.display = 'block';
  document.getElementById('comp-title').textContent = def.id;
  buildCompForm(def);

  var items = componentes.filter(function(c){ return c.categoria === def.id; });
  document.getElementById('comp-count').textContent = items.length + ' registros';

  var theadRow = document.getElementById('comp-thead-row');
  theadRow.innerHTML = '<th>Nombre</th><th>Peso</th>' + def.fields.map(function(k){ return '<th>'+FIELD_LABELS[k]+'</th>'; }).join('') + '<th></th>';

  var tbody = document.getElementById('comp-tbody');
  tbody.innerHTML = items.map(function(c){
    var i = componentes.indexOf(c);
    var cells = def.fields.map(function(k){ return '<td class="mono">'+esc(c[k]||'-')+'</td>'; }).join('');
    return '<tr>' +
      '<td>'+esc(c.nombre)+'</td>' +
      '<td class="mono">'+esc(c.peso||'-')+'</td>' +
      cells +
      '<td><div class="row-actions">' +
        '<button class="btn-icon edit" data-perm="componentes:editar" data-i="'+i+'" title="Editar"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>' +
        '<button class="btn-icon del" data-perm="componentes:editar" data-i="'+i+'" title="Eliminar">×</button>' +
      '</div></td>' +
    '</tr>';
  }).join('');
  updateStats();
}
document.getElementById('comp-tbody').addEventListener('click', function(e){
  var editBtn = e.target.closest('.btn-icon.edit');
  var delBtn = e.target.closest('.btn-icon.del');
  if(editBtn){
    var i = Number(editBtn.dataset.i);
    var item = componentes[i];
    var def = catDef(activeCompCat);
    document.getElementById('comp-nombre').value = item.nombre || '';
    document.getElementById('comp-peso').value = item.peso || '';
    def.fields.forEach(function(k){
      var el = document.getElementById('comp-f-'+k);
      if(el) el.value = (item[k] && item[k] !== '-') ? item[k] : '';
    });
    compEditingIndex = i;
    document.getElementById('comp-add').textContent = 'Guardar cambios';
    document.getElementById('comp-cancel').style.display = 'inline';
    document.getElementById('comp-body').scrollIntoView({behavior:'smooth', block:'start'});
  } else if(delBtn){
    if(!exigir('componentes:editar')) return;
    var idx = Number(delBtn.dataset.i);
    if(!confirm('¿Eliminar el componente "'+componentes[idx].nombre+'"?')) return;
    registrarHistorial('Eliminó', 'Componente', componentes[idx].categoria+': '+componentes[idx].nombre);
    componentes.splice(idx, 1);
    save('sid10_componentes', componentes);
    if(compEditingIndex === idx) resetCompForm();
    renderComponentesPanel();
    rebuildAllMaterialSelects();
    toast('Componente eliminado');
  }
});
document.getElementById('comp-cancel').addEventListener('click', function(e){
  e.preventDefault();
  resetCompForm();
});
document.getElementById('comp-add').addEventListener('click', function(){
  var def = catDef(activeCompCat);
  if(!def) return;
  if(!exigir('componentes:editar')) return;
  var nombre = document.getElementById('comp-nombre').value.trim();
  var peso = document.getElementById('comp-peso').value.trim();
  if(!nombre){ toast('Ingresá el nombre del componente'); return; }
  var data = {categoria:def.id, nombre:nombre, peso:peso};
  def.fields.forEach(function(k){
    var el = document.getElementById('comp-f-'+k);
    data[k] = (el.value.trim()) || '-';
  });
  if(compEditingIndex === null){
    componentes.push(data);
    registrarHistorial('Creó', 'Componente', def.id+': '+nombre);
    toast('Componente agregado en ' + def.id);
  } else {
    componentes[compEditingIndex] = data;
    registrarHistorial('Editó', 'Componente', def.id+': '+nombre);
    toast('Componente actualizado');
  }
  save('sid10_componentes', componentes);
  resetCompForm();
  renderComponentesPanel();
  rebuildAllMaterialSelects();
});
