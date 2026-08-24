# System Architecture

## 1. Overview
The application is an Express server that serves a static frontend
(`website/`) and exposes a JSON API (`/api/*`) backed by two independent
scraping modules: **Doujin** and **Neko**.

```
                     ┌───────────────┐
                     │   Frontend    │
                     │  (website/)   │
                     └──────┬────────┘
                            │
                     ┌──────▼────────┐
                     │  routes/api.js │
                     └──────┬────────┘
              ┌─────────────┴─────────────┐
      ┌───────▼────────┐          ┌───────▼─────────┐
      │ mangaController │          │  nekoController  │
      └───────┬────────┘          └───────┬─────────┘
      ┌───────▼────────┐          ┌───────▼─────────┐
      │  lib/scraper.js │          │ lib/nekoScraper  │
      └───────┬────────┘          └───────┬─────────┘
      ┌───────▼────────┐          ┌───────▼─────────┐
      │ doujin.desu.xxx │          │  nekopoi.care    │
      │  (JSON API)     │          │  (HTML page)     │
      └────────────────┘          └──────────────────┘
```

## 2. Doujin Module
- **Path:** frontend → `/api/manga` → `mangaController.js` →
  `lib/scraper.js` → upstream JSON API → normalize → response.
- **Endpoints:** `/api/manga`, `/api/manga/detail`, `/api/chapter`,
  `/api/image-proxy`.
- **`lib/scraper.js` responsibilities:**
  - Request timeout
  - Simple in-memory cache (Map-based)
  - `APP SECRET` + device ID handling
  - Decryption of certain upstream responses
  - Data normalization
  - Offset-based pagination: `offset = (page - 1) * limit`

## 3. Neko Module
- **Path:** frontend → `/api/neko/*` → `nekoController.js` →
  `nekoScraper.js` → fetch + regex-parse `nekopoi.care` HTML → response.
- Uses Cloudflare WARP (`warp-cli`) and an optional proxy via environment
  variable to reach the source.
- Uses Puppeteer for a specific player component.
- More fragile than the Doujin module by nature — it depends directly on
  upstream HTML structure, which can change without notice.
- Known technical debt: `CHROME_PATH` is currently hardcoded for Windows.

## 4. Frontend Pages
| Page | Files | Responsibility |
|---|---|---|
| HOME | `index.html/js/css` | Shows recent/updated manga |
| ALL MANGA | `allManga.html/js/css` | Full library browse: 50/page, prev/next pagination, search — all state kept in the URL (`?page=`, `?query=`) |
| DETAIL | `detail.html/js` | Manga detail view |
| READER | `reader.html/js` | Chapter reader |

## 5. Design Principles in Effect
- Controllers stay thin — they orchestrate, they don't scrape or parse.
- Scraper modules never format data for a specific view — they return
  normalized domain objects.
- Anything received from an upstream source is treated as untrusted until
  it passes through normalization.
- The two modules (Doujin, Neko) are independent — a change or outage in
  one should not affect the other.

## 6. Where This Is Heading
The scraper core (`lib/scraper.js`, `lib/nekoScraper.js`) is scheduled for
a security/reliability upgrade without touching the frontend, routing, or
controllers. See [`scraper-migration-plan.md`](scraper-migration-plan.md)
for the full blueprint, target module layout, and rollout steps.
