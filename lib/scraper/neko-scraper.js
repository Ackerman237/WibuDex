// nekoScraper.js — Pintu masuk publik scraper nekopoi.
// Implementasi terbagi di lib/scraper/neko/:
//   http.js     — fetch HTML + VPN routing + retry dengan timeout
//   text.js     — util teks & URL (decodeEntities, cleanText, safeUrl)
//   parsers/    — parser HTML (cards, detail, schedule)
//   index.js    — orkestrasi fungsi publik + cache
// Kontrak ekspor tidak berubah bagi konsumen lama.
export * from './neko/index.js';
