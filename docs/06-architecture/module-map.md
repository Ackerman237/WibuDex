# MODULE_MAP.md — Klasifikasi Logic Murni vs UI-Bound

Laporan klasifikasi seluruh file `.js` di project WibuDex.
Terakhir diperbarui: 2026-08-24 (setelah restrukturisasi produk: manga/video,
API /api/video, routes per domain, shared terpusat).

**Kategori:**
- **LOGIC MURNI** — tidak menyentuh DOM sama sekali (tidak ada `document.*`, `getElementById`, `addEventListener`, `innerHTML`, atau referensi ke class/id HTML). Portable: bisa dipindah ke project baru tanpa perubahan.
- **UI-BOUND** — memanipulasi DOM, memasang event listener ke elemen tertentu, atau bergantung pada struktur HTML yang sedang dipakai.
- **CAMPURAN** — satu file punya kedua bagian; dirinci per fungsi.

---

## UTILS BERSAMA — `public/shared/`

### `shared/utils.js` (BARU)
**Klasifikasi: LOGIC MURNI & UI HELPER**

File kanonik bersama untuk fungsi yang dibutuhkan lintas bagian (doujin & neko).

| Fungsi | Klasifikasi | Alasan |
|---|---|---|
| `escapeHtml(value)` | **Logic murni** | Pure string transformation (escape 5 karakter HTML: `&`, `<`, `>`, `"`, `'`). Tidak menyentuh DOM. |
| `setupBackToTop(btn, threshold)` | **UI Helper** | Menerima elemen tombol sebagai parameter, memasang scroll & click listener. Generic & reusable untuk halaman manapun. |

---

## SHARED — `public/shared/` (semua file shared kini di sini, bukan nested per modul)

### `shared/api.js`
**Klasifikasi: LOGIC MURNI (100% portable)**

Semua fungsi hanya melakukan fetch HTTP dan mengembalikan data. Tidak ada referensi DOM.

| Fungsi | Klasifikasi | Alasan |
|---|---|---|
| `fetchJsonWithTimeout(url)` | Logic murni | Pure fetch + AbortController (timeout 12s) |
| `fetchMangaDetail(slug)` | Logic murni | Wrapper fetch API detail |
| `fetchChapter(chapterId)` | Logic murni | Wrapper fetch API chapter |

---

### `shared/storage.js`
**Klasifikasi: LOGIC MURNI (100% portable)**

*Catatan: `restoreReadingPosition` yang sebelumnya UI-bound sudah digantikan oleh `getSavedPage` (logic murni). File ini sekarang 100% logic murni.*

| Fungsi | Klasifikasi | Alasan |
|---|---|---|
| `getBookmarks()` | Logic murni | Baca `localStorage.getItem('bookmarks')` |
| `toggleBookmark(manga)` | Logic murni | Mutasi object di localStorage |
| `getFavorites()` | Logic murni | Baca `localStorage.getItem('favorites')` |
| `toggleFavorite(manga)` | Logic murni | Mutasi object di localStorage |
| `getReadingHistory()` | Logic murni | Baca `localStorage.getItem('history')` |
| `getLastReadChapter(slug)` | Logic murni | Filter array riwayat |
| `saveReadingHistory(data)` | Logic murni | Update antrian riwayat (maks 10) di localStorage |
| `saveReadingPosition(data)` | Logic murni | Tulis posisi baca ke localStorage |
| `getSavedPage(slug, chapterId, targetPageOverride)` | **Logic murni** | Mengambil nomor halaman dari localStorage/override tanpa menyentuh DOM |
| `getDeviceId()` | Logic murni | Generate/ambil UUID persisten dari localStorage |
| `saveProgressToServer(data)` | Logic murni | Fetch POST async ke `/api/progress` |
| `fetchProgressFromServer(mangaSlug)` | Logic murni | Fetch GET dari `/api/progress` |

---

### `shared/ui.js`
**Klasifikasi: UI-BOUND & COMPONENT RENDERER**

*Catatan: `escapeHtml` dan `setupBackToTop` sudah dipindah ke `public/shared/utils.js`.*

| Fungsi | Klasifikasi | Alasan |
|---|---|---|
| `el(id)` | UI-bound | Shorthand `document.getElementById(id)` |
| `formatFetchError(error, fallbackMessage)` | **Logic murni** | Pure string mapping berdasarkan error object/message |
| `showLoading(container, message)` | UI-bound | Injeksi markup loading ke container |
| `showError(container, message, onRetry)` | UI-bound | Injeksi markup error + pasang event listener retry |
| `showEmpty(container, message, btnLabel, onAction)` | UI-bound | Injeksi markup empty-state + pasang listener aksi |
| `renderPaginationControls(options)` | **UI Component** | Menerima elemen penampung sebagai parameter (`pageNumbersEl`, `prevBtnEl`, `nextBtnEl`), render angka halaman |
| `ic(name)` | **Logic murni** | Return string markup SVG sprite `<use href="/manga/icons.svg#i-...">` |
| `getMangaFlag(type)` | **Logic murni** | Pure mapping string type → kode bendera (`'jp'|'kr'|'cn'|''`) |
| `renderMangaCard(manga)` | UI-bound | `document.createElement`, manipulasi class, event delegation |

---

### `shared/nav.js`
**Klasifikasi: UI-BOUND (100%)**

IIFE interaktivitas header: hamburger toggle menu mobile & auto-hide navbar saat scroll ke bawah.

---

### `shared/bottom-nav.js`
**Klasifikasi: UI-BOUND (100%)**

IIFE perender bottom navigation bar khusus mobile (lebar <= 700px).

---

## FRONTEND — `public/manga/js/` (screens)

### `js/index.js`
**Klasifikasi: UI-BOUND (screen homepage)**

| Fungsi | Klasifikasi | Alasan |
|---|---|---|
| `renderHomeHistory()` | UI-bound | Render carousel riwayat baca ke `#historyContainer` |
| `loadManga(query, page)` | UI-bound | Fetch & render grid manga terbaru ke `#mangaGrid` |
| `loadHeroAndPopular()` | UI-bound | Fetch hero featured pool + grid populer |
| `startHeroRotation(pool)` / `goToSlide(i)` / `applyHeroSlide(manga)` | UI-bound | Rotasi otomatis, swipe listener, dan DOM update slider |

---

### `js/catalog.js`
**Klasifikasi: UI-BOUND (screen catalog)**

| Fungsi | Klasifikasi | Alasan |
|---|---|---|
| `loadManga(...)` | UI-bound | Fetch list terfilter & render kartu ke `#mangaGrid` |
| `loadGenres()` | UI-bound | Isi dropdown `<select id="genreSelect">` |
| `goToPage(page)` | UI-bound | Manipulasi query string URL + reload |
| `buildListParams(page)` | **Logic murni** | Pure perakitan `URLSearchParams` dari state |
| `renderPagination(pagination)` | UI-bound | Panggil `renderPaginationControls` dengan pass elemen |
| `initFiltersFromURL()` / `setupFilterListeners()` | UI-bound | Sinkronisasi form filter dengan URL & DOM event |

---

### `js/detail.js`
**Klasifikasi: UI-BOUND (screen detail manga)**

| Fungsi | Klasifikasi | Alasan |
|---|---|---|
| `renderDetail()` / `renderChapterList()` | UI-bound | Fetch detail & render metadata + list chapter |
| `showInfoTab()` / `showMoreSeriesTab()` | UI-bound | Tab switching & lazy fetch rekomendasi |
| `cleanSynopsis(raw)` | **Logic murni** | String cleaning sinopsis |
| `starString(rating)` | **Logic murni** | Format angka rating ke representasi bintang |
| `setBookmarkLabel()` / `setInfoValue()` | UI-bound | Update UI state tombol & info field |

---

### `js/reader.js`
**Klasifikasi: UI-BOUND (screen reader 910 baris)**

Mengelola viewer komik: lazy image loading (`IntersectionObserver`), progress tracker, auto-scroller, auto-hide chrome bar, drawer chapter, settings panel, image retry engine.
- Memakai `getSavedPage(mangaSlug, chapterId)` dari `storage.js` untuk baca posisi (logic murni) dan memvalidasi `querySelectorAll('img').length` di level reader (UI).
- Helper `describeImageFailure(img)` dan `IMAGE_RETRY_DELAYS` adalah **logic murni**.

---

### `js/history.js`
**Klasifikasi: UI-BOUND (screen riwayat baca)**
Fetch riwayat tersimpan dari backend (`/api/progress/all`) dan render ke `#historyGrid`.

---

### `js/library.js`
**Klasifikasi: UI-BOUND (screen bookmark & favorit)**
- `getStorageData(key)`: logic murni (baca localStorage).
- `removeStorageItem(key, slug)`: **logic murni** (hapus entry dari localStorage & return status boolean).
- `renderLibrarySection(...)`: UI-bound (render grid kartu & bind aksi hapus/klik).

---

## FRONTEND — `public/video/`

*Semua HTML video (`index.html`, `series.html`, `watch.html`) sekarang meng-include `/shared/utils.js`.*

### `video/js/nav.js`
**Klasifikasi: UI-BOUND**
Hamburger toggle & fetch kategori dengan caching di `sessionStorage` (TTL 10m).

### `video/js/index.js`
**Klasifikasi: UI-BOUND**
Video list, jadwal rilis Hentai, tombol acak (random), pagination tombol "See More". Menggunakan `escapeHtml` & `setupBackToTop` dari `/shared/utils.js`.

### `video/js/series.js`
**Klasifikasi: UI-BOUND**
Daftar seri Hentai/JAV dengan tab filter tipe. Menggunakan `escapeHtml` & `setupBackToTop` dari `/shared/utils.js`.

### `video/js/watch.js`
**Klasifikasi: CAMPURAN**
- **Logic Murni:** `isAllowedPlayerUrl(rawUrl)` (validasi allowlist host), `tryNativeStream(playerUrl)` (fetch API stream dengan AbortController).
- **UI-Bound:** Mounting player (`mountNativeVideo`, `mountFilteredFrame`, `mountDirectFrame`), switch server, sidebar episode/related, synopsis expand/collapse toggle. Menggunakan `escapeHtml` dari `/shared/utils.js`.

---

## BACKEND & SCRAPER CORE — `lib/` (100% Logic Murni)

Seluruh modul di `lib/` tidak bersentuhan dengan DOM browser dan fully testable:

| File | Peran | Klasifikasi |
|---|---|---|
| `lib/security.js` | SSRF protection, allowlist domain image, sanitasi URL & HTML | Logic murni |
| `lib/validator.js` | Validasi & sanitasi input request API (`page`, `slug`, `url`, `enum`, dll) | Logic murni |
| `lib/constants.js` | User-Agent & referer global | Logic murni |
| `lib/db.js` | SQLite store via `node:sqlite` untuk reading position | Logic murni |
| `lib/browser.js` | Lifecycle management Puppeteer Chromium | Logic murni |
| `lib/image-proxy.js` | Image proxy stream + sharp resize cache | Logic murni |
| `lib/scraper/fetcher.js` | Fetcher dengan concurrency queue, timeout, & retry | Logic murni |
| `lib/scraper/cache.js` | In-memory cache manager (TTL + LRU eviction + byte budget) | Logic murni |
| `lib/scraper/decryptor.js` | XOR decryption engine dengan time-bucket key derivation | Logic murni |
| `lib/scraper/normalizer.js` | Schema mapper API doujin & Mojibake repair (`repairMojibake`) | Logic murni |
| `lib/scraper/doujin-scraper.js`| Scraper JSON API doujin.desu.xxx | Logic murni |
| `lib/scraper/neko-scraper.js`  | Scraper HTML & schedule nekopoi.care | Logic murni |
| `lib/scraper/player-frame.js`  | Sanitasi embed player video & inject sandbox CSP | Logic murni |
| `lib/scraper/stream-extract.js`| Regex stream extractor MP4/HLS dari player provider | Logic murni |

---

## SERVER & CONTROLLER — `controllers/`, `routes/`, `server.js`

| File | Peran | Klasifikasi |
|---|---|---|
| `server.js` | Entry point Express, static routing, helmet CSP, graceful shutdown | Backend Logic |
| outes/index.js | Mount semua sub-router domain | Backend Logic |
| outes/manga.routes.js / ideo.routes.js / progress.routes.js / pn.routes.js | Routing per domain | Backend Logic |
| `controllers/manga-controller.js` | Handler API manga/doujin | Controller Logic |
| `controllers/video-controller.js` | Handler API video neko, stream proxy, player frame | Controller Logic |
| `controllers/progress-controller.js`| Handler API sync progress baca via SQLite | Controller Logic |
| `public/sw.js` | Service Worker (PWA caching strategies: SWR, network-first, offline fallback) | Service Worker Logic |
| `public/js/register-sw.js` | PWA service worker registration script | UI Helper |
