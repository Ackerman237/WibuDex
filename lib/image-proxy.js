// lib/imageProxy.js — Engine proxy + optimasi gambar doujin.
// Dipisah dari mangaController (SoC): controller hanya validasi HTTP,
// seluruh logika upstream/cache/thumbnail ada di sini agar bisa dites langsung.
import sharp from 'sharp';
import { safeImageUrl } from './security.js';
import { USER_AGENT, REFERER_DOUJIN } from './constants.js';
import { CacheManager } from './scraper/cache.js';
import logger from './logger.js';

const IMAGE_PROXY_TIMEOUT_MS = Number(process.env.IMAGE_PROXY_TIMEOUT_MS) || 20_000;
const IMAGE_MAX_SIZE = 10 * 1024 * 1024;
const IMAGE_CACHE_MAX_ENTRIES = 150;
// TTL cache gambar: sebelumnya entri hidup selamanya (hanya dibatasi jumlah),
// 60 menit membatasi memori tanpa mengubah perilaku nyata bagi pengguna.
const IMAGE_CACHE_TTL_MS = 60 * 60 * 1000;
// Header cache: cover URL unik per manga, aman di-cache browser jangka panjang
const IMAGE_CACHE_CONTROL = 'public, max-age=604800';
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const PROXY_IMAGE_HEADERS = {
  'User-Agent': USER_AGENT,
  Referer: REFERER_DOUJIN,
};

const imageCache = new CacheManager({
  maxSize: IMAGE_CACHE_MAX_ENTRIES,
  defaultTTL: IMAGE_CACHE_TTL_MS,
  // Budget memori nyata: 150 entri × gambar hingga 10MB = potensi ~1.5GB RAM.
  // Cap total 50MB (evict tertua) menjaga penggunaan memori tetap wajar.
  maxBytes: Number(process.env.IMAGE_CACHE_MAX_BYTES) || 50 * 1024 * 1024,
  sizeOf: (entry) => entry?.buffer?.byteLength || 0,
});

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

export async function proxyImage(req, res) {
  let controller = null;
  let timer = null;
  try {
    const imageUrl = req.query.url;
    if (!imageUrl) {
      return res.status(400).json({ success: false, message: 'URL gambar tidak disertakan' });
    }

    const safeUrl = safeImageUrl(imageUrl);
    if (!safeUrl) {
      return res.status(400).json({ success: false, message: 'URL gambar tidak valid' });
    }

    const thumbWidth = parseThumbWidth(req.query.w);
    const cacheKey = thumbWidth ? `${safeUrl}|w=${thumbWidth}` : safeUrl;

    const cached = imageCache.get(cacheKey);
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
        imageCache.set(cacheKey, { contentType: 'image/webp', buffer: optimized });
        return;
      }
      // sharp gagal → jatuh ke path streaming di bawah dengan data yang sudah dibaca
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', IMAGE_CACHE_CONTROL);
      res.setHeader('X-Cache', 'MISS');
      if (input && input.length > 0) {
        imageCache.set(cacheKey, { contentType, buffer: input });
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
      imageCache.set(cacheKey, { contentType, buffer: Buffer.concat(chunks) });
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
