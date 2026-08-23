// normalizer.test.js — Unit test offline normalisasi output API doujin.
import { describe, it, expect } from 'vitest';
import { mapListItem, mapDetail } from '../lib/scraper/normalizer.js';

describe('mapListItem', () => {
  it('memetakan field dasar dan resolve URL cover relatif', () => {
    const item = mapListItem({
      title: '  Manga A ',
      slug: 'manga-a',
      cover_url: '/covers/manga-a.jpg',
      rating: 4.5,
      type: 'manga',
      chapters: [{ id: 7, chapter_number: 3, created_at: '2026-01-15T00:00:00Z' }],
    });
    expect(item.title).toBe('  Manga A '); // title tidak di-trim (kontrak lama)
    expect(item.thumb).toBe('https://doujin.desu.xxx/covers/manga-a.jpg');
    expect(item.chapters[0].number).toBe(3);
    expect(item.chapters[0].id).toBe(7);
    expect(typeof item.chapters[0].date).toBe('string');
  });

  it('menolak URL cover dari host non-allowlist (safeImageUrl)', () => {
    const item = mapListItem({ title: 'X', slug: 'x', cover_url: 'https://evil.com/x.jpg' });
    expect(item.thumb).toBe('');
  });

  it('toleran terhadap null/tipe salah', () => {
    const item = mapListItem(null);
    expect(item.title).toBe('');
    expect(item.thumb).toBe('');
    expect(item.chapters).toEqual([]);
  });
});

describe('mapDetail', () => {
  it('memetakan field lengkap termasuk fallback author & altTitles', () => {
    const detail = mapDetail({
      title: 'Manga B',
      slug: 'manga-b',
      cover_url: '/b.jpg',
      alt_titles: 'Alt Satu, Alt Dua',
      description: 'Sinopsis',
      status: 'ongoing',
      author: { name: 'Pengarang X' },
      manga_genres: [{ genres: { name: 'Romance' } }, { name: 'Drama' }, {}],
      views: 'not-a-number',
      chapters: [],
    });
    expect(detail.altTitles).toEqual(['Alt Satu', 'Alt Dua']);
    expect(detail.author).toBe('Pengarang X');
    expect(detail.genres).toEqual(['Romance', 'Drama']);
    expect(detail.views).toBe(0); // string non-numerik -> 0
    expect(detail.synopsis).toBe('Sinopsis');
  });

  it('fallback thumb berantai: cover_url -> cover -> thumbnail', () => {
    expect(mapDetail({ slug: 'a', cover: '/c1.jpg' }).thumb).toContain('/c1.jpg');
    expect(mapDetail({ slug: 'a', thumbnail: '/c2.jpg' }).thumb).toContain('/c2.jpg');
    expect(mapDetail({ slug: 'a' }).thumb).toBe('');
  });
});
