/* Sistema I+D — Calidad › Historial de cambios (ISO/IEC 17025: 7.11, 8.4).
   Quién, cuándo, valor anterior, valor nuevo y motivo, con filtros por usuario, módulo, código y fecha.
   Solo lectura. Con servidor conectado se muestra el historial del servidor (el oficial); sin servidor, el de
   este navegador. */
'use strict';

var hisPagina = 0;
var HIS_POR_PAGINA = 30;
var hisFuente = [];     // movimientos que se muestran (servidor o locales)
var hisOrigen = 'local';

function filaServidorAHistorial(f){
  var parse = function(v){ if(v === null || v === undefined) return null; try{ return JSON.parse(v); }catch(e){ return v; } };
  return {ts:Date.parse(f.ts), usuario:f.usuario, rol:f.rol || '', accion:f.accion, entidad:f.modulo, detalle:f.detalle || '', codigo:f.codigo || '',
    antes:parse(f.valor_anterior), despues:parse(f.valor_nuevo), motivo:f.motivo || '', proyecto:f.proyecto || ''};
}
function cargarFuenteHistorial(){
  if(Nube.activa() && Nube.tieneToken()){
    hisOrigen = 'servidor';
    return Nube.pedir('GET', '/api/historial?limite=2000').then(function(filas){ hisFuente = filas.map(filaServidorAHistorial); })
      .catch(function(){ hisOrigen = 'local'; hisFuente = historial; toast('Sin conexión: se muestra el historial de este navegador'); });
  }
  hisOrigen = 'local';
  hisFuente = historial;
  return Promise.resolve();
}
function historialFiltrado(){
  var txt = normalizar(document.getElementById('his-buscar').value);
  var cod = normalizar(document.getElementById('his-codigo').value);
  var usr = document.getElementById('his-usuario').value;
  var ent = document.getElementById('his-entidad').value;
  var desde = document.getElementById('his-desde').value;
  var hasta = document.getElementById('his-hasta').value;
  return hisFuente.filter(function(h){
    if(usr && h.usuario !== usr) return false;
    if(ent && h.entidad !== ent) return false;
    if(cod && normalizar(h.codigo).indexOf(cod) === -1) return false;
    var dia = isoDe(new Date(h.ts));
    if(desde && dia < desde) return false;
    if(hasta && dia > hasta) return false;
    if(txt && normalizar([h.accion, h.entidad, h.detalle, h.proyecto, h.usuario, h.codigo, h.motivo].join(' ')).indexOf(txt) === -1) return false;
    return true;
  });
}
function renderHistorialPanel(){
  cargarFuenteHistorial().then(function(){
    var usuariosSet = {}, entidades = {};
    hisFuente.forEach(function(h){ usuariosSet[h.usuario] = true; entidades[h.entidad] = true; });
    var selU = document.getElementById('his-usuario'), aU = selU.value;
    selU.innerHTML = '<option value="">Todos los usuarios</option>' + Object.keys(usuariosSet).sort().map(function(u){ return '<option'+(u===aU?' selected':'')+'>'+esc(u)+'</option>'; }).join('');
    var selE = document.getElementById('his-entidad'), aE = selE.value;
    selE.innerHTML = '<option value="">Todos los módulos</option>' + Object.keys(entidades).sort().map(function(e){ return '<option'+(e===aE?' selected':'')+'>'+esc(e)+'</option>'; }).join('');
    var hoy = todayISO();
    var deHoy = hisFuente.filter(function(h){ return isoDe(new Date(h.ts)) === hoy; });
    var semana = Date.now() - 7*DAY;
    var conMotivo = hisFuente.filter(function(h){ return h.motivo; }).length;
    var activos = {}; hisFuente.forEach(function(h){ if(h.ts >= semana) activos[h.usuario] = true; });
    document.getElementById('his-kpis').innerHTML =
      kpiCard('kpi-naranja', ICO_ACTIVO, hisFuente.length, 'Movimientos · ' + (hisOrigen === 'servidor' ? 'servidor' : 'este navegador')) +
      kpiCard('kpi-verde', ICO_DISENO, deHoy.length, 'Movimientos hoy') +
      kpiCard('kpi-negro', ICO_CARPETA, Object.keys(activos).length, 'Usuarios activos (7 días)') +
      kpiCard('kpi-rojo', ICO_RESIST, conMotivo, 'Cambios con motivo');
    renderHistorialTabla();
  });
}
var COLOR_ACCION = {'Creó':'tag-verde', 'Registró':'tag-verde', 'Autorizó':'tag-verde', 'Editó':'tag-celeste', 'Anuló':'tag-rojo', 'Revocó':'tag-rojo', 'Eliminó':'tag-rojo', 'Rechazó':'tag-rojo',
  'Ingresó':'tag-gris', 'Salió':'tag-gris', 'Exportó':'tag-celeste', 'Generó':'tag-verde', 'Subió':'tag-verde', 'Imprimió':'tag-gris', 'Restauró':'tag-naranja'};
function valorCorto(v){
  if(v === null || v === undefined) return '';
  if(typeof v !== 'object') return String(v);
  if(Array.isArray(v)) return v.map(valorCorto).join(', ');
  return Object.keys(v).map(function(k){ var x = v[k]; return k + ': ' + (x !== null && typeof x === 'object' ? JSON.stringify(x) : (x === null || x === '' ? '—' : x)); }).join(' · ');
}
function celdaValor(v){
  var t = valorCorto(v);
  if(!t) return '<span class="nota-sm">—</span>';
  return '<span class="his-valor" title="' + esc(t) + '">' + esc(t.length > 90 ? t.slice(0, 90) + '…' : t) + '</span>';
}
function renderHistorialTabla(){
  var lista = historialFiltrado();
  var paginas = Math.max(1, Math.ceil(lista.length / HIS_POR_PAGINA));
  if(hisPagina >= paginas) hisPagina = paginas - 1;
  var vis = lista.slice(hisPagina*HIS_POR_PAGINA, (hisPagina+1)*HIS_POR_PAGINA);
  document.getElementById('his-tabla').innerHTML = '<thead><tr><th>Fecha y hora</th><th>Usuario</th><th>Acción</th><th>Módulo</th><th>Código</th><th>Detalle</th><th>Valor anterior</th><th>Valor nuevo</th><th>Motivo</th></tr></thead><tbody>' +
    (vis.length ? vis.map(function(h){
      return '<tr><td class="mono">'+fechaHora(h.ts)+'</td><td><b>'+esc(h.usuario)+'</b><div class="nota-sm">'+esc(rolLabel(h.rol)||'')+'</div></td>' +
        '<td><span class="tag-pill '+(COLOR_ACCION[h.accion]||'tag-gris')+'">'+esc(h.accion)+'</span></td><td>'+esc(h.entidad)+'</td>' +
        '<td class="mono">'+esc(h.codigo || '')+'</td>' +
        '<td>'+esc(h.detalle)+(h.proyecto ? ' <a href="#" data-his-proy="'+esc(h.proyecto)+'">'+esc(h.proyecto)+'</a>' : '')+'</td>' +
        '<td>'+celdaValor(h.antes)+'</td><td>'+celdaValor(h.despues)+'</td><td>'+(h.motivo ? esc(h.motivo) : '<span class="nota-sm">—</span>')+'</td></tr>';
    }).join('') : '<tr><td colspan="9" class="empty-note">Sin movimientos con este filtro.</td></tr>') + '</tbody>';
  document.getElementById('his-paginacion').innerHTML = lista.length > HIS_POR_PAGINA
    ? '<button class="btn-ghost" data-his-pag="-1"'+(hisPagina===0?' disabled':'')+'>‹ Anterior</button><span>Página '+(hisPagina+1)+' de '+paginas+' · '+lista.length+' movimientos</span><button class="btn-ghost" data-his-pag="1"'+(hisPagina>=paginas-1?' disabled':'')+'>Siguiente ›</button>'
    : '<span>'+lista.length+' movimientos</span>';
}
['his-buscar','his-codigo','his-usuario','his-entidad','his-desde','his-hasta'].forEach(function(id){
  document.getElementById(id).addEventListener(id === 'his-buscar' || id === 'his-codigo' ? 'input' : 'change', function(){ hisPagina = 0; renderHistorialTabla(); });
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
  if(exportarExcel('Historial de cambios - ' + todayISO() + '.xlsx', [{nombre:'Historial', filas:[['Fecha y hora','Usuario','Rol','Acción','Módulo','Código','Detalle','Valor anterior','Valor nuevo','Motivo','Proyecto']].concat(lista.map(function(h){
    return [fechaHora(h.ts), h.usuario, rolLabel(h.rol), h.accion, h.entidad, h.codigo, h.detalle, valorCorto(h.antes), valorCorto(h.despues), h.motivo, h.proyecto];
  }))}])) toast('Historial exportado');
});
PANEL_HOOKS.historial = function(){ renderHistorialPanel(); };
