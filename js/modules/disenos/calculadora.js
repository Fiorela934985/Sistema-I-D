/* Sistema I+D — Calcular diseño: hoja de dosificación (D-CC-F-148) y registro */
'use strict';

/* ================= DISEÑOS — CALCULADORA ================= */
function fillPpIteracionSelect(proyNombre, selectedVal){
  var sel = document.getElementById('pp-iteracion-select');
  var registradas = proyNombre ? iteracionesDeProyecto(proyNombre) : [];
  var html = '<option value="">Elegí una iteración…</option>';
  html += registradas.map(function(it){ return '<option value="'+esc(it)+'"'+(it===selectedVal?' selected':'')+'>'+esc(it)+'</option>'; }).join('');
  html += '<option value="__nueva__">+ Registrar nueva iteración…</option>';
  sel.innerHTML = html;
  document.getElementById('pp-nueva-iter-panel').style.display = 'none';
}
document.getElementById('pp-proyecto').addEventListener('change', function(){
  fillPpIteracionSelect(proyectoNombre(this.value), '');
});
document.getElementById('pp-iteracion-select').addEventListener('change', function(){
  var esNueva = this.value === '__nueva__';
  document.getElementById('pp-nueva-iter-panel').style.display = esNueva ? 'block' : 'none';
  if(esNueva){
    fillMesSelect(document.getElementById('pp-mes'), mesActual());
    fillNumeralSelect(document.getElementById('pp-numeral'), 'I');
    document.getElementById('pp-usar-numeral').checked = false;
    document.getElementById('pp-numeral').disabled = true;
  }
});
document.getElementById('pp-nueva-iter-confirmar').addEventListener('click', function(){
  var proyNombre = proyectoNombre(document.getElementById('pp-proyecto').value);
  if(!proyNombre){ toast('Elegí primero el Proyecto'); return; }
  var mes = document.getElementById('pp-mes').value;
  if(!mes){ toast('Elegí el mes'); return; }
  var usar = document.getElementById('pp-usar-numeral').checked;
  var numeral = document.getElementById('pp-numeral').value;
  var iter = construirIteracion(mes, usar, numeral);
  registrarIteracion(proyNombre, iter);
  fillPpIteracionSelect(proyNombre, iter);
  toast('Iteración registrada y seleccionada');
});
function showSubTab(name){
  subTabDisenos = name;
  document.querySelectorAll('#disenos-subtabs .subtab').forEach(function(b){ b.classList.toggle('active', b.dataset.dsub === name); });
  document.getElementById('sub-calcular').style.display = name === 'calcular' ? 'block' : 'none';
  document.getElementById('sub-historico').style.display = name === 'historico' ? 'block' : 'none';
  if(name === 'historico'){ rebuildHistProyectoFiltro(); renderDisenosHistorico(); }
  if(name === 'calcular'){
    var proyActual = document.getElementById('pp-proyecto').value;
    fillProyectoCatalogoSelect(document.getElementById('pp-proyecto'), proyActual);
    fillPpIteracionSelect(proyectoNombre(proyActual), document.getElementById('pp-iteracion-select').value);
    if(!document.getElementById('dis-ndiseno').value) document.getElementById('dis-ndiseno').value = parseInt(nextCodigoDiseno().slice(4), 10);
    if(usuarioActual){
      var colab = document.getElementById('dis-colaborador');
      if(!colab.value) colab.value = inicialesUsuario(usuarioActual);
    }
  }
  actualizarFlujo();
  window.scrollTo({top:0, behavior:'auto'});
}
document.getElementById('btn-nuevo-diseno').addEventListener('click', function(){ showSubTab('calcular'); });
document.querySelectorAll('#disenos-subtabs .subtab').forEach(function(btn){
  btn.addEventListener('click', function(){ showSubTab(btn.dataset.dsub); });
});
document.getElementById('pp-usar-numeral').addEventListener('change', function(){
  document.getElementById('pp-numeral').disabled = !this.checked;
});


function recalcFcr(){
  var fc = n(document.getElementById('dis-fc').value);
  var s = n(document.getElementById('dis-desv-std').value);
  var fcr = fc ? (fc + 1.34*s).toFixed(1) : '';
  document.getElementById('dis-fcr').value = fcr;
  refreshNombrePreview();
}
function onFcKgInput(){
  var kg = document.getElementById('dis-fc').value;
  document.getElementById('dis-fc-mpa').value = kg === '' ? '' : (n(kg)/10).toFixed(1);
  recalcFcr();
}
function onFcMpaInput(){
  var mpa = document.getElementById('dis-fc-mpa').value;
  document.getElementById('dis-fc').value = mpa === '' ? '' : (n(mpa)*10).toFixed(0);
  recalcFcr();
}
document.getElementById('dis-fc').addEventListener('input', onFcKgInput);
document.getElementById('dis-fc-mpa').addEventListener('input', onFcMpaInput);
document.getElementById('dis-desv-std').addEventListener('input', recalcFcr);

function cementoTipoDesdeCatalogo(){
  var idx = document.getElementById('dis-cemento-mat').value;
  if(idx === '') return '';
  var c = componentes[Number(idx)];
  return c && c.tipo ? c.tipo.trim() : '';
}
function refreshNombrePreview(){
  var tipoIdx = document.getElementById('dis-tipo-concreto').value;
  var tipoDef = tipoIdx !== '' ? TIPO_CONCRETO_DEFS[Number(tipoIdx)] : null;
  var amc = document.getElementById('dis-amc-efectiva').value.trim();
  var cemento = cementoTipoDesdeCatalogo();
  var aggCode = agregadoGruesoCode();
  var sufijo = document.getElementById('dis-sufijo').value.trim();
  var parts = [];
  if(tipoDef) parts.push(tipoDef.code);
  if(amc) parts.push(amc);
  if(cemento) parts.push(cemento);
  if(aggCode) parts.push(aggCode);
  var nombre = parts.length ? parts.join('-') + (sufijo ? '-' + sufijo : '') : '';
  document.getElementById('nombre-preview-text').textContent = nombre || '—';
  document.getElementById('mezcla-nombre-echo').textContent = nombre;
  return nombre;
}
['dis-tipo-concreto','dis-amc-efectiva','dis-cemento-mat','dis-sufijo'].forEach(function(id){
  var el = document.getElementById(id);
  el.addEventListener(el.tagName === 'SELECT' ? 'change' : 'input', refreshNombrePreview);
});
document.getElementById('nombre-editar-btn').addEventListener('click', function(){
  var wrap = document.getElementById('hoja-nombre-editar-wrap');
  var showing = wrap.style.display !== 'none';
  wrap.style.display = showing ? 'none' : 'block';
  if(!showing) document.getElementById('dis-sufijo').focus();
});

document.getElementById('toggle-propiedades').addEventListener('change', function(e){
  document.getElementById('propiedades-wrap').style.display = e.target.checked ? 'block' : 'none';
});

function renderPropiedades(){
  var tbody = document.getElementById('propiedades-tbody');
  var used = getComposicionItems().map(function(it){ return componentes[it.compIndex]; }).filter(Boolean);
  if(!used.length){
    tbody.innerHTML = '<tr><td colspan="15" style="color:var(--text-muted);">Elegí cemento, agua, agregados y aditivo para verlos acá.</td></tr>';
    return;
  }
  tbody.innerHTML = used.map(function(c){
    return '<tr>' +
      '<td class="hoja-nombre-mat">'+esc(c.nombre)+'</td>' +
      '<td>'+esc(c.norma||'-')+'</td><td>'+esc(c.tipo||'-')+'</td><td>'+esc(c.sap||'-')+'</td>' +
      '<td>'+esc(c.rho||'-')+'</td><td>'+esc(c.absorcion||'-')+'</td><td>'+esc(c.humedad||'-')+'</td>' +
      '<td>'+esc(c.mfinura||'-')+'</td><td>'+esc(c.tmn||'-')+'</td><td>'+esc(c.pasa200||'-')+'</td><td>'+esc(c.pasa100||'-')+'</td>' +
      '<td>'+esc(c.pus||'-')+'</td><td>'+esc(c.wr||'-')+'</td><td>'+esc(c.costo||'-')+'</td><td style="text-align:left;">'+esc(c.procedencia||'-')+'</td>' +
    '</tr>';
  }).join('');
}

function catOptionsHtml(categoria, selectedIdx, placeholder){
  var html = '<option value="">'+placeholder+'</option>';
  componentes.forEach(function(c,i){
    if(c.categoria !== categoria) return;
    html += '<option value="'+i+'"'+(String(i)===String(selectedIdx)?' selected':'')+'>'+esc(c.nombre)+'</option>';
  });
  return html;
}
function rebuildCementoSelect(){
  var sel = document.getElementById('dis-cemento-mat');
  sel.innerHTML = catOptionsHtml('Cemento', sel.value, 'Elegí el cemento…');
}
function rebuildAguaSelect(){
  var sel = document.getElementById('dis-agua-mat');
  sel.innerHTML = catOptionsHtml('Agua', sel.value, 'Elegí el agua…');
}
function rebuildAditivoSelect(){
  var sel = document.getElementById('dis-aditivo-mat');
  sel.innerHTML = catOptionsHtml('Aditivo', sel.value, 'Elegí el aditivo correspondiente…');
}
function agregadoGruesoOptionsHtml(selectedIdx){
  var html = '<option value="">Elegí…</option>';
  componentes.forEach(function(c,i){
    if(c.categoria !== 'Piedra') return;
    html += '<option value="'+i+'"'+(i===selectedIdx?' selected':'')+'>'+esc(c.nombre)+'</option>';
  });
  return html;
}
function rebuildAgregadoGruesoSelect(){
  var sel = document.getElementById('dis-agregado-grueso');
  var current = sel.value === '' ? null : Number(sel.value);
  sel.innerHTML = agregadoGruesoOptionsHtml(current);
}
function rebuildAllMaterialSelects(){
  rebuildCementoSelect();
  rebuildAguaSelect();
  rebuildAditivoSelect();
  rebuildAgregadoGruesoSelect();
  rebuildIncidenciaTable();
  rebuildCaMaterialSelect();
}

var INCIDENCIA_ROWS = [
  {codigo:'AF1', categoria:'Arena'}, {codigo:'AF2', categoria:'Arena'},
  {codigo:'AG1', categoria:'Piedra'}, {codigo:'AG2', categoria:'Piedra'}, {codigo:'AG3', categoria:'Piedra'}
];
function matOptionsForCategoria(categoria, selected){
  var html = '<option value="">—</option>';
  componentes.forEach(function(c,i){
    if(c.categoria !== categoria) return;
    html += '<option value="'+i+'"'+(String(i)===String(selected)?' selected':'')+'>'+esc(c.nombre)+'</option>';
  });
  return html;
}
function rebuildIncidenciaTable(){
  var tbody = document.getElementById('incidencia-tbody');
  var existingSel = {}, existingPct = {}, existingPeso = {};
  tbody.querySelectorAll('select[data-inc]').forEach(function(sel){ existingSel[sel.dataset.inc] = sel.value; });
  tbody.querySelectorAll('input[data-inc-pct]').forEach(function(inp){ existingPct[inp.dataset.incPct] = inp.value; });
  tbody.querySelectorAll('input[data-inc-peso]').forEach(function(inp){ existingPeso[inp.dataset.incPeso] = inp.value; });
  tbody.innerHTML = INCIDENCIA_ROWS.map(function(r){
    return '<tr>' +
      '<td>'+r.codigo+'</td>' +
      '<td><select data-inc="'+r.codigo+'" data-key="inc_'+r.codigo+'_mat">'+matOptionsForCategoria(r.categoria, existingSel[r.codigo])+'</select></td>' +
      '<td><input type="text" placeholder="0%" data-inc-pct="'+r.codigo+'" data-key="inc_'+r.codigo+'_pct" value="'+esc(existingPct[r.codigo]||'')+'"></td>' +
      '<td><input type="number" placeholder="kg/m3" data-inc-peso="'+r.codigo+'" data-key="inc_'+r.codigo+'_peso" value="'+esc(existingPeso[r.codigo]||'')+'"></td>' +
    '</tr>';
  }).join('');
}
document.getElementById('incidencia-tbody').addEventListener('input', function(e){
  if(e.target.matches('input[data-inc-peso]')) renderMezclaDisplay();
});
document.getElementById('incidencia-tbody').addEventListener('change', function(e){
  if(e.target.matches('select[data-inc]')) renderMezclaDisplay();
});

var LIMITES_ROWS = [
  'Factor de grosor','Factor de trabajabilidad','Factor mortero','Factor pasta','Agua/finos',
  'Cont. Finos <0.30mm','Cont. Finos <0.15mm','Coeficiente de uniformidad','Coeficiente de curvatura'
];
function buildLimitesTable(){
  var tbody = document.getElementById('limites-tbody');
  tbody.innerHTML = LIMITES_ROWS.map(function(label, i){
    return '<tr>' +
      '<td class="mini-label">'+label+'</td>' +
      '<td><input type="text" data-key="lim_'+i+'_diseno"></td>' +
      '<td><input type="text" data-key="lim_'+i+'_min"></td>' +
      '<td><input type="text" data-key="lim_'+i+'_max"></td>' +
      '<td><input type="text" data-key="lim_'+i+'_estado"></td>' +
    '</tr>';
  }).join('');
}
function agregadoGruesoCode(){
  var idx = document.getElementById('dis-agregado-grueso').value;
  if(idx === '') return '';
  var c = componentes[Number(idx)];
  if(!c) return '';
  var parts = c.nombre.split('-');
  return parts.length > 1 ? parts[1].trim() : c.nombre.trim();
}
document.getElementById('dis-agregado-grueso').addEventListener('change', refreshNombrePreview);

function rowCompute(compIndex, pesoSeco){
  var comp = componentes[compIndex];
  var batchVol = n(document.getElementById('dis-batch-vol').value) || 30;
  if(!comp) return {volAbs:0,pesoSSS:0,pesoHumedo:0,batch:0,cvd:0};
  var rho = n(comp.rho) || n(comp.pus) || 1000;
  var absorcion = n(comp.absorcion);
  var humedad = n(comp.humedad);
  var costo = n(comp.costo);
  var volAbs = rho ? pesoSeco/rho : 0;
  var pesoSSS = pesoSeco * (1 + absorcion/100);
  var pesoHumedo = pesoSeco * (1 + humedad/100);
  var batch = pesoHumedo * batchVol/1000;
  var cvd = pesoSSS * costo;
  return {volAbs:volAbs, pesoSSS:pesoSSS, pesoHumedo:pesoHumedo, batch:batch, cvd:cvd};
}
function getComposicionItems(){
  var items = [];
  var cemIdx = document.getElementById('dis-cemento-mat').value;
  var cemPeso = n(document.getElementById('dis-cemento-peso').value);
  if(cemIdx !== '' && cemPeso > 0) items.push({compIndex:Number(cemIdx), pesoSeco:cemPeso});

  var aguaIdx = document.getElementById('dis-agua-mat').value;
  var aguaPeso = n(document.getElementById('dis-agua-req').value);
  if(aguaIdx !== '' && aguaPeso > 0) items.push({compIndex:Number(aguaIdx), pesoSeco:aguaPeso});

  INCIDENCIA_ROWS.forEach(function(r){
    var sel = document.querySelector('select[data-inc="'+r.codigo+'"]');
    var pesoInput = document.querySelector('input[data-inc-peso="'+r.codigo+'"]');
    if(sel && sel.value !== '' && pesoInput){
      var peso = n(pesoInput.value);
      if(peso > 0) items.push({compIndex:Number(sel.value), pesoSeco:peso});
    }
  });

  var admIdx = document.getElementById('dis-aditivo-mat').value;
  var admPeso = n(document.getElementById('dis-aditivo-peso').value);
  if(admIdx !== '' && admPeso > 0) items.push({compIndex:Number(admIdx), pesoSeco:admPeso});

  componentesAdicionales.forEach(function(item){
    if(item.cantidad > 0) items.push({compIndex:item.compIndex, pesoSeco:item.cantidad});
  });

  return items;
}

/* ---- Componentes adicionales (permite más de 1 cemento/adición/aditivo, jalando de Registro) ---- */
var componentesAdicionales = [];
function rebuildCaMaterialSelect(){
  var cat = document.getElementById('ca-categoria').value;
  var sel = document.getElementById('ca-material');
  var lista = componentes.map(function(c,i){ return {c:c,i:i}; }).filter(function(x){ return x.c.categoria === cat; });
  sel.innerHTML = '<option value="">Elegí el material…</option>' + lista.map(function(x){
    return '<option value="'+x.i+'">'+esc(x.c.nombre)+'</option>';
  }).join('');
}
document.getElementById('ca-categoria').addEventListener('change', rebuildCaMaterialSelect);
function renderComponentesAdicionales(){
  var wrap = document.getElementById('comp-adic-lista');
  if(!componentesAdicionales.length){ wrap.innerHTML = ''; return; }
  wrap.innerHTML = componentesAdicionales.map(function(item, idx){
    var comp = componentes[item.compIndex];
    return '<div class="ca-row">' +
      '<span class="ca-row-cat">'+(comp?esc(comp.categoria):'-')+'</span>' +
      '<span class="ca-row-nombre">'+(comp?esc(comp.nombre):'—')+'</span>' +
      '<span class="ca-row-cant">'+item.cantidad+' kg/m3</span>' +
      '<button class="btn-icon danger" data-idx="'+idx+'" title="Quitar">×</button>' +
    '</div>';
  }).join('');
}
document.getElementById('comp-adic-lista').addEventListener('click', function(e){
  var btn = e.target.closest('.btn-icon.danger');
  if(!btn) return;
  componentesAdicionales.splice(Number(btn.dataset.idx), 1);
  renderComponentesAdicionales();
  renderMezclaDisplay();
});
document.getElementById('ca-agregar').addEventListener('click', function(){
  var idx = document.getElementById('ca-material').value;
  var cantidad = n(document.getElementById('ca-cantidad').value);
  if(idx === ''){ toast('Elegí el material'); return; }
  if(!(cantidad > 0)){ toast('Ingresá una cantidad mayor a 0'); return; }
  componentesAdicionales.push({compIndex: Number(idx), cantidad: cantidad});
  document.getElementById('ca-material').value = '';
  document.getElementById('ca-cantidad').value = '';
  renderComponentesAdicionales();
  renderMezclaDisplay();
});
function suggestCementoPeso(){
  var pesoEl = document.getElementById('dis-cemento-peso');
  if(pesoEl.value) return;
  var agua = n(document.getElementById('dis-agua-req').value);
  var amc = n(document.getElementById('dis-amc-efectiva').value);
  if(agua > 0 && amc > 0){
    pesoEl.value = String(Math.round(agua/amc));
    toast('Peso seco de cemento sugerido: ' + pesoEl.value + ' kg/m3');
    renderMezclaDisplay();
  }
}
document.getElementById('dis-cemento-mat').addEventListener('change', suggestCementoPeso);
function renderMezclaDisplay(){
  var items = getComposicionItems();
  var totals = {peso:0, vol:0, sss:0, humedo:0, batch:0, cvd:0};
  var rows = items.map(function(item){
    var comp = componentes[item.compIndex];
    var r = rowCompute(item.compIndex, item.pesoSeco);
    totals.peso += item.pesoSeco; totals.vol += r.volAbs; totals.sss += r.pesoSSS; totals.humedo += r.pesoHumedo; totals.batch += r.batch; totals.cvd += r.cvd;
    var isAditivo = comp && comp.categoria === 'Aditivo';
    return '<tr>' +
      '<td class="mezcla-nombre-mat">'+(comp?esc(comp.nombre):'—')+'</td>' +
      '<td class="'+(isAditivo?'mezcla-dosis':'')+'">'+(isAditivo && comp.dosis ? esc(comp.dosis)+'%' : '-')+'</td>' +
      '<td>'+item.pesoSeco.toFixed(2)+'</td>' +
      '<td>'+r.volAbs.toFixed(3)+'</td>' +
      '<td>'+r.pesoSSS.toFixed(2)+'</td>' +
      '<td>'+r.pesoHumedo.toFixed(2)+'</td>' +
      '<td>'+r.batch.toFixed(3)+'</td>' +
      '<td>'+r.cvd.toFixed(2)+'</td>' +
    '</tr>';
  }).join('');
  document.getElementById('mezcla-display-tbody').innerHTML = rows || '<tr><td colspan="8" style="text-align:center;color:var(--text-muted);">Completá cemento, agua y agregados en la sección 2, y el aditivo acá abajo.</td></tr>';
  document.getElementById('mezcla-display-total').innerHTML =
    '<td style="text-align:left;">Total</td><td></td><td>'+totals.peso.toFixed(2)+'</td><td>'+totals.vol.toFixed(3)+'</td><td>'+totals.sss.toFixed(2)+'</td><td>'+totals.humedo.toFixed(2)+'</td><td>'+totals.batch.toFixed(2)+'</td><td>'+totals.cvd.toFixed(2)+'</td>';
  document.getElementById('cvd-diseno-view').textContent = 'S/. ' + totals.cvd.toFixed(2);
  // El costo base ya no se muestra por separado (solo 1 costo visible: el del diseño).
  renderPropiedades();
  return totals;
}
['dis-cemento-mat','dis-cemento-peso','dis-agua-mat','dis-agua-req','dis-aditivo-mat','dis-aditivo-peso','dis-batch-vol','dis-cvd-base'].forEach(function(id){
  var el = document.getElementById(id);
  el.addEventListener(el.tagName === 'SELECT' ? 'change' : 'input', renderMezclaDisplay);
});

function resetCalcForm(){
  ['dis-fc','dis-fc-mpa','dis-ft','dis-edad',
   'dis-cemento-peso','dis-tmn','dis-slump','dis-exposicion','dis-aire',
   'dis-otras-esp','dis-desv-std','dis-fcr','dis-amc-efectiva',
   'dis-agua-req','dis-vol-diseno','dis-cvd-base','dis-lim-gradacion','dis-pct-fino','dis-pct-grueso','dis-sufijo',
   'dis-aditivo-peso','dis-colaborador','dis-responsable'
  ].forEach(function(id){ var el = document.getElementById(id); if(el) el.value = ''; });
  document.querySelectorAll('#sub-calcular [data-key]').forEach(function(el){
    if(el.tagName === 'SELECT'){ el.selectedIndex = 0; } else { el.value = ''; }
  });
  document.getElementById('dis-tipo-concreto').value = '';
  document.getElementById('dis-agregado-grueso').value = '';
  document.getElementById('dis-cemento-mat').value = '';
  document.getElementById('dis-agua-mat').value = '';
  document.getElementById('dis-aditivo-mat').value = '';
  document.getElementById('dis-batch-vol').value = '30';
  document.getElementById('dis-fecha-mezcla').value = todayISO();
  document.getElementById('dis-ndiseno').value = disenos.length + 1;
  document.getElementById('dis-estado-view').value = 'Iniciado';
  document.getElementById('hoja-nombre-editar-wrap').style.display = 'none';
  componentesAdicionales = [];
  renderComponentesAdicionales();
  rebuildIncidenciaTable();
  renderMezclaDisplay();
  refreshNombrePreview();
}

document.getElementById('dis-add').addEventListener('click', function(){
  if(!exigir('disenos:crear')) return;
  var tipoIdxSel = document.getElementById('dis-tipo-concreto').value;
  var tipoDef = tipoIdxSel !== '' ? TIPO_CONCRETO_DEFS[Number(tipoIdxSel)] : null;
  var fc = document.getElementById('dis-fc').value.trim();
  if(!tipoDef || !fc){ toast('Completá al menos Tipo de concreto y f\'c'); return; }
  if(!/^\d+(\.\d+)?$/.test(fc)){ toast('f\'c debe ser un número (ej. 210)'); return; }
  var ft = document.getElementById('dis-ft').value.trim();
  if(ft && !/^\d+(\.\d+)?$/.test(ft)){ toast('f\'t (flexión) debe ser un número'); return; }
  var edad = document.getElementById('dis-edad').value.trim();
  if(edad && !/^\d+$/.test(edad)){ toast('Edad del f\'c debe ser un número entero (días)'); return; }
  var amc = document.getElementById('dis-amc-efectiva').value.trim();
  if(amc && !/^\d+(\.\d+)?$/.test(amc)){ toast('a/mc efectiva debe ser un número (ej. 0.55)'); return; }
  var proyectoId = document.getElementById('pp-proyecto').value;
  var iteracionId = document.getElementById('pp-iteracion-select').value;
  if(iteracionId === '__nueva__') iteracionId = '';
  if(!proyectoId || !iteracionId){ toast('Elegí el Proyecto y la Iteración antes de registrar el diseño'); return; }
  var colaborador = document.getElementById('dis-colaborador').value.trim();
  var responsable = document.getElementById('dis-responsable').value.trim();
  if(!colaborador || !responsable){ toast('Completá Colaborador y Responsable'); return; }
  if(!/^[A-Za-zÀ-ÿ .]+$/.test(colaborador)){ toast('Colaborador solo debe tener letras (iniciales)'); return; }
  if(!/^[A-Za-zÀ-ÿ .]+$/.test(responsable)){ toast('Responsable solo debe tener letras (nombre)'); return; }
  var nombreCandidato = refreshNombrePreview();
  if(!nombreCandidato){ toast('Completá los campos necesarios para armar el nombre del diseño'); return; }
  var yaExiste = disenos.some(function(existing){ return (existing.nombreTecnico||'').trim().toLowerCase() === nombreCandidato.trim().toLowerCase(); });
  if(yaExiste){ toast('Ya existe un diseño con ese nombre — ajustá el sufijo u otro campo'); return; }
  var totals = renderMezclaDisplay();
  var fechaISO = document.getElementById('dis-fecha-mezcla').value || todayISO();
  var fecha = isoToDMY(fechaISO);
  var mixSnapshot = getComposicionItems().map(function(item){
    var comp = componentes[item.compIndex];
    var r = rowCompute(item.compIndex, item.pesoSeco);
    return {nombre: comp?comp.nombre:'-', dosis: comp?comp.dosis:'', pesoSeco:item.pesoSeco, volAbs:r.volAbs, pesoSSS:r.pesoSSS, pesoHumedo:r.pesoHumedo, batch:r.batch, cvd:r.cvd};
  });
  var d = {
    codigo: nextCodigoDiseno(),
    proyectoId: proyectoId, iteracionId: iteracionId,
    nombreTecnico: nombreCandidato,
    colaborador: colaborador,
    responsable: responsable,
    planta: document.getElementById('dis-planta').value,
    laboratorio: document.getElementById('dis-laboratorio').value,
    ndiseno: document.getElementById('dis-ndiseno').value.trim(),
    tipo: tipoDef.label,
    fc: fc,
    resistencia: document.getElementById('dis-fc-mpa').value || fc,
    ft: document.getElementById('dis-ft').value.trim(),
    edad: document.getElementById('dis-edad').value.trim(),
    cementoTipo: cementoTipoDesdeCatalogo(),
    tmn: document.getElementById('dis-tmn').value.trim(),
    agregadoGrueso: (function(){ var idx=document.getElementById('dis-agregado-grueso').value; var c=idx!==''?componentes[Number(idx)]:null; return c?c.nombre:''; })(),
    slump: document.getElementById('dis-slump').value.trim(),
    exposicion: document.getElementById('dis-exposicion').value.trim(),
    aire: document.getElementById('dis-aire').value.trim(),
    desvStd: document.getElementById('dis-desv-std').value.trim(),
    fcr: document.getElementById('dis-fcr').value.trim(),
    amcEfectiva: document.getElementById('dis-amc-efectiva').value.trim(),
    aguaReq: document.getElementById('dis-agua-req').value.trim(),
    pctFino: document.getElementById('dis-pct-fino').value.trim(),
    pctGrueso: document.getElementById('dis-pct-grueso').value.trim(),
    cementoMat: (function(){ var idx=document.getElementById('dis-cemento-mat').value; var c=idx!==''?componentes[Number(idx)]:null; return c?c.nombre:''; })(),
    cementoPeso: document.getElementById('dis-cemento-peso').value.trim(),
    aguaMat: (function(){ var idx=document.getElementById('dis-agua-mat').value; var c=idx!==''?componentes[Number(idx)]:null; return c?c.nombre:''; })(),
    aditivoMat: (function(){ var idx=document.getElementById('dis-aditivo-mat').value; var c=idx!==''?componentes[Number(idx)]:null; return c?c.nombre:''; })(),
    aditivoPeso: document.getElementById('dis-aditivo-peso').value.trim(),
    extra: (function(){
      var e = {};
      document.querySelectorAll('#sub-calcular [data-key]').forEach(function(el){ e[el.dataset.key] = el.value; });
      return e;
    })(),
    mix: mixSnapshot,
    componentesAdicionales: componentesAdicionales.slice(),
    cvdTotal: Number(totals.cvd.toFixed(2)),
    estado: 'Iniciado',
    replicas: 2,
    diasRotura: [1,3,7,28],
    tipoRotura: '',
    fechaElaboracionISO: fechaISO,
    horaElaboracion: '10:00',
    fecha: fecha, ts: new Date(fechaISO).getTime() || Date.now(), favorito:false
  };
  disenos.push(d);
  save('sid10_disenos', disenos);
  // El pronóstico a 28 d queda guardado para compararlo después con el resultado real
  var pron = pronosticoDeDiseno(d, 28);
  if(pron && !pron.error) registrarPrediccion(d.codigo, 'diseño', pron.valor, 'al registrar el diseño');
  registrarHistorial('Creó', 'Diseño', d.codigo + ' · ' + d.nombreTecnico + ' · ' + proyectoNombre(d.proyectoId) + ' / ' + d.iteracionId, {proyecto: proyectoNombre(d.proyectoId), ref: d.codigo});
  resetCalcForm();
  renderAllDesignViews();
  askReplicasThenPrint(d);
});

/* ---- Flujo post-registro: réplicas → días de rotura → Roturas automático (con confirmación+redirect) → ¿imprimir? ---- */
var DIAS_COMUNES = [1,3,4,7,28,90];
function askReplicasThenPrint(d){
  document.getElementById('replicas-modal-name').textContent = diseñoTitulo(d);
  document.getElementById('replicas-modal-input').value = d.replicas || 2;
  document.getElementById('replicas-modal-tipo').value = d.tipoRotura || 'Probetas';
  document.getElementById('replicas-modal-step1').style.display = 'block';
  document.getElementById('replicas-modal-step2').style.display = 'none';
  document.getElementById('replicas-modal').classList.add('show');
  var cantidadElegida = d.replicas || 2;
  var tipoElegido = d.tipoRotura || 'Probetas';

  function irAPasoDias(count, tipo){
    cantidadElegida = count;
    tipoElegido = tipo;
    var yaElegidos = d.diasRotura || [1,3,7,28];
    var todos = DIAS_COMUNES.slice();
    yaElegidos.forEach(function(dia){ if(todos.indexOf(dia)===-1) todos.push(dia); });
    todos.sort(function(a,b){ return a-b; });
    document.getElementById('replicas-dias-checks').innerHTML = todos.map(function(dia){
      var checked = yaElegidos.indexOf(dia) > -1;
      return '<label class="pp-check-inline" style="border:1.5px solid var(--line);border-radius:6px;padding:8px 12px;">' +
        '<input type="checkbox" class="dias-check" value="'+dia+'" '+(checked?'checked':'')+'> Día '+dia+
      '</label>';
    }).join('');
    document.getElementById('replicas-modal-step1').style.display = 'none';
    document.getElementById('replicas-modal-step2').style.display = 'block';
  }
  function finishReplicas(diasElegidos){
    d.diasRotura = diasElegidos;
    d.replicas = cantidadElegida;
    d.tipoRotura = tipoElegido;
    d.replicaObjs = [];
    for(var i=1;i<=cantidadElegida;i++){ d.replicaObjs.push({n:i, nombre:diseñoTitulo(d)+'-R'+i, codigo:''}); }
    var creados = crearCargasParaDiseno(d, 'automatico'); // ya deja el código correcto (uno por réplica) en cada rep.codigo
    save('sid10_disenos', disenos);
    registrarHistorial('Registró', 'Rotura', creados.length + ' roturas programadas para ' + d.codigo + ' (' + cantidadElegida + ' réplicas · días ' + diasElegidos.join(', ') + ')', {proyecto: proyectoNombre(d.proyectoId), ref: d.codigo});
    document.getElementById('replicas-modal').classList.remove('show');
    renderAllDesignViews();
    renderRoturasAll();
    document.getElementById('roturas-auto-modal-text').innerHTML =
      '<div class="rac-summary">'+creados.length+' registros creados en Roturas ('+(tipoElegido==='Cubos'?'Cubos':'Probetas')+') — '+d.diasRotura.length+' día(s) × '+cantidadElegida+' réplica(s), un código por réplica</div>' +
      d.replicaObjs.map(function(rep){
        var suyos = creados.filter(function(c){ return c.replicaNombre === rep.nombre; }).sort(function(a,b){ return a.dia-b.dia; });
        return '<div class="rac-replica-block"><b>'+esc(rep.nombre)+' <span class="rac-code">'+rep.codigo+'</span></b>' +
          '<div class="rac-dia-chips">' + suyos.map(function(c){ return '<span class="rac-dia-chip">Día '+c.dia+'</span>'; }).join('') + '</div>' +
        '</div>';
      }).join('');
    document.getElementById('roturas-auto-modal').classList.add('show');
  }
  document.getElementById('replicas-modal-confirm').onclick = function(){
    var v = Number(document.getElementById('replicas-modal-input').value) || 2;
    var tipo = document.getElementById('replicas-modal-tipo').value;
    irAPasoDias(Math.min(6, Math.max(1, v)), tipo);
  };
  document.getElementById('replicas-dias-atras').onclick = function(){
    document.getElementById('replicas-modal-step1').style.display = 'block';
    document.getElementById('replicas-modal-step2').style.display = 'none';
  };
  document.getElementById('replicas-dias-confirm').onclick = function(){
    var elegidos = Array.prototype.slice.call(document.querySelectorAll('.dias-check:checked')).map(function(chk){ return Number(chk.value); }).sort(function(a,b){return a-b;});
    if(!elegidos.length){ toast('Elegí al menos un día de rotura'); return; }
    finishReplicas(elegidos);
  };
  document.getElementById('roturas-auto-modal-close').onclick = function(){
    document.getElementById('roturas-auto-modal').classList.remove('show');
    document.getElementById('print-confirm-modal').classList.add('show');
  };
  document.getElementById('roturas-auto-modal-etiquetas').onclick = function(){
    document.getElementById('roturas-auto-modal').classList.remove('show');
    abrirEtiquetas(d.codigo);
  };
  document.getElementById('roturas-auto-modal-go').onclick = function(){
    document.getElementById('roturas-auto-modal').classList.remove('show');
    showPanel('roturas');
    showRoturasSub('pendientes');
  };
  document.getElementById('print-confirm-no').onclick = function(){
    document.getElementById('print-confirm-modal').classList.remove('show');
    showSubTab('historico');
  };
  document.getElementById('print-confirm-yes').onclick = function(){
    document.getElementById('print-confirm-modal').classList.remove('show');
    openDesignModal(d);
    setTimeout(function(){ window.print(); }, 300);
  };
}
