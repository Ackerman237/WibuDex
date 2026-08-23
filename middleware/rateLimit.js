import { rateLimit } from 'express-rate-limit';

// Kunci rate-limit: pakai IP asli pengunjung.
// - CF-Connecting-IP di-set edge Cloudflare dan tidak bisa dipalsukan lewat
//   tunnel (cloudflared menimpanya) → akurat untuk semua pengunjung internet.
// - Fallback req.ip (loopback / akses LAN langsung).
function clientKey(req) {
  return req.get('CF-Connecting-IP') || req.ip;
}

export const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: clientKey,
  message: { success: false, message: 'Terlalu banyak permintaan. Coba lagi sebentar.' },
});

export const proxyLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: clientKey,
  message: { success: false, message: 'Terlalu banyak permintaan gambar. Coba lagi sebentar.' },
});
