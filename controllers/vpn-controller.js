import { getVpnStatus } from '../lib/vpn/vpn-manager.js';
import logger from '../lib/logger.js';

// Status VPN berisi detail infrastruktur (provider, health, history error)
// — tidak ada alasan sah orang luar melihatnya.
// Izinkan hanya:
//   - akses loopback (browser di mesin yang sama, req.ip=127.0.0.1 via trust proxy)
//   - request yang membawa JWT Cloudflare Access (sudah terautentikasi di edge;
//     verifikasi penuh signature menyusul bila diperlukan)
function isLoopback(ip) {
  if (!ip) return false;
  const normalized = ip.replace(/^::ffff:/, '');
  return normalized === '127.0.0.1' || normalized === '::1';
}

export const getVpnStatusHandler = (req, res) => {
  try {
    const allowed =
      isLoopback(req.ip) || Boolean(req.get('Cf-Access-Jwt-Assertion'));
    if (!allowed) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    res.json({ success: true, ...getVpnStatus() });
  } catch (err) {
    logger.error({ err }, 'getVpnStatus error');
    res.status(500).json({ success: false, message: 'Gagal mengambil status VPN' });
  }
};
