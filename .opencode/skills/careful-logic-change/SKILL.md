---
name: careful-logic-change
description: Gunakan skill ini SETIAP KALI akan mengubah atau memperbaiki logika/fungsi kode (bukan sekadar styling/tampilan) — terutama saat memperbaiki bug atau mengubah perilaku suatu fitur. Membantu memastikan perubahan menyelesaikan akar masalah, bukan sekadar gejala, dan tidak menimbulkan efek domino ke bagian lain yang memakai fungsi/data yang sama.
---

# Careful Logic Change Skill

Sebelum mengubah logika apa pun (fungsi, alur data, state di localStorage, event
handler, dsb), jangan langsung tempel perbaikan di titik yang terlihat rusak.
Perilaku ini yang sering menimbulkan efek berantai: fungsi yang sama dipakai di
beberapa screen sekaligus (misal `shared/storage.js` dipakai reader, detail,
library, history), jadi perubahan kecil di satu tempat bisa diam-diam merusak
tempat lain yang tidak sedang dikerjakan.

## Titik Kopling Spesifik Wibudex (cek dulu sebelum edit)

Peta lengkap: `docs/06-architecture/module-map.md`. Yang paling sering jebakan:

- **`website/shared/utils.js`** = sumber kanonik `escapeHtml` & `setupBackToTop`.
  DULUNYA duplikat di 4 tempat dan sudah dibersihkan — **dilarang mendefinisikan
  ulang secara lokal**; import/pakai global dari sini.
- **`website/shared/storage.js`** = 100% logic murni. Pernah ada
  `restoreReadingPosition(imageList, ...)` yang menerima elemen DOM — sudah
  di-refactor keluar jadi `getSavedPage()` murni. Jangan pernah tambah parameter
  DOM ke file ini lagi; query DOM adalah tugas caller (`manga/js/reader.js`).
- **`shared/ui.js` → `renderPaginationControls`** menerima elemen sebagai
  parameter (`pageNumbersEl`, `prevBtnEl`, `nextBtnEl`), bukan akses ID
  hardcoded. Caller yang pass elemen.
- **`lib/scraper/normalizer.js`** (`mapListItem`/`mapDetail`) = kontrak data
  frontend. Mengubah bentuk output = merusak SEMUA screen manga sekaligus;
  field baru boleh ditambah, field lama jangan diubah/dihapus tanpa cek pemakai.
- **Kontrak fungsi publik scraper** (`scrapeMangaList/Detail/ChapterImages/
  Genres`, `scrapeNeko*`) dijaga test — perubahan signature wajib branch +
  persetujuan (lihat juga skill `scraper-resilience`).
- **`controllers/videoController.js`**: nama handler `getVideo*` (bukan
  `getNeko*`); route terpisah per domain di `routes/*.routes.js`.
- **`lib/scraper/fetcher.js`**: retry/timeout/concurrency SUDAH terpusat di sini
  — jangan duplikasi logic retry di level parser/controller.
- **`js/library.js` → `removeStorageItem`**: pure storage (return boolean);
  re-render DOM dilakukan caller, bukan di dalam fungsi ini.

## Langkah Wajib Sebelum Mengubah Kode

1. **Cari akar masalahnya dulu, bukan gejalanya.** Telusuri dari mana data/state
   ini berasal dan ke mana saja alurnya, sebelum menambal di titik yang paling
   terlihat. Tambal di gejala biasanya cuma memindahkan bug ke tempat lain.

2. **Cari semua pemanggil (caller) dari fungsi/variabel yang akan diubah.**
   Grep/cari seluruh project untuk setiap tempat yang memanggil fungsi ini atau
   membaca/menulis key localStorage yang sama. Jangan asumsikan suatu fungsi
   "cuma dipakai di satu tempat" tanpa memverifikasinya lebih dulu.

3. **Petakan dulu dampaknya sebelum menulis kode.** Sebelum mengedit, sebutkan
   secara eksplisit: file/screen apa saja yang memanggil bagian ini, dan apa
   yang mungkin terpengaruh jika perilakunya berubah. Kalau daftar dampaknya
   ternyata luas, ini sinyal untuk berhati-hati — bukan alasan untuk berhenti
   menganalisis lebih dalam.

4. **Selesaikan sampai ke akar, jangan berhenti di tambalan cepat.** Kalau
   solusi cepat terasa seperti "menutupi" masalah (contoh: menambah pengecekan
   null di satu tempat tanpa tahu kenapa nilainya bisa null), itu tanda
   perbaikan belum sampai ke akar. Jelaskan alasan sebenarnya masalah itu
   terjadi sebelum menulis perbaikan.

5. **Setelah mengubah, verifikasi ulang semua caller yang terdaftar di langkah 2**
   — bukan cuma titik yang tadinya bermasalah. Pastikan screen lain yang
   memakai fungsi/data yang sama tetap berjalan seperti sebelumnya.

## Kalau Ternyata Perubahan Berdampak Luas

Jika saat menganalisis ternyata perubahan ini menyentuh banyak file/screen
sekaligus, ikuti aturan branching & reorganisasi file yang sudah ada di
AGENTS.md: kerjakan di branch terpisah, dan laporkan ke user dulu cakupan
dampaknya sebelum lanjut mengeksekusi — jangan diam-diam memperbaiki banyak
tempat sekaligus tanpa sepengetahuan user.

## Yang Harus Dihindari

- Mengubah logika di satu file untuk "memperbaiki" gejala yang muncul di file lain,
  tanpa memahami hubungan keduanya.
- Menambah kode defensif (try-catch, pengecekan null, fallback diam-diam) sebagai
  pengganti memahami kenapa error itu terjadi.
- Mengubah fungsi bersama (shared function di storage.js/render.js/data.js) tanpa
  mengecek dulu semua screen yang memakainya.
- Melakukan banyak perbaikan logika sekaligus dalam satu perubahan tanpa memisahkan
  mana yang benar-benar terkait — ini bikin sulit melacak efek domino kalau ada
  yang salah.
- **Dual source of truth untuk state UI** (hasil postmortem 2026-08-24):
  mengelola satu kondisi lewat dua mekanisme sekaligus (mis. atribut `hidden`
  + class `is-open`) lalu hanya membuka salah satunya — panel tak pernah
  muncul. Satu state = satu mekanisme toggling; untuk popover pakai
  class-driven visibility. Narasi: `docs/04-progress-log/reports/
  2026-08-24-dropdown-bug-postmortem.md`.
