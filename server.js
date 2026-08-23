import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import net from 'net';
import helmet from 'helmet';
import apiRoutes from './routes/api.js';
import logger from './lib/logger.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { disconnectVpn } from './lib/vpn/vpnManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Fail-fast: jangan jalankan server tanpa app secret (request upstream akan gagal diam-diam)
if (!process.env.DOUJIN_APP_SECRET) {
  logger.error('DOUJIN_APP_SECRET tidak diset — set lewat .env sebelum menjalankan server.');
  if (process.env.NODE_ENV !== 'test') process.exit(1);
}

const app = express();
const PORT = Number(process.env.PORT) || 4000;

// 1 hop proxy = cloudflared (set X-Forwarded-For dari IP pengunjung asli).
// Tanpa ini, SEMUA request dari internet terlihat datang dari 127.0.0.1 →
// rate limiter membagi satu bucket untuk seluruh dunia.
app.set('trust proxy', 1);

// 1. Middleware
// CSP longgar: izinkan emoji/font CDN & inline style bawaan; perketat bertahap nanti
app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        'img-src': ["'self'", 'data:', 'https:'],
        'style-src': ["'self'", 'https://fonts.googleapis.com', "'unsafe-inline'"],
        'font-src': ["'self'", 'https://fonts.gstatic.com'],
        // bagian NEKO memakai iframe/video pihak ketiga
        'frame-src': ["'self'", 'https:'],
        'media-src': ["'self'", 'blob:', 'https:'],
      },
    },
    crossOriginEmbedderPolicy: false,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 2. Serve Static Files (Folder website/ untuk HTML, CSS, & JS Frontend)
// Kebijakan cache:
//   - HTML  -> no-cache (perubahan UI langsung terlihat; dulu maxAge 365d
//              membuat user terjebak di JS lama berbulan-bulan)
//   - Aset  -> cache panjang; invalidasi lewat ?v=N di referensi HTML
const staticCacheHeaders = (res, filePath) => {
  res.setHeader(
    'Cache-Control',
    filePath.endsWith('.html') ? 'no-cache' : 'public, max-age=31536000'
  );
};

app.use(
  express.static(path.join(__dirname, 'website'), { setHeaders: staticCacheHeaders })
);

app.use('/neko', express.static(path.join(__dirname, 'website', 'nekoPage'), { setHeaders: staticCacheHeaders }));

app.get('/', (_req, res) => {
  res.redirect('/doujinPage/html/index.html');
});

app.use(
  '/doujinPage/html',
  express.static(path.join(__dirname, 'website', 'doujinPage'), { setHeaders: staticCacheHeaders })
);

// 3. Routing API
app.use('/api', apiRoutes);

// 4. 404 handler
app.use(notFoundHandler);

// 5. Error handler
app.use(errorHandler);

// 6. Jalankan Server dengan Fallback Port Otomatis
function listenWithFallback(initialPort, maxAttempts = 5) {
  let currentPort = initialPort;
  let attempts = 0;

  const tryListen = () => {
    const tester = net.createServer();

    tester.once('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        attempts++;
        if (attempts < maxAttempts) {
          currentPort++;
          tryListen();
        } else {
          logger.error({ initialPort, maxAttempts }, `Semua port dari ${initialPort} hingga ${currentPort} sibuk.`);
          process.exit(1);
        }
      } else {
        logger.error(err, 'Kesalahan saat memeriksa port server.');
        process.exit(1);
      }
    });

    tester.once('listening', () => {
      tester.close(() => {
        app.listen(currentPort, () => {
          logger.info({ port: currentPort }, `Server berjalan di http://localhost:${currentPort}`);
        });
      });
    });

    tester.listen(currentPort);
  };

  tryListen();
}

if (process.env.NODE_ENV !== 'test') {
  listenWithFallback(PORT);

  async function gracefulShutdown(signal) {
    logger.info({ signal }, 'Shutdown dimulai, memutus VPN...');
    try {
      await disconnectVpn();
    } finally {
      process.exit(0);
    }
  }

  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
}

export default app;
