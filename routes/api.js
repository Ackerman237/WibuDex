import { Router } from 'express';
import { generalLimiter, proxyLimiter } from '../middleware/rateLimit.js';
import { 
  getMangaList, 
  getMangaDetail, 
  getMangaCategories,
  getChapterImages, 
  proxyImage 
} from '../controllers/mangaController.js';
import {
  getNekoList,
  getNekoCategory,
  getNekoSearch,
  getNekoDetail,
  getNekoCategories,
  getNekoSchedule,
  getNekoSeriesList,
  getNekoRandom,
  getPlayerMode,
  getPlayerFrame,
  passthroughProviderXhr,
} from '../controllers/nekoController.js';
import {
  getReadingPosition,
  getAllReadingPositions,
  saveReadingPositionHandler,
} from '../controllers/progressController.js';
import { getVpnStatusHandler } from '../controllers/vpnController.js';

const router = Router();

router.get('/manga', generalLimiter, getMangaList);
router.get('/manga/categories', generalLimiter, getMangaCategories);
router.get('/manga/detail', generalLimiter, getMangaDetail);
router.get('/chapter', generalLimiter, getChapterImages);
router.get('/image-proxy', proxyLimiter, proxyImage); 
router.get('/neko', generalLimiter, getNekoList);
router.get('/neko/categories', generalLimiter, getNekoCategories);
router.get('/neko/category', generalLimiter, getNekoCategory);
router.get('/neko/search', generalLimiter, getNekoSearch);
router.get('/neko/detail', generalLimiter, getNekoDetail);
router.get('/neko/schedule', generalLimiter, getNekoSchedule);
router.get('/neko/series', generalLimiter, getNekoSeriesList);
router.get('/neko/random', generalLimiter, getNekoRandom);
// Player-frame "bersih": embed penyedia disaring di server (anti popunder/redirect)
router.get('/neko/player-mode', generalLimiter, getPlayerMode);
router.get('/neko/player-frame', proxyLimiter, getPlayerFrame);
// Passthrough XHR internal penyedia dari dokumen sandboxed (butuh header CORS di controller)
router.get('/pf/:host/*', proxyLimiter, passthroughProviderXhr);
router.get('/progress', generalLimiter, getReadingPosition);
router.get('/progress/all', generalLimiter, getAllReadingPositions);
router.post('/progress', generalLimiter, saveReadingPositionHandler);
router.get('/vpn-status', generalLimiter, getVpnStatusHandler);

export default router;