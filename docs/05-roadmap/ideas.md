# Ide & Backlog — Comic Reader

Catatan ide/perbaikan yang belum tentu langsung dikerjakan, dipisah dari
`AGENTS.md` supaya tidak jadi instruksi wajib — ini daftar pertimbangan,
tinggal diminta ke opencode kapan pun mau dikerjakan.

## Backup Data (localStorage)
Karena tanpa login, semua bookmark & riwayat baca hanya ada di localStorage
browser — hilang kalau cache dibersihkan, ganti browser, atau pindah device.
Ide: tombol "Export Data" (download isi localStorage jadi file JSON) dan
"Import Data" (upload file itu kembali) di suatu halaman pengaturan sederhana.

## ~~Lazy Loading Gambar dalam Chapter~~ ✅ IMPLEMENTED
Sudah ada di `website/manga/js/reader.js`: `setupLazyImages()`
(IntersectionObserver) + `loadInitialPages()`. Tidak perlu dikerjakan lagi.

## ~~Penanganan Gambar Gagal Dimuat~~ ✅ IMPLEMENTED
Sudah ada di `reader.js`: retry bertingkat (`IMAGE_RETRY_DELAYS`) +
placeholder status per gambar (`createLoadStatus`, `describeImageFailure`).

## Housekeeping Repo
✅ Selesai — `.gitignore` mencakup `node_modules/` dan folder runtime.
