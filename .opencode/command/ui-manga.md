---
description: Bangun UI manga Wibudex sesuai rencana (rencana-ui-manga.md). Argumen opsional: nama halaman (index/allManga/detail/reader/library/history).
agent: build
---

Tugas: membangun UI manga Wibudex. WAJIB baca dulu sebelum menulis kode apa pun:

1. `docs/05-roadmap/rencana-ui-manga.md` — rencana lengkap: kontrak DOM per
   halaman (ID yang wajib ada di HTML untuk JS screens existing), wireframe,
   urutan eksekusi, dan catatan transversal.
2. `docs/06-architecture/style-guide.md` — keputusan desain final
   (signature element, model navigasi reader, state, aksesibilitas).
3. `website/css/wibudex-tokens.css` — token terkunci. Dilarang hardcode
   warna/font baru; reuse kelas komponen kanonik.

Kemudian muat skill: `comic-design` (proses desain) + `wibudex-design`
(standar QA & komponen kanonik).

Halaman yang dikerjakan: $ARGUMENTS

- Kalau argumen kosong → lanjutkan urutan rencana (cek halaman mana yang
  belum ada di `website/manga/html/`; urutan: index → allManga → detail →
  reader → library → history).
- Kerjakan SATU halaman saja per sesi/kommit. Ikuti kontrak DOM persis;
  kalau JS perlu diadaptasi kecil, boleh — catat perubahannya.
- Setelah selesai: jalankan `node scripts/dev/verify-icons.mjs`, cek manual
  3 state (loading/error/empty), lalu audit `ai-tell-audit` sebelum commit.
- Commit message: `feat(manga-ui): <halaman> - <ringkasan>`; bump
  `CACHE_VERSION` sw.js bila aset berubah signifikan.
