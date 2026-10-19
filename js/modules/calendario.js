/* Sistema I+D — Calendario de roturas: vista mensual/semanal para proyectar las roturas programadas. */
'use strict';

var calVista = 'mes';
var calFechaRef = todayISO();     // día que fija el mes/semana visible
var calDiaSeleccionado = todayISO();
var DIAS_SEMANA_CORTOS = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];

function cargasFiltradasCalendario(){
  var proy = document.getElementById('cal-proyecto').value;
  var tipo = document.getElementById('cal-tipo').value;
  return roturaCargas.filter(function(c){
    if(proy && c.proyecto !== proy) return false;
    if(tipo && (c.tipo || 'Probetas') !== tipo) return false;
    return !!c.fechaEnsayo;
  });
}
// Color por edad de rotura: rojo = día 1 (más urgente) y así sucesivamente.
var CAL_EDADES = [
  {max:1,   cls:'e1',   lbl:'Día 1'},
  {max:3,   cls:'e3',   lbl:'Día 3'},
  {max:6,   cls:'e4',   lbl:'Día 4'},
  {max:27,  cls:'e7',   lbl:'Día 7'},
  {max:89,  cls:'e28',  lbl:'Día 28'},
  {max:Infinity, cls:'e90', lbl:'Día 90+'}
];
function edadCalendario(c){
  var d = Number(c.dia) || 0;
  for(var i=0;i<CAL_EDADES.length;i++){ if(d <= CAL_EDADES[i].max) return CAL_EDADES[i]; }
  return CAL_EDADES[CAL_EDADES.length-1];
}
function agruparPorDia(cargas){
  var porDia = {};
  cargas.forEach(function(c){ (porDia[c.fechaEnsayo] = porDia[c.fechaEnsayo] || []).push(c); });
  return porDia;
}
function rebuildCalProyectoSelect(){
  var sel = document.getElementById('cal-proyecto');
  var actual = sel.value;
  sel.innerHTML = '<option value="">Todos los proyectos</option>' + nombresDeProyectos().sort().map(function(p){
    return '<option value="'+esc(p)+'"'+(p===actual?' selected':'')+'>'+esc(p)+'</option>';
  }).join('');
}

function renderCalendario(){
  var hoy = todayISO();
  var porDia = agruparPorDia(cargasFiltradasCalendario());
  var grid = document.getElementById('cal-grid');
  var ref = new Date(calFechaRef+'T00:00:00');
  var dias = [];
  if(calVista === 'mes'){
    var primero = new Date(ref.getFullYear(), ref.getMonth(), 1);
    var inicio = lunesDe(isoDe(primero));
    for(var i=0;i<42;i++){ dias.push(addDaysISO(inicio, i)); }
    if(dias[35].slice(5,7) !== String(ref.getMonth()+1).padStart(2,'0')) dias = dias.slice(0,35);
    document.getElementById('cal-titulo').textContent = MES_NOMBRES[ref.getMonth()] + ' ' + ref.getFullYear();
  } else {
    var lun = lunesDe(calFechaRef);
    for(var j=0;j<7;j++){ dias.push(addDaysISO(lun, j)); }
    var d0 = new Date(dias[0]+'T00:00:00'), d6 = new Date(dias[6]+'T00:00:00');
    document.getElementById('cal-titulo').textContent = d0.getDate() + (d0.getMonth() !== d6.getMonth() ? ' ' + MES_NOMBRES[d0.getMonth()].slice(0,3).toLowerCase() : '') +
      ' – ' + d6.getDate() + ' ' + MES_NOMBRES[d6.getMonth()].slice(0,3).toLowerCase() + ' ' + d6.getFullYear();
  }
  var mesRef = calFechaRef.slice(0,7);
  grid.className = 'cal-grid cal-' + calVista;
  grid.innerHTML = DIAS_SEMANA_CORTOS.map(function(d){ return '<div class="cal-dow">'+d+'</div>'; }).join('') +
    dias.map(function(iso){
      var lista = porDia[iso] || [];
      var porEdad = {}, registradas = 0;
      lista.forEach(function(c){
        if(c.estado === 'completado'){ registradas++; return; }
        var e = edadCalendario(c).cls;
        porEdad[e] = (porEdad[e] || 0) + 1;
      });
      var clases = ['cal-celda'];
      if(iso === hoy) clases.push('hoy');
      if(iso === calDiaSeleccionado) clases.push('sel');
      if(calVista === 'mes' && iso.slice(0,7) !== mesRef) clases.push('fuera');
      var detalle = '';
      if(calVista === 'semana'){
        var porRegistrar = lista.filter(function(c){ return c.estado !== 'completado'; }).sort(function(a,b){ return a.dia-b.dia; });
        detalle = '<div class="cal-items">' + porRegistrar.slice(0,8).map(function(c){
          return '<span class="cal-item '+edadCalendario(c).cls+'">'+esc(c.codigo)+'</span>';
        }).join('') + (porRegistrar.length > 8 ? '<span class="cal-mas">+'+(porRegistrar.length-8)+' más</span>' : '') + '</div>';
      }
      var pendientes = lista.length - registradas;
      if(pendientes && iso < hoy) clases.push('atraso');
      return '<button class="'+clases.join(' ')+'" data-cal-dia="'+iso+'">' +
        '<span class="cal-num">'+Number(iso.slice(8))+'</span>' +
        (pendientes && calVista === 'mes' ? '<span class="cal-chips">' + CAL_EDADES.map(function(e){
            return porEdad[e.cls] ? '<i class="cal-chip '+e.cls+'" title="'+e.lbl+': '+porEdad[e.cls]+' por registrar">'+porEdad[e.cls]+'</i>' : '';
          }).join('') + '</span>'
          : (!pendientes && registradas ? '<span class="cal-ok" title="Todas registradas">✓</span>' : '')) +
        detalle + '</button>';
    }).join('');
  renderCalDia(porDia);
}
function renderCalDia(porDia){
  var iso = calDiaSeleccionado;
  var lista = porDia[iso] || [];
  var d = new Date(iso+'T00:00:00');
  var pend = lista.filter(function(c){ return c.estado !== 'completado'; }).length;
  var grupos = CAL_EDADES.map(function(e){
    var items = lista.filter(function(c){ return edadCalendario(c) === e; }).sort(function(a,b){
      return (a.estado === 'completado') - (b.estado === 'completado') || (a.replicaNombre||'').localeCompare(b.replicaNombre||'');
    });
    if(!items.length) return '';
    return '<div class="cdg"><div class="cdg-head"><i class="cal-dot '+e.cls+'"></i>'+e.lbl+'<span>'+items.length+'</span></div>' +
      items.map(function(c){
        var hecho = c.estado === 'completado';
        return '<div class="cdr'+(hecho ? ' hecho' : '')+'">' +
          '<div class="cdr-txt"><b>'+esc(c.replicaNombre || c.codigo)+'</b><small>'+esc(c.codigo)+' · '+esc(c.proyecto || 'Sin proyecto')+'</small></div>' +
          (hecho ? '<span class="cdr-res">'+(c.promedio ? c.promedio+' <small>kg/cm²</small>' : '✓')+'</span>'
                 : '<button class="cdr-btn" data-perm="roturas:registrar" data-cal-registrar="'+esc(c.id)+'">Registrar</button>') +
        '</div>';
      }).join('') + '</div>';
  }).join('');
  document.getElementById('cal-dia').innerHTML =
    '<div class="cd-head"><div><span class="cd-dow">'+DIA_NOMBRES[d.getDay()]+(iso === todayISO() ? ' · hoy' : '')+'</span>' +
      '<h4>'+d.getDate()+' de '+MES_NOMBRES[d.getMonth()].toLowerCase()+'</h4></div>' +
      (lista.length ? '<span class="cd-count"><b>'+pend+'</b> / '+lista.length+'<small>por registrar</small></span>' : '') + '</div>' +
    (lista.length ? '<div class="cal-dia-lista">'+grupos+'</div>' : '<div class="cd-vacio">Sin roturas este día</div>');
}
document.getElementById('cal-grid').addEventListener('click', function(e){
  var celda = e.target.closest('[data-cal-dia]');
  if(!celda) return;
  calDiaSeleccionado = celda.dataset.calDia;
  renderCalendario();
});
document.getElementById('cal-dia').addEventListener('click', function(e){
  var reg = e.target.closest('[data-cal-registrar]');
  if(reg){ if(!exigir('roturas:registrar')) return; openRoturaCargaModal(reg.dataset.calRegistrar); return; }
  var dia = e.target.closest('[data-cal-dia]');
  if(dia){ calDiaSeleccionado = dia.dataset.calDia; calFechaRef = calDiaSeleccionado; renderCalendario(); }
});
document.getElementById('cal-prev').addEventListener('click', function(){
  var d = new Date(calFechaRef+'T00:00:00');
  if(calVista === 'mes') d = new Date(d.getFullYear(), d.getMonth()-1, 1); else d.setDate(d.getDate()-7);
  calFechaRef = isoDe(d); renderCalendario();
});
document.getElementById('cal-next').addEventListener('click', function(){
  var d = new Date(calFechaRef+'T00:00:00');
  if(calVista === 'mes') d = new Date(d.getFullYear(), d.getMonth()+1, 1); else d.setDate(d.getDate()+7);
  calFechaRef = isoDe(d); renderCalendario();
});
document.getElementById('cal-hoy').addEventListener('click', function(){ calFechaRef = calDiaSeleccionado = todayISO(); renderCalendario(); });
document.getElementById('cal-vista').addEventListener('click', function(e){
  var btn = e.target.closest('.view-toggle-btn');
  if(!btn) return;
  calVista = btn.dataset.vista;
  calFechaRef = calDiaSeleccionado;
  document.querySelectorAll('#cal-vista .view-toggle-btn').forEach(function(b){ b.classList.toggle('active', b === btn); });
  renderCalendario();
});
['cal-proyecto','cal-tipo'].forEach(function(id){ document.getElementById(id).addEventListener('change', renderCalendario); });
// Al guardar una carga desde el calendario, se refresca.
document.getElementById('rotura-carga-save').addEventListener('click', function(){ if(panelActual === 'calendario') setTimeout(renderCalendario, 0); });
PANEL_HOOKS.calendario = function(){ rebuildCalProyectoSelect(); renderCalendario(); };

/* ---- Franja "Esta semana" de Inicio ---- */
function renderInicioSemana(){
  var wrap = document.getElementById('inicio-semana');
  if(!wrap) return;
  var hoy = todayISO();
  var lun = lunesDe(hoy);
  var porDia = agruparPorDia(roturaCargas.filter(function(c){ return c.fechaEnsayo; }));
  var html = '';
  for(var i=0;i<7;i++){
    var iso = addDaysISO(lun, i);
    var lista = porDia[iso] || [];
    var pend = lista.filter(function(c){ return c.estado !== 'completado'; }).length;
    var venc = iso < hoy ? pend : 0;
    html += '<button class="sem-dia'+(iso===hoy?' hoy':'')+(venc?' venc':'')+'" data-sem-dia="'+iso+'">' +
      '<span class="sem-dow">'+DIAS_SEMANA_CORTOS[i]+' '+Number(iso.slice(8))+'</span>' +
      '<b>'+lista.length+'</b><span class="sem-sub">'+(lista.length ? (pend ? pend+' por registrar' : 'todas registradas') : 'sin roturas')+'</span></button>';
  }
  wrap.innerHTML = '<div class="sem-head"><h3 class="inicio-col-title">Calendario de roturas — esta semana</h3><button class="link-mono" data-goto="calendario">Ver calendario →</button></div><div class="sem-fila">'+html+'</div>';
}
document.getElementById('inicio-semana').addEventListener('click', function(e){
  var b = e.target.closest('[data-sem-dia]');
  if(!b) return;
  calDiaSeleccionado = calFechaRef = b.dataset.semDia;
  calVista = 'semana';
  document.querySelectorAll('#cal-vista .view-toggle-btn').forEach(function(x){ x.classList.toggle('active', x.dataset.vista === 'semana'); });
  showPanel('calendario');
});
