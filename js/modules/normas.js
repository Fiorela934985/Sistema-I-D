/* Sistema I+D — Normas y tipos de ensayo (sección 6). Cada tipo de ensayo se define una sola vez
   (norma, parámetros, edades, tolerancias) y diseños y roturas lo heredan sin buscar la norma cada vez. */
'use strict';

var normas = load('sid_normas', null);
if(!normas){
  normas = [
    {id:'n1', codigo:'NTP 339.034', titulo:'Método de ensayo normalizado para la determinación de la resistencia a la compresión del concreto en muestras cilíndricas', edicion:'2015', organismo:'INACAL', url:'', activa:true},
    {id:'n2', codigo:'NTP 339.183', titulo:'Práctica normalizada para la elaboración y curado de especímenes de concreto en el laboratorio', edicion:'2013', organismo:'INACAL', url:'', activa:true},
    {id:'n3', codigo:'NTP 339.035', titulo:'Método de ensayo para la medición del asentamiento del concreto con el cono de Abrams', edicion:'2015', organismo:'INACAL', url:'', activa:true},
    {id:'n4', codigo:'ASTM C192', titulo:'Making and Curing Concrete Test Specimens in the Laboratory', edicion:'2019', organismo:'ASTM', url:'', activa:true},
    {id:'n5', codigo:'ISO 13007-2', titulo:'Adhesivos para baldosas cerámicas — Métodos de ensayo (adherencia)', edicion:'2013', organismo:'ISO', url:'', activa:true},
    {id:'n6', codigo:'UNE-EN 1347', titulo:'Adhesivos para baldosas cerámicas — Determinación de la capacidad humectante', edicion:'2008', organismo:'AENOR', url:'', activa:true}
  ];
  save('sid_normas', normas);
}
var TOLERANCIAS_NTP = [{edad:1, horas:0.5}, {edad:3, horas:2}, {edad:4, horas:3}, {edad:7, horas:6}, {edad:28, horas:20}, {edad:90, horas:48}];
var tiposEnsayo = load('sid_tipos_ensayo', null);
if(!tiposEnsayo){
  tiposEnsayo = [
    {id:'te1', nombre:'Concreto en estado fresco', linea:'Concreto', normas:['NTP 339.035', 'NTP 339.183'], edades:[], especimenes:0, activo:true, tolerancias:[],
      parametros:[
        {nombre:'Slump o flow', unidad:'in / mm', tipo:'número', min:0, max:900, obligatorio:true},
        {nombre:'Temperatura del concreto', unidad:'°C', tipo:'número', min:5, max:45, obligatorio:true},
        {nombre:'Temperatura ambiente', unidad:'°C', tipo:'número', min:0, max:45, obligatorio:false},
        {nombre:'Peso unitario', unidad:'kg/m³', tipo:'número', min:1500, max:2700, obligatorio:false},
        {nombre:'Contenido de aire', unidad:'%', tipo:'número', min:0, max:15, obligatorio:false},
        {nombre:'Fragua inicial / final', unidad:'hh:mm', tipo:'hora', min:'', max:'', obligatorio:false},
        {nombre:'Cohesividad', unidad:'', tipo:'lista', min:'', max:'', obligatorio:false},
        {nombre:'Apariencia', unidad:'', tipo:'lista', min:'', max:'', obligatorio:false}
      ]},
    {id:'te2', nombre:'Compresión en probetas', linea:'Concreto', normas:['NTP 339.034'], edades:[1, 3, 7, 28], especimenes:3, activo:true, tolerancias:TOLERANCIAS_NTP.slice(),
      parametros:[{nombre:'Carga', unidad:'kN / kg', tipo:'número', min:0.01, max:5000, obligatorio:true}, {nombre:'Área', unidad:'cm²', tipo:'número', min:50, max:250, obligatorio:true}, {nombre:'Tipo de falla', unidad:'1–6', tipo:'lista', min:'', max:'', obligatorio:true}]},
    {id:'te3', nombre:'Compresión en cubos', linea:'Mortero', normas:['NTP 339.034'], edades:[1, 3, 7, 28], especimenes:3, activo:true, tolerancias:TOLERANCIAS_NTP.slice(),
      parametros:[{nombre:'Carga', unidad:'kN / kg', tipo:'número', min:0.01, max:5000, obligatorio:true}, {nombre:'Área', unidad:'cm²', tipo:'número', min:20, max:250, obligatorio:true}, {nombre:'Tipo de falla', unidad:'1–6', tipo:'lista', min:'', max:'', obligatorio:true}]}
  ];
  save('sid_tipos_ensayo', tiposEnsayo);
}
function saveNormas(){ save('sid_normas', normas); }
function saveTiposEnsayo(){ save('sid_tipos_ensayo', tiposEnsayo); }
function tipoEnsayoPorNombre(nombre){ return tiposEnsayo.filter(function(t){ return t.nombre === nombre; })[0] || tiposEnsayo.filter(function(t){ return t.nombre === 'Compresión en probetas'; })[0]; }

/* RF-NOR-05: la tolerancia sale de la tabla del tipo de ensayo; fuera de tabla, ±2.0 % de la edad (NTP 339.034). */
function toleranciaHoras(diaEdad, tipoNombre){
  var t = tipoEnsayoPorNombre(tipoNombre || 'Compresión en probetas');
  var fila = t && (t.tolerancias || []).filter(function(x){ return Number(x.edad) === Number(diaEdad); })[0];
  if(fila) return Number(fila.horas);
  return +(diaEdad * 24 * 0.02).toFixed(2);
}

/* ================= Panel ================= */
var normasSub = 'tipos';
function showNormasSub(name){
  normasSub = name;
  document.querySelectorAll('#nor-subtabs .subtab').forEach(function(b){ b.classList.toggle('active', b.dataset.nsub === name); });
  renderNormas();
}
document.getElementById('nor-subtabs').addEventListener('click', function(e){ var b = e.target.closest('[data-nsub]'); if(b) showNormasSub(b.dataset.nsub); });
function renderNormas(){
  var c = document.getElementById('nor-contenido');
  var editar = can('normas:editar');
  if(normasSub === 'normas'){
    var porCodigo = {};
    normas.forEach(function(x){ (porCodigo[x.codigo] = porCodigo[x.codigo] || []).push(x); });
    c.innerHTML = '<div class="card"><div class="ev-toolbar"><span class="nota-sm">Una edición nueva no borra la anterior: los ensayos ya hechos guardan la edición usada.</span>' + (editar ? '<button class="btn-add" data-nor-nueva="1">+ Norma o edición</button>' : '') + '</div>' +
      '<div class="table-scroll"><table class="data-table"><thead><tr><th>Código</th><th>Título</th><th>Edición</th><th>Organismo</th><th>Archivo</th><th>Estado</th></tr></thead><tbody>' +
      Object.keys(porCodigo).sort().map(function(cod){
        var eds = porCodigo[cod].sort(function(a, b){ return String(b.edicion).localeCompare(String(a.edicion)); });
        return eds.map(function(x, i){ return '<tr' + (i ? ' class="fila-secundaria"' : '') + '><td class="mono"><b>' + esc(x.codigo) + '</b></td><td>' + esc(x.titulo) + '</td><td>' + esc(x.edicion) + (i === 0 ? ' <span class="tag-pill tag-verde">vigente</span>' : '') + '</td><td>' + esc(x.organismo) + '</td><td>' + (x.url ? '<a href="' + esc(x.url) + '" target="_blank" rel="noopener">PDF</a>' : '—') + '</td><td>' + (i === 0 ? 'Vigente' : 'Anterior') + '</td></tr>'; }).join('');
      }).join('') + '</tbody></table></div></div>';
  } else if(normasSub === 'fallas'){
    c.innerHTML = '<div class="card"><p class="nota-sm">Tipos de fractura 1–6 según NTP 339.034. El catálogo se edita en Ajustes › Catálogos.</p><img src="' + TIPO_ROTURA_IMG_URL + '" alt="Tipos de falla" style="max-width:520px;width:100%;border:1px solid var(--line);border-radius:8px;"><p>' + catalogo('tiposFalla').map(esc).join(' · ') + '</p></div>';
  } else {
    c.innerHTML = (editar ? '<div class="form-actions"><button class="btn-add" data-te-nuevo="1">+ Tipo de ensayo</button></div>' : '') + tiposEnsayo.map(function(t){
      return '<div class="card' + (t.activo ? '' : ' inactivo') + '"><div class="ev-toolbar"><div><div class="section-num">' + esc(t.nombre) + (t.activo ? '' : ' (desactivado)') + '</div>' +
        '<span class="nota-sm">Línea ' + esc(t.linea) + ' · normas ' + esc((t.normas || []).join(', ') || '—') + ' · edades ' + esc((t.edades || []).join(', ') || '—') + ' d · ' + (t.especimenes || 0) + ' especímenes por edad</span></div>' +
        (editar ? '<span><button class="btn-add ghost" data-te-editar="' + t.id + '">Editar</button>' + (rolDe(usuarioActual) === 'ADM' ? ' <button class="btn-add ghost" data-te-toggle="' + t.id + '">' + (t.activo ? 'Desactivar' : 'Activar') + '</button>' : '') + '</span>' : '') + '</div>' +
        '<div class="table-scroll"><table class="data-table"><thead><tr><th>Parámetro</th><th>Unidad</th><th>Tipo</th><th>Rango</th><th>Obligatorio</th></tr></thead><tbody>' +
        (t.parametros || []).map(function(p){ return '<tr><td>' + esc(p.nombre) + '</td><td>' + esc(p.unidad) + '</td><td>' + esc(p.tipo) + '</td><td>' + (p.min !== '' && p.min !== undefined ? esc(p.min + ' – ' + p.max) : '—') + '</td><td>' + (p.obligatorio ? 'Sí' : 'No') + '</td></tr>'; }).join('') + '</tbody></table></div>' +
        ((t.tolerancias || []).length ? '<p class="nota-sm"><b>Tolerancias:</b> ' + t.tolerancias.map(function(x){ return x.edad + ' d ±' + x.horas + ' h (' + fmt(x.horas / (x.edad * 24) * 100, 1) + ' %)'; }).join(' · ') + ' · fuera de tabla ±2.0 % de la edad</p>' : '') + '</div>';
    }).join('');
  }
}
document.getElementById('nor-contenido').addEventListener('click', function(e){
  var t = function(s){ return e.target.closest(s); };
  var el;
  if(t('[data-nor-nueva]')) abrirNorma();
  else if(t('[data-te-nuevo]')) abrirTipoEnsayo(null);
  else if((el = t('[data-te-editar]'))) abrirTipoEnsayo(tiposEnsayo.filter(function(x){ return x.id === el.dataset.teEditar; })[0]);
  else if((el = t('[data-te-toggle]'))){
    var te = tiposEnsayo.filter(function(x){ return x.id === el.dataset.teToggle; })[0];
    te.activo = !te.activo;   // RF-NOR-08: no se elimina; queda oculto para nuevos
    saveTiposEnsayo();
    registrarHistorial('Editó', 'Tipo de ensayo', te.nombre + (te.activo ? ' activado' : ' desactivado'));
    renderNormas();
  }
});
/* RF-NOR-01/02 */
function abrirNorma(){
  if(!exigir('normas:editar')) return;
  abrirDialogo({titulo:'Registrar norma o edición nueva', html:'<div class="pred-form">' +
    campo('Código', '<input type="text" id="no-cod" placeholder="NTP 339.034" list="no-codigos"><datalist id="no-codigos">' + normas.map(function(x){ return '<option value="' + esc(x.codigo) + '">'; }).join('') + '</datalist>') +
    campo('Edición / año', '<input type="text" id="no-ed" placeholder="2015">') + campo('Organismo', '<input type="text" id="no-org" placeholder="INACAL">') +
    campo('Archivo PDF (enlace de Drive, opcional)', '<input type="url" id="no-url">') + '</div>' + campo('Título', '<input type="text" id="no-tit">') + '<p class="campo-error" id="no-err"></p>',
    botones:[{label:'Guardar', accion:function(c){
      var x = {id:nuevoId('n'), codigo:c.querySelector('#no-cod').value.trim().toUpperCase(), edicion:c.querySelector('#no-ed').value.trim(), organismo:c.querySelector('#no-org').value.trim(), url:c.querySelector('#no-url').value.trim(), titulo:c.querySelector('#no-tit').value.trim(), activa:true};
      if(!x.codigo || !x.titulo || !x.edicion || !x.organismo){ c.querySelector('#no-err').textContent = 'Código, título, edición y organismo son obligatorios.'; return false; }
      if(normas.some(function(y){ return y.codigo === x.codigo && y.edicion === x.edicion; })){ c.querySelector('#no-err').textContent = 'Ya existe esa norma con esa edición.'; return false; }
      if(x.url && !/^https?:\/\//.test(x.url)){ c.querySelector('#no-err').textContent = 'El enlace debe empezar con https://'; return false; }
      normas.push(x); saveNormas();
      registrarHistorial('Creó', 'Norma', x.codigo + ' ed. ' + x.edicion);
      renderNormas();
    }}]});
}
/* RF-NOR-03/04/05 */
function abrirTipoEnsayo(te){
  if(!exigir('normas:editar')) return;
  var nuevo = !te;
  te = te || {nombre:'', linea:'Concreto', normas:[], edades:[1, 3, 7, 28], especimenes:3, parametros:[], tolerancias:TOLERANCIAS_NTP.slice(), activo:true};
  var codigos = normas.map(function(x){ return x.codigo; }).filter(function(v, i, a){ return a.indexOf(v) === i; });
  abrirDialogo({titulo: nuevo ? 'Nuevo tipo de ensayo' : 'Editar ' + te.nombre, ancho:'grande', html:'<div class="pred-form">' +
    campo('Nombre', '<input type="text" id="te-nom" value="' + esc(te.nombre) + '">') + campo('Línea', '<select id="te-lin">' + opcionesHtml(LINEAS_PROYECTO, te.linea) + '</select>') +
    campo('Edades predeterminadas (días, separadas por coma)', '<input type="text" id="te-ed" value="' + esc((te.edades || []).join(', ')) + '">') +
    campo('Especímenes por edad', '<input type="number" min="0" max="10" id="te-esp" value="' + esc(te.especimenes) + '">') + '</div>' +
    '<div class="pp-field"><label>Normas asociadas</label><div class="chips-check">' + codigos.map(function(cod){ return '<label class="chip-check"><input type="checkbox" name="te-norma" value="' + esc(cod) + '"' + ((te.normas || []).indexOf(cod) > -1 ? ' checked' : '') + '> ' + esc(cod) + '</label>'; }).join('') + '</div></div>' +
    campo('Parámetros (uno por línea: nombre; unidad; tipo número|texto|hora|lista; mín; máx; obligatorio sí|no)', '<textarea id="te-par" rows="6">' + esc((te.parametros || []).map(function(p){ return [p.nombre, p.unidad, p.tipo, p.min, p.max, p.obligatorio ? 'sí' : 'no'].join('; '); }).join('\n')) + '</textarea>') +
    campo('Tolerancias (una por línea: edad en días; horas)', '<textarea id="te-tol" rows="5">' + esc((te.tolerancias || []).map(function(x){ return x.edad + '; ' + x.horas; }).join('\n')) + '</textarea>') + '<p class="campo-error" id="te-err"></p>',
    botones:[{label:'Guardar', accion:function(c){
      var err = '';
      var edades = c.querySelector('#te-ed').value.split(',').map(function(s){ return s.trim(); }).filter(Boolean).map(Number);
      if(edades.some(function(e){ return !(e >= 1 && e <= 365) || e !== Math.floor(e); })) err = 'Edades: enteros de 1 a 365.';
      var params = c.querySelector('#te-par').value.split('\n').map(function(l){ return l.trim(); }).filter(Boolean).map(function(l){
        var p = l.split(';').map(function(s){ return s.trim(); });
        var prm = {nombre:p[0], unidad:p[1] || '', tipo:(p[2] || 'número').toLowerCase(), min:p[3] === undefined ? '' : p[3], max:p[4] === undefined ? '' : p[4], obligatorio:/^s/i.test(p[5] || '')};
        if(['número','numero','texto','hora','lista'].indexOf(prm.tipo) === -1) err = 'Tipo de parámetro inválido en "' + prm.nombre + '".';
        if(prm.min !== '' && prm.max !== '' && Number(prm.min) >= Number(prm.max)) err = 'Rango mín–máx inválido en "' + prm.nombre + '".';
        return prm;
      });
      var tols = c.querySelector('#te-tol').value.split('\n').map(function(l){ return l.trim(); }).filter(Boolean).map(function(l){ var p = l.split(';'); return {edad:Number(p[0]), horas:parseNumero(p[1])}; });
      if(tols.some(function(x){ return !(x.edad >= 1) || !(x.horas >= 0); })) err = 'Tolerancias: edad y horas numéricas.';
      var nombre = c.querySelector('#te-nom').value.trim();
      if(nombre.length < 3) err = 'Nombre obligatorio.';
      if(err){ c.querySelector('#te-err').textContent = err; return false; }
      Object.assign(te, {nombre:nombre, linea:c.querySelector('#te-lin').value, edades:edades.sort(function(a, b){ return a - b; }), especimenes:Number(c.querySelector('#te-esp').value) || 0,
        normas:Array.prototype.map.call(c.querySelectorAll('input[name="te-norma"]:checked'), function(i){ return i.value; }), parametros:params, tolerancias:tols});
      if(nuevo){ te.id = nuevoId('te'); tiposEnsayo.push(te); }
      saveTiposEnsayo();
      registrarHistorial(nuevo ? 'Creó' : 'Editó', 'Tipo de ensayo', te.nombre);
      renderNormas();
    }}]});
}
/* RF-NOR-07: desde diseño, elaboración y rotura, un enlace abre la norma y sus parámetros. */
function verNormaDeEnsayo(nombre){
  var t = tipoEnsayoPorNombre(nombre);
  var ns = normas.filter(function(x){ return (t.normas || []).indexOf(x.codigo) > -1; });
  abrirDialogo({titulo: t.nombre, cancelar:'Cerrar', botones:[], html:
    ns.map(function(x){ return '<p><b>' + esc(x.codigo) + '</b> (' + esc(x.edicion) + ') — ' + esc(x.titulo) + (x.url ? ' · <a href="' + esc(x.url) + '" target="_blank" rel="noopener">Abrir PDF</a>' : '') + '</p>'; }).join('') +
    '<ul>' + (t.parametros || []).map(function(p){ return '<li>' + esc(p.nombre) + (p.unidad ? ' (' + esc(p.unidad) + ')' : '') + (p.min !== '' ? ': ' + esc(p.min + ' – ' + p.max) : '') + (p.obligatorio ? ' · obligatorio' : '') + '</li>'; }).join('') + '</ul>' +
    ((t.tolerancias || []).length ? '<p class="nota-sm">Tolerancias: ' + t.tolerancias.map(function(x){ return x.edad + ' d ±' + x.horas + ' h'; }).join(' · ') + '</p>' : '')});
}
PANEL_HOOKS.normas = function(){ renderNormas(); };
