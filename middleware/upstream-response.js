// middleware/upstreamResponse.js — Satu tempat untuk mapping error upstream
// menjadi respons HTTP. Sebelumnya blok if-status ini diduplikasi di hampir
// setiap handler controller.
import logger from '../lib/logger.js';

const UPSTREAM_UNAVAILABLE_MESSAGE =
  'Server sumber sedang tidak dapat dihubungi (VPN/upstream bermasalah). Coba lagi beberapa saat.';
const INTERNAL_ERROR_MESSAGE = 'Terjadi kesalahan pada server';

/**
 * Kirim respons error berdasarkan jenis error upstream.
 * @param {object} res - Express response
 * @param {Error} err - Error yang ditangkap
 * @param {object} opts
 * @param {string} opts.notFoundMessage - Pesan untuk kasus HTTP 404
 * @param {string} [opts.logLabel] - Label logging (default: nama handler)
 */
export function respondUpstreamError(res, err, { notFoundMessage, logLabel = 'handler' }) {
  logger.error({ err }, `${logLabel} error`);

  // Doujin (fetcher) melempar persis "HTTP 404"; neko menyertakan path
  // ("HTTP 404 untuk /...") — keduanya tertangkap oleh startsWith.
  if (String(err?.message || '').startsWith('HTTP 404')) {
    return res.status(404).json({ success: false, message: notFoundMessage });
  }
  if (err?.message === 'UPSTREAM_UNAVAILABLE') {
    return res.status(503).json({ success: false, message: UPSTREAM_UNAVAILABLE_MESSAGE });
  }
  return res.status(500).json({ success: false, message: INTERNAL_ERROR_MESSAGE });
}
