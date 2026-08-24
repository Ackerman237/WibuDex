import { Router } from 'express';
import { generalLimiter } from '../middleware/rateLimit.js';
import {
  getReadingPosition,
  getAllReadingPositions,
  saveReadingPositionHandler,
} from '../controllers/progressController.js';

const router = Router();

router.get('/progress', generalLimiter, getReadingPosition);
router.get('/progress/all', generalLimiter, getAllReadingPositions);
router.post('/progress', generalLimiter, saveReadingPositionHandler);

export default router;
