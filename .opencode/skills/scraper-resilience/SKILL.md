---
name: scraper-resilience
description: Gunakan skill ini SETIAP KALI scraper gagal (parser error, hasil kosong, format berubah, host player tidak dikenal) atau saat menambah/mengubah parser doujin.desu.xxx maupun nekopoi.care. Melengkapi agent @doujin-scraper dengan urutan diagnosis yang konsisten, supaya perbaikan tidak asal tambal regex atau restrukturisasi besar tanpa alasan.
---

# Scraper Resilience Skill

Melengkapi `.opencode/agents/doujin-scraper.md` — dipakai khusus saat parser
gagal atau perlu disesuaikan dengan perubahan situs sumber. Bukan pengganti
agent tsb, hanya urutan diagnosis yang wajib dijalankan lebih dulu.

## Urutan Diagnosis (wajib, jangan lompat ke langkah 4)

1. **Cek response mentah dulu, bukan asumsi bug di kode kita.**
   Jalankan `npm run demo` (atau `demo:manga` / `demo:video`) untuk lihat apakah
   situs sumber sedang down/berubah/nge-block, sebelum menuduh kode parser.
   Kalau demo juga gagal dengan cara yang sama di semua chapter/kategori,
   kemungkinan besar ini masalah upstream (VPN/proxy/situs), bukan regex yang
   rusak.

2. **Cek apakah selector/struktur HTML berubah.**
   `lib/scraper/neko/parsers/*.js` (anchors.js, cards.js, detail.js,
   schedule.js) parsing pakai `indexOf`/regex terhadap penanda class HTML
   tertentu (misal `class="nk-post-card"` di `cards.js`) — bukan HTML parser
   library. Kalau situs ubah nama class/struktur div, parser diam-diam
   mengembalikan array kosong tanpa error eksplisit. Bandingkan HTML mentah
   (dari langkah 1) dengan penanda yang dicari parser.

3. **Cek apakah host player baru perlu masuk allowlist.**
   `lib/config/playerHosts.js` adalah satu-satunya sumber kebenaran daftar host
   player (`DEFAULT_PLAYER_HOSTS`, override via env `NEKO_PLAYER_HOSTS`).
   Sebelumnya ini pernah drift ke 3 file berbeda dengan daftar berbeda-beda —
   jangan ulangi pola itu. Kalau parser nemu host player baru yang valid,
   update daftar di file ini, jangan bikin exception ad-hoc di
   `nekoScraper.js`/`playerFrame.js`.

4. **Baru pertimbangkan ubah kode parser**, setelah langkah 1–3 dicek dan
   memang kode parser yang salah (bukan situs down atau host belum di-allowlist).

## Batasan Perbaikan

- **Tetap zero-dependency/regex-based** kecuali ada alasan kuat untuk pindah ke
  HTML parser library — ini prinsip yang sudah dipegang project (lihat
  `.opencode/agents/doujin-scraper.md`: "Zero runtime dependency baru: jangan
  tambah axios, cheerio, jsdom, dll"). Jangan diam-diam nambah dependency baru
  untuk "mempermudah" parsing.
- **Fokus murni robustness & maintainability parser milik sendiri** — bukan
  teknik evasion/anti-deteksi pihak ketiga.
- **Retry/timeout/concurrency** sudah dihandle di `lib/scraper/fetcher.js`
  (`MAX_RETRIES=2`, `RETRYABLE_STATUS` 502/503/504, `MAX_CONCURRENCY=5`,
  timeout 12s). Kalau kegagalan sebenarnya soal timeout/retry, itu domain file
  ini — jangan duplikasi logic retry di level parser.
- **Cache** (`lib/scraper/cache.js`, `CacheManager`) — pastikan hasil gagal
  (error/kosong) tidak ikut ter-cache dengan TTL yang sama seperti hasil
  sukses; cek titik `cache.set()` di `doujinScraper.js`/`nekoScraper.js`
  sebelum mengubah alur cache.

## Setelah Perbaikan

- Jalankan `npm test` (baseline harus tetap hijau) lalu `npm run demo` untuk
  verifikasi live.
- Catat perubahan signifikan di `docs/04-progress-log/changelog.md`
  sesuai konvensi yang sudah ada di project.
