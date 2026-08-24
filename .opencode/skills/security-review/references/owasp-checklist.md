# Checklist Detail — Audit Menyeluruh

Dimuat on-demand dari `security-review/SKILL.md` saat audit menyeluruh dibutuhkan
(bukan untuk review titik-per-titik yang cepat). Tetap konfirmasi attacker-controlled
+ proteksi eksisting dulu sebelum menandai apa pun di bawah ini sebagai temuan.

## SSRF (route: image-proxy, player frame, apa pun yang fetch URL dari input)
- URL yang di-fetch server-side wajib lewat `safeHttpUrl`/`safeImageUrl`
  (`lib/security.js`) — bukan `fetch()` langsung ke `req.query.url` mentah.
- Redirect dari upstream: `lib/imageProxy.js` sudah menolak status 300–399
  (`Redirect gambar tidak diizinkan`) — pola ini yang harus diikuti kalau ada
  proxy baru, jangan `redirect: 'follow'` diam-diam.
- Host privat/internal (`isPrivateHost`) — cek IPv4 private range + localhost;
  kalau nambah proxy baru untuk jenis resource lain, reuse fungsi ini, jangan
  tulis ulang regex sendiri.
- Allowlist domain (image, player host di `lib/config/playerHosts.js`) — kalau
  parser scraper menemukan host baru, itu keputusan produk (update allowlist),
  bukan sekadar "biarkan lolos validasi".

## XSS dari konten hasil scraping
- Semua teks dari situs sumber (title, synopsis, deskripsi chapter) wajib lewat
  `stripHtml`/`cleanText` sebelum masuk response API.
- Di frontend (`website/**/js/*.js`): render teks manga/doujin pakai
  `textContent`, bukan `innerHTML`, kecuali sudah eksplisit di-sanitasi di
  layer scraper.
- URL gambar/thumbnail dari scraping wajib lewat `safeImageUrl`, bukan
  di-render langsung sebagai `src` dari string mentah hasil parsing.

## Input handling per controller
- Query/param: pakai `lib/validator.js` (`validatePage`, `validateLimit`,
  `validateSlug`, `validateId`, `validateCategory`, `validateEnum`).
- Header custom (`x-device-id`): whitelist karakter eksplisit
  (`/^[a-zA-Z0-9_-]+$/` di `progressController.js`) + batas panjang — pola ini
  yang harus diikuti untuk header custom baru.
- Body JSON: validasi tipe (`typeof === 'string'`) + `.slice()` batas panjang
  sebelum disimpan ke DB, jangan percaya bentuk body dari client.

## Rate limiting
- `middleware/rateLimit.js`: key berbasis `CF-Connecting-IP` (Cloudflare edge,
  tidak bisa dipalsukan lewat tunnel) lalu fallback `req.ip`.
- Endpoint baru yang berat (fetch upstream, proxy gambar/video) → pasang salah
  satu limiter yang sudah ada di route-nya (`routes/api.js`), jangan biarkan
  tanpa limiter sama sekali.

## Secrets & `.env`
- `DOUJIN_APP_SECRET`, `DOUJIN_SALT`, `NEKO_PROXY_URL` tidak pernah masuk log
  (`lib/logger.js` Pino) atau response API — cek objek yang di-`logger.error`/
  `logger.warn` tidak menyertakan field ini secara utuh.
- Kalau nambah proxy URL baru ke log (misal untuk debug), pakai pola `maskUrl()`
  di `lib/scraper/fetcher.js` (mask credential di URL), jangan log mentah.

## Yang BUKAN temuan (hindari false-positive)
- Path/URL yang berasal dari konstanta kode (`API_BASE`, `lib/constants.js`)
  atau `.env` server-side, bukan dari input pengunjung.
- Fetch ke `API_BASE` (`https://doujin.desu.xxx`) di `doujinScraper.js` — ini
  target tetap, bukan URL attacker-controlled.
- Penggunaan `dangerouslySetInnerHTML`-setara yang sudah menerima input dari
  `stripHtml()`, bukan string mentah.
