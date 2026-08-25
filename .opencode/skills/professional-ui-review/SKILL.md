# Skill: professional-ui-review

Gunakan skill ini SETIAP KALI 1 halaman/section visual selesai — sebagai penilai independen setara UI Designer profesional, SEBELUM commit. Pelengkap `wibudex-design` (patokan token WibuDex) dan `ai-tell-audit` (anti-pola AI) — skill ini menilai prinsip universal.

---

## 1. Prinsip: Tiga Tes Sebelum Checklist

Lakukan berurutan, sebelum membuka checklist 80 poin:

1. **Squint test** — kaburkan mata: apakah hierarki masih terbaca? CTA utama tetap paling menonjol?
2. **Grayscale test** — hilangkan warna: apakah hierarki & state masih komunikatif tanpa warna?
3. **Token test** — ganti typeface (Inter) / warna (biru korporat) di kepala: apakah desain terasa beda bermakna? Jika tidak → default, kurang identitas.

## 2. Tujuh Dimensi Penilaian

Nilai tiap dimensi **pass / minor issue / major issue**. Urutan laporan = severity tertinggi dulu.

### 1) Visual Hierarchy
- **Entry point:** satu elemen dominan yang menangkap mata pertama — apakah itu yang paling penting?
- **Eye flow:** F-pattern (list/tabel) vs Z-pattern (hero+CTA) sesuai konteks? Ada dead-end/loop membingungkan?
- **Weight:** rasio ukuran ≥1.5× antar level hierarki? Bold dipakai hemat (<2 level aktif)?
- **Emphasis:** tepat satu zona emfasisi per view? Warna/kontras dipakai hemat?
- *Gagal umum:* multiple competing primaries, hierarchy flattening, buried CTA.

### 2) Composition
- **Balance:** bobot visual seimbang (dark fill / gambar besar diimbangi ruang kosong)?
- **Whitespace:** macro 40-80px antar section, 24-32px antar group, 8-16px antar elemen — dari skala spacing?
- **Rhythm:** interval spacing konsisten dari skala? Kartu/grid ukuran & gap seragam?
- **Gestalt:** proximity, similarity, figure-ground, continuity.
- *Gagal umum:* top-heavy, fragmentasi pulau-pulau, divider berlipat ganda.

### 3) Typography
- **Scale:** hanya 6-8 langkah (12·14·16·20·24·32·40) — body 15-16px desktop / ≥14 mobile, line-height 1.5-1.6 body / 1.2-1.3 heading?
- **Readability:** 45-75 char/line, letter-spacing heading tight (-0.02em), contrast 4.5:1 body?
- **Konsistensi:** elemen semantik setara (semua judul kartu) pakai style sama? Tidak ada one-off 2px?
- **Token:** semua via `--font-*`, `--text-*`? Hardcode harus diganti token.
- *Gagal umum:* scale drift, line-height tertukar, centered heading di atas body rata kiri.

### 4) Color & Elevation
- **Palet:** netral scale (50→900) + 1 accent (`--accent-primary` #D97706) + semantic (success/warning/error) — tidak ada hex hardcode?
- **Depth:** elevation via `var(--elevation-*)` (border+glow), bukan shadow hitam berat?
- **Glassmorphism:** hanya nav/overlay (blur 20px + 85% transparansi)?
- *Gagal umum:* palet berantakan, shadow berat di dark theme, glass dipakai di banyak tempat.

### 5) Affordance & Interaksi
- **CTA clarity:** satu CTA dominan per view (filled), sekunder ghost — label spesifik ("Baca Sekarang" bukan "OK")?
- **Tap target:** ≥44px, feedback `scale(0.97)` + `brightness(0.9)`?
- **State:** hover/focus/disabled/loading/empty/error didesain?
- *Gagal umum:* CTA tenggelam, tap target kecil, tidak ada focus state.

### 6) Information Density
- **Priority:** konten paling penting paling menonjol, yang jarang dipakai disembunyikan?
- **Scanning:** clamp judul 2 baris, badge tidak menabrak, meta ringkas?
- *Gagal umum:* dense wall of text, tidak ada titik bernapas.

### 7) Responsive & States
- **Breakpoint:** 360 / 768 / 1280 — grid 2/3/5-6 kolom, tidak ada horizontal scroll?
- **Bounds:** container `max-width` + tidak pecah di layar besar?
- *Gagal umum:* horizontal scroll 360px, kartu melebar aneh.

## 3. Prioritas Perbaikan

| Prioritas | Kategori | Contoh |
|-----------|----------|--------|
| P0 Critical | Fungsionalitas pecah | Overlap total, konten hilang |
| P1 High | UX serius | Teks tak terbaca, tombol tak bisa dipencet |
| P2 Medium | Sedang | Alignment, spacing inkonsisten |
| P3 Low | Minor | Perbedaan posisi tipis, variasi warna minor |

## 4. Alur Kerja Wajib (terintegrasi screenshot)

Skill ini **MEMBACA hasil `scripts/dev/ui-audit.mjs`** — bukan menebak kode:

1. Jalankan audit: `$env:SHOT_DIR="%TEMP%\ui-audit" node scripts/dev/ui-audit.mjs`
2. Buka PNG `manga-*.png`, `video-*.png` di folder tersebut — ini sumber kebenaran visual.
3. Baca laporan `spacingIssues / overflowEls / zeroIcons` dari stdout audit.
4. Bentuk opini sendiri dulu (feeling + kegagalan utama) SEBELUM membuka checklist — checklist hanya konfirmasi.
5. Nilai 7 dimensi, tentukan severity.
6. Laporan **wajib** berbentuk:

```
AI-slop verdict → First impression → 2-3 hal working → 3-5 isu prioritas P0-P3 (tiap isu: Observation / Problem / Fix+token) → Pertanyaan provokatif
```

> Anchor discipline: bedakan opini desain ("hierarki runtuh karena X") vs preferensi ("saya suka font lain") — tulis mana yang mana.

## 5. Contoh Temuan yang Sudah Tertangkap di Project

- `detail-meta-strip` overflow 229>218 di 360px — fix: `flex-wrap + max-width:100%` (P2)
- Ikon `.ic` di dalam panel tersembunyi terhitung 0px — false positive, filter `checkVisibility()`
- Badge `data-flag` menabrak badge chapter — perlu gap token

## 6. Yang Bukan Scope

- Bukan audit token WibuDex (itu `wibudex-design`).
- Bukan cek kesan AI generik (itu `ai-tell-audit`).
- Jika file `PRODUCT.md`/`DESIGN.md` tidak ada, lewati dimensi Brand Consistency — jangan mengarang aturan brand.

---
Base directory: `.opencode/skills/professional-ui-review`
