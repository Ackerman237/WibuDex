# Manga Scraper Platform (Scrapper-manga)

A web application that aggregates and serves manga/doujin content by scraping and normalizing data from external sources, presenting it through a browsable library, search, detail view, robust chapter reader, and server-side reading position tracking.

---

## Preview & Features

The platform provides:
- **Manga Catalog & All Manga Page** — Full library browse with server-side numeric pagination (`PREVIOUS / NEXT`), sorting controls (Newest / Rating / Title A–Z), and category/genre filtering.
- **Nekopoi Platform** — Video catalog browse (`/neko`), category listing and filtering, keyword search, and detail view. Watch page plays video in layered clean modes: **native `<video>`** (server-extracted direct MP4 stream — zero provider JS), falling back to a **server-filtered player frame** (ad/popunder scripts stripped + CSP sandbox), with a manual direct-mode toggle. Policy via `PLAYER_FRAME_MODE` env.
- **Manga Detail Pages** — Comprehensive view with chapter lists, metadata, and error/retry handling.
- **Manga Reader** — Lazy loading, chapter navigation, automatic **server-side reading position saving** (powered by built-in `node:sqlite`), and resilient UX: per-page loading skeletons, sticky progress bar (`📄 8/138 halaman siap`), auto-retry 3x backoff (1s→2s→4s) for failed images, classified error messages, and aggressive prefetch (1500px).
- **Personal Library & Bookmarks** — Local storage integration for favorites and bookmarks.
- **VPN Failover & Resilience** — Per-target VPN policy (`auto` for doujin, `always` for neko) with automatic provider failover; live connection state exposed via `/api/vpn-status`. Upstream unavailability maps gracefully to HTTP 503 (`UPSTREAM_UNAVAILABLE`).
- **Security & Hardening** — Robust image proxy with suffix-domain allowlists (`desu.pics`, `desu.xxx`), private-IP blocking (SSRF protection), response size capping (10MB), content-type validation, streaming pipe with timeout (configurable via `IMAGE_PROXY_TIMEOUT_MS`, default 20s), internal retry 1x for transient failures, in-memory LRU cache (max 150 entries, ~50MB), strict rate limiting, and input validation on every endpoint.
- **Testing & Quality** — Fully tested codebase with **148 Vitest tests passing across 10 test files** (including golden tests for the decryption pipeline), ESLint enforcement (`npm run lint`), and structured Pino logging.

---

## What This App Can Do

| Page | Capabilities |
|---|---|
| **Home** (`index.html`) | Browse latest/popular manga highlights. |
| **All Manga** (`allManga.html`) | Full catalog browsing: numeric pagination, sorting (Newest / Rating / Title A–Z), genre/category filter, explicit loading / empty / error states, bfcache-safe cover images. |
| **Detail** (`detail.html`) | Full manga metadata, chapter list, start/continue reading buttons, friendly error + retry handling. |
| **Reader** (`reader.html`) | Read chapters with lazy-loaded pages, sticky reading-progress bar, aggressive image prefetch, automatic retry of failed images, auto-saved reading position (server-side SQLite + localStorage fallback). |
| **Library** (`library.html`) | Personal bookmarks/favorites stored locally in the browser. |
| **Categories** (`categories.html`) | Explore manga by category/genre. |
| **Account** (`account.html`) | Placeholder page for the future account system (Phase 5). |
| **Nekopoi Home & Watch** (`nekoPage`) | Video catalog, category browsing, search, and watch page with proxied player. |

---

## API Endpoints

All endpoints are prefixed under `/api` and rate-limited. Summary:

| Endpoint | Description |
|---|---|
| `GET /api/manga` | Manga list (pagination, sorting, genre/category filter). |
| `GET /api/manga/categories` | Available manga categories/genres. |
| `GET /api/manga/detail` | Manga metadata + chapter list by slug. |
| `GET /api/chapter` | Chapter image list by slug + chapter. |
| `GET /api/image-proxy` | Hardened image proxy (allowlist, SSRF-safe, cached). |
| `GET /api/neko` | Nekopoi video list. |
| `GET /api/neko/categories` | Nekopoi category list. |
| `GET /api/neko/category` | Videos within a specific category. |
| `GET /api/neko/search` | Nekopoi keyword search. |
| `GET /api/neko/detail` | Video detail by slug. |
| `GET /api/neko/player-frame` | Server-filtered provider embed (anti popunder/redirect). |
| `GET /api/neko/stream` | Direct MP4 CDN URL extracted server-side (native player). |
| `GET /api/progress` | Reading position for one manga. |
| `GET /api/progress/all` | All saved reading positions. |
| `POST /api/progress` | Save/update reading position. |
| `GET /api/vpn-status` | Live VPN failover status. |

---

## Problem Solving Highlights

Key issues solved during development (full log: [`manga-scraper-docs/04-progress-log/changelog.md`](manga-scraper-docs/04-progress-log/changelog.md)):

- **Correct HTTP semantics** — upstream `404` no longer surfaces as `500`; missing slug/chapter now returns proper `404` responses with user-friendly messages.
- **Reader images blank after entering via filtered catalog** — initial pages are now always loaded into the DOM when a chapter opens, instead of relying on scroll events that never fire.
- **Covers disappearing after back-navigation (bfcache)** — restored lazy-loaded images are re-fetched via the `pageshow` event when the browser restores the page from back/forward cache.
- **Broken chapter numbers** — normalizer now exposes a consistent `number` field (keeping the legacy field for backward compatibility).
- **Resilient reader UX** — server error messages are properly classified (regex-matched upstream messages), with automatic single retry and an explicit "COBA LAGI" button on failure.
- **Known limitation (documented honestly)** — auto scroll-to-last-page on "continue reading" is temporarily disabled because it raced against lazy image initialization; saving/loading positions still works normally.

## Architecture

Request flow (separation of concerns per layer):

```text
HTTP request
  └ routes/api.js            # routing + rate limiter per endpoint
      └ controllers/         # validasi input (lib/validator.js) + format respons
          │                    mapping error upstream terpusat di middleware/upstreamResponse.js
          └ lib/scraper/
              ├ doujinScraper.js  # API terenkripsi: fetcher → decryptor → normalizer (+cache)
              ├ neko/             # HTML nekopoi: http.js (fetch+VPN retry) → parsers/ → index.js
              ├ fetcher.js        # concurrency limit, retry+backoff, proxy via undici dispatcher
              ├ cache.js          # CacheManager bersama (TTL + maxSize)
              └ decryptor.js      # XOR + key turunan bucket jam (SALT env)
      └ lib/vpn/vpnManager.js   # kebijakan per-target, failover provider, health scoring
      └ lib/imageProxy.js       # engine proxy gambar: allowlist, SSRF-safe, sharp thumbnail

Single sources of truth:
  lib/constants.js             # USER_AGENT, referer
  lib/config/playerHosts.js    # allowlist host player video
  lib/security.js              # safeHttpUrl (generik) / safeImageUrl (allowlist doujin)
  middleware/upstreamResponse.js  # error upstream → HTTP 404/503/500
```

## Project Structure

```text
/
├ controllers/            # HTTP handlers tipis (manga, neko, progress, vpn)
├ lib/                    # Core logic
│   ├── scraper/          # fetcher, decryptor, cache, normalizer, doujinScraper
│   │   └── neko/         # http.js, text.js, parsers/, index.js (scraper nekopoi)
│   ├── config/           # playerHosts.js (allowlist — satu sumber kebenaran)
│   ├── vpn/              # providers.js, vpnManager.js
│   ├── imageProxy.js     # engine proxy + optimasi gambar (sharp)
│   ├── constants.js      # USER_AGENT, referer
│   ├── security.js       # safeHttpUrl, safeImageUrl, stripHtml, isPrivateHost
│   ├── validator.js
│   ├── logger.js
│   ├── db.js
│   └── browser.js
├ middleware/             # Rate limiting, error handling, upstream response mapping
├ routes/                 # API route definitions
├ website/                # Frontend assets (doujinPage/, nekoPage/)
├ tests/                  # Vitest unit & integration suites (148 tests, 10 files)
├ scripts/                # demo.js, get-secret.js
│   └── dev/              # Development/lab scripts (player-frame lab, dll.)
├ manga-scraper-docs/     # Dokumentasi & decision log (01–08)
├ data/                   # SQLite database for reading positions
├ .data/                  # VPN manager persistent state
├ package.json            # Dependencies & scripts
├ eslint.config.js        # ESLint flat config (npm run lint)
├ server.js               # Main application server (PORT via env, fallback auto)
└ .env.example            # Environment configuration template
```

---

## Roadmap & Status

- [x] **Phase 1: Reader & Pagination Enhancement** — Numeric pagination, sorting, category filtering, explicit UI states, and server-side reading position tracking (`node:sqlite`). *(Completed)*
- [x] **Phase 2: Scraper Engine Migration & Security Hardening** — SSRF protection, image proxy limits, request timeouts (configurable via `IMAGE_PROXY_TIMEOUT_MS`, default 20s), caching, input validation, streaming proxy with LRU in-memory cache, and comprehensive Vitest test suite (148 tests passing across 10 files). *(Completed)*
- [x] **Phase 3: VPN Failover & Resilience** — Per-target VPN policy (`auto` for `doujin`, `always` for `neko`), graceful `UPSTREAM_UNAVAILABLE` → HTTP 503 mapping, and automatic error classification for 404 vs transient errors. *(Completed)*
- [ ] **Phase 4: Recommendation System** — Personalized recommendations based on bookmarks and history.
- [ ] **Phase 5: Account System** — User authentication and cloud synchronization.

---

## How to Run

### Requirements
- Git
- Node.js **>= 22.5** (`node:sqlite` / `DatabaseSync` butuh 22.5+)
- Modern web browser

### Installation

1. Clone the repository:
```bash
git clone https://github.com/Ackerman237/Scrapper-manga.git
cd Scraper-manga
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
# Update .env with your specific configuration
```

> **Note:** `DOUJIN_APP_SECRET` and `DOUJIN_SALT` must be extracted from the target site's bundle — run `npm run get-secret` with a valid `.env` skeleton in place, or refer to the original [doujin-scraper](https://github.com/kyy0887/doujin-scraper) README for details.

4. Run the server:
```bash
npm start
```

The application will be available at the port set in `.env` (`PORT`, default `3333`), falling back to `http://localhost:4000` if unset — with automatic port increment if that port is already occupied.

---

## Development Philosophy

This project is developed incrementally. The focus is on maintainable code, stability, and a seamless user experience. Large architectural changes are implemented only after existing features are tested and stable.

> **Note:** The Nekopoi watch page embeds provider players directly via iframe. The server-side player fallback experiment (`lib/scraper/playerFrame.js` + lab in `scripts/dev/`) is kept isolated and can be promoted to production if providers ever block direct embedding.

---

## Notes

This is a personal learning project. Features and architecture are subject to change based on development progress and optimization needs.

---

## Credits

This project is heavily adapted and inspired by the following repository:

- [doujin-scraper](https://github.com/kyy0887/doujin-scraper) — Used as the primary foundation for the scraping logic, API structure, and overall project architecture.

---

## License

License will be determined at a later stage of development.

Portions of this project are adapted from [doujin-scraper](https://github.com/kyy0887/doujin-scraper). Please refer to the original repository for its license terms and source code usage guidelines.