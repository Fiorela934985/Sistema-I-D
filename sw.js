/* Service worker — estrategia "red primero": siempre intenta la versión más reciente
   y solo usa la caché cuando no hay conexión. Así un nuevo despliegue se ve de inmediato. */
const CACHE = 'sistema-id-v5';
const CORE = [
  './',
  './index.html',
  './css/styles.css',
  './css/tema.css',
  './css/modulos.css',
  './css/acabado.css',
  './css/diseno.css',
  './data/disenos-reales.js',
  './js/core/utils.js',
  './js/core/auth.js',
  './js/core/historial.js',
  './js/core/icons.js',
  './js/core/shell.js',
  './js/modules/catalogos.js',
  './js/modules/proyectos.js',
  './js/modules/componentes.js',
  './js/modules/evidencias.js',
  './js/modules/roturas.js',
  './js/modules/disenos/disenos.js',
  './js/modules/disenos/vista.js',
  './js/modules/disenos/resultados.js',
  './js/modules/disenos/informe.js',
  './js/modules/disenos/calculadora.js',
  './js/modules/archivador.js',
  './js/modules/reporte-rr.js',
  './js/core/analitica.js',
  './js/modules/proyectos-panel.js',
  './js/modules/calendario.js',
  './js/modules/etiquetas.js',
  './js/modules/base-historica.js',
  './js/modules/prediccion.js',
  './js/modules/asistente.js',
  './js/modules/buscador.js',
  './js/modules/usuarios.js',
  './js/modules/historial-panel.js',
  './js/modules/dashboard.js',
  './js/modules/ajustes.js',
  './js/modules/inicio.js',
  './js/data/seed.js',
  './js/data/reparaciones.js',
  './js/main.js',
  './js/pwa.js',
  './assets/favicon.svg',
  './assets/logo-nexus.png',
  './assets/logo-dino.png',
  './assets/tipos-rotura.jpg',
  './manifest.webmanifest'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok && (res.type === 'basic' || res.type === 'cors')) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(e.request).then((r) => r || caches.match('./index.html')))
  );
});
