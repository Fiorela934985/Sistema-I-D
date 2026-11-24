/* Sistema I+D — Administración › Ensayos y métodos.
   · Catálogo de ensayos con norma o método, versión, unidades y campos.
   · Flujos por tipo de proyecto: qué pasos y ensayos lleva cada tipo y sus edades de rotura por defecto. Un tipo de
     proyecto nuevo se crea aquí, sin programar pantallas.
   · Tolerancias de rotura (NTP 339.034:2015) y rango de la poza de curado.
   Nada se borra: un ensayo o flujo se desactiva. Toda edición pide el motivo y queda en el Historial de cambios. */
'use strict';

var emTab = 'catalogo';
var emEnsayoEditando = null;   // copia del ensayo en el modal
var emFlujoEditando = null;    // copia del flujo en el modal

function puedeConfigurar(){ return can('config:laboratorio'); }
function etapaLabel(id){ var e = ETAPAS_ENSAYO.filter(function(x){ return x.id === id; })[0]; return e ? e.label : id; }
function estadoPill(activo){ return activo ? '<span class="tag-pill tag-verde">Activo</span>' : '<span class="tag-pill tag-gris">Inactivo</span>'; }

function renderEnsayosMetodos(){
  document.querySelectorAll('#em-tabs [data-em-tab]').forEach(function(b){ b.classList.toggle('active', b.dataset.emTab === emTab); });
  ['catalogo','flujos','tolerancias'].forEach(function(t){ document.getElementById('em-' + t).style.display = emTab === t ? '' : 'none'; });
  document.getElementById('em-nuevo-ensayo').style.display = emTab === 'catalogo' && puedeConfigurar() ? '' : 'none';
  document.getElementById('em-nuevo-flujo').style.display = emTab === 'flujos' && puedeConfigurar() ? '' : 'none';
  if(emTab === 'catalogo') renderCatalogoEnsayos();
  else if(emTab === 'flujos') renderFlujos();
  else renderTolerancias();
}

/* ================= CATÁLOGO ================= */
function renderCatalogoEnsayos(){
  var filas = '';
  ETAPAS_ENSAYO.forEach(function(et){
    var del = Lab.ensayos(false).filter(function(e){ return e.etapa === et.id; });
    if(!del.length) return;
    filas += '<tr class="rr-subsection"><td colspan="8">' + esc(et.label) + '</td></tr>' + del.map(function(e){
      return '<tr' + (e.activo ? '' : ' class="fila-inactiva"') + '><td class="mono"><b>' + esc(e.codigo) + '</b></td><td>' + esc(e.nombre) + '</td><td>' + esc(e.metodo || '—') + '</td>' +
        '<td>' + esc(e.version || '—') + '</td><td>' + esc(e.unidades || '—') + '</td>' +
        '<td>' + ((e.campos || []).length ? (e.campos || []).map(function(c){ return '<span class="chip-campo">' + esc(c.etiqueta) + (c.unidad ? ' (' + esc(c.unidad) + ')' : '') + '</span>'; }).join('') : '<span class="nota-sm">—</span>') + '</td>' +
        '<td>' + estadoPill(e.activo) + '</td>' +
        '<td class="acciones-fila"><button class="btn-icon edit" data-em-ensayo="' + esc(e.id) + '" title="' + (puedeConfigurar() ? 'Editar' : 'Ver') + '">' + (puedeConfigurar() ? EDIT_ICON : EYE_ICON) + '</button></td></tr>';
    }).join('');
  });
  document.getElementById('em-catalogo').innerHTML = '<div class="table-scroll"><table class="data-table"><thead><tr><th>Código</th><th>Ensayo</th><th>Norma / método</th><th>Versión</th><th>Unidades</th><th>Campos</th><th>Estado</th><th></th></tr></thead><tbody>' + filas + '</tbody></table></div>';
}
function asegurarModalEnsayo(){
  if(document.getElementById('ensayo-modal')) return;
  var m = document.createElement('div');
  m.id = 'ensayo-modal';
  m.className = 'sid-modal';
  m.innerHTML = '<div class="modal-card wide"><div class="modal-header"><h3 id="ens-titulo">Ensayo</h3><button class="modal-close" data-close="ensayo-modal">×</button></div>' +
    '<div class="modal-body"><div class="pred-form">' +
      '<div class="pp-field"><label for="ens-codigo">Código</label><input type="text" id="ens-codigo" maxlength="20" placeholder="Ej. SLU"></div>' +
      '<div class="pp-field"><label for="ens-nombre">Nombre</label><input type="text" id="ens-nombre" maxlength="200"></div>' +
      '<div class="pp-field"><label for="ens-etapa">Etapa</label><select id="ens-etapa">' + ETAPAS_ENSAYO.map(function(e){ return '<option value="' + e.id + '">' + esc(e.label) + '</option>'; }).join('') + '</select></div>' +
      '<div class="pp-field"><label for="ens-metodo">Norma o método</label><input type="text" id="ens-metodo" maxlength="120" placeholder="Ej. NTP 339.035"></div>' +
      '<div class="pp-field"><label for="ens-version">Versión</label><input type="text" id="ens-version" maxlength="20" placeholder="Ej. 2015"></div>' +
      '<div class="pp-field"><label for="ens-unidades">Unidades</label><input type="text" id="ens-unidades" maxlength="60"></div>' +
      '<div class="pp-field"><label for="ens-activo">Estado</label><select id="ens-activo"><option value="1">Activo</option><option value="0">Inactivo</option></select></div>' +
    '</div>' +
    '<div class="section-num" style="margin-top:14px;">Campos que se registran</div>' +
    '<div class="table-scroll"><table class="data-table campos-tabla" id="ens-campos"></table></div>' +
    '<div class="form-actions" data-perm="config:laboratorio"><button class="btn-add ghost" id="ens-campo-agregar">+ Campo</button></div></div>' +
    '<div class="modal-actions"><button class="btn-add" id="ens-guardar" data-perm="config:laboratorio">Guardar</button><button class="btn-add ghost" data-close="ensayo-modal">Cerrar</button></div></div>';
  document.body.appendChild(m);
  document.getElementById('ens-campo-agregar').addEventListener('click', function(){
    leerCamposEnsayo();
    emEnsayoEditando.campos.push({clave:'', etiqueta:'', unidad:'', tipo:'numero'});
    renderCamposEnsayo();
  });
  document.getElementById('ens-campos').addEventListener('click', function(e){
    var b = e.target.closest('[data-campo-quitar]');
    if(!b) return;
    leerCamposEnsayo();
    emEnsayoEditando.campos.splice(Number(b.dataset.campoQuitar), 1);
    renderCamposEnsayo();
  });
  document.getElementById('ens-guardar').addEventListener('click', guardarEnsayoModal);
}
function renderCamposEnsayo(){
  var ro = !puedeConfigurar();
  document.getElementById('ens-campos').innerHTML = '<thead><tr><th>Etiqueta</th><th>Clave</th><th>Unidad</th><th>Tipo</th><th></th></tr></thead><tbody>' +
    (emEnsayoEditando.campos.length ? emEnsayoEditando.campos.map(function(c, i){
      return '<tr data-campo="' + i + '"><td><input type="text" data-k="etiqueta" value="' + esc(c.etiqueta) + '"' + (ro ? ' disabled' : '') + '></td>' +
        '<td><input type="text" data-k="clave" value="' + esc(c.clave) + '"' + (ro ? ' disabled' : '') + ' placeholder="se arma sola"></td>' +
        '<td><input type="text" data-k="unidad" value="' + esc(c.unidad) + '"' + (ro ? ' disabled' : '') + '></td>' +
        '<td><select data-k="tipo"' + (ro ? ' disabled' : '') + '><option value="numero"' + (c.tipo === 'numero' ? ' selected' : '') + '>Número</option><option value="texto"' + (c.tipo === 'texto' ? ' selected' : '') + '>Texto</option></select></td>' +
        '<td>' + (ro ? '' : '<button class="btn-icon danger" data-campo-quitar="' + i + '" title="Quitar">×</button>') + '</td></tr>';
    }).join('') : '<tr><td colspan="5" class="empty-note">Sin campos.</td></tr>') + '</tbody>';
}
function claveDesde(texto){ return normalizar(texto).replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40); }
function leerCamposEnsayo(){
  emEnsayoEditando.campos = Array.prototype.map.call(document.querySelectorAll('#ens-campos tr[data-campo]'), function(tr){
    var g = function(k){ return tr.querySelector('[data-k="' + k + '"]').value.trim(); };
    return {etiqueta:g('etiqueta'), clave:g('clave') || claveDesde(g('etiqueta')), unidad:g('unidad'), tipo:g('tipo')};
  });
}
function abrirEnsayo(id){
  asegurarModalEnsayo();
  var e = id ? Lab.ensayo(id) : null;
  emEnsayoEditando = e ? JSON.parse(JSON.stringify(e)) : {id:Lab.idNuevo('ens'), codigo:'', nombre:'', etapa:'fresco', metodo:'', version:'', unidades:'', campos:[], activo:1};
  emEnsayoEditando.esNuevo = !e;
  document.getElementById('ens-titulo').textContent = e ? 'Ensayo · ' + e.codigo : 'Nuevo ensayo';
  var campos = {codigo:'codigo', nombre:'nombre', etapa:'etapa', metodo:'metodo', version:'version', unidades:'unidades'};
  Object.keys(campos).forEach(function(k){ var el = document.getElementById('ens-' + k); el.value = emEnsayoEditando[campos[k]] || ''; el.disabled = !puedeConfigurar(); });
  document.getElementById('ens-etapa').value = emEnsayoEditando.etapa;
  document.getElementById('ens-activo').value = emEnsayoEditando.activo ? '1' : '0';
  document.getElementById('ens-activo').disabled = !puedeConfigurar();
  renderCamposEnsayo();
  abrirModal('ensayo-modal');
}
function guardarEnsayoModal(){
  if(!exigir('config:laboratorio')) return;
  leerCamposEnsayo();
  var e = {id:emEnsayoEditando.id, codigo:document.getElementById('ens-codigo').value.trim().toUpperCase(), nombre:document.getElementById('ens-nombre').value.trim(),
    etapa:document.getElementById('ens-etapa').value, metodo:document.getElementById('ens-metodo').value.trim(), version:document.getElementById('ens-version').value.trim(),
    unidades:document.getElementById('ens-unidades').value.trim(), campos:emEnsayoEditando.campos.filter(function(c){ return c.etiqueta; }),
    activo:document.getElementById('ens-activo').value === '1' ? 1 : 0};
  if(!e.codigo || !e.nombre){ toast('Código y nombre son obligatorios'); return; }
  var repetido = Lab.ensayos(false).some(function(x){ return x.codigo === e.codigo && x.id !== e.id; });
  if(repetido){ toast('Ya existe un ensayo con el código ' + e.codigo); return; }
  var fin = function(motivo){
    Lab.guardarEnsayo(e, motivo).then(function(r){
      cerrarModal('ensayo-modal'); renderEnsayosMetodos();
      toast(r === false ? 'No hubo cambios' : 'Ensayo guardado');
    }).catch(function(){});
  };
  if(emEnsayoEditando.esNuevo){ fin(''); return; }
  var dif = diferencias(Lab.ensayo(e.id), e, ['codigo','nombre','etapa','metodo','version','unidades','campos','activo']);
  if(!dif){ toast('No hubo cambios'); return; }
  pedirMotivo('Editar ensayo ' + e.codigo, resumenCambioHtml(dif, {codigo:'Código', nombre:'Nombre', etapa:'Etapa', metodo:'Norma o método', version:'Versión', unidades:'Unidades', campos:'Campos', activo:'Activo'}), fin);
}

/* ================= FLUJOS POR TIPO DE PROYECTO ================= */
function renderFlujos(){
  var lista = Lab.flujos(false);
  document.getElementById('em-flujos').innerHTML = '<div class="flujos-grid">' + lista.map(function(f){
    return '<article class="card flujo-tipo' + (f.activo ? '' : ' fila-inactiva') + '"><div class="ft-head"><div><h4>' + esc(f.tipo_proyecto) + '</h4><p class="nota-sm">' + esc(f.descripcion || '') + '</p></div>' +
      estadoPill(f.activo) + '</div>' +
      '<div class="ft-edades">Edades por defecto: ' + (f.edades_defecto || []).map(function(d){ return '<span class="chip-edad">' + d + ' d</span>'; }).join('') + '</div>' +
      '<ol class="ft-pasos">' + (f.pasos || []).map(function(p){
        return '<li><b>' + esc(p.nombre) + '</b><span>' + (p.ensayos || []).map(function(id){ var e = Lab.ensayo(id); return '<span class="chip-campo" title="' + esc(e ? e.nombre : id) + '">' + esc(e ? e.codigo : id) + '</span>'; }).join('') + '</span></li>';
      }).join('') + '</ol>' +
      '<div class="form-actions"><button class="btn-add ghost" data-em-flujo="' + esc(f.id) + '">' + (puedeConfigurar() ? 'Editar flujo' : 'Ver flujo') + '</button></div></article>';
  }).join('') + '</div>';
}
function asegurarModalFlujo(){
  if(document.getElementById('flujo-modal')) return;
  var m = document.createElement('div');
  m.id = 'flujo-modal';
  m.className = 'sid-modal';
  m.innerHTML = '<div class="modal-card wide"><div class="modal-header"><h3 id="flu-titulo">Flujo</h3><button class="modal-close" data-close="flujo-modal">×</button></div>' +
    '<div class="modal-body"><div class="pred-form">' +
      '<div class="pp-field"><label for="flu-tipo">Tipo de proyecto</label><input type="text" id="flu-tipo" maxlength="80"></div>' +
      '<div class="pp-field"><label for="flu-desc">Descripción</label><input type="text" id="flu-desc" maxlength="300"></div>' +
      '<div class="pp-field"><label for="flu-edades">Edades de rotura por defecto (días)</label><input type="text" id="flu-edades" placeholder="1, 3, 7, 28"></div>' +
      '<div class="pp-field"><label for="flu-activo">Estado</label><select id="flu-activo"><option value="1">Activo</option><option value="0">Inactivo</option></select></div>' +
    '</div><div class="section-num" style="margin-top:14px;">Pasos y ensayos de cada paso</div><div id="flu-pasos"></div>' +
    '<div class="form-actions" data-perm="config:laboratorio"><button class="btn-add ghost" id="flu-paso-agregar">+ Paso</button></div></div>' +
    '<div class="modal-actions"><button class="btn-add" id="flu-guardar" data-perm="config:laboratorio">Guardar</button><button class="btn-add ghost" data-close="flujo-modal">Cerrar</button></div></div>';
  document.body.appendChild(m);
  document.getElementById('flu-paso-agregar').addEventListener('click', function(){
    leerPasosFlujo();
    emFlujoEditando.pasos.push({id:'paso' + (emFlujoEditando.pasos.length + 1), nombre:'Nuevo paso', ensayos:[]});
    renderPasosFlujo();
  });
  document.getElementById('flu-pasos').addEventListener('click', function(e){
    var b = e.target.closest('[data-paso-acc]');
    if(!b) return;
    leerPasosFlujo();
    var i = Number(b.dataset.i), p = emFlujoEditando.pasos;
    if(b.dataset.pasoAcc === 'quitar') p.splice(i, 1);
    else if(b.dataset.pasoAcc === 'subir' && i > 0) p.splice(i - 1, 0, p.splice(i, 1)[0]);
    else if(b.dataset.pasoAcc === 'bajar' && i < p.length - 1) p.splice(i + 1, 0, p.splice(i, 1)[0]);
    renderPasosFlujo();
  });
  document.getElementById('flu-guardar').addEventListener('click', guardarFlujoModal);
}
function renderPasosFlujo(){
  var ro = !puedeConfigurar();
  var ensayos = Lab.ensayos(true);
  document.getElementById('flu-pasos').innerHTML = emFlujoEditando.pasos.map(function(p, i){
    return '<div class="paso-edit" data-paso="' + i + '"><div class="paso-cab"><span class="fs-num">' + (i + 1) + '</span>' +
      '<input type="text" data-k="nombre" value="' + esc(p.nombre) + '"' + (ro ? ' disabled' : '') + '>' +
      (ro ? '' : '<button class="btn-icon" data-paso-acc="subir" data-i="' + i + '" title="Subir">↑</button><button class="btn-icon" data-paso-acc="bajar" data-i="' + i + '" title="Bajar">↓</button><button class="btn-icon danger" data-paso-acc="quitar" data-i="' + i + '" title="Quitar paso">×</button>') +
      '</div><div class="paso-ensayos">' + ETAPAS_ENSAYO.map(function(et){
        var del = ensayos.filter(function(e){ return e.etapa === et.id; });
        if(!del.length) return '';
        return '<div class="pe-grupo"><small>' + esc(et.label) + '</small>' + del.map(function(e){
          return '<label class="pe-check" title="' + esc(e.nombre + ' · ' + (e.metodo || '')) + '"><input type="checkbox" value="' + esc(e.id) + '"' + ((p.ensayos || []).indexOf(e.id) > -1 ? ' checked' : '') + (ro ? ' disabled' : '') + '> ' + esc(e.codigo) + '</label>';
        }).join('') + '</div>';
      }).join('') + '</div></div>';
  }).join('') || '<p class="empty-note">Sin pasos.</p>';
}
function leerPasosFlujo(){
  emFlujoEditando.pasos = Array.prototype.map.call(document.querySelectorAll('#flu-pasos .paso-edit'), function(div, i){
    var previo = emFlujoEditando.pasos[Number(div.dataset.paso)] || {};
    var nombre = div.querySelector('[data-k="nombre"]').value.trim() || ('Paso ' + (i + 1));
    return {id:previo.id || claveDesde(nombre), nombre:nombre,
      ensayos:Array.prototype.map.call(div.querySelectorAll('input[type="checkbox"]:checked'), function(c){ return c.value; })};
  });
}
function abrirFlujo(id){
  asegurarModalFlujo();
  var f = id ? Lab.flujo(id) : null;
  emFlujoEditando = f ? JSON.parse(JSON.stringify(f)) : {id:Lab.idNuevo('flu'), tipo_proyecto:'', descripcion:'', edades_defecto:[1,3,7,28], pasos:[], activo:1};
  emFlujoEditando.esNuevo = !f;
  document.getElementById('flu-titulo').textContent = f ? 'Flujo · ' + f.tipo_proyecto : 'Nuevo tipo de proyecto';
  document.getElementById('flu-tipo').value = emFlujoEditando.tipo_proyecto;
  document.getElementById('flu-desc').value = emFlujoEditando.descripcion || '';
  document.getElementById('flu-edades').value = (emFlujoEditando.edades_defecto || []).join(', ');
  document.getElementById('flu-activo').value = emFlujoEditando.activo ? '1' : '0';
  ['flu-tipo','flu-desc','flu-edades','flu-activo'].forEach(function(x){ document.getElementById(x).disabled = !puedeConfigurar(); });
  renderPasosFlujo();
  abrirModal('flujo-modal');
}
function guardarFlujoModal(){
  if(!exigir('config:laboratorio')) return;
  leerPasosFlujo();
  var edades = document.getElementById('flu-edades').value.split(/[,;\s]+/).map(Number).filter(function(x){ return x > 0; });
  edades = edades.filter(function(x, i){ return edades.indexOf(x) === i; }).sort(function(a,b){ return a - b; });
  var f = {id:emFlujoEditando.id, tipo_proyecto:document.getElementById('flu-tipo').value.trim(), descripcion:document.getElementById('flu-desc').value.trim(),
    edades_defecto:edades, pasos:emFlujoEditando.pasos, activo:document.getElementById('flu-activo').value === '1' ? 1 : 0};
  if(!f.tipo_proyecto){ toast('Indicá el tipo de proyecto'); return; }
  if(!edades.length){ toast('Indicá al menos una edad de rotura'); return; }
  if(Lab.flujos(false).some(function(x){ return x.tipo_proyecto.toLowerCase() === f.tipo_proyecto.toLowerCase() && x.id !== f.id; })){ toast('Ya existe ese tipo de proyecto'); return; }
  var fin = function(motivo){
    Lab.guardarFlujo(f, motivo).then(function(r){ cerrarModal('flujo-modal'); renderEnsayosMetodos(); toast(r === false ? 'No hubo cambios' : 'Flujo guardado'); }).catch(function(){});
  };
  if(emFlujoEditando.esNuevo){ fin(''); return; }
  var dif = diferencias(Lab.flujo(f.id), f, ['tipo_proyecto','descripcion','edades_defecto','pasos','activo']);
  if(!dif){ toast('No hubo cambios'); return; }
  var resumen = {antes:{}, despues:{}};
  Object.keys(dif.despues).forEach(function(k){
    resumen.antes[k] = k === 'pasos' ? (dif.antes[k] || []).map(function(p){ return p.nombre + ' (' + p.ensayos.length + ')'; }).join(' → ') : dif.antes[k];
    resumen.despues[k] = k === 'pasos' ? (dif.despues[k] || []).map(function(p){ return p.nombre + ' (' + p.ensayos.length + ')'; }).join(' → ') : dif.despues[k];
  });
  pedirMotivo('Editar flujo ' + f.tipo_proyecto, resumenCambioHtml(resumen, {tipo_proyecto:'Tipo', descripcion:'Descripción', edades_defecto:'Edades', pasos:'Pasos (ensayos)', activo:'Activo'}), fin);
}

/* ================= TOLERANCIAS Y POZA ================= */
var CONFIG_EDITABLE = ['poza_min','poza_max','poza_objetivo','tolerancia_otras_pct','area_defecto_cm2','cv_alerta_pct'];
function renderTolerancias(){
  var ro = !puedeConfigurar() ? ' disabled' : '';
  var tol = Lab.tolerancias();
  document.getElementById('em-tolerancias').innerHTML =
    '<div class="em-2col"><div class="card"><div class="section-num">Tolerancias de rotura · NTP 339.034:2015</div>' +
      '<div class="table-scroll"><table class="data-table" id="tol-tabla"><thead><tr><th>Edad</th><th>Edad en horas</th><th>Tolerancia (± h)</th></tr></thead><tbody>' +
      tol.map(function(t){
        return '<tr data-tol="' + esc(t.id) + '"><td><input type="text" data-k="etiqueta" value="' + esc(t.etiqueta) + '"' + ro + '></td>' +
          '<td><input type="number" step="any" min="0" data-k="edad_horas" value="' + t.edad_horas + '"' + ro + '></td>' +
          '<td><input type="number" step="any" min="0" data-k="tolerancia_horas" value="' + t.tolerancia_horas + '"' + ro + '></td></tr>';
      }).join('') +
      '<tr><td colspan="2">Otras edades (180 d, 360 d…)</td><td><input type="number" step="any" min="0" id="cfg-tolerancia_otras_pct" value="' + esc(Lab.config('tolerancia_otras_pct')) + '"' + ro + '> % de la edad</td></tr>' +
      '</tbody></table></div></div>' +
    '<div class="card"><div class="section-num">Poza de curado y registro de roturas</div><div class="pred-form">' +
      ['poza_min','poza_max','poza_objetivo','area_defecto_cm2','cv_alerta_pct'].map(function(k){
        return '<div class="pp-field"><label for="cfg-' + k + '">' + esc(CONFIG_ETIQUETAS[k]) + '</label><input type="number" step="any" id="cfg-' + k + '" value="' + esc(Lab.config(k)) + '"' + ro + '></div>';
      }).join('') +
      '</div><p class="nota-sm">Rango vigente de la poza: <b>' + esc(Lab.config('poza_min')) + ' a ' + esc(Lab.config('poza_max')) + ' °C</b>. Una lectura fuera de rango abrirá un trabajo no conforme automático (Fase 7).</p></div></div>' +
    '<div class="form-actions" data-perm="config:laboratorio"><button class="btn-add" id="tol-guardar">Guardar cambios</button></div>' +
    '<div class="card"><div class="section-num">Calcular la ventana de rotura</div><div class="pred-form">' +
      '<div class="pp-field"><label for="ven-elab">Fecha y hora de elaboración</label><input type="datetime-local" id="ven-elab" value="2026-05-10T10:00"></div>' +
      '<div class="pp-field"><label for="ven-edad">Edad</label><select id="ven-edad">' + [['24','24 h'],['72','3 d'],['96','4 d'],['168','7 d'],['672','28 d'],['2160','90 d'],['4320','180 d'],['8640','360 d']].map(function(o){ return '<option value="' + o[0] + '">' + o[1] + '</option>'; }).join('') + '</select></div>' +
      '</div><div id="ven-resultado" class="ven-resultado"></div></div>';
  calcularVentanaDemo();
}
function fmtFechaHora(d){ return isoToDMY(isoDe(d)).replace(/\/(\d{2})(\d{2})$/, '/$2') + ' ' + String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0'); }
function calcularVentanaDemo(){
  var el = document.getElementById('ven-elab'), out = document.getElementById('ven-resultado');
  if(!el || !out) return;
  var v = Lab.ventanaRotura(new Date(el.value), Number(document.getElementById('ven-edad').value));
  if(!v){ out.textContent = 'Indicá la fecha y hora de elaboración.'; return; }
  var mismoDia = isoDe(v.desde) === isoDe(v.hasta);
  out.innerHTML = 'Rotura programada <b>' + fmtFechaHora(v.programada) + '</b> · tolerancia ± ' + fmt(v.toleranciaHoras, v.toleranciaHoras % 1 ? 1 : 0) + ' h → ventana ' +
    '<b>' + (mismoDia ? isoToDMY(isoDe(v.desde)).replace(/\/(\d{2})(\d{2})$/, '/$2') + ' de ' + fmtFechaHora(v.desde).slice(-5) + ' a ' + fmtFechaHora(v.hasta).slice(-5) : fmtFechaHora(v.desde) + ' a ' + fmtFechaHora(v.hasta)) + '</b>';
}
function guardarTolerancias(){
  if(!exigir('config:laboratorio')) return;
  var cambiosTol = [], filasResumen = {antes:{}, despues:{}};
  var error = '';
  document.querySelectorAll('#tol-tabla tr[data-tol]').forEach(function(tr){
    var previo = Lab.tolerancias().filter(function(t){ return t.id === tr.dataset.tol; })[0];
    var t = {id:previo.id, etiqueta:tr.querySelector('[data-k="etiqueta"]').value.trim(), edad_horas:Number(tr.querySelector('[data-k="edad_horas"]').value), tolerancia_horas:Number(tr.querySelector('[data-k="tolerancia_horas"]').value)};
    if(!(t.edad_horas > 0) || !(t.tolerancia_horas > 0) || !t.etiqueta) error = 'Revisá la tolerancia de ' + (t.etiqueta || 'una edad');
    var dif = diferencias(previo, t, ['etiqueta','edad_horas','tolerancia_horas']);
    if(dif){ cambiosTol.push(t); filasResumen.antes['Tolerancia ' + previo.etiqueta] = previo.tolerancia_horas + ' h (' + previo.edad_horas + ' h)'; filasResumen.despues['Tolerancia ' + previo.etiqueta] = t.tolerancia_horas + ' h (' + t.edad_horas + ' h)'; }
  });
  var cambiosCfg = [];
  CONFIG_EDITABLE.forEach(function(k){
    var el = document.getElementById('cfg-' + k);
    if(!el) return;
    var v = el.value.trim();
    if(v === '' || !isFinite(Number(v))){ error = 'Revisá: ' + CONFIG_ETIQUETAS[k]; return; }
    if(String(Number(v)) !== String(Number(Lab.config(k)))){ cambiosCfg.push([k, String(Number(v))]); filasResumen.antes[CONFIG_ETIQUETAS[k]] = Lab.config(k); filasResumen.despues[CONFIG_ETIQUETAS[k]] = String(Number(v)); }
  });
  if(error){ toast(error); return; }
  var pmin = Number(document.getElementById('cfg-poza_min').value), pmax = Number(document.getElementById('cfg-poza_max').value), pobj = Number(document.getElementById('cfg-poza_objetivo').value);
  if(!(pmin < pmax) || pobj < pmin || pobj > pmax){ toast('El rango de la poza no es válido (mínima < objetivo < máxima)'); return; }
  if(!cambiosTol.length && !cambiosCfg.length){ toast('No hubo cambios'); return; }
  pedirMotivo('Guardar tolerancias y poza', resumenCambioHtml(filasResumen), function(motivo){
    var cadena = Promise.resolve();
    cambiosTol.forEach(function(t){ cadena = cadena.then(function(){ return Lab.guardarTolerancia(t, motivo); }); });
    cambiosCfg.forEach(function(c){ cadena = cadena.then(function(){ return Lab.guardarConfig(c[0], c[1], motivo); }); });
    cadena.then(function(){ renderEnsayosMetodos(); toast('Cambios guardados'); }).catch(function(){ renderEnsayosMetodos(); });
  });
}

/* ================= EVENTOS ================= */
document.getElementById('em-tabs').addEventListener('click', function(e){
  var b = e.target.closest('[data-em-tab]');
  if(b){ emTab = b.dataset.emTab; renderEnsayosMetodos(); }
});
document.getElementById('panel-ensayos-metodos').addEventListener('click', function(e){
  var a = e.target.closest('[data-em-ensayo]');
  if(a){ abrirEnsayo(a.dataset.emEnsayo); return; }
  var f = e.target.closest('[data-em-flujo]');
  if(f){ abrirFlujo(f.dataset.emFlujo); return; }
  if(e.target.closest('#em-nuevo-ensayo')){ if(exigir('config:laboratorio')) abrirEnsayo(null); return; }
  if(e.target.closest('#em-nuevo-flujo')){ if(exigir('config:laboratorio')) abrirFlujo(null); return; }
  if(e.target.closest('#tol-guardar')) guardarTolerancias();
});
document.getElementById('panel-ensayos-metodos').addEventListener('input', function(e){
  if(e.target.id === 'ven-elab' || e.target.id === 'ven-edad') calcularVentanaDemo();
});
document.getElementById('panel-ensayos-metodos').addEventListener('change', function(e){
  if(e.target.id === 'ven-edad') calcularVentanaDemo();
});
PANEL_HOOKS['ensayos-metodos'] = renderEnsayosMetodos;
