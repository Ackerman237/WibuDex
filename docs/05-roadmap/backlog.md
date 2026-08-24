# Roadmap & Backlog

Items here are **not started**. Once an item is picked up, move it to
`03-current-focus/current-sprint.md`; once shipped, log it in
`04-progress-log/changelog.md` and remove it from here.

## P4 — ALL MANGA page enhancements
_All items shipped 2026-08-20. Moved to changelog._

## Frontend / UX polish (from session notes, uncommitted ideas)
- [ ] Show total page count once the backend exposes it.
- [ ] De-duplicate shared logic between `index.js` and `allManga.js` into
      a common helper module.
- [ ] Re-verify `NEXT`-disable logic under search-time backend filtering
      (result count can legitimately be `< limit` mid-list when filtered).

## Scraper Engine Migration & Security Hardening
_Core P0/P1 migration items completed 2026-08-21 (SSRF protection, proxy size/type validation, timeout, Map cache, decryptor separation, portable browser path, 87 unit & integration tests)._

### Future / Quality Improvements
- [ ] Concurrency control queue for outgoing external scraper requests
- [ ] Structured logging expansion for specific scraper telemetry events (`SCRAPER_CACHE_HIT`, etc.)
- [ ] Evaluate Redis for cache once scaling beyond single-instance deployment
- [ ] Reduce Neko scraper fragility to upstream HTML structure changes

## Not scheduled yet (parking lot)
- [ ] **Kandidat Skill QA**: Install & adaptasi skill `redesign-existing-projects` (`Leonxlnx/taste-skill`) sebagai alat bantu QA/polish (audit spacing, hirarki, motion quality). Posisi: alat bantu QA, BUKAN pengganti `WIBUDEX-MASTER-SPEC.md`. Dievaluasi setelah Fase 1–2 selesai.
- [ ] **TODO jika suatu saat republish ke GitHub**: repo lama masih bernama
      generik `Scrapper-manga` (github.com/Ackerman237/Scrapper-manga). Sebelum
      publik ulang, rename repo agar konsisten dengan identitas produk
      (`wibudex`). GitHub otomatis redirect dari URL lama, jadi aman.
      (Proyek saat ini sengaja terisolasi — remote dihapus 2026-08-24.)



