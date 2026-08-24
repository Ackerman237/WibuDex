---
name: vitest-testing
description: Gunakan skill ini SETIAP KALI menulis atau mengubah test (file di `tests/*.test.js`) — baik untuk fitur backend baru, bug fix, maupun perubahan pada scraper/validator/security utils. Menjaga test baru ikut konvensi yang sudah dipakai project dan tetap cover edge case, bukan cuma happy-path.
---

# Vitest Testing Skill

Project sudah punya suite test jalan (`vitest run`, `tests/*.test.js`,
`supertest` untuk integration test). Tujuan skill ini: test baru terasa
seperti ditulis oleh orang yang sama dengan test lama, bukan gaya baru
tiap sesi.

## Konvensi yang Sudah Dipakai (ikuti, jangan perkenalkan gaya baru)

- Import: `import { describe, it, expect } from 'vitest'` (+ `vi` kalau perlu
  mock, `request` dari `supertest` untuk integration test).
- Struktur: `describe('namaFungsi', () => { it('deskripsi perilaku spesifik', () => {...}) })`
  — nama `it` menjelaskan perilaku ("blocks javascript:", "removes script
  tags"), bukan generic ("should work", "test 1"). Lihat `tests/security.test.js`
  untuk pola ini.
- Satu file test per modul yang diuji, nama file cermin nama modul:
  `security.js` → `security.test.js`, `cache.js` → `cache.test.js`,
  `fetcher.js` → `fetcher.test.js`, `validator.js` → `validator.test.js`.
  Kalau menambah modul baru, ikuti pola penamaan ini.
- Integration test (`tests/integration.test.js`) pakai `vi.mock()` untuk
  mock layer scraper (`lib/scraper/index.js`, `lib/scraper/nekoScraper.js`)
  supaya test API route tidak benar-benar fetch ke situs sumber — reuse pola
  mock ini untuk endpoint baru, jangan hit network asli di test.
- Domain test sudah dipisah lewat `package.json` scripts: `test:integration`,
  `test:cache`, `test:fetcher`, `test:security`, `test:validator`. Kalau
  menambah modul besar baru dengan test sendiri, pertimbangkan tambah script
  `test:<domain>` senada, bukan cuma mengandalkan `vitest run` full suite.

## Wajib Cover Edge Case, Bukan Cuma Happy Path

Untuk setiap fungsi yang ditest, minimal pertimbangkan:
- Input null/undefined/kosong (contoh: `sanitizeUrl(123)` di
  `tests/security.test.js` — non-string input).
- String/array kosong.
- Boundary value (batas panjang string seperti `MAX_DEVICE_ID_LEN`,
  `MAX_SLUG_LEN` di `progressController.js`; batas angka seperti
  `IMAGE_MAX_SIZE`, range thumbnail width 16–2000 di `imageProxy.js`).
- Error state (upstream gagal, timeout, status non-2xx) — bukan cuma
  respons sukses.

Kalau fitur backend baru menyentuh endpoint progress ("Lanjutkan Nonton"),
ikuti pola validasi & test yang sudah ada di `progressController.js` +
kalau ada test-nya di masa depan, tempatkan sebagai `tests/progress.test.js`
mengikuti pola satu-file-per-modul di atas.

## Sebelum Menulis Test Baru

1. Baca 2–3 file test yang paling relevan dengan modul yang sedang dikerjakan
   (bukan cuma satu) untuk menangkap konvensi assertion/mocking yang dipakai
   di domain itu spesifik.
2. Jalankan `npm test` dulu untuk pastikan baseline hijau sebelum mulai.
3. Tulis test yang gagal dulu (kalau ini fix bug) untuk membuktikan bug-nya
   benar ada, baru perbaiki kode sampai test hijau.
