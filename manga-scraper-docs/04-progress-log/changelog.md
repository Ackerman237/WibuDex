# Changelog

Newest first. One entry per shipped feature/commit. Full narrative session
notes live in `reports/`.

---

## 2026-08-23 — Fase 1: bug fix & hardening keamanan (branch `refactor/architecture-cleanup`)

Audit menyeluruh menemukan 4 bug + 2 celah keamanan. Semua diperbaiki dalam
commit terpisah (satu fix = satu commit) di atas baseline 130 test hijau.

### BUG-1 — `decodeEntities()` korup (nekoScraper.js)
- `.replace(/&/g, '&')` dan `.replace(/"/g, '"')` adalah no-op (diduga korup
  terkena script replace emoji) → `&amp;`/`&quot;` tidak pernah ter-decode.
- Fix: tulis ulang rantai decode; `&amp;` paling akhir agar tidak double-decode.
- Test: +3 kasus regresi di `tests/nekoFeatures.test.js` (130 → 133).

### BUG-2 — Retry `getHtml()` berjalan tanpa timeout (nekoScraper.js)
- Catch path memanggil `clearTimeout()` lalu fetch retry memakai signal yang
  sama → retry bisa hang selamanya.
- Fix: tiap percobaan fetch punya AbortController + timer sendiri
  (`fetchHtmlText()`); sekalian hapus duplikasi blok fetch options.

### BUG-3 — Klaim kompatibilitas salah (`node:sqlite`)
- `lib/db.js` memakai `DatabaseSync` (Node ≥22.5) padahal engines `>=18` dan
  CI matrix 18/20/22.
- Fix (opsi A): `engines: ">=22.5.0"`, CI matrix hanya Node 22.

### P1 — Proxy dead-code di `fetcher.js`
- Global fetch (undici) mengabaikan opsi `agent` (API node-fetch) → proxy env
  diam-diam tidak aktif, termasuk SOCKS.
- Fix: dispatcher undici `ProxyAgent` (di-cache per URL); pass-through `agent`
  mati dihapus dari doujin/neko scraper; SOCKS kini menghasilkan warn
  eksplisit (undici tidak mendukung SOCKS).

### P3 — Fallback data palsu dihapus (`doujinScraper.apiGet`)
- Detail manga palsu "Offline / Timeout" + cover placeholder dihapus: client
  tak bisa bedakan data asli vs sintetis dan data palsu berisiko ter-cache.
- Upstream gagal kini konsisten melempar `UPSTREAM_UNAVAILABLE` (dengan error
  asli di `cause`) → controller membalas HTTP 503 untuk list/categories/detail/
  chapter. Stale-cache fallback dan passthrough 404 dipertahankan.

### Keamanan (`nekoController.proxyNekoPlayer`)
- S-1: SSRF guard — URL gagal parse kini DITOLAK (dulu catch-nya melanjutkan).
- S-2: respons HTML pihak ketiga diberi `Content-Security-Policy: sandbox
  allow-scripts` + `X-Content-Type-Options: nosniff` (opaque origin, script
  player tetap jalan, akses ke origin kita diblokir).
- Catatan: endpoint ini saat ini TIDAK dipakai frontend (iframe langsung ke
  penyedia) — kandidat penghapusan, menunggu keputusan.

### Lainnya
- Sampah disk root dibersihkan (server*.log, server-test.*, pr_body.txt).
- Verifikasi: `website/doujinPage/shared/` hanya dipakai halaman doujin —
  tidak perlu dipindah.
- Validasi: `npm test` 133/133 hijau; `node --check` scripts OK.

---

## 2026-08-22 (2) — Fix: hasil acak mendarat di halaman seri -> "Player video tidak tersedia"

### Root cause
Tombol ACAK mengikuti `/random` milik nekopoi yang bisa mendarat di semua tipe post.
Halaman **seri** (koleksi multi-episode, mis. "[The Sleazy Family]") tidak memuat
iframe player — hanya link episode — sehingga `parsePlayers()` kosong dan watch page
menampilkan error dead-end.

### Fixes
**[F1] Deteksi seri + daftar episode (`scrapeNekoDetail`)**
- Parser baru `parseEpisodes(html, currentSlug)`: anchor internal dalam konten
  utama, exclude nav/kategori/pagination/related/self slug; maksimal 50 item.
- Field baru `episodes` pada hasil detail (ikut cache 10 menit).
- `parsePlayers()` kini mencatat host iframe di luar allowlist via
  `logger.warn` — dasar data untuk update `NEKO_PLAYER_HOSTS`.

**[F2] UX recovery di watch page**
- Player kosong bukan lagi dead-end:
  - Ada episode -> pesan "Ini halaman seri — pilih episode" + daftar clickable
    (`watch.html?slug=...`), style `.episode-list` di watch.css.
  - Selalu ada tombol "Video Acak Lain" (panggil `/api/neko/random`, pola sama
    dengan tombol ACAK di index).

Keputusan desain: TIDAK ada retry server-side pada random (tiap pengecekan
= 1 fetch VPN; latency hingga belasan detik dan tak menjamin). Recovery
ditangani client-side.

Test: +2 kasus di tests/nekoFeatures.test.js (seri tanpa iframe ->
episodes terisi & self/kategori/related terabaikan; single video dengan
host allowlist tetap mengembalikan players). Total 130/130 di 8 file.

---

## 2026-08-22 — Fitur baru: gap analysis doujin.desu.xxx & nekopoi.care (Fase A–C)

### Fase A — Doujin quick wins

**[A1] Filter status & type di allManga**
- `lib/validator.js`: tambah `validateEnum(value, allowed, fallback)` (case-insensitive, trim).
- `controllers/mangaController.js`: terima param `status` (ongoing/completed/hiatus)
  dan `type` (manga/manhwa/manhua) dengan whitelist; diteruskan ke `scrapeMangaList`
  yang memang sudah support kedua param ini.
- Frontend `allManga.html` + `allManga.js`: dropdown STATUS & TIPE; filter ikut di URL.

**[A2] Section "Populer Saat Ini" di homepage**
- `index.js`: panggil `/api/manga?sort=rating&page=1&limit=12`, render horizontal row.
- `index.css`: style `.popular-row`; bfcache pageshow handler kini mencakup semua img di main.

**[A3] Rekomendasi "Manga Serupa" di halaman detail**
- `detail.js`: `loadRecommendations()` — fetch list berdasarkan genre pertama manga aktif,
  exclude slug sendiri, maksimal 6 item. Best-effort (gagal = section tidak tampil).

### Fase B — Ekspansi Nekopoi

**[B4] Jadwal New Hentai**
- `nekoScraper.js`: `scrapeNekoSchedule()` + parser toleran (heading nama hari membuka
  grup, anchor internal dimasukkan ke grup aktif); cache 30 menit.
- Endpoint `GET /api/neko/schedule`; section jadwal di `nekoPage/index.html`.

**[B5] Daftar seri Hentai/JAV**
- `scrapeNekoSeriesList(type, page)` untuk `/hentai-list/` & `/jav-list/`
  (reuse parseCards + parseSearchItems dengan dedup).
- Endpoint `GET /api/neko/series?type=hentai|jav&page=N`; halaman baru
  `series.html` + `series.js` dengan tab Hentai/JAV dan pagination.

**[B6] Tombol Acak**
- `scrapeNekoRandom()`: fetch `${BASE}/random` dengan `redirect: 'manual'`,
  ambil slug dari Location header. Retry via VPN route; error ASLI dilempar
  jika retry juga gagal (bug retry-swallow ditemukan oleh unit test).
- Endpoint `GET /api/neko/random`; tombol 🎲 ACAK di neko index.

**[B7] Video terkait di halaman watch**
- `parseRelated(html)`: cari heading rekomendasi/related, ekstrak anchor internal
  (judul dari h-tag/alt, thumb dari img/background-image), maksimal 8.
- Field baru `related` pada hasil `scrapeNekoDetail()`; grid "Video Terkait"
  di `watch.html`.

> **Catatan verifikasi:** parser B4/B5/B7 ditulis defensif (multi-pola fallback)
> karena halaman target tidak dapat diinspeksi langsung dari jaringan pengembangan
> (TLS intercept + blokir ISP). Perlu sanity check live sekali via VPN sebelum
> dianggap stabil. Unit test memakai fixture sintetis sesuai struktur yang diasumsikan.

### Fase C — UX personal

**[C8] Halaman Riwayat Baca (`history.html`)**
- `lib/db.js`: migrasi ringan — kolom opsional `manga_title`, `cover_url`
  (ALTER TABLE bila belum ada; baris lama tetap valid). `getAllPositions`
  mengembalikan kolom baru.
- `progressController.js`: POST /progress menerima `mangaTitle` + `coverUrl`
  opsional (cover divalidasi `safeHttpUrl`).
- `reader.js` + `storage.js`: kirim metadata saat menyimpan posisi.
- Halaman `history.html` + `history.js` konsumsi `/api/progress/all`
  (header x-device-id): cover, judul, chapter, tombol LANJUT BACA.
- Nav: link HISTORY menggantikan posisi kosong antara ALL dan LIBRARY.

**[C9] Fix known issue: continue-reading scroll restore aktif kembali**
- Akar masalah lama: `scrollIntoView` dipanggil sebelum IntersectionObserver
  terdaftar → gambar tidak pernah dimuat.
- Fix: helper `scrollToReadingPosition(container, page)` dipanggil SETELAH
  `setupLazyImages()`; buffer-load halaman sekitar target ±2; rAF + 250ms delay
  agar layout settle. Posisi dari server juga kini ikut scroll.
- Komentar known issue di `storage.js` diperbarui.

### Testing
- Test baru `tests/nekoFeatures.test.js` (7 test offline, fetch di-stub):
  parsing jadwal per hari, daftar seri nk-search-item, penolakan type invalid,
  path pagination jav-list, redirect manual random, error redirect kosong.
- `validateEnum` test (5 kasus) di `tests/validator.test.js`.
- Mock integration diperbarui untuk 3 fungsi nekoScraper baru.
- Total: **128 tests passing across 8 files** (sebelumnya 116/7).

---

## 2026-08-21 (2) — Bug fixes: E1 500→404, E2 chapter.number kosong

### Bug fixes

**[E1] 500 → 404 untuk slug/chapter tidak ditemukan**
- Root cause: `fetcher.js` melempar `Error('HTTP 404')` saat upstream return 404.
  Controller menangkap semua error sebagai 500 tanpa membedakan jenis error.
- Fix (`mangaController.js`): `getMangaDetail` dan `getChapterImages` sekarang
  mengecek `err.message === 'HTTP 404'` dan return `res.status(404)` dengan pesan
  `'Manga tidak ditemukan'` / `'Chapter tidak ditemukan'`.

**[E2] Field `chapter.number` selalu kosong**
- Root cause: `normalizer.js` memetakan chapter number ke field `chapter`, bukan
  `number`. Semua consumer (`reader.js`, `detail.js`) membaca `ch.number` yang
  selalu `undefined`.
- Fix (`normalizer.js`): Tambah field `number: ch?.chapter_number ?? ch?.chapter ?? null`
  di `mapListItem` dan `mapDetail`. Field `chapter` tetap ada untuk backward compatibility.

**Verifikasi:** 87/87 unit & integration test masih pass.

---

## 2026-08-21 (1) — Bug fixes: reader images, cover bfcache, server error handling, continue-reading disabled

### Bug fixes

**[Fix 1] Gambar reader tidak muncul saat masuk dari filter allManga**
- Root cause: `loadInitialPages()` hanya dipanggil jika `!restoredPage`. Jika ada posisi
  tersimpan di localStorage (bahkan dari chapter berbeda), gambar pertama tidak pernah
  di-load ke DOM. IntersectionObserver tidak terpicu karena tidak ada scroll event saat
  halaman baru dibuka.
- Fix (`reader.js`): `loadInitialPages(imageList, 2)` sekarang selalu dipanggil tanpa
  kondisional, memastikan halaman 1–2 selalu dimuat ke DOM saat chapter dibuka.

**[Fix 2] Cover manga hilang saat kembali ke allManga dari reader (bfcache)**
- Root cause: Browser me-restore halaman dari bfcache (back/forward cache). Gambar dengan
  `loading="lazy"` yang belum masuk viewport sebelum navigasi tidak diload ulang oleh
  browser setelah restore, sehingga cover tampak hilang/blank.
- Fix (`allManga.js`): Tambah `pageshow` event listener. Jika `event.persisted === true`
  (restore dari bfcache), semua `img` di grid yang `naturalWidth === 0` di-reload ulang
  dengan toggle `img.src = ''; img.src = currentSrc`.

**[Fix 3] Error "server bermasalah" dari detail → reader tidak tertangkap dengan benar**
- Root cause: `formatFetchError()` hanya mencocokkan string `'HTTP 500'` secara eksak.
  Namun server melempar `Error(result.message)` yang isinya teks bahasa Indonesia
  (`'Terjadi kesalahan pada server'`), sehingga pesan jatuh ke fallback generik, bukan
  pesan ramah pengguna.
- Fix (`ui.js`): `formatFetchError()` diperluas dengan regex `server|bermasalah|kesalahan|
  upstream|timeout|tidak tersedia` untuk menangkap pesan dari upstream.
- Fix (`reader.js`): Tambah `fetchChapterWithRetry()` — retry otomatis 1x setelah 1.5 detik
  untuk error sementara (non-404, non-AbortError). Catch block sekarang render HTML dengan
  tombol "COBA LAGI".

**[Known Issue / Disabled] Continue reading: scroll ke halaman terakhir dinonaktifkan**
- Root cause: `restoreReadingPosition()` memanggil `scrollIntoView()` sebelum
  `setupLazyImages()` terdaftar. Gambar target masih blank gif saat di-scroll; karena
  IntersectionObserver belum aktif, gambar tidak pernah dimuat.
- Action (`storage.js`): Logika scroll (`scrollIntoView` + buffer load halaman sekitar)
  dihapus dari `restoreReadingPosition()`. Fungsi tetap ada dan tetap membaca posisi dari
  localStorage — hanya bagian scroll yang dimatikan.
- Sistem penyimpanan posisi (localStorage + server SQLite) tidak terpengaruh dan tetap
  berjalan normal.
- TODO: Refaktor urutan inisialisasi di `reader.js` agar `setupLazyImages()` selesai
  terlebih dahulu sebelum scroll restore dilakukan.

---

## 2026-08-20 — P4 complete: sorting, genre filter, states, server-side reading position

**Commits:**
- `a5e3e72` — feat: P4 sorting + genre filter di allManga
- `5cc9385` — feat: P4 loading/empty/error states
- `933f278` — feat: P4 server-side reading position

### Sorting + Genre filter
- Tambah endpoint `GET /api/manga/categories` — scrape genres dari upstream API.
- Expose param `sort` (newest/rating/title) dan `genre` di `GET /api/manga`.
- UI toolbar di `allManga.html`: dropdown sort + dropdown genre.
- State sort/genre persisten di URL (`allManga.html?sort=rating&genre=action`).
- `allManga.js` fully updated, `allManga.css` tambah `.toolbar` + `.filter-select` styles.

### Loading/Empty/Error states
- Tambah helper `showLoading()`, `showError()`, `showEmpty()` di `shared/ui.js`.
- Semua helper support retry button via callback.
- Applied ke `index.js`, `allManga.js`, `detail.js`.
- Tambah `.state-box` + `.retry-btn` CSS di `base.css` — konsisten di semua halaman.
- `detail.js`: error sekarang tampilkan pesan spesifik (404, timeout) + retry button.
- `formatFetchError()` ditingkatkan: handle HTTP 404, 429, 500.

### Server-side reading position
- Pakai `node:sqlite` built-in (Node 22+, tidak perlu install dependency baru).
- `lib/db.js`: init SQLite, tabel `reading_positions` dengan UNIQUE INDEX per device+manga.
- `controllers/progressController.js`: `GET /api/progress`, `GET /api/progress/all`, `POST /api/progress`.
- Semua input di-sanitize (device_id, slug, chapter_id, page).
- `shared/storage.js`: tambah `getDeviceId()`, `saveProgressToServer()`, `fetchProgressFromServer()`.
- `reader.js`: save ke server (debounce 3s) + restore dari server saat buka chapter, fallback ke localStorage.
- `data/` folder ditambah ke `.gitignore`.

---

## 2026-08-19 — ALL MANGA page: pagination rebuild
**Commit:** `4d0ce33` — "add all manga pagination page"

- Added a standalone ALL MANGA page for the Doujin library, separated from
  HOME: `allManga.html`, `allManga.js`, `allManga.css`.
- Replaced the "SEE MORE" pattern with `PREVIOUS` / `NEXT` pagination.
- Page shows 50 manga per page (`limit=50`), backed by
  `/api/manga?page=${page}&limit=50`.
- Page number and search query both live in the URL
  (`allManga.html?page=2&query=naruto`) — refresh-safe, bookmarkable,
  browser back/forward works naturally.
- `NEXT` auto-disables when the returned list is shorter than the page
  limit (i.e. last page reached).
- Cleaned up `allManga.js`: removed duplicated `DOMContentLoaded` handlers,
  duplicated `goToPage()`, duplicated search listeners, and a `page=1`-only
  bug in `loadManga`.
- Trimmed `allManga.css` from `index.css`: removed HOME-only sections (hero
  banner, hero tags/title/actions, blog sidebar, "see more" button); kept
  grid/card/rating/badge/chapter-list styles; added pagination, loading,
  and error states; fixed a couple of invalid CSS selectors/values
  (`.btn-primary\:hover` → `.btn-primary:hover`, stray `*background*` typo).
- Verified live on `main` after push.

Full session notes: [`reports/2026-08-19-allmanga-pagination-report.md`](reports/2026-08-19-allmanga-pagination-report.md)

---

## Earlier — Core hardening pass (dated during initial doujin-scraper work)
Consolidated from `rencana-dev.md` — these were completed prior to the
2026-08-19 session and form the baseline the migration plan in
`06-architecture/` builds on.

**Security (P0)**
- SSRF protection: domain allowlist, private-IP blocking, redirect
  protection.
- Response size limit (10MB) and content-type validation
  (jpeg/png/webp/gif) on the image proxy.
- Rate limiting: 60 req/min on the API, 120 req/min on the image proxy.
- Internal errors hidden from clients (generic message only).
- Secrets/salts moved to `.env`.

**Scraper core (P1)**
- Request timeout (12s, AbortController) on all scraper calls.
- In-memory cache (Map-based, 60s TTL).
- Data normalization (type checks, trim, length limits).
- Decryption module separated from the main scraper.
- Offset-based pagination with metadata.
- URL sanitization (http/https only; blocks `javascript:` / `data:`).
- Input validation schema (`lib/validator.js`) for page, limit, query,
  slug, id, category, url.
- Limited retry logic (max 2, backoff 1s/2s — timeout/502/503/504 only).

**Performance (P2)**
- Concurrency control: max 5 parallel requests via a semaphore queue.

**Quality & DevOps (P3)**
- Structured logging (Pino, JSON, ISO timestamps).
- Unit tests (Vitest, 68 tests: validator, security, cache, fetcher).
- Integration tests (19 tests, all API endpoints — 87 tests total).
- CI/CD via GitHub Actions (Node 18/20/22, on push/PR).
- `middleware/` directory introduced (`rateLimit.js`, `errorHandler.js`).
