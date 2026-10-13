/* Sistema I+D — Base histórica: dataset consolidado (réplica × edad), exportación y respaldo completo. */
'use strict';

var bhPagina = 0;
var BH_POR_PAGINA = 25;

function bhFilasFiltradas(){
  var txt = normalizar(document.getElementById('bh-buscar').value);
  var proy = document.getElementById('bh-proyecto').value;
  var edad = document.getElementById('bh-edad').value;
  var est = document.getElementById('bh-estado').value;
  return baseHistoricaFilas().filter(function(f){
    if(proy && f.proyecto !== proy) return false;
    if(edad && String(f.edad) !== edad) return false;
    if(est === 'completado' && f.resistencia === '') return false;
    if(est === 'pendiente' && f.resistencia !== '') return false;
    if(txt && normalizar([f.diseno, f.disenoCodigo, f.codigoId, f.replica, f.proyecto].join(' ')).indexOf(txt) === -1) return false;
    return true;
  }).sort(function(a,b){ return (b.fechaEnsayo||'').localeCompare(a.fechaEnsayo||''); });
}
function renderBaseHistorica(){
  var todas = baseHistoricaFilas();
  var conRes = todas.filter(function(f){ return f.resistencia !== ''; });
  var fechas = todas.map(function(f){ return f.fechaElaboracion; }).filter(Boolean).sort();
  var proyectos = {}; todas.forEach(function(f){ if(f.proyecto) proyectos[f.proyecto] = true; });
  document.getElementById('bh-kpis').innerHTML =
    kpiCard('kpi-naranja', ICO_DISENO, todas.length, 'Registros (réplica × edad)') +
    kpiCard('kpi-verde', ICO_RESIST, conRes.length, 'Con resultado de resistencia') +
    kpiCard('kpi-negro', ICO_CARPETA, Object.keys(proyectos).length, 'Proyectos con datos') +
    kpiCard('kpi-rojo', ICO_ACTIVO, fechas.length ? isoToDMY(fechas[0]).slice(3) + ' → ' + isoToDMY(fechas[fechas.length-1]).slice(3) : '-', 'Rango de elaboración');
  var selP = document.getElementById('bh-proyecto'), actP = selP.value;
  selP.innerHTML = '<option value="">Todos los proyectos</option>' + Object.keys(proyectos).sort().map(function(p){ return '<option'+(p===actP?' selected':'')+'>'+esc(p)+'</option>'; }).join('');
  var edades = {}; todas.forEach(function(f){ edades[f.edad] = true; });
  var selE = document.getElementById('bh-edad'), actE = selE.value;
  selE.innerHTML = '<option value="">Todas las edades</option>' + Object.keys(edades).map(Number).sort(function(a,b){ return a-b; }).map(function(e){ return '<option value="'+e+'"'+(String(e)===actE?' selected':'')+'>'+e+' días</option>'; }).join('');
  renderBHTabla();
}
function renderBHTabla(){
  var filas = bhFilasFiltradas();
  var paginas = Math.max(1, Math.ceil(filas.length / BH_POR_PAGINA));
  if(bhPagina >= paginas) bhPagina = paginas - 1;
  var visibles = filas.slice(bhPagina*BH_POR_PAGINA, (bhPagina+1)*BH_POR_PAGINA);
  var cols = BH_COLUMNAS.filter(function(c){ return ['planta','coefVar','cvd','fechaElaboracion'].indexOf(c.k) === -1; });
  document.getElementById('bh-tabla').innerHTML = '<thead><tr>' + cols.map(function(c){ return '<th>'+esc(c.t)+'</th>'; }).join('') + '</tr></thead><tbody>' +
    (visibles.length ? visibles.map(function(f){
      return '<tr>' + cols.map(function(c){
        var v = f[c.k];
        if(c.k === 'fechaEnsayo') v = isoToDMY(v);
        if(c.k === 'flyAsh') v = v === 1 ? 'Sí' : (v === 0 ? 'No' : '');
        if(c.k === 'estado') return '<td><span class="tag-pill '+(v==='completado'?'tag-verde':'tag-gris')+'">'+(v==='completado'?'Con resultado':'Pendiente')+'</span></td>';
        if(c.k === 'resistencia') return '<td><b>'+(v===''?'-':v)+'</b></td>';
        return '<td'+(c.k==='disenoCodigo'||c.k==='codigoId'?' class="mono"':'')+'>'+esc(v===''?'-':v)+'</td>';
      }).join('') + '</tr>';
    }).join('') : '<tr><td colspan="'+cols.length+'" class="empty-note">Sin registros con este filtro.</td></tr>') + '</tbody>';
  document.getElementById('bh-paginacion').innerHTML = filas.length > BH_POR_PAGINA
    ? '<button class="btn-ghost" data-bh-pag="-1"'+(bhPagina===0?' disabled':'')+'>‹ Anterior</button><span>Página '+(bhPagina+1)+' de '+paginas+' · '+filas.length+' registros</span><button class="btn-ghost" data-bh-pag="1"'+(bhPagina>=paginas-1?' disabled':'')+'>Siguiente ›</button>'
    : '<span>'+filas.length+' registros</span>';
}
['bh-buscar','bh-proyecto','bh-edad','bh-estado'].forEach(function(id){
  document.getElementById(id).addEventListener(id === 'bh-buscar' ? 'input' : 'change', function(){ bhPagina = 0; renderBHTabla(); });
});
document.getElementById('bh-paginacion').addEventListener('click', function(e){
  var b = e.target.closest('[data-bh-pag]');
  if(!b) return;
  bhPagina += Number(b.dataset.bhPag);
  renderBHTabla();
});
function bhMatriz(filas){ return [BH_COLUMNAS.map(function(c){ return c.t; })].concat(filas.map(function(f){ return BH_COLUMNAS.map(function(c){ return f[c.k]; }); })); }
document.getElementById('bh-export-xlsx').addEventListener('click', function(){
  if(!exigir('datos:exportar')) return;
  var filas = bhFilasFiltradas();
  if(exportarExcel('Base historica I+D - ' + todayISO() + '.xlsx', [{nombre:'Base histórica', filas:bhMatriz(filas)}])){
    registrarHistorial('Exportó', 'Base histórica', filas.length + ' registros (Excel)');
    toast('Base histórica exportada');
  }
});
document.getElementById('bh-export-csv').addEventListener('click', function(){
  if(!exigir('datos:exportar')) return;
  // CSV listo para Colab / XGBoost: solo filas con resultado y columnas numéricas con nombres simples.
  var cols = ['proyecto','disenoCodigo','fc','amc','cementoTipo','cementoKg','flyAsh','edad','resistencia'];
  var filas = bhFilasFiltradas().filter(function(f){ return f.resistencia !== ''; });
  var csv = aCSV([cols].concat(filas.map(function(f){ return cols.map(function(k){ return k === 'cementoTipo' ? (f[k] === 'HE' ? 1 : 0) : f[k]; }); })));
  descargarArchivo('dataset_resistencia_' + todayISO() + '.csv', '﻿' + csv, 'text/csv;charset=utf-8');
  registrarHistorial('Exportó', 'Base histórica', filas.length + ' registros (CSV para modelo)');
  toast('Dataset CSV descargado (cementoTipo: 1 = HE, 0 = Tipo I)');
});

/* ---- Respaldo completo y restauración ---- */
function clavesDelSistema(){
  var out = [];
  for(var i=0;i<localStorage.length;i++){ var k = localStorage.key(i); if(/^sid/.test(k)) out.push(k); }
  return out;
}
document.getElementById('bh-respaldo-descargar').addEventListener('click', function(){
  if(!exigir('datos:respaldo')) return;
  var datos = {};
  clavesDelSistema().forEach(function(k){ try{ datos[k] = JSON.parse(localStorage.getItem(k)); }catch(e){ datos[k] = localStorage.getItem(k); } });
  var respaldo = {app:'sistema-id', version:2, exportado:new Date().toISOString(), usuario: usuarioActual ? usuarioActual.usuario : '', datos:datos};
  descargarArchivo('respaldo-sistema-id-' + todayISO() + '.json', JSON.stringify(respaldo), 'application/json');
  registrarHistorial('Exportó', 'Respaldo', Object.keys(datos).length + ' colecciones');
  toast('Respaldo descargado');
});
document.getElementById('bh-respaldo-archivo').addEventListener('change', function(){
  var file = this.files[0];
  this.value = '';
  if(!file) return;
  if(!exigir('datos:respaldo')) return;
  var reader = new FileReader();
  reader.onload = function(){
    var r;
    try{ r = JSON.parse(reader.result); }catch(e){ toast('El archivo no es un respaldo válido'); return; }
    if(!r || r.app !== 'sistema-id' || !r.datos){ toast('El archivo no es un respaldo del Sistema I+D'); return; }
    var n = Object.keys(r.datos).length;
    if(!confirm('Se reemplazarán TODOS los datos de este navegador por el respaldo del ' + (r.exportado||'').slice(0,10) + ' (' + n + ' colecciones).\n\n¿Continuar?')) return;
    clavesDelSistema().forEach(function(k){ if(k !== 'sid_sesion') localStorage.removeItem(k); });
    Object.keys(r.datos).forEach(function(k){ localStorage.setItem(k, JSON.stringify(r.datos[k])); });
    // Se registra en el historial restaurado y se recarga para que todos los módulos lean los datos nuevos.
    var his = r.datos.sid_historial || [];
    his.unshift({id:'h'+Date.now(), ts:Date.now(), usuarioId: usuarioActual ? usuarioActual.id : '', usuario: usuarioActual ? usuarioActual.usuario : '', rol: usuarioActual ? usuarioActual.rol : '',
      accion:'Restauró', entidad:'Respaldo', detalle:'Respaldo del ' + (r.exportado||'').slice(0,10), proyecto:'', ref:''});
    localStorage.setItem('sid_historial', JSON.stringify(his));
    alert('Respaldo restaurado. La aplicación se va a recargar.');
    location.reload();
  };
  reader.readAsText(file);
});
function renderNotaDemo(){
  var n = disenosDeDemostracion().length;
  document.getElementById('bh-quitar-demo').style.display = n ? '' : 'none';
  document.getElementById('bh-demo-nota').textContent = n ? 'Hay ' + n + ' diseños de demostración (cargados para ver el sistema con contenido). Se mezclan con los reales en rankings y predicciones; podés quitarlos cuando empiecen a usarlo de verdad.' : '';
}
document.getElementById('bh-quitar-demo').addEventListener('click', function(){
  if(!exigir('datos:respaldo')) return;
  var n = disenosDeDemostracion().length;
  if(!n) return;
  if(!confirm('Se eliminarán ' + n + ' diseños de demostración con sus roturas. Los diseños reales (importados del CSV o creados con la calculadora) no se tocan.\n\nRecomendación: descargá antes un respaldo. ¿Continuar?')) return;
  var r = eliminarDatosDemostracion();
  toast('Se quitaron ' + r.disenos + ' diseños y ' + r.cargas + ' roturas de demostración');
  renderAllDesignViews();
  renderRoturasAll();
  renderBaseHistorica();
  renderNotaDemo();
});
PANEL_HOOKS['base-historica'] = function(){ renderBaseHistorica(); renderNotaDemo(); };
