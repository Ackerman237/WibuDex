# WibuDex

Aplikasi web **self-hosted** untuk membaca manga/manhwa dan menonton video
streaming — dipakai secara pribadi. Konten dikumpulkan live dari situs sumber
melalui scraper internal; tidak ada CMS dan tidak ada konten yang disimpan
permanen.

## Fitur

- **Manga** — katalog dengan pagination & filter (genre/status/tipe/sorting/search),
  halaman detail, reader dengan lazy-load gambar, progress bar, auto-hide chrome,
  retry gambar gagal, restore posisi baca
- **Video** — daftar/kategori/pencarian/jadwal/video acak, player anti-iklan
  bertingkat (native stream → filtered frame → direct embed), episode & related sidebar
- **Sinkronisasi posisi baca** ke server per device ID anonim (SQLite)
- **PWA** — service worker (stale-while-revalidate + network-first + offline page)

## Tech Stack

| Bagian | Teknologi |
|---|---|
| Runtime | Node.js ≥ 22.5 (ESM, `node:sqlite` built-in) |
| Server | Express 4 + helmet CSP + rate limiting |
| Logging | Pino (structured JSON) |
| Testing | Vitest (unit + integration, offline/mock) |
| Frontend | HTML/CSS/JS vanilla tanpa build step, PWA |

## Menjalankan

```bash
# 1. Install dependencies
npm install

# 2. Siapkan .env (salin dari .env.example lalu isi)
#    Wajib: DOUJIN_APP_SECRET, DOUJIN_SALT (ekstrak via npm run get-secret)
cp .env.example .env

# 3. Jalankan server
npm start
# → http://localhost:3333
```

## Scripts

| Command | Fungsi |
|---|---|
| `npm start` | Jalankan server produksi |
| `npm test` | Semua unit + integration test (Vitest) |
| `npm run lint` | ESLint |
| `npm run demo` | Demo live semua fungsi scraper |
| `npm run demo:manga` / `npm run demo:video` | Demo per modul |
| `npm run get-secret` | Ekstrak secret terbaru dari bundle situs sumber → `.env` |

## Struktur Singkat

```
server.js        Entry point Express
controllers/     Handler API per domain (manga, video, progress)
routes/          Routing per domain (index.js mount semuanya)
lib/             Logic murni: scraper internal, security, validator, db, vpn
middleware/      errorHandler, rateLimit, upstreamResponse
website/         Frontend statis (manga/, video/, shared/, css/)
tests/           Vitest unit + integration (offline, mock)
docs/            Dokumentasi terstruktur (01-project-overview … 08-decisions)
```

Dokumentasi lengkap (arsitektur, security policy, decision log): lihat [`docs/README.md`](docs/README.md).
Panduan untuk AI coding agent: [`AGENTS.md`](AGENTS.md).

## Lisensi

Kode dilisensikan under [MIT](LICENSE).

> **Catatan:** Lisensi hanya mencakup **kode** proyek ini. Wibudex adalah
> scraper/aggregator pribadi self-hosted — tidak dimaksudkan untuk
> redistribusi konten pihak ketiga yang dikumpulkan scraper. Konten tetap
> milik pemiliknya masing-masing.
