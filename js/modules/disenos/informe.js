/* Sistema I+D — Informe del diseño: resultados + gráficas + PDF */
'use strict';

/* ================= INFORME (visor: resultados + gráficas) ================= */
var informeZoom = 1;
var informeCharts = [];
var REPLICA_COLORS = ['#0396c8','#2e9e57','#0b5f7a','#7cc96b'];

function minToHm(min){
  if(min === null || min === undefined || isNaN(min) || min <= 0) return '';
  var h = Math.floor(min / 60);
  var m = Math.round(min % 60);
  return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
}

var fraguaDataLabelsPlugin = {
  id: 'fraguaDataLabelsPlugin',
  afterDatasetsDraw: function(chart){
    var ctx = chart.ctx;
    ctx.save();
    ctx.font = 'bold 11px Inter, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    var ds0 = chart.data.datasets[0];
    var ds1 = chart.data.datasets[1];
    var meta0 = chart.getDatasetMeta(0);
    var meta1 = chart.getDatasetMeta(1);

    if(meta0 && meta0.data && ds0){
      meta0.data.forEach(function(bar, idx){
        var val = ds0.data[idx];
        if(val > 0 && Math.abs(bar.x - bar.base) > 34){
          var text = minToHm(val);
          var centerX = (bar.base + bar.x) / 2;
          ctx.fillText(text, centerX, bar.y);
        }
      });
    }

    if(meta1 && meta1.data && ds1){
      meta1.data.forEach(function(bar, idx){
        var dur = ds1.data[idx];
        if(dur > 0 && Math.abs(bar.x - bar.base) > 22){
          var iniVal = (ds0 && ds0.data && !isNaN(ds0.data[idx])) ? ds0.data[idx] : 0;
          var totalFinal = iniVal + dur;
          var text = minToHm(totalFinal);
          var centerX = (bar.base + bar.x) / 2;
          ctx.fillText(text, centerX, bar.y);
        }
      });
    }

    ctx.restore();
  }
};

function informeRecapHtml(d){
  var reps = d.replicaObjs || [];
  var existingReplicasData = (d.resultados && d.resultados.replicas) || [];
  var materialRows = (d.mix||[]);
  var nCols = reps.length;

  var head = '<div class="rr-print-head">' +
    '<div class="rrp-logo"><img src="'+DINO_LOGO_URL+'" alt="DINO"></div>' +
    '<div class="rrp-body">' +
    '<div class="rrp-title">Resumen de reporte de resultados de mezclas de prueba</div>' +
    '<div class="rrp-grid">' +
      '<div class="rrp-field"><b>Planta</b><span>'+esc(d.planta||'-')+'</span></div>' +
      '<div class="rrp-field"><b>Fecha</b><span>'+esc(d.fecha||'-')+'</span></div>' +
      '<div class="rrp-field"><b>Ubicación</b><span>Laboratorio I+D</span></div>' +
      '<div class="rrp-field"><b>Colaborador</b><span>'+esc(d.colaborador||'-')+'</span></div>' +
      '<div class="rrp-field"><b>Proyecto</b><span>'+esc(proyectoNombre(d.proyectoId)||'-')+'</span></div>' +
      '<div class="rrp-field"><b>Responsable</b><span>'+esc(d.responsable||'-')+'</span></div>' +
    '</div>' +
    '</div>' +
  '</div>';

  var theadCols = '<th>Diseño</th>' + reps.map(function(rep){ return '<th>'+esc(rep.nombre)+'</th>'; }).join('') + '<th>Observ.</th>';

  var matRowsHtml = materialRows.length ? materialRows.map(function(item){
    var esAgua = /agua/i.test(item.nombre);
    var cells = reps.map(function(){ return '<td>'+n(item.pesoSeco).toFixed(2)+'</td>'; }).join('');
    return '<tr'+(esAgua?' class="rr-highlight"':'')+'><td class="rr-label">'+esc(item.nombre)+' <span class="unit mono">(kg)</span></td>'+cells+'<td>-</td></tr>';
  }).join('') : '<tr><td colspan="'+(nCols+2)+'" style="color:var(--text-muted);">Este diseño no tiene materiales de mezcla guardados.</td></tr>';

  var amcRow = '<tr class="rr-highlight"><td class="rr-label">Relación a/mc</td>' + reps.map(function(){ return '<td>'+esc(d.amcEfectiva||'-')+'</td>'; }).join('') + '<td>-</td></tr>';
  var cvdRow = '<tr><td class="rr-label">CVD <span class="unit mono">(S/.)</span></td>' + reps.map(function(){ return '<td>'+n(d.cvdTotal||0).toFixed(2)+'</td>'; }).join('') + '<td>-</td></tr>';

  function paramRow(label, unit, getter){
    var cells = reps.map(function(rep, ri){ return '<td>'+esc(getter(existingReplicasData[ri]||{}, ri))+'</td>'; }).join('');
    return '<tr><td class="rr-label">'+label+(unit?' <span class="unit mono">('+unit+')</span>':'')+'</td>'+cells+'<td>-</td></tr>';
  }
  var paramsHtml = '<tr class="rr-section"><td colspan="'+(nCols+2)+'">Parámetros de diseño</td></tr>';
  paramsHtml += '<tr class="rr-subsection"><td colspan="'+(nCols+2)+'">Consistencia (pulg)</td></tr>';
  SLUMP_ROWS.forEach(function(label, si){
    paramsHtml += paramRow(label+' pulg', '', function(data){ var row=(data.slump||[])[si]; return row&&row.slump ? row.slump : '-'; });
  });
  paramsHtml += '<tr class="rr-subsection"><td colspan="'+(nCols+2)+'">T° Concreto</td></tr>';
  SLUMP_ROWS.forEach(function(label, si){
    paramsHtml += paramRow(label+' °C', '', function(data){ var row=(data.slump||[])[si]; return row&&row.tempc ? row.tempc : '-'; });
  });
  paramsHtml += '<tr class="rr-subsection"><td colspan="'+(nCols+2)+'">T° Ambiente</td></tr>';
  SLUMP_ROWS.forEach(function(label, si){
    paramsHtml += paramRow(label+' °C', '', function(data){ var row=(data.slump||[])[si]; return row&&row.tempa ? row.tempa : '-'; });
  });
  paramsHtml += paramRow('Peso Unitario', 'kg/m3', function(data){ return data.pesoUnitario || '-'; });
  paramsHtml += paramRow('Fragua inicial', 'horas', function(data){ return data.thermoIni || '-'; });
  paramsHtml += paramRow('Fragua final', 'horas', function(data){ return data.thermoFin || '-'; });
  paramsHtml += paramRow('Contenido de Aire', '%', function(data){ return data.aire || '-'; });
  paramsHtml += paramRow('Cohesividad', 'Visual', function(data){ return data.cohesividad || '-'; });
  paramsHtml += paramRow('Apariencia', 'Visual', function(data){ return data.apariencia || '-'; });
  paramsHtml += paramRow('Comentarios', '', function(data){ return data.observaciones || '-'; });

  var tabla = '<div class="table-scroll"><table class="rr-table"><thead><tr>'+theadCols+'</tr></thead><tbody>' +
    matRowsHtml + amcRow + cvdRow + paramsHtml +
    '</tbody></table></div>';

  var diasSet = {};
  reps.forEach(function(rep){ cargasDeReplica(rep.nombre).forEach(function(c){ diasSet[c.dia]=true; }); });
  var diasOrd = Object.keys(diasSet).map(Number).sort(function(a,b){return a-b;});
  var edadHtml = '';
  if(diasOrd.length){
    var edadHead = '<th>Edad</th>' + reps.map(function(rep){ return '<th>'+esc(rep.nombre)+'</th>'; }).join('') + '<th>Requisito/Parámetro</th>';
    var edadRows = diasOrd.map(function(dia){
      var cells = reps.map(function(rep){
        var c = cargasDeReplica(rep.nombre).filter(function(x){ return x.dia===dia; })[0];
        return '<td>'+(c&&c.promedio?c.promedio:'-')+'</td>';
      }).join('');
      return '<tr><td>'+dia+' d</td>'+cells+'<td>-</td></tr>';
    }).join('');
    edadHtml = '<div class="section-title-row" style="margin-top:18px;"><h3>Edad / Resistencia</h3></div>' +
      '<div class="table-scroll"><table class="rr-table"><thead><tr>'+edadHead+'</tr></thead><tbody>'+edadRows+'</tbody></table></div>';
  }

  return head + tabla + edadHtml;
}

function buildInformeCharts(d, intento){
  intento = intento || 0;
  document.getElementById('informe-charts').innerHTML = '';
  informeCharts.forEach(function(c){ c.destroy(); });
  informeCharts = [];
  if(typeof Chart === 'undefined'){
    if(intento < 40){ setTimeout(function(){ buildInformeCharts(d, intento+1); }, 200); return; }
    document.getElementById('informe-charts').innerHTML = '<div class="empty-note">No se pudieron cargar los gráficos (sin conexión a la librería). Los datos y tablas de arriba están completos igual.</div>';
    return;
  }
  Chart.defaults.color = '#14181a';
  Chart.defaults.plugins.legend.labels.color = '#14181a';
  var reps = d.replicaObjs || [];
  if(!reps.length){
    document.getElementById('informe-charts').innerHTML = '<div class="empty-note">Todavía no hay réplicas para graficar.</div>';
    return;
  }
  var existingReplicasData = (d.resultados && d.resultados.replicas) || [];

  function addChartCard(id, title){
    var card = document.createElement('div');
    card.className = 'informe-chart-card';
    card.innerHTML = '<h4>'+title+'</h4><div class="chart-canvas-wrap"><canvas id="'+id+'"></canvas></div><button class="informe-chart-dl" data-canvas="'+id+'">Descargar PNG</button>';
    document.getElementById('informe-charts').appendChild(card);
  }
  function hmToMinInforme(s){
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
    if(!isNaN(val) && val > 0){
      return val * 60;
    }
    return null;
  }
  function pulgToNumInforme(s){ if(!s || s==='-') return 0; s=String(s); if(s.indexOf(' ')>-1){ var pp=s.split(' '); var fr=pp[1].split('/'); return Number(pp[0])+Number(fr[0])/Number(fr[1]); } if(s.indexOf('/')>-1){ var fr2=s.split('/'); return Number(fr2[0])/Number(fr2[1]); } return Number(s)||0; }

  // 1) Tiempo de fragua (barras horizontales) — diseño bimodal con etiquetas
  addChartCard('chart-fragua-inf', 'TIEMPO DE FRAGUA (hh:mm)');
  var labelsRep = reps.map(function(rep){ return rep.nombre; });
  var iniMin = reps.map(function(rep, idx){ return hmToMinInforme((existingReplicasData[idx]||{}).thermoIni) || 0; });
  var durMin = reps.map(function(rep, idx){
    var f = hmToMinInforme((existingReplicasData[idx]||{}).thermoFin);
    if(f === null) return 0;
    return f > iniMin[idx] ? f - iniMin[idx] : f;
  });
  var hayFragua = iniMin.some(function(v){ return v>0; }) || durMin.some(function(v){ return v>0; });
  informeCharts.push(new Chart(document.getElementById('chart-fragua-inf'), {
    type:'bar',
    data:{
      labels:labelsRep,
      datasets:[
        {
          label:'Fragua Inicial',
          data:iniMin,
          backgroundColor:'#1688fe',
          hoverBackgroundColor:'#1273d8'
        },
        {
          label:'Fragua Final',
          data:durMin,
          backgroundColor:'#0c2288',
          hoverBackgroundColor:'#091a6d'
        }
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
          labels:{
            usePointStyle:true,
            pointStyle:'circle',
            boxWidth:8,
            boxHeight:8,
            padding:14,
            font:{weight:600, size:11}
          }
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
        y:{
          stacked:true,
          title:{display:true, text:'DISEÑO', font:{weight:700}}
        }
      }
    },
    plugins:[fraguaDataLabelsPlugin]
  }));
  if(!hayFragua){
    document.querySelector('#chart-fragua-inf').closest('.informe-chart-card').querySelector('.chart-canvas-wrap').insertAdjacentHTML('beforeend', '<div class="empty-note" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;text-align:center;padding:14px;background:rgba(255,255,255,0.92);backdrop-filter:blur(2px);border-radius:6px;z-index:2;color:var(--text-muted);font-weight:500;">Todavía no se cargó fragua inicial/final (Cargar Resultados) para este diseño.</div>');
  }

  // 2) Resistencia vs Tiempo (líneas) — mismo estilo que RR
  addChartCard('chart-resistencia', 'Resistencia vs Tiempo');
  var datasetsResist = reps.map(function(rep, idx){
    var pts = cargasDeReplica(rep.nombre).filter(function(c){ return c.promedio; }).map(function(c){ return {x:Number(c.dia), y:Number(c.promedio)}; }).sort(function(a,b){ return a.x-b.x; });
    return {label:rep.nombre, data:pts, borderColor:REPLICA_COLORS[idx%4], backgroundColor:REPLICA_COLORS[idx%4], pointRadius:5, pointHoverRadius:7, borderWidth:2.5, tension:.25};
  });
  informeCharts.push(new Chart(document.getElementById('chart-resistencia'), {
    type:'line', data:{datasets:datasetsResist},
    options:{responsive:true, maintainAspectRatio:false, scales:{x:{type:'linear', title:{display:true,text:'Días'}}, y:{title:{display:true,text:'Resistencia (kg/cm²)'}}}}
  }));

  // 3) Trabajabilidad (barras agrupadas por minuto) — mismo estilo que RR
  addChartCard('chart-slump', 'Trabajabilidad (pérdida de asentamiento)');
  var coloresMin = ['#0396c8','#0b5f7a','#2e9e57','#38bdf8','#7cc96b'];
  var datasetsSlump = SLUMP_ROWS.map(function(label, si){
    return {label:label+"'", data: reps.map(function(rep, idx){ var row=(existingReplicasData[idx]||{}).slump; return row ? pulgToNumInforme(row[si] && row[si].slump) : 0; }), backgroundColor:coloresMin[si%5]};
  });
  var hayDatosSlump = datasetsSlump.some(function(ds){ return ds.data.some(function(v){ return v>0; }); });
  informeCharts.push(new Chart(document.getElementById('chart-slump'), {
    type:'bar', data:{labels:labelsRep, datasets:datasetsSlump},
    options:{responsive:true, maintainAspectRatio:false, scales:{y:{title:{display:true,text:'Slump (pulgadas)'}}}}
  }));
  if(!hayDatosSlump){
    document.querySelector('#chart-slump').closest('.informe-chart-card').querySelector('.chart-canvas-wrap').insertAdjacentHTML('beforeend', '<div class="empty-note" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;text-align:center;padding:14px;background:rgba(255,255,255,0.92);backdrop-filter:blur(2px);border-radius:6px;z-index:2;color:var(--text-muted);font-weight:500;">Todavía no se cargaron resultados de consistencia (Cargar Resultados) para este diseño.</div>');
  }
}

document.getElementById('informe-charts').addEventListener('click', function(e){
  var btn = e.target.closest('.informe-chart-dl');
  if(!btn) return;
  var canvas = document.getElementById(btn.dataset.canvas);
  var link = document.createElement('a');
  link.download = btn.dataset.canvas + '.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
});

function setInformeZoom(z){
  informeZoom = Math.max(.25, Math.min(2, z));
  document.getElementById('informe-recap').style.transform = 'scale('+informeZoom+')';
  document.getElementById('informe-zoom-pct').textContent = Math.round(informeZoom*100) + '%';
}
document.getElementById('informe-zoom-in').addEventListener('click', function(){ setInformeZoom(informeZoom + .1); });
document.getElementById('informe-zoom-out').addEventListener('click', function(){ setInformeZoom(informeZoom - .1); });

var currentInformeDesign = null;
function openInformeModal(d){
  currentInformeDesign = d;
  document.getElementById('informe-title').textContent = diseñoTitulo(d);
  document.getElementById('informe-recap').innerHTML = informeRecapHtml(d);
  setInformeZoom(.6);
  buildInformeCharts(d);
  document.getElementById('informe-modal').classList.add('show');
}
document.getElementById('informe-modal-close').addEventListener('click', function(){ document.getElementById('informe-modal').classList.remove('show'); });
document.getElementById('informe-modal').addEventListener('click', function(e){ if(e.target.id === 'informe-modal') document.getElementById('informe-modal').classList.remove('show'); });

document.getElementById('informe-download-pdf').addEventListener('click', function(){
  if(!currentInformeDesign || typeof window.jspdf === 'undefined'){ toast('No se pudo generar el PDF'); return; }
  var d = currentInformeDesign;
  var jsPDF = window.jspdf.jsPDF;
  var doc = new jsPDF('p','mm','a4');
  var pageW = 210, margin = 12, y = margin;
  doc.setFont('helvetica','bold'); doc.setFontSize(14);
  doc.text(diseñoTitulo(d), pageW/2, y, {align:'center'}); y += 8;
  doc.setFont('helvetica','normal'); doc.setFontSize(9);
  doc.text('Planta: '+(d.planta||'-')+'   f\'c: '+(d.fc||'-')+' kg/cm2   Fecha: '+(d.fecha||'-'), margin, y); y += 8;
  doc.setFont('helvetica','bold'); doc.text('Composición de mezcla', margin, y); y += 6;
  doc.setFont('helvetica','normal'); doc.setFontSize(8);
  (d.mix||[]).forEach(function(item){
    doc.text(esc(item.nombre)+' — Peso seco: '+n(item.pesoSeco).toFixed(2)+' kg/m3', margin, y); y += 5;
    if(y > 270){ doc.addPage(); y = margin; }
  });
  y += 4;
  informeCharts.forEach(function(chart){
    var canvas = chart.canvas;
    var imgData = canvas.toDataURL('image/png');
    var imgW = pageW - margin*2, imgH = imgW * (canvas.height/canvas.width);
    if(y + imgH > 280){ doc.addPage(); y = margin; }
    doc.addImage(imgData, 'PNG', margin, y, imgW, imgH);
    y += imgH + 8;
  });
  doc.save(diseñoTitulo(d)+'-informe.pdf');
  toast('Informe PDF descargado');
});
