# Current Focus

_Last updated: 2026-08-24_

## Active Track

### Track WIBUDEX v2 — Manga UI Rebuild
Status: **ACTIVE 🚧**

Rencana lengkap: `docs/05-roadmap/rencana-ui-manga.md`
Kontrak DOM per halaman sudah diaudit dari JS screens existing.
Desain: `docs/06-architecture/style-guide.md` (final, tersinkron) +
`website/css/wibudex-tokens.css`.

Urutan eksekusi (satu halaman satu commit):
- [ ] `index.html` — hero carousel + riwayat + grid populer/rilis terbaru
- [ ] `catalog.html` — katalog: filter bar + pagination numerik
- [ ] `detail.html` — cover, meta, chapter list, tabs (+ tema dinamis cover)
- [ ] `reader.html` — shell minimal (chrome dibangun reader.js)
      (+ signature element: cover-expand via View Transitions API)
- [ ] `library.html`, `history.html`

Cara memulai di sesi baru: ketik `/ui-manga [nama-halaman]`.
QA tiap halaman: `verify-icons.mjs` + standar skill `wibudex-design`
+ audit `ai-tell-audit`.

---

## Riwayat Track

### Track WIBUDEX v1 — Design system unification & Fixes
Status: **COMPLETE ✅**

Rencana lengkap: `docs/Identitas/WIBUDEX-MASTER-SPEC.md`
2026-08-23.

Shipped (Fase 0 & Fixes A-C + Palet Amber):
- [x] Palet Warna **Claude Amber**: Espresso `#0D0C0C`, Warm Charcoal `#181615`, Cognac Amber `#D97706`, Warm Ivory `#F3EFEA`
- [x] `website/css/wibudex-tokens.css` — token asli + blok alias legacy frozen
- [x] `base.css` doujin: `:root` lama dihapus, dot-grid & merah hanko dibersihkan
- [x] Head-patch di 8 halaman doujin: font Plus Jakarta Sans, anti-flash theme script, `&amp;` URL fix, theme-color `#0D0C0C`
- [x] Fix baseline tokens: `min-width/height: 44px` dipindah ke kelas komponen, dot carousel & hamburger kembali normal
- [x] Fix data: `stripHtml` sinopsis + `repairMojibake` alt-titles/title di `normalizer.js` (+ unit test)
- [x] Fix detail UX: tab toggle `Detail Info` ↔ `More Series` (lazy load & scroll), tab dipindah ke bawah list chapter khusus mobile
- [x] Fix desktop grid: 1 baris + tombol "See More" expand/collapse + kartu seragam
- [x] Redesign Home (`index.html` & `index.css`): Asymmetric Bento Hero + History Widget + Spotlight Hover Cards
- [x] `sw.js` CACHE_VERSION v8

### Track A — ALL MANGA page (frontend, doujin module)
Status: **COMPLETE ✅** — semua P4 item selesai dan di-commit.

Shipped:
- [x] Numeric pagination (`PREVIOUS  1 2 3 4 5  NEXT`)
- [x] Sorting controls (Newest / Rating / Title A–Z)
- [x] Category filter (genre dropdown)
- [x] Explicit loading / empty / error UI states
- [x] Server-side reading position (SQLite via `node:sqlite`)
- [x] De-duplicate pagination and shared UI components to `shared/ui.js`

### Track B — Scraper engine migration & Security Hardening
Status: **COMPLETE ✅ (Core & P0/P1 baseline implemented and tested)**

Shipped:
- [x] Harden the image proxy: domain allowlist + private-IP blocking + redirect re-validation (`lib/security.js`).
- [x] Response size limit (10MB) + content-type validation to image proxy (`controllers/mangaController.js`).
- [x] Rate limiting: API (60 req/min), Image Proxy (120 req/min) via `middleware/rateLimit.js`.
- [x] Request timeout (AbortController, 12s) to scraper calls (`lib/scraper/fetcher.js`).
- [x] In-memory cache with TTL (`lib/scraper/cache.js`).
- [x] Data normalizer & decryptor modules (`lib/scraper/normalizer.js`, `lib/scraper/decryptor.js`).
- [x] Comprehensive test suites (87 unit & integration tests passing).
- [x] Portable Chrome path detection across Linux, macOS, and Windows with environment variable support (`lib/browser.js`).

### Track C — Bug Fixes (2026-08-21)
Status: **COMPLETE ✅ (3 bug fixes shipped, 1 known issue dicatat)**

Shipped:
- [x] Gambar reader tidak muncul dari filter catalog — `loadInitialPages` selalu dipanggil.
- [x] Cover manga hilang saat back dari reader (bfcache) — `pageshow` listener di `catalog.js`.
- [x] Error server dari detail → reader tidak tertangkap — `formatFetchError` diperluas + `fetchChapterWithRetry` + retry button.
- [x] Continue reading / scroll ke halaman tersimpan dinonaktifkan sementara (`restoreReadingPosition` hanya baca posisi, tidak scroll).

## Known Issues / Technical Debt

### [OPEN] Continue reading: scroll ke halaman terakhir tidak aktif
- **File:** `storage.js` → `restoreReadingPosition()`
- **Status:** Dinonaktifkan sengaja. Sistem simpan posisi (localStorage + SQLite) tetap berjalan.
- **Root cause:** `scrollIntoView()` dipanggil sebelum `setupLazyImages()` terdaftar → gambar tidak pernah dimuat.
- **Solusi yang dibutuhkan:** Refaktor urutan inisialisasi di `reader.js` — jalankan `setupLazyImages()` dulu, kemudian scroll restore setelah observer siap (misalnya via callback atau `requestAnimationFrame` setelah observer dibuat).

## Definition of "done" for this focus period
- Track A: ✅ done.
- Track B: ✅ done.
- Track C: ✅ done.

## Blockers / Open Questions
- Continue reading scroll restore masih disabled — perlu refaktor urutan inisialisasi reader.
