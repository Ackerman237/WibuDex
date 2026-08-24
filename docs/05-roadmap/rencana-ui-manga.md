# Rencana Bangun UI Manga — Wibudex

> **Status:** PLANNED — siap dieksekusi setelah branch aktif selesai.
> Acuan desain: `docs/06-architecture/style-guide.md` (sudah disinkron final),
> `website/css/wibudex-tokens.css` (token terkunci), skill `comic-design`
> (proses & restraint), skill `wibudex-design` (standar QA).

---

## 1. Prinsip Dasar (non-negotiable)

1. **Token only** — semua warna/font/radius/motion dari `wibudex-tokens.css`.
   Dilarang hardcode hex baru. Palet: Espresso `#0D0C0C`, Warm Charcoal
   `#181615`, Cognac Amber `#D97706`, Warm Ivory `#F3EFEA`.
2. **Standar QA wibudex-design:** tap target ≥44px untuk komponen interaktif
   utama (`.btn-primary`, `.btn-icon`, `.bottom-nav__item`), motion ≤300ms,
   spotlight hover `rgba(217,119,6,.4)`, glassmorphism nav (blur 20px +
   transparency 85%), feedback press `scale(0.97)` + `brightness(0.9)`.
3. **Restraint comic-design:** keberanian desain hanya di signature element.
   Sisanya tenang dan disiplin. Kalau satu layar terasa ramai → kurangi,
   jangan tambah.
4. **Signature element** (sudah diputuskan di style-guide):
   - Utama: **cover-expand transition** saat buka chapter dari detail
     (View Transitions API, fallback tanpa animasi)
   - Sekunder terbatas: **tema dinamis cover** di halaman detail saja
     (gradient header lembut + border CTA; korban pertama kalau ramai)
5. **Microcopy aktif** ala comic-design, bukan generik:
   - Riwayat kosong → "Belum ada yang dibaca"
   - Hasil cari kosong → "Tidak ketemu — coba kata kunci lain?"
   - Error → pesan spesifik + tombol retry (helper `showError` sudah ada)

## 2. Kontrak DOM — HTML Baru WAJIB Match ID Ini

JS screens existing mengakses elemen by ID. HTML baru harus menyediakan ID
berikut (atau JS diadaptasi — perubahan kecil diperbolehkan, catat per halaman).
Semua halaman juga memuat: `/css/wibudex-tokens.css`, `/shared/utils.js`,
`/shared/ui.js`, `/shared/nav.js` (+ `bottom-nav.js` mobile), sprite ikon via
helper `ic()`.

### `index.html` ← `js/index.js`
| ID | Peran |
|---|---|
| `heroBanner`, `heroBg`, `heroTitle`, `heroTypeBadge`, `heroRatingText` | Hero carousel |
| `heroReadBtn`, `heroInfoBtn`, `heroPrevBtn`, `heroNextBtn`, `heroDots` | Aksi & navigasi hero |
| `historyContainer`, `historyWrapper` | Carousel riwayat baca |
| `mangaGrid` | Grid rilis terbaru |
| `popularGrid` | Grid populer |
| `sectionTitle`, `searchForm`, `searchInput`, `backToTop` | Umum |

### `allManga.html` ← `js/allManga.js`
| ID | Peran |
|---|---|
| `mangaGrid` | Grid katalog |
| `pageNumbers`, `prevBtn`, `nextBtn` | Pagination (pass sebagai elemen ke `renderPaginationControls`) |
| `genreSelect`, `statusSelect`, `typeSelect`, `sortSelect` | Filter bar |
| `sectionTitle`, `searchForm`, `searchInput`, `backToTop` | Umum |

### `detail.html` ← `js/detail.js` (kontrak terpanjang)
`detailLayout`, `detailLoading`, `detailError`, `coverFrame`, `coverImg`,
`mTitle`, `mAltTitlesShort`, `altTitlesToggle`, `mTypeFlag`, `mTypeText`,
`mStatusText`, `ratingScore`, `ratingStars`, `viewsValue`, `genreTags`,
`synopsisPanel`, `synopsisText`, `synopsisToggle`, `readNowBtn`,
`bookmarkBtn`, `favoriteBtn`, `chapterList`, `chapterCount`, `chapterSearch`,
`chapterSortBtn`, `tabInfo`, `tabMoreSeries`, `infoPanel`, `recommendSection`,
`recommendGrid`, `recommendMoreWrap`, `recommendMoreText`, `recommendMoreBtn`,
`backToTop`.

### `reader.html` ← `js/reader.js`
HANYA butuh shell minimal: `#reader` (container utama) + `#info` (header info)
+ `backToTop`. Seluruh chrome (top bar, bottom bar, side controls, chapter
drawer, settings panel) dibangun programmatically oleh `build*()` functions.

### `library.html` ← `js/library.js`
`backToTop` + grid section favorit/bookmark — verifikasi argumen
`renderLibrarySection(storageKey, gridId, emptyId, btnId)` di file saat build.

### `history.html` ← `js/history.js`
`historyGrid`, `backToTop`.

## 3. Konsep per Halaman

### 3.1 Home (`index.html`)
```
┌──────────────────────────────────────┐
│ NAV glassmorphism (logo·search·menu) │
├──────────────────────────────────────┤
│ HERO (full-width, bg cover blur)     │  ← heroBanner: title, badge tipe,
│ ┌──────────┐  Judul  ★rating         │    CTA Lanjut/Baca (amber solid),
│ │  COVER   │  [BACA]  [INFO]         │    panah + dots nav
│ └──────────┘                          │
├─ Lanjut Baca (hanya jika ada) ───────┤  ← historyContainer rail horizontal;
│ [cover] [cover] [cover] →            │    progress tipis amber per card
├─ Populer ────────────────────────────┤  ← popularGrid, media-card token
│ ▣ ▣ ▣ ▣ ▣ ▣  (grid 2/3/5 kolom)      │
├─ Rilis Terbaru ──────────────────────┤  ← mangaGrid
│ ▣ ▣ ▣ ▣ ▣ ▣                          │
└──────────────────────────────────────┘
```

### 3.2 Catalog (`allManga.html`)
Filter bar sticky di bawah nav (select ringan, amber saat aktif) → grid
media-card → pagination numerik (komponen `.page-number`). State loading =
`.media-card--skeleton` (shimmer dari tokens).

### 3.3 Detail (`detail.html`)
Layout 2 kolom desktop / stack mobile: cover besar kiri (frame panel komik),
judul + meta + CTA kanan. Tab `Detail Info ↔ More Series` di bawah daftar
chapter (mobile). Genre = chip warna terbatas palet. **Di sinilah tema dinamis
cover bekerja** (gradient header). Cover-expand: klik `readNowBtn` → transisi.

### 3.4 Reader (`reader.html`)
Shell minimal — chrome dibangun JS. Mode scroll (manhwa, tanpa animasi buatan)
& page-by-page (manga, transisi slide halus). Auto-hide chrome, progress bar
draggable, drawer chapter, settings panel — semua sudah ada di JS, tinggal CSS
menyusunnya dengan token.

### 3.5 Library & History
Grid media-card dari localStorage / server progress. Empty state microcopy
aktif + ilustrasi ikon sprite (`ic('book-open')` dsb), tombol aksi ke catalog.

## 4. Urutan Eksekusi Indikatif

1. `index.html` + css (fondasi: nav, card, grid, state helpers)
2. `allManga.html` (reuse penuh komponen home)
3. `detail.html` + tema dinamis cover
4. `reader.html` + cover-expand transition (signature, paling sensitif)
5. `library.html`, `history.html` (paling cepat, reuse semua)

Tiap halaman: satu commit, jalankan `verify-icons.mjs` + cek manual states
(loading/error/empty) sebelum lanjut.

## 5. Transversal

- `sw.js` CACHE_VERSION bump tiap batch asset baru
- Update `docs/06-architecture/module-map.md` jika kontrak JS berubah
- Kontras teks ≥4.5:1 (WCAG AA); hormati `prefers-reduced-motion`
  (global rule sudah ada di tokens.css)
- Light theme otomatis tersedia via `[data-theme="light"]` tokens — cukup
  pastikan tak ada warna hardcoded yang merusaknya
