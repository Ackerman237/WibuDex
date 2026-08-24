---
name: pwa-caching
description: Gunakan skill ini SETIAP KALI mengubah website/sw.js, menambah jenis data/aset baru yang perlu di-cache (misal endpoint "Lanjutkan Nonton"/progress), atau menambah file ke PRECACHE_URLS. Memastikan strategi cache per jenis konten tetap konsisten dengan yang sudah berjalan, bukan strategi baru yang ditebak dari nol.
---

# PWA Caching Skill

`website/sw.js` **sudah** punya strategi cache yang jelas dan terdokumentasi di
komentar file itu sendiri (`CACHE_VERSION` saat ini: lihat konstanta di file —
jangan asumsikan kosong/belum ada strategi). Skill ini untuk menjaga konsistensi
saat menambah jenis konten baru, bukan mendesain ulang dari nol.

## Strategi yang Sudah Berjalan (jangan diulang dari nol — reuse pattern ini)

| Jenis konten | Strategi | Kenapa |
|---|---|---|
| Navigasi HTML (page load) | Network-first, fallback cache, fallback terakhir `/offline.html` | Halaman harus segar kalau online, tapi tetap bisa dibuka offline |
| `/api/*` GET same-origin | Network-first (tanpa fallback offline khusus) | Data manga/video harus fresh — cache cuma pengaman saat network gagal |
| Aset statis same-origin (css/js/png/jpg/webp/gif/svg/ico/woff) | Stale-while-revalidate | Cepat tampil dari cache, update di background |
| Google Fonts (cross-origin, opaque response) | Cache-first, cache terpisah (`FONT_CACHE`) | Response opaque tidak bisa dicek status-nya, aman di-cache-first |
| Request non-GET (POST/PUT/DELETE) | **Tidak disentuh sama sekali** — lolos ke network langsung | Mutasi (termasuk `POST /api/progress`) tidak boleh diintersep SW |

Versioning: `CACHE_VERSION` dinaikkan untuk invalidate semua cache lama —
`activate` event sudah menghapus cache dengan key lama secara otomatis
(`keys.filter((key) => key !== ASSET_CACHE && key !== FONT_CACHE)`). Kalau
menambah cache baru (misal cache terpisah untuk jenis data lain), pastikan key
itu juga masuk daftar yang **tidak** dihapus di `activate`, dan naikkan
`CACHE_VERSION` saat strategi berubah — jangan menumpuk cache lama tanpa
migrasi.

## Aturan Saat Menambah Jenis Konten Baru

Sebelum menulis strategi baru, tentukan jenis datanya dulu:

- **Aset statis** (css/js/icon baru) → otomatis kena `STATIC_EXT_REGEX`, tidak
  perlu kode tambahan kecuali ekstensinya belum ada di regex.
- **Data dinamis personal** (progress baca, riwayat, "Lanjutkan Nonton") → GET
  endpoint-nya otomatis masuk pola network-first `/api/*` yang sudah ada
  (`getReadingPosition`, `getAllReadingPositions` di `progressController.js`
  keduanya GET). **Jangan** taruh cache-first untuk data ini — data personal
  yang sering berubah harus selalu coba network dulu.
- **Mutasi** (`POST /api/progress` untuk simpan posisi baca) → sudah otomatis
  lolos SW (aturan "non-GET tidak disentuh"). Jangan tambah intersep khusus
  untuk POST kecuali ada kebutuhan offline-queue yang eksplisit diminta user
  — itu perubahan arsitektur besar (background sync), bukan sekadar caching.
- **File precache baru** (masuk `PRECACHE_URLS`) → hanya untuk aset inti yang
  wajib tersedia offline sejak awal (saat ini: icon, favicon, `/offline.html`).
  Jangan taruh halaman besar/data dinamis di sini.

Detail pemetaan strategi per tipe file ada di `references/caching-map.md`.

## Yang Harus Dihindari

- Cache-first untuk apa pun yang personal atau sering berubah (progress,
  listing manga/video, hasil search).
- Menambah cache name baru tanpa menaikkan `CACHE_VERSION` dan tanpa
  memastikan `activate` tetap membersihkan cache versi lama.
- Mengintersep request non-GET di `fetch` handler — ini akan memutus mutasi
  (bookmark toggle, save progress) secara halus dan sulit dilacak.
