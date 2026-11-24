/* Registro del service worker (permite abrir la app sin conexión una vez visitada). */
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('sw.js', {updateViaCache: 'none'}).then(function (reg) { reg.update().catch(function () {}); }).catch(function () {});
  });
}
