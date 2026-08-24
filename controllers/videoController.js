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
import { extractDirectStream } from '../lib/scraper/streamExtract.js';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
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
  // allowedHosts dipakai frontend untuk pra-validasi URL player sebelum
  // dipakai di iframe langsung (mode direct) — satu sumber kebenaran dengan
  // env NEKO_PLAYER_HOSTS.
  res.json({ success: true, data: { mode: PLAYER_FRAME_MODE, allowedHosts: PLAYER_HOSTS } });
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
const STREAM_FAIL_TTL_MS = 60_000;
const STREAM_FAIL_MAX_ENTRIES = 200;
const streamFailCache = new Map(); // embedUrl -> timestamp gagal terakhir

export const getStream = async (req, res) => {
  try {
    const url = validateUrl(req.query.url);
    if (!url) return res.status(400).json({ success: false, message: 'Parameter url tidak valid' });

    const safeUrl = isAllowedPlayerUrl(url);
    if (!safeUrl) return res.status(400).json({ success: false, message: 'URL player tidak diizinkan' });

    // Negative-cache 60 dtk: embed yang baru saja gagal diekstrak tidak perlu
    // mengulang seluruh rantai berat saat user klik server yang sama lagi.
    const failedAt = streamFailCache.get(safeUrl);
    if (failedAt && Date.now() - failedAt < STREAM_FAIL_TTL_MS) {
      return res.status(404).json({ success: false, fallback: true, message: 'Ekstraksi baru saja gagal untuk URL ini' });
    }

    const slug = String(req.query.slug || '').replace(/[^a-z0-9-]/gi, '');
    const extracted = await extractDirectStream(safeUrl, { slug });
    if (!extracted) {
      // Cap ukuran cache (Map tak terbatas = kebocoran memori perlahan)
      if (streamFailCache.size >= STREAM_FAIL_MAX_ENTRIES) {
        streamFailCache.delete(streamFailCache.keys().next().value);
      }
      streamFailCache.set(safeUrl, Date.now());
      // Bukan error — penyedia ini tidak didukung ekstraksi; fallback ke filtered
      return res.status(404).json({ success: false, fallback: true, message: 'Ekstraksi stream tidak tersedia untuk penyedia ini' });
    }
    streamFailCache.delete(safeUrl);

    // URL hasil ekstraksi berasal dari halaman provider (tidak sepenuhnya
    // dipercaya) — paksa https sebelum diverifikasi & dikirim ke klien.
    if (!/^https:\/\//i.test(extracted.url)) {
      return res.status(404).json({ success: false, fallback: true, message: 'Stream tidak dapat diverifikasi' });
    }

    // PENTING: JANGAN mem-probe URL CDN di sini — token DoodStream sekali pakai /
    // berumur sangat pendek (terbukti live: request kedua = 302/refused).
    // Validasi sebenarnya terjadi saat stream-proxy menyajikan byte pertama;
    // bila gagal, frontend otomatis jatuh ke player-frame terfilter.
    const proxyQuery = `url=${encodeURIComponent(safeUrl)}&slug=${encodeURIComponent(slug)}`;
    return res.json({
      success: true,
      data: { type: extracted.type, proxyUrl: `/api/video/stream-proxy?${proxyQuery}` },
    });
  } catch (err) {
    logger.error({ err }, 'getStream error');
    if (err?.name === 'AbortError' || err?.message?.includes('Timeout')) {
      return res.status(504).json({ success: false, fallback: true, message: 'Timeout mengekstrak stream' });
    }
    return res.status(502).json({ success: false, fallback: true, message: 'Gagal mengekstrak stream' });
  }
};

// Stream-proxy: server mengonsumsi token sekali-pakai lalu MEMIPAKAN byte ke
// browser. Mendukung Range (seek video). Browser TIDAK pernah melihat URL CDN.
export const getStreamProxy = async (req, res) => {
  let upstreamController = null;
  try {
    const url = validateUrl(req.query.url);
    if (!url) return res.status(400).json({ success: false, message: 'Parameter url tidak valid' });

    const safeUrl = isAllowedPlayerUrl(url);
    if (!safeUrl) return res.status(400).json({ success: false, message: 'URL player tidak diizinkan' });

    const slug = String(req.query.slug || '').replace(/[^a-z0-9-]/gi, '');
    // Ekstraksi fresh SETIAP pemutaran — token lama pasti sudah mati.
    const extracted = await extractDirectStream(safeUrl, { slug });
    if (!extracted) {
      return res.status(404).json({ success: false, message: 'Ekstraksi stream tidak tersedia' });
    }

    const host = new URL(safeUrl).hostname;
    const range = req.headers.range;

    upstreamController = new AbortController();
    const killSwitch = setTimeout(() => upstreamController?.abort(), 60_000);
    req.on('close', () => upstreamController?.abort());

    const upstream = await fetch(extracted.url, {
      headers: {
        'User-Agent': USER_AGENT,
        Referer: `https://${host}/`,
        ...(range ? { Range: range } : {}),
      },
      signal: upstreamController.signal,
      redirect: 'follow',
    });

    if (!upstream.ok && upstream.status !== 206) {
      clearTimeout(killSwitch);
      logger.warn({ status: upstream.status, host }, 'stream-proxy: CDN menolak');
      return res.status(502).json({ success: false, message: 'CDN menolak stream' });
    }

    res.status(upstream.status);
    const passthroughHeaders = ['content-type', 'content-length', 'content-range', 'accept-ranges'];
    for (const h of passthroughHeaders) {
      const v = upstream.headers.get(h);
      if (v) res.setHeader(h, v);
    }
    if (!res.getHeader('accept-ranges')) res.setHeader('Accept-Ranges', 'bytes');

    // Pipakan via pipeline() — BUKAN .pipe() polos.
    // FIX FATAL 2026-08-24: user pindah episode → req 'close' → abort()
    // → Readable emit 'error' (AbortError) tanpa listener → SELURUH
    // SERVER MATI. Pola identik PeerTube #7535 & node-fetch #1801;
    // pipeline() menangani error/cleanup/backpressure dengan benar.
    res.on('close', () => clearTimeout(killSwitch));
    const upstreamReadable = Readable.fromWeb(upstream.body);
    // Lapis pertama: log + matikan killSwitch saat upstream error
    upstreamReadable.on('error', (err) => {
      clearTimeout(killSwitch);
      logger.warn({ err: err?.message }, 'stream-proxy: stream upstream error');
    });
    await pipeline(upstreamReadable, res);
  } catch (err) {
    if (err?.name === 'AbortError') {
      // client disconnect / timeout — koneksi sudah mati, tak ada yang dibalas
      return;
    }
    logger.error({ err }, 'getStreamProxy error');
    // Guard: jangan tulis ke response yang sudah destroyed/terkirim
    if (res.destroyed || res.writableEnded) return;
    if (!res.headersSent) {
      return res.status(502).json({ success: false, message: 'Gagal men-streaming video' });
    }
    res.end();
  } finally {
    // killSwitch dibiarkan sampai res close/finish — jangan clearTimeout di sini
  }
};

// Passthrough XHR internal penyedia (mis. $.get('/pass_md5/...')) dari dokumen
// sandboxed (origin null) → butuh header CORS terbuka, dengan host allowlist.
const PASSTHROUGH_TIMEOUT_MS = 15_000;
const PASSTHROUGH_MAX_BYTES = 2 * 1024 * 1024; // respons XHR provider = token/JSON kecil

export const passthroughProviderXhr = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const host = String(req.params.host || '').toLowerCase();
  if (!PLAYER_HOSTS.some((h) => host === h || host.endsWith(`.${h}`))) {
    return res.status(400).json({ success: false, message: 'Host tidak diizinkan' });
  }
  const rest = req.params[0] || '';
  const query = req.url.includes('?') ? `?${req.url.split('?').slice(1).join('?')}` : '';
  const target = `https://${host}/${rest}${query}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PASSTHROUGH_TIMEOUT_MS);
  try {
    const upstream = await fetch(target, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: '*/*',
        Referer: `https://${host}/`,
      },
      signal: controller.signal,
    });
    res.status(upstream.status);
    const contentType = upstream.headers.get('content-type');
    if (contentType) res.type(contentType);
    // Cap ukuran respons: tanpa ini memori bisa dipompa lewat file besar
    // dari host allowlist (relay publik).
    let total = 0;
    const chunks = [];
    const reader = upstream.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > PASSTHROUGH_MAX_BYTES) {
        controller.abort();
        return res.status(413).json({ success: false, message: 'Respons provider terlalu besar' });
      }
      chunks.push(Buffer.from(value));
    }
    return res.send(Buffer.concat(chunks));
  } catch (err) {
    logger.warn({ err, target }, 'passthroughProviderXhr gagal');
    if (!res.headersSent) {
      return res.status(502).json({ success: false, message: 'Passthrough gagal' });
    }
    return res.end();
  } finally {
    clearTimeout(timer);
  }
};

export const getVideoList = async (req, res) => {
  try {
    const page = validatePage(req.query.page);
    const data = await scrapeNekoList(page);
    return res.json({ success: true, data });
  } catch (err) {
    return respondUpstreamError(res, err, { logLabel: 'getVideoList', notFoundMessage: 'Video tidak ditemukan' });
  }
};

export const getVideoCategory = async (req, res) => {
  try {
    const page = validatePage(req.query.page);
    const category = validateCategory(req.query.category);
    if (!category) {
      return res.status(400).json({ success: false, message: 'Parameter category tidak valid' });
    }
    const data = await scrapeNekoCategory(category, page);
    return res.json({ success: true, data });
  } catch (err) {
    return respondUpstreamError(res, err, { logLabel: 'getVideoCategory', notFoundMessage: 'Category tidak ditemukan' });
  }
};

export const getVideoSearch = async (req, res) => {
  try {
    const page = validatePage(req.query.page);
    const query = validateQuery(req.query.query);
    if (!query) {
      return res.status(400).json({ success: false, message: 'Parameter query tidak valid' });
    }
    const data = await scrapeNekoSearch(query, page);
    return res.json({ success: true, data });
  } catch (err) {
    return respondUpstreamError(res, err, { logLabel: 'getVideoSearch', notFoundMessage: 'Hasil pencarian tidak ditemukan' });
  }
};

export const getVideoDetail = async (req, res) => {
  try {
    const slug = validateSlug(req.query.slug);
    if (!slug) {
      return res.status(400).json({ success: false, message: 'Parameter slug tidak valid' });
    }
    const data = await scrapeNekoDetail(slug);
    return res.json({ success: true, data });
  } catch (err) {
    return respondUpstreamError(res, err, { logLabel: 'getVideoDetail', notFoundMessage: 'Video tidak ditemukan' });
  }
};

export const getVideoCategories = async (_req, res) => {
  try {
    const data = await scrapeNekoCategories();
    return res.json({ success: true, data });
  } catch (err) {
    return respondUpstreamError(res, err, { logLabel: 'getVideoCategories', notFoundMessage: 'Kategori tidak ditemukan' });
  }
};

export const getVideoSchedule = async (_req, res) => {
  try {
    const data = await scrapeNekoSchedule();
    return res.json({ success: true, data });
  } catch (err) {
    logger.error({ err }, 'getVideoSchedule error');
    return res.status(503).json({ success: false, message: 'Jadwal sementara tidak tersedia' });
  }
};

export const getVideoSeriesList = async (req, res) => {
  try {
    const page = validatePage(req.query.page);
    const type = validateEnum(req.query.type, NEKO_SERIES_TYPES, 'hentai');
    const data = await scrapeNekoSeriesList(type, page);
    return res.json({ success: true, data });
  } catch (err) {
    return respondUpstreamError(res, err, { logLabel: 'getVideoSeriesList', notFoundMessage: 'Daftar seri tidak ditemukan' });
  }
};

export const getVideoRandom = async (_req, res) => {
  try {
    const data = await scrapeNekoRandom();
    return res.json({ success: true, data });
  } catch (err) {
    logger.error({ err }, 'getVideoRandom error');
    if (err?.name === 'AbortError' || err?.message?.includes('Timeout')) {
      return res.status(504).json({ success: false, message: 'Timeout mencari video acak' });
    }
    return res.status(502).json({ success: false, message: 'Gagal mengambil video acak' });
  }
};
