# Security Policy

## 1. Why This Exists
The image proxy endpoint (`GET /api/image-proxy?url=...`) fetches a
URL supplied in the request. Treated naively, this is a textbook
**Server-Side Request Forgery (SSRF)** vector:

```
attacker → image-proxy → your server → localhost / private network /
                                         cloud metadata endpoint
```

Checking `protocol === "http:" || "https:"` alone is **not** sufficient
protection. The rules below are treated as P0 — highest priority, done
before scraper functionality work.

## 2. Required Controls for Any URL-Fetching Endpoint

### A. Domain Allowlist
Only fetch from hosts that are actually required, e.g.:
```
ALLOWED_IMAGE_HOSTS = [
  "domain-source-1",
  "domain-source-2"
]
```

### B. Private-IP Blocking
Reject requests that resolve to:
- `127.0.0.0/8`
- `10.0.0.0/8`
- `172.16.0.0/12`
- `192.168.0.0/16`
- `169.254.0.0/16` (includes cloud metadata endpoints)
- `::1`
- `fc00::/7`
- `fe80::/10`

This includes hostnames that *resolve* to a private address — a public-
looking hostname pointing at a private IP must still be blocked.

### C. Redirect Protection
A redirect from a public domain to a private IP must not be followed
blindly:
```
public-domain → redirect → private IP   # must be blocked
```
Every redirect target must be re-validated against the same rules as the
original URL.

### D. Response Size Limit
The image proxy must not accept an unbounded response. Enforce a hard
cap (baseline: **10MB**).

### E. Content-Type Validation
Only forward expected image types: `image/jpeg`, `image/png`,
`image/webp`, `image/gif`. Never blindly forward whatever content-type
the upstream returns.

### F. Timeout
The image proxy — like every other scraper call — must have a request
timeout.

### G. Rate Limiting
Proxy endpoints are easy to abuse; rate limit them explicitly (in
addition to general API rate limiting). Baseline: 60 req/min on the API,
120 req/min on the image proxy.

> Cache + timeout + rate limit + concurrency control are meant to work
> together — none of them substitutes for another.

## 3. Error Handling
Never return raw internal error messages to the client — `err.message`
can leak internal URLs, server paths, library details, or source-site
implementation details.

```
Bad:   { "message": err.message }
Good:  server logs full detail
       client gets { "success": false, "message": "Failed to fetch data" }
```

## 4. Secrets
- Runtime secrets (`DOUJIN_APP_SECRET`, `DOUJIN_SALT`, etc.) live in
  environment/config only.
- Never commit real credentials to the repository.
- A secret that a source site inherently exposes to its own browser
  clients isn't equivalent to a private credential (like a DB password),
  but it's still kept out of the repo.

## 5. Logging
Do log: request metadata, cache hits/misses, timeouts, parse/decrypt
failures, blocked-proxy events, rate-limit events (see event names in
`06-architecture/scraper-migration-plan.md` §10).

Do **not** log: credentials, sensitive cookies, tokens, or real secret
values.

## 6. Input Validation
| Param | Rule |
|---|---|
| `page` | integer, min 1 |
| `limit` | integer, min 1, capped (e.g. 50/100) |
| `search` | max length enforced |
| `slug` | restricted allowed format |
| `url` | dedicated validation + domain allowlist |

## 7. Retry & Concurrency (security-relevant)
- Retries limited to 1–2 attempts, only for timeout/502/503/504 — never
  for 4xx or parse/decrypt errors (retrying those just amplifies load for
  no benefit).
- Concurrency bounded (3–5 parallel requests) to avoid hammering upstream
  sources or exhausting local resources.

## 8. Current Status
Baseline P0 controls (allowlist, private-IP block, redirect protection,
size limit, content-type validation, rate limiting, timeout, generic
error responses, `.env`-based secrets) are already implemented per
`04-progress-log/changelog.md`. The migration in
`06-architecture/scraper-migration-plan.md` re-applies and hardens these
same controls as the scraper core is rebuilt — they must not regress
during that migration.

## 9. Checklist for Any New URL-Fetching Feature
- [ ] Domain allowlist enforced
- [ ] Private-IP / metadata-endpoint block enforced
- [ ] Redirects re-validated
- [ ] Response size capped
- [ ] Content-type validated
- [ ] Timeout set
- [ ] Rate limited
- [ ] Errors sanitized before reaching the client
- [ ] No secrets logged or committed

## 10. Cloudflare Tunnel & Access (self-host dari komputer pribadi)

Server ini di-expose ke internet lewat `cloudflared` tunnel, bukan cloud
server. Kontrol di bawah ini melengkapi hardening aplikasi (bagian 1–9)
pada lapisan edge.

### A. Cloudflare Access — gerbang autentikasi (WAJIB)
Semua endpoint API tidak punya sistem akun; Access menggantikan fungsi itu
di level edge, gratis untuk personal use:

1. Dashboard Cloudflare → **Zero Trust** → **Access** → **Applications** →
   **Add an application** → *Self-hosted*.
2. Application domain: subdomain tunnel kamu (mis. `lib.example.com`).
   Scope: seluruh domain (`lib.example.com/*`) sehingga semua path
   (termasuk `/api/vpn-status`, `/api/progress`) terlindungi sekaligus.
3. Add a policy: Action **Allow**, Include **Emails** → email pribadi kamu.
4. Login method: **One-time PIN** (email OTP) — tanpa perlu akun apapun.
5. Test: buka subdomain dari browser/incognito → harus muncul halaman OTP
   Cloudflare sebelum app.

Efek di kode: request yang lolos Access membawa header
`Cf-Access-Jwt-Assertion`. Guard `/api/vpn-status`
(`controllers/vpnController.js`) menerima loopback atau header ini.
> Catatan: guard saat ini hanya mengecek *keberadaan* header, belum
> memverifikasi signature JWT-nya. Karena Access menolak request tanpa
> auth di edge, ini cukup untuk personal use; verifikasi penuh (fetch
> team cert + `crypto.verify`) adalah peningkatan opsional.

### B. Rate limit per pengunjung nyata
`server.js` memakai `app.set('trust proxy', 1)` dan rate limiter
ber-key `CF-Connecting-IP` (`middleware/rateLimit.js`). Tanpa ini, semua
pengunjung internet berbagi satu bucket karena cloudflared terhubung via
loopback.

⚠️ Konsekuensi keamanan: dengan `trust proxy` aktif, klien yang bisa
menghubungi port Express **langsung** (tanpa lewat tunnel) dapat memalsukan
`X-Forwarded-For`. Mitigasi:
- Pastikan port 4000 **tidak diteruskan** ke internet (router NAT tertutup,
  Windows Firewall block inbound pada port itu), dan/atau
- Bind Express ke loopback saja: `app.listen(PORT, '127.0.0.1')`.

### C. cloudflared sebagai Windows service
Proses manual mati saat restart/relog dan website down tanpa notifikasi:

```powershell
cloudflared service install   # butuh admin; config di %TUNNEL_TOKEN% atau config.yml
Get-Service cloudflared       # verifikasi status Running
```

### D. Ingress hygiene
Config tunnel hanya boleh mengarah ke satu service:

```yaml
ingress:
  - hostname: lib.example.com
    service: http://localhost:4000
  - service: http_status:404   # fallback tegas, jangan wildcard ke service lain
```

## 11. Endpoint Sensitif
| Endpoint | Risiko | Kontrol |
|---|---|---|
| `GET /api/vpn-status` | bocor nama provider VPN, health, history error internal | Loopback/JWT-only guard + Access |
| `GET /api/progress` | riwayat baca per device bisa dibaca/ditulis siapa pun yang tahu deviceId | deviceId = UUID entropi penuh; cap 100 baris/device; idealnya terlindungi Access |
| `GET /pf/:host/*` | relay publik ke host player | allowlist host + timeout 15s + cap respons 2MB |
