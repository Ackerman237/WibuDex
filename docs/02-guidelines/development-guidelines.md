# Development Guidelines

These are the working rules for this project. They exist to keep the
codebase maintainable as it grows and as source websites change underneath
it.

## 1. Workflow Rules
- **One feature, one commit.** Finish a feature → commit → then move to the
  next item. Don't batch unrelated changes into one commit.
- Standard commit flow:
  ```
  git status
  git add <changed files>
  git status          # confirm staged files before committing
  git commit -m "<clear, imperative message>"
  git push origin main
  ```
- Update `04-progress-log/changelog.md` and, if applicable,
  `05-roadmap/backlog.md` whenever a feature moves from "planned" to "done."

## 2. Architectural Rules
- **Controllers do not contain scraping logic.** They call a scraper
  service and shape the response.
- **Scraper services do not know about the frontend.** They return
  normalized data, not view-specific formatting.
- **Security logic is never mixed into HTML-parsing logic.** URL
  sanitization, SSRF checks, and content-type validation live in
  `security.js` / dedicated middleware — not inline inside a scraper.
- **HTTP request handling is separate from data parsing.** A shared
  `http.js` handles timeout/retry; parsing and normalization are separate
  modules.
- **Decryption logic is isolated** in its own module (`decrypt.js`), never
  inlined into the main scraper.

## 3. Data Handling Rules
- All data returned by an upstream source is **untrusted** until it has
  been normalized:
  - Correct data types enforced.
  - Strings trimmed and length-capped (e.g. title ≤ 500 chars, slug ≤ 200,
    type/status ≤ 50).
  - Arrays length-capped.
  - URLs validated before being passed downstream.
  - No unexpected/foreign fields passed through to the client.
- Pagination always uses `offset = (page - 1) * limit`, and responses should
  preserve pagination metadata already relied on by the frontend:
  `totalCount`, `totalPages`, `currentPage`, `hasPrevious`, `hasNext`.

## 4. Security Rules (non-negotiable, see `07-security/`)
- Never trust `protocol === "http:" || "https:"` alone as SSRF protection —
  it must be combined with a domain allowlist, private-IP blocking, and
  redirect validation.
- Never leak internal error details to the client. Log the full error
  server-side; return a generic message (e.g. `"Gagal mengambil data"` /
  "Failed to fetch data") to the client.
- Never commit real secrets/credentials to the repository. Runtime
  secrets (e.g. `DOUJIN_APP_SECRET`, `DOUJIN_SALT`) live in environment
  configuration only.
- Never log credentials, sensitive cookies, tokens, or real secrets —
  even in structured logs.

## 5. Resilience Rules
- Every outbound scraper request must have a timeout (AbortController).
- Retries are limited (max 1–2) and only for transient errors (timeout,
  502/503/504) — never for 4xx, invalid URLs, or parse/decrypt errors.
  Use backoff between attempts.
- Concurrency is bounded (recommended 3–5 parallel requests) — never fetch
  an unbounded batch (e.g. 100 chapter images) all at once.
- Cache reads with a sensible TTL per data type (see
  `06-architecture/scraper-migration-plan.md` §Cache Policy) — in-memory
  cache is not a permanent store; consider Redis for multi-instance
  deployments.

## 6. Migration / Refactor Rules
When upgrading a subsystem (e.g. the scraper core):
- **Don't do a full rewrite.** Build the new implementation alongside the
  old one, behind a compatible interface.
- **Don't copy a prototype wholesale.** Take the concepts and hardened
  implementation patterns; adapt them to this app's existing interfaces.
- **Don't remove old features immediately.** Old code is removed only after
  the replacement is verified end-to-end (see Definition of Done in
  `06-architecture/scraper-migration-plan.md`).
- Frontend contracts are preserved — if a new module returns different
  field names, map them in a normalizer, not by changing the frontend.

## 7. Language & Documentation
- Working conversation language: Bahasa Indonesia.
- Project documentation (this folder): English, to keep it portable and
  professional for any future collaborator or reviewer.
- Code comments and identifiers: English.
