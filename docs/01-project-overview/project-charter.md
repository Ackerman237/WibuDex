# Project Charter

## 1. Project Name
**Manga Scraper Platform** (repository: `Scrapper-manga`)

## 2. Purpose
A web application that aggregates and serves manga/doujin content by
scraping and normalizing data from external sources, presenting it through
a browsable library, search, reader, and bookmarking experience.

## 3. Goals
- Provide a fast, reliable browsing and reading experience for manga/doujin
  content (list, search, detail, chapter reader).
- Keep the scraping layer secure, resilient, and easy to maintain as source
  websites change their structure over time.
- Support two distinct content sources under one platform:
  - **Doujin module** — JSON API-based source (`doujin.desu.xxx`)
  - **Neko module** — HTML-scraped source (`nekopoi.care`)

## 4. Non-Goals
- This is **not** a full rewrite of the existing application. The existing
  frontend, routing, controllers, reader, and bookmark features are
  preserved as-is unless a specific task says otherwise.
- Not building a CMS or content-hosting platform — all content is sourced
  live from upstream sites, not stored permanently.

## 5. Tech Stack
- **Runtime:** Node.js
- **Server:** Express
- **Scraping:** Puppeteer Core, HTTPS Proxy Agent, SOCKS Proxy Agent
- **Testing:** Vitest (unit + integration)
- **CI/CD:** GitHub Actions (Node 18 / 20 / 22)
- **Logging:** Pino (structured, JSON, ISO timestamps)

## 6. High-Level Structure
```
Scrapper-manga/
├── controllers/        # mangaController.js, nekoController.js
├── lib/                # scraper.js, nekoScraper.js, browser.js, security.js
├── middleware/          # rateLimit.js, errorHandler.js
├── routes/              # api.js
├── website/              # doujinPage/, nekoPage/ — frontend
├── server.js            # Express entry point
└── package.json
```

## 7. Core Principles
1. **Separation of concerns** — controllers don't know scraping details;
   scrapers don't know about the frontend; security logic is never mixed
   into HTML-parsing logic.
2. **Untrusted input by default** — anything coming from an upstream source
   (HTML, JSON, redirects) is treated as untrusted and must be validated,
   normalized, and size-limited before it reaches the client.
3. **Incremental change over rewrites** — improve the scraper core and
   security posture without breaking the working application around it.
4. **Security first** — SSRF protection, rate limiting, and input
   validation are P0, not "nice to have."

## 8. Current Status Snapshot
See [`03-current-focus/current-sprint.md`](../03-current-focus/current-sprint.md)
for what's active and [`04-progress-log/changelog.md`](../04-progress-log/changelog.md)
for what's already shipped.
