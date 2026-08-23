import { newPage } from '../lib/browser.js';
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

const NEKO_SERIES_TYPES = new Set(['hentai', 'jav']);

export const getNekoList = async (req, res) => {
  try {
    const page = validatePage(req.query.page);
    const data = await scrapeNekoList(page);
    return res.json({ success: true, data });
  } catch (err) {
    logger.error({ err }, 'getNekoList error');
    if (err?.message?.includes('HTTP 404')) {
      return res.status(404).json({ success: false, message: 'Video tidak ditemukan' });
    }
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan pada server' });
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
    logger.error({ err }, 'getNekoCategory error');
    if (err?.message?.includes('HTTP 404')) {
      return res.status(404).json({ success: false, message: 'Category tidak ditemukan' });
    }
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan pada server' });
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
    logger.error({ err }, 'getNekoSearch error');
    if (err?.message?.includes('HTTP 404')) {
      return res.status(404).json({ success: false, message: 'Hasil pencarian tidak ditemukan' });
    }
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan pada server' });
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
    logger.error({ err }, 'getNekoDetail error');
    if (err?.message?.includes('HTTP 404')) {
      return res.status(404).json({ success: false, message: 'Video tidak ditemukan' });
    }
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan pada server' });
  }
};

export const getNekoCategories = async (_req, res) => {
  try {
    const data = await scrapeNekoCategories();
    return res.json({ success: true, data });
  } catch (err) {
    logger.error({ err }, 'getNekoCategories error');
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan pada server' });
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
    logger.error({ err }, 'getNekoSeriesList error');
    if (err?.message?.includes('HTTP 404')) {
      return res.status(404).json({ success: false, message: 'Daftar seri tidak ditemukan' });
    }
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan pada server' });
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

export const proxyNekoPlayer = async (req, res) => {
  let page;
  try {
    const url = validateUrl(req.query.url);
    if (!url) return res.status(400).json({ success: false, message: 'Parameter url tidak valid' });

    // SSRF guard: hanya izinkan host yang terdaftar.
    // URL gagal parse = TOLAK (dulu catch-nya justru melanjutkan — celah defense-in-depth).
    try {
      const parsed = new URL(url);
      const allowedHosts = (process.env.NEKO_PLAYER_HOSTS || 'playmogo.com,yandex.ru')
        .split(',')
        .map((h) => h.trim());
      if (!allowedHosts.some((allowed) => parsed.hostname === allowed || parsed.hostname.endsWith(`.${allowed}`))) {
        return res.status(400).json({ success: false, message: 'URL player tidak diizinkan' });
      }
    } catch {
      return res.status(400).json({ success: false, message: 'URL player tidak valid' });
    }

    page = await newPage();

    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
    );

    await page.setExtraHTTPHeaders({
      Referer: 'https://nekopoi.care/',
      'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
    });

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

    try {
      await page.waitForFunction(
        () => !document.body.innerText.includes('Performing security verification'),
        { timeout: 15000 }
      );
      await new Promise((resolve) => setTimeout(resolve, 2000));
    } catch (e) {}

    const html = await page.content();
    await page.close();

    // HTML pihak ketiga disajikan dalam sandbox opaque-origin: script player
    // tetap jalan, tapi dokumen TIDAK bisa mengakses cookie/localStorage/API
    // origin kita (mitigasi XSS jika host allowlisted terkompromi).
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Security-Policy', 'sandbox allow-scripts');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(html);
  } catch (err) {
    if (page) await page.close();
    logger.error({ err }, 'proxyNekoPlayer error');
    // Distinguish error types for better client messages
    if (err?.message?.includes('Timeout')) {
      return res.status(504).json({ success: false, message: 'Timeout menunggu player' });
    }
    if (err?.message?.includes('Performing security verification')) {
      return res.status(502).json({ success: false, message: 'Verifikasi keamanan gagal, coba lagi' });
    }
    return res.status(500).json({ success: false, message: 'Gagal memuat player' });
  }
};
