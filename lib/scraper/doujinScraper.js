import { safeImageUrl } from '../security.js';
import { fetchJSON } from './fetcher.js';
import { decryptResponse } from './decryptor.js';
import { CacheManager } from './cache.js';
import { mapListItem, mapDetail } from './normalizer.js';
import { ensureVpn, reportFailure, reportSuccess } from '../vpn/vpnManager.js';

const API_BASE = 'https://doujin.desu.xxx';
const APP_SECRET = process.env.DOUJIN_APP_SECRET || '';

const VPN_SETTLE_DELAY_MS = 1500;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const cache = new CacheManager({ defaultTTL: 60_000 });

function deviceId() {
  return 'dev_' + Math.random().toString(36).substring(2, 15) + '_' + Date.now().toString(36);
}

async function fetchUpstreamJson(path, route) {
  let response;
  try {
    response = await fetchJSON(`${API_BASE}/api${path}`, {
      headers: {
        'X-App-Secret': APP_SECRET,
        'x-app-secret': APP_SECRET,
        'x-device-id': deviceId(),
        'x-device-name': 'Desktop',
      },
      dispatcher: route.dispatcher,
    });
  } catch (err) {
    // 404 bersifat deterministik (resource tidak ada) — jangan retry, jangan dianggap diblokir
    if (err?.message === 'HTTP 404') throw err;
    await reportFailure('doujin', err);
    const newRoute = await ensureVpn('doujin');
    if (!route.provider && newRoute.provider) {
      await delay(VPN_SETTLE_DELAY_MS);
    }
    response = await fetchJSON(`${API_BASE}/api${path}`, {
      headers: {
        'X-App-Secret': APP_SECRET,
        'x-app-secret': APP_SECRET,
        'x-device-id': deviceId(),
        'x-device-name': 'Desktop',
      },
      dispatcher: newRoute.dispatcher,
    });
  }

  const text = await response.text();
  const data = text.includes('_enc_resp_')
    ? decryptResponse(JSON.parse(text)._enc_resp_)
    : JSON.parse(text);

  const totalHeader = response.headers.get('x-total-count');
  const parsedTotal = totalHeader !== null ? Number(totalHeader) : null;
  const totalCount = Number.isFinite(parsedTotal) ? parsedTotal : null;

  reportSuccess('doujin');
  return { data, totalCount };
}

async function requestUpstream(path) {
  const route = await ensureVpn('doujin');
  return fetchUpstreamJson(path, route);
}

async function apiGet(path, { includeMeta = false } = {}) {
  const cacheKey = path;
  const cached = cache.get(cacheKey);

  if (cached) {
    return includeMeta ? cached : cached.data;
  }

  try {
    const { data, totalCount } = await requestUpstream(path);

    const result = { data, totalCount };
    cache.set(cacheKey, result);

    return includeMeta ? result : result.data;
  } catch (err) {
    // 404 = resource memang tidak ada, teruskan agar controller balas HTTP 404
    if (err?.message === 'HTTP 404') throw err;
    // Jika ada cache lama meskipun sudah expired, gunakan sebagai fallback agar tidak error total
    if (cache.has(cacheKey)) {
      const stale = cache.get(cacheKey);
      return includeMeta ? stale : stale.data;
    }

    // P3 (fix): fallback data palsu ("Manga (Offline / Timeout)" + cover placeholder)
    // dihapus — client tidak bisa membedakan data asli vs sintetis, dan data palsu
    // berisiko ter-cache. Semua kegagalan upstream dilempar sebagai
    // UPSTREAM_UNAVAILABLE (controller membalas HTTP 503), dengan error asli di `cause`.
    throw new Error('UPSTREAM_UNAVAILABLE', { cause: err });
  }
}

export async function scrapeMangaList({
  page = 1,
  query = '',
  limit = 24,
  genre = '',
  status = '',
  type = '',
  sort = 'newest',
  withMeta = false,
} = {}) {
  const params = new URLSearchParams();
  params.set('search', query);
  params.set('genre', genre);
  params.set('status', status);
  params.set('type', type);
  params.set('sort', sort);
  params.set('limit', String(limit));
  params.set('offset', String((page - 1) * limit));

  const response = await apiGet(`/manga?${params.toString()}`, { includeMeta: withMeta });

  if (withMeta) {
    const rawData = response.data;
    const list = Array.isArray(rawData) ? rawData : rawData?.data || rawData?.results || [];
    return {
      data: list.map(mapListItem).filter(Boolean),
      total: response.totalCount,
    };
  }

  const list = Array.isArray(response) ? response : response?.data || response?.results || [];
  return list.map(mapListItem).filter(Boolean);
}

export async function scrapeMangaDetail(slug) {
  // encode: slug lolos validasi charset longgar (% ~ spasi) — jangan biarkan
  // karakter itu mengubah struktur path upstream.
  return mapDetail(await apiGet(`/manga/${encodeURIComponent(slug)}`));
}

export async function scrapeGenres() {
  const response = await apiGet('/genres', { includeMeta: false });
  const list = Array.isArray(response) ? response : response?.data || [];
  return list
    .map((g) => ({
      id: typeof g?.id !== 'undefined' ? g.id : null,
      name: typeof g?.name === 'string' ? g.name.trim() : '',
      slug: typeof g?.slug === 'string' ? g.slug.trim() : typeof g?.name === 'string' ? g.name.toLowerCase().replace(/\s+/g, '-') : '',
    }))
    .filter((g) => g.name);
}

export async function scrapeChapterImages(id) {
  // encode: validateId menerima karakter apa pun (maks 100 char) — tanpa
  // encode, nilai seperti `../../other` atau `x?y=z` bisa memanipulasi path.
  const chapter = await apiGet(`/chapters/${encodeURIComponent(id)}`);
  const rawUrls = chapter?.content_urls || chapter?.images || chapter?.pages || chapter?.content || [];
  const images = Array.isArray(rawUrls) ? rawUrls.map(safeImageUrl).filter(Boolean) : [];
  if (!images.length) throw new Error('Chapter ini belum punya gambar');
  return {
    images,
    mangaSlug: chapter?.manga_slug || chapter?.mangaSlug || '',
    mangaTitle: chapter?.manga_title || chapter?.mangaTitle || '',
    title: chapter?.title || `Chapter ${chapter?.chapter_number || chapter?.chapter || ''}`.trim(),
    number: chapter?.chapter_number || chapter?.chapter || null,
  };
}
