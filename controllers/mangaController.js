import {
  scrapeMangaList,
  scrapeMangaDetail,
  scrapeChapterImages,
  scrapeGenres,
} from '../lib/scraper/index.js';
import { validatePage, validateLimit, validateQuery, validateSlug, validateId, validateCategory, validateEnum } from '../lib/validator.js';
import logger from '../lib/logger.js';

// Engine proxy gambar dipindah ke lib/imageProxy.js (SoC) — controller hanya
// me-re-export agar rute /api/image-proxy tidak berubah.
export { proxyImage } from '../lib/imageProxy.js';

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

