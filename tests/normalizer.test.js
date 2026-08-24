// normalizer.test.js — Unit test offline normalisasi output API doujin.
import { describe, it, expect } from 'vitest';
import { mapListItem, mapDetail, repairMojibake } from '../lib/scraper/normalizer.js';

describe('repairMojibake', () => {
  // Fixture DIBANGUN PROGRAMATIK: byte UTF-8 dari teks Jepang asli dipetakan
  // satu-per-satu jadi karakter Latin-1 — mensimulasikan mojibake nyata
  // tanpa risiko salah ketik karakter kontrol.
  const toLatin1Mojibake = (s) =>
    [...Buffer.from(s, 'utf-8')].map((b) => String.fromCharCode(b)).join('');

  const mojibake = toLatin1Mojibake('アフリカ');

  it('memperbaiki teks UTF-8 yang ter-decode sebagai Latin-1', () => {
    expect(repairMojibake(mojibake)).toBe('アフリカ');
  });

  it('memperbaiki string campuran mojibake + sufiks ASCII', () => {
    // Byte ASCII lolos utuh di dekoder UTF-8, jadi sufiks tetap aman
    expect(repairMojibake(mojibake + ' (Official)')).toBe('アフリカ (Official)');
  });

  it('membiarkan string bersih apa adanya', () => {
    expect(repairMojibake('Manga Biasa')).toBe('Manga Biasa');
  });

  it('tidak menyentuh string ber-charakter non-Latin asli', () => {
    expect(repairMojibake('アフリカ')).toBe('アフリカ'); // charCode > 0xFF = bukan mojibake
  });

  it('toleran terhadap input non-string', () => {
    expect(repairMojibake(null)).toBe(null);
    expect(repairMojibake(undefined)).toBe(undefined);
    expect(repairMojibake(42)).toBe(42);
  });
});

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

  it('sinopsis dibersihkan dari tag HTML upstream (kasus Intern Haenyeo)', () => {
    const detail = mapDetail({
      slug: 'intern-haenyeo',
      description: '<p>Seorang haenyeo muda.</p><br>Kehidupan di pulau.<br><span>Penutup.</span>',
    });
    // Tag dibuang, <br>/</p> jadi pemisah — tidak ada "<" yang lolos ke UI
    expect(detail.synopsis).not.toContain('<');
    expect(detail.synopsis).toContain('Seorang haenyeo muda.');
    expect(detail.synopsis).toContain('Kehidupan di pulau.');
  });

  it('alt_titles mojibake diperbaiki otomatis saat normalisasi', () => {
    const mojibake = [...Buffer.from('アフリカ', 'utf-8')]
      .map((b) => String.fromCharCode(b))
      .join('');
    const detail = mapDetail({ slug: 'a', alt_titles: `${mojibake}, Alt Bersih` });
    expect(detail.altTitles[0]).toBe('アフリカ');
    expect(detail.altTitles[1]).toBe('Alt Bersih');
  });
});
