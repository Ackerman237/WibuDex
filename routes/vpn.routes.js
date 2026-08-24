import { Router } from 'express';
import { generalLimiter } from '../middleware/rateLimit.js';
import { getVpnStatusHandler } from '../controllers/vpnController.js';

const router = Router();

router.get('/vpn-status', generalLimiter, getVpnStatusHandler);

export default router;
