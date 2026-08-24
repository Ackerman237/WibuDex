# Ide & Backlog — Comic Reader

Catatan ide/perbaikan yang belum tentu langsung dikerjakan, dipisah dari
`AGENTS.md` supaya tidak jadi instruksi wajib — ini daftar pertimbangan,
tinggal diminta ke opencode kapan pun mau dikerjakan.

## Backup Data (localStorage)
Karena tanpa login, semua bookmark & riwayat baca hanya ada di localStorage
browser — hilang kalau cache dibersihkan, ganti browser, atau pindah device.
Ide: tombol "Export Data" (download isi localStorage jadi file JSON) dan
"Import Data" (upload file itu kembali) di suatu halaman pengaturan sederhana.

## Lazy Loading Gambar dalam Chapter
Kalau satu chapter punya puluhan halaman, jangan load semua gambar sekaligus
saat chapter dibuka. Pakai `loading="lazy"` bawaan browser minimal, atau load
gambar halaman berikutnya saat mendekati viewport. (Beda dengan "preload
chapter selanjutnya" yang sudah jadi fitur wajib — itu untuk transisi
antar-chapter, ini untuk di dalam satu chapter yang panjang.)

## Penanganan Gambar Gagal Dimuat
Perlu fallback state (placeholder "gambar gagal dimuat" + tombol retry) kalau
sumber gambar (URL eksternal/file lokal) gagal diakses, supaya reader tidak
terlihat kosong tanpa penjelasan.

## Housekeeping Repo
Pastikan `.gitignore` mencakup `node_modules/` (dari live-server) dan file
sementara lain, supaya tidak ikut ter-commit.
