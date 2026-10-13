/* Sistema I+D — Utilidades base: almacenamiento local, formato, fechas y toast */
'use strict';

// Config global de Chart.js: texto SIEMPRE negro/legible, sin importar tema — pedido explícito.
if(typeof Chart !== 'undefined'){
  Chart.defaults.color = '#14181a';
  Chart.defaults.font.family = "'Inter', sans-serif";
  Chart.defaults.font.size = 12;
  Chart.defaults.plugins.legend.labels.color = '#14181a';
  Chart.defaults.scale.grid.color = 'rgba(0,0,0,.08)';
}

function load(key, fallback){ try{ var raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }catch(e){ return fallback; } }
function save(key, value){ try{ localStorage.setItem(key, JSON.stringify(value)); }catch(e){} }
function esc(s){ return (s===undefined||s===null) ? '' : String(s).replace(/"/g,'&quot;'); }
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
