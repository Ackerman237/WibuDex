---
name: wibudex-ux
description: Gunakan skill ini SETIAP KALI mengerjakan alur interaksi/navigasi — bukan tampilan visualnya, tapi urutan langkah, state (loading/error/empty/kosong-vs-ada-data), dan konsistensi perilaku lintas halaman (reader, catalog, detail, history, watch). Melengkapi comic-design/wibudex-design (visual) dan ai-tell-audit (kesan generik) — skill ini soal apakah alurnya masuk akal dan konsisten bagi pengguna, bukan soal warna/bentuk.
---

# Wibudex UX Skill

Skill visual (`comic-design`, `wibudex-design`, `ai-tell-audit`) menjawab "apakah
ini terlihat bagus dan khas". Skill ini menjawab pertanyaan yang beda: "apakah
alur ini masuk akal, konsisten, dan tidak membingungkan pengguna" — mencakup
urutan langkah, state kosong/loading/error, dan konsistensi perilaku antar
halaman yang berbagi fungsi sama.

## Fakta Arsitektur yang Wajib Dipahami Sebelum Mengubah Alur

Wibudex punya **dua mekanisme state personal yang berbeda sumber** — jangan
disamakan begitu saja:
- **Bookmark, favorite, riwayat baca (list)** → `website/shared/storage.js`,
  murni `localStorage`, per-browser, tidak tersinkron ke server.
- **Posisi baca terakhir per chapter** (progress) → server via
  `controllers/progressController.js` + `lib/db.js` (SQLite), diidentifikasi
  lewat header `x-device-id`.

Implikasi UX yang harus dicek tiap kali menyentuh alur "lanjutkan
baca/nonton": device-id sendiri kemungkinan besar tersimpan di localStorage
juga (per-browser) — jadi progress **terasa** tersinkron (dari server) tapi
sebenarnya masih terikat ke device/browser yang sama, sama seperti bookmark.
Kalau user nanti minta fitur "buka di device lain, progress ikut" — itu
gap arsitektur nyata (device-id perlu jadi akun/identitas lintas device),
bukan sekadar bug UI. Jangan janjikan "tersinkron" di microcopy kalau
sebenarnya belum lintas device.

## Konsistensi State Antar Halaman

Setiap halaman yang menampilkan data async (catalog, detail, reader, watch,
history) punya 3 kemungkinan non-happy-path yang wajib ditangani konsisten,
memakai helper yang sudah ada di `website/shared/ui.js`:
- `showLoading(container, message)` — state sedang memuat.
- `showError(container, message, onRetry)` — gagal fetch, **selalu** sediakan
  jalan retry kalau errornya sifatnya sementara (network/timeout/5xx) — lihat
  `formatFetchError()` di file yang sama untuk pemetaan pesan per jenis error
  (AbortError, HTTP 404/429/500) yang sudah konsisten; jangan buat pesan error
  baru yang tidak lewat fungsi ini kalau errornya termasuk kategori yang sudah
  dipetakan.
- `showEmpty(container, message, btnLabel?, onAction?)` — data kosong tapi
  fetch sukses (misal hasil search tidak ada, riwayat baca masih kosong).
  **Beda dengan error** — jangan pakai `showError` untuk kasus "berhasil tapi
  kosong", itu bikin user salah paham datanya justru gagal dimuat.

Kalau menambah halaman/section baru yang fetch data, reuse 3 fungsi ini
lewat `shared/ui.js`, jangan tulis ulang pola loading/error/empty sendiri per
halaman — itu yang bikin state kelihatan konsisten di seluruh app.

## Alur Baca (Reader) — Prioritas Kenyamanan

`website/manga/js/reader.js` adalah halaman paling sering dipakai —
setiap perubahan di sini punya dampak UX terbesar:
- Auto-hide navbar saat scroll harus tetap bisa dipanggil balik dengan
  tap/klik — jangan sampai user "kehilangan" kontrol navigasi tanpa cara
  memunculkannya lagi.
- Progress bar chapter dan tombol next/prev chapter harus tetap terlihat/​
  dapat diakses meski navbar auto-hide aktif (thumb-reachable, sesuai
  `wibudex-design`).
- Toggle mode baca (vertical scroll vs page-by-page) — state pilihan ini
  idealnya persisten (tersimpan), bukan reset tiap buka reader baru; cek dulu
  apakah preferensi ini disimpan di `storage.js` sebelum menganggap perlu
  ditambah.
- Preload gambar chapter berikutnya jangan sampai memblokir interaksi chapter
  yang sedang dibaca (harus di background).

## Sebelum Mengubah Alur yang Sudah Ada

1. Cek `docs/06-architecture/module-map.md` untuk tahu apakah fungsi yang mau diubah "logic murni"
   (dipakai lintas halaman) atau "UI-bound" (khusus satu halaman) — perubahan
   di fungsi shared (`shared/api.js`, `shared/storage.js`, `shared/ui.js`)
   berdampak ke semua halaman yang memakainya (lihat juga
   `careful-logic-change` untuk prosedur wajib sebelum mengubah logic).
2. Tanya: apakah perubahan ini konsisten diterapkan di semua halaman yang
   punya alur serupa (misal: kalau nambah tombol retry di catalog, apakah
   detail/watch/history juga perlu yang sama)? Inkonsistensi antar halaman
   yang seharusnya berperilaku sama adalah bug UX, meski masing-masing
   halaman "berfungsi" sendiri-sendiri.
3. Untuk alur baru yang butuh banyak langkah, pertimbangkan: apakah setiap
   langkah punya cara mundur/batal yang jelas, dan apakah state sebelumnya
   (misal scroll position, filter yang dipilih) tetap terjaga kalau user
   navigasi balik.

## Yang Bukan Scope Skill Ini

- Bukan soal warna/tipografi/animasi visual — itu domain `comic-design` /
  `wibudex-design` / `ai-tell-audit`.
- Bukan soal keamanan input — itu domain `security-review`.
