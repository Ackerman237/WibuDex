# AGENTS.md — WibuDex (Self-hosted Manga Reader & Video Streaming)

## Ringkasan Proyek
**Wibudex** adalah aplikasi web self-hosted untuk membaca manga/manhwa dan
menonton video streaming, dipakai secara pribadi. Konten dikumpulkan live dari
situs sumber melalui scraper internal — tidak ada CMS, tidak ada konten yang
disimpan permanen.

Dua modul produk:
- **Manga** (`website/manga/`) — katalog, detail chapter, reader
- **Video** (`website/video/`) — daftar video, watch page dengan player

## Batasan Teknis Penting
- **Runtime:** Node.js ≥22.5 (`node:sqlite` built-in), ESM (`"type": "module"`)
- **Server:** Express 4 (`server.js`), helmet CSP, rate limiting
- **Logger:** Pino (`lib/logger.js`) — SELALU `logger.info/warn/error`, dilarang `console.log`
- **Test:** Vitest — `npm test` WAJIB hijau sebelum & sesudah perubahan apa pun
- **Zero runtime dependency baru** tanpa persetujuan eksplisit
- **Frontend:** HTML/CSS/JS vanilla tanpa build step — semua halaman berjalan
  langsung dari Express static

## Struktur Folder
```
/server.js               → Entry point Express (static serve + API mount)
/controllers/            → Handler API per domain (tanpa logic scraping)
  mangaController.js     → Endpoint /api/manga/*, /api/chapter
  videoController.js     → Endpoint /api/video/*, player-frame, stream proxy
  progressController.js  → CRUD posisi baca (SQLite)
/vpnController...        → Status VPN
/routes/                 → Routing per domain
  index.js               → Mount semua sub-router
  manga.routes.js / video.routes.js / progress.routes.js / vpn.routes.js
/lib/                    → Logic murni (portable, tanpa DOM)
  scraper/               → Lapisan INTERNAL — boleh menyebut nama situs sumber
    doujinScraper.js       Scraper API JSON terenkripsi (doujin.desu.xxx)
    nekoScraper.js         Scraper HTML WordPress (nekopoi.care)
    fetcher.js             Fetch + concurrency queue + timeout + retry
    cache.js               CacheManager (TTL + maxSize + byte budget)
    normalizer.js          Normalisasi data + repair mojibake
    decryptor.js           Dekripsi respons terenkripsi
    playerFrame.js         Sanitasi embed player + sandbox CSP
    streamExtract.js       Ekstraksi stream MP4/HLS dari player penyedia
  security.js            SSRF guard, allowlist domain gambar, stripHtml
  validator.js           Validasi input request
  db.js                  SQLite via node:sqlite (posisi baca)
  vpn/vpnManager.js      Manajemen VPN otomatis (WARP) anti-blokir
/middleware/             → errorHandler, rateLimit, upstreamResponse
/tests/                  → Vitest unit + integration (mock/offline, tanpa situs live)
/scripts/                → get-secret.js, demo.js, generate-icons.mjs, dev/
/website/                → Frontend statis
  css/wibudex-tokens.css → Design token pusat (dark-first, accent amber)
  shared/                → JS bersama kedua modul (utils/api/storage/ui/nav)
  js/register-sw.js      → Registrasi service worker
  manga/                 → Screen scripts manga (js/) + icons.svg
  video/                 → Halaman video lengkap (html/css/js)
/data/                   → Runtime SQLite (gitignored)
/.data/                  → State VPN runtime (gitignored)
/docs/                   → Dokumentasi terstruktur (01- s.d. 08-)
```

## Prinsip Arsitektur (WAJIB)
1. **Pemisahan lapisan:** controller tidak berisi logic scraping; scraper tidak
   tahu frontend; frontend tidak tahu scraper.
2. **Nama situs sumber** (doujin.desu.xxx, nekopoi.care) hanya boleh ada di
   `lib/scraper/`. Lapisan produk (folder web, controller, route, package)
   memakai penamaan domain: manga & video.
3. **Semua data upstream = untrusted** → wajib lolos `validator.js` +
   `security.js` (`safeHttpUrl`, `stripHtml`) sebelum sampai client.
4. **Keamanan non-negotiable:** jangan bocorkan error internal ke client,
   jangan commit secret (.env), jangan log kredensial.
5. **Logic murni vs UI-bound:** helper portable tanpa DOM taruh di
   `website/shared/`; kode yang menyentuh struktur HTML tetap di screen
   script masing-masing halaman. Referensi audit: `docs/06-architecture/module-map.md`.

## Fitur Utama
- Katalog manga: pagination numerik, filter genre/status/tipe, sorting, search
- Reader: lazy-load gambar, progress bar, auto-hide chrome, drawer chapter,
  retry gambar gagal, restore posisi baca (localStorage + sinkron server)
- Video: daftar/kategori/search/jadwal/random, player anti-iklan bertingkat
  (native stream → filtered frame → direct embed), episode & related sidebar
- Bookmark/favorit/riwayat via localStorage; posisi baca tersinkron ke server
  per device ID anonim (header `x-device-id`)
- PWA: service worker (stale-while-revalidate + network-first + offline.html)

## Alur Kerja yang Disarankan
1. Jalankan `npm test` — pastikan baseline hijau sebelum menyentuh kode
2. Perubahan menengah-besar → buat branch git terpisah dulu
3. Satu fitur satu commit; update `docs/04-progress-log/changelog.md`
4. Keputusan arsitektur non-trivial → catat di `docs/08-decisions/decision-log.md`

## Skill Terkait
- `wibudex-design` — QA/refinement UI (dark-first #121316/#0D0C0C, single accent amber, thumb-reachable)
- `comic-design` — identitas visual digali dari bahasa visual komik
- `careful-logic-change` — wajib untuk perubahan logika/perbaikan bug
