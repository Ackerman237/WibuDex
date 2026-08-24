# Scraper Engine Migration Blueprint
**Upgrading the scraping engine of `Scrapper-manga` using patterns proven
in the `doujin-scraper` prototype.**

## 1. Goal
Upgrade the scraping layer of `Scrapper-manga` by bringing in the
important improvements from the `doujin-scraper` prototype, **without
breaking** the existing application: frontend, reader, bookmarks, routing,
controllers, image proxy, or library features.

**Approach:** additive, not a replacement.

```
  Existing App  +  Hardened Scraping Engine  +  Security  +  Testing
                              =
                  Scrapper-manga v2 (scraper core upgraded)
```

## 2. Why Not Just Switch to the Prototype
| | `Scrapper-manga` | `doujin-scraper` |
|---|---|---|
| Completeness as an app | Full app: frontend, routes, controllers, reader, bookmarks, image proxy, API layer, existing `security.js` | Focused scraping engine/library only |
| Scraper quality | Needs improvement | Isolated, well-tested core: timeout, cache, normalization, URL sanitization, secret/salt handling, unit tests, CI, cleaner pagination |

**Conclusion:** keep `Scrapper-manga` as the application; replace only its
scraping layer with the better-engineered approach from the prototype.

## 3. Target Module Layout
```
website/            # frontend — unchanged
routes/              # unchanged
controllers/         # unchanged, but call the new scraper service
lib/
  scraper/
    doujin.js
    neko.js
    http.js
    cache.js
    normalize.js
    decrypt.js
    security.js
middleware/
  rateLimit.js
  errorHandler.js
tests/
  scraper.test.js
  neko.test.js
  security.test.js
  proxy.test.js
```
(A flatter `lib/` layout — `scraper.js`, `nekoScraper.js`, `http.js`,
`cache.js`, `normalize.js`, `decrypt.js`, `security.js` — is acceptable if
a deep folder isn't wanted.)

**Boundaries:**
- Controllers do not handle scraping details.
- Scraper services do not handle frontend concerns.
- Security is never mixed with HTML parsing.
- HTTP handling is separate from data parsing.

## 4. Must-Have Features Ported From the Prototype

### A. Request Timeout
- `AbortController`, initial target **12s**.
- Every scraper request must have a timeout — prevents hung requests,
  socket/memory exhaustion, and request pile-up.

### B. Cache
- In-memory `Map` + TTL, initial target **60s**.
- Cache key must include endpoint + query + page + other significant
  params, e.g. `manga:list:page=1`, `manga:search:naruto:page=1`.
- Not a permanent store — consider Redis for multi-instance deployments.

### C. Data Normalization
- All upstream data is untrusted. After parsing: enforce types, trim
  strings, cap string length, cap array length, validate URLs, and never
  pass foreign/unexpected fields through to the client.
- Suggested caps: `title` ≤ 500, `slug` ≤ 200, `type`/`status` ≤ 50
  (adjustable).

### D. Pagination
- `offset = (page - 1) * limit`.
- Preserve the metadata the frontend already relies on: `totalCount`,
  `totalPages`, `currentPage`, `hasPrevious`, `hasNext`.

### E. URL Sanitization
- Keep the existing `security.js`, merged with the prototype's approach.
- A URL must: parse successfully, be http/https only, reject
  `javascript:`, `data:`, `vbscript:`, and reject malformed URLs.
- **http/https-only is not sufficient SSRF protection on its own** — see
  `07-security/security-policy.md`.

### F. Secret / Salt Handling
- Keep the prototype's mechanism for pulling secret/salt from source when
  required, treated as runtime configuration: `DOUJIN_APP_SECRET`,
  `DOUJIN_SALT` — stored in environment/config, never committed.
- Note: if a secret/salt is inherently exposed to the browser by the
  source site itself, it isn't equivalent to a private credential like a
  database password — but it's still kept out of the repo as a matter of
  hygiene.

### G. Decryption
- Isolated in `decrypt.js`. On failure: log full detail server-side,
  return a generic error to the client.

### H. Testing
Minimum coverage: scraper list, scraper detail, chapter images, search,
genres, Neko scraper, URL sanitizer, malformed URL, HTML sanitization,
pagination, timeout, cache, decryption failure, image-proxy security.

## 5. Security Hardening (P0 — highest priority)
See the full checklist in [`../07-security/security-policy.md`](../07-security/security-policy.md).
In short: the existing `/api/image-proxy?url=...` endpoint is a classic
SSRF vector and needs a domain allowlist, private-IP blocking, redirect
re-validation, response size limits, content-type validation, timeout, and
rate limiting — **all together**, not just protocol checking.

## 6. API Error Handling
Never return raw internal error details to the client (they can leak
internal URLs, server paths, library details, or source-site specifics).

```
Server log:  full error detail
Client gets: { "success": false, "message": "Failed to fetch data" }
```

## 7. Rate Limiting
Apply at minimum to: search, manga list, manga detail, chapter, image
proxy. Works together with cache + timeout + concurrency control — not as
a substitute for any of them.

## 8. Retry Policy
- Max 1–2 retries, with backoff.
- Retry only for: timeout, 502, 503, 504.
- Never retry: invalid URL, 400, 401, 403, parsing errors, decrypt errors.

## 9. Migration Steps
1. Create branch `upgrade-scraper`; commit/backup the current stable
   state.
2. Compare old vs. prototype functions and map them 1:1
   (`scrapeMangaList() → scrapeMangaList()`, etc.) — don't touch the
   controller yet.
3. Build the new scraper behind a **compatible interface**.
4. Verify new-scraper output matches what the old frontend expects
   (`title, slug, thumbnail, type, status, genres, chapters`) — map field
   names in the normalizer if the prototype differs.
5. Switch the controller over incrementally:
   `controller → new scraper service → source`.
6. Test every endpoint.
7. Only after full verification, remove the old scraper code that's no
   longer used.

**Rule:** don't remove old features directly. Frontend, reader, bookmark,
favorite, routes, existing API response shapes, image retry, library UI,
Neko page, and the proxy (once secured) all stay. Use a compatibility
mapping layer if the new scraper's output shape differs from what the
frontend needs — never force the frontend to change just because the
scraper changed.

## 10. Observability
Structured log events to add: `SCRAPER_REQUEST`, `SCRAPER_TIMEOUT`,
`SCRAPER_CACHE_HIT`, `SCRAPER_CACHE_MISS`, `SCRAPER_PARSE_ERROR`,
`SCRAPER_DECRYPT_ERROR`, `PROXY_BLOCKED`, `RATE_LIMITED`.
Never log credentials, sensitive cookies, tokens, or real secrets.

## 11. Input Validation
- `page`: integer, min 1
- `limit`: integer, min 1, sensible max (e.g. 50/100)
- `search`: max length enforced
- `slug`: restricted allowed format
- `url`: dedicated validation + allowlist

## 12. Concurrency Control
Never fire an unbounded batch of requests (e.g. 100 chapter images at
once). Recommended concurrency: 3–5, tuned to what the source can handle.

## 13. Cache Policy (initial TTLs)
| Data type | TTL |
|---|---|
| List | 30–60s |
| Search | 30–60s |
| Detail | 60–300s |
| Genres | minutes to hours |
| Chapter images | cautious — avoid aggressive caching if URLs are dynamic |

## 14. What to Take From the Prototype vs. What Not To
**Take (required):** timeout, cache, normalization, pagination, URL
sanitization, decrypt separation, tests, secret extraction/configuration.

**Take (recommended):** limited retry, structured error handling, HTTP
helper, parser helper, security helper.

**Do not copy wholesale:** the entire prototype project, its controllers,
its frontend, its server configuration, or its image proxy without adding
hardening.

## 15. Implementation Priority
- **P0 — Security:** image proxy hardening, SSRF protection, rate
  limiting, timeout, response size limit.
- **P1 — Scraper core:** upgrade Doujin scraper, upgrade Neko scraper,
  decrypt module, normalization, pagination.
- **P2 — Performance:** cache, concurrency control, retry/backoff.
- **P3 — Quality:** unit tests, integration tests, logging, CI.

## 16. Expected End-State Flow
```
User → Express → Rate Limit → Validation → Controller → Scraper Service
       → (Cache / Timeout / Retry / HTTP) → Source API → Decrypt
       → Normalize → Application Response → Frontend
```

## 17. Definition of Done
- [ ] All old scraper functions still work
- [ ] Old frontend is not broken
- [ ] Search still works
- [ ] Pagination still works
- [ ] Manga detail still works
- [ ] Chapter still works
- [ ] Neko scraper still works
- [ ] Image proxy still works
- [ ] Image proxy is protected against SSRF
- [ ] All scrapers have a timeout
- [ ] Cache works
- [ ] Source data is normalized
- [ ] Input is validated
- [ ] Internal errors are not leaked to the client
- [ ] Rate limiting is active
- [ ] Retry is bounded
- [ ] Concurrency is controlled
- [ ] Unit tests exist
- [ ] Integration tests exist
- [ ] No sensitive secrets in the repository
- [ ] CI runs the tests

## 18. Final Recommendation
Do not do a full rewrite. Keep the application, frontend, and controllers;
upgrade the scraper core; adopt the prototype's security, timeout, cache,
normalization, pagination, and testing patterns; harden the image proxy;
add rate limiting and concurrency control.

The newest prototype should serve as the basis for the next-generation
scraping engine — but its concepts and implementation should be adapted
into the existing app's interfaces and architecture, not copy-pasted
wholesale. The priority isn't just a faster scraper — it's reliability,
security, performance, maintainability, and compatibility, in that order
of non-negotiability.

## 19. Practical Implementation Order
1. Create branch `upgrade-scraper`.
2. Commit/backup the current stable state.
3. Copy the prototype in as a **reference**, not a replacement.
4. Build `http.js` with timeout.
5. Build `cache.js`.
6. Build `normalize.js`.
7. Merge in `security.js`.
8. Separate out `decrypt.js`.
9. Migrate the Doujin scraper.
10. Migrate the Neko scraper.
11. Build the compatibility mapping layer.
12. Connect the existing controllers to the new scraper service.
13. Harden the image proxy.
14. Add rate limiting.
15. Add concurrency limiting.
16. Add tests.
17. Run integration tests.
18. Only then remove unused old scraper code.

## 20. Note on Volatility
This document is a blueprint. Final implementation must be adapted to the
actual state of the source websites, their current response structures,
the Node.js version in use, and deployment requirements. Endpoint names,
API fields, secrets, HTML selectors, and source URLs should never be
assumed permanent — the scraper should be built to be easy to repair when
the source changes.
