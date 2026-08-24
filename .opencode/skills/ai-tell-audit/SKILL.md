---
name: ai-tell-audit
description: Gunakan skill ini SETELAH sebuah halaman/komponen visual selesai dibuat atau diedit — sebagai pass review terpisah untuk menangkap ciri khas "kelihatan dibuat AI" yang sering lolos dari proses desain awal. Melengkapi comic-design (prinsip saat mendesain) dan wibudex-design (QA terhadap token/spec yang sudah dikunci) — skill ini murni audit tampilan jadi terhadap pola generik, dijalankan di akhir sebelum dianggap selesai.
---

# AI-Tell Audit Skill

`comic-design` mengarahkan *proses* mendesain (gali dari dunia komik, hindari
3 pola default). `wibudex-design` mengecek *kepatuhan* terhadap token yang
sudah dikunci (warna, spacing, tap target). Skill ini beda lagi: pass review
terpisah di akhir, setelah kode/komponen sudah jadi, khusus mencari ciri
"terasa dibuat AI" yang bisa lolos meski token dan proses sudah benar —
karena pola generik ini sering muncul di level detail eksekusi, bukan di
level rencana.

Jalankan skill ini sebagai langkah terakhir sebelum bilang "selesai" pada
task visual apa pun (halaman baru, komponen baru, redesign section).

## Ciri "Dibuat AI" yang Sering Lolos (cek satu per satu)

**Ritme & hierarki**
- Semua card/section punya padding, radius, dan shadow yang identik tanpa
  variasi yang disengaja — cek apakah ada elemen yang seharusnya "lebih berat"
  (cover manga di detail page, tombol baca utama) tapi visualnya setara dengan
  elemen sekunder.
- Ukuran font terlalu rapat rentangnya (semua antara 14–18px) sehingga tidak
  ada kontras skala yang jelas antara judul, label, dan body.
- Grid/layout simetris sempurna tanpa satu pun titik fokus — semua kotak
  ukuran sama, semua jarak sama, tidak ada yang "menonjol" secara sengaja.

**Komponen generik**
- Card pola "icon + judul + deskripsi 1 kalimat" dipakai berulang tanpa
  variasi, padahal `comic-design` sudah menyediakan arah spesifik (panel
  border, speech bubble, halftone) — cek apakah signature element dari
  comic-design benar-benar dipakai atau cuma ditulis di rencana lalu dilupakan
  saat coding.
- Badge/pill generik (rounded-full, satu warna solid, tanpa bentuk khas) untuk
  status chapter baru/hot — bandingkan dengan arahan "badge bergaya komik,
  bukan pill generik" di `comic-design`.
- Hover state cuma `scale()` + `brightness()` default tanpa micro-interaction
  yang terasa disengaja untuk konteks (baca komik/nonton).

**Motion & polish berlebihan**
- Terlalu banyak animasi sekaligus di satu halaman (fade + slide + scale
  bersamaan di banyak elemen) — ironisnya ini yang justru bikin terasa
  "dibuat asal oleh AI", bukan sebaliknya. `wibudex-design` sudah membatasi
  `--duration-slow: 300ms` — cek juga *jumlah* elemen yang beranimasi
  bersamaan, bukan cuma durasinya.
- Glassmorphism/blur dipakai di banyak tempat sekaligus tanpa alasan (bukan
  cuma di nav/overlay sesuai `wibudex-design`).

**Microcopy**
- Teks UI generik ("No results found", "Something went wrong", "Loading...")
  yang belum diganti ke nada spesifik konteks komik/doujin — bandingkan
  dengan helper yang sudah ada di `website/shared/ui.js`
  (`showLoading`, `showError`, `showEmpty` — pastikan pesan yang dilempar ke
  fungsi ini spesifik, bukan placeholder generik seperti "Error occurred").
- Label tombol pasif/vague ("Submit", "Klik di sini") alih-alih aktif dan
  spesifik ("COBA LAGI" sudah benar sebagai contoh pola yang dipakai).

## Proses Audit

1. Lihat halaman/komponen jadi (screenshot atau baca CSS+HTML langsung),
   bukan rencana desainnya — pola generik sering baru kelihatan setelah jadi
   kode, bukan di level rencana token.
2. Untuk tiap ciri di atas yang ditemukan: sebutkan elemen spesifiknya (nama
   class/selector, halaman mana), bukan komentar umum "kurang unik".
3. Prioritaskan yang paling terlihat dulu (hero/above-the-fold, elemen yang
   paling sering dilihat user seperti card manga di homepage/catalog) —
   jangan habiskan waktu di detail yang jarang dilihat.
4. Tanya ke diri sendiri sebelum revisi: apakah ini benar-benar generik untuk
   *project ini*, atau cuma karena polanya umum di web pada umumnya? Pola
   umum yang tetap cocok untuk konteks komik (misal grid card 2 kolom mobile)
   bukan masalah — yang jadi temuan adalah pola generik yang *tidak* terhubung
   ke identitas komik/dark-reading-app yang sudah dipilih project ini.

## Yang Bukan Scope Skill Ini

- Bukan pengecekan token/spec (warna, radius, tap target ≥44px) — itu tetap
  domain `wibudex-design`.
- Bukan brainstorming arah desain baru dari nol — itu domain `comic-design`.
- Skill ini murni menemukan gap antara rencana desain yang sudah bagus dengan
  eksekusi kode yang diam-diam jatuh ke default generik.
