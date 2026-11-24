/* Sistema I+D — Conexión con el servidor (Cloudflare Workers + D1).
   Sin servidor configurado, el sistema trabaja en este navegador (modo local).
   Con servidor: el login, los usuarios, el personal y la configuración del laboratorio viven en D1; los permisos
   se verifican allá. Si una escritura falla por falta de red, queda en una cola y se reintenta sola: el técnico
   no se bloquea. Los errores de validación (motivo faltante, sin permiso) se muestran y no se reintentan. */
'use strict';

var Nube = (function(){
  var cfg = load('sid_nube', {url:''});
  var cola = load('sid_nube_cola', []);
  var token = sessionStorage.getItem('sid_nube_token') || '';
  var reintentoTimer = null;

  function url(){ return String(cfg.url || '').replace(/\/+$/, ''); }
  function activa(){ return !!url(); }
  function guardarCola(){ save('sid_nube_cola', cola); actualizarIndicador(); }
  function setToken(t){ token = t || ''; if(t) sessionStorage.setItem('sid_nube_token', t); else sessionStorage.removeItem('sid_nube_token'); }

  /* Petición a la API. Rechaza con {estado, mensaje, red:true} si no hubo respuesta. */
  function pedir(metodo, ruta, cuerpo, opciones){
    opciones = opciones || {};
    var base = opciones.url !== undefined ? String(opciones.url).replace(/\/+$/, '') : url();
    var h = {'Content-Type':'application/json'};
    if(token && !opciones.sinToken) h.Authorization = 'Bearer ' + token;
    return fetch(base + ruta, {method:metodo, headers:h, body: cuerpo ? JSON.stringify(cuerpo) : undefined, cache:'no-store'})
      .then(function(r){
        return r.json().catch(function(){ return {}; }).then(function(d){
          if(r.ok) return d;
          if(r.status === 401 && token && !opciones.sinToken) sesionVencida();
          throw {estado:r.status, mensaje:(d && d.error) || ('Error ' + r.status)};
        });
      }, function(){ throw {estado:0, mensaje:'Sin conexión con el servidor', red:true}; });
  }

  /* Escritura con cola de reintento: se intenta ya; si no hay red queda pendiente. */
  function enviar(metodo, ruta, cuerpo){
    if(!activa()) return Promise.resolve(null);
    return pedir(metodo, ruta, cuerpo).catch(function(e){
      if(e.red){
        cola.push({id:'q' + Date.now() + Math.random().toString(36).slice(2,6), metodo:metodo, ruta:ruta, cuerpo:cuerpo, intentos:0, ts:Date.now()});
        guardarCola();
        programarReintento();
        toast('Sin conexión: el cambio se guardó y se enviará solo');
        return null;
      }
      toast(e.mensaje);
      throw e;
    });
  }
  function procesarCola(){
    if(!activa() || !cola.length || !token) return;
    var item = cola[0];
    pedir(item.metodo, item.ruta, item.cuerpo).then(function(){
      cola.shift(); guardarCola(); procesarCola();
    }, function(e){
      if(e.red){ item.intentos++; guardarCola(); programarReintento(); return; }
      // Rechazo del servidor (validación o permiso): se descarta y queda constancia local
      cola.shift(); guardarCola();
      registrarHistorial('Rechazó', 'Sincronización', item.metodo + ' ' + item.ruta + ': ' + e.mensaje, {local:true});
      toast('El servidor rechazó un cambio pendiente: ' + e.mensaje);
      procesarCola();
    });
  }
  function programarReintento(){ clearTimeout(reintentoTimer); reintentoTimer = setTimeout(procesarCola, 30000); }
  window.addEventListener('online', function(){ procesarCola(); });

  function actualizarIndicador(){
    var el = document.getElementById('nube-estado');
    if(!el) return;
    if(!activa()){ el.innerHTML = '<span class="nube-pill local">Modo local · los datos viven en este navegador</span>'; return; }
    el.innerHTML = '<span class="nube-pill ' + (cola.length ? 'pend' : 'ok') + '">Servidor conectado' + (cola.length ? ' · ' + cola.length + ' cambio(s) por enviar' : '') + '</span>';
  }

  function sesionVencida(){
    setToken('');
    if(typeof usuarioActual !== 'undefined' && usuarioActual){
      toast('Tu sesión venció. Volvé a ingresar.');
      setTimeout(function(){ cerrarSesion(); location.reload(); }, 1500);
    }
  }

  return {
    activa: activa,
    url: url,
    pedir: pedir,
    enviar: enviar,
    procesarCola: procesarCola,
    pendientes: function(){ return cola.length; },
    actualizarIndicador: actualizarIndicador,
    configurar: function(nuevaUrl){ cfg.url = String(nuevaUrl || '').trim(); save('sid_nube', cfg); actualizarIndicador(); },
    tieneToken: function(){ return !!token; },
    login: function(usuario, clave){
      return pedir('POST', '/api/login', {usuario:usuario, clave:clave}, {sinToken:true}).then(function(r){ setToken(r.token); return r.usuario; });
    },
    logout: function(){ var p = token ? pedir('POST', '/api/logout').catch(function(){}) : Promise.resolve(); setToken(''); return p; },
    estado: function(urlPrueba){ return pedir('GET', '/api/estado', null, {url:urlPrueba, sinToken:true}); }
  };
})();
