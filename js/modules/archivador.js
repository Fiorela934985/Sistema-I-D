/* Sistema I+D — Archivador: diseños completados por proyecto */
'use strict';

/* ================= ARCHIVADOR — diseños Completados organizados por Proyecto ================= */
var archivadorProyectoAbierto = null;
function renderArchivador(){
  var completados = disenos.filter(function(d){ return d.estado === 'Completado'; });
  document.getElementById('archivador-count').textContent = completados.length + ' diseño' + (completados.length===1?'':'s') + ' completado' + (completados.length===1?'':'s');
  document.getElementById('archivador-detalle').style.display = 'none';
  document.getElementById('archivador-carpetas').style.display = 'grid';
  var porProyecto = {};
  completados.forEach(function(d){
    var nombre = proyectoNombre(d.proyectoId) || 'Sin proyecto';
    if(!porProyecto[nombre]) porProyecto[nombre] = [];
    porProyecto[nombre].push(d);
  });
  var nombres = Object.keys(porProyecto).sort();
  var wrap = document.getElementById('archivador-carpetas');
  wrap.className = 'archivador-grid';
  if(!nombres.length){ wrap.innerHTML = '<div class="empty-note">Todavía no hay diseños Completados para archivar.</div>'; return; }
  wrap.innerHTML = nombres.map(function(nombre){
    var lista = porProyecto[nombre];
    var maxRes = lista.map(resistenciaMaxima).filter(isFinite);
    var ultima = lista.map(function(d){ return d.ts || 0; }).sort(function(a,b){ return b-a; })[0];
    var iters = {}; lista.forEach(function(d){ if(d.iteracionId) iters[d.iteracionId] = true; });
    return '<button class="archivador-carpeta" data-proy="'+esc(nombre)+'">' +
      '<span class="ac-ico"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg></span>' +
      '<span class="ac-nombre">'+esc(nombre)+'</span>' +
      '<span class="ac-stats"><span><b>'+lista.length+'</b>diseño'+(lista.length===1?'':'s')+'</span><span><b>'+Object.keys(iters).length+'</b>iteraciones</span><span><b>'+(maxRes.length ? fmt(Math.max.apply(null, maxRes),0) : '-')+'</b>máx. kg/cm²</span></span>' +
      '<span class="ac-count">Último: '+(ultima ? isoToDMY(isoDe(new Date(ultima))) : '-')+'</span>' +
    '</button>';
  }).join('');
  wrap.dataset.porProyecto = '1';
  window._archivadorData = porProyecto;
}
document.getElementById('archivador-carpetas').addEventListener('click', function(e){
  var btn = e.target.closest('.archivador-carpeta');
  if(!btn) return;
  archivadorProyectoAbierto = btn.dataset.proy;
  renderArchivadorDetalle();
});
function renderArchivadorDetalle(){
  var lista = (window._archivadorData || {})[archivadorProyectoAbierto] || [];
  document.getElementById('archivador-carpetas').style.display = 'none';
  var wrap = document.getElementById('archivador-detalle');
  wrap.style.display = 'block';
  wrap.innerHTML =
    '<button class="link-mono" id="archivador-atras" style="margin-bottom:16px;">← Volver a carpetas</button>' +
    '<h3 style="font-family:var(--font-display);margin-bottom:16px;">'+esc(archivadorProyectoAbierto)+'</h3>' +
    '<div class="archivador-lista">' + lista.map(function(d){
      var i = disenos.indexOf(d);
      return '<div class="ih-card accent-verde">' +
        '<div class="id-card-simple">'+d.codigo+'</div>' +
        '<div class="ih-main"><span class="ih-nombre">'+diseñoTitulo(d)+'</span><span class="ih-meta">'+esc(iteracionNombre(d.iteracionId))+' · '+d.fecha+'</span></div>' +
        '<button class="btn-add" data-act="informe" data-i="'+i+'">Ver informe</button>' +
        '<button class="btn-add ghost" data-act="pdf" data-i="'+i+'">Descargar PDF</button>' +
      '</div>';
    }).join('') + '</div>';
}
document.getElementById('archivador-detalle').addEventListener('click', function(e){
  if(e.target.id === 'archivador-atras'){ renderArchivador(); return; }
  var btnInforme = e.target.closest('[data-act="informe"]');
  if(btnInforme){ openInformeModal(disenos[Number(btnInforme.dataset.i)]); return; }
  var btnPdf = e.target.closest('[data-act="pdf"]');
  if(btnPdf){
    openDesignModal(disenos[Number(btnPdf.dataset.i)]);
    setTimeout(function(){ window.print(); }, 300);
    return;
  }
});
