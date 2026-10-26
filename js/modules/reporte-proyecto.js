/* Sistema I+D — Reporte detallado del proyecto (5.5, RF-PRY-15).
   Se arma solo con lo registrado en el sistema. Se genera aunque falten datos, pero marca en rojo cada
   sección incompleta. El reporte final (para cerrar el proyecto) exige iteraciones cerradas y conclusión. */
'use strict';

function seccionReporte(titulo, cuerpo, completa, nota){
  return '<section class="rp-sec' + (completa ? '' : ' incompleta') + '"><h2>' + esc(titulo) + (completa ? '' : ' <span class="rp-falta">Incompleta' + (nota ? ': ' + esc(nota) : '') + '</span>') + '</h2>' + cuerpo + '</section>';
}
function tablaReporte(cab, filas){
  return '<table><thead><tr>' + cab.map(function(c){ return '<th>' + esc(c) + '</th>'; }).join('') + '</tr></thead><tbody>' +
    (filas.length ? filas.map(function(f){ return '<tr>' + f.map(function(v){ return '<td>' + (v === undefined || v === null ? '' : v) + '</td>'; }).join('') + '</tr>'; }).join('') : '<tr><td colspan="' + cab.length + '">Sin datos registrados.</td></tr>') + '</tbody></table>';
}
/* El mejor diseño cumple el criterio de éxito con el menor costo por m³. */
function mejorDisenoProyecto(p, lista){
  var fcMin = n(p.criterioFc), costoMax = n(p.criterioCosto);
  var candidatos = lista.filter(function(d){
    var r28 = resistenciaPorEdad(d)[28];
    var okFc = fcMin ? isFinite(r28) && r28 >= fcMin : isFinite(r28) && r28 >= n(d.fc);
    var okCosto = !costoMax || (n(d.cvdTotal) && n(d.cvdTotal) <= costoMax);
    return okFc && okCosto && n(d.cvdTotal) > 0;
  });
  candidatos.sort(function(a, b){ return n(a.cvdTotal) - n(b.cvdTotal); });
  return candidatos[0] || null;
}
function contenidoReporteProyecto(p, version, final){
  var m = metricasProyecto(p.nombre);
  var sem = semaforoProyecto(p.nombre);
  var costo = costoProyecto(p.nombre);
  var incompletas = [];
  var sec = function(titulo, cuerpo, completa, nota){ if(!completa) incompletas.push(titulo); return seccionReporte(titulo, cuerpo, completa, nota); };
  var resp = usuarioPorId(p.responsable);
  var dr = diasRestantes(p);
  var html = '';
  // 1. Portada
  html += '<header class="rp-portada"><div class="rp-kicker">Reporte ' + (final ? 'final' : 'de avance') + ' del proyecto · v' + version + '</div>' +
    '<h1>' + esc(p.nombre) + '</h1><p class="rp-codigo">' + esc(p.codigo) + '</p>' +
    tablaReporte(['Laboratorio', 'Equipo', 'Responsable', 'Inicio', 'Fin planificado', 'Estado', 'Semáforo'],
      [[esc(labLabel(p.laboratorio)), esc(p.equipoLider + ((p.equiposApoyo || []).length ? ' (apoyo: ' + p.equiposApoyo.join(', ') + ')' : '')), esc(nombreUsuario(resp)), isoToDMY(p.fechaInicio), isoToDMY(p.fechaFin), esc(p.estado), esc(sem.color + ' — ' + sem.motivos.join(', '))]]) +
    '<p class="rp-fecha">Generado el ' + fechaHora(Date.now()) + ' por ' + esc(nombreUsuario(usuarioActual)) + '</p></header>';
  // 2. Resumen ejecutivo
  html += sec('Resumen ejecutivo', '<p><b>Objetivo:</b> ' + esc(p.objetivo || '—') + '</p><p><b>Criterio de éxito:</b> ' + esc(p.hipotesis || '—') + '</p>' +
    '<p><b>Conclusión:</b> ' + esc(p.conclusion || '—') + '</p><p><b>Recomendación:</b> ' + esc(p.recomendacion || '—') + '</p>',
    p.objetivo && p.conclusion, !p.conclusion ? 'falta la conclusión del responsable' : 'falta el objetivo');
  // 3. Indicadores
  var fuera = m.cargas.filter(function(c){ return c.fueraTolerancia; }).length;
  html += sec('Indicadores', tablaReporte(['Diseños totales', 'Completados', 'Avance', 'Roturas registradas / programadas', 'Fuera de tolerancia', 'Días de atraso', 'Costo vs presupuesto'],
    [[m.nDisenos, m.completados, m.avancePct + '%', m.cargasCompletas + ' / ' + m.cargas.length, fuera, dr !== null && dr < 0 ? -dr : 0,
      'S/ ' + fmt(costo.total, 2) + (n(p.presupuesto) ? ' / S/ ' + fmt(n(p.presupuesto), 2) : ' (sin presupuesto)')]]), m.nDisenos > 0, 'sin diseños');
  // 4. Por iteración
  var iters = iteracionesDeProyecto(p.nombre).slice();
  m.iteraciones.forEach(function(it){ if(iters.indexOf(it) === -1) iters.push(it); });
  iters.sort(function(a, b){ return ordenIteracion(a) - ordenIteracion(b); });
  var cuerpoIter = iters.map(function(it){
    var info = infoIteracion(p.nombre, it);
    var lista = m.disenos.filter(function(d){ return d.iteracionId === it; });
    return '<h3>' + esc(it) + (info.cerrada ? ' (cerrada)' : ' (abierta)') + '</h3><p><b>Objetivo:</b> ' + esc(info.objetivo || '—') + (info.conclusion ? '<br><b>Conclusión:</b> ' + esc(info.conclusion) : '') + '</p>' +
      lista.map(function(d){
        var r = resistenciaPorEdad(d), comb = nombreUnificadoPromedio(d);
        var edades = Object.keys(r).map(Number).sort(function(a, b){ return a - b; });
        var reps = replicasDe(d);
        var fresco = reps.map(function(rep, i){
          var res = (d.resultados && d.resultados.replicas || [])[i] || {};
          var s0 = (res.slump || [])[0] || {};
          return [esc(rep.nombre), esc(estadoReplica(d, rep)), esc(s0.slump || '-'), esc(res.pesoUnitario || '-'), esc(res.aire || '-'), esc((res.thermoIni || '-') + ' / ' + (res.thermoFin || '-')),
            esc(rep.elaboracion && rep.elaboracion.desviaciones && rep.elaboracion.desviaciones.length ? rep.elaboracion.desviaciones.join('; ') : '—')];
        });
        return '<h4>' + esc(d.codigo + ' · ' + diseñoTitulo(d)) + ' — v' + (d.version || 1) + ' · ' + esc(d.estado) + '</h4>' +
          '<p>f\'c ' + esc(d.fc || '-') + ' kg/cm² · a/mc ' + esc(d.amcEfectiva || '-') + ' · CVD S/ ' + fmt(n(d.cvdTotal), 2) + '/m³</p>' +
          ((d.mix || []).length ? tablaReporte(['Material', 'Dosis (kg/m³)'], d.mix.filter(function(it){ return n(it.pesoSeco); }).map(function(it){ return [esc(it.nombre), fmt(n(it.pesoSeco), 2)]; })) : '') +
          tablaReporte(['Réplica', 'Estado', 'Slump 0\'', 'P.U.', 'Aire %', 'Fragua ini/fin', 'Ajustes de dosis'], fresco) +
          tablaReporte(['Edad (d)', 'Promedio R1+R2… (kg/cm²)', 'CV', 'Cumple f\'c'], edades.map(function(e){
            var st = comb[e] || {};
            return [e, fmt(r[e], 1), esc(st.coefVar || '-'), e >= 28 && n(d.fc) ? (r[e] >= n(d.fc) ? 'Sí' : '<b class="rojo">No</b>') : '—'];
          }));
      }).join('');
  }).join('');
  html += sec('Por iteración', cuerpoIter || '<p>Sin iteraciones.</p>', iters.length > 0 && iters.every(function(it){ return iteracionCerrada(p.nombre, it); }), 'hay iteraciones abiertas');
  // 5. Comparativos (tabla; los gráficos están en el expediente)
  var comp = m.disenos.map(function(d){
    var r = resistenciaPorEdad(d);
    var res0 = (d.resultados && d.resultados.replicas || [])[0] || {};
    return [esc(d.codigo), esc(d.amcEfectiva || '-'), fmt(r[7], 1), fmt(r[28], 1), fmt(n(d.cvdTotal), 2), esc(((res0.slump || [])[0] || {}).slump || '-'), esc((res0.thermoIni || '-') + ' / ' + (res0.thermoFin || '-'))];
  });
  html += sec('Comparativos', tablaReporte(['Diseño', 'a/mc', 'f 7 d', 'f 28 d', 'S/ por m³', 'Slump 0\'', 'Fragua ini/fin'], comp), comp.some(function(f){ return f[3] !== '-'; }), 'sin resultados a 28 días');
  // 6. Mejor diseño
  var mejor = mejorDisenoProyecto(p, m.disenos);
  html += sec('Mejor diseño', mejor ? '<p class="rp-mejor">★ <b>' + esc(mejor.codigo + ' · ' + diseñoTitulo(mejor)) + '</b>: ' + fmt(resistenciaPorEdad(mejor)[28], 1) + ' kg/cm² a 28 d con S/ ' + fmt(n(mejor.cvdTotal), 2) + ' por m³.</p>' : '<p>Ningún diseño cumple todavía el criterio de éxito.</p>',
    !!mejor, !p.criterioFc ? 'definí el criterio de éxito en la ficha' : 'ningún diseño cumple');
  // 7. Materiales consumidos
  var egresos = (typeof egresosInventario !== 'undefined' ? egresosInventario : []).filter(function(e){ return e.proyecto === p.nombre; });
  html += sec('Materiales consumidos', tablaReporte(['Producto', 'Lote', 'Cantidad', 'Costo (S/)'], egresos.map(function(e){ return [esc(e.producto), esc(e.lote || 'FIFO'), fmt(e.cantidad, 2) + ' ' + esc(e.unidad || 'kg'), fmt(e.costo, 2)]; })) +
    '<p>Costo de diseños: S/ ' + fmt(costo.disenos, 2) + ' · consumo de inventario: S/ ' + fmt(costo.egresos, 2) + '</p>', egresos.length > 0, 'sin egresos de inventario registrados');
  // 8. Equipos usados
  var prensas = {};
  m.cargas.forEach(function(c){ if(c.prensa) prensas[c.prensa.id] = c.prensa; });
  var listaPrensas = Object.keys(prensas).map(function(k){ return prensas[k]; });
  html += sec('Equipos usados', tablaReporte(['Equipo', 'Identificación', 'Calibración vigente al ensayo'], listaPrensas.map(function(x){ return [esc(x.nombre), esc(x.identificacion || ''), isoToDMY(x.calibracion || '')]; })),
    listaPrensas.length > 0, 'las roturas no registran prensa');
  // 9. Desviaciones
  var desv = [];
  m.cargas.forEach(function(c){
    if(c.fueraTolerancia) desv.push([esc(c.codigo + ' ' + c.dia + ' d'), 'Rotura fuera de ventana', esc(c.motivoFueraTolerancia || '')]);
    if(c.estado === 'no-ubicada') desv.push([esc(c.codigo + ' ' + c.dia + ' d'), 'Probeta no ubicada', esc(c.comentarios || '')]);
    if(c.alertaDispersion) desv.push([esc(c.codigo + ' ' + c.dia + ' d'), 'Dispersión alta', esc(c.comentarioDispersion || '')]);
    (c.invalidaciones || []).forEach(function(iv){ desv.push([esc(c.codigo + ' ' + c.dia + ' d'), 'Invalidado ' + esc(iv.especimen), esc(iv.motivo)]); });
    (c.correcciones || []).forEach(function(cr){ desv.push([esc(c.codigo + ' ' + c.dia + ' d'), 'Corrección', esc(cr.motivo)]); });
  });
  m.disenos.forEach(function(d){
    replicasDe(d).forEach(function(rep){ if(rep.elaboracion && (rep.elaboracion.desviaciones || []).length) desv.push([esc(rep.nombre), 'Ajuste de dosificación', esc(rep.elaboracion.desviaciones.join('; '))]); if(rep.desmolde && rep.desmolde.fueraVentana) desv.push([esc(rep.nombre), 'Desmolde fuera de ventana', esc(rep.desmolde.comentario || '')]); });
    (d.versiones || []).forEach(function(v){ desv.push([esc(d.codigo), 'Receta v' + v.version + ' → v' + (v.aVersion || v.version + 1), esc(v.motivo)]); });
  });
  html += sec('Desviaciones', tablaReporte(['Registro', 'Tipo', 'Motivo / comentario'], desv), true);
  // 10. Bitácora y evidencias
  var notas = bitacora.filter(function(b){ return b.proyecto === p.nombre; }).slice(0, 15);
  var evid = evidenciasDeProyecto(p.nombre);
  html += sec('Bitácora y evidencias', notas.map(function(b){ return '<p><b>' + isoToDMY(b.fecha) + ' · ' + esc(nombreUsuario(usuarioPorId(b.autor))) + ':</b> ' + esc(b.texto) + '</p>'; }).join('') +
    '<p>' + evid.length + ' fotos de evidencia en el expediente.</p>', notas.length > 0, 'sin notas de bitácora');
  // 11. Anexos
  var rrs = rrDeProyecto(p.nombre, m.disenos);
  var normas = {};
  m.disenos.forEach(function(d){ (d.normasAplicadas || []).forEach(function(nm){ normas[nm] = true; }); });
  html += sec('Anexos', '<p><b>Reportes RR:</b> ' + (rrs.length ? rrs.map(function(e){ return esc((e.codigo ? e.codigo + ' ' : '') + e.nombre + (e.emitido ? ' (emitido)' : ' (borrador)')); }).join(', ') : '—') + '</p>' +
    '<p><b>Normas aplicadas:</b> ' + (Object.keys(normas).length ? esc(Object.keys(normas).join(', ')) : 'NTP 339.034 (compresión), NTP 339.183 (elaboración y curado)') + '</p>', rrs.length > 0, 'sin RR generados');
  return {html: html, incompletas: incompletas};
}

function generarReporteProyecto(p, final){
  if(!exigir('reporte:generar')) return;
  if(final){
    var abiertas = iteracionesDeProyecto(p.nombre).filter(function(it){ return !iteracionCerrada(p.nombre, it); });
    if(abiertas.length){ toast('Para el reporte final cerrá primero las iteraciones: ' + abiertas.join(', ')); return; }
  }
  abrirDialogo({titulo: final ? 'Reporte final del proyecto' : 'Reporte de avance', ancho:'grande',
    html: '<p class="nota-sm">Texto del responsable para el resumen ejecutivo.' + (final ? ' En el reporte final la conclusión es obligatoria.' : '') + '</p>' +
      campo('Conclusión', '<textarea id="rp-conc" rows="4">' + esc(p.conclusion || '') + '</textarea>') +
      campo('Recomendación', '<textarea id="rp-rec" rows="3">' + esc(p.recomendacion || '') + '</textarea>') + '<p class="campo-error" id="rp-err"></p>',
    botones:[{label:'Generar', accion:function(c){
      var conc = c.querySelector('#rp-conc').value.trim(), rec = c.querySelector('#rp-rec').value.trim();
      if(final && conc.length < 20){ c.querySelector('#rp-err').textContent = 'El reporte final exige una conclusión escrita (mín. 20 caracteres).'; return false; }
      if(proyectoAbierto(p)){ p.conclusion = conc; p.recomendacion = rec; saveProyectos(); }
      var version = reportesProyecto.filter(function(r){ return r.proyecto === p.nombre; }).length + 1;
      var r = contenidoReporteProyecto(p, version, final);
      var rep = {id: nuevoId('rp'), proyecto: p.nombre, codigoProyecto: p.codigo, version: version, final: !!final, ts: Date.now(), autor: usuarioActual.id, incompletas: r.incompletas, html: r.html};
      reportesProyecto.push(rep);
      saveReportesProyecto();
      registrarHistorial('Generó', 'Reporte de proyecto', p.codigo + ' v' + version + (final ? ' (final)' : '') + (r.incompletas.length ? ' · incompletas: ' + r.incompletas.join(', ') : ''), {proyecto: p.nombre});
      verReporteProyecto(rep);
      if(typeof renderExpediente === 'function' && expedienteProyecto === p.nombre) renderExpediente();
    }}]});
}
var ESTILO_REPORTE = 'body{font-family:Inter,Arial,sans-serif;color:#14181a;margin:28px;font-size:12px;}h1{font-size:24px;margin:4px 0;}h2{font-size:15px;border-bottom:2px solid #0396c8;padding-bottom:4px;margin-top:22px;}' +
  'h3{font-size:13px;margin:14px 0 4px;}h4{font-size:12px;margin:10px 0 4px;}table{border-collapse:collapse;width:100%;margin:6px 0;}th,td{border:1px solid #cfd8dc;padding:4px 6px;text-align:left;font-size:11px;}th{background:#e6f6fb;}' +
  '.rp-kicker{color:#2e9e57;font-weight:700;text-transform:uppercase;letter-spacing:.08em;font-size:11px;}.rp-codigo{font-family:monospace;color:#555;}.rp-fecha{color:#666;font-size:11px;}' +
  '.rp-sec.incompleta h2{color:#dc2626;border-color:#dc2626;}.rp-falta{font-size:11px;background:#fee2e2;color:#b91c1c;padding:2px 6px;border-radius:4px;margin-left:6px;}.rp-mejor{background:#ecfdf3;padding:8px;border-radius:6px;}.rojo{color:#dc2626;}' +
  '@media print{body{margin:12mm;} .no-print{display:none;}}';
function verReporteProyecto(rep){
  if(!rep) return;
  var w = window.open('', '_blank');
  if(!w){ toast('Permití las ventanas emergentes para ver el reporte'); return; }
  w.document.write('<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Reporte ' + esc(rep.codigoProyecto) + ' v' + rep.version + '</title><style>' + ESTILO_REPORTE + '</style></head><body>' +
    '<div class="no-print" style="margin-bottom:12px;"><button onclick="window.print()">Imprimir / guardar como PDF</button></div>' + rep.html + '</body></html>');
  w.document.close();
}
