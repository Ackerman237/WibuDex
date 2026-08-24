# Peta Strategi Cache per Tipe Aset

Detail teknis pendukung `pwa-caching/SKILL.md`. Baca `website/sw.js` langsung
untuk implementasi aktual — dokumen ini merangkum, bukan menggantikan kode.

## Fungsi Strategi yang Sudah Ada di `sw.js`

- `networkFirst(request, cacheName, offlineFallbackUrl?)` — coba fetch, kalau
  sukses simpan ke cache lalu return; kalau gagal, ambil dari cache
  (`ignoreSearch: true` khusus untuk navigasi, supaya query string tidak bikin
  cache-miss di halaman yang sama); kalau masih gagal dan ada
  `offlineFallbackUrl`, sajikan itu.
- `staleWhileRevalidate(request, cacheName)` — return cache dulu kalau ada,
  sambil fetch background untuk update cache; kalau cache kosong, tunggu
  network sekali.
- `cacheFirst(request, cacheName)` — return cache kalau ada, kalau tidak baru
  fetch dan simpan.

## Routing Aktual di `fetch` Handler

1. Method selain GET → `return` tanpa `respondWith` (lolos apa adanya).
2. Protokol non-http (`chrome-extension:`, `blob:`, dll) → `return` (diabaikan).
3. `request.mode === 'navigate'` → `networkFirst(..., ASSET_CACHE, '/offline.html')`.
4. Origin sama + path `/api/*` → `networkFirst(..., ASSET_CACHE)` (tanpa
   fallback offline khusus — kalau gagal dan cache kosong, request reject).
5. Origin sama + ekstensi cocok `STATIC_EXT_REGEX` → `staleWhileRevalidate`.
6. Origin sama, tidak cocok kategori manapun → dibiarkan lewat network normal
   (tidak di-`respondWith`).
7. `fonts.googleapis.com` / `fonts.gstatic.com` → `cacheFirst(..., FONT_CACHE)`.

## Kalau Menambah Fitur "Lanjutkan Nonton"/Progress Baru

- Endpoint GET progress (`/api/progress`, `/api/progress/all`) otomatis masuk
  aturan #4 di atas (network-first) — tidak perlu kode SW tambahan.
- Kalau nanti butuh badge "posisi terakhir" muncul instan tanpa nunggu
  network (UX improvement, bukan caching problem) — itu domain state di
  frontend (`shared/storage.js` atau state lokal), bukan strategi service
  worker. Jangan campur adukkan cache HTTP dengan state aplikasi.
- Kalau butuh offline-queue untuk POST progress saat benar-benar offline
  (background sync) — ini scope besar (perlu `sync` event, IndexedDB queue,
  retry logic). Laporkan ke user dulu sebagai keputusan fitur terpisah,
  jangan diam-diam diimplementasi sebagai bagian dari "caching".

## Checklist Sebelum Mengubah `sw.js`

- [ ] Apakah perubahan ini menambah cache name baru? Kalau ya → naikkan
      `CACHE_VERSION` dan pastikan `activate` tetap menghapus cache versi lama.
- [ ] Apakah jenis kontennya personal/sering berubah? → network-first,
      bukan cache-first.
- [ ] Apakah ini request non-GET? → jangan diintersep sama sekali.
- [ ] Sudah dites dengan DevTools → Application → Service Workers (update,
      offline toggle) sebelum dianggap selesai?
