import logger from '../logger.js';
import { ensureVpn, reportFailure, reportSuccess } from '../vpn/vpnManager.js';

const VPN_SETTLE_DELAY_MS = 1500;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const BASE = 'https://nekopoi.care';
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const NEKO_PLAYER_HOSTS_ENV = process.env.NEKO_PLAYER_HOSTS || '';
// Jika env kosong, gunakan default hosts + streampoi.com; jika ada, gunakan hosts tersebut (dipisah koma)
const NEKO_PLAYER_HOSTS = NEKO_PLAYER_HOSTS_ENV.length > 0
  ? NEKO_PLAYER_HOSTS_ENV.split(',').map((h) => h.trim()).filter((h) => h.length > 0)
  : ['playmogo.com', 'yandex.ru', 'streampoi.com'];

const MAX_CACHE_SIZE = 30;
const cache = new Map();

function getCache(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    cache.delete(key);
    return null;
  }
  return entry.value;
}

function setCache(key, value, ttlMs) {
  if (cache.size >= MAX_CACHE_SIZE) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey) cache.delete(oldestKey);
  }
  cache.set(key, { value, expiresAt: Date.now() + ttlMs });
}

// Internal: hapus semua entry cache (dipakai unit test untuk isolasi antar test)
export function _clearNekoCacheForTests() {
  cache.clear();
}

// Diekspor untuk unit test regresi (pernah korup: entity &amp;/&quot; menjadi
// no-op replace yang mengganti karakter dengan dirinya sendiri).
export function decodeEntities(s = '') {
  return String(s)
    .replace(/&#8211;/g, '–')
    .replace(/&#8217;/g, '’')
    .replace(/&#8216;/g, '‘')
    .replace(/&#8220;/g, '“')
    .replace(/&#8221;/g, '”')
    .replace(/&#8230;/g, '…')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    // &amp; HARUS paling akhir agar tidak double-decode (mis. "&amp;quot;" → "&quot;" → '"')
    .replace(/&amp;/g, '&')
    .trim();
}

function stripHtml(raw = '') {
  return String(raw)
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanText(raw = '') {
  return decodeEntities(stripHtml(raw));
}

function safeUrl(raw) {
  if (!raw) return '';
  const candidate = String(raw).trim();
  if (/^(javascript|data|vbscript):/i.test(candidate)) return '';
  const normalized = candidate.startsWith('//') ? `https:${candidate}` : candidate;
  try {
    const url = new URL(normalized);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return '';
    return url.href;
  } catch {
    return '';
  }
}

const HTML_TIMEOUT_MS = 15000;

// Regresi BUG-2 lama: retry memakai ulang AbortController yang timernya sudah
// di-clear sehingga retry berjalan TANPA timeout (bisa hang selamanya).
// Kini tiap percobaan fetch membuat controller + timer sendiri.
async function fetchHtmlText(fullUrl, route, path) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), HTML_TIMEOUT_MS);
  try {
    const res = await fetch(fullUrl, { ...buildFetchOptions(route), signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status} untuk ${path}`);
    return await res.text();
  } finally {
    clearTimeout(timeoutId);
  }
}

function buildFetchOptions(route) {
  const options = {
    method: 'GET',
    headers: {
      'User-Agent': USER_AGENT,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
      'Referer': BASE,
    },
  };
  if (route.agent) options.agent = route.agent;
  if (route.dispatcher) options.dispatcher = route.dispatcher;
  return options;
}

function isTransientNetworkError(error) {
  // EACCES/ECONNREFUSED = koneksi telnet sebelum VPN siap; ETIMEDOUT & Cloudflare
  // challenge = transien. Sama seperti pola doujinScraper.js.
  return Boolean(
    error.code === 'EACCES' ||
      error.code === 'ECONNREFUSED' ||
      error.message?.includes('ETIMEDOUT') ||
      error.message?.includes('Performing security verification')
  );
}

function timeoutError(path) {
  return new Error(`Timeout ${HTML_TIMEOUT_MS / 1000} detik saat mengakses ${path}`);
}

async function getHtml(path) {
  const fullUrl = path.startsWith('http') ? path : `${BASE}${path}`;

  // Percobaan 1: route aktif
  const route = await ensureVpn('neko');
  try {
    const text = await fetchHtmlText(fullUrl, route, path);
    reportSuccess('neko');
    return text;
  } catch (error) {
    if (error.name === 'AbortError') throw timeoutError(path);
    if (!isTransientNetworkError(error)) throw error;

    // Percobaan 2: sambungkan VPN baru + settle delay (dengan timeout sendiri)
    reportFailure('neko', error);
    const newRoute = await ensureVpn('neko');
    if (newRoute?.provider) await delay(VPN_SETTLE_DELAY_MS);
    try {
      const text = await fetchHtmlText(fullUrl, newRoute, path);
      reportSuccess('neko');
      return text;
    } catch {
      // Retry gagal — lempar error ASLI agar penyebab pertama tidak tertimpa
      if (error.name === 'AbortError') throw timeoutError(path);
      throw error;
    }
  }
}

function makeCard(url, rawTitle, thumb, desc = '', date = '') {
  const cleanUrl = safeUrl(url);
  if (!cleanUrl || !cleanUrl.startsWith(BASE)) return null;
  const title = typeof rawTitle === 'string' ? cleanText(rawTitle) : '';
  if (!title) return null;
  return {
    title,
    slug: cleanUrl.split('/').filter(Boolean).pop() || '',
    url: cleanUrl,
    thumb: safeUrl(thumb),
    date: typeof date === 'string' ? cleanText(date) : '',
    synopsis: typeof desc === 'string' ? cleanText(desc) : '',
  };
}

// ===== Parser Utama: nk-post-card (untuk homepage) =====
function parseCards(html) {
  const cards = [];
  const seen = new Set();

  const CARD_OPEN = 'class="nk-post-card"';
  let pos = 0;

  while (true) {
    const cardStart = html.indexOf(CARD_OPEN, pos);
    if (cardStart === -1) break;

    const divStart = html.lastIndexOf('<div', cardStart);
    if (divStart === -1) { pos = cardStart + 1; continue; }

    let depth = 0;
    let i = divStart;
    let blockEnd = -1;

    while (i < html.length) {
      if (html.startsWith('<div', i)) {
        depth++;
        i += 4;
      } else if (html.startsWith('</div>', i)) {
        depth--;
        if (depth === 0) { blockEnd = i + 6; break; }
        i += 6;
      } else {
        i++;
      }
    }

    if (blockEnd === -1) { pos = cardStart + 1; continue; }
    const block = html.slice(divStart, blockEnd);
    pos = blockEnd;

    // 1. Thumb — background-image di nk-thumb-crop
    const thumbMatch = block.match(/nk-thumb-crop[^>]*style=["'][^"']*background-image:\s*url\(['"]?([^'")]+)['"]?\)/i);
    const thumb = thumbMatch ? thumbMatch[1].trim() : '';

    // 2. URL + Title — dari <h2><a href="...">TITLE</a></h2>
    const linkMatch = block.match(/<h2[^>]*>\s*<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
    if (!linkMatch) continue;

    const url = linkMatch[1];
    const rawTitle = linkMatch[2];

    // Filter URL navigasi bukan post
    if (
      url.includes('/category/') ||
      url.includes('/page/') ||
      url.includes('/tag/') ||
      url === BASE + '/' ||
      !url.startsWith(BASE)
    ) continue;

    // 3. Date — teks setelah icon dashicons-calendar-alt di dalam span
    const dateMatch = block.match(/dashicons-calendar-alt[^<]*<\/span>([\s\S]*?)<\/span>/i);
    const date = dateMatch ? cleanText(dateMatch[1]) : '';

    const card = makeCard(url, rawTitle, thumb, '', date);
    if (card && !seen.has(card.slug)) {
      seen.add(card.slug);
      cards.push(card);
    }
  }

  // Jika homepage menghasilkan 0 card, coba parser fallback untuk kategori/search
  if (cards.length === 0) {
    cards.push(...parseSearchItems(html));
  }

  return cards;
}

// Fallback parser untuk halaman kategori/search (struktur nk-search-item)
function parseSearchItems(html) {
  const cards = [];
  const seen = new Set();

  // Struktur asli (per 2026-08):
  // <a href="URL" class="nk-search-item">
  //   <div class="nk-search-thumb" style="background-image: url('THUMB')"></div>
  //   <div class="nk-search-info">
  //     <h2>TITLE</h2>
  //     <span class="nk-search-genres"></span>
  //     <p class="nk-search-desc">SINOPSIS</p>
  //   </div>
  // </a>
  const itemRegex = /<a\s+href="([^"]+)"[^>]*class="nk-search-item"[^>]*>[\s\S]*?nk-search-thumb[^>]*style=["'][^"']*background-image:\s*url\(['"]([^'")]+)['"]?\)[\s\S]*?<h2[^>]*>([\s\S]*?)<\/h2>[\s\S]*?(?:<p class="nk-search-desc">([\s\S]*?)<\/p>)?<\/a>/gi;
  let match;
  while ((match = itemRegex.exec(html)) !== null) {
    const url = match[1];
    const thumb = match[2];
    const title = match[3];
    const synopsis = match[4] || '';
    if (!url || !title) continue;
    if (!url.startsWith(BASE)) continue;
    const card = makeCard(url, title, thumb, synopsis, '');
    if (card && !seen.has(card.slug)) {
      seen.add(card.slug);
      cards.push(card);
    }
  }
  return cards;
}

function parseHasNext(html, page) {
  return (
    html.includes(`/page/${page + 1}/`) ||
    /rel=["']next["']/i.test(html) ||
    /class=["'][^"']*next[^"']*["']/i.test(html)
  );
}

function parsePlayers(html) {
  const players = [];
  const iframeRe = /<iframe[^>]+src=["']([^"']+)["'][^>]*>/gi;
  iframeRe.lastIndex = 0;
  let match;
  while ((match = iframeRe.exec(html))) {
    const raw = match[1].startsWith('http') ? match[1] : `https:${match[1]}`;
    const clean = safeUrl(raw);
    if (!clean) continue;
    let host = '';
    try {
      host = new URL(clean).hostname;
    } catch {
      continue;
    }
    if (NEKO_PLAYER_HOSTS.some((allowed) => host === allowed || host.endsWith(`.${allowed}`))) {
      players.push(clean);
    } else {
      // Catat agar update allowlist NEKO_PLAYER_HOSTS bisa berdasar data nyata
      logger.warn({ host, url: clean }, 'Iframe player dilewati: host tidak ada di allowlist');
    }
  }
  return [...new Set(players)];
}

// ===== Parser daftar episode pada halaman seri =====
// Halaman seri (mis. hasil tombol acak yang mendarat di koleksi) tidak memuat
// iframe player, hanya link ke post episode lain. Parser defensif: kumpulkan
// anchor internal dari konten utama, buang nav/kategori/related/slug sendiri.
function parseEpisodes(html, currentSlug) {
  const items = [];
  const seen = new Set();

  // Batasi ke konten utama bila polanya dikenali; kalau tidak, pakai seluruh dokumen
  const contentMatch =
    html.match(/<div[^>]+class=["'][^"']*(?:entry-content|post-content|single-content)[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
  const scope = contentMatch ? contentMatch[1] : html;

  const anchorRe = /<a\s+href="(https?:\/\/nekopoi\.care\/[^"#]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = anchorRe.exec(scope))) {
    const url = match[1];
    const inner = match[2];
    if (/category\/|tag\/|page\/|genre-list|hentai-list|jav-list|jadwal|#|\.(png|jpg|jpeg|gif|css|js)/i.test(url)) continue;

    const slug = url.split('/').filter(Boolean).pop() || '';
    if (!slug || slug === currentSlug || seen.has(slug)) continue;

    const titleMatch =
      inner.match(/<h\d[^>]*>([\s\S]*?)<\/h\d>/i) ||
      inner.match(/alt=["']([^"']+)["']/i) ||
      inner.match(/title=["']([^"']+)["']/i);
    const rawTitle = titleMatch ? titleMatch[1] : '';
    const title = cleanText(rawTitle || stripHtml(inner));
    if (!title || title.length > 200) continue;

    seen.add(slug);
    items.push({ title, slug, url: safeUrl(url) });
    if (items.length >= 50) break;
  }
  return items;
}

export async function scrapeNekoList(page = 1) {
  const path = page <= 1 ? '/' : `/page/${page}/`;
  let html = await getHtml(path);
  const result = { videos: parseCards(html), hasNext: parseHasNext(html, page) };
  html = null;
  return result;
}

export async function scrapeNekoCategory(category, page = 1) {
  if (!category) throw new Error('Parameter category dibutuhkan');
  const path = page <= 1 ? `/category/${category}/` : `/category/${category}/page/${page}/`;
  let html = await getHtml(path);
  const cards = parseCards(html);
  const result = { videos: cards, hasNext: parseHasNext(html, page) };
  html = null;
  return result;
}

export async function scrapeNekoSearch(query, page = 1) {
  if (!query) throw new Error('Parameter query dibutuhkan');
  const path = page <= 1 ? `/search/${encodeURIComponent(query)}/` : `/search/${encodeURIComponent(query)}/page/${page}/`;
  let html = await getHtml(path);
  const result = { videos: parseCards(html), hasNext: parseHasNext(html, page) };
  html = null;
  return result;
}

export async function scrapeNekoCategories() {
  const cacheKey = 'neko-categories';
  const cached = getCache(cacheKey);
  if (cached) return cached;

  try {
    let html = await getHtml('/hentai-list/');
    const cats = [];
    const seen = new Set();
    const re = /href=["']https?:\/\/nekopoi\.care\/category\/([^"'/?#]+)\/?["']/gi;
    re.lastIndex = 0;
    let match;
    while ((match = re.exec(html))) {
      const slug = decodeEntities(match[1]).trim();
      if (!slug || seen.has(slug)) continue;
      seen.add(slug);
      cats.push({ slug, name: slug.replace(/-/g, ' ') });
    }
    html = null;
    setCache(cacheKey, cats, 10 * 60 * 1000);
    return cats;
  } catch {
    return [];
  }
}

export async function scrapeNekoDetail(slug) {
  if (!slug) throw new Error('Parameter slug dibutuhkan');

  const cacheKey = `neko-detail-${slug}`;
  const cached = getCache(cacheKey);
  if (cached) return cached;

  const cleanSlug = String(slug).replace(/^https?:\/\/nekopoi\.care\//).replace(/^\/+|\/+$/g, '');
  let html = await getHtml(`/${cleanSlug}/`);

  const titleMatch = html.match(/<title>([^<]*)<\/title>/i);
  const title = titleMatch ? cleanText(titleMatch[1].replace(/&#8211;.*$/, '')) : cleanSlug;

  const ogMatch = html.match(/property=["']og:image["'][^>]+content=["']([^"']+)["']/i);
  const thumb = safeUrl(ogMatch?.[1] || '');

  const synopsisMatch =
    html.match(/<div[^>]+class=["'][^"']*(?:entry-content|post-content|content)[^"']*["'][^>]*>([\s\S]*?)<\/div>/i) ||
    html.match(/<p>([\s\S]{40,600}?)<\/p>/i);
  const synopsis = synopsisMatch ? cleanText(synopsisMatch[1]) : '';

  const detail = {
    title,
    slug: cleanSlug,
    thumb,
    players: parsePlayers(html),
    synopsis,
    related: parseRelated(html),
    episodes: parseEpisodes(html, cleanSlug),
  };

  html = null;
  setCache(cacheKey, detail, 10 * 60 * 1000);
  return detail;
}

// ===== Parser blok rekomendasi/related di halaman detail =====
// Struktur bervariasi antar post — parser defensif: cari heading yang mengandung
// kata kunci, lalu kumpulkan anchor internal sampai heading berikutnya.
function parseRelated(html) {
  const sectionMatch = html.match(
    /<h[23][^>]*>[^<]*(?:rekomendasi|related|recommend|serupa)[^<]*<\/h[23]>([\s\S]*?)(?=<h[12][^>]*|<footer|$)/i
  );
  if (!sectionMatch) return [];

  const block = sectionMatch[1];
  const items = [];
  const seen = new Set();
  const anchorRe = /<a\s+href="(https?:\/\/nekopoi\.care\/[^"#]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = anchorRe.exec(block))) {
    const url = match[1];
    const inner = match[2];
    if (/category\/|tag\/|page\/|genre-list|#/.test(url)) continue;

    // Judul: prioritas <h2/h3>, lalu alt attribute img, terakhir teks anchor
    const titleMatch =
      inner.match(/<h\d[^>]*>([\s\S]*?)<\/h\d>/i) ||
      inner.match(/alt=["']([^"']+)["']/i) ||
      inner.match(/title=["']([^"']+)["']/i);
    const rawTitle = titleMatch ? titleMatch[1] : '';
    const title = cleanText(rawTitle || stripHtml(inner));
    if (!title) continue;

    const imgMatch =
      inner.match(/<img[^>]+src=["']([^"']+)["']/i) ||
      inner.match(/background-image:\s*url\(['"]?([^'")]+)/i);
    const thumb = imgMatch ? safeUrl(imgMatch[1]) : '';

    const slug = url.split('/').filter(Boolean).pop() || '';
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);

    items.push({ title, slug, url: safeUrl(url), thumb });
    if (items.length >= 8) break;
  }
  return items;
}

// ===== Jadwal New Hentai (/jadwal-new-hentai/) =====
const NEKO_DAY_NAMES = new Set(['senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu', 'minggu']);

// Parser toleran: pindai dokumen berurutan; heading berisi nama hari membuka grup baru,
// anchor internal setelahnya dimasukkan ke grup hari aktif.
function parseSchedule(html) {
  const days = [];
  let current = null;
  const seen = new Set();

  const tokenRe =
    /<h[23][^>]*>([\s\S]*?)<\/h[23]>|<a\s+href="(https?:\/\/nekopoi\.care\/[^"#]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = tokenRe.exec(html))) {
    if (match[1] !== undefined) {
      const label = cleanText(match[1]).toLowerCase();
      if (NEKO_DAY_NAMES.has(label)) {
        current = { day: label.charAt(0).toUpperCase() + label.slice(1), series: [] };
        days.push(current);
      }
      continue;
    }

    if (!current) continue;
    const url = match[2];
    const inner = match[3];
    if (/category\/|tag\/|page\/|genre-list|hentai-list|jav-list|#|\.(png|jpg|css|js)/i.test(url)) continue;

    const titleMatch =
      inner.match(/<h\d[^>]*>([\s\S]*?)<\/h\d>/i) ||
      inner.match(/alt=["']([^"']+)["']/i) ||
      inner.match(/title=["']([^"']+)["']/i);
    const rawTitle = titleMatch ? titleMatch[1] : '';
    const title = cleanText(rawTitle || stripHtml(inner));
    if (!title || title.length > 200) continue;

    const slug = url.split('/').filter(Boolean).pop() || '';
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);

    const imgMatch =
      inner.match(/<img[^>]+src=["']([^"']+)["']/i) ||
      inner.match(/background-image:\s*url\(['"]?([^'")]+)/i);
    const thumb = imgMatch ? safeUrl(imgMatch[1]) : '';

    current.series.push({ title, slug, url: safeUrl(url), thumb });
  }

  return days.filter((d) => d.series.length > 0);
}

export async function scrapeNekoSchedule() {
  const cacheKey = 'neko-schedule';
  const cached = getCache(cacheKey);
  if (cached) return cached;

  let html = await getHtml('/jadwal-new-hentai/');
  const days = parseSchedule(html);
  html = null;
  setCache(cacheKey, days, 30 * 60 * 1000);
  return days;
}

// ===== Daftar seri Hentai List / JAV List =====
export async function scrapeNekoSeriesList(type = 'hentai', page = 1) {
  const listPaths = { hentai: '/hentai-list/', jav: '/jav-list/' };
  const basePath = listPaths[type];
  if (!basePath) throw new Error('Parameter type harus hentai atau jav');

  const path = page <= 1 ? basePath : `${basePath.replace(/\/$/, '')}/page/${page}/`;
  let html = await getHtml(path);

  // Halaman list memakai struktur card yang mirip homepage/kategori —
  // gabungkan hasil kedua parser generik dengan deduplikasi.
  const items = [];
  const seen = new Set();
  for (const card of [...parseCards(html), ...parseSearchItems(html)]) {
    if (card && !seen.has(card.slug)) {
      seen.add(card.slug);
      items.push(card);
    }
  }
  const hasNext = parseHasNext(html, page);
  html = null;

  return { type, series: items, hasNext };
}

// ===== Acak (mengikuti redirect /random ke post acak) =====
async function resolveRandomSlug(route) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const fetchOptions = {
      method: 'GET',
      redirect: 'manual',
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,*/*;q=0.8',
        Referer: `${BASE}/`,
      },
      signal: controller.signal,
    };
    if (route.agent) fetchOptions.agent = route.agent;
    if (route.dispatcher) fetchOptions.dispatcher = route.dispatcher;

    const res = await fetch(`${BASE}/random`, fetchOptions);
    clearTimeout(timeoutId);

    const location = res.headers.get('location') || '';
    const finalUrl = safeUrl(location.startsWith('http') ? location : `${BASE}${location}`);
    if (finalUrl && finalUrl !== `${BASE}/`) {
      const slug = finalUrl.split('/').filter(Boolean).pop() || '';
      if (slug) return { slug, url: finalUrl };
    }
    throw new Error('Redirect /random tidak menghasilkan post');
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

export async function scrapeNekoRandom() {
  let route = await ensureVpn('neko');
  try {
    return await resolveRandomSlug(route);
  } catch (err) {
    await reportFailure('neko', err);
    try {
      route = await ensureVpn('neko');
      if (route?.provider) await delay(VPN_SETTLE_DELAY_MS);
      return await resolveRandomSlug(route);
    } catch {
      // Retry gagal — lempar error ASLI agar penyebab pertama tidak tertimpa
      throw err;
    }
  }
}