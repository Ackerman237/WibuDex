# Decision Log

Short records of non-trivial decisions and the reasoning behind them, so
the "why" doesn't only live in chat history. Newest first.

---

### 2026-08-20 — SQLite via node:sqlite for server-side reading position
**Decision:** Pakai `node:sqlite` (built-in Node 22+) sebagai storage untuk
reading position, bukan `better-sqlite3`, PostgreSQL, atau MongoDB.

**Why:** `better-sqlite3` butuh native build (node-gyp + Python) yang gagal
di Node 24. `node:sqlite` sudah built-in di Node 22+, zero dependency,
synchronous API yang cocok untuk operasi sederhana, dan tidak butuh setup
server. PostgreSQL/MongoDB overkill untuk fitur ini.

**Alternatives considered:**
- `better-sqlite3` — rejected karena native build gagal (node-gyp/Python issue di Node 24).
- PostgreSQL — rejected karena butuh server terpisah, overkill untuk skala ini.
- MongoDB — rejected karena skema fleksibel tidak diperlukan, NoSQL tidak
  memberi keuntungan di sini.

---

### 2026-08-20 — Per-device (anonymous) reading position, bukan per-user
**Decision:** Reading position disimpan per device ID yang di-generate di
localStorage, bukan per akun user yang login.

**Why:** Tidak ada sistem auth yang diimplementasikan. Device ID anonymous
cukup untuk use case "lanjut baca dari device yang sama". Menambah auth
system hanya untuk fitur ini tidak sepadan dengan kompleksitasnya.

**Alternatives considered:** Full user auth (register/login/JWT) — rejected
karena scope terlalu besar dan tidak ada kebutuhan multi-device sync saat ini.

---

### 2026-08-20 — Upgrade the scraper core, don't replace the app
**Decision:** Keep `Scrapper-manga` as the base application. Do not adopt
`doujin-scraper` as a full replacement. Only its scraping engine, security
patterns, and testing approach are ported in.

**Why:** `Scrapper-manga` already has the frontend, routing, controllers,
reader, bookmarks, and image proxy — a full rewrite would throw away
working, integrated functionality to chase a scraper that's better
engineered but incomplete as an application. `doujin-scraper`'s value is
specifically its scraper core (timeout, cache, normalization, sanitization,
tests) — that's the part worth taking.

**Alternatives considered:** Full rewrite on top of `doujin-scraper` —
rejected because it would require rebuilding frontend, routing, reader,
and bookmarks from scratch for no clear benefit.

---

### 2026-08-19 — URL-based pagination instead of static per-page files
**Decision:** ALL MANGA pagination is implemented as
`allManga.html?page=N&query=...` with one HTML/JS/CSS set, rather than
generating `page1.html`, `page2.html`, etc.

**Why:** Keeps the page count unbounded without generating files, makes
the page bookmarkable and refresh-safe, and lets browser back/forward
behave naturally. Query state travels in the same URL so search and
pagination don't conflict.

---

### 2026-08-19 — Made `Scrapper-manga` repository public
**Decision:** Repository visibility changed from private to public to
allow read access via a connected GitHub integration.

**Why:** Private-repo access requires explicit authentication/permission
setup; making the repo public was the simpler path to unblock review and
development at the time.

**Note:** Revisit if the project later needs to keep source code or
credentials-adjacent logic (e.g. decrypt/secret-handling code) out of
public view — consider re-privatizing once the integration supports
authenticated private access, or splitting sensitive logic out.

---

### Template for new entries
```md
### YYYY-MM-DD — <short decision title>
**Decision:** <what was decided>

**Why:** <the reasoning>

**Alternatives considered:** <what else was on the table, and why not>
```

