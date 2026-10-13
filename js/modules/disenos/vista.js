/* Sistema I+D — Vista del diseño: modal, impresión y Excel */
'use strict';

/* ---- Vista de diseño: modal + impresión + Excel ---- */
var modalEl = document.getElementById('design-modal');
var currentModalDesign = null;
function mezclaTableHtml(d){
  var rows = (d.mix||[]).map(function(item){
    return '<tr>' +
      '<td class="mezcla-nombre">'+esc(item.nombre)+'</td>' +
      '<td>'+(item.dosis?esc(item.dosis)+'%':'-')+'</td>' +
      '<td>'+n(item.pesoSeco).toFixed(2)+'</td>' +
      '<td>'+n(item.volAbs).toFixed(3)+'</td>' +
      '<td>'+n(item.pesoSSS).toFixed(2)+'</td>' +
      '<td>'+n(item.pesoHumedo).toFixed(2)+'</td>' +
      '<td>'+n(item.batch).toFixed(3)+'</td>' +
      '<td>'+n(item.cvd).toFixed(2)+'</td>' +
    '</tr>';
  }).join('');
  var totals = (d.mix||[]).reduce(function(a,it){ a.peso+=n(it.pesoSeco); a.vol+=n(it.volAbs); a.sss+=n(it.pesoSSS); a.hum+=n(it.pesoHumedo); a.batch+=n(it.batch); a.cvd+=n(it.cvd); return a; }, {peso:0,vol:0,sss:0,hum:0,batch:0,cvd:0});
  return '<div class="mezcla-title-row"><h4>3. Composición de mezcla — '+esc(diseñoTitulo(d))+'</h4><span class="mono">'+d.fecha+'</span></div>' +
    '<div class="mezcla-specs">' +
      '<div><b>Proyecto</b>'+esc(proyectoNombre(d.proyectoId)||'-')+'</div>' +
      '<div><b>Iteración</b>'+esc(iteracionNombre(d.iteracionId)||'-')+'</div>' +
      '<div><b>Planta</b>'+esc(d.planta||'-')+'</div>' +
      '<div><b>Laboratorio</b>'+esc(d.laboratorio||'-')+'</div>' +
      '<div><b>f\'c</b>'+esc(d.fc||'-')+' kg/cm² ('+esc(d.resistencia||'-')+' MPa)</div>' +
      '<div><b>f\'cr</b>'+esc(d.fcr||'-')+' kg/cm²</div>' +
      '<div><b>Edad</b>'+esc(d.edad||'-')+' días</div>' +
      '<div><b>a/mc efectiva</b>'+esc(d.amcEfectiva||'-')+'</div>' +
      '<div><b>% Fino / Grueso</b>'+esc(d.pctFino||'-')+'% / '+esc(d.pctGrueso||'-')+'%</div>' +
      '<div><b>Estado</b>'+esc(d.estado||'-')+'</div>' +
    '</div>' +
    '<div class="table-scroll"><table class="mezcla-table"><thead><tr><th style="text-align:left;">Materiales</th><th>D</th><th>Peso Seco (kg/m3)</th><th>Vol. Abs. (m3)</th><th>Peso SSS (kg/m3)</th><th>Peso Húmedo (kg/m3)</th><th>Batch (kg)</th><th>CVD (S/.)</th></tr></thead>' +
    '<tbody>'+(rows || '<tr><td colspan="8" style="color:#6c6c70;">Este diseño no tiene materiales de mezcla guardados.</td></tr>')+'</tbody>' +
    '<tfoot><tr class="mezcla-total"><td style="text-align:left;">Total</td><td></td><td>'+totals.peso.toFixed(2)+'</td><td>'+totals.vol.toFixed(3)+'</td><td>'+totals.sss.toFixed(2)+'</td><td>'+totals.hum.toFixed(2)+'</td><td>'+totals.batch.toFixed(3)+'</td><td>'+totals.cvd.toFixed(2)+'</td></tr></tfoot></table></div>';
}
function openDesignModal(d){
  currentModalDesign = d;
  document.getElementById('design-modal-body').innerHTML = mezclaTableHtml(d);
  modalEl.classList.add('show');
}
document.getElementById('design-modal-close').addEventListener('click', function(){ modalEl.classList.remove('show'); });
modalEl.addEventListener('click', function(e){ if(e.target === modalEl) modalEl.classList.remove('show'); });
document.getElementById('design-modal-print').addEventListener('click', function(){ window.print(); });
document.getElementById('design-modal-excel').addEventListener('click', function(){
  if(!currentModalDesign || typeof XLSX === 'undefined'){ toast('No se pudo generar el Excel'); return; }
  var d = currentModalDesign;
  var rows = [
    ['3. Composición de mezcla', diseñoTitulo(d), d.fecha],
    ['Planta', d.planta||'', 'Laboratorio', d.laboratorio||''],
    ['Materiales','D','Peso Seco (kg/m3)','Vol. Abs. (m3)','Peso SSS (kg/m3)','Peso Húmedo (kg/m3)','Batch (kg)','CVD (S/.)']
  ];
  (d.mix||[]).forEach(function(item){
    rows.push([item.nombre, item.dosis?item.dosis+'%':'', n(item.pesoSeco), Number(n(item.volAbs).toFixed(3)), Number(n(item.pesoSSS).toFixed(2)), Number(n(item.pesoHumedo).toFixed(2)), Number(n(item.batch).toFixed(3)), Number(n(item.cvd).toFixed(2))]);
  });
  var totals = (d.mix||[]).reduce(function(a,it){ a.peso+=n(it.pesoSeco); a.vol+=n(it.volAbs); a.sss+=n(it.pesoSSS); a.hum+=n(it.pesoHumedo); a.batch+=n(it.batch); a.cvd+=n(it.cvd); return a; }, {peso:0,vol:0,sss:0,hum:0,batch:0,cvd:0});
  rows.push(['Total','',Number(totals.peso.toFixed(2)),Number(totals.vol.toFixed(3)),Number(totals.sss.toFixed(2)),Number(totals.hum.toFixed(2)),Number(totals.batch.toFixed(3)),Number(totals.cvd.toFixed(2))]);
  try{
    var ws = XLSX.utils.aoa_to_sheet(rows);
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Diseño');
    XLSX.writeFile(wb, diseñoTitulo(d)+'.xlsx');
    toast('Excel descargado');
  }catch(err){ toast('No se pudo generar el Excel'); }
});
