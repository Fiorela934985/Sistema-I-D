/* Sistema I+D — Entidad PROYECTO: catálogo, iteraciones y CRUD (Registro > Proyecto) */
'use strict';

/* ================= PROYECTO (lista fija, sin Tipo — el Tipo Cubos/Probetas se define en Roturas) ================= */
var PROYECTO_CATALOGO = load('sid10_proyecto_catalogo_flat', migrarCatalogoViejoSiHace());
var MES_NOMBRES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
var NUMERAL_ROMANO = ['I','II','III'];
function migrarCatalogoViejoSiHace(){
  var viejo = load('sid10_proyecto_catalogo', null);
  if(viejo && !Array.isArray(viejo)){
    var plano = [];
    Object.keys(viejo).forEach(function(tipo){ viejo[tipo].forEach(function(n){ if(plano.indexOf(n)===-1) plano.push(n); }); });
    return plano;
  }
  return ['Aditivos in House', 'Adhesivo Cementante', 'Benchmarking Ad. Cementante', 'P.I. Adhesivo Cementante', 'Estudio HE', 'Estudio HE + Fly Ash', 'Estudio HE Aditivado', 'Estudio LH', 'Estudio Aditivo', 'Estudio Escoria', 'Aditivos Chiclayo'];
}
function saveCatalogo(){ save('sid10_proyecto_catalogo_flat', PROYECTO_CATALOGO); }
var PROYECTO_ITERACIONES = load('sid10_proyecto_iteraciones', {});
function saveProyectoIteraciones(){ save('sid10_proyecto_iteraciones', PROYECTO_ITERACIONES); }
function iteracionesDeProyecto(nombre){ return PROYECTO_ITERACIONES[nombre] || []; }
function registrarIteracion(nombreProyecto, iteracionStr){
  if(!nombreProyecto || !iteracionStr) return;
  if(!PROYECTO_ITERACIONES[nombreProyecto]) PROYECTO_ITERACIONES[nombreProyecto] = [];
  if(PROYECTO_ITERACIONES[nombreProyecto].indexOf(iteracionStr) === -1){
    PROYECTO_ITERACIONES[nombreProyecto].push(iteracionStr);
    saveProyectoIteraciones();
  }
}
function proyectoId(nombre){ return nombre; }
function proyectoNombre(pid){ if(!pid) return ''; var idx = pid.indexOf('::'); return idx>-1 ? pid.slice(idx+2) : pid; }
function iteracionNombre(val){ return val || ''; }
function todosLosProyectoIds(){ return PROYECTO_CATALOGO.slice(); }
function diseñosDeProyecto(pid){ return disenos.filter(function(d){ return d.proyectoId === pid; }); }
function fillProyectoCatalogoSelect(sel, selectedId){
  var html = '<option value="">Elegí un proyecto…</option>' + PROYECTO_CATALOGO.map(function(nombre){
    return '<option value="'+esc(nombre)+'"'+(nombre===selectedId?' selected':'')+'>'+esc(nombre)+'</option>';
  }).join('');
  sel.innerHTML = html;
}
function mesActual(){ return MES_NOMBRES[new Date().getMonth()]; }
function fillMesSelect(sel, selected){
  sel.innerHTML = '<option value="">Mes…</option>' + MES_NOMBRES.map(function(m){ return '<option'+(m===selected?' selected':'')+'>'+m+'</option>'; }).join('');
}
function fillNumeralSelect(sel, selected){
  sel.innerHTML = NUMERAL_ROMANO.map(function(r){ return '<option'+(r===selected?' selected':'')+'>'+r+'</option>'; }).join('');
}
function partesDeIteracion(iteracionStr){
  if(!iteracionStr) return {mes:'', numeral:'I', tieneNumeral:false};
  var m = iteracionStr.match(/^(.*?)\s*-\s*(I{1,3})$/);
  if(m) return {mes: m[1].trim(), numeral: m[2], tieneNumeral: true};
  return {mes: iteracionStr.trim(), numeral: 'I', tieneNumeral: false};
}
function construirIteracion(mes, usarNumeral, numeral){
  return usarNumeral ? (mes + ' - ' + numeral) : mes;
}

function refreshAllProyectoSelects(){
  fillProyectoCatalogoSelect(document.getElementById('pp-proyecto'), document.getElementById('pp-proyecto').value);
  fillProyectoCatalogoSelect(document.getElementById('ro-proyecto'), document.getElementById('ro-proyecto').value);
  fillProyectoCatalogoSelect(document.getElementById('rrg-proyecto'), document.getElementById('rrg-proyecto').value);
}
document.getElementById('ro-proyecto').addEventListener('change', function(){ rebuildRoDisenoSelect(); });
document.getElementById('rrg-proyecto').addEventListener('change', function(){ renderRRGDisponibles(); });

/* ================= PROYECTO — CRUD dentro de Registro (lista plana, sin Tipo) ================= */
var proyEditing = null; // nombre de la fila que se está editando
function renderProyCrud(){
  var tbody = document.getElementById('proy-tbody');
  var rows = PROYECTO_CATALOGO.map(function(nombre){
    var nDis = diseñosDeProyecto(nombre).length;
    var nIter = iteracionesDeProyecto(nombre).length;
    return '<tr>' +
      '<td>'+esc(nombre)+'</td>' +
      '<td class="mono">'+nDis+'</td>' +
      '<td><button class="btn-add ghost" data-nombre="'+esc(nombre)+'" data-act="iter" style="font-size:.72rem;padding:6px 12px;">'+nIter+' registrada'+(nIter===1?'':'s')+' →</button></td>' +
      '<td><div class="row-actions">' +
        '<button class="btn-icon edit" data-nombre="'+esc(nombre)+'" data-act="edit" title="Editar"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>' +
        '<button class="btn-icon danger" data-nombre="'+esc(nombre)+'" data-act="del" title="Eliminar">×</button>' +
      '</div></td>' +
    '</tr>';
  });
  tbody.innerHTML = rows.join('');
}
document.getElementById('proy-tbody').addEventListener('click', function(e){
  var btn = e.target.closest('.btn-icon, .btn-add');
  if(!btn) return;
  var nombre = btn.dataset.nombre;
  if(btn.dataset.act === 'iter'){
    abrirProyIterModal(nombre);
    return;
  }
  if(btn.dataset.act === 'edit'){
    proyEditing = nombre;
    document.getElementById('proy-nombre').value = nombre;
    document.getElementById('proy-add').textContent = 'Guardar cambios';
    document.getElementById('proy-cancel').style.display = 'inline';
  } else if(btn.dataset.act === 'del'){
    var nDis = diseñosDeProyecto(nombre).length;
    if(nDis > 0 && !confirm('Este proyecto tiene '+nDis+' diseño(s) registrados. ¿Eliminarlo igual de la lista?')) return;
    PROYECTO_CATALOGO = PROYECTO_CATALOGO.filter(function(x){ return x !== nombre; });
    saveCatalogo();
    delete PROYECTO_ITERACIONES[nombre];
    saveProyectoIteraciones();
    renderProyCrud();
    renderCompCatGrid();
    refreshAllProyectoSelects();
    rebuildHistProyectoFiltro();
    toast('Proyecto eliminado de la lista');
  }
});
document.getElementById('proy-cancel').addEventListener('click', function(e){
  e.preventDefault();
  proyEditing = null;
  document.getElementById('proy-nombre').value = '';
  document.getElementById('proy-add').textContent = '+ Agregar proyecto';
  document.getElementById('proy-cancel').style.display = 'none';
});
document.getElementById('proy-add').addEventListener('click', function(){
  var nombre = document.getElementById('proy-nombre').value.trim();
  if(!nombre){ toast('Ingresá el nombre del proyecto'); return; }
  var yaExiste = PROYECTO_CATALOGO.some(function(x){ return x.toLowerCase()===nombre.toLowerCase() && x !== proyEditing; });
  if(yaExiste){ toast('Ya existe un proyecto con ese nombre'); return; }
  if(proyEditing){
    if(proyEditing !== nombre){
      disenos.forEach(function(d){ if(d.proyectoId === proyEditing) d.proyectoId = nombre; });
      save('sid10_disenos', disenos);
      if(PROYECTO_ITERACIONES[proyEditing]){
        PROYECTO_ITERACIONES[nombre] = PROYECTO_ITERACIONES[proyEditing];
        delete PROYECTO_ITERACIONES[proyEditing];
        saveProyectoIteraciones();
      }
    }
    var idx = PROYECTO_CATALOGO.indexOf(proyEditing);
    if(idx > -1) PROYECTO_CATALOGO[idx] = nombre;
    toast('Proyecto actualizado');
  } else {
    PROYECTO_CATALOGO.push(nombre);
    toast('Proyecto agregado');
  }
  saveCatalogo();
  proyEditing = null;
  document.getElementById('proy-nombre').value = '';
  document.getElementById('proy-add').textContent = '+ Agregar proyecto';
  document.getElementById('proy-cancel').style.display = 'none';
  renderProyCrud();
  renderCompCatGrid();
  refreshAllProyectoSelects();
  rebuildHistProyectoFiltro();
  renderAllDesignViews();
});

/* ================= ITERACIONES registradas de un Proyecto (catálogo real, Registro > Proyecto) ================= */
var proyIterAbierto = null;
function abrirProyIterModal(nombre){
  proyIterAbierto = nombre;
  document.getElementById('proy-iter-modal-title').textContent = 'Iteraciones — ' + nombre;
  fillMesSelect(document.getElementById('pim-mes'), mesActual());
  fillNumeralSelect(document.getElementById('pim-numeral'), 'I');
  document.getElementById('pim-usar-numeral').checked = false;
  document.getElementById('pim-numeral').disabled = true;
  renderProyIterLista();
  document.getElementById('proy-iter-modal').classList.add('show');
}
function renderProyIterLista(){
  var wrap = document.getElementById('proy-iter-lista');
  var lista = iteracionesDeProyecto(proyIterAbierto);
  if(!lista.length){ wrap.innerHTML = '<div class="empty-note">Todavía no hay iteraciones registradas para este proyecto.</div>'; return; }
  wrap.innerHTML = lista.map(function(it){
    var nUsos = disenos.filter(function(d){ return d.proyectoId === proyIterAbierto && d.iteracionId === it; }).length;
    return '<div class="proy-iter-row"><span><b>'+esc(it)+'</b> <span class="mono" style="color:var(--text-muted);">· '+nUsos+' diseño'+(nUsos===1?'':'s')+'</span></span>' +
      '<button class="btn-icon danger" data-it="'+esc(it)+'" title="Eliminar de la lista">×</button></div>';
  }).join('');
}
document.getElementById('proy-iter-modal-close').addEventListener('click', function(){ document.getElementById('proy-iter-modal').classList.remove('show'); });
document.getElementById('proy-iter-modal').addEventListener('click', function(e){ if(e.target.id==='proy-iter-modal') document.getElementById('proy-iter-modal').classList.remove('show'); });
document.getElementById('pim-usar-numeral').addEventListener('change', function(){ document.getElementById('pim-numeral').disabled = !this.checked; });
document.getElementById('pim-agregar').addEventListener('click', function(){
  var mes = document.getElementById('pim-mes').value;
  if(!mes){ toast('Elegí el mes'); return; }
  var usar = document.getElementById('pim-usar-numeral').checked;
  var numeral = document.getElementById('pim-numeral').value;
  var iter = construirIteracion(mes, usar, numeral);
  if(iteracionesDeProyecto(proyIterAbierto).indexOf(iter) > -1){ toast('Esa iteración ya está registrada'); return; }
  registrarIteracion(proyIterAbierto, iter);
  renderProyIterLista();
  renderProyCrud();
  toast('Iteración registrada');
});
document.getElementById('proy-iter-lista').addEventListener('click', function(e){
  var btn = e.target.closest('.btn-icon.danger');
  if(!btn) return;
  var it = btn.dataset.it;
  var nUsos = disenos.filter(function(d){ return d.proyectoId === proyIterAbierto && d.iteracionId === it; }).length;
  if(nUsos > 0 && !confirm('Esta iteración tiene '+nUsos+' diseño(s) asociados. ¿Quitarla igual de la lista? (los diseños no se tocan)')) return;
  PROYECTO_ITERACIONES[proyIterAbierto] = PROYECTO_ITERACIONES[proyIterAbierto].filter(function(x){ return x!==it; });
  saveProyectoIteraciones();
  renderProyIterLista();
  renderProyCrud();
  toast('Iteración quitada de la lista');
});
