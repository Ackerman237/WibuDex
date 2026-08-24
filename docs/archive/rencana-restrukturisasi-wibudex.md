# Rencana Restrukturisasi Project Wibudex

Dokumen ini berisi rekomendasi perubahan struktur (nama folder, file, dan
organisasi) sebelum UI dibangun dari nol. Momennya pas karena
`website/doujinPage/html/` masih kosong — belum ada HTML yang bergantung
pada nama folder lama, jadi rename sekarang jauh lebih murah daripada nanti.

Prinsip dasar semua rekomendasi di sini: **nama situs sumber (doujin.desu.xxx,
nekopoi.care) boleh muncul di lapisan internal scraper (`lib/scraper/`),
tapi tidak boleh bocor ke lapisan produk** (folder web, controller, route,
nama package). Orang yang buka project ini dari luar harus langsung paham
ini aplikasi "Wibudex" dengan fitur Manga & Video — bukan "scraper dua situs
yang dibungkus jadi web app".

---

## Prioritas Tinggi — lakukan sekarang, sebelum HTML dibangun

### 1. `website/doujinPage/` → `website/manga/`
**Kenapa:** Nama folder ini nempel dari "doujin.desu.xxx" (situs sumber scraper),
bukan dari domain produk. Bottom nav yang sudah direncanakan pakai label
"Manga" — foldernya harus konsisten dengan itu. Nama `doujinPage` juga
berpotensi ambigu/misleading karena "doujin" punya konotasi genre tertentu
di luar konteks scraper, padahal isi section ini seharusnya manga secara umum.

### 2. `website/nekoPage/` → `website/video/`
**Kenapa:** Sama alasannya dengan di atas — "neko" berasal dari nekopoi.care
(situs sumber), bukan istilah yang berarti apa-apa buat pengguna akhir atau
developer baru yang baca kode ini.

### 3. `controllers/nekoController.js` → `controllers/videoController.js`
**Kenapa:** `mangaController.js` sudah dinamai dari domain (benar). `nekoController.js`
tidak konsisten — masih dinamai dari situs sumber. Setelah rename, kedua
controller sama-sama domain-named: manga & video.

### 4. `package.json` — field `name` dan `description`
**Sekarang:**
```json
"name": "doujin-scraper",
"description": "Scraper untuk doujin.desu.xxx dan nekopoi.care"
```
**Jadi (contoh):**
```json
"name": "wibudex",
"description": "Wibudex — aplikasi self-hosted PWA manga reader & video streaming"
```
**Kenapa:** Ini identitas resmi project di level metadata. Kalau ada yang
`npm view`, baca `package-lock.json`, atau lihat CI badge, yang muncul masih
nama lama yang scraper-sentris, bukan nama produk yang sudah dipakai
sehari-hari ("Wibudex").

### 5. `AGENTS.md` (root) — mendeskripsikan arsitektur yang sama sekali berbeda dari kenyataan
Isi `AGENTS.md` saat ini bilang project ini **"tanpa backend/database"**, data
disimpan di **`/data/comics.json`** statis, JS dipisah jadi `/assets/js/core/`
vs `/assets/js/screens/`, dan strukturnya `index.html`/`catalog.html`/`detail.html`
langsung di root.

Kenyataannya sekarang: ada Express server (`server.js`), controller
(`controllers/`), route (`routes/`), SQLite (`lib/db.js`, `data/app.db`), dan
scraper (`lib/scraper/`). Ini bukan revisi kecil — ini dua konsep project yang
berbeda total (static localStorage-only app vs. backend server + scraper).

**Kenapa ini genting:** `AGENTS.md` di root adalah file pertama yang dibaca AI
coding agent (opencode) sebelum ambil keputusan struktural. Kalau agent percaya
isinya mentah-mentah, dia bisa mengira backend "tidak boleh ada", mencoba
pindahkan logic ke localStorage, atau bikin ulang `data/comics.json` yang
sudah tidak dipakai lagi.

**Yang disarankan:** tulis ulang total (bukan edit sebagian) supaya cocok
dengan arsitektur real saat ini: Express + controller/route + SQLite + scraper.

### 6. Nama repo GitHub itu sendiri masih `Scrapper-manga`
`git remote -v` → `github.com/Ackerman237/Scrapper-manga.git`. Ini lapisan
paling publik dari semua — URL yang dibagikan ke orang lain, muncul di clone
command, muncul di GitHub search. Rename `package.json` jadi "wibudex" percuma
kalau alamat repo-nya sendiri masih bernama generik "Scrapper-manga" — artinya
ada 3 nama berbeda untuk 1 project: nama repo (`Scrapper-manga`), nama lama di
`package.json` (`doujin-scraper`), dan nama produk yang sebenarnya (`Wibudex`).

**Yang disarankan:** rename repo di GitHub Settings. Aman — GitHub otomatis
redirect dari URL lama ke URL baru, jadi clone/link lama tidak langsung mati.

---

## Prioritas Sedang — rapikan dokumentasi & shared assets

### 7. Gabungkan `docs/` ke dalam `manga-scraper-docs/`, lalu rename jadi `docs/`
**Masalah sekarang:** Ada dua sistem dokumentasi paralel:
- `docs/` — cuma 2 file (`IDEAS.md`, `STYLE_GUIDE.md`), tidak terstruktur
- `manga-scraper-docs/` — sistem rapi 8 folder bernomor (`01-project-overview`
  sampai `08-decisions`) plus archive

**Yang disarankan:**
1. Pindahkan `docs/IDEAS.md` → `manga-scraper-docs/05-roadmap/ideas.md`
2. Pindahkan `docs/STYLE_GUIDE.md` → `manga-scraper-docs/06-architecture/style-guide.md`
   (setelah disinkronkan dengan `wibudex-tokens.css`, sesuai task sebelumnya)
3. Hapus folder `docs/` yang lama
4. Rename `manga-scraper-docs/` → `docs/`

**Kenapa:** Dua sumber dokumentasi bikin bingung mana yang jadi acuan. Nama
`manga-scraper-docs` juga sudah tidak akurat — sistemnya mencakup video/neko
juga, bukan cuma manga scraper.

### 8. `MODULE_MAP.md` (di root) → `docs/06-architecture/module-map.md`
**Kenapa:** Isinya bagus (audit logic-murni vs UI-bound per file), tapi
nyangkut sendirian di root sementara semua dokumentasi arsitektur lain ada
di sistem `manga-scraper-docs/06-architecture/`. Harusnya masuk situ juga.

### 9. `website/doujinPage/shared/*` → `website/shared/*`
**Isi folder ini:** `api.js`, `storage.js`, `ui.js`, `nav.js`, `bottom-nav.js`

**Kenapa:** Folder ini isinya logic yang dipakai bersama (fetch API, localStorage,
render card, dsb). Sekarang nested di dalam `doujinPage/`, padahal begitu
`video/` (dulu `nekoPage`) ikut dimigrasi ke tema Amber yang sama, dia juga
akan butuh fungsi-fungsi ini. Kalau tetap di dalam folder `manga/`, nanti kode
`video/` harus import `../manga/shared/ui.js` — aneh dan bikin folder `manga`
kelihatan seperti folder induk `video`, padahal keduanya sejajar.

> **Catatan eksekusi:** folder `website/shared/` **sudah dibuat** tapi masih
> kosong — rencana ini sudah "setengah jalan". Tinggal `git mv` isi
> `website/doujinPage/shared/*` masuk ke situ, tidak perlu bikin folder baru.

### 10. Pecah `routes/api.js` jadi beberapa file per domain
**Sekarang:** 1 file, ~20 route, campur manga + video + progress + vpn-status.

**Jadi:**
```
routes/
├── index.js           # mount semua router di bawah ini
├── manga.routes.js
├── video.routes.js
├── progress.routes.js
└── vpn.routes.js
```
**Kenapa:** File tunggal yang mencampur banyak domain kurang scalable dan
kurang enak dibaca. Route grouping per domain adalah pola umum di project
Express yang dianggap matang/production-grade.

### 11. npm scripts di `package.json` masih pakai flag `doujin`/`neko`
```json
"demo:doujin": "node --env-file=.env scripts/demo.js --doujin-only",
"demo:neko": "node --env-file=.env scripts/demo.js --neko-only",
```
**Kenapa:** Kelewat dari rencana rename controller/folder — begitu
`nekoController.js` → `videoController.js` dan folder `doujinPage`/`nekoPage`
di-rename, flag CLI ini juga harus ikut jadi `demo:manga` / `demo:video` (dan
cek `scripts/demo.js` yang parsing `--doujin-only`/`--neko-only`) supaya
konsisten dengan penamaan baru.

---

## Prioritas Rendah — kosmetik, opsional

### 12. Bersihkan `.data/spike/`
Folder ini isinya dump HTML debug lama (`embed-0-playmogo.com.html`, dst)
dan log server (`server-err.log`, `server-out.log`) dari sesi eksplorasi.
Sudah di-`.gitignore`, jadi tidak masalah dari sisi git — tapi kalau mau
folder lokal kelihatan bersih, bisa dihapus manual atau dipindah ke
`.data/debug/` yang jelas statusnya "buangan sementara".

### 13. Gabungkan `data/` dan `.data/`
Ada dua folder data terpisah: `data/app.db` (SQLite reading progress) dan
`.data/vpn-state.json` + `.data/spike/`. Bisa disatukan jadi `.runtime/`
kalau mau lebih rapi, tapi ini murni kosmetik dan tidak mendesak.

### 14. `scripts/dev/` numpuk banyak script spike/probe — sama sifatnya dengan `.data/spike/`
Ada `probe-stream.mjs`, `probe-hero.mjs`, `probe-dom.mjs`, `probe-detail.mjs`,
`dump-embed.mjs`, `m3u8-spike.mjs`, `replace-emoji-html.mjs` — bercampur dengan
tool dev yang jelas masih dipakai (`verify-icons.mjs`, `verify-assets.mjs`,
`ui-check.mjs`).

**Yang disarankan (opsional, tidak mendesak):** pisahkan ke
`scripts/dev/spikes/` atau hapus yang sudah tidak relevan, biar `scripts/dev/`
gampang dibaca mana yang tooling aktif vs sisa eksplorasi lama.

---

## Temuan tambahan — ditemukan setelah cek `server.js`, `README.md`, dan `.agents/`

### 15. `README.md` bukan README project — isinya skema data mati
**Masalah:** File `README.md` di root (yang pertama dibaca siapa pun yang buka
repo ini) isinya bukan perkenalan project, melainkan dokumentasi skema
`comics.json`. Sudah dicek dengan grep ke seluruh kode — **tidak ada satupun
file `.js` yang mereferensikan `comics.json`**. Ini peninggalan dari fase awal
sebelum scraper dibuat (dulu mungkin data manga di-hardcode di JSON statis).

**Kenapa ini penting:** README adalah wajah pertama project. Kalau isinya
skema data yang sudah mati, kesan pertama justru "project ini belum matang/
belum di-maintain", padahal sebaliknya — scraper & testnya sudah solid.

**Yang disarankan:** Tulis ulang `README.md` jadi README project yang sebenarnya:
apa itu Wibudex, cara install & jalankan (`npm install`, isi `.env`, `npm start`),
tech stack singkat, dan cara run test (`npm test`). Isi lama tentang skema
`comics.json` bisa diarsipkan ke `docs/` kalau masih ada nilai historisnya,
atau dihapus kalau memang sudah tidak relevan.

### 16. `server.js` — hardcode path lama + satu mounting yang salah sasaran
Sudah dicek isinya langsung, ada 3 baris yang perlu diperbaiki (bukan cuma
di-rename, tapi juga dibenerin logikanya):

```js
app.get('/', (_req, res) => {
  res.redirect('/doujinPage/html/index.html');
});

app.use(
  '/doujinPage/html',
  express.static(path.join(__dirname, 'website', 'doujinPage'), { setHeaders: staticCacheHeaders })
);
```

Baris kedua ini **salah mapping**: dia bilang "URL `/doujinPage/html/*` disajikan
dari disk folder `website/doujinPage`" (bukan `website/doujinPage/html`).
Padahal folder `website/` secara keseluruhan sudah di-serve sebagai static
lewat baris sebelumnya (`app.use(express.static(path.join(__dirname, 'website'))...)`),
yang otomatis sudah bikin `website/doujinPage/html/index.html` bisa diakses
di URL `/doujinPage/html/index.html` TANPA butuh mounting kedua ini sama sekali.
Jadi mounting kedua ini murni redundan dan membingungkan — kemungkinan sisa
percobaan debug yang lupa dihapus.

**Yang disarankan:** saat rename `doujinPage`→`manga` dan `nekoPage`→`video`,
sekalian hapus mounting redundan ini, dan sederhanakan jadi pola konsisten:
tidak perlu mounting eksplisit tambahan untuk `manga` maupun `video` — cukup
andalkan satu `express.static(website)` di awal, karena keduanya sudah otomatis
ter-cover. Redirect `/` cukup diarahkan ke `/manga/index.html` (setelah HTML-nya ada).

### 17. `.agents/DoujinScraperAgent.md` — diagram struktur file sudah basi
File instruksi untuk AI agent ini menggambarkan struktur:
```
lib/
├── scraper.js              # Re-export publik: scrapeMangaList, ...
├── nekoScraper.js          # Re-export publik: scrapeNekoList, ...
```
Padahal struktur asli sekarang adalah `lib/scraper/index.js`,
`lib/scraper/doujinScraper.js`, `lib/scraper/nekoScraper.js` (nested di
subfolder `scraper/`, bukan file langsung di `lib/`). File `lib/scraper.js`
dan `lib/nekoScraper.js` top-level **tidak ada** — sudah dicek langsung.

**Kenapa ini penting:** ini file instruksi yang dibaca AI agent (opencode)
sebelum kerja. Kalau agent percaya diagram ini mentah-mentah, dia bisa salah
cari file atau bikin file baru di lokasi yang salah. Perlu diperbaiki supaya
tetap akurat.

### 18. Tidak ada file `LICENSE`, padahal `package.json` mengklaim `"license": "MIT"`
**Ini perlu keputusan kamu dulu, bukan langsung dieksekusi:** Wibudex pada
dasarnya adalah scraper konten dari situs pihak ketiga untuk pemakaian
pribadi (self-hosted). Mengklaim lisensi MIT (open source, siapa pun boleh
pakai/redistribusi) untuk project semacam ini agak riskan kalau publish
publik, karena kontennya bergantung pada scraping situs yang mungkin tidak
mengizinkan redistribusi.

**Opsi:**
- (a) Tetap MIT untuk **kode**-nya saja (bukan kontennya), tambahkan file
  `LICENSE` standar MIT + catatan di README "kode di bawah MIT, tapi project
  ini tidak dimaksudkan untuk redistribusi konten hasil scraping."
- (b) Ganti `package.json` → `"license": "UNLICENSED"` dan tambahkan
  `"private": true`, kalau memang niatnya cuma dipakai sendiri dan repo-nya
  privat.

Kasih tau mau pilih yang mana, baru aku eksekusi.

---

## Yang JANGAN diubah

- `lib/scraper/nekoScraper.js`, `lib/scraper/doujinScraper.js`, dan semua
  isi `lib/scraper/` — nama-nama ini **benar** dinamai dari situs target,
  karena memang tugasnya scraping situs spesifik itu. Yang salah hanya kalau
  nama situs bocor ke lapisan produk (controller, route, folder web) — bukan
  di lapisan scraper internal itu sendiri.
- `middleware/`, `tests/`, seluruh isi `lib/` lainnya — sudah matang dan
  terverifikasi (116 test lulus), tidak perlu disentuh untuk kebutuhan restrukturisasi ini.

---

## Ringkasan dampak

| Prioritas | Jumlah perubahan | Risiko kalau ditunda |
|---|---|---|
| Tinggi | 6 perubahan | Naik drastis begitu HTML `manga/` mulai dibangun, dan makin lama makin banyak yang trust/link ke nama lama (repo, package, AGENTS.md) |
| Sedang | 5 perubahan | Sedang — makin banyak dokumen/command baru ditulis pakai penamaan/lokasi lama |
| Rendah | 3 perubahan | Rendah — kosmetik, bisa kapan saja |
| Butuh keputusan dulu | 1 (LICENSE) | — |