// neko/index.js — Orkestrasi fungsi publik scraper nekopoi + cache.
import { CacheManager } from '../cache.js';
import { getHtml, getRandomWithRetry } from './http.js';
import { decodeEntities, cleanText, safeUrl } from './text.js';
import { parseCards, parseSearchItems, parseHasNext } from './parsers/cards.js';
import { parsePlayers, parseEpisodes, parseRelated } from './parsers/detail.js';
import { parseSchedule } from './parsers/schedule.js';

// Cache bersama untuk endpoint yang mahal (detail, kategori, jadwal).
const cache = new CacheManager({ maxSize: 30, defaultTTL: 10 * 60 * 1000 });

function getCache(key) {
  return cache.get(key);
}

function setCache(key, value, ttlMs) {
  cache.set(key, value, ttlMs);
}

// Internal: hapus semua entry cache (dipakai unit test untuk isolasi antar test)
export function _clearNekoCacheForTests() {
  cache.clear();
}

// Re-export agar konsumen lama (tests) tetap bisa mengimpor dari satu tempat.
export { decodeEntities };

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

// ===== Acak =====
export async function scrapeNekoRandom() {
  return getRandomWithRetry();
}
