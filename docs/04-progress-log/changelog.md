# Changelog

Newest first. One entry per shipped feature/commit. Full narrative session
notes live in `reports/`.

---

## 2026-08-24 (1) — Halaman home manga + fondasi CSS dari tokens terkunci

Langkah 1 roadmap UI manga (`docs/05-roadmap/rencana-ui-manga.md`): HTML/CSS
dibangun dari nol mengikuti kontrak DOM `js/index.js` yang sudah ada.

### Baru
- `website/manga/html/index.html` — kontrak DOM lengkap: hero carousel
  (`heroBanner`/`heroBg`/CTA/dots), rail "Lanjut Baca" (`historyWrapper`),
  grid Populer + Update Terbaru, search nav, back-to-top. Script dimuat
  berurutan: utils → ui → api → storage → nav → bottom-nav → screen.
- `website/manga/css/home.css` — fondasi reusable semua halaman manga:
  nav glassmorphism (blur 20px/85%), hero scrim gradasi ke Espresso,
  `.manga-card` sesuai output `renderMangaCard` (rasio 3/4.2, stempel
  bendera jp/kr/cn via `data-flag`, badge NEW stiker SFX miring),
  state helpers, pagination, back-to-top. Semua nilai dari
  `wibudex-tokens.css` — nol hex hardcode.
- `icons.svg`: +3 simbol (`i-home`, `i-compass`, `i-video`) — selama ini
  dirujuk `bottom-nav.js` tapi tidak ada di sprite (verifier tidak menangkap
  karena ID dibangun variabel template literal).

### Penyempurnaan (masih dalam commit yang sama — belum ada rilis intermediate)
- Nav mobile satu baris: logo kiri → searchbar tengah (`flex:1`) →
  hamburger kanan; dropdown `#navLinks` tetap full-width.
- Grid populer collapsed: desktop tampil 5 kartu (1 baris penuh),
  layar sempit 6 (3×2 / 2×3) — baris rapi tanpa kartu yatim. Toggle
  `#popularMoreBtn` ("Lihat Semua" ↔ "Tampilkan Lebih Sedikit", chevron
  berputar) oleh `setupPopularMore()` di `index.js`; pakai `onclick`
  assignment agar aman dari tumpukan handler saat fetch retry.

### Verifikasi
npm test 183/183 · verify-icons lolos · kontrak DOM 19/19 ID · smoke HTTP 200.

---

## 2026-08-23 (4) — Player anti-iklan: player-frame produksi + stream langsung (Fase A/B/C)

Masalah: iframe embed penyedia melempar user ke web lain saat dipencet
(popunder/redirect). Karena iframe lintas-domain tak bisa disentuh dari parent,
dan atribut `sandbox` terdeteksi penyedia → solusi = saring di server.

### Fase A — Player-frame ke produksi (`307d0b5`)
- `buildPlayerFrameHtml()` kini menyuntik **guard anti-lempar**: `window.open`
  dimentralkan, anchor eksternal/`target=_blank` dibatalkan fase-capture,
  submit form lintas domain diblokir.
- Endpoint baru: `GET /api/neko/player-mode` (kebijakan server), 
  `GET /api/neko/player-frame` (HTML tersaring + cache 5 menit + CSP
  `sandbox allow-scripts allow-forms allow-presentation` → opaque origin:
  top-nav & popup diblokir engine browser, cookie/localStorage kita tak
  tersentuh), `GET /api/pf/:host/*` (passthrough XHR penyedia dengan header
  CORS — dokumen sandboxed ber-origin null).
- `stealthShim` menerima `xhrBase` agar lab (port 3444, `/pf`) dan produksi
  (`/api/pf`) tetap kompatibel.
- `watch.js`: indikator "🧹 Sedang membersihkan iklan…" + toggle mode.
- Rollback satu baris `.env`: `PLAYER_FRAME_MODE=direct`.

### Fase B — Spike ekstraksi stream (titik keputusan)
Analisis fixture + dump live (`scripts/dev/dump-embed.mjs`,
`scripts/dev/m3u8-spike.mjs`) membuktikan playmogo = keluarga DoodStream:
**MP4 progresif** (bukan HLS → tidak ada iklan mid-roll dalam stream).
Alur resolusi tereplikasi penuh server-side:
1. HTML embed memuat `$.get('/pass_md5/<hash>/<fileid>')` + cookie `file_id`
2. GET pass_md5 (endpoint dilindungi CF → **wajib curl**, fetch Node kena 403)
3. URL final = base CDN + 10 char acak + `?token=<token>` (replicasi `makePlay()`)
Hasil probe live: **HTTP 206 • video/mp4** pada kedua kualitas. ✅

### Fase C — Player native milik sendiri (`9e46c90`)
- `lib/scraper/streamExtract.js`: parser murni (`parseDoodStreamEmbed`,
  `buildMakePlaySuffix` — golden-test offline dengan fixture) + ekstraksi via
  `curlGetText` yang diekspor dari playerFrame.
- Endpoint `GET /api/neko/stream` → JSON URL CDN; 404+`fallback:true` untuk
  penyedia yang belum didukung (streampoi — logika di `/js/xupload.js`).
- `watch.js` rantai berlapis: **native `<video>`** (referrerpolicy=no-referrer,
  nol JS penyedia) → error otomatis jatuh ke **iframe terfilter** → toggle
  manual **direct**. Tidak ada jalur yang meninggalkan user buntu.
- Validasi end-to-end live: server nyata port 4123, endpoint mengembalikan
  `200 {success:true, type:"video/mp4", url:"https://xo247l.cloudatacdn.com/…"}`.

### Batasan jujur (dokumen untuk masa depan)
- Streampoi belum didukung ekstraksi (butuh reverse `xupload.js`) — otomatis
  pakai player-frame terfilter.
- Token CDN punya umur pendek; URL stream tidak di-cache (selalu fresh).
- Jika CDN mulai mengecek Referer ketat, fallback filtered sudah siap.

Test: 159 → **164 lulus** (5 golden streamExtract). Lint bersih.

---

## 2026-08-23 (8) — Batch C: UX detail page overhaul (tabs & recommendations)

### Detail Page UX
- **Tab Toggle Fungsional**: *Detail Info* ↔ *More Series* sebagai toggle; *More Series* memuat rekomendasi secara lazy (**autoload dihapus**, hemat bandwidth) dengan smooth scroll.
- **Mobile Alignment**: Panel tab dipindah ke **bawah List Chapter** khusus tampilan mobile (`≤640px`) menggunakan CSS flex-order.
- **Rekomendasi Grid (Desktop)**: Grid kini collapsed 1 baris (disesuaikan kapasitas lebar grid); tombol "See More" muncul jika ada kartu sisa, mendukung expand/collapse grid penuh. Kartu seragam (chapter-list dalam kartu disembunyikan via CSS global).

---

### Palet Warna Baru (`wibudex-tokens.css`)
- **Aksen Utama**: Cognac Amber / Warm Gold (`#D97706` / hover `#F59E0B` / pill bg `rgba(217, 119, 6, 0.12)`).
- **Surface & Background**: Espresso Dark (`#0D0C0C`), Warm Charcoal Surface (`#181615`), Warm Elevated Surface (`#22201D`), Warm Border (`#2E2A27`).
- **Teks**: Warm Ivory (`#F3EFEA`), Warm Muted (`#9E9690`).
- **Spotlight Hover**: Card hover glow & border di-tone ke amber hangat `rgba(217, 119, 6, 0.18)`.
- **HTML Meta**: `theme-color` di 8 halaman HTML di-update ke `#0D0C0C`.
- `sw.js` CACHE_VERSION v7 -> v8.

---

### Perbaikan Data (Batch B)
- `normalizer.js`: `stripHtml` diterapkan pada `synopsis` di `mapDetail()` (tag `<br>`, `<p>`, `<span>` di *Intern Haenyeo* dll. kini dibersihkan di server).
- `security.stripHtml`: diperbaiki agar tag pemisah paragraf/baris (`<br>`, `</p>`, `</div>`, `<li>`, `<h1-6>`) diganti dengan `\n` sebelum tag dibuang, mencegah kata-kata menempel.
- `repairMojibake`: fungsi heuristik baru di `normalizer.js` untuk memulihkan string UTF-8 yang ter-decode sebagai Latin-1 (`ãƒ¢...` -> teks CJK asli). Diterapkan pada `title` dan `altTitles`. Dilengkapi +4 unit test vitest.

### UX & Layout Detail Page (Batch C)
- **Tab Toggle Fungsional**: `Detail Info` ↔ `More Series` kini bekerja aktif. *More Series* menyembunyikan info/sinopsis dan memuat rekomendasi secara lazy (**autoload dihapus**, hemat request upstream).
- **Mobile Repositioning (≤640px)**: deretan tombol tab dipindah berada **di bawah List Chapter** via CSS `display: contents` + flex ordering pada `.detail-layout`.
- **Desktop Grid Rekomendasi 1 Baris + "See More"**:
  - Chapter-list di dalam kartu rekomendasi disembunyikan agar tinggi kartu seragam.
  - Sembunyikan kartu berlebih jika melebih kapasitas 1 baris.
  - Tampilkan tombol panah `See More` jika ada sisa kartu. Ditekan -> expand grid penuh dengan animasi chevron, ditekan lagi -> collapse.
- `sw.js` CACHE_VERSION v6 -> v7.

---

### Token & alias
- File baru `website/css/wibudex-tokens.css` — token asli Wibudex
  (`--bg-base`, `--accent-primary`, spacing/radius/elevation/motion) +
  **blok alias legacy FROZEN**: 20 variabel lama (`--bg`, `--card`,
  `--ink`, `--primary`, dst.) dipetakan ke token baru tanpa menyentuh
  8 file CSS halaman.
- `base.css`: blok `:root` variabel lama DIHAPUS (sumber kebenaran pindah
  ke tokens.css; mencegah konflik cascade), dot-grid body & aksen merah
  hanko dihapus (identitas lama), `.error #d9756c` → `var(--error)`.
- Radius legacy dimapping ke skala baru: `--radius`(4px)→sm(8px),
  `--radius-lg`(10px)→md(12px) sesuai spec card = radius-md.

### Pilot halaman
- `index.html`: font Oswald → Plus Jakarta Sans (Inter tetap),
  link tokens.css sebelum base.css, script anti-flash tema
  (`localStorage 'wibudex-theme'`) di head, `theme-color` → `#121316`.

### Infrastruktur
- `sw.js` CACHE_VERSION v5 → v6 (invalidate cache CSS/aset runtime).
- Verifikasi: 173/173 test hijau; JS frontend tidak membaca variabel
  warna (hanya set backgroundImage/opacity) → nol dampak logika.
- Catatan debt: hardcoded hex di file per-halaman (detail 12, index 8,
  library 4, components 2, cards 2, allManga 1) belum berubah — migrasi
  per-file menyusul; reader.css tidak disentuh (prinsip reader netral).

---

## 2026-08-23 (3) — Fase 4: ESLint, golden test decryptor, test normalizer, README arsitektur

### Bug lama terkonfirmasi lewat sanity check live (`npm run demo:fast`)
- `scripts/demo.js` mengimpor `disconnectVpn` dari nekoScraper — export itu
  TIDAK PERNAH ada di sana; demo crash saat start sejak commit lama. Fix:
  impor dari `lib/vpn/vpnManager.js`.
- Demo memakai kategori `ecchi` yang tidak ada di situs (404 asli upstream).
  Diganti `hentai` (terverifikasi live). Hasil demo live: 10/10 lulus.

### ESLint (flat config 9)
- DevDependency baru: `eslint`, `@eslint/js`, `globals` (tanpa dependensi
  runtime baru). Script `lint` — step CI `npm run lint --if-present` yang
  selama ini no-op kini benar-benar memeriksa kode.
- 21 temuan awal dibereskan: unused vars/imports, useless escape & assignment,
  empty catch diberi komentar eksplisit. `get-secret.js` disentuh HANYA lewat
  konfigurasi lint (guardrail dihormati); `website/` diabaikan.

### Golden test decryptor (+5)
- `_internals { generateKey, decryptHex }` diekspos (aditif) untuk test.
- Waktu di-pin via fake timers agar bucket jam deterministik; ciphertext
  dibangun dengan enkripsi cermin (mask `& 255` wajib — tertangkap oleh test
  sendiri saat draft pertama tanpa mask).
- Cakupan: bucket saat ini, fallback bucket -1 dan +1, fail path.

### Unit test normalizer (+5)
- mapListItem/mapDetail: resolve URL relatif, penolakan host non-allowlist,
  fallback thumb berantai, toleransi null/tipe salah.

### README
- Ditambah bagian **Architecture** (diagram alur request + daftar single
  source of truth). Struktur project, jumlah test, requirement Node >=22.5,
  dan referensi proxy-player yang sudah dihapus ikut disinkronkan.

Validasi akhir: **148/148 test**, lint bersih, `node --check` scripts OK,
demo live 10/10.

---

## 2026-08-23 (2) — Fase 2-3: single source of truth + separation of concerns

Lanjutan sesi Fase 1 di branch yang sama. Semua langkah: `npm test` hijau
sebelum commit. Test: 133 → 138.

### Keputusan arsitektur: endpoint `/api/neko/proxy-player` DIHAPUS
- Audit menemukan endpoint ini tidak punya konsumen (frontend embed iframe
  langsung ke penyedia) dan cacat desain (raw HTML pihak ketiga → URL relatif
  resolve ke origin kita = player rusak by-design).
- Kapabilitas fallback player server-side tetap terjaga lewat
  `lib/scraper/playerFrame.js` + lab `scripts/dev/player-frame-server.js`
  (teruji, punya transformasi URL + passthrough XHR). Jika embed langsung
  diblokir penyedia, promosikan playerFrame ke produksi — bukan menghidupkan
  ulang prototipe lama.
- `lib/browser.js` dipertahankan (dipakai playerFrame via dynamic import).

### Single source of truth (Fase 2)
- **BUG-4 (config drift)**: allowlist host player yang tadinya berbeda di 3
  file kini satu sumber: `lib/config/playerHosts.js` (env `NEKO_PLAYER_HOSTS`
  atau default). `playerFrame.js` re-export demi kompatibilitas.
- **USER_AGENT**: 3 definisi dengan versi Chrome berbeda (124/126) → satu di
  `lib/constants.js` (+ `REFERER_NEKO`, `REFERER_DOUJIN`).
- **safeHttpUrl vs safeImageUrl**: `safeHttpUrl()` kini benar-benar generik
  (protokol http(s) + anti-SSRF); allowlist domain gambar doujin pindah ke
  `safeImageUrl()`. Semua konsumen gambar (doujinScraper, normalizer,
  imageProxy, progressController) pindah ke `safeImageUrl()`.
- **Cache**: 3 implementasi (CacheManager, Map manual neko, LRU manual image)
  → semua pakai `CacheManager` (+ method `clear()`; cache gambar kini TTL
  60 menit — sebelumnya entri hidup selamanya).

### Separation of concerns (Fase 3)
- `nekoScraper.js` (618 baris) dipecah menjadi `lib/scraper/neko/`:
  `http.js` (fetch+VPN+retry), `text.js` (util teks), `parsers/cards.js`,
  `parsers/detail.js`, `parsers/schedule.js`, `parsers/anchors.js`
  (ekstraksi anchor yang tadinya diduplikasi 3×), `index.js` (orkestrasi).
  `nekoScraper.js` jadi re-export tipis — kontrak publik nol perubahan.
- Engine proxy gambar keluar dari controller → `lib/imageProxy.js`.
  `mangaController.js`: 319 → ~118 baris, kini murni HTTP handler.
- Mapping error upstream terpusat di `middleware/upstreamResponse.js`
  (`respondUpstreamError`) — blok if-status yang diduplikasi di ±10 handler
  kini satu definisi.

### Hasil akhir
- File terpanjang di kode aplikasi: vpnManager.js 473 (kohesif, sengaja
  dipertahankan); file terbesar buatan sendiri berikutnya 188 baris.
- Duplikasi tersisa: nol untuk cache/UA/allowlist/error-mapping/anchor-parse.
- Validasi: 138/138 test, `node --check` scripts OK.

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
