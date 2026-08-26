// tests/videoStreamProxy.test.js — Regresi untuk bug FATAL 2026-08-24:
// stream-proxy crash saat klien pindah episode (req 'close' → abort →
// Readable emit 'error' tanpa listener → proses mati).
// Fix: pipeline() di controllers/videoController.js.
// Test ini MENGGAGALKAN suite jika uncaught error terjadi lagi (vitest
// memperlakukan unhandled exception sebagai kegagalan worker).
import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import http from 'node:http';

vi.mock('../lib/scraper/stream-extract.js', () => ({
  extractDirectStream: vi.fn(),
}));

const { extractDirectStream } = await import('../lib/scraper/stream-extract.js');
const videoRouter = (await import('../routes/video.routes.js')).default;

const STREAM_URL = 'https://playmogo.com/f/token-sekali-pakai.mp4';
const PROXY_PATH =
  '/video/stream-proxy?url=' + encodeURIComponent(STREAM_URL) + '&slug=test-gate';

const app = express();
app.use(videoRouter);

/** Web ReadableStream yang mengalirkan satu chunk lalu ERROR di tengah. */
function erroringStream(delayMs = 5) {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode('chunk-pertama'));
      setTimeout(() => controller.error(new Error('CDN drop mid-stream')), delayMs);
    },
  });
}

/** Web ReadableStream sehat yang menutup dengan normal. */
function healthyStream() {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode('data-video'));
      controller.close();
    },
  });
}

describe('GET /video/stream-proxy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    extractDirectStream.mockResolvedValue({
      url: STREAM_URL,
      type: 'mp4',
    });
    // Stub fetch global — body = web stream (bentuk yang sama dengan undici)
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(healthyStream(), {
        status: 206,
        headers: { 'content-type': 'video/mp4', 'accept-ranges': 'bytes' },
      }))
    );
  });

  it('men-streaming respons sehat dengan status upstream', async () => {
    const res = await request(app).get(PROXY_PATH);
    expect(res.status).toBe(206);
    expect(res.headers['content-type']).toContain('video/mp4');
    // body berupa Buffer biner — cukup pastikan ada byte yang mengalir
    expect((res.body?.length ?? 0)).toBeGreaterThan(0);
  });

  it('TIDAK menjatuhkan proses saat upstream error di tengah pemutaran', async () => {
    // Ganti body jadi versi erroring khusus test ini
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(erroringStream(), {
        status: 206,
        headers: { 'content-type': 'video/mp4' },
      }))
    );

    const server = app.listen(0);
    const port = server.address().port;

    await new Promise((resolve) => {
      const req = http.get(`http://127.0.0.1:${port}${PROXY_PATH}`, (res) => {
        res.resume(); // konsumsi sampai rusak
        res.on('error', () => resolve()); // koneksi berakhir dini = wajar
      });
      req.on('error', () => resolve()); // ECONNRESET di sisi klien wajar
    });

    await new Promise((r) => setTimeout(r, 300)); // ruang bagi event error
    server.close();
    // Jika proses crash oleh unhandled 'error', vitest akan gagal di sini
    expect(true).toBe(true);
  });

  it('client disconnect saat streaming tidak menyebabkan unhandled error', async () => {
    const server = app.listen(0);
    const port = server.address().port;

    await new Promise((resolve) => {
      const req = http.get(`http://127.0.0.1:${port}${PROXY_PATH}`, (res) => {
        res.once('data', () => req.destroy()); // klien cabut di tengah
        resolve();
      });
      req.on('error', () => resolve());
      setTimeout(resolve, 2000); // pengaman
    });

    await new Promise((r) => setTimeout(r, 300));
    server.close();
    expect(true).toBe(true);
  });

  it('menolak URL player di luar allowlist', async () => {
    const res = await request(app)
      .get('/video/stream-proxy?url=' + encodeURIComponent('https://evil.com/x') + '&slug=test');
    expect(res.status).toBe(400);
  });
});

afterAll(() => {
  vi.unstubAllGlobals();
});
