/* =========================================================
   Doujin Library — Service Worker
   Strategi:
   - Asset statis same-origin (css/js/gambar/font lokal):
       Stale-While-Revalidate → cache-first, update di background
   - Google Fonts (cross-origin, response opaque): cache-first
     ke cache TERPISAH
   - Halaman HTML (navigasi) & API GET (/api/*): network-first,
     fallback cache saat offline
   - Request non-GET (POST/PUT/DELETE): TIDAK disentuh sama sekali
   Versioning: naikkan CACHE_VERSION untuk invalidate semua cache.
   ========================================================= */

// v4: invalidasi seluruh cache — server kini mengirim HTML no-cache dan
// aset berversi (?v=). Cache lama (v3) berisi watch.js pra player-frame.
const CACHE_VERSION = 'v4';
const ASSET_CACHE = `doujin-cache-${CACHE_VERSION}`;
const FONT_CACHE = `doujin-fonts-${CACHE_VERSION}`;

// File inti yang wajib tersedia sejak awal
const PRECACHE_URLS = [
  '/icons/icon.svg',
  '/icons/favicon.png',
];

/* ---------------- INSTALL ---------------- */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(ASSET_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

/* ---------------- ACTIVATE ---------------- */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== ASSET_CACHE && key !== FONT_CACHE)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

/* ---------------- FETCH ---------------- */
const STATIC_EXT_REGEX = /\.(?:css|js|mjs|png|jpe?g|webp|gif|svg|ico|woff2?)$/i;

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // 1. Hanya GET. POST/PUT/DELETE (termasuk mutasi API) lolos apa adanya.
  if (request.method !== 'GET') return;

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }

  // Abaikan skema non-http (chrome-extension:, blob:, dll)
  if (!url.protocol.startsWith('http')) return;

  // 2. Navigasi halaman HTML -> NETWORK-FIRST
  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, ASSET_CACHE));
    return;
  }

  if (url.origin === self.location.origin) {
    // 3. API GET same-origin -> NETWORK-FIRST (data manga harus segar)
    if (url.pathname.startsWith('/api/')) {
      event.respondWith(networkFirst(request, ASSET_CACHE));
      return;
    }
    // 4. Asset statis same-origin -> STALE-WHILE-REVALIDATE
    if (STATIC_EXT_REGEX.test(url.pathname)) {
      event.respondWith(staleWhileRevalidate(request, ASSET_CACHE));
      return;
    }
    // Sisanya (misal halaman via URL langsung tanpa mode navigate):
    // biarkan lewat network normal.
    return;
  }

  // 5. Google Fonts -> CACHE-FIRST ke cache terpisah
  //    (response cross-origin ini opaque, tidak bisa dicek statusnya,
  //     jadi cukup simpan dan sajikan dari cache)
  if (
    url.hostname === 'fonts.googleapis.com' ||
    url.hostname === 'fonts.gstatic.com'
  ) {
    event.respondWith(cacheFirst(request, FONT_CACHE));
  }
});

/* ---------------- STRATEGI ---------------- */

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const fresh = await fetch(request);
    if (fresh && (fresh.ok || fresh.type === 'opaque')) {
      cache.put(request, fresh.clone());
    }
    return fresh;
  } catch {
    const cached = await cache.match(request, { ignoreSearch: request.mode === 'navigate' });
    if (cached) return cached;
    throw new Error('offline dan belum ada cache');
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const refresh = fetch(request)
    .then((response) => {
      if (response && (response.ok || response.type === 'opaque')) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => undefined);

  // Sajikan cache dulu kalau ada; kalau tidak, tunggu network.
  return cached || (await refresh) || Promise.reject(new Error('offline'));
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response && (response.ok || response.type === 'opaque')) {
    cache.put(request, response.clone());
  }
  return response;
}

/* ---------------- PESAN DARI HALAMAN ---------------- */
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
