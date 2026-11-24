/* Sistema I+D — Utilidades base: almacenamiento local, formato, fechas y toast */
'use strict';

// Config global de Chart.js: texto SIEMPRE negro/legible, sin importar tema — pedido explícito.
if(typeof Chart !== 'undefined'){
  Chart.defaults.color = '#14181a';
  Chart.defaults.font.family = "'Inter', sans-serif";
  Chart.defaults.font.size = 12;
  Chart.defaults.plugins.legend.labels.color = '#14181a';
  Chart.defaults.scale.grid.color = 'rgba(20,24,26,.06)';
  Chart.defaults.scale.border.display = false;
  Chart.defaults.elements.bar.borderRadius = 6;
  Chart.defaults.elements.bar.borderSkipped = false;
  Chart.defaults.elements.line.borderWidth = 2.5;
  Chart.defaults.elements.line.tension = .35;
  Chart.defaults.elements.point.radius = 3.5;
  Chart.defaults.elements.point.hoverRadius = 6;
  Chart.defaults.elements.point.borderWidth = 2;
  Chart.defaults.elements.point.backgroundColor = '#fff';
  Chart.defaults.plugins.legend.labels.usePointStyle = true;
  Chart.defaults.plugins.legend.labels.pointStyle = 'circle';
  Chart.defaults.plugins.legend.labels.boxWidth = 8;
  Chart.defaults.plugins.legend.labels.boxHeight = 8;
  Chart.defaults.plugins.legend.labels.font = {weight:'600', size:11};
  Chart.defaults.plugins.tooltip.backgroundColor = '#14181a';
  Chart.defaults.plugins.tooltip.padding = 10;
  Chart.defaults.plugins.tooltip.cornerRadius = 8;
  Chart.defaults.plugins.tooltip.titleFont = {weight:'700'};
}

function load(key, fallback){ try{ var raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }catch(e){ return fallback; } }
function save(key, value){ try{ localStorage.setItem(key, JSON.stringify(value)); }catch(e){} if(typeof window.alGuardar === 'function') window.alGuardar(key, value); }
function esc(s){ return (s===undefined||s===null) ? '' : String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
function n(v){ var x = parseFloat(v); return isNaN(x) ? 0 : x; }
function pad4(x){ return String(x).padStart(4,'0'); }
function todayISO(){ var d = new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
function isoToDMY(iso){ if(!iso) return ''; var p = iso.split('-'); return p[2]+'/'+p[1]+'/'+p[0]; }
function dmyToISO(dmy){ if(!dmy) return ''; var p = dmy.split('/'); return p.length===3 ? (p[2]+'-'+p[1]+'-'+p[0]) : ''; }

var toastEl = document.getElementById('toast');
var toastMsg = document.getElementById('toast-msg');
var toastTimer;
function toast(msg){
  toastMsg.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function(){ toastEl.classList.remove('show'); }, 2600);
}

var DAY = 24*3600*1000;

/* ---- Helpers compartidos por los módulos ---- */
function normalizar(s){ return String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/\s+/g,' ').trim(); }
function fmt(v, dec){ var x = Number(v); if(!isFinite(x)) return '-'; return x.toFixed(dec === undefined ? 1 : dec); }
function promedio(arr){ var a = arr.filter(function(v){ return isFinite(v); }); return a.length ? a.reduce(function(x,y){ return x+y; },0)/a.length : NaN; }
function isoDe(d){ return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
function lunesDe(iso){ var d = new Date(iso+'T00:00:00'); var dow = (d.getDay()+6)%7; d.setDate(d.getDate()-dow); return isoDe(d); }
function addDaysISO(iso, dias){ var d = new Date(iso+'T00:00:00'); d.setDate(d.getDate()+dias); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
function descargarArchivo(nombre, contenido, mime){
  var blob = contenido instanceof Blob ? contenido : new Blob([contenido], {type: mime || 'text/plain;charset=utf-8'});
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url; a.download = nombre;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(function(){ URL.revokeObjectURL(url); }, 1500);
}
function exportarExcel(nombreArchivo, hojas){
  // hojas: [{nombre:'Hoja', filas:[[...], ...]}]
  if(typeof XLSX === 'undefined'){ toast('No se pudo cargar la librería de Excel'); return false; }
  var wb = XLSX.utils.book_new();
  hojas.forEach(function(h){ XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(h.filas), h.nombre.slice(0,31)); });
  XLSX.writeFile(wb, nombreArchivo);
  return true;
}
function aCSV(filas){
  return filas.map(function(f){ return f.map(function(v){
    var s = (v===undefined||v===null) ? '' : String(v);
    return /[",;\n]/.test(s) ? '"' + s.replace(/"/g,'""') + '"' : s;
  }).join(','); }).join('\n');
}
function abrirModal(id){ document.getElementById(id).classList.add('show'); }
function cerrarModal(id){ document.getElementById(id).classList.remove('show'); }
document.addEventListener('click', function(e){
  var btn = e.target.closest('[data-close]');
  if(btn){ cerrarModal(btn.dataset.close); return; }
  if(e.target.classList && e.target.classList.contains('sid-modal')) e.target.classList.remove('show');
});
// Paleta del tema celeste + verde para gráficos
var PALETA = ['#0099cc','#4caf3e','#0b6f96','#f59e0b','#5b6cf0','#14b8a6','#e5484d','#94a3b8'];
var COLOR_PRIMARIO = '#0396c8', COLOR_VERDE = '#2e9e57', COLOR_ROJO = '#dc2626', COLOR_AMBAR = '#f59e0b';
