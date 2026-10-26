/* Sistema I+D — Recursos (sección 11): productos y lotes, egresos, equipos y calibración, muestras y envíos.
   Mismos campos y reglas que el sistema de inventario (D1 "inventario"), para que al unirlos se migren 1:1.
   Tres enlaces con I+D: los egresos llevan proyecto, los productos alimentan los diseños y los equipos
   (prensas) controlan las roturas. */
'use strict';

var TIPOS_PRODUCTO = ['Aditivo', 'Cemento', 'Adición', 'Agregado fino', 'Agregado grueso', 'Materiales', 'Otro'];
var PREFIJO_PRODUCTO = {'Aditivo':'ADI', 'Cemento':'CEM', 'Adición':'ADC', 'Agregado fino':'AGF', 'Agregado grueso':'AGG', 'Materiales':'MAT', 'Otro':'OTR'};
var CATEGORIAS_EQUIPO = ['Prensa', 'Balanza', 'Horno', 'Cono de Abrams', 'Termómetro', 'Olla Washington', 'Instrumento', 'Otro'];
var ESTADOS_EQUIPO = ['Habilitado', 'Inhabilitado', 'Prestado'];
var ESTADOS_MUESTRA = ['Pendiente', 'Analizada', 'Contramuestra', 'Desechada'];
var ESTADOS_ENVIO = ['Registrado', 'Enviado', 'Recepcionado'];

var productosInventario = load('sid_inv_productos', []);
var lotesInventario = load('sid_inv_lotes', []);
var egresosInventario = load('sid_inv_egresos', []);
var equiposInventario = load('sid_inv_equipos', []);
var muestrasInventario = load('sid_inv_muestras', []);
var enviosInventario = load('sid_inv_envios', []);
function saveInv(){
  save('sid_inv_productos', productosInventario); save('sid_inv_lotes', lotesInventario); save('sid_inv_egresos', egresosInventario);
  save('sid_inv_equipos', equiposInventario); save('sid_inv_muestras', muestrasInventario); save('sid_inv_envios', enviosInventario);
}
function puedeInv(){ return can('inventario:editar'); }
function rolEs(){ return Array.prototype.indexOf.call(arguments, rolDe(usuarioActual)) > -1; }

/* ================= Stock ================= */
function productoPorCodigo(c){ return productosInventario.filter(function(p){ return p.codigo === c; })[0] || null; }
function stockLote(l){
  var usado = egresosInventario.filter(function(e){ return e.lote === l.codigo && e.estado !== 'Pendiente'; }).reduce(function(a, e){ return a + n(e.cantidad); }, 0);
  return Math.max(0, n(l.cantidad) - usado);
}
function lotesDeProducto(cod){ return lotesInventario.filter(function(l){ return l.producto === cod; }); }
function stockProducto(cod){ return lotesDeProducto(cod).reduce(function(a, l){ return a + stockLote(l); }, 0); }
function loteVencido(l){ return l.vencimiento && l.vencimiento < todayISO(); }
/* El material del diseño (componente) se vincula al producto del inventario por su nombre. */
function productoDeMaterial(nombre){
  var k = normalizar(nombre);
  return productosInventario.filter(function(p){ return normalizar(p.componente || p.nombre) === k || normalizar(p.nombre) === k; })[0] || null;
}
/* FIFO: primero el que vence antes. */
function lotesFIFO(cod){
  return lotesDeProducto(cod).filter(function(l){ return stockLote(l) > 0 && !loteVencido(l); })
    .sort(function(a, b){ return (a.vencimiento || '9999').localeCompare(b.vencimiento || '9999') || (a.fechaIngreso || '').localeCompare(b.fechaIngreso || ''); });
}
function opcionesLote(nombreMaterial, sel){
  var p = productoDeMaterial(nombreMaterial);
  if(!p) return '<option value="">Sin producto en inventario</option>';
  return '<option value="">FIFO (vence primero)</option>' + lotesDeProducto(p.codigo).filter(function(l){ return stockLote(l) > 0 || l.codigo === sel; }).map(function(l){
    return '<option value="' + esc(l.codigo) + '"' + (l.codigo === sel ? ' selected' : '') + '>' + esc(l.codigo) + ' · ' + fmt(stockLote(l), 2) + ' ' + esc(p.unidad || 'kg') + (loteVencido(l) ? ' · VENCIDO' : (l.vencimiento ? ' · vence ' + isoToDMY(l.vencimiento) : '')) + '</option>';
  }).join('');
}

/* RF-ELA-02: suma lo requerido por las réplicas del día; si falta o hay lote vencido, avisa (no bloquea). */
function verificarStockDia(fecha){
  var req = {};
  todasLasReplicas().forEach(function(x){
    if(!x.rep.programacion || x.rep.programacion.fecha !== fecha || x.rep.elaboracion) return;
    (x.d.mix || []).forEach(function(it){ if(n(it.pesoSeco)) req[it.nombre] = (req[it.nombre] || 0) + n(it.pesoSeco) * (n(x.d.batchVol) || 30) / 1000; });
  });
  var faltas = [];
  Object.keys(req).forEach(function(nm){
    var p = productoDeMaterial(nm);
    if(!p) return;
    var disp = lotesFIFO(p.codigo).reduce(function(a, l){ return a + stockLote(l); }, 0);
    if(disp < req[nm]) faltas.push(nm + ': se necesitan ' + fmt(req[nm], 2) + ' y hay ' + fmt(disp, 2) + ' (sin contar lotes vencidos)');
  });
  return faltas.join('; ');
}

/* RF-INV-06/07: al guardar la elaboración se descuenta la dosis real por material, del lote elegido o por FIFO.
   Si no alcanza el stock, la elaboración se guarda igual, el egreso queda Pendiente y se avisa a Inventario. */
function registrarEgresoAutomatico(d, rep){
  var e = rep.elaboracion;
  var proyecto = proyectoNombre(d.proyectoId);
  (e.dosis || []).forEach(function(ds){
    var p = productoDeMaterial(ds.nombre);
    var cant = n(ds.real);
    if(!p || !(cant > 0)) return;
    var porTomar = cant;
    var tramos = [];
    if(ds.lote){
      var l = lotesInventario.filter(function(x){ return x.codigo === ds.lote; })[0];
      if(l){ var t = Math.min(stockLote(l), porTomar); if(t > 0){ tramos.push({lote:l.codigo, cantidad:t}); porTomar -= t; } }
    }
    lotesFIFO(p.codigo).forEach(function(l){
      if(porTomar <= 0 || tramos.some(function(x){ return x.lote === l.codigo; })) return;
      var t = Math.min(stockLote(l), porTomar);
      if(t > 0){ tramos.push({lote:l.codigo, cantidad:t}); porTomar -= t; }
    });
    tramos.forEach(function(tr){ egresosInventario.push(nuevoEgreso(p, tr.lote, tr.cantidad, proyecto, d, rep, 'Registrado')); });
    if(porTomar > 0.0001){
      egresosInventario.push(nuevoEgreso(p, '', porTomar, proyecto, d, rep, 'Pendiente'));
      notificar('INV', 'Egreso pendiente por falta de stock', p.nombre + ': faltan ' + fmt(porTomar, 2) + ' ' + (p.unidad || 'kg') + ' para ' + rep.nombre, 'inventario');
    }
  });
  saveInv();
}
function nuevoEgreso(p, lote, cantidad, proyecto, d, rep, estado){
  return {id: nuevoId('eg'), producto: p.codigo, productoNombre: p.nombre, lote: lote, cantidad: +cantidad.toFixed(4), unidad: p.unidad || 'kg',
    fecha: (rep && rep.elaboracion && rep.elaboracion.fecha) || todayISO(), proyecto: proyecto, responsable: usuarioActual.id,
    costo: +(cantidad * n(p.precio)).toFixed(4), disenoCodigo: d ? d.codigo : '', replica: rep ? rep.nombre : '', estado: estado, auto: !!d, ts: Date.now()};
}
egresosInventario.forEach(function(e){ if(!e.producto && e.productoNombre) e.producto = e.productoNombre; });

/* ================= Equipos: calibración vigente (RF-EQU-03) y prensas para roturas (RF-ROT-04) ================= */
function ultimaCalibracion(eq){ return (eq.calibraciones || []).map(function(c){ return c.fecha; }).sort().pop() || ''; }
function venceCalibracion(eq){
  var u = ultimaCalibracion(eq);
  if(!u || !(n(eq.frecuenciaMeses) > 0)) return '';
  var d = new Date(u + 'T00:00:00'); d.setMonth(d.getMonth() + n(eq.frecuenciaMeses));
  return isoDe(d);
}
function calibracionVigente(eq){
  if(!(n(eq.frecuenciaMeses) > 0)) return !!ultimaCalibracion(eq);
  var v = venceCalibracion(eq);
  return !!v && v >= todayISO();
}
function estadoCalibracion(eq){ return calibracionVigente(eq) ? 'Vigente' : 'Sin calibrar'; }
function prensasDisponibles(lab){
  return equiposInventario.filter(function(eq){
    return /prensa/i.test(eq.categoria + ' ' + eq.nombre) && (!lab || eq.laboratorio === lab) && eq.estado === 'Habilitado' && calibracionVigente(eq);
  }).map(function(eq){ return {id: eq.id, nombre: eq.nombre, identificacion: eq.identificacion, calibracion: ultimaCalibracion(eq)}; });
}

/* Avisos para la campana (RF-INV-08, RF-EQU-05, RF-MUE-04, RF-ENV-02). */
function avisosInventario(){
  var out = [], hoy = todayISO();
  var labs = function(x){ return veoLaboratorio(x.laboratorio); };
  var bajos = productosInventario.filter(labs).filter(function(p){
    var s = stockProducto(p.codigo);
    return (n(p.cantidadMinima) && s <= n(p.cantidadMinima)) || (n(p.presentacion) && s <= n(p.presentacion) * Number(ajuste('stockBajoPct')) / 100);
  });
  if(bajos.length) out.push({clave:'stock-bajo', nivel:'naranja', titulo: bajos.length + ' producto(s) con stock bajo', texto: bajos.slice(0, 5).map(function(p){ return p.nombre; }).join(', ')});
  var lim = addDaysISO(hoy, Number(ajuste('diasAvisoVencimiento')));
  var porVencer = lotesInventario.filter(function(l){ var p = productoPorCodigo(l.producto); return p && labs(p) && stockLote(l) > 0 && l.vencimiento && l.vencimiento <= lim; });
  if(porVencer.length) out.push({clave:'lotes-vencen', nivel: porVencer.some(loteVencido) ? 'rojo' : 'naranja', titulo: porVencer.length + ' lote(s) vencidos o por vencer', texto: porVencer.slice(0, 5).map(function(l){ return l.codigo + ' (' + isoToDMY(l.vencimiento) + ')'; }).join(', ')});
  var mesActualISO = hoy.slice(0, 7), mesSig = addDaysISO(hoy, 31).slice(0, 7);
  var cal = equiposInventario.filter(labs).filter(function(eq){ return eq.estado === 'Habilitado' && (!calibracionVigente(eq) || (venceCalibracion(eq) || '').slice(0, 7) === mesActualISO || (venceCalibracion(eq) || '').slice(0, 7) === mesSig); });
  if(cal.length) out.push({clave:'calibraciones', nivel: cal.some(function(eq){ return !calibracionVigente(eq); }) ? 'rojo' : 'naranja', titulo: cal.length + ' equipo(s) por calibrar', texto: cal.slice(0, 5).map(function(eq){ return eq.nombre + ' (' + (venceCalibracion(eq) ? 'vence ' + isoToDMY(venceCalibracion(eq)) : 'sin calibración') + ')'; }).join(', ')});
  var descarte = addDaysISO(hoy, Number(ajuste('diasAvisoDescarte')));
  var mues = muestrasInventario.filter(labs).filter(function(m){ return m.estado !== 'Desechada' && m.fechaDescarte && m.fechaDescarte <= descarte; });
  if(mues.length) out.push({clave:'descarte', nivel:'naranja', titulo: mues.length + ' muestra(s) por descartar', texto: mues.slice(0, 5).map(function(m){ return m.codigo + ' (' + isoToDMY(m.fechaDescarte) + ')'; }).join(', ')});
  var env = enviosInventario.filter(function(x){ return x.estado === 'Enviado' && (veoLaboratorio(x.destino) || x.receptor === usuarioActual.id); });
  if(env.length) out.push({clave:'envios', nivel:'naranja', titulo: env.length + ' envío(s) por recepcionar', texto: env.slice(0, 5).map(function(x){ return x.item + ' → ' + labLabel(x.destino); }).join(', ')});
  var pend = egresosInventario.filter(function(e){ return e.estado === 'Pendiente'; });
  if(pend.length) out.push({clave:'egresos-pend', nivel:'rojo', titulo: pend.length + ' egreso(s) pendiente(s) por falta de stock', texto: pend.slice(0, 5).map(function(e){ return e.productoNombre + ' ' + fmt(e.cantidad, 2); }).join(', ')});
  return out;
}

/* ================= Panel ================= */
var invSub = 'productos';
function showInventarioSub(name){
  invSub = name;
  document.querySelectorAll('#inv-subtabs .subtab').forEach(function(b){ b.classList.toggle('active', b.dataset.isub === name); });
  renderInventario();
}
document.getElementById('inv-subtabs').addEventListener('click', function(e){ var b = e.target.closest('[data-isub]'); if(b) showInventarioSub(b.dataset.isub); });
function tabla(cab, filas){
  return '<div class="table-scroll"><table class="data-table"><thead><tr>' + cab.map(function(c){ return '<th>' + esc(c) + '</th>'; }).join('') + '</tr></thead><tbody>' +
    (filas.length ? filas.join('') : '<tr><td colspan="' + cab.length + '" class="nota-sm">Sin registros.</td></tr>') + '</tbody></table></div>';
}
function renderInventario(){
  document.getElementById('inv-origen').textContent = 'Datos de I+D · listos para unirse al sistema de inventario';
  var c = document.getElementById('inv-contenido');
  var lab = function(x){ return veoLaboratorio(x.laboratorio); };
  var avisos = avisosInventario();
  var cab = avisos.length ? '<div class="atencion-lista">' + avisos.map(function(a){ return '<div class="atencion-item nivel-' + a.nivel + '"><b>' + esc(a.titulo) + '</b><span>' + esc(a.texto) + '</span></div>'; }).join('') + '</div>' : '';
  if(invSub === 'productos'){
    c.innerHTML = cab + '<div class="card"><div class="ev-toolbar"><input type="text" id="inv-buscar" placeholder="Buscar producto…" value="' + esc(invBuscar) + '">' +
      (puedeInv() ? '<span><button class="btn-add" data-inv-prod="nuevo">+ Producto</button> <button class="btn-add ghost" data-inv-lote="1">+ Ingreso de lote</button></span>' : '') + '</div>' +
      tabla(['Código', 'Producto', 'Tipo', 'Laboratorio', 'Material del diseño', 'Precio', 'Stock', 'Lotes', 'Docs', ''], productosInventario.filter(lab).filter(function(p){ return !invBuscar || normalizar(p.codigo + ' ' + p.nombre).indexOf(normalizar(invBuscar)) > -1; }).map(function(p){
        var s = stockProducto(p.codigo);
        var bajo = (n(p.cantidadMinima) && s <= n(p.cantidadMinima)) || (n(p.presentacion) && s <= n(p.presentacion) * Number(ajuste('stockBajoPct')) / 100);
        return '<tr><td class="mono">' + esc(p.codigo) + '</td><td><b>' + esc(p.nombre) + '</b><br><small>' + esc([p.tipoEspecifico, p.proveedor, p.procedencia].filter(Boolean).join(' · ')) + '</small></td><td>' + esc(p.tipo) + '</td><td>' + esc(labLabel(p.laboratorio)) + '</td>' +
          '<td>' + esc(p.componente || '—') + '</td><td>S/ ' + fmt(n(p.precio), 4) + ' / ' + esc(p.unidad || 'kg') + '</td><td' + (bajo ? ' class="txt-rojo"' : '') + '><b>' + fmt(s, 2) + '</b> ' + esc(p.unidad || 'kg') + (bajo ? ' · bajo' : '') + '</td>' +
          '<td>' + lotesDeProducto(p.codigo).map(function(l){ return '<span class="tag-pill ' + (loteVencido(l) ? 'tag-rojo' : 'tag-gris') + '" title="Vence ' + isoToDMY(l.vencimiento) + '">' + esc(l.codigo) + ': ' + fmt(stockLote(l), 1) + '</span>'; }).join(' ') + '</td>' +
          '<td>' + (p.ft ? '<a href="' + esc(p.ft) + '" target="_blank" rel="noopener">FT</a> ' : '') + (p.msds ? '<a href="' + esc(p.msds) + '" target="_blank" rel="noopener">MSDS</a>' : '') + '</td>' +
          '<td>' + (puedeInv() ? '<button class="btn-icon edit" data-inv-prod="' + esc(p.codigo) + '">' + EDIT_ICON + '</button>' : '') + '</td></tr>';
      })) + '</div>';
  } else if(invSub === 'egresos'){
    var puedeEgr = puedeInv() || rolEs('ANA');
    c.innerHTML = cab + '<div class="card"><div class="ev-toolbar"><span class="nota-sm">Cada egreso lleva su proyecto. Los automáticos salen de las elaboraciones (dosis real × tanda).</span>' +
      '<span>' + (puedeEgr ? '<button class="btn-add" data-inv-egreso="1">+ Egreso manual</button> ' : '') + '<button class="btn-add ghost" data-inv-excel="1">Exportar Excel</button></span></div>' +
      tabla(['Fecha', 'Producto', 'Lote', 'Cantidad', 'Costo (S/)', 'Proyecto', 'Diseño / réplica', 'Responsable', 'Estado', ''], egresosInventario.slice().sort(function(a, b){ return b.ts - a.ts; }).filter(function(e){ var p = productoPorCodigo(e.producto); return !p || lab(p); }).slice(0, 500).map(function(e){
        return '<tr><td>' + isoToDMY(e.fecha) + '</td><td>' + esc(e.productoNombre) + '</td><td class="mono">' + esc(e.lote || '—') + '</td><td>' + fmt(e.cantidad, 3) + ' ' + esc(e.unidad) + '</td><td>' + fmt(e.costo, 2) + '</td><td>' + esc(e.proyecto) + '</td>' +
          '<td>' + esc((e.disenoCodigo || '') + ' ' + (e.replica || '')) + '</td><td>' + esc(nombreUsuario(usuarioPorId(e.responsable))) + '</td><td>' + (e.estado === 'Pendiente' ? '<span class="tag-pill tag-rojo">Pendiente</span>' : '<span class="tag-pill tag-verde">Registrado</span>') + (e.auto ? ' <span class="tag-pill tag-gris">auto</span>' : '') + '</td>' +
          '<td>' + (e.estado === 'Pendiente' && puedeInv() ? '<button class="btn-add ghost mini" data-inv-resolver="' + e.id + '">Resolver</button>' : '') + '</td></tr>';
      })) + '</div>';
  } else if(invSub === 'equipos'){
    c.innerHTML = cab + '<div class="card"><div class="ev-toolbar"><span class="nota-sm">Solo las prensas Habilitadas con calibración vigente se pueden elegir al registrar una rotura. Vigente = última calibración + frecuencia ≥ hoy.</span>' +
      (can('equipos:editar') ? '<button class="btn-add" data-inv-equipo="nuevo">+ Equipo</button>' : '') + '</div>' +
      tabla(['Identificación', 'Equipo', 'Categoría', 'Laboratorio', 'Estado', 'Última calibración', 'Vence', 'Calibración', ''], equiposInventario.filter(lab).map(function(eq){
        var vig = calibracionVigente(eq);
        return '<tr><td class="mono">' + esc(eq.identificacion) + '</td><td><b>' + esc(eq.nombre) + '</b><br><small>' + esc([eq.marca, eq.modelo, eq.serie].filter(Boolean).join(' · ')) + '</small></td><td>' + esc(eq.categoria) + '</td><td>' + esc(labLabel(eq.laboratorio)) + '</td>' +
          '<td>' + esc(eq.estado) + (eq.prestadoA ? ' a ' + esc(eq.prestadoA) : '') + '</td><td>' + isoToDMY(ultimaCalibracion(eq)) + '</td><td>' + isoToDMY(venceCalibracion(eq)) + '</td>' +
          '<td><span class="tag-pill ' + (vig ? 'tag-verde' : 'tag-rojo') + '">' + estadoCalibracion(eq) + '</span></td>' +
          '<td>' + (can('equipos:editar') ? '<button class="btn-add ghost mini" data-inv-calibrar="' + eq.id + '">Registrar calibración</button> <button class="btn-icon edit" data-inv-equipo="' + eq.id + '">' + EDIT_ICON + '</button>' : '') + '</td></tr>';
      })) + '</div>';
  } else if(invSub === 'muestras'){
    var puedeM = puedeInv() || rolEs('ANA');
    c.innerHTML = cab + '<div class="card"><div class="ev-toolbar"><span class="nota-sm">Cada muestra se vincula a su proyecto y diseños. Descarte = ingreso + 3 meses (editable).</span>' + (puedeM ? '<button class="btn-add" data-inv-muestra="nuevo">+ Muestra</button>' : '') + '</div>' +
      tabla(['Código', 'Trazabilidad', 'Descripción', 'Material', 'Ubicación', 'Ingreso', 'Proyecto', 'Diseños', 'Estado', 'Descarte', ''], muestrasInventario.filter(lab).map(function(m){
        return '<tr><td class="mono">' + esc(m.codigo) + '</td><td class="mono">' + esc(m.trazabilidad) + '</td><td>' + esc(m.descripcion) + '</td><td>' + esc(m.material) + '</td><td>' + esc(m.ubicacion) + '</td><td>' + isoToDMY(m.fechaIngreso) + '</td>' +
          '<td>' + esc(m.proyecto || '—') + '</td><td>' + esc((m.disenos || []).join(', ') || '—') + '</td><td>' + esc(m.estado) + '</td><td>' + isoToDMY(m.fechaDescarte) + '</td>' +
          '<td>' + (puedeM ? '<button class="btn-icon edit" data-inv-muestra="' + m.id + '">' + EDIT_ICON + '</button>' : '') + '</td></tr>';
      })) + '</div>';
  } else {
    var puedeE = puedeInv() || rolEs('ANA');
    c.innerHTML = cab + '<div class="card"><div class="ev-toolbar"><span class="nota-sm">Registrado → Enviado → Recepcionado (el receptor confirma con foto).</span>' + (puedeE ? '<button class="btn-add" data-inv-envio="1">+ Envío</button>' : '') + '</div>' +
      tabla(['Fecha', 'Tipo', 'Qué se envía', 'Salida → destino', 'Remitente', 'Receptor', 'Cantidad', 'Proyecto', 'Estado', ''], enviosInventario.slice().sort(function(a, b){ return b.ts - a.ts; }).map(function(x){
        var sig = ESTADOS_ENVIO[ESTADOS_ENVIO.indexOf(x.estado) + 1];
        return '<tr><td>' + fechaHora(x.ts) + '</td><td>' + esc(x.tipo) + '</td><td>' + esc(x.item) + '</td><td>' + esc(labLabel(x.salida) + ' → ' + labLabel(x.destino)) + '</td><td>' + esc(nombreUsuario(usuarioPorId(x.remitente))) + '</td><td>' + esc(nombreUsuario(usuarioPorId(x.receptor))) + '</td>' +
          '<td>' + fmt(x.total, 2) + '</td><td>' + esc(x.proyecto || '—') + '</td><td>' + esc(x.estado) + (x.foto ? ' · <a href="' + esc(x.foto) + '" target="_blank" rel="noopener">foto</a>' : '') + '</td>' +
          '<td>' + (sig && (puedeInv() || x.receptor === usuarioActual.id || x.remitente === usuarioActual.id) ? '<button class="btn-add ghost mini" data-inv-avanzar="' + x.id + '">Marcar ' + sig + '</button>' : '') + '</td></tr>';
      })) + '</div>';
  }
}
var invBuscar = '';
document.getElementById('inv-contenido').addEventListener('input', function(e){ if(e.target.id === 'inv-buscar'){ invBuscar = e.target.value; var pos = e.target.selectionStart; renderInventario(); var el = document.getElementById('inv-buscar'); el.focus(); el.setSelectionRange(pos, pos); } });
document.getElementById('inv-contenido').addEventListener('click', function(e){
  var t = function(s){ return e.target.closest(s); };
  var el;
  if((el = t('[data-inv-prod]'))) abrirProducto(el.dataset.invProd === 'nuevo' ? null : productoPorCodigo(el.dataset.invProd));
  else if(t('[data-inv-lote]')) abrirIngresoLote();
  else if(t('[data-inv-egreso]')) abrirEgresoManual();
  else if(t('[data-inv-excel]')) exportarMovimientos();
  else if((el = t('[data-inv-resolver]'))) resolverEgresoPendiente(egresosInventario.filter(function(x){ return x.id === el.dataset.invResolver; })[0]);
  else if((el = t('[data-inv-equipo]'))) abrirEquipo(el.dataset.invEquipo === 'nuevo' ? null : equiposInventario.filter(function(x){ return x.id === el.dataset.invEquipo; })[0]);
  else if((el = t('[data-inv-calibrar]'))) registrarCalibracion(equiposInventario.filter(function(x){ return x.id === el.dataset.invCalibrar; })[0]);
  else if((el = t('[data-inv-muestra]'))) abrirMuestra(el.dataset.invMuestra === 'nuevo' ? null : muestrasInventario.filter(function(x){ return x.id === el.dataset.invMuestra; })[0]);
  else if(t('[data-inv-envio]')) abrirEnvio();
  else if((el = t('[data-inv-avanzar]'))) avanzarEnvio(enviosInventario.filter(function(x){ return x.id === el.dataset.invAvanzar; })[0]);
});
function selLab(id, valor){ return '<select id="' + id + '">' + catalogo('laboratorios').filter(function(l){ return veoLaboratorio(l); }).map(function(l){ return '<option value="' + esc(l) + '"' + (l === valor ? ' selected' : '') + '>' + esc(labLabel(l)) + '</option>'; }).join('') + '</select>'; }
function selProyecto(id, valor, vacio){ return '<select id="' + id + '"><option value="">' + (vacio || 'Elegí el proyecto…') + '</option>' + proyectosVisibles().filter(function(p){ return proyectoAbierto(p) || p.nombre === valor; }).map(function(p){ return '<option value="' + esc(p.nombre) + '"' + (p.nombre === valor ? ' selected' : '') + '>' + esc(p.nombre) + '</option>'; }).join('') + '</select>'; }
function selUsuario(id, valor){ return '<select id="' + id + '"><option value="">Elegí…</option>' + usuariosActivos().map(function(u){ return '<option value="' + u.id + '"' + (u.id === valor ? ' selected' : '') + '>' + esc(nombreUsuario(u)) + '</option>'; }).join('') + '</select>'; }
function urlValida(u){ return !u || /^https?:\/\/\S+$/.test(u); }

/* RF-INV-01/02/03 */
function abrirProducto(p){
  if(!exigir('inventario:editar')) return;
  var nuevo = !p;
  p = p || {laboratorio: usuarioActual.laboratorio, tipo:'Aditivo', unidad:'kg', nfpa:{}};
  abrirDialogo({titulo: nuevo ? 'Registrar producto' : 'Editar ' + p.codigo, ancho:'grande', html:'<div class="pred-form">' +
    campo('Laboratorio', selLab('ip-lab', p.laboratorio)) + campo('Tipo', '<select id="ip-tipo">' + opcionesHtml(TIPOS_PRODUCTO, p.tipo) + '</select>') +
    campo('Nombre común', '<input type="text" id="ip-nom" value="' + esc(p.nombre || '') + '">') +
    campo('Material del diseño que representa', '<select id="ip-comp"><option value="">—</option>' + componentes.map(function(c){ return '<option' + (c.nombre === p.componente ? ' selected' : '') + '>' + esc(c.nombre) + '</option>'; }).join('') + '</select>') +
    campo('Tipo específico (ej. tipo de cemento)', '<input type="text" id="ip-tesp" value="' + esc(p.tipoEspecifico || '') + '">') +
    campo('Proveedor', '<select id="ip-prov">' + opcionesHtml(catalogo('proveedores'), p.proveedor, '—') + '</select>') +
    campo('Procedencia / cantera', '<input type="text" id="ip-proc" value="' + esc(p.procedencia || '') + '">') +
    campo('Precio por unidad (S/)', '<input type="text" inputmode="decimal" id="ip-precio" value="' + esc(p.precio || '') + '">') +
    campo('Unidad de medida', '<select id="ip-uni">' + opcionesHtml(['kg', 'g', 'L', 'mL', 'unidad'], p.unidad) + '</select>') +
    campo('Presentación (define stock bajo)', '<input type="text" inputmode="decimal" id="ip-pres" value="' + esc(p.presentacion || '') + '">') +
    campo('Stock mínimo (opcional)', '<input type="text" inputmode="decimal" id="ip-min" value="' + esc(p.cantidadMinima || '') + '">') +
    campo('Ficha técnica (Drive, PDF)', '<input type="url" id="ip-ft" value="' + esc(p.ft || '') + '">') + campo('MSDS (Drive, PDF)', '<input type="url" id="ip-msds" value="' + esc(p.msds || '') + '">') +
    campo('NFPA 704 salud / inflamab. / reactiv. (0–4)', '<input type="text" id="ip-nfpa" placeholder="2/0/0" value="' + esc(p.nfpa && p.nfpa.s !== undefined ? [p.nfpa.s, p.nfpa.i, p.nfpa.r].join('/') : '') + '">') +
    '</div><p class="campo-error" id="ip-err"></p>',
    botones:[{label:'Guardar', accion:function(c){
      var q = function(s){ return c.querySelector(s).value.trim(); };
      var d = {laboratorio:q('#ip-lab'), tipo:q('#ip-tipo'), nombre:q('#ip-nom'), componente:q('#ip-comp'), tipoEspecifico:q('#ip-tesp'), proveedor:q('#ip-prov'), procedencia:q('#ip-proc'),
        precio:parseNumero(q('#ip-precio')), unidad:q('#ip-uni'), presentacion:parseNumero(q('#ip-pres')), cantidadMinima:parseNumero(q('#ip-min')) || 0, ft:q('#ip-ft'), msds:q('#ip-msds')};
      var nf = q('#ip-nfpa');
      var err = '';
      if(!d.laboratorio || !d.tipo) err = 'Laboratorio y tipo son obligatorios.';
      else if(d.nombre.length < 2) err = 'El nombre común es obligatorio.';
      else if(!(d.precio >= 0)) err = 'El precio debe ser un número ≥ 0.';
      else if(!(d.presentacion > 0)) err = 'La presentación es obligatoria (> 0).';
      else if(!urlValida(d.ft) || !urlValida(d.msds)) err = 'FT y MSDS deben ser enlaces https://';
      else if(nf && !/^[0-4]\/[0-4]\/[0-4]$/.test(nf)) err = 'NFPA: tres valores de 0 a 4 (ej. 2/0/0).';
      if(err){ c.querySelector('#ip-err').textContent = err; return false; }
      if(nf){ var v = nf.split('/').map(Number); d.nfpa = {s:v[0], i:v[1], r:v[2]}; }
      if(nuevo){
        var pref = PREFIJO_PRODUCTO[d.tipo] || 'OTR';
        var max = productosInventario.filter(function(x){ return x.laboratorio === d.laboratorio && x.codigo.indexOf(pref) === 0; }).reduce(function(m, x){ return Math.max(m, parseInt(x.codigo.split('-').pop(), 10) || 0); }, 0);
        d.codigo = pref + '-' + d.laboratorio.split('-').pop().slice(0, 3) + '-' + pad4(max + 1);
        d.creado = Date.now(); d.creadoPor = usuarioActual.id;
        productosInventario.push(d);
      } else Object.assign(p, d);
      saveInv();
      registrarHistorial(nuevo ? 'Creó' : 'Editó', 'Producto', (d.codigo || p.codigo) + ' · ' + d.nombre);
      renderInventario();
    }}]});
}
/* RF-INV-04 */
function abrirIngresoLote(){
  if(!exigir('inventario:editar')) return;
  var prods = productosInventario.filter(function(p){ return veoLaboratorio(p.laboratorio); });
  if(!prods.length){ toast('Primero registrá un producto'); return; }
  abrirDialogo({titulo:'Ingreso de lote', html:'<div class="pred-form">' +
    campo('Producto', '<select id="il-prod">' + prods.map(function(p){ return '<option value="' + esc(p.codigo) + '">' + esc(p.codigo + ' · ' + p.nombre) + '</option>'; }).join('') + '</select>') +
    campo('Cantidad', '<input type="text" inputmode="decimal" id="il-cant">') + campo('Fecha de ingreso', '<input type="date" id="il-ing" max="' + todayISO() + '" value="' + todayISO() + '">') +
    campo('Vencimiento', '<input type="date" id="il-ven">') + campo('Responsable', selUsuario('il-resp', usuarioActual.id)) + '</div><p class="campo-error" id="il-err"></p>',
    botones:[{label:'Registrar ingreso', accion:function(c){
      var q = function(s){ return c.querySelector(s).value.trim(); };
      var l = {producto:q('#il-prod'), cantidad:parseNumero(q('#il-cant')), fechaIngreso:q('#il-ing'), vencimiento:q('#il-ven'), responsable:q('#il-resp')};
      var err = !(l.cantidad > 0) ? 'La cantidad debe ser mayor a 0.' : (!l.fechaIngreso || l.fechaIngreso > todayISO() ? 'La fecha de ingreso no puede ser futura.' : (l.vencimiento && l.vencimiento <= l.fechaIngreso ? 'El vencimiento debe ser posterior al ingreso.' : (!l.responsable ? 'El responsable es obligatorio.' : '')));
      if(err){ c.querySelector('#il-err').textContent = err; return false; }
      var n0 = lotesDeProducto(l.producto).length + 1;
      l.codigo = l.producto + '-L' + String(n0).padStart(3, '0');
      l.id = nuevoId('l'); l.ts = Date.now();
      lotesInventario.push(l);
      // Si había egresos pendientes de este producto, se avisa para resolverlos.
      if(egresosInventario.some(function(e){ return e.estado === 'Pendiente' && e.producto === l.producto; })) toast('Hay egresos pendientes de este producto: resolvelos en Egresos');
      saveInv();
      registrarHistorial('Ingresó', 'Lote', l.codigo + ' · ' + l.cantidad);
      renderInventario();
    }}]});
}
/* RF-INV-05: cantidad > 0 y ≤ stock del lote; proyecto de la lista; responsable obligatorio. */
function abrirEgresoManual(){
  if(!(puedeInv() || rolEs('ANA'))){ toast('Tu rol no registra egresos'); return; }
  var lotes = lotesInventario.filter(function(l){ var p = productoPorCodigo(l.producto); return p && veoLaboratorio(p.laboratorio) && stockLote(l) > 0; });
  if(!lotes.length){ toast('No hay lotes con stock'); return; }
  abrirDialogo({titulo:'Egreso manual', html:'<div class="pred-form">' +
    campo('Lote', '<select id="eg-lote">' + lotes.map(function(l){ var p = productoPorCodigo(l.producto); return '<option value="' + esc(l.codigo) + '">' + esc(l.codigo + ' · ' + p.nombre + ' · stock ' + fmt(stockLote(l), 2)) + (loteVencido(l) ? ' · VENCIDO' : '') + '</option>'; }).join('') + '</select>') +
    campo('Cantidad', '<input type="text" inputmode="decimal" id="eg-cant">') + campo('Proyecto', selProyecto('eg-proy', '')) +
    campo('Fecha', '<input type="date" id="eg-fecha" max="' + todayISO() + '" value="' + todayISO() + '">') + campo('Responsable', selUsuario('eg-resp', usuarioActual.id)) + '</div>' +
    campo('Observaciones', '<input type="text" id="eg-obs">') + '<p class="campo-error" id="eg-err"></p>',
    botones:[{label:'Registrar egreso', accion:function(c){
      var q = function(s){ return c.querySelector(s).value.trim(); };
      var l = lotesInventario.filter(function(x){ return x.codigo === q('#eg-lote'); })[0];
      var cant = parseNumero(q('#eg-cant'));
      var err = !(cant > 0) ? 'La cantidad debe ser mayor a 0.' : (cant > stockLote(l) + 1e-9 ? 'La cantidad supera el stock del lote (' + fmt(stockLote(l), 2) + ').' : (!q('#eg-proy') ? 'El proyecto es obligatorio.' : (!q('#eg-resp') ? 'El responsable es obligatorio.' : (q('#eg-fecha') > todayISO() ? 'La fecha no puede ser futura.' : ''))));
      if(err){ c.querySelector('#eg-err').textContent = err; return false; }
      if(loteVencido(l) && !confirm('El lote está vencido. ¿Registrar el egreso igual?')) return false;
      var p = productoPorCodigo(l.producto);
      var eg = nuevoEgreso(p, l.codigo, cant, q('#eg-proy'), null, null, 'Registrado');
      eg.fecha = q('#eg-fecha'); eg.responsable = q('#eg-resp'); eg.observaciones = q('#eg-obs');
      egresosInventario.push(eg);
      saveInv();
      registrarHistorial('Egresó', 'Inventario', p.nombre + ' · ' + fmt(cant, 2) + ' ' + (p.unidad || 'kg') + ' · lote ' + l.codigo, {proyecto: eg.proyecto});
      renderInventario();
    }}]});
}
function resolverEgresoPendiente(e){
  var disp = lotesFIFO(e.producto).reduce(function(a, l){ return a + stockLote(l); }, 0);
  if(disp < e.cantidad){ toast('Todavía falta stock: hay ' + fmt(disp, 2) + ' y se necesitan ' + fmt(e.cantidad, 2)); return; }
  var porTomar = e.cantidad, p = productoPorCodigo(e.producto);
  egresosInventario = egresosInventario.filter(function(x){ return x !== e; });
  lotesFIFO(e.producto).forEach(function(l){
    if(porTomar <= 0) return;
    var t = Math.min(stockLote(l), porTomar);
    var nuevo = Object.assign({}, e, {id: nuevoId('eg'), lote: l.codigo, cantidad: +t.toFixed(4), costo: +(t * n(p.precio)).toFixed(4), estado: 'Registrado', resuelto: Date.now()});
    egresosInventario.push(nuevo);
    porTomar -= t;
  });
  saveInv();
  registrarHistorial('Resolvió', 'Egreso pendiente', e.productoNombre + ' · ' + fmt(e.cantidad, 2), {proyecto: e.proyecto});
  renderInventario();
}
/* RF-INV-09 */
function exportarMovimientos(){
  if(!exigir('datos:exportar')) return;
  var ing = [['Fecha', 'Producto', 'Lote', 'Cantidad', 'Vencimiento', 'Responsable']].concat(lotesInventario.map(function(l){ var p = productoPorCodigo(l.producto) || {}; return [l.fechaIngreso, p.nombre, l.codigo, l.cantidad, l.vencimiento, nombreUsuario(usuarioPorId(l.responsable))]; }));
  var egr = [['Fecha', 'Producto', 'Lote', 'Cantidad', 'Unidad', 'Costo', 'Proyecto', 'Diseño', 'Réplica', 'Estado', 'Responsable']].concat(egresosInventario.map(function(e){ return [e.fecha, e.productoNombre, e.lote, e.cantidad, e.unidad, e.costo, e.proyecto, e.disenoCodigo, e.replica, e.estado, nombreUsuario(usuarioPorId(e.responsable))]; }));
  if(exportarExcel('Movimientos de inventario ' + todayISO() + '.xlsx', [{nombre:'Ingresos', filas:ing}, {nombre:'Egresos', filas:egr}])) registrarHistorial('Exportó', 'Inventario', 'Movimientos');
}
/* RF-EQU-01/02/06 */
function abrirEquipo(eq){
  if(!exigir('equipos:editar')) return;
  var nuevo = !eq;
  eq = eq || {laboratorio: usuarioActual.laboratorio, categoria:'Prensa', estado:'Habilitado', calibraciones:[], frecuenciaMeses:12, modalidad:'Externa'};
  abrirDialogo({titulo: nuevo ? 'Registrar equipo' : 'Editar ' + eq.nombre, ancho:'grande', html:'<div class="pred-form">' +
    campo('Categoría', '<select id="eq-cat">' + opcionesHtml(CATEGORIAS_EQUIPO, eq.categoria) + '</select>') + campo('Laboratorio', selLab('eq-lab', eq.laboratorio)) +
    campo('Nombre', '<input type="text" id="eq-nom" value="' + esc(eq.nombre || '') + '">') + campo('Identificación metrológica (única)', '<input type="text" id="eq-id" value="' + esc(eq.identificacion || '') + '">') +
    campo('Marca', '<input type="text" id="eq-marca" value="' + esc(eq.marca || '') + '">') + campo('Modelo', '<input type="text" id="eq-modelo" value="' + esc(eq.modelo || '') + '">') +
    campo('Serie', '<input type="text" id="eq-serie" value="' + esc(eq.serie || '') + '">') +
    campo('Rango mínimo', '<input type="text" inputmode="decimal" id="eq-rmin" value="' + esc(eq.rangoMin || '') + '">') + campo('Rango máximo', '<input type="text" inputmode="decimal" id="eq-rmax" value="' + esc(eq.rangoMax || '') + '">') +
    campo('Frecuencia de calibración (meses)', '<input type="number" min="0" id="eq-frec" value="' + esc(eq.frecuenciaMeses) + '">') +
    campo('Calibración interna / externa', '<select id="eq-mod">' + opcionesHtml(['Interna', 'Externa'], eq.modalidad) + '</select>') +
    campo('Estado', '<select id="eq-est">' + opcionesHtml(ESTADOS_EQUIPO, eq.estado) + '</select>') + campo('Prestado a (si aplica)', '<input type="text" id="eq-prest" value="' + esc(eq.prestadoA || '') + '">') +
    campo('Encargado', selUsuario('eq-enc', eq.encargado)) + '</div><p class="campo-error" id="eq-err"></p>',
    botones:[{label:'Guardar', accion:function(c){
      var q = function(s){ return c.querySelector(s).value.trim(); };
      var d = {categoria:q('#eq-cat'), laboratorio:q('#eq-lab'), nombre:q('#eq-nom'), identificacion:q('#eq-id').toUpperCase(), marca:q('#eq-marca'), modelo:q('#eq-modelo'), serie:q('#eq-serie'),
        rangoMin:q('#eq-rmin'), rangoMax:q('#eq-rmax'), frecuenciaMeses:Number(q('#eq-frec')) || 0, modalidad:q('#eq-mod'), estado:q('#eq-est'), prestadoA:q('#eq-prest'), encargado:q('#eq-enc')};
      var err = !d.categoria || !d.laboratorio || d.nombre.length < 2 || !d.identificacion ? 'Categoría, laboratorio, nombre e identificación son obligatorios.' :
        (equiposInventario.some(function(x){ return x !== eq && normalizar(x.identificacion) === normalizar(d.identificacion); }) ? 'Ya existe un equipo con esa identificación.' :
        (d.rangoMin !== '' && d.rangoMax !== '' && !(parseNumero(d.rangoMin) < parseNumero(d.rangoMax)) ? 'El rango mínimo debe ser menor que el máximo.' : (d.estado === 'Prestado' && !d.prestadoA ? 'Indicá a quién se prestó.' : '')));
      if(err){ c.querySelector('#eq-err').textContent = err; return false; }
      if(nuevo){ d.id = nuevoId('eq'); d.calibraciones = []; d.ts = Date.now(); equiposInventario.push(d); }
      else { if(eq.estado !== d.estado) d.historialEstados = (eq.historialEstados || []).concat([{ts:Date.now(), de:eq.estado, a:d.estado, usuario:usuarioActual.id}]); Object.assign(eq, d); }
      saveInv();
      registrarHistorial(nuevo ? 'Creó' : 'Editó', 'Equipo', d.identificacion + ' · ' + d.nombre + ' · ' + d.estado);
      renderInventario();
    }}]});
}
function registrarCalibracion(eq){
  if(!exigir('equipos:editar')) return;
  abrirDialogo({titulo:'Calibración de ' + eq.nombre, html:'<div class="pred-form">' + campo('Fecha de calibración', '<input type="date" id="ca-fecha" max="' + todayISO() + '" value="' + todayISO() + '">') +
    campo('Certificado (enlace PDF en Drive)', '<input type="url" id="ca-cert">') + '</div><p class="campo-error" id="ca-err"></p>',
    botones:[{label:'Registrar', accion:function(c){
      var f = c.querySelector('#ca-fecha').value, cert = c.querySelector('#ca-cert').value.trim();
      if(!f || f > todayISO()){ c.querySelector('#ca-err').textContent = 'Fecha obligatoria y no futura.'; return false; }
      if(!urlValida(cert)){ c.querySelector('#ca-err').textContent = 'El certificado debe ser un enlace https://'; return false; }
      eq.calibraciones = (eq.calibraciones || []).concat([{fecha:f, certificado:cert, usuario:usuarioActual.id, ts:Date.now()}]);
      saveInv();
      registrarHistorial('Calibró', 'Equipo', eq.identificacion + ' · ' + isoToDMY(f));
      renderInventario();
    }}]});
}
/* RF-MUE-01/02/03 */
function abrirMuestra(m){
  if(!(puedeInv() || rolEs('ANA'))){ toast('Tu rol no registra muestras'); return; }
  var nueva = !m;
  m = m || {laboratorio: usuarioActual.laboratorio, fechaIngreso: todayISO(), estado:'Pendiente', disenos:[]};
  var tres = function(f){ var d = new Date(f + 'T00:00:00'); d.setMonth(d.getMonth() + 3); return isoDe(d); };
  abrirDialogo({titulo: nueva ? 'Registrar muestra' : 'Muestra ' + m.codigo, ancho:'grande', html:'<div class="pred-form">' +
    campo('Código', '<input type="text" id="mu-cod" value="' + esc(m.codigo || '') + '"' + (nueva ? '' : ' disabled') + '>') + campo('Trazabilidad', '<input type="text" id="mu-traz" value="' + esc(m.trazabilidad || '') + '"' + (nueva ? '' : ' disabled') + '>') +
    campo('Descripción', '<input type="text" id="mu-desc" value="' + esc(m.descripcion || '') + '">') + campo('Material', '<input type="text" id="mu-mat" value="' + esc(m.material || '') + '">') +
    campo('Ubicación', '<input type="text" id="mu-ubi" value="' + esc(m.ubicacion || '') + '">') + campo('Laboratorio', selLab('mu-lab', m.laboratorio)) +
    campo('Fecha de ingreso', '<input type="date" id="mu-ing" max="' + todayISO() + '" value="' + esc(m.fechaIngreso) + '">') +
    campo('Bolsas', '<input type="number" min="0" id="mu-bol" value="' + esc(m.bolsas || 1) + '">') + campo('Peso por bolsa (kg)', '<input type="text" inputmode="decimal" id="mu-peso" value="' + esc(m.pesoBolsa || '') + '">') +
    campo('Descarte (ingreso + 3 meses)', '<input type="date" id="mu-desc-f" value="' + esc(m.fechaDescarte || tres(m.fechaIngreso)) + '">') +
    campo('Proyecto', selProyecto('mu-proy', m.proyecto, 'Sin proyecto')) + campo('Estado', '<select id="mu-est">' + opcionesHtml(ESTADOS_MUESTRA, m.estado) + '</select>') + '</div>' +
    campo('Diseños vinculados (códigos DID separados por coma)', '<input type="text" id="mu-dis" value="' + esc((m.disenos || []).join(', ')) + '">') + '<p class="campo-error" id="mu-err"></p>',
    botones:[{label:'Guardar', accion:function(c){
      var q = function(s){ return c.querySelector(s).value.trim(); };
      var d = {codigo:q('#mu-cod').toUpperCase(), trazabilidad:q('#mu-traz'), descripcion:q('#mu-desc'), material:q('#mu-mat'), ubicacion:q('#mu-ubi'), laboratorio:q('#mu-lab'), fechaIngreso:q('#mu-ing'),
        bolsas:Number(q('#mu-bol')) || 0, pesoBolsa:parseNumero(q('#mu-peso')), fechaDescarte:q('#mu-desc-f'), proyecto:q('#mu-proy'), estado:q('#mu-est'),
        disenos:q('#mu-dis').split(',').map(function(s){ return s.trim().toUpperCase(); }).filter(Boolean)};
      var err = '';
      if(nueva && (!d.codigo || !d.trazabilidad)) err = 'Código y trazabilidad son obligatorios.';
      else if(nueva && muestrasInventario.some(function(x){ return normalizar(x.codigo) === normalizar(d.codigo) || normalizar(x.trazabilidad) === normalizar(d.trazabilidad); })) err = 'El código y la trazabilidad deben ser únicos.';
      else if(!d.descripcion || !d.material || !d.ubicacion || !d.fechaIngreso) err = 'Descripción, material, ubicación y fecha de ingreso son obligatorios.';
      else if(d.fechaIngreso > todayISO()) err = 'La fecha de ingreso no puede ser futura.';
      else if(!(d.pesoBolsa > 0)) err = 'El peso por bolsa debe ser mayor a 0.';
      else if(d.disenos.some(function(cod){ return !disenoPorCodigo(cod); })) err = 'Hay códigos de diseño que no existen.';
      if(err){ c.querySelector('#mu-err').textContent = err; return false; }
      if(nueva){ d.id = nuevoId('mu'); d.seguimiento = [{estado:'Pendiente', ts:Date.now(), usuario:usuarioActual.id}]; muestrasInventario.push(d); }
      else { if(m.estado !== d.estado) d.seguimiento = (m.seguimiento || []).concat([{estado:d.estado, ts:Date.now(), usuario:usuarioActual.id}]); delete d.codigo; delete d.trazabilidad; Object.assign(m, d); }
      saveInv();
      registrarHistorial(nueva ? 'Registró' : 'Editó', 'Muestra', (d.codigo || m.codigo) + ' · ' + d.estado, {proyecto: d.proyecto});
      renderInventario();
    }}]});
}
/* RF-ENV-01/02 */
function abrirEnvio(){
  if(!(puedeInv() || rolEs('ANA'))) return;
  abrirDialogo({titulo:'Registrar envío', html:'<div class="pred-form">' +
    campo('Tipo', '<select id="en-tipo">' + opcionesHtml(['Producto', 'Muestra', 'Equipo'], 'Producto') + '</select>') +
    campo('Qué se envía', '<input type="text" id="en-item" placeholder="Código o descripción">') +
    campo('Sale de', selLab('en-sal', usuarioActual.laboratorio)) + campo('Destino', '<select id="en-des">' + catalogo('laboratorios').map(function(l){ return '<option value="' + esc(l) + '">' + esc(labLabel(l)) + '</option>'; }).join('') + '</select>') +
    campo('Remitente', selUsuario('en-rem', usuarioActual.id)) + campo('Receptor', selUsuario('en-rec', '')) +
    campo('Cantidad total', '<input type="text" inputmode="decimal" id="en-tot">') + campo('Proyecto (opcional)', selProyecto('en-proy', '', 'Sin proyecto')) + '</div><p class="campo-error" id="en-err"></p>',
    botones:[{label:'Registrar', accion:function(c){
      var q = function(s){ return c.querySelector(s).value.trim(); };
      var x = {id:nuevoId('env'), tipo:q('#en-tipo'), item:q('#en-item'), salida:q('#en-sal'), destino:q('#en-des'), remitente:q('#en-rem'), receptor:q('#en-rec'), total:parseNumero(q('#en-tot')), proyecto:q('#en-proy'), estado:'Registrado', ts:Date.now(), historial:[]};
      var err = !x.item ? 'Indicá qué se envía.' : (x.salida === x.destino ? 'La salida y el destino deben ser distintos.' : (!x.remitente || !x.receptor ? 'Remitente y receptor son obligatorios.' : (!(x.total > 0) ? 'La cantidad debe ser mayor a 0.' : '')));
      if(!err && x.tipo === 'Producto'){ var p = productoPorCodigo(x.item.toUpperCase()); if(p && x.total > stockProducto(p.codigo)) err = 'La cantidad supera el stock del producto (' + fmt(stockProducto(p.codigo), 2) + ').'; }
      if(err){ c.querySelector('#en-err').textContent = err; return false; }
      enviosInventario.push(x);
      saveInv();
      notificarUsuario(x.receptor, 'Envío registrado para vos', x.item + ' desde ' + labLabel(x.salida), 'inventario');
      registrarHistorial('Registró', 'Envío', x.item + ' · ' + labLabel(x.salida) + ' → ' + labLabel(x.destino), {proyecto: x.proyecto});
      renderInventario();
    }}]});
}
function avanzarEnvio(x){
  var sig = ESTADOS_ENVIO[ESTADOS_ENVIO.indexOf(x.estado) + 1];
  if(!sig) return;
  var aplicar = function(foto){
    x.historial = (x.historial || []).concat([{de:x.estado, a:sig, ts:Date.now(), usuario:usuarioActual.id}]);
    x.estado = sig; if(foto) x.foto = foto;
    saveInv();
    if(sig === 'Enviado') notificarUsuario(x.receptor, 'Envío en camino', x.item + ' desde ' + labLabel(x.salida), 'inventario');
    registrarHistorial('Actualizó', 'Envío', x.item + ' · ' + sig);
    renderInventario();
  };
  if(sig === 'Recepcionado'){
    abrirDialogo({titulo:'Confirmar recepción', html:campo('Foto de la recepción (enlace en Drive)', '<input type="url" id="en-foto">') + '<p class="campo-error" id="en-ferr"></p>',
      botones:[{label:'Confirmar', accion:function(c){ var f = c.querySelector('#en-foto').value.trim(); if(!/^https?:\/\//.test(f)){ c.querySelector('#en-ferr').textContent = 'El receptor confirma con una foto (enlace).'; return false; } aplicar(f); }}]});
  } else aplicar('');
}
PANEL_HOOKS.inventario = function(){ renderInventario(); };
