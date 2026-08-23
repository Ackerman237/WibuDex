import { safeHttpUrl } from '../lib/security.js';
import sharp from 'sharp';
import {
  scrapeMangaList,
  scrapeMangaDetail,
  scrapeChapterImages,
  scrapeGenres,
} from '../lib/scraper/index.js';
import { validatePage, validateLimit, validateQuery, validateSlug, validateId, validateCategory, validateEnum } from '../lib/validator.js';
import logger from '../lib/logger.js';

const VALID_SORTS = new Set(['newest', 'rating', 'title']);
const VALID_STATUSES = new Set(['ongoing', 'completed', 'hiatus']);
const VALID_TYPES = new Set(['manga', 'manhwa', 'manhua']);

export const getMangaList = async (req, res) => {
  try {
    const page = validatePage(req.query.page);
    const limit = validateLimit(req.query.limit);
    const query = validateQuery(req.query.query);
    const genre = validateCategory(req.query.genre) || '';
    const sort = validateEnum(req.query.sort, VALID_SORTS, 'newest');
    const status = validateEnum(req.query.status, VALID_STATUSES, '');
    const type = validateEnum(req.query.type, VALID_TYPES, '');

    const result = await scrapeMangaList({ page, limit, query, genre, status, type, sort, withMeta: true });
    const data = result.data;
    const total = result.total;
    const totalPages = Number.isFinite(total) ? Math.ceil(total / limit) : null;

    return res.json({
      success: true,
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasPrevious: page > 1,
        hasNext: totalPages !== null ? page < totalPages : data.length === limit,
      },
    });
  } catch (err) {
    logger.error({ err }, 'getMangaList error');
    if (err?.message === 'UPSTREAM_UNAVAILABLE') {
      return res.status(503).json({
        success: false,
        message: 'Server sumber sedang tidak dapat dihubungi (VPN/upstream bermasalah). Coba lagi beberapa saat.',
      });
    }
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan pada server' });
  }
};

export const getMangaCategories = async (req, res) => {
  try {
    const data = await scrapeGenres();
    return res.json({ success: true, data });
  } catch (err) {
    logger.error({ err }, 'getMangaCategories error');
    if (err?.message === 'UPSTREAM_UNAVAILABLE') {
      return res.status(503).json({
        success: false,
        message: 'Server sumber sedang tidak dapat dihubungi (VPN/upstream bermasalah). Coba lagi beberapa saat.',
      });
    }
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan pada server' });
  }
};

export const getMangaDetail = async (req, res) => {
  try {
    const slug = validateSlug(req.query.slug);
    if (!slug) {
      return res.status(400).json({ success: false, message: 'Parameter slug tidak valid' });
    }
    const data = await scrapeMangaDetail(slug);
    return res.json({ success: true, data });
  } catch (err) {
    logger.error({ err }, 'getMangaDetail error');
    if (err?.message === 'HTTP 404') {
      return res.status(404).json({ success: false, message: 'Manga tidak ditemukan' });
    }
    if (err?.message === 'UPSTREAM_UNAVAILABLE') {
      return res.status(503).json({
        success: false,
        message: 'Server sumber sedang tidak dapat dihubungi (VPN/upstream bermasalah). Coba lagi beberapa saat.',
      });
    }
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan pada server' });
  }
};

export const getChapterImages = async (req, res) => {
  try {
    const id = validateId(req.query.id);
    if (!id) {
      return res.status(400).json({ success: false, message: 'Parameter ID Chapter tidak valid' });
    }
    const data = await scrapeChapterImages(id);
    return res.json({ success: true, data });
  } catch (err) {
    logger.error({ err }, 'getChapterImages error');
    if (err?.message === 'HTTP 404') {
      return res.status(404).json({ success: false, message: 'Chapter tidak ditemukan' });
    }
    if (err?.message === 'UPSTREAM_UNAVAILABLE') {
      return res.status(503).json({
        success: false,
        message: 'Server sumber sedang tidak dapat dihubungi (VPN/upstream bermasalah). Coba lagi beberapa saat.',
      });
    }
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan pada server' });
  }
};

const IMAGE_PROXY_TIMEOUT_MS = Number(process.env.IMAGE_PROXY_TIMEOUT_MS) || 20_000;
const IMAGE_MAX_SIZE = 10 * 1024 * 1024;
const IMAGE_CACHE_MAX_ENTRIES = 150;
// Header cache: cover URL unik per manga, aman di-cache browser jangka panjang
const IMAGE_CACHE_CONTROL = 'public, max-age=604800';
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const PROXY_IMAGE_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  Referer: 'https://doujin.desu.xxx',
};

const imageCache = new Map();

function imageCacheGet(key) {
  if (!imageCache.has(key)) return null;
  const entry = imageCache.get(key);
  imageCache.delete(key);
  imageCache.set(key, entry);
  return entry;
}

function imageCacheSet(key, entry) {
  if (imageCache.has(key)) imageCache.delete(key);
  imageCache.set(key, entry);
  while (imageCache.size > IMAGE_CACHE_MAX_ENTRIES) {
    const oldestKey = imageCache.keys().next().value;
    if (oldestKey === undefined) break;
    imageCache.delete(oldestKey);
  }
}

/**
 * Validasi parameter thumbnail ?w= (lebar target dalam px).
 * Return null jika tidak valid/tidak diminta → stream gambar asli.
 */
function parseThumbWidth(raw) {
  if (raw === undefined || raw === '') return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 16 || n > 2000) return null;
  return Math.round(n);
}

async function openUpstreamImage(safeUrl) {
  let lastErr;
  for (let attempt = 0; attempt < 2; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), IMAGE_PROXY_TIMEOUT_MS);
    try {
      const response = await fetch(safeUrl, {
        redirect: 'manual',
        signal: controller.signal,
        headers: PROXY_IMAGE_HEADERS,
      });
      return { response, controller, timer };
    } catch (err) {
      clearTimeout(timer);
      lastErr = err;
    }
  }
  throw lastErr;
}

export const proxyImage = async (req, res) => {
  let controller = null;
  let timer = null;
  try {
    const imageUrl = req.query.url;
    if (!imageUrl) {
      return res.status(400).json({ success: false, message: 'URL gambar tidak disertakan' });
    }

    const safeUrl = safeHttpUrl(imageUrl);
    if (!safeUrl) {
      return res.status(400).json({ success: false, message: 'URL gambar tidak valid' });
    }

    const thumbWidth = parseThumbWidth(req.query.w);
    const cacheKey = thumbWidth ? `${safeUrl}|w=${thumbWidth}` : safeUrl;

    const cached = imageCacheGet(cacheKey);
    if (cached) {
      res.setHeader('Content-Type', cached.contentType);
      res.setHeader('Cache-Control', IMAGE_CACHE_CONTROL);
      res.setHeader('X-Cache', 'HIT');
      return res.send(cached.buffer);
    }

    let opened;
    try {
      opened = await openUpstreamImage(safeUrl);
    } catch (err) {
      logger.warn({ err }, 'proxyImage upstream gagal setelah retry');
      if (err?.name === 'AbortError') {
        return res.status(504).json({ success: false, message: 'Server sumber lambat merespons' });
      }
      return res.status(502).json({ success: false, message: 'Gagal mengambil gambar dari sumber' });
    }

    const response = opened.response;
    controller = opened.controller;
    timer = opened.timer;

    if (response.status >= 300 && response.status < 400) {
      return res.status(400).json({ success: false, message: 'Redirect gambar tidak diizinkan' });
    }

    if (!response.ok) {
      return res.status(response.status).json({ success: false, message: 'Gagal mengambil gambar dari sumber' });
    }

    const contentType = response.headers.get('content-type') || '';
    if (!ALLOWED_IMAGE_TYPES.some((type) => contentType.includes(type))) {
      return res.status(400).json({ success: false, message: 'Response bukan file gambar' });
    }

    // ---- Thumbnail (?w=): buffer lalu optimasi via sharp (gif dilewati) ----
    if (thumbWidth && !contentType.includes('image/gif')) {
      let input = null;
      try {
        let total = 0;
        const chunks = [];
        const reader = response.body.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          total += value.byteLength;
          if (total > IMAGE_MAX_SIZE) {
            controller.abort();
            return res.status(413).json({ success: false, message: 'Gambar terlalu besar' });
          }
          chunks.push(Buffer.from(value));
        }
        input = Buffer.concat(chunks);
      } catch (err) {
        clearTimeout(timer);
        logger.warn({ err }, 'proxyImage gagal membaca upstream untuk thumbnail');
        return res.status(502).json({ success: false, message: 'Gagal mengambil gambar dari sumber' });
      }

      let optimized = null;
      try {
        optimized = await sharp(input)
          .rotate() // hormati orientasi EXIF
          .resize({ width: thumbWidth, withoutEnlargement: true })
          .webp({ quality: 70 })
          .toBuffer();
      } catch (err) {
        logger.warn({ err }, 'proxyImage sharp gagal — fallback kirim file asli');
      }

      if (optimized) {
        res.setHeader('Content-Type', 'image/webp');
        res.setHeader('Cache-Control', IMAGE_CACHE_CONTROL);
        res.setHeader('X-Cache', 'MISS');
        res.send(optimized);
        imageCacheSet(cacheKey, { contentType: 'image/webp', buffer: optimized });
        return;
      }
      // sharp gagal → jatuh ke path streaming di bawah dengan data yang sudah dibaca
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', IMAGE_CACHE_CONTROL);
      res.setHeader('X-Cache', 'MISS');
      if (input && input.length > 0) {
        imageCacheSet(cacheKey, { contentType, buffer: input });
        res.setHeader('Content-Length', String(input.byteLength));
        return res.send(input);
      }
      return res.status(502).json({ success: false, message: 'Gagal memproses gambar' });
    }
    // ------------------------------------------------------------------------

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', IMAGE_CACHE_CONTROL);
    res.setHeader('X-Cache', 'MISS');

    let total = 0;
    const chunks = [];
    let tooLarge = false;
    const reader = response.body.getReader();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > IMAGE_MAX_SIZE) {
        tooLarge = true;
        controller.abort();
        break;
      }
      const chunk = Buffer.from(value);
      chunks.push(chunk);
      if (!res.write(chunk)) {
        await new Promise((resolve) => res.once('drain', resolve));
      }
    }
    res.end();

    if (!tooLarge && total > 0) {
      imageCacheSet(cacheKey, { contentType, buffer: Buffer.concat(chunks) });
    }
  } catch (err) {
    logger.error({ err }, 'proxyImage error');
    if (controller) controller.abort();
    if (!res.headersSent) {
      return res.status(500).json({ success: false, message: 'Gagal mengambil gambar' });
    }
    res.end();
  } finally {
    if (timer) clearTimeout(timer);
  }
};
