// controllers/progressController.js — Reading position CRUD

import { upsertPosition, getPosition, getAllPositions } from '../lib/db.js';
import { safeImageUrl } from '../lib/security.js';
import logger from '../lib/logger.js';

const DEVICE_ID_HEADER = 'x-device-id';
const MAX_DEVICE_ID_LEN = 128;
const MAX_SLUG_LEN = 200;
const MAX_CHAPTER_ID_LEN = 100;

function sanitizeDeviceId(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_DEVICE_ID_LEN) return null;
  if (!/^[a-zA-Z0-9_-]+$/.test(trimmed)) return null;
  return trimmed;
}

function sanitizeSlug(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_SLUG_LEN) return null;
  return trimmed;
}

function sanitizeChapterId(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_CHAPTER_ID_LEN) return null;
  return trimmed;
}

function sanitizePage(value) {
  const num = parseInt(value, 10);
  if (!Number.isFinite(num) || num < 1) return 1;
  if (num > 9999) return 9999;
  return num;
}

/**
 * GET /api/progress?slug=xxx
 * Header: x-device-id
 */
export const getReadingPosition = (req, res) => {
  try {
    const deviceId = sanitizeDeviceId(req.headers[DEVICE_ID_HEADER]);
    if (!deviceId) {
      return res.status(400).json({ success: false, message: 'Header x-device-id tidak valid' });
    }

    const mangaSlug = sanitizeSlug(req.query.slug);
    if (!mangaSlug) {
      return res.status(400).json({ success: false, message: 'Parameter slug tidak valid' });
    }

    const position = getPosition({ deviceId, mangaSlug });
    return res.json({ success: true, data: position });
  } catch (err) {
    logger.error({ err }, 'getReadingPosition error');
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan pada server' });
  }
};

/**
 * GET /api/progress/all
 * Header: x-device-id
 */
export const getAllReadingPositions = (req, res) => {
  try {
    const deviceId = sanitizeDeviceId(req.headers[DEVICE_ID_HEADER]);
    if (!deviceId) {
      return res.status(400).json({ success: false, message: 'Header x-device-id tidak valid' });
    }

    const positions = getAllPositions({ deviceId });
    return res.json({ success: true, data: positions });
  } catch (err) {
    logger.error({ err }, 'getAllReadingPositions error');
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan pada server' });
  }
};

/**
 * POST /api/progress
 * Header: x-device-id
 * Body: { mangaSlug, chapterId, page, chapterNum }
 */
export const saveReadingPositionHandler = (req, res) => {
  try {
    const deviceId = sanitizeDeviceId(req.headers[DEVICE_ID_HEADER]);
    if (!deviceId) {
      return res.status(400).json({ success: false, message: 'Header x-device-id tidak valid' });
    }

    const mangaSlug = sanitizeSlug(req.body?.mangaSlug);
    const chapterId = sanitizeChapterId(req.body?.chapterId);

    if (!mangaSlug || !chapterId) {
      return res.status(400).json({ success: false, message: 'mangaSlug dan chapterId wajib diisi' });
    }

    const page = sanitizePage(req.body?.page);
    const chapterNum = req.body?.chapterNum != null ? String(req.body.chapterNum).slice(0, 20) : null;

    // Metadata opsional untuk halaman riwayat baca (boleh tidak ada pada client lama)
    let mangaTitle = null;
    if (typeof req.body?.mangaTitle === 'string' && req.body.mangaTitle.trim()) {
      mangaTitle = req.body.mangaTitle.trim().slice(0, 200);
    }
    const coverUrl = typeof req.body?.coverUrl === 'string' ? safeImageUrl(req.body.coverUrl.trim()) : null;
    let mangaType = null;
    if (typeof req.body?.mangaType === 'string' && req.body.mangaType.trim()) {
      mangaType = req.body.mangaType.trim().toLowerCase().slice(0, 20);
    }

    upsertPosition({ deviceId, mangaSlug, chapterId, page, chapterNum, mangaTitle, coverUrl, mangaType });
    return res.json({ success: true });
  } catch (err) {
    logger.error({ err }, 'saveReadingPosition error');
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan pada server' });
  }
};
