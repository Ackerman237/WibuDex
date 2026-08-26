// tests/security-hardening.test.js — regresi untuk hardening Batch 1:
// 1. Guard /api/vpn-status (hanya loopback / JWT Access)
// 2. encodeURIComponent id/slug di doujinScraper (anti path manipulation)
// 3. Cap 100 baris reading position per device
import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { mkdtempSync } from 'node:fs';

// ─── Mock scraper & VPN agar tidak ada trafik jaringan nyata ──────────────
vi.mock('../lib/scraper/neko-scraper.js', () => ({
  scrapeNekoList: vi.fn().mockResolvedValue({ videos: [], hasNext: false }),
  scrapeNekoCategory: vi.fn().mockResolvedValue({}),
  scrapeNekoSearch: vi.fn().mockResolvedValue({}),
  scrapeNekoDetail: vi.fn().mockResolvedValue({}),
  scrapeNekoCategories: vi.fn().mockResolvedValue([]),
  scrapeNekoSchedule: vi.fn().mockResolvedValue([]),
  scrapeNekoSeriesList: vi.fn().mockResolvedValue({}),
  scrapeNekoRandom: vi.fn().mockResolvedValue({}),
}));

vi.mock('../lib/vpn/vpn-manager.js', () => ({
  ensureVpn: vi.fn().mockResolvedValue({ provider: null, agent: undefined, dispatcher: undefined }),
  reportFailure: vi.fn(),
  reportSuccess: vi.fn(),
  disconnectVpn: vi.fn().mockResolvedValue(undefined),
  getVpnStatus: vi.fn().mockReturnValue({
    activeProvider: null,
    targets: {},
    providers: {},
    history: [],
  }),
}));

vi.mock('../lib/scraper/fetcher.js', () => ({
  fetchJSON: vi.fn(async (url) => {
    // PENTING: fetchUpstreamJson sudah membungkus hasil parse sebagai
    // { data: <parsedBody> } — jadi body di sini TIDAK boleh dibungkus "data"
    // lagi, kalau tidak scraper menerima struktur bersarang ganda.
    const body = url.includes('/chapters/')
      ? { content_urls: ['https://desu.pics/a.jpg'], manga_slug: 'test-manga', title: 'Ch. 1' }
      : { data: [] };
    return {
      headers: { get: () => null },
      text: async () => JSON.stringify(body),
    };
  }),
}));

// DB terpisah untuk file test ini (db.js singleton dibaca saat import)
process.env.DB_PATH = join(mkdtempSync(join(tmpdir(), 'doujintest-')), 'cap-test.db');

const { upsertPosition, countDeviceRows, getAllPositions } = await import('../lib/db.js');
const { scrapeMangaDetail, scrapeChapterImages } = await import('../lib/scraper/doujin-scraper.js');
const { fetchJSON } = await import('../lib/scraper/fetcher.js');
const app = (await import('../server.js')).default;

describe('GET /api/vpn-status guard', () => {
  it('200 untuk akses loopback (tanpa XFF)', async () => {
    const res = await request(app).get('/api/vpn-status');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('403 untuk IP publik via X-Forwarded-For (simulasi pengunjung tunnel)', async () => {
    const res = await request(app)
      .get('/api/vpn-status')
      .set('X-Forwarded-For', '203.0.113.7');
    expect(res.status).toBe(403);
  });

  it('200 bila membawa JWT Cloudflare Access meski IP bukan loopback', async () => {
    const res = await request(app)
      .get('/api/vpn-status')
      .set('X-Forwarded-For', '203.0.113.7')
      .set('Cf-Access-Jwt-Assertion', 'dummy.jwt.token');
    expect(res.status).toBe(200);
  });
});

describe('encodeURIComponent path upstream (doujinScraper)', () => {
  it('slug berisi spasi di-encode (%20)', async () => {
    await scrapeMangaDetail('a wonderful world');
    const url = vi.mocked(fetchJSON).mock.calls.at(-1)[0];
    expect(url).toContain('/manga/a%20wonderful%20world');
  });

  it('karakter % pada slug di-encode ganda (tidak mengubah struktur path)', async () => {
    await scrapeMangaDetail('a%2Fb');
    const url = vi.mocked(fetchJSON).mock.calls.at(-1)[0];
    expect(url).toContain('/manga/a%252Fb');
    // pastikan tidak ada slash liar tambahan setelah /manga/
    expect(url.split('/manga/')[1]).not.toContain('/');
  });

  it('chapter id dengan path traversal di-netralkan', async () => {
    await scrapeChapterImages('../../secret');
    const url = vi.mocked(fetchJSON).mock.calls.at(-1)[0];
    expect(url).toContain('/chapters/..%2F..%2Fsecret');
  });
});

describe('Cap 100 baris reading position per device', () => {
  it('baris device A dibuang yang tertua saat lewat 100; device B tidak tersentuh', () => {
    upsertPosition({ deviceId: 'capA', mangaSlug: 'seed', chapterId: 'c1', page: 1 });
    for (let i = 0; i < 120; i++) {
      upsertPosition({ deviceId: 'capA', mangaSlug: `m-${i}`, chapterId: `ch-${i}`, page: 1 });
    }
    upsertPosition({ deviceId: 'capB', mangaSlug: 'milik-B', chapterId: 'cb', page: 1 });

    expect(countDeviceRows('capA')).toBe(100);
    expect(countDeviceRows('capB')).toBe(1);

    const rowsA = getAllPositions({ deviceId: 'capA' });
    expect(rowsA.length).toBe(100);
    // entri terbaru (m-119) masih ada, seed tertua sudah terbuang
    expect(rowsA.some((r) => r.manga_slug === 'm-119')).toBe(true);
    expect(rowsA.some((r) => r.manga_slug === 'seed')).toBe(false);
  });
});
