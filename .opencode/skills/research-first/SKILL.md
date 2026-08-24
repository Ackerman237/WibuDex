# Skill: Research First

Gunakan skill ini SETIAP KALI:
- **Terbuntu** — bug tidak ketemu akarnya setelah 2-3 iterasi, solusi tidak jalan, perilaku berbeda dari harapan
- **Sebelum menulis solusi untuk kelas masalah baru** yang belum pernah dibangun di project ini (streaming proxy, autentikasi, dsb.)
- **Saat memulai fitur/desain besar** yang polanya sudah mapan di industri (jangan mengarang dari nol)

Inti: **masalah yang kita hadapi hampir pasti pernah dihadapi, didokumentasikan, dan diperbaiki orang lain.** Mencari 10 menit lebih murah daripada menebak 2 jam.

---

## Prosedur Wajib

### 1. Rumuskan masalah sebagai kata kunci bahasa Inggris
Kata kunci = teknologi + gejala + konteks. Contoh nyata yang berhasil:
- `"node.js fetch AbortError unhandled 'error' event Readable pipe crash client disconnect"` → langsung ketemu node-fetch #1801 (bug & fix identik)
- `"express stream pipe response no error handler crash"` → PeerTube PR #7535 (fix resmi untuk bug sama persis)

### 2. Pilih sumber sesuai jenis masalah

| Jenis masalah | Sumber utama |
|---|---|
| Crash/error runtime | GitHub Issues + PR proyek besar sejenis (node-fetch, undici, PeerTube, express, http-party) — cari yang punya **reproduksi + fix merged** |
| Pola arsitektur/backend | Dokumentasi subsistem proyek open-source sejenis, PR refactor mereka |
| Desain UI/halaman | Open-source client sejenis (fitur list + screenshot), studi kasus UX (uxplanet.org), design system docs |
| Parser/scraping | Fixture + test di repo scraper open-source; probe upstream dulu |

### 3. Kriteria referensi VALID
- Issue dengan **langkah reproduksi** + **fix yang sudah di-merge** (bukan diskusi menggantung)
- PR di proyek besar dengan review
- Dokumentasi resmi / design system docs proyek aktif
- ✗ Blog tanpa bukti, jawaban forum tanpa penjelasan mekanisme

### 4. Catat dalam TABEL REFERENSI di laporan
Format: sumber → apa yang relevan → apa yang diadopsi. Contoh output yang benar ada di entri changelog "(11)" dan laporan penanda baca detail.

### 5. Adopsi pola fix RESMI, bukan karangan sendiri
Kalau proyek besar memperbaiki bug identik dengan pola tertentu (mis. `pipeline()` alih-alih `.pipe()` + listener manual), ikuti pola mereka + tambahkan hardening dari referensi lain.

---

## Kasus Nyata Terbukti (2026-08-24)

| Masalah | Referensi yang menyelamatkan | Hasil |
|---|---|---|
| Server crash saat user pindah episode (stream proxy) | PeerTube #7535 (bug identik), node-fetch #1801 (mekanisme abort→emit error) | Fix `pipeline()` + hardening `response.destroyed`, test regresi |
| Redesign watch page streaming | kairo-minimal (anime client), kino docs (design system), iptvnator PR #1127 (two-state browse↔watch) | Blueprint sidebar episode + related + autoplay countdown |

---

## Anti-Pola yang Harus Dihindari

- Menebak-menebak >3 iterasi tanpa sekali pun mencari referensi
- Mengklaim "✅ verifikasi lengkap" padahal baru gate statis (lihat AGENTS § QA Frontend)
- Memakai referensi tanpa memverifikasi relevansinya ke versi/stack kita
- Menemukan referensi bagus tapi TIDAK mencatatnya → hilang untuk sesi berikutnya (wajib masuk tabel referensi di changelog/laporan)

---

## Referensi Tercatat (per kategori — tambah terus)

### Mobile video player UX (gesture-first)
- **onfranciis.hashnode.dev** "UX of Modern Video Players" (2025): tap=play/pause · double-tap tepi kiri/kanan seek ±10s (tap berturut = akumulasi) · swipe vertikal kanan=volume, kiri=brightness (native app) · scroll wheel=volume · M=mute dengan feedback visual
- **eleken.co** "Video Player UI Best Examples": auto-hide controls sudah *wajib* · pill-shaped controls naik di mobile tapi kontroversial di desktop (presisi mouse) · thumbnail preview saat scrub · chapter markers
- **zencopa.com** mobile-first: double-tap seek snippet kode (interval <300ms, posisi <50% lebar = rewind) · tombol besar + spacing · timer auto-hide
- **think.design**: volume response <50ms · playback mulai <1s · ganti episode tanpa keluar player

### Animated icons (pengganti emoji, identitas video)
- **carmenansio.com** perbandingan: SVG+CSS = 0kb & cukup untuk micro-interaction · Lottie 60-100kb gz hanya layak untuk animasi kompleks After Effects · Iconify/Lucide Motion/Phosphor Animated = pustaka siap pakai terbatas
- **github gorkem-bwl/animated-icons**: 3.640 ikon Lucide/Iconoir/Heroicons **CSS-only hover animation, nol dependency JS** — tersedia standalone SVG dengan CSS embedded (bisa disalin ke sprite kita!) · animasi semantik per kategori (bell-ring, heart-beat, gear rotate, nudge panah, spin refresh)
- Keputusan arah untuk Wibudex Video: **SVG sprite + CSS animation sendiri** (nol dep, konsisten sistem ikon manga), bukan Lottie/Rive

### Watch page streaming layout
- **kairo-minimal** (GitHub, anime client): custom controls auto-hide · side panel episode grid + related · speed persisten antar episode · resume per-episode · PiP · multi-server picker
- **kino docs** (design system): "streaming first, management second" · dark #0a0a0a bukan hitam pekat · skeleton states · snap-scroll rows · autoplay next countdown 10s di 90% durasi · keyboard shortcut lengkap
- **compose.page** episodic design system: episode card anatomy (badge row, title 1 baris, micro-meta) · queue-as-data di URL · preload next episode SAJA · touch target ≥44px
