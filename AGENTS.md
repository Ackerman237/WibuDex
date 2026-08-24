# AGENTS.md — Comic Reader (Personal Project)

## Ringkasan Proyek
Website baca komik untuk penggunaan pribadi, **tanpa sistem login/akun**.
Terinspirasi dari fitur-fitur situs seperti Shinigami, Mangadesu, Doujindesu — tapi
tampilan HARUS punya identitas visual sendiri, bukan tiruan/generic clone.

## Batasan Teknis Penting
- **Tidak ada backend/database.** Semua data komik disimpan sebagai file JSON lokal
  di `/data/`. Semua data personal (bookmark, riwayat baca, posisi scroll terakhir)
  disimpan di **localStorage** browser, bukan server.
- Stack: HTML/CSS/JS vanilla. Boleh pakai **Alpine.js** untuk interaktivitas ringan
  jika perlu, tapi jangan tambah framework build-tool berat (React/Vue/dst) kecuali
  diminta eksplisit.
- Semua halaman harus tetap berfungsi dibuka langsung dari file (atau live server
  sederhana), tanpa proses build wajib.

## Struktur Folder
```
/index.html              → homepage (highlight, rilisan terbaru)
/catalog.html             → daftar semua komik + filter genre/status/tipe + search
/detail.html?id=...       → detail komik (sinopsis, daftar chapter, tags)
/reader.html?id=..&ch=..  → halaman baca
/assets/css/
/assets/js/
  /core/                 → LOGIC MURNI, tidak boleh menyentuh DOM sama sekali
    - storage.js         → helper localStorage (bookmark, history, last-read position)
    - data.js            → loader & parsing data komik dari JSON lokal
    - (fungsi bisnis lain: filter/sort katalog, hitung progress, format data, dst)
  /screens/              → UI-BOUND, boleh manipulasi DOM & terikat struktur HTML tertentu
    - home.js            → perilaku index.html
    - catalog.js         → perilaku catalog.html
    - detail.js          → perilaku detail.html
    - reader.js          → perilaku reader.html
/data/comics.json         → data komik (dummy/koleksi pribadi)
```

**Aturan pemisahan /core/ vs /screens/ (wajib dipatuhi):**
- File di `/core/` DILARANG berisi `document.querySelector`, `getElementById`,
  `addEventListener`, `innerHTML`, atau referensi apa pun ke struktur/class/id HTML.
  Kalau sebuah fungsi butuh itu, fungsi itu bukan logic murni — taruh di `/screens/`.
- File di `/screens/` boleh memanggil fungsi dari `/core/`, tapi tidak sebaliknya —
  `/core/` tidak boleh bergantung pada `/screens/`.
- Tujuannya: kalau suatu saat UI didesain ulang dari nol, seluruh isi `/core/` bisa
  langsung di-copy ke project baru tanpa perlu ditulis ulang, karena tidak terikat
  pada struktur HTML/tampilan yang mana pun.

## Fitur Wajib
- Homepage: carousel/highlight komik populer + rilisan terbaru
- Katalog dengan filter (genre, status ongoing/tamat, tipe manga/manhwa/manhua) + search instan
- Halaman detail: sinopsis, daftar chapter, tags, rating
- Reader dengan 2 mode: **vertical scroll** (manhwa) dan **page-by-page** (manga), bisa di-toggle
- Bookmark / Favorit → localStorage
- Riwayat baca + "Lanjutkan membaca" dari posisi terakhir → localStorage
- Dark mode sebagai default (bukan opsional tambahan)
- Reader: auto-hide navbar saat scroll, progress bar chapter, tombol next/prev chapter,
  preload gambar chapter berikutnya

## Prinsip Desain — WAJIB DIBACA SEBELUM MENULIS UI
Gunakan skill `comic-design` (lihat `.opencode/skills/comic-design/SKILL.md`) setiap kali
mengerjakan tampilan/UI. Jangan langsung menulis CSS/komponen visual tanpa melalui skill ini.

Untuk perubahan logika/fungsi (bukan tampilan) — terutama perbaikan bug — gunakan skill
`careful-logic-change` (lihat `.opencode/skills/careful-logic-change/SKILL.md`) setiap kali.
Jangan langsung menambal kode tanpa menelusuri akar masalah dan dampaknya ke bagian lain.

Poin singkat yang tidak boleh dilanggar:
- Dilarang pakai 3 pola desain "default AI": (1) krem + serif kontras + aksen terracotta,
  (2) hitam pekat + 1 aksen neon generik, (3) broadsheet garis tipis ala koran — kecuali
  memang sudah dipertimbangkan sadar dan punya alasan kuat untuk proyek ini.
- Warna, tipografi, dan elemen UI harus digali dari dunia komik itu sendiri (panel, speech
  bubble, sound effect/SFX, halftone, garis speed-line), bukan dari template dashboard/SaaS umum.
- Sebelum menulis kode UI baru, buat dulu "token plan" singkat (warna, tipografi, layout,
  signature element) dan minta konfirmasi/review singkat sebelum lanjut coding.

## Alur Kerja yang Disarankan (kerjakan bertahap, jangan sekaligus)
1. Setup struktur file + `data/comics.json` (data dummy)
2. Homepage + catalog (grid, filter, search) — fokus styling di tahap ini dulu
3. Halaman detail komik
4. Halaman reader (paling kompleks — kerjakan terpisah, jangan digabung tahap lain)
5. Integrasi localStorage (bookmark, history, continue reading)
6. Polish akhir: dark mode konsistensi, animasi secukupnya, cek responsive mobile/desktop

## Aturan Branching untuk Perubahan Menengah-Besar

Untuk perubahan yang lumayan besar (reorganisasi file, fitur baru, refactor
signifikan — bukan sekadar typo/tweak kecil), buat dulu branch git terpisah
sebelum mulai mengerjakan, jangan langsung kerja di branch utama. Tujuannya
supaya progres tiap perubahan besar bisa dilacak dan mudah di-rollback kalau
ada yang salah. Beri nama branch yang jelas sesuai perubahannya (misal:
`reorganize-js-structure`, `feature-reader-page-mode`).

## Aturan Reorganisasi File (Pemindahan Folder/File)

Kalau diminta memindahkan file atau folder (HTML, CSS, JS, dsb) ke lokasi lain,
ini HARUS berupa **pure file move**, bukan menulis ulang isi file:

- Gunakan perintah `git mv` (atau `mv` biasa) untuk memindahkan file. JANGAN membaca
  isi file lalu menuliskannya kembali dari awal di lokasi baru — cara ini berisiko
  diam-diam mengubah/menambah logika tanpa disadari.
- Satu-satunya isi yang boleh diubah setelah file dipindah adalah:
  a) path di `<script src="...">` / `<link href="...">` pada HTML yang mereferensikan file tersebut
  b) path import/relative path di dalam file JS itu sendiri, jika ada
- DILARANG menambah, menghapus, atau mengubah fungsi/logika apa pun di dalam file
  JS/CSS selama proses reorganisasi. Kalau ada fungsi yang terlihat perlu diperbaiki
  atau direfactor, JANGAN dilakukan saat ini — laporkan dulu ke user, biarkan itu
  jadi task terpisah yang diminta secara eksplisit.
- Setelah selesai, tunjukkan `git diff` (atau perbandingan isi sebelum-sesudah) untuk
  setiap file yang dipindah, supaya user bisa memverifikasi bahwa hanya path yang berubah.
- Setelah dipindah, jalankan ulang dev server dan pastikan semua screen tetap berfungsi
  sama seperti sebelumnya (bookmark, riwayat baca, reader mode, dst — lihat bagian
  "Sebelum Menyatakan Task Selesai" di bawah).

## Sebelum Menyatakan Task Selesai
- Jalankan/preview hasil di browser (atau screenshot jika environment mendukung) sebelum bilang selesai.
- Cek responsive minimal di lebar mobile (~375px) dan desktop.
- Pastikan localStorage benar-benar menyimpan & memuat ulang data dengan benar (reload halaman untuk tes).
- Jangan tambah dependency/library baru tanpa menyebutkannya secara eksplisit ke user.

## Dokumentasi Pemetaan Modul
Kalau user meminta analisa/klasifikasi ulang mana kode yang logic murni vs UI-bound
(misal setelah menambah banyak fitur baru), tulis hasilnya ke `MODULE_MAP.md` di root
project — daftar tiap file, klasifikasinya (logic murni / UI-bound), dan alasan singkat.
Ini murni laporan/dokumentasi, jangan mengubah isi file kode saat membuat laporan ini.
