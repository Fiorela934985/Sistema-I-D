/* Sistema I+D — Inventario (solo lectura): equipos con su calibración y materiales con su stock.
   Regla 5: un equipo con calibración vencida no se puede elegir al registrar un ensayo. */
'use strict';

var Inventario = (function(){
  var datos = {equipos:[], materiales:[], conectado:false, en:0};
  function cargar(forzar){
    if(!Nube.activa() || !Nube.tieneToken()) return Promise.resolve(datos);
    if(!forzar && datos.en && Date.now() - datos.en < 600000) return Promise.resolve(datos);
    return Promise.all([Nube.pedir('GET', '/api/inventario/equipos'), Nube.pedir('GET', '/api/inventario/materiales')]).then(function(r){
      datos = {equipos:r[0].equipos || [], materiales:r[1].materiales || [], conectado:!!r[0].conectado, en:Date.now()};
      return datos;
    }).catch(function(){ return datos; });
  }
  function equipo(cod){ var c = String(cod || '').trim().toUpperCase(); return datos.equipos.filter(function(e){ return String(e.codigo).toUpperCase() === c || String(e.identificacion).toUpperCase() === c; })[0] || null; }
  function material(cod){ var c = String(cod || '').trim().toUpperCase(); return datos.materiales.filter(function(m){ return String(m.codigo).toUpperCase() === c; })[0] || null; }
  return {cargar:cargar, conectado:function(){ return datos.conectado; }, equipos:function(){ return datos.equipos; }, materiales:function(){ return datos.materiales; }, equipo:equipo, material:material};
})();

/* Campo "Equipo usado": lista del inventario (solo vigentes se pueden elegir) o texto si no hay inventario */
function campoEquipoHtml(id, valor){
  if(!Inventario.conectado()) return '<input type="text" id="' + id + '" value="' + esc(valor || '') + '" placeholder="Código del equipo">';
  var grupos = {};
  Inventario.equipos().forEach(function(e){ (grupos[e.laboratorio || 'Sin laboratorio'] = grupos[e.laboratorio || 'Sin laboratorio'] || []).push(e); });
  return '<select id="' + id + '"><option value="">Elegí el equipo</option>' + Object.keys(grupos).sort().map(function(g){
    return '<optgroup label="' + esc(g) + '">' + grupos[g].map(function(e){
      var txt = e.codigo + ' · ' + e.nombre + (e.vigente ? (e.vence ? ' · vence ' + isoToDMY(e.vence) : '') : ' — ' + e.motivo);
      return '<option value="' + esc(e.codigo) + '"' + (e.vigente ? '' : ' disabled') + (e.codigo === valor ? ' selected' : '') + '>' + esc(txt) + '</option>';
    }).join('') + '</optgroup>';
  }).join('') + '</select>';
}
/* Avisos del plan por los recursos del inventario (avisan, no bloquean) */
function avisosRecursosInventario(it){
  if(!Inventario.conectado()) return [];
  var out = [];
  String(it.recursos || '').split(',').map(function(x){ return x.trim(); }).filter(Boolean).forEach(function(r){
    var e = Inventario.equipo(r), m = Inventario.material(r);
    if(e){
      if(!e.vigente) out.push(e.codigo + ': ' + e.motivo.toLowerCase());
      else if(e.vence && it.fin && e.vence <= it.fin) out.push('Calibración de ' + e.codigo + ' vence el ' + isoToDMY(e.vence));
    }
    if(m && m.bajo) out.push('Stock bajo de ' + m.nombre + ' (' + m.stock + ' ' + (m.unidad_medida || '') + ')');
  });
  return out;
}
function datalistRecursosHtml(){
  if(!Inventario.conectado()) return '';
  return '<datalist id="recursos-inventario">' + Inventario.equipos().map(function(e){ return '<option value="' + esc(e.codigo) + '">' + esc(e.nombre) + '</option>'; }).join('') +
    Inventario.materiales().map(function(m){ return '<option value="' + esc(m.codigo) + '">' + esc(m.nombre) + '</option>'; }).join('') + '</datalist>';
}
