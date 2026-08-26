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

// v28: hapus duplikat episode/related bawah player + sidebar stack mobile + fix tabrakan loading + enrich thumb episode dari peta halaman.
// v27: thumbnail related/episode (parser bg-image + li) + genre chips dari meta description upstream.
// v30: parser jadwal struktur baru (Akan Datang/Sudah Lewat) + notifikasi retry.
// v29: identitas video Wibudex (brand+badge+nav ikon modul) + fix href mati nav.
// v26: unifikasi tema video home/series/watch (tokens + alias legacy
// base.css, font Plus Jakarta Sans, theme-color espresso).
// v25: theater mode watch page.
// v24: konsolidasi card video (cards.js + refactor index/series/watch.js)
// + fix pencarian video (reset query) + fix path tokens watch.html.
// v23: reset global link tanpa underline (a color:inherit di tokens.css).
// v22: halaman Library & Riwayat (library/history.html, collections.css) +
// gate ui-check-collections.
// v21: penanda baca di daftar chapter detail (is-finished-ch/is-read-ch).
// v20: penanda chapter selesai (finishedChapters) + settings bottom-sheet +
// default lebar gambar responsif (35% desktop) + gate ui-check-home.
// v19: fix nav mobile (menu vs auto-hide + label bottom-nav aktif-only) +
// polish reader (side controls dihapus, bottombar vertikal, drawer sheet,
// penanda chapter dibaca) + alt-title span-per-judul.
// v18: (tidak dirilis — digabung v19).
// v17: halaman reader (reader.html/css) + gate ui-check-reader.
// v16: fix kontras READ NOW (--cover-accent-contrast) + restyle info panel.
// v15: pertegas tema dinamis detail (cover-theme.js v2, detail.js/css/html,
// icons.svg i-heart-filled) + instant-clear dropdown katalog + [hidden]
// global di tokens.css.
// v14: halaman detail (detail.html/css, cover-theme.js) + gate ui-check-detail.
// v13: badge jumlah genre + judul seksi nama-genre (bukan slug).
// v12: multi-genre katalog (filter-dropdown.js, catalog.js/html/css) +
// fix searchbar mobile & gate ui-check-catalog.
// v11: fix dropdown katalog (filter-dropdown.js) + searchbar mobile
// (home.css) — aset v10 yang ter-cache masih versi rusak.
// v10: batch UI manga (home.css direvisi, catalog.html/css/js baru,
// filter-dropdown.js baru) — invalidate cache stale-while-revalidate.
// v9: restrukturisasi folder web (doujinPage→manga, nekoPage→video) —
 // invalidate semua cache aset dengan path lama.
// v36: refactor portfolio — website→public, backend kebab-case (controllers/middleware/lib), fix korupsi $2 video HTML
const CACHE_VERSION = 'v36';
const ASSET_CACHE = `doujin-cache-${CACHE_VERSION}`;
const FONT_CACHE = `doujin-fonts-${CACHE_VERSION}`;

// File inti yang wajib tersedia sejak awal
const PRECACHE_URLS = [
  '/icons/icon.svg',
  '/icons/favicon.png',
  '/offline.html',
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

  // 2. Navigasi halaman HTML -> NETWORK-FIRST, fallback cache,
  //    lalu fallback terakhir: halaman offline
  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, ASSET_CACHE, '/offline.html'));
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

async function networkFirst(request, cacheName, offlineFallbackUrl = null) {
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
    // Fallback terakhir untuk navigasi: halaman offline yang di-precache
    if (offlineFallbackUrl) {
      const offline = await cache.match(offlineFallbackUrl);
      if (offline) return offline;
    }
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
// (tidak ada handler — skipWaiting sudah dipanggil di install)
