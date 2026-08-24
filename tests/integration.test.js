import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';

vi.mock('../lib/scraper/index.js', () => ({
  scrapeMangaList: vi.fn().mockResolvedValue({
    data: [{ title: 'Test Manga', slug: 'test', thumb: '', rating: 5, chapters: [] }],
    total: 1,
  }),
  scrapeMangaDetail: vi.fn().mockResolvedValue({
    title: 'Test Manga',
    slug: 'test',
    thumb: '',
    rating: 5,
    synopsis: 'Test',
    status: 'Ongoing',
    type: 'Doujinshi',
    genres: [],
    chapters: [],
  }),
  scrapeChapterImages: vi.fn().mockResolvedValue([
    { url: 'https://doujin.desu.xxx/img1.jpg', page: 1 },
  ]),
}));

vi.mock('../lib/scraper/nekoScraper.js', () => ({
  scrapeNekoList: vi.fn().mockResolvedValue({ videos: [], hasNext: false }),
  scrapeNekoCategory: vi.fn().mockResolvedValue({ videos: [], hasNext: false }),
  scrapeNekoSearch: vi.fn().mockResolvedValue({ videos: [], hasNext: false }),
  scrapeNekoDetail: vi.fn().mockResolvedValue({ title: 'Test', slug: 'test', thumb: '', players: [], synopsis: '', related: [] }),
  scrapeNekoCategories: vi.fn().mockResolvedValue([]),
  scrapeNekoSchedule: vi.fn().mockResolvedValue([]),
  scrapeNekoSeriesList: vi.fn().mockResolvedValue({ type: 'hentai', series: [], hasNext: false }),
  scrapeNekoRandom: vi.fn().mockResolvedValue({ slug: 'test', url: 'https://nekopoi.care/test/' }),
}));

import app from '../server.js';

describe('API Routes', () => {
  describe('GET /api/manga', () => {
    it('returns manga list with pagination', async () => {
      const res = await request(app).get('/api/manga?page=1&limit=10');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.pagination).toBeDefined();
      expect(res.body.pagination.page).toBe(1);
    });

    it('validates page parameter', async () => {
      const res = await request(app).get('/api/manga?page=-1');
      expect(res.status).toBe(200);
      expect(res.body.pagination.page).toBe(1);
    });
  });

  describe('GET /api/manga/detail', () => {
    it('returns manga detail', async () => {
      const res = await request(app).get('/api/manga/detail?slug=test-manga');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toBe('Test Manga');
    });

    it('returns 400 for missing slug', async () => {
      const res = await request(app).get('/api/manga/detail');
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('returns 400 for invalid slug format', async () => {
      const res = await request(app).get('/api/manga/detail?slug=manga/title/with/slashes');
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/chapter', () => {
    it('returns chapter images', async () => {
      const res = await request(app).get('/api/chapter?id=123');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('returns 400 for missing id', async () => {
      const res = await request(app).get('/api/chapter');
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/image-proxy', () => {
    it('returns 400 for missing url', async () => {
      const res = await request(app).get('/api/image-proxy');
      expect(res.status).toBe(400);
    });

    it('returns 400 for invalid url', async () => {
      const res = await request(app).get('/api/image-proxy?url=javascript:alert(1)');
      expect(res.status).toBe(400);
    });

    it('returns 400 for private host', async () => {
      const res = await request(app).get('/api/image-proxy?url=http://localhost/image.jpg');
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/video/proxy-player (dihapus)', () => {
    it('returns 404 — endpoint usang sudah dihapus', async () => {
      const res = await request(app).get('/api/video/proxy-player');
      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/video/player-mode', () => {
    it('returns mode (default filtered)', async () => {
      const res = await request(app).get('/api/video/player-mode');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(['filtered', 'direct']).toContain(res.body.data.mode);
    });
  });

  describe('GET /api/video/player-frame', () => {
    it('returns 400 for missing url', async () => {
      const res = await request(app).get('/api/video/player-frame');
      expect(res.status).toBe(400);
    });

    it('returns 400 for invalid url', async () => {
      const res = await request(app).get('/api/video/player-frame?url=javascript:alert(1)');
      expect(res.status).toBe(400);
    });

    it('returns 400 for host outside allowlist (SSRF guard)', async () => {
      const res = await request(app).get('/api/video/player-frame?url=https://evil.com/embed');
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/pf/:host/* (passthrough XHR penyedia)', () => {
    it('rejects host outside allowlist', async () => {
      const res = await request(app).get('/api/pf/evil.com/pass_md5/x');
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/video', () => {
    it('returns neko list', async () => {
      const res = await request(app).get('/api/video?page=1');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('GET /api/video/categories', () => {
    it('returns categories', async () => {
      const res = await request(app).get('/api/video/categories');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('GET /api/video/category', () => {
    it('returns 400 for missing category', async () => {
      const res = await request(app).get('/api/video/category');
      expect(res.status).toBe(400);
    });

    it('returns category results', async () => {
      const res = await request(app).get('/api/video/category?category=ecchi');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('GET /api/video/search', () => {
    it('returns 400 for missing query', async () => {
      const res = await request(app).get('/api/video/search');
      expect(res.status).toBe(400);
    });

    it('returns search results', async () => {
      const res = await request(app).get('/api/video/search?query=test');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('GET /api/video/detail', () => {
    it('returns 400 for missing slug', async () => {
      const res = await request(app).get('/api/video/detail');
      expect(res.status).toBe(400);
    });

    it('returns detail', async () => {
      const res = await request(app).get('/api/video/detail?slug=test');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('Root redirect', () => {
    it('redirects / to home page', async () => {
      const res = await request(app).get('/');
      expect(res.status).toBe(302);
    });
  });
});
