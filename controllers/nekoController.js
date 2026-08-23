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
import { validatePage, validateCategory, validateQuery, validateSlug, validateEnum } from '../lib/validator.js';
import logger from '../lib/logger.js';
import { respondUpstreamError } from '../middleware/upstreamResponse.js';

const NEKO_SERIES_TYPES = new Set(['hentai', 'jav']);

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
