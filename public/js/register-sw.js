/* =========================================================
   Doujin Library — Service Worker Registration
   Dimuat (defer) di semua halaman. Aman dipanggil berkali-kali:
   browser otomatis dedupe registrasi untuk scope yang sama.
   ========================================================= */

(function () {
  'use strict';

  // SW hanya jalan di secure context: https:// ATAU localhost.
  // Kalau dibuka via file:// atau http:// IP LAN, lewati diam-diam.
  var isLocalhost =
    location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  var isSecure = location.protocol === 'https:' || isLocalhost;

  if (!('serviceWorker' in navigator) || !isSecure) return;

  window.addEventListener('load', function () {
    navigator.serviceWorker
      .register('/sw.js')
      .then(function (registration) {
        if (isLocalhost) {
          console.log('[SW] Terdaftar, scope:', registration.scope);
        }
        registration.addEventListener('updatefound', function () {
          var newWorker = registration.installing;
          if (!newWorker) return;
          newWorker.addEventListener('statechange', function () {
            if (
              newWorker.state === 'installed' &&
              navigator.serviceWorker.controller
            ) {
              if (isLocalhost) console.log('[SW] Versi baru tersedia, refresh halaman untuk memakai cache terbaru.');
            }
          });
        });
      })
      .catch(function (err) {
        if (isLocalhost) console.warn('[SW] Registrasi gagal:', err);
      });
  });
})();
