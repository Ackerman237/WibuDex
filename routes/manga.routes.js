import { Router } from 'express';
import { generalLimiter, proxyLimiter } from '../middleware/rateLimit.js';
import {
  getMangaList,
  getMangaDetail,
  getMangaCategories,
  getChapterImages,
  proxyImage,
} from '../controllers/mangaController.js';

const router = Router();

router.get('/manga', generalLimiter, getMangaList);
router.get('/manga/categories', generalLimiter, getMangaCategories);
router.get('/manga/detail', generalLimiter, getMangaDetail);
router.get('/chapter', generalLimiter, getChapterImages);
router.get('/image-proxy', proxyLimiter, proxyImage);

export default router;
