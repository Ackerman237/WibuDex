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
  getStream,
  getStreamProxy,
  passthroughProviderXhr,
} from '../controllers/videoController.js';
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
router.get('/video', generalLimiter, getNekoList);
router.get('/video/categories', generalLimiter, getNekoCategories);
router.get('/video/category', generalLimiter, getNekoCategory);
router.get('/video/search', generalLimiter, getNekoSearch);
router.get('/video/detail', generalLimiter, getNekoDetail);
router.get('/video/schedule', generalLimiter, getNekoSchedule);
router.get('/video/series', generalLimiter, getNekoSeriesList);
router.get('/video/random', generalLimiter, getNekoRandom);
// Player-frame "bersih": embed penyedia disaring di server (anti popunder/redirect)
router.get('/video/player-mode', generalLimiter, getPlayerMode);
router.get('/video/player-frame', proxyLimiter, getPlayerFrame);
// Stream langsung: URL MP4 CDN hasil ekstraksi server (nol JS penyedia)
router.get('/video/stream', proxyLimiter, getStream);
// Proxy byte video: server mengonsumsi token sekali-pakai, browser menerima
// stream dari origin kita (mendukung Range/seek)
router.get('/video/stream-proxy', proxyLimiter, getStreamProxy);
// Passthrough XHR internal penyedia dari dokumen sandboxed (butuh header CORS di controller)
router.get('/pf/:host/*', proxyLimiter, passthroughProviderXhr);
router.get('/progress', generalLimiter, getReadingPosition);
router.get('/progress/all', generalLimiter, getAllReadingPositions);
router.post('/progress', generalLimiter, saveReadingPositionHandler);
router.get('/vpn-status', generalLimiter, getVpnStatusHandler);

export default router;