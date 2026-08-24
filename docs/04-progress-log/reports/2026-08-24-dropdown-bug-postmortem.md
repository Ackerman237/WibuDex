# Postmortem — Dropdown Katalog Tidak Muncul (+ 2 Bug Serta-merta)

> Tanggal: 2026-08-24 · Commit perbaikan: `fix(manga): dropdown tak muncul +
> searchbar mobile wrap` · Dilaporkan user saat QA visual katalog mobile.

## Ringkasan

Tiga bug frontend lolos dari seluruh gerbang verifikasi statis yang saat itu
semua hijau (npm test 183/183, kontrak DOM, verify-icons, smoke HTTP 200).
Ketiganya baru ketahuan lewat QA runtime manual oleh user. Dokumen ini
menganalisis kenapa, dan menetapkan aturan permanen supaya tidak terulang.

## Insiden

### 1. Panel dropdown tak pernah muncul (fatal, semua viewport)
`filter-dropdown.js` membuat panel dengan `panel.hidden = true`, lalu toggle
hanya membuka **class** `.is-open` — atribut `hidden` tidak pernah dilepas dan
CSS `.fdrop__panel` tidak mendeklarasikan `display`, sehingga style UA
`[hidden] { display: none }` berlaku selamanya.

- **Akar masalah:** dua sumber kebenaran untuk satu state UI (atribut + class),
  hanya satu yang dibuka.
- **Aturan permanen:** satu kondisi state UI = SATU mekanisme toggling.
  Untuk panel/popover: class saja (`display:none` → `.is-open {display:block}`).

### 2. Rail scroll mengklip panel dropdown (mobile)
`.filter-bar` mobile memakai `overflow-x: auto`. Sesuai spesifikasi CSS, bila
satu axis bukan `visible`, axis lain ikut jadi `auto` → filter bar menjadi
scroll container yang **mengklip semua keturunan absolut**, termasuk panel
dropdown di dalamnya.

- **Akar masalah:** fitur rail ditambahkan SETELAH dropdown, tanpa review
  interaksi antar-fitur; gotcha platform tidak dikenali.
- **Aturan permanen:** popover/dropdown WAJIB `position: fixed` yang diukur
  dari `getBoundingClientRect()` trigger (+ clamp tepi viewport), tutup saat
  scroll/resize. Dilarang mengandalkan `position: absolute` di dalam ancestor
  yang bisa menjadi scroll container. Implementasi acuan: `filter-dropdown.js`.

### 3. Hamburger turun ke baris kedua (mobile)
`.nav-search` mobile memakai `flex: 1 1 auto`. Dengan `flex-basis: auto`,
ukuran dasar item = lebar intrinsik kontennya — `<input>` prefered width-nya
±200px → total baris melebihi viewport → item terakhir (hamburger) wrap.

- **Akar masalah:** klaim "grow pasti mendorong hamburger ke ujung" dipercaya
  tanpa memahami bahwa basis auto dihitung dari konten sebelum grow/shrink.
- **Aturan permanen:** flex item yang harus "mengisi sisa ruang" di baris
  terkunci pakai `flex: 1 1 0` + `min-width: 0`, bukan `1 1 auto`.

## Sebab Meta — Kenapa Lolos Semua Gate

1. **Semua gate saya statis**: syntax check, kontrak ID, verify-icons,
   smoke HTTP 200, npm test (backend). Tidak ada satu pun eksekusi runtime —
   tidak ada klik, render, atau pemeriksaan layout nyata.
2. **Klaim keyakinan palsu**: laporan "✅ verifikasi lengkap" diberikan untuk
   pekerjaan yang sebenarnya belum diverifikasi perilakunya.
3. **Pola berulang dalam sesi yang sama** (nav hamburger salah posisi, entri
   changelog heading tertelan 3×, kini ini): edit → gate statis → klaim
   selesai, tanpa pemeriksaan perilaku.

## Aturan Permanen (terpasang di)

| Aturan | Lokasi |
|---|---|
| Frontend interaktif wajib QA runtime (klik buka/tutup, keyboard, 360/768/1280px) sebelum boleh disebut selesai; tanpa itu label = "menunggu QA runtime" | `AGENTS.md` § Alur Kerja + skill `wibudex-design` |
| Popover/dropdown wajib fixed positioning terukur | `AGENTS.md` § Alur Kerja + komentar `filter-dropdown.js` |
| Satu state UI = satu mekanisme toggling (anti dual source of truth) | skill `careful-logic-change` |
| Cek tabel skill AGENTS sebelum eksekusi task, bukan sesudah | `AGENTS.md` § Alur Kerja |

## Pelajaran Proses Lain dari Sesi Ini

- **Service worker stale-while-revalidate**: revisi CSS tetap menyajikan aset
  lama pada kunjungan pertama — setiap batch perubahan aset wajib bump
  `CACHE_VERSION` (roadmap §5; sudah dijalankan v9→v10→v11).
- **Skill mapping AGENTS bukan opsional**: `careful-logic-change`,
  `pwa-caching`, `wibudex-ux` sempat terlewati padahal task-nya masuk
  kategorinya. Dimuat ulang dan mulai dipatuhi mulai fix ini.
