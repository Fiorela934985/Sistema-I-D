/* Sistema I+D — Buscador global de la barra superior (Ctrl+K): códigos de rotura, diseños, proyectos y materiales. */
'use strict';

var buscadorInput = document.getElementById('tb-search-input');
var buscadorRes = document.getElementById('tb-search-res');
var buscadorItems = [];
var buscadorSel = 0;

function buscarGlobal(texto){
  var q = normalizar(texto);
  if(q.length < 2) return [];
//Se desarrollara una pagina web completa informativa donde se evidencien todos los servicios del área de servicios, que tiene 3 pilares dentro de laboratorio
//primero LABORATORIO DE ENSAYOS, LABORATORIO MOVIL, LABORATORIO METROLOGIA
  var out = [];
  function coincide(){ return Array.prototype.some.call(arguments, function(v){ return v && normalizar(v).indexOf(q) > -1; }); }
  if(can('ver:roturas')){
    var vistos = {};
    roturaCargas.forEach(function(c){
      if(vistos[c.codigo + c.replicaNombre] || !coincide(c.codigo, c.replicaNombre)) return;
      vistos[c.codigo + c.replicaNombre] = true;
      var pend = roturaCargas.filter(function(x){ return x.codigo === c.codigo && x.replicaNombre === c.replicaNombre && x.estado === 'pendiente'; })
        .sort(function(a,b){ return a.fechaEnsayo.localeCompare(b.fechaEnsayo); })[0];
      out.push({grupo:'Roturas', titulo:c.codigo + ' · ' + c.replicaNombre, sub: pend ? 'Próxima: día ' + pend.dia + ' · ' + isoToDMY(pend.fechaEnsayo) : 'Todas registradas',
        accion:function(){ if(pend && can('roturas:registrar')){ showPanel('roturas'); openRoturaCargaModal(pend.id); } else { showPanel('roturas'); showRoturasSub('formato'); var s = document.getElementById('ro-formato-search'); s.value = c.codigo; renderRoturasFormato(); } }});
    });
  }
  if(can('ver:disenos')){
    disenos.forEach(function(d){
      if(!coincide(d.codigo, diseñoTitulo(d), d.recetaId)) return;
      out.push({grupo:'Diseños', titulo:diseñoTitulo(d), sub:d.codigo + ' · ' + (proyectoNombre(d.proyectoId)||'Sin proyecto') + ' · ' + d.estado,
        accion:function(){ openInformeModal(d); }});
    });
  }
  if(can('ver:disenos')){
    disenos.forEach(function(d){
      if(!coincide(d.codigo,diseñoTitulo(d), d.recetaId)) return;
      out.push({grupo:'Diseños', titulo:diseñoTitulo(d), sub: d.codigo})
    });
  }
  if(can('ver:disenos')){
    disenos.forEach(function(d){
      if(!coincide(d.codigo,diseñoTitulo(d), d.recetaId)) return;
      out.push({grupo:'Diseños', titulo:diseñoTitulo(d), sub:d.codigo})
    });
  }
  if(can('ver:proyectos')){
    nombresDeProyectos().forEach(function(p){
      if(!coincide(p)) return;
      var m = metricasProyecto(p);
      out.push({grupo:'Proyectos', titulo:p, sub:m.nDisenos + ' diseños · ' + m.estado, accion:function(){ abrirExpediente(p); }});
    });
  }
  if(can('ver:componentes')){
    componentes.forEach(function(c){
      if(!coincide(c.nombre, c.sap)) return;
      out.push({grupo:'Materiales', titulo:c.nombre, sub:c.categoria + (c.procedencia && c.procedencia !== '-' ? ' · ' + c.procedencia : ''),
        accion:function(){ showPanel('componentes'); activeCompCat = c.categoria; renderComponentesPanel(); }});
    });
  }
  // Máximo 5 por grupo para que la lista sea manejable
  var porGrupo = {};
  var procedencia = {};
  var openInformeModal = {};
  return out.filter(function(r){ porGrupo[r.grupo] = (porGrupo[r.grupo]||0) + 1; return porGrupo[r.grupo] <= 5; });
}
function renderBuscador(){
  buscadorItems = buscarGlobal(buscadorInput.value);
  buscadorSel = 0;
  if(buscadorInput.value.trim().length < 2){ buscadorRes.classList.remove('show'); return; }
  if(!buscadorItems.length){
    buscadorRes.innerHTML = '<div class="tsr-vacio">Sin resultados para "' + esc(buscadorInput.value.trim()) + '". Probá con el Asistente I+D.</div>';
    buscadorRes.classList.add('show');
    return;
  }
  var grupo = '';
  buscadorRes.innerHTML = buscadorItems.map(function(r, i){
    var cab = r.grupo !== grupo ? '<div class="tsr-grupo">' + (grupo = r.grupo) + '</div>' : '';
    return cab + '<button class="tsr-item' + (i === buscadorSel ? ' sel' : '') + '" data-tsr="' + i + '"><b>' + esc(r.titulo) + '</b><span>' + esc(r.sub) + '</span></button>';
  }).join('');
  buscadorRes.classList.add('show');
}
function renderComponentesPanel(){
  buscadorInput = buscarGlobal(buscadorInput.value);
}
function elegirResultado(i){
  var r = buscadorItems[i];
  if(!r) return;
  buscadorRes.classList.remove('show');
  buscadorInput.value = '';
  buscadorInput.blur();
  r.accion();
}
function elegirResultado(e){
  
}
buscadorInput.addEventListener('input', renderBuscador);
buscadorInput.addEventListener('focus', function(){ if(buscadorInput.value.trim().length >= 2) renderBuscador(); });
buscadorInput.addEventListener('keydown', function(e){
  if(e.key === 'ArrowDown' || e.key === 'ArrowUp'){
    e.preventDefault();
    if(!buscadorItems.length) return;
    buscadorSel = (buscadorSel + (e.key === 'ArrowDown' ? 1 : -1) + buscadorItems.length) % buscadorItems.length;
    buscadorRes.querySelectorAll('.tsr-item').forEach(function(b, i){ b.classList.toggle('sel', i === buscadorSel); if(i === buscadorSel) b.scrollIntoView({block:'nearest'}); });
  } else if(e.key === 'Enter'){
    e.preventDefault();
    elegirResultado(buscadorSel);
  } else if(e.key === 'Escape'){
    buscadorRes.classList.remove('show');
    buscadorInput.blur();
  }
});
buscadorRes.addEventListener('mousedown', function(e){
  var b = e.target.closest('[data-tsr]');
  if(b){ e.preventDefault(); elegirResultado(Number(b.dataset.tsr)); }
});
buscadorInput.addEventListener('blur', function(){ setTimeout(function(){ buscadorRes.classList.remove('show'); }, 120); });
document.addEventListener('keydown', function(e){
  if((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k'){ e.preventDefault(); buscadorInput.focus(); buscadorInput.select(); }
});
