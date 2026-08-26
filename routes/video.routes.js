import { Router } from 'express';
import { generalLimiter, proxyLimiter } from '../middleware/rate-limit.js';
import {
  getVideoList,
  getVideoCategory,
  getVideoSearch,
  getVideoDetail,
  getVideoCategories,
  getVideoSchedule,
  getVideoSeriesList,
  getVideoRandom,
  getPlayerMode,
  getPlayerFrame,
  getStream,
  getStreamProxy,
  passthroughProviderXhr,
} from '../controllers/video-controller.js';

const router = Router();

router.get('/video', generalLimiter, getVideoList);
router.get('/video/categories', generalLimiter, getVideoCategories);
router.get('/video/category', generalLimiter, getVideoCategory);
router.get('/video/search', generalLimiter, getVideoSearch);
router.get('/video/detail', generalLimiter, getVideoDetail);
router.get('/video/schedule', generalLimiter, getVideoSchedule);
router.get('/video/series', generalLimiter, getVideoSeriesList);
router.get('/video/random', generalLimiter, getVideoRandom);
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

export default router;
