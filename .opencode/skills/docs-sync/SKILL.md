---
name: docs-sync
description: Gunakan skill ini SEBELUM mengerjakan task yang mengubah struktur folder/arsitektur besar, dan SETIAP KALI membaca AGENTS.md/README.md/module-map (docs/06-architecture) untuk konteks — cek dulu apakah dokumen itu masih akurat terhadap kode nyata sebelum dipercaya sebagai sumber kebenaran. Murni deteksi drift, bukan penulisan ulang dokumentasi otomatis.
---

# Docs Sync Skill

Ide skill ini dari temuan nyata di project ini sendiri: `AGENTS.md` dan
`README.md` sempat lama tidak sinkron dengan kode — `AGENTS.md` mendeskripsikan
arsitektur "tanpa backend/database, semua data JSON lokal + localStorage",
padahal project sekarang sudah punya Express + SQLite (`lib/db.js`,
`DatabaseSync`) + scraper live (`lib/scraper/`) + controllers (`controllers/`).
`README.md` isinya skema `comics.json` yang sudah tidak dipakai (data sekarang
datang dari scraping live, bukan file JSON statis). Skill ini untuk mencegah
drift semacam ini terulang, bukan untuk menulis ulang dokumentasi secara diam-diam.

## Sebelum Mempercayai Dokumen Arsitektur sebagai Konteks

Kalau task menyentuh struktur folder/arsitektur besar (nambah backend baru,
pindah storage, restrukturisasi direktori), **cek dulu** apakah
`AGENTS.md`/`README.md`/module-map masih akurat terhadap kode nyata di
`lib/`, `controllers/`, `routes/`, `website/` — jangan langsung dipakai sebagai
sumber kebenaran tanpa verifikasi cepat. Module-map (`docs/06-architecture/module-map.md`)
punya tanggal "Terakhir diperbarui" di headernya — kalau tanggal itu jauh lebih
lama dari perubahan struktur terakhir, curigai kontennya sudah basi.

Verifikasi cepat: cocokkan 2–3 klaim struktural di dokumen (misal "tidak ada
backend", "data dari JSON lokal") dengan keberadaan file nyata (`lib/db.js`,
`controllers/*.js`, isi `data/` sekarang). Kalau ada yang tidak cocok, itu
sinyal drift — jangan lanjut mengasumsikan sisa dokumen itu akurat.

## Kalau Ditemukan Drift

- **Tandai sebagai temuan terpisah ke user**, jangan diam-diam dibiarkan basi
  lagi dan jangan diam-diam ditimpa juga.
- **Jangan otomatis menulis ulang dokumentasi besar** (AGENTS.md, README.md)
  tanpa review — laporkan dulu bagian mana yang drift dan kenapa, biar user
  yang putuskan mau diperbarui seperti apa. Skill ini soal *deteksi*, bukan
  soal auto-rewrite.
- Kalau user minta diperbaiki, prioritaskan klaim yang benar-benar menyesatkan
  untuk task berikutnya (arsitektur, struktur folder, stack) di atas detail
  kosmetik (typo, format).

## Yang Bukan Scope Skill Ini

- Bukan review kualitas dokumentasi (grammar, kelengkapan) — murni soal apakah
  klaim faktual di dalamnya masih benar terhadap kode.
- Bukan pengganti `careful-logic-change` — kalau task juga mengubah logika
  kode (bukan cuma dokumentasi), tetap ikuti skill itu untuk bagian kodenya.
