import logger from '../lib/logger.js';

export function errorHandler(err, _req, res, _next) {
  logger.error({ err }, 'Unhandled error');
  res.status(500).json({ success: false, message: 'Terjadi kesalahan pada server' });
}

export function notFoundHandler(_req, res) {
  res.status(404).json({ success: false, message: 'Endpoint tidak ditemukan' });
}
