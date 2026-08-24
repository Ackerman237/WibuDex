import { Router } from 'express';
import mangaRoutes from './manga.routes.js';
import videoRoutes from './video.routes.js';
import progressRoutes from './progress.routes.js';
import vpnRoutes from './vpn.routes.js';

const router = Router();

router.use(mangaRoutes);
router.use(videoRoutes);
router.use(progressRoutes);
router.use(vpnRoutes);

export default router;
