/* Sistema I+D — Panel Historial: movimientos del sistema con filtros y exportación. */
'use strict';

var hisPagina = 0;
var HIS_POR_PAGINA = 30;

function historialFiltrado(){
  var txt = normalizar(document.getElementById('his-buscar').value);
  var usr = document.getElementById('his-usuario').value;
  var ent = document.getElementById('his-entidad').value;
  var desde = document.getElementById('his-desde').value;
  var hasta = document.getElementById('his-hasta').value;
  return historial.filter(function(h){
    if(usr && h.usuario !== usr) return false;
    if(ent && h.entidad !== ent) return false;
    var dia = isoDe(new Date(h.ts));
    if(desde && dia < desde) return false;
    if(hasta && dia > hasta) return false;
    if(txt && normalizar([h.accion, h.entidad, h.detalle, h.proyecto, h.usuario].join(' ')).indexOf(txt) === -1) return false;
    return true;
  });
}
function renderHistorialPanel(){
  var usuariosSet = {}, entidades = {};
  historial.forEach(function(h){ usuariosSet[h.usuario] = true; entidades[h.entidad] = true; });
  var selU = document.getElementById('his-usuario'), aU = selU.value;
  selU.innerHTML = '<option value="">Todos los usuarios</option>' + Object.keys(usuariosSet).sort().map(function(u){ return '<option'+(u===aU?' selected':'')+'>'+esc(u)+'</option>'; }).join('');
  var selE = document.getElementById('his-entidad'), aE = selE.value;
  selE.innerHTML = '<option value="">Todas las entidades</option>' + Object.keys(entidades).sort().map(function(e){ return '<option'+(e===aE?' selected':'')+'>'+esc(e)+'</option>'; }).join('');
  var hoy = todayISO();
  var deHoy = historial.filter(function(h){ return isoDe(new Date(h.ts)) === hoy; });
  var semana = Date.now() - 7*DAY;
  var activos = {}; historial.forEach(function(h){ if(h.ts >= semana) activos[h.usuario] = true; });
  var ingresos = historial.filter(function(h){ return h.accion === 'Ingresó' && h.ts >= semana; }).length;
  document.getElementById('his-kpis').innerHTML =
    kpiCard('kpi-naranja', ICO_ACTIVO, historial.length, 'Movimientos registrados') +
    kpiCard('kpi-verde', ICO_DISENO, deHoy.length, 'Movimientos hoy') +
    kpiCard('kpi-negro', ICO_CARPETA, Object.keys(activos).length, 'Usuarios activos (7 días)') +
    kpiCard('kpi-rojo', ICO_RESIST, ingresos, 'Ingresos al sistema (7 días)');
  renderHistorialTabla();
}
var COLOR_ACCION = {'Creó':'tag-verde', 'Registró':'tag-verde', 'Editó':'tag-celeste', 'Eliminó':'tag-rojo', 'Ingresó':'tag-gris', 'Salió':'tag-gris', 'Exportó':'tag-celeste', 'Generó':'tag-verde', 'Subió':'tag-verde', 'Imprimió':'tag-gris', 'Restauró':'tag-naranja'};
function renderHistorialTabla(){
  var lista = historialFiltrado();
  var paginas = Math.max(1, Math.ceil(lista.length / HIS_POR_PAGINA));
  if(hisPagina >= paginas) hisPagina = paginas - 1;
  var vis = lista.slice(hisPagina*HIS_POR_PAGINA, (hisPagina+1)*HIS_POR_PAGINA);
  document.getElementById('his-tabla').innerHTML = '<thead><tr><th>Fecha y hora</th><th>Usuario</th><th>Rol</th><th>Acción</th><th>Entidad</th><th>Detalle</th><th>Proyecto</th></tr></thead><tbody>' +
    (vis.length ? vis.map(function(h){
      return '<tr><td class="mono">'+fechaHora(h.ts)+'</td><td><b>'+esc(h.usuario)+'</b></td><td>'+esc(rolLabel(h.rol)||'-')+'</td>' +
        '<td><span class="tag-pill '+(COLOR_ACCION[h.accion]||'tag-gris')+'">'+esc(h.accion)+'</span></td><td>'+esc(h.entidad)+'</td><td>'+esc(h.detalle)+'</td>' +
        '<td>'+(h.proyecto ? '<a href="#" data-his-proy="'+esc(h.proyecto)+'">'+esc(h.proyecto)+'</a>' : '-')+'</td></tr>';
    }).join('') : '<tr><td colspan="7" class="empty-note">Sin movimientos con este filtro.</td></tr>') + '</tbody>';
  document.getElementById('his-paginacion').innerHTML = lista.length > HIS_POR_PAGINA
    ? '<button class="btn-ghost" data-his-pag="-1"'+(hisPagina===0?' disabled':'')+'>‹ Anterior</button><span>Página '+(hisPagina+1)+' de '+paginas+' · '+lista.length+' movimientos</span><button class="btn-ghost" data-his-pag="1"'+(hisPagina>=paginas-1?' disabled':'')+'>Siguiente ›</button>'
    : '<span>'+lista.length+' movimientos</span>';
}
['his-buscar','his-usuario','his-entidad','his-desde','his-hasta'].forEach(function(id){
  document.getElementById(id).addEventListener(id === 'his-buscar' ? 'input' : 'change', function(){ hisPagina = 0; renderHistorialTabla(); });
});
document.getElementById('his-paginacion').addEventListener('click', function(e){
  var b = e.target.closest('[data-his-pag]');
  if(!b) return;
  hisPagina += Number(b.dataset.hisPag);
  renderHistorialTabla();
});
document.getElementById('his-tabla').addEventListener('click', function(e){
  var a = e.target.closest('[data-his-proy]');
  if(!a) return;
  e.preventDefault();
  if(can('ver:proyectos')) abrirExpediente(a.dataset.hisProy, 'historial');
});
document.getElementById('his-exportar').addEventListener('click', function(){
  var lista = historialFiltrado();
  if(exportarExcel('Historial Sistema I+D - ' + todayISO() + '.xlsx', [{nombre:'Historial', filas:[['Fecha y hora','Usuario','Rol','Acción','Entidad','Detalle','Proyecto']].concat(lista.map(function(h){
    return [fechaHora(h.ts), h.usuario, rolLabel(h.rol), h.accion, h.entidad, h.detalle, h.proyecto];
  }))}])) toast('Historial exportado');
});
PANEL_HOOKS.historial = function(){ renderHistorialPanel(); };
