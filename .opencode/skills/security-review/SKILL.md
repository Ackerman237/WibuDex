---
name: security-review
description: Gunakan skill ini SETIAP KALI menambah atau mengubah route/controller baru, atau menyentuh titik yang menerima input dari luar (query, body, header, URL hasil scraping). Memastikan input attacker-controlled tervalidasi/tersanitasi konsisten, tanpa menandai false-positive dari proteksi yang sebenarnya sudah ada.
---

# Security Review Skill

Project ini sudah punya lapisan proteksi nyata — bukan mulai dari nol. Tugas skill
ini adalah memastikan **titik masuk baru** ikut pola yang sudah ada, dan mencegah
laporan temuan yang sebenarnya sudah tertangani.

## Cek Dulu Apa yang Sudah Ada (sebelum menandai apa pun sebagai temuan)

- `lib/security.js` — `safeHttpUrl()` (validasi protokol http/https + blokir
  private/localhost host, untuk SSRF generik), `safeImageUrl()` (safeHttpUrl +
  allowlist domain gambar via `ALLOWED_IMAGE_DOMAIN_SUFFIXES`), `stripHtml()`
  (buang script/style/tag dari teks hasil scraping), `sanitizeUrl()` (blokir skema
  `javascript:`/`data:`/`vbscript:`).
- `lib/imageProxy.js` — endpoint proxy gambar (`proxyImage`) sudah memvalidasi via
  `safeImageUrl`, menolak redirect upstream, membatasi ukuran (`IMAGE_MAX_SIZE`),
  dan mem-whitelist content-type.
- `controllers/progressController.js` — header `x-device-id` dan body
  (`mangaSlug`, `chapterId`, `page`, `coverUrl` via `safeImageUrl`) sudah
  divalidasi lewat fungsi `sanitize*` lokal dengan batas panjang eksplisit.
- `middleware/rateLimit.js` — `generalLimiter` (60/menit) dan `proxyLimiter`
  (120/menit), key berbasis `CF-Connecting-IP` lalu fallback `req.ip`.
- `lib/validator.js` — validasi query publik (`validatePage`, `validateLimit`,
  `validateSlug`, `validateId`, `validateEnum`, dst) dipakai di semua controller
  manga/neko.

**Kalau titik masuk baru sudah lewat salah satu di atas, itu bukan temuan.**
Baca dulu `lib/security.js`, `lib/validator.js`, controller terkait, dan
`middleware/` sebelum menyimpulkan sesuatu "belum divalidasi".

## Prinsip Inti

1. **Konfirmasi attacker-controlled dulu.** Tanya: apakah nilai ini benar-benar
   bisa dikontrol pengunjung (query param, body, header, atau hasil scraping dari
   situs sumber), atau berasal dari config internal (`.env`, konstanta kode)?
   Yang kedua bukan temuan security.
2. **Cek apakah sudah ada proteksi sebelum menandai.** Pattern-matching tanpa
   membaca kode nyata di sekitar titik itu menghasilkan banyak false-positive
   (contoh klasik: menandai path internal sebagai SSRF padahal sudah lewat
   `safeHttpUrl`).
3. **Cakupan minimal setiap review:**
   - Input handling & validasi di controller (`controllers/*.js`) — apakah pakai
     `lib/validator.js` / pola sanitasi lokal yang konsisten dengan yang sudah ada?
   - SSRF — khusus route yang fetch URL dari input/hasil scraping (image-proxy,
     player frame). URL baru yang di-fetch server-side wajib lewat `safeHttpUrl`
     atau `safeImageUrl`, bukan `fetch()` langsung ke URL mentah.
   - XSS — konten hasil scraping (title, synopsis, dsb) yang dirender ke DOM di
     frontend wajib sudah lewat `stripHtml`/`cleanText` di layer scraper sebelum
     sampai ke client; jangan render `innerHTML` dari string mentah di
     `website/**/js/*.js`.
   - Rate limiting — endpoint baru yang publik dan berat (fetch upstream/proxy
     gambar) sebaiknya pakai `generalLimiter`/`proxyLimiter` yang sudah ada,
     bukan bikin limiter baru tanpa alasan.
   - Secrets/`.env` — `DOUJIN_APP_SECRET`, `DOUJIN_SALT` tidak pernah di-log
     (`lib/logger.js` pakai Pino — pastikan objek yang di-log tidak menyertakan
     field ini mentah) atau dikembalikan di response API.

## Kalau Menemukan Celah Nyata

Jelaskan secara spesifik: titik masuk mana, kenapa attacker-controlled, dan kenapa
proteksi yang ada (kalau ada) tidak menutupinya. Untuk perbaikan, ikuti pola yang
sudah dipakai project (reuse `safeHttpUrl`/`safeImageUrl`/`stripHtml`/pattern
`sanitize*` lokal) — jangan perkenalkan library validasi baru tanpa alasan kuat.

Checklist detail (kalau dibutuhkan referensi lebih lengkap saat audit menyeluruh)
ada di `references/owasp-checklist.md`.
