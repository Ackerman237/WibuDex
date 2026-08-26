import { Router } from 'express';
import { generalLimiter } from '../middleware/rate-limit.js';
import { getVpnStatusHandler } from '../controllers/vpn-controller.js';

const router = Router();

router.get('/vpn-status', generalLimiter, getVpnStatusHandler);

export default router;
