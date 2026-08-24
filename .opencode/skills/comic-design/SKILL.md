---
name: comic-design
description: Panduan desain visual untuk website baca komik pribadi ini. Gunakan skill ini SETIAP KALI mengerjakan tampilan/UI/CSS/komponen visual — homepage, catalog, detail, atau reader. Membantu membuat desain yang punya identitas kuat dan tidak terasa generik/template, digali dari elemen visual dunia komik itu sendiri.
---

# Comic Design Skill

Berperan sebagai design lead yang bertugas memastikan setiap halaman punya identitas
visual yang tidak bisa disamakan dengan template comic-reader lain. Klien (user proyek
ini) sudah lihat banyak clone situs baca komik yang terasa generik — tugasmu membuat
sesuatu yang terasa "dipikirkan", bukan hasil template.

## Hindari 3 Pola Default Desain AI

Kalibrasi diri dulu sebelum mendesain. Desain hasil AI generatif saat ini cenderung
mengelompok ke 3 pola ini — hindari kecuali benar-benar dipertimbangkan sadar:

1. Background krem hangat + font serif kontras tinggi + aksen warna terracotta/oranye
2. Background hitam pekat + satu aksen neon (hijau asam / merah menyala) generik
3. Layout broadsheet: garis tipis (hairline), sudut kotak (zero border-radius), kolom rapat ala koran

Ketiganya sah untuk brief tertentu, tapi jadi masalah kalau muncul begitu saja tanpa
alasan yang terhubung ke subjek (komik), bukan karena benar-benar cocok untuk proyek ini.

## Gali Elemen dari Dunia Komik, Bukan dari Template Web App Umum

Jangan mendesain seperti dashboard/SaaS generik. Ambil inspirasi dari kosakata visual
komik itu sendiri:
- **Panel & panel border** — bisa jadi inspirasi untuk card/grid, bukan sekadar rounded card standar
- **Speech bubble & sound effect (SFX)** — bisa jadi bentuk badge, notifikasi, atau label "New Chapter"
- **Halftone dot pattern** — tekstur background/aksen, ciri khas cetak manga hitam-putih
- **Speed-line / garis pancar** — alternatif divider atau elemen dekoratif transisi, khas panel aksi
- **Tinta cetak manga** (hitam pekat, putih gading — bukan putih murni) vs **palet manhwa berwarna** (saturated, biasanya 1 warna dominan dari cover art) — pilih salah satu arah sesuai jenis komik yang didominasi di koleksi user

## Proses Wajib: Rencana Dulu, Baru Kode

Sebelum menulis CSS/komponen visual apa pun, buat dulu token plan singkat:

- **Warna**: 4–6 nilai hex bernama, dengan alasan singkat kenapa dipilih untuk konteks
  komik ini (bukan sekadar "warna gelap yang enak dilihat")
- **Tipografi**: 2 font — satu font display berkarakter untuk judul (dipakai secukupnya,
  jangan berlebihan), satu font body netral untuk teks panjang (sinopsis, dsb).
  Hindari default seperti Inter/Poppins polos tanpa alasan.
- **Layout**: deskripsikan konsep dalam 1 kalimat + ASCII wireframe kasar untuk halaman yang dikerjakan
- **Signature element**: SATU elemen unik yang akan diingat dari halaman ini (misal: transisi
  buka chapter meniru membalik halaman, hover cover meniru panel terbuka, badge chapter baru
  berbentuk SFX komik). Hanya satu — jangan sebar keberanian ke banyak elemen sekaligus.

Setelah token plan dibuat, review dulu: apakah ini terasa spesifik untuk comic reader ini,
atau ini jawaban generik yang akan sama saja untuk proyek lain? Revisi bagian yang masih
terasa generik sebelum lanjut menulis kode.

## Detail per Halaman

**Card komik (dipakai di homepage & catalog)**
- Cover rasio vertikal ~2:3
- Badge status (New, Hot, chapter terbaru) — desain sebagai elemen bergaya komik, bukan pill badge generik
- Grid: 2 kolom di mobile, 4–6 kolom di desktop
- Hover: satu micro-interaction yang disengaja (bukan sekadar scale+shadow default)

**Reader (halaman paling penting — kenyamanan baca adalah prioritas)**
- Auto-hide UI/navbar saat scroll, muncul lagi saat tap/klik
- Progress bar chapter yang jelas
- Toggle mode baca: vertical scroll vs page-by-page
- Transisi antar halaman/chapter jangan berlebihan — animasi kecil dan halus lebih baik
  daripada banyak efek sekaligus (efek berlebihan justru bikin terasa "dibuat asal oleh AI")

## Restraint (Menahan Diri)

Habiskan "keberanian desain" di satu tempat saja (signature element). Sisanya harus
tenang, rapi, dan disiplin. Sebelum selesai, tanya ke diri sendiri: elemen dekoratif mana
yang bisa dihapus tanpa mengurangi identitas desain? Kalau ada, hapus.

Pastikan juga standar dasar terpenuhi tanpa perlu diumumkan: responsive sampai mobile,
kontras warna cukup untuk teks panjang (sinopsis, dialog UI), dan tidak ada animasi yang
mengganggu (hormati preferensi reduced motion jika memungkinkan).

## Microcopy

Tulis teks UI (empty state, error, label tombol) dengan nada aktif dan spesifik, sesuai
konteks komik — bukan teks default generik seperti "No results found". Contoh: state
riwayat baca kosong → "Belum ada yang dibaca" alih-alih "No data available".
