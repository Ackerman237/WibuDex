import {
  scrapeMangaList,
  scrapeMangaDetail,
  scrapeChapterImages,
  scrapeGenres,
} from '../lib/scraper/index.js';
import { validatePage, validateLimit, validateQuery, validateSlug, validateId, validateCategoryList, validateEnum } from '../lib/validator.js';
import { respondUpstreamError } from '../middleware/upstream-response.js';

// Engine proxy gambar dipindah ke lib/image-proxy.js (SoC) — controller hanya
// me-re-export agar rute /api/image-proxy tidak berubah.
export { proxyImage } from '../lib/image-proxy.js';

const VALID_SORTS = new Set(['newest', 'rating', 'title']);
const VALID_STATUSES = new Set(['ongoing', 'completed', 'hiatus']);
const VALID_TYPES = new Set(['manga', 'manhwa', 'manhua']);

export const getMangaList = async (req, res) => {
  try {
    const page = validatePage(req.query.page);
    const limit = validateLimit(req.query.limit);
    const query = validateQuery(req.query.query);
    // Multi-genre koma-separated (maks 6, tiap item slug tervalidasi);
    // single genre tetap lewat jalur yang sama ("ecchi" === "ecchi," tunggal)
    const genre = validateCategoryList(req.query.genre) || '';
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
    return respondUpstreamError(res, err, { logLabel: 'getMangaList', notFoundMessage: 'Manga tidak ditemukan' });
  }
};

export const getMangaCategories = async (req, res) => {
  try {
    const data = await scrapeGenres();
    return res.json({ success: true, data });
  } catch (err) {
    return respondUpstreamError(res, err, { logLabel: 'getMangaCategories', notFoundMessage: 'Kategori tidak ditemukan' });
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
    return respondUpstreamError(res, err, { logLabel: 'getMangaDetail', notFoundMessage: 'Manga tidak ditemukan' });
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
    return respondUpstreamError(res, err, { logLabel: 'getChapterImages', notFoundMessage: 'Chapter tidak ditemukan' });
  }
};

