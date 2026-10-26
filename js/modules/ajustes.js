/* Sistema I+D — Ajustes del usuario: apariencia, notificaciones, cuenta y datos del sistema */
'use strict';

/* ================= AJUSTES ================= */
var elDarkMode = document.getElementById('set-darkmode');
var elNotif = document.getElementById('set-notif');
var settings = load('sid10_settings', {notif:true});
var APP_VERSION = '2.0.0';
function applySettingsToUI(){
  elDarkMode.checked = currentTheme === 'dark';
  elNotif.checked = settings.notif !== false;
}
elDarkMode.addEventListener('change', function(){
  currentTheme = elDarkMode.checked ? 'dark' : 'light';
  applyTheme(currentTheme);
  save('sid10_theme', currentTheme);
  toast(currentTheme === 'dark' ? 'Modo oscuro activado' : 'Modo claro activado');
});
elNotif.addEventListener('change', function(){
  settings.notif = elNotif.checked;
  save('sid10_settings', settings);
  updateNavBadges();
  toast(settings.notif ? 'Notificaciones activadas' : 'Notificaciones desactivadas');
});

function renderAjustes(){
  applySettingsToUI();
  var u = usuarioActual;
  document.getElementById('cuenta-resumen').innerHTML = u ?
    '<div class="cuenta-fila"><span class="sb-avatar rol-'+rolDe(u)+'">'+esc(inicialesUsuario(u))+'</span><div><b>'+esc(u.nombre||u.usuario)+'</b><span>'+esc(u.usuario)+' · '+esc(rolLabel(u.rol))+'</span></div></div>' +
    '<p class="nota-sm">'+esc((ROLES_DEF[rolDe(u)]||{}).desc||'')+'</p>' : '';
  renderPerfil();
  if(can('ajustes:editar')){ renderAjustesSistema(); renderCatalogoEditor(); }
  var usado = 0;
  for(var i=0;i<localStorage.length;i++){ var k = localStorage.key(i); if(/^sid/.test(k)) usado += (localStorage.getItem(k)||'').length; }
  document.getElementById('acerca-lista').innerHTML =
    '<div class="acerca-fila"><span>Versión</span><b>'+APP_VERSION+'</b></div>' +
    '<div class="acerca-fila"><span>Modo de datos</span><b>'+(modoServidor() ? 'Servidor (base compartida)' : 'Local (este navegador)')+'</b></div>' +
    '<div class="acerca-fila"><span>Datos en este navegador</span><b>'+(usado/1024).toFixed(0)+' KB</b></div>' +
    '<div class="acerca-fila"><span>Diseños / roturas</span><b>'+disenos.length+' / '+roturaCargas.length+'</b></div>' +
    '<div class="acerca-fila"><span>Usuarios</span><b>'+usuarios.length+'</b></div>' +
    (modoServidor() ? '' : '<p class="nota-sm">Sin servidor configurado, los datos viven en este navegador. Descargá un respaldo desde <a href="#" data-goto="base-historica">Base histórica</a>.</p>');
}
/* RF-USR-10: ver sus datos, equipo, proyectos y actividad; editar solo teléfono y preferencias. */
function renderPerfil(){
  var u = usuarioActual;
  if(!u) return;
  var misProyectos = proyectos.filter(function(p){ return esDeMiEquipo(p); });
  var actividad = historial.filter(function(h){ return h.usuarioId === u.id; }).slice(0, 5);
  document.getElementById('perfil-resumen').innerHTML =
    '<div class="acerca-fila"><span>Correo</span><b>'+esc(u.correo||'-')+'</b></div>' +
    '<div class="acerca-fila"><span>Empresa · puesto</span><b>'+esc((u.empresa||'-')+' · '+(u.puesto||'-'))+'</b></div>' +
    '<div class="acerca-fila"><span>Laboratorios</span><b>'+esc((u.laboratorios||[]).map(labLabel).join(', ')||'-')+'</b></div>' +
    '<div class="acerca-fila"><span>Equipos</span><b>'+esc((u.equipos||[]).join(', ')||'-')+'</b></div>' +
    '<div class="acerca-fila"><span>Mis proyectos</span><b>'+(misProyectos.length ? misProyectos.map(function(p){ return esc(p.nombre); }).join(', ') : '—')+'</b></div>' +
    '<p class="nota-sm" style="margin-top:8px;"><b>Mi actividad reciente</b></p>' +
    (actividad.length ? actividad.map(function(h){ return '<div class="nota-sm">'+fechaHora(h.ts)+' · '+esc(h.accion+' '+h.entidad+' — '+h.detalle)+'</div>'; }).join('') : '<p class="nota-sm">Sin movimientos todavía.</p>');
  document.getElementById('perfil-telefono').value = u.telefono || '';
}
document.getElementById('perfil-guardar').addEventListener('click', function(){
  var u = usuarioActual;
  if(!u) return;
  u.telefono = document.getElementById('perfil-telefono').value.trim();
  saveUsuarios();
  toast('Teléfono guardado');
});

/* RF-AJU-01: umbrales del sistema */
var AJUSTES_LABELS = {
  dispersionEspecimenPct:['Dispersión por espécimen (%)', 'Un espécimen que se aleja más que esto del promedio se resalta.'],
  dispersionCVPct:['Coeficiente de variación máximo (%)', 'Si el CV de la edad supera esto, se resalta.'],
  stockBajoPct:['Stock bajo (%)', 'Alerta cuando el stock queda por debajo de este % de la presentación.'],
  diasAvisoVencimiento:['Aviso de vencimiento de lotes (días)', ''],
  diasAvisoDescarte:['Aviso de descarte de muestras (días)', ''],
  diasAvisoPlan:['Aviso de actividades o roturas por vencer (días)', 'Pone el proyecto en naranja.'],
  areaProbeta:['Área predeterminada de probeta (cm²)', ''],
  difDosisPct:['Diferencia dosis real vs teórica (%)', 'Por encima pide confirmación.'],
  tamanoEtiqueta:['Tamaño de etiqueta', 'pequeño, mediano o grande']
};
function renderAjustesSistema(){
  document.getElementById('ajustes-sistema-form').innerHTML = Object.keys(AJUSTES_LABELS).map(function(k){
    var l = AJUSTES_LABELS[k];
    var input = k === 'tamanoEtiqueta'
      ? '<select data-ajuste="'+k+'">'+['pequeño','mediano','grande'].map(function(t){ return '<option'+(ajuste(k)===t?' selected':'')+'>'+t+'</option>'; }).join('')+'</select>'
      : '<input type="number" min="0" step="any" data-ajuste="'+k+'" value="'+esc(ajuste(k))+'">';
    return '<div class="pp-field"><label title="'+esc(l[1])+'">'+esc(l[0])+'</label>'+input+'</div>';
  }).join('');
}
document.getElementById('ajustes-sistema-guardar').addEventListener('click', function(){
  if(!exigir('ajustes:editar')) return;
  var cambios = [];
  document.querySelectorAll('[data-ajuste]').forEach(function(el){
    var k = el.dataset.ajuste;
    var v = el.tagName === 'SELECT' ? el.value : Number(String(el.value).replace(',', '.'));
    if(el.tagName !== 'SELECT' && (!isFinite(v) || v < 0)) return;
    if(v !== ajuste(k)){ cambios.push(AJUSTES_LABELS[k][0] + ': ' + ajuste(k) + ' → ' + v); ajustesSistema[k] = v; }
  });
  if(!cambios.length){ toast('Sin cambios'); return; }
  saveAjustesSistema();
  registrarHistorial('Editó', 'Ajustes', cambios.join(' · '));
  toast('Ajustes guardados');
});

/* RF-CAT-01/02: catálogos; un valor en uso no se borra, solo se desactiva */
var catActivo = 'equipos';
function valorEnUso(cat, valor){
  var en = function(arr, campo){ return arr.some(function(x){ return x[campo] === valor; }); };
  if(cat === 'equipos') return usuarios.some(function(u){ return (u.equipos||[]).indexOf(valor) > -1; }) || proyectos.some(function(p){ return p.equipoLider === valor || (p.equiposApoyo||[]).indexOf(valor) > -1; });
  if(cat === 'laboratorios') return usuarios.some(function(u){ return (u.laboratorios||[]).indexOf(valor) > -1; }) || en(proyectos, 'laboratorio');
  if(cat === 'empresas') return en(usuarios, 'empresa');
  if(cat === 'puestos') return en(usuarios, 'puesto');
  if(cat === 'plantas') return en(disenos, 'planta');
  if(cat === 'ceco') return en(proyectos, 'ceco');
  if(cat === 'tiposFalla') return roturaCargas.some(function(c){ return [c.tipoRoturaM1,c.tipoRoturaM2,c.tipoRoturaM3].indexOf(valor) > -1; });
  return false;
}
function renderCatalogoEditor(){
  var sel = document.getElementById('cat-elegir');
  sel.innerHTML = CATALOGO_DEFS.map(function(d){ return '<option value="'+d.id+'"'+(d.id===catActivo?' selected':'')+'>'+esc(d.label)+'</option>'; }).join('');
  document.getElementById('cat-lista').innerHTML = (catalogos[catActivo]||[]).map(function(x, i){
    return '<div class="cat-fila'+(x.activo?'':' inactivo')+'"><span>'+esc(catActivo==='laboratorios'?labLabel(x.valor)+' ('+x.valor+')':x.valor)+'</span>' +
      '<button class="btn-add ghost" data-cat-toggle="'+i+'">'+(x.activo?'Desactivar':'Activar')+'</button>' +
      '<button class="btn-icon danger" data-cat-borrar="'+i+'" title="Borrar">×</button></div>';
  }).join('') || '<p class="nota-sm">Lista vacía.</p>';
}
document.getElementById('cat-elegir').addEventListener('change', function(){ catActivo = this.value; renderCatalogoEditor(); });
document.getElementById('cat-agregar').addEventListener('click', function(){
  if(!exigir('ajustes:editar')) return;
  var v = document.getElementById('cat-nuevo').value.trim().replace(/\s+/g, ' ');
  if(!v){ toast('Escribí el valor'); return; }
  if((catalogos[catActivo]||[]).some(function(x){ return normalizar(x.valor) === normalizar(v); })){ toast('Ese valor ya existe'); return; }
  catalogos[catActivo].push({valor:v, activo:true});
  saveCatalogos();
  registrarHistorial('Creó', 'Catálogo', catActivo + ': ' + v);
  document.getElementById('cat-nuevo').value = '';
  renderCatalogoEditor();
});
document.getElementById('cat-lista').addEventListener('click', function(e){
  var t = e.target.closest('[data-cat-toggle]'), b = e.target.closest('[data-cat-borrar]');
  if(!t && !b) return;
  if(!exigir('ajustes:editar')) return;
  var lista = catalogos[catActivo];
  if(t){
    var x = lista[Number(t.dataset.catToggle)];
    x.activo = !x.activo;
    saveCatalogos();
    registrarHistorial('Editó', 'Catálogo', catActivo + ': ' + x.valor + (x.activo ? ' activado' : ' desactivado'));
    renderCatalogoEditor();
  } else {
    var y = lista[Number(b.dataset.catBorrar)];
    if(valorEnUso(catActivo, y.valor)){ toast('"' + y.valor + '" está en uso: solo se puede desactivar'); return; }
    if(!confirm('¿Borrar "' + y.valor + '" del catálogo?')) return;
    lista.splice(Number(b.dataset.catBorrar), 1);
    saveCatalogos();
    registrarHistorial('Eliminó', 'Catálogo', catActivo + ': ' + y.valor);
    renderCatalogoEditor();
  }
});

/* RF-USR-03: cambiar la propia contraseña */
document.getElementById('cta-guardar').addEventListener('click', function(){
  var u = usuarioActual;
  if(!u) return;
  var actual = document.getElementById('cta-actual').value;
  var nueva = document.getElementById('cta-nueva').value;
  var rep = document.getElementById('cta-repetir').value;
  if(u.hash !== hashPassword(actual, u.sal)){ toast('La contraseña actual no es correcta'); return; }
  var err = validarClaveNueva(nueva, actual);
  if(err){ toast(err); return; }
  if(nueva !== rep){ toast('Las contraseñas nuevas no coinciden'); return; }
  u.sal = nuevaSal();
  u.hash = hashPassword(nueva, u.sal);
  u.debeCambiarClave = false;
  saveUsuarios();
  ['cta-actual','cta-nueva','cta-repetir'].forEach(function(id){ document.getElementById(id).value = ''; });
  registrarHistorial('Editó', 'Usuario', u.usuario + ' · cambió su contraseña');
  toast('Contraseña actualizada');
});
/* ---- Asistente con IA ---- */
function renderAjustesIA(){
  document.getElementById('ia-clave').value = '';
  document.getElementById('ia-clave').placeholder = agenteCfg.apiKey ? 'Clave guardada (…' + agenteCfg.apiKey.slice(-4) + ')' : 'sk-ant-…';
  document.getElementById('ia-activo').checked = agenteCfg.activo !== false;
  document.getElementById('ia-estado').textContent = agenteCfg.apiKey ? ('Modelo: ' + AGENTE_MODELO + '. Estado: ' + (agenteCfg.activo !== false ? 'activo.' : 'apagado (se usa el motor local).')) : 'Sin clave: el asistente usa el motor local.';
}
document.getElementById('ia-guardar').addEventListener('click', function(){
  var k = document.getElementById('ia-clave').value.trim();
  if(k && !/^sk-ant-/.test(k)){ toast('La clave debe empezar con sk-ant-'); return; }
  if(k) agenteCfg.apiKey = k;
  agenteCfg.activo = document.getElementById('ia-activo').checked;
  saveAgenteCfg();
  nuevaConversacionAgente();
  registrarHistorial('Editó', 'Ajustes', 'Asistente con IA ' + (agenteCfg.activo ? 'activado' : 'desactivado') + (k ? ' · clave actualizada' : ''));
  renderAjustesIA();
  toast('Configuración del asistente guardada');
});
document.getElementById('ia-quitar').addEventListener('click', function(){
  if(!agenteCfg.apiKey) return;
  if(!confirm('¿Quitar la clave de API de este navegador?')) return;
  agenteCfg.apiKey = '';
  saveAgenteCfg();
  nuevaConversacionAgente();
  registrarHistorial('Editó', 'Ajustes', 'Clave del asistente con IA eliminada');
  renderAjustesIA();
  toast('Clave eliminada');
});
document.getElementById('ia-probar').addEventListener('click', function(){
  var estado = document.getElementById('ia-estado');
  if(!agenteCfg.apiKey){ toast('Primero guardá una clave'); return; }
  estado.textContent = 'Probando la conexión…';
  cargarSdkAnthropic().then(function(Anthropic){
    return clienteAnthropic(Anthropic).models.retrieve(AGENTE_MODELO).then(function(m){
      estado.textContent = 'Conexión correcta: ' + (m.display_name || m.id) + ' disponible.';
    }, function(err){ estado.textContent = traducirErrorAgente(err, Anthropic).message; });
  }).catch(function(){ estado.textContent = 'No se pudo cargar la librería de Anthropic (¿sin internet?).'; });
});
PANEL_HOOKS.ajustes = function(){ renderAjustes(); if(can('ver:usuarios')) renderAjustesIA(); };
