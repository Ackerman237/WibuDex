# Rencana Pengembangan Fitur — Section Video Wibudex

> **Status:** Bahan diskusi roadmap pengembangan — BELUM dieksekusi.
> Antri setelah rebuild UI Manga selesai (keputusan 2026-08-24).
> Basis: rencana UX "ala YouTube" yang diperluas jadi peta pemaksimalan
> fitur section Video.
>
> **Validasi:** semua klaim data/batasan di dokumen ini sudah dicek langsung
> ke `lib/scraper/neko/` (index.js, parsers/cards.js, parsers/detail.js),
> `website/video/js/*`, dan `routes/video.routes.js`.

Prinsip: identitas visual Wibudex tetap dipertahankan (dark theme, accent
amber `#D97706`, Plus Jakarta Sans + Inter) — yang diambil dari YouTube murni
pola interaksi & tata letak yang familiar, bukan jadi clone.

---

## Bagian 1 — Fitur TANPA data baru

UI/logic di atas data yang sudah tersedia. Kelas risiko terendah.

### 1.1 Card video standar (A1 + B2)
- **Apa:** satu komponen card dipakai ulang di semua konteks (home grid,
  related sidebar/grid, episode mobile scroller) — thumbnail 16:9, judul
  maks 2 baris clamp, baris kedua `date`/`type` bila ada.
- **File:** `website/video/js/index.js` (`renderVideoCard`), `watch.js`
  (`renderEpisodeSidebar`, `renderRelatedSidebar`, `renderEpisodeList`),
  `series.js` (`renderSeriesCard`), css terkait.
- **Catatan:** saat ini ada 4+ markup card berbeda; konsolidasi jadi satu
  helper (mis. `renderMediaCard(item, opts)` di file bersama video).

### 1.2 Left rail navigasi desktop (A2)
- **Apa:** sidebar kiri persisten di layar lebar: Home, Acak, Daftar Hentai,
  Daftar JAV + kategori dinamis; collapsible icon-only.
- **File:** `index.html`, `series.html`, `base.css`, opsional `nav.js`.
- **Batasan:** murni tambahan desktop; mobile tetap bottom-nav
  (`bottom-nav.js` sudah punya guard `window.innerWidth <= 700`).
- Dropdown CATEGORIES navbar tetap atau diganti rail → keputusan UI saat eksekusi.

### 1.3 Infinite scroll (A3)
- **Apa:** IntersectionObserver sebagai pemicu utama load halaman berikut;
  tombol SEE MORE tetap ada sebagai fallback manual/aksesibilitas.
- **File:** `video/js/index.js` (`loadVideos`), `series.js` (`loadSeries`).
- **Risiko rendah:** guard double-trigger (observer menyala berkali-kali),
  state `isLoading` flag.

### 1.4 Jadwal jadi rail horizontal (A4)
- **Apa:** "Jadwal New Hentai" dari vertical block jadi horizontal shelf
  ala YouTube di atas feed utama.
- **File:** `index.html`, `index.css`, `loadSchedule()` di `index.js`.
- **Data:** schedule day-grouped `{day, series[]}` — render berubah, fetch tidak.

### 1.5 Theater mode (B5)
- **Apa:** toggle perbesar player, sembunyikan sidebar sementara.
- **File:** `watch.css` + toggle class di `watch.js`.
- **Termurah, dampak besar** — tidak butuh data sama sekali.

### 1.6 Keyboard shortcut watch page (B6)
- **Apa:** Spasi = play/pause, ←/→ = seek ±5–10 dtk, N/P = episode next/prev.
- **Batasan TERVERIFIKASI:** play/pause & seek **hanya mode native player**
  (`#nativeVideo` di `mountNativeVideo`). Mode filtered/direct pakai iframe
  cross-origin tanpa API → mustahil dikontrol. N/P murni DOM link → semua mode.
- **File:** `watch.js` (`mountNativeVideo` untuk hook keydown pada video aktif,
  global listener untuk N/P).
- **Guard:** jangan intercept shortcut kalau fokus di input/search.

### 1.7 Autoplay toggle (B1)
- **Apa:** switch di atas sidebar episode; episode berikutnya otomatis diputar
  setelah selesai.
- **Batasan TERVERIFIKASI:** hook `ended` hanya ada di native `<video>`;
  iframe tidak bisa dideteksi selesainya. UI toggle tetap bisa dibuat tapi:
  disable otomatis + label penjelasan saat mode filtered/direct aktif.
- **File:** `watch.js` (`mountNativeVideo` tambah listener `ended` → trigger
  klik episode berikutnya di `episodeList`), markup switch baru.

### 1.8 Channel row seri mini (B3)
- **Apa:** baris kecil di bawah `videoTitle`: ikon/nama seri + identitas
  "Seri X · Episode Y".
- **KEPUTUSAN TERKAIT:** TANPA link "Lihat semua episode" — link tersebut
  butuh episode-page (?slug) yang statusnya open question #2 (Bagian 4).
- **Data:** nama seri belum ada sebagai field eksplisit di response detail
  (`detail` = title/slug/thumb/players/synopsis/related/episodes). Perlu
  derivasi saat eksekusi (mis. dari pola judul episode) — dicatat sebagai
  risiko parsing ringan, bukan blocker.

### 1.9 Search bar pill (D1)
- Kosmetik CSS saja (`base.css`) — radius penuh + ikon kaca pembesar.
- Logic pencarian tidak disentuh.

### 1.10 Search autocomplete (D3)
- **Apa:** dropdown saran saat mengetik di searchInput.
- **Pendekatan:** debounce ±300ms → `/api/video/search?query=` (endpoint sudah
  ada), ATAU client-side filter dari judul yang sudah ter-load/cache sessionStorage.
- **Guard:** rate limit API umum 60 req/min — debounce wajib; tutup dropdown
  saat blur/Escape; navigasi keyboard ↑↓ + Enter.

---

## Bagian 2 — Fitur BUTUH penambahan data scraping

Semua item di bagian ini menyentuh `lib/scraper/neko/` (lapisan internal,
boleh menyebut situs sumber). Prasyarat umum: **probe live dulu** apakah HTML
upstream benar-benar menampilkan field yang diinginkan — parser defensif tanpa
data sumber = sia-sia.

### 2.1 Durasi video di thumbnail
- **Sumber kandidat:** halaman listing kemungkinan BESAR tidak menampilkan
  durasi; halaman detail lebih mungkin. Kalau cuma ada di detail → durasi
  hanya tampil di watch page, bukan card.
- **File:** `parsers/cards.js` (`makeCard` tambah field), `parsers/detail.js`,
  `neko/index.js` (teruskan field), fixture test baru di `tests/fixtures/`.
- **Kontrak:** field baru boleh kosong string — card frontend harus toleran.

### 2.2 Jumlah views
- **Realita:** views biasanya tidak ada di listing nekopoi; hanya di detail
  (jika ada). Sama penanganannya dengan 2.1.
- **Nilai UX:** angka views di watch page meta row — kecil tapi menambah rasa
  "platform", bukan katalog mati.

### 2.3 Genre/tag
- **Peluang nyata:** struktur HTML search-item memang punya slot
  `<span class="nk-search-genres"></span>` (saat ini kosong di contoh parser)
  — jika upstream mengisinya, parsing realistis.
- **Output:** array tag per card → chip genre di watch page + filter lanjutan.

### Risiko transversal Bagian 2
Parser regex rawan break saat upstream redesign — pola mitigasi sudah ada
(parser defensif + unit test fixture offline). Setiap field baru wajib punya
fixture HTML nyata + test.

---

## Bagian 3 — Fitur BUTUH backend baru (DB/API)

Kelas risiko tertinggi — tiap item layak rencana eksekusi sendiri.

### 3.1 Lanjutkan Nonton (continue watching) — eks "Section E"
Fitur bernilai UX tertinggi dari seluruh dokumen ini.

**Draft skema DB** (`lib/db.js`, pola migrasi `ensureColumn` seperti
`reading_positions`):
```sql
CREATE TABLE IF NOT EXISTS video_positions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id TEXT NOT NULL,
  video_slug TEXT NOT NULL,
  position_sec INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_video_positions_device_video
  ON video_positions (device_id, video_slug);
```

**Endpoint draft** (`routes/video.routes.js` + handler di
`controllers/videoController.js`, pola sanitasi sama dengan
`progressController.js`):
- `GET /api/video-progress?slug=` → posisi satu video (header `x-device-id`)
- `GET /api/video-progress/all` → daftar lanjut nonton (LIMIT 100, ORDER updated_at DESC)
- `POST /api/video-progress` body `{ videoSlug, positionSec }`
- Sanitasi: deviceId `[a-zA-Z0-9_-]` ≤128, slug ≤200, positionSec 0..86399

**Frontend hook** (`watch.js`):
- `timeupdate` throttled ±10 detik + `beforeunload`/`pause` flush → POST
- Hanya efektif mode native (iframe tidak bisa dibaca posisinya) — batasan sama dengan autoplay
- Resume: saat buka slug yang sama, seek ke posisi tersimpan (native only)

**Render:** section "Lanjutkan Nonton" di homepage — card standar 1.1 +
progress bar tipis amber di bawah thumbnail (persen = position_sec/durasi,
kalau durasi tak tersedia cukup titik henti).

**Keputusan roadmap yang dibutuhkan:** masuk sprint atau tidak — menambah
tabel DB + 3 endpoint (kelas risiko beda dari Bagian 1).

### 3.2 Episode page per-slug (eks C1/C2) — OPEN QUESTION #1
**Konteks:** `series.html` saat ini HANYA handle `?type=hentai|jav` (listing
banyak seri). Belum ada konsep "halaman episode satu seri". Link "Lihat semua
episode" di B3 akan mati tanpa ini.

**Opsi:**
| Opsi | Isi | Biaya |
|---|---|---|
| (a) Dual-mode `series.html` | `?type=` perilaku lama; `?slug=` render episode list | 1 file JS diubah, tanpa file baru |
| (b) Halaman baru `episodes.html?slug=` | Terpisah bersih | 1 html + 1 js + css |
| (c) Skip dulu | B3 jalan tanpa link; keputusan ditunda | 0 |

**Backend:** tidak butuh apa pun — `/api/video/detail?slug=` SUDAH return
`episodes[]` (parser `parseEpisodes`). Murni keputusan struktur frontend.
C1 header page (nama seri + jumlah episode) bisa dirender dari endpoint yang sama.

### 3.3 Autocomplete server-side (opsional)
Hanya kalau pendekatan client-side di 1.10 kurang memuaskan (judul ter-cache
terbatas). Endpoint search sudah ada — tinggal dedup/prioritas hasil di
controller. Prioritas sangat rendah.

---

## Bagian 4 — Keputusan Terbuka (bahan sesi roadmap)

| # | Keputusan | Opsi |
|---|---|---|
| 1 | Episode page per-slug | dual-mode series.html / episodes.html baru / skip |
| 2 | Lanjutkan Nonton masuk roadmap? | ya (rencana eksekusi sendiri) / tunda |
| 3 | Prioritas antar-Bagian | 1 dulu (disarankan) → 2/3 sesuai kapasitas |
| 4 | Durasi/views scraping (Bagian 2) | probe live dulu untuk pastikan data ada |

## Bagian 5 — Urutan indikatif

1. **Setelah UI manga selesai** → Bagian 1 (semua murah, dampak langsung)
2. Sesuai keputusan roadmap → Bagian 3.1 dan/atau 3.2
3. Bagian 2 kapan saja setelah probe live meyakinkan

## Bagian 6 — Catatan teknis transversal

- Setiap perubahan asset: bump query `?v=N` di referensi HTML atau
  `CACHE_VERSION` di `website/sw.js` (stale-while-revalidate menyajikan cache lama)
- Update `docs/06-architecture/module-map.md` setelah refactor `video/js/*`
- Standar UI: skill `wibudex-design` — tap target ≥44px, motion ≤300ms,
  single accent amber, thumb-reachable mobile
- Parser baru (Bagian 2) wajib disertai fixture HTML offline + unit test
  (pola existing: `tests/nekoFeatures.test.js`)
