import {
  scrapeNekoList,
  scrapeNekoCategory,
  scrapeNekoSearch,
  scrapeNekoDetail,
  scrapeNekoCategories,
  scrapeNekoSchedule,
  scrapeNekoSeriesList,
  scrapeNekoRandom,
} from '../lib/scraper/nekoScraper.js';
import { validatePage, validateCategory, validateQuery, validateSlug, validateUrl, validateEnum } from '../lib/validator.js';
import logger from '../lib/logger.js';
import { respondUpstreamError } from '../middleware/upstreamResponse.js';
import { fetchProviderEmbed, buildPlayerFrameHtml, isAllowedPlayerUrl } from '../lib/scraper/playerFrame.js';
import { extractDirectStream, probeStream } from '../lib/scraper/streamExtract.js';
import { PLAYER_HOSTS } from '../lib/config/playerHosts.js';
import { USER_AGENT } from '../lib/constants.js';
import { CacheManager } from '../lib/scraper/cache.js';

const NEKO_SERIES_TYPES = new Set(['hentai', 'jav']);

// ============================================================
// Player-frame (mode "bersih"): HTML embed penyedia disaring di server
// (script iklan/popunder dibuang) lalu disajikan dari origin kita dengan
// CSP sandbox opaque-origin — top-navigation & popup diblokir browser,
// akses ke cookie/localStorage situs ini nihil.
// Rollback: set PLAYER_FRAME_MODE=direct di .env → frontend kembali
// embed langsung ke penyedia.
// ============================================================
const PLAYER_FRAME_MODE = process.env.PLAYER_FRAME_MODE === 'direct' ? 'direct' : 'filtered';
const playerFrameCache = new CacheManager({ maxSize: 20, defaultTTL: 5 * 60_000 });

export const getPlayerMode = (_req, res) => {
  res.json({ success: true, data: { mode: PLAYER_FRAME_MODE } });
};

export const getPlayerFrame = async (req, res) => {
  try {
    if (PLAYER_FRAME_MODE !== 'filtered') {
      return res.status(404).json({ success: false, message: 'Player-frame dinonaktifkan (mode direct)' });
    }

    const url = validateUrl(req.query.url);
    if (!url) return res.status(400).json({ success: false, message: 'Parameter url tidak valid' });

    const safeUrl = isAllowedPlayerUrl(url);
    if (!safeUrl) return res.status(400).json({ success: false, message: 'URL player tidak diizinkan' });

    // Slug hanya boleh berisi karakter slug — dipakai untuk spoof Referer
    const slug = String(req.query.slug || '').replace(/[^a-z0-9-]/gi, '');
    const providerHost = new URL(safeUrl).hostname;
    const cacheKey = `${safeUrl}|${slug}`;

    let html = playerFrameCache.get(cacheKey);
    if (!html) {
      const raw = await fetchProviderEmbed(safeUrl, { slug });
      html = buildPlayerFrameHtml({ html: raw, providerHost, slug, xhrBase: '/api/pf' });
      playerFrameCache.set(cacheKey, html);
    }

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    // Sandbox flags default: TANPA allow-top-navigation, TANPA allow-popups.
    // allow-same-origin sengaja tidak ada → origin opaque (tidak bisa sentuh
    // cookie/localStorage/API kita). XHR internal penyedia tetap jalan lewat
    // /pf/:host/* yang mengirim header CORS.
    res.setHeader('Content-Security-Policy', 'sandbox allow-scripts allow-forms allow-presentation');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'no-store');
    return res.send(html);
  } catch (err) {
    logger.error({ err }, 'getPlayerFrame error');
    if (err?.name === 'AbortError' || err?.message?.includes('Timeout')) {
      return res.status(504).json({ success: false, message: 'Timeout menunggu player' });
    }
    return res.status(502).json({ success: false, message: 'Gagal memuat player' });
  }
};

// Stream langsung (Fase C): URL MP4 dari CDN diekstrak server-side →
// frontend memutar dengan <video> milik sendiri, nol JS penyedia.
// Return 404 dengan fallback:true bila pola tidak dikenali → frontend jatuh
// ke player-frame terfilter.
export const getStream = async (req, res) => {
  try {
    const url = validateUrl(req.query.url);
    if (!url) return res.status(400).json({ success: false, message: 'Parameter url tidak valid' });

    const safeUrl = isAllowedPlayerUrl(url);
    if (!safeUrl) return res.status(400).json({ success: false, message: 'URL player tidak diizinkan' });

    const slug = String(req.query.slug || '').replace(/[^a-z0-9-]/gi, '');
    const extracted = await extractDirectStream(safeUrl, { slug });
    if (!extracted) {
      // Bukan error — penyedia ini tidak didukung ekstraksi; fallback ke filtered
      return res.status(404).json({ success: false, fallback: true, message: 'Ekstraksi stream tidak tersedia untuk penyedia ini' });
    }

    const host = new URL(safeUrl).hostname;
    const playable = await probeStream(extracted.url, host);
    if (!playable) {
      return res.status(404).json({ success: false, fallback: true, message: 'Stream tidak dapat diverifikasi' });
    }

    return res.json({ success: true, data: { url: extracted.url, type: extracted.type } });
  } catch (err) {
    logger.error({ err }, 'getStream error');
    if (err?.name === 'AbortError' || err?.message?.includes('Timeout')) {
      return res.status(504).json({ success: false, fallback: true, message: 'Timeout mengekstrak stream' });
    }
    return res.status(502).json({ success: false, fallback: true, message: 'Gagal mengekstrak stream' });
  }
};

// Passthrough XHR internal penyedia (mis. $.get('/pass_md5/...')) dari dokumen
// sandboxed (origin null) → butuh header CORS terbuka, dengan host allowlist.
export const passthroughProviderXhr = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const host = String(req.params.host || '').toLowerCase();
  if (!PLAYER_HOSTS.some((h) => host === h || host.endsWith(`.${h}`))) {
    return res.status(400).json({ success: false, message: 'Host tidak diizinkan' });
  }
  const rest = req.params[0] || '';
  const query = req.url.includes('?') ? `?${req.url.split('?').slice(1).join('?')}` : '';
  const target = `https://${host}/${rest}${query}`;
  try {
    const upstream = await fetch(target, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: '*/*',
        Referer: `https://${host}/`,
      },
    });
    res.status(upstream.status);
    const contentType = upstream.headers.get('content-type');
    if (contentType) res.type(contentType);
    const text = await upstream.text();
    return res.send(text);
  } catch (err) {
    logger.warn({ err, target }, 'passthroughProviderXhr gagal');
    return res.status(502).json({ success: false, message: 'Passthrough gagal' });
  }
};

export const getNekoList = async (req, res) => {
  try {
    const page = validatePage(req.query.page);
    const data = await scrapeNekoList(page);
    return res.json({ success: true, data });
  } catch (err) {
    return respondUpstreamError(res, err, { logLabel: 'getNekoList', notFoundMessage: 'Video tidak ditemukan' });
  }
};

export const getNekoCategory = async (req, res) => {
  try {
    const page = validatePage(req.query.page);
    const category = validateCategory(req.query.category);
    if (!category) {
      return res.status(400).json({ success: false, message: 'Parameter category tidak valid' });
    }
    const data = await scrapeNekoCategory(category, page);
    return res.json({ success: true, data });
  } catch (err) {
    return respondUpstreamError(res, err, { logLabel: 'getNekoCategory', notFoundMessage: 'Category tidak ditemukan' });
  }
};

export const getNekoSearch = async (req, res) => {
  try {
    const page = validatePage(req.query.page);
    const query = validateQuery(req.query.query);
    if (!query) {
      return res.status(400).json({ success: false, message: 'Parameter query tidak valid' });
    }
    const data = await scrapeNekoSearch(query, page);
    return res.json({ success: true, data });
  } catch (err) {
    return respondUpstreamError(res, err, { logLabel: 'getNekoSearch', notFoundMessage: 'Hasil pencarian tidak ditemukan' });
  }
};

export const getNekoDetail = async (req, res) => {
  try {
    const slug = validateSlug(req.query.slug);
    if (!slug) {
      return res.status(400).json({ success: false, message: 'Parameter slug tidak valid' });
    }
    const data = await scrapeNekoDetail(slug);
    return res.json({ success: true, data });
  } catch (err) {
    return respondUpstreamError(res, err, { logLabel: 'getNekoDetail', notFoundMessage: 'Video tidak ditemukan' });
  }
};

export const getNekoCategories = async (_req, res) => {
  try {
    const data = await scrapeNekoCategories();
    return res.json({ success: true, data });
  } catch (err) {
    return respondUpstreamError(res, err, { logLabel: 'getNekoCategories', notFoundMessage: 'Kategori tidak ditemukan' });
  }
};

export const getNekoSchedule = async (_req, res) => {
  try {
    const data = await scrapeNekoSchedule();
    return res.json({ success: true, data });
  } catch (err) {
    logger.error({ err }, 'getNekoSchedule error');
    return res.status(503).json({ success: false, message: 'Jadwal sementara tidak tersedia' });
  }
};

export const getNekoSeriesList = async (req, res) => {
  try {
    const page = validatePage(req.query.page);
    const type = validateEnum(req.query.type, NEKO_SERIES_TYPES, 'hentai');
    const data = await scrapeNekoSeriesList(type, page);
    return res.json({ success: true, data });
  } catch (err) {
    return respondUpstreamError(res, err, { logLabel: 'getNekoSeriesList', notFoundMessage: 'Daftar seri tidak ditemukan' });
  }
};

export const getNekoRandom = async (_req, res) => {
  try {
    const data = await scrapeNekoRandom();
    return res.json({ success: true, data });
  } catch (err) {
    logger.error({ err }, 'getNekoRandom error');
    if (err?.name === 'AbortError' || err?.message?.includes('Timeout')) {
      return res.status(504).json({ success: false, message: 'Timeout mencari video acak' });
    }
    return res.status(502).json({ success: false, message: 'Gagal mengambil video acak' });
  }
};
