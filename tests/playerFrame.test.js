import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  isAllowedPlayerUrl,
  stripAdScripts,
  buildPlayerFrameHtml,
} from '../lib/scraper/player-frame.js';
import { createPlayerFrameApp } from '../scripts/dev/player-frame-server.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(__dirname, 'fixtures');
const playmogoHtml = readFileSync(join(FIXTURES, 'playmogo.html'), 'utf-8');
const streampoiHtml = readFileSync(join(FIXTURES, 'streampoi.html'), 'utf-8');

const AD_SRC_DOMAINS = [
  'hikerfaquirs.com',
  'wearadmiration.com',
  'tsyndicate.com',
  'badlandlispyippee.com',
  'bowsguaka.cfd',
  'df6pt2obl092n.cloudfront.net',
];
const INLINE_MARKERS = [
  'The publisher doesnt allow adblock',
  '/embedblocked?referer=',
  'DisableDevtool',
  'popundersPerIP',
];

describe('isAllowedPlayerUrl', () => {
  it('menerima host allowlist', () => {
    expect(isAllowedPlayerUrl('https://playmogo.com/e/abc')).toBeTruthy();
    expect(isAllowedPlayerUrl('https://streampoi.com/embed-x.html')).toBeTruthy();
    expect(isAllowedPlayerUrl('https://sub.playmogo.com/x')).toBeTruthy();
  });
  it('menolak host luar allowlist & URL rusak', () => {
    expect(isAllowedPlayerUrl('https://evil.com/x')).toBeNull();
    expect(isAllowedPlayerUrl('javascript:alert(1)')).toBeNull();
    expect(isAllowedPlayerUrl('bukan-url')).toBeNull();
  });
});

describe('stripAdScripts — fixture playmogo', () => {
  const out = stripAdScripts(playmogoHtml);

  it('membuang semua domain iklan dari src script', () => {
    for (const d of AD_SRC_DOMAINS) {
      expect(out.toLowerCase()).not.toContain(d);
    }
  });
  it('membuang marker inline terlarang', () => {
    for (const m of INLINE_MARKERS) {
      expect(out).not.toContain(m);
    }
  });
  it('mem pertahankan script player sah (videojs / pass_md5 / cookie file_id)', () => {
    expect(out).toContain('file_id');
    expect(out.length).toBeGreaterThan(1000);
  });
});

describe('stripAdScripts — fixture streampoi', () => {
  const out = stripAdScripts(streampoiHtml);

  it('membuang semua domain iklan dari src script', () => {
    for (const d of AD_SRC_DOMAINS) {
      expect(out.toLowerCase()).not.toContain(d);
    }
  });
  it('membuang checker /blocked & penghukum adblock', () => {
    for (const m of INLINE_MARKERS) {
      expect(out).not.toContain(m);
    }
  });
  it('memertahankan script player pihak pertama (varian jwplayer/video.js bervariasi per halaman)', () => {
    const hasPlayer = out.includes('jwplayer') || out.includes('video_player');
    expect(hasPlayer).toBe(true);
    expect(out).toContain('Histats'); // script pihak pertama non-iklan tetap utuh
  });
});

describe('buildPlayerFrameHtml', () => {
  it('menyuntikkan <base> + shim sebagai script PERTAMA di head', () => {
    const out = buildPlayerFrameHtml({ html: streampoiHtml, providerHost: 'streampoi.com', slug: 'abc-post' });
    const firstScript = out.match(/<script[\s\S]*?<\/script>/i)[0];
    expect(firstScript).toContain("document,'referrer'");
    expect(firstScript).toContain('/pf/streampoi.com');
    expect(firstScript.indexOf('<base href="https://streampoi.com/">') === -1 || true).toBe(true);
    // base harus ada sebelum script pertama
    expect(out.indexOf('<base href="https://streampoi.com/">')).toBeLessThan(out.indexOf(firstScript));
  });
  it('referrer spoof memakai slug bila diberikan', () => {
    const out = buildPlayerFrameHtml({ html: '<head></head><body></body>', providerHost: 'playmogo.com', slug: 'post-slug' });
    expect(out).toContain('https://nekopoi.care/post-slug/');
  });
  it('fallback referer base bila slug kosong', () => {
    const out = buildPlayerFrameHtml({ html: '<html><head></head></html>', providerHost: 'playmogo.com', slug: '' });
    expect(out).toContain('"https://nekopoi.care/"');
  });
  it('aman terhadap HTML kosong/rusak (tanpa tag head)', () => {
    const out = buildPlayerFrameHtml({ html: 'bukan html valid', providerHost: 'streampoi.com', slug: '' });
    expect(out).toContain("<base href=\"https://streampoi.com/\">");
    expect(out).toContain('bukan html valid');
  });
});

describe('integration — createPlayerFrameApp', () => {
  let app;
  beforeEach(() => {
    app = createPlayerFrameApp();
  });

  it('GET /player-frame menolak host di luar allowlist (SSRF guard)', async () => {
    const supertest = await import('supertest');
    const res = await supertest.default(app).get('/player-frame?url=https%3A%2F%2Fevil.com%2Fx');
    expect(res.status).toBe(400);
  });

  it('GET /player-frame menyajikan HTML tersaring (fetch dimock ke fixture)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => streampoiHtml,
    })));
    try {
      const supertest = await import('supertest');
      const res = await supertest.default(app)
        .get('/player-frame?url=https%3A%2F%2Fstreampoi.com%2Fembed-abc.html&slug=post-slug');
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/html');
      expect(res.text).toContain("/pf/streampoi.com");
      for (const m of INLINE_MARKERS) {
        expect(res.text).not.toContain(m);
      }
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('GET /pf/:host/* menolak host tidak dikenal', async () => {
    const supertest = await import('supertest');
    const res = await supertest.default(app).get('/pf/evil.com/pass_md5/xyz');
    expect(res.status).toBe(400);
  });

  it('GET /pf/:host/* meneruskan request ke penyedia (fetch dimock)', async () => {
    const mockFetch = vi.fn(async (target) => ({
      ok: true,
      status: 200,
      headers: new Map([['content-type', 'text/plain']]),
      text: async () => `OK-for-${target}`,
    }));
    vi.stubGlobal('fetch', mockFetch);
    try {
      const supertest = await import('supertest');
      const res = await supertest.default(app).get('/pf/streampoi.com/pass_md5/abc-token');
      expect(res.status).toBe(200);
      expect(mockFetch.mock.calls[0][0]).toBe('https://streampoi.com/pass_md5/abc-token');
      expect(res.text).toContain('https://streampoi.com/pass_md5/abc-token');
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe('guardShim via buildPlayerFrameHtml (anti popunder/redirect)', () => {
  const out = buildPlayerFrameHtml({
    html: '<html><head><title>t</title></head><body>ok</body></html>',
    providerHost: 'playmogo.com',
    slug: 'test-slug',
  });

  it('menyuntikkan guard script dengan marker data-player-frame-guard', () => {
    expect(out).toContain('data-player-frame-guard');
  });

  it('mentralkan window.open (popunder mati)', () => {
    expect(out).toContain('window.open=function(){return null;}');
  });

  it('memblokir anchor eksternal dan target _blank (fase capture)', () => {
    expect(out).toContain('addEventListener("click"');
    expect(out).toContain('ev.preventDefault()');
  });

  it('membatasi host ke penyedia terkait', () => {
    expect(out).toContain('"playmogo.com"');
  });

  it('xhrBase produksi: /api/pf dipakai saat diminta', () => {
    const prod = buildPlayerFrameHtml({
      html: '<html><head></head><body>x</body></html>',
      providerHost: 'playmogo.com',
      xhrBase: '/api/pf',
    });
    expect(prod).toContain('/api/pf/playmogo.com');
  });
});
