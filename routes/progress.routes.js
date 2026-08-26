import { Router } from 'express';
import { generalLimiter } from '../middleware/rate-limit.js';
import {
  getReadingPosition,
  getAllReadingPositions,
  saveReadingPositionHandler,
} from '../controllers/progress-controller.js';

const router = Router();

router.get('/progress', generalLimiter, getReadingPosition);
router.get('/progress/all', generalLimiter, getAllReadingPositions);
router.post('/progress', generalLimiter, saveReadingPositionHandler);

export default router;
