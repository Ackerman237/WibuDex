---
name: wibudex-design
description: Skill QA & refinement UI/UX khusus project Wibudex. Gunakan SETIAP KALI me-review, memperbaiki, atau membangun tampilan halaman manga/video (audit spacing, kontras, tap-target, motion, hirarki visual). Enforces dark-first #0D0C0C, single-accent Cognac Amber #D97706 (tanpa accent kedua), motion maksimal 300ms, dan thumb-reachable mobile comfort. Acuan token: website/css/wibudex-tokens.css.
---

# Wibudex Design QA & Refinement Skill

This skill combines the audit protocol from `taste-skill/redesign-existing-projects` with Wibudex locked design specifications — acuan resmi: `website/css/wibudex-tokens.css` + `docs/06-architecture/style-guide.md`.

## Wibudex Locked Principles (Non-Negotiable)
1. **Single Accent**: `--accent-primary: #D97706` (Cognac Amber). Never introduce secondary accent colors.
2. **Dark-First Surface Scale**:
   - `--bg-base`: #0D0C0C
   - `--bg-surface`: #181615
   - `--bg-surface-raised`: #22201D
   - `--border-subtle`: #2E2A27
3. **Motion Boundary**: Maximum `--duration-slow: 300ms`.
4. **Thumb-Reachable**: All critical controls sit in the bottom zone on mobile.

---

## Design Audit Checklist (Adapted Protocol)

### Typography
- **Headlines**: Plus Jakarta Sans, heavy (700/800), tight tracking (-0.02em).
- **Body**: Inter, 15px, line-height 1.6 for readability.
- **Numbers**: `font-variant-numeric: tabular-nums`.

### Color & Elevation
- **Spotlight Hover**: Use `rgba(217, 119, 6, 0.4)` border on hover.
- **Glassmorphism**: Backdrop blur (20px) + background transparency (85%) for nav/overlay elements.
- **Elevation**: Use `var(--elevation-1)`/`--elevation-2` (border+glow), never heavy black shadows.

### Interactive Baseline
- **Tap Targets**: ≥ 44px (apply to .btn-primary, .btn-icon, .tappable, .bottom-nav__item).
- **Feedback**: `scale(0.97)` + `brightness(0.9)` on press.

---

## Komponen Kanonik (dari wibudex-tokens.css — reuse, jangan bikin ulang)

| Kebutuhan | Kelas token | Catatan |
|---|---|---|
| Card manga/video | `.media-card` + `__cover` (rasio 3/4.2) + `__title` + `__badge` | Skeleton: `.media-card--skeleton` (shimmer) |
| CTA utama ("Baca Sekarang") | `.btn-primary` (48px, amber solid) | Hover → `--accent-primary-hover` |
| Tombol ikon | `.btn-icon` (44×44, raised bg) | |
| Bottom nav mobile | `.bottom-nav` + `__item.is-active` + `__pill` | Glassmorphism built-in (`--nav-bg` + blur 20px) |
| Progress bar reader | `.progress-bar` (+ `.is-active`, `__fill`, `__label`) | |
| Reader auto-hide chrome | `.reader__chrome` + `.is-hidden` | |
| Type scale | `.text-display/h1/h2/body/caption/micro` | Angka: tambah class `.numeric` (tabular-nums) |
| State helpers JS | `showLoading/showError/showEmpty` di `shared/ui.js` | Pesan spesifik via `formatFetchError()` |

## Checklist Audit per Konteks Halaman

**Grid catalog/home**
- Grid: 2 kolom mobile / 3 tablet / 5–6 desktop; gap pakai `--space-*`
- Cover rasio konsisten (jangan campur 2:3 dengan 16:9 dalam satu grid)
- Badge tipe/bendera (`data-flag`) tidak menabrak badge chapter

**Hero carousel (home)**
- Dots & panah: visual kecil boleh, tapi hit-area tetap ≥44px (padding transparan)
- Auto-rotate berhenti saat user interaksi; hormati reduced-motion

**Pagination**
- Tombol angka & prev/next min-height 44px; state disabled jelas;
  halaman aktif pakai `--accent-primary-12` background

**Reader**
- Chrome auto-hide wajib bisa dipanggil balik dengan tap
- Kontrol next/prev di zona jangkauan ibu jari (bawah layar mobile)

**Gate QA akhir:** `node scripts/dev/verify-icons.mjs` lolos + cek manual 3 state
(loading/error/empty) + audit `ai-tell-audit` untuk pola generik.

---
