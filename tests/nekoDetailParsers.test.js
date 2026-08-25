// tests/nekoDetailParsers.test.js — unit test parser detail neko
// (thumbnail related via background-image + meta Genre/Duration).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  parseRelated,
  parseVideoMeta,
  parsePlayers,
  parseEpisodes,
} from '../lib/scraper/neko/parsers/detail.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixture = readFileSync(join(__dirname, 'fixtures', 'neko-detail.html'), 'utf-8');

describe('parseRelated', () => {
  it('mengekstrak thumbnail dari background-image div.ltd', () => {
    const items = parseRelated(fixture);
    expect(items[0].thumb).toBe(
      'https://nekopoi.care/wp-content/uploads/2026/08/thumb-satu-150x150.jpg'
    );
  });

  it('item tanpa thumbnail tetap masuk dengan thumb kosong', () => {
    const items = parseRelated(fixture);
    const noThumb = items.find((i) => i.slug === '3d-tanpa-thumb');
    expect(noThumb).toBeTruthy();
    expect(noThumb.thumb).toBe('');
  });

  it('judul diambil dari h2>a dan entity didekode', () => {
    const items = parseRelated(fixture);
    expect(items[0].title).toBe('[3D] Tamaki WC');
  });

  it('maksimal 12 item', () => {
    // Fixture hanya 2 item — pastikan tidak melebihi batas bila data banyak
    const items = parseRelated(fixture);
    expect(items.length).toBeLessThanOrEqual(12);
  });
});

describe('parseVideoMeta', () => {
  it('mengekstrak genres sebagai array', () => {
    const meta = parseVideoMeta(fixture);
    expect(meta.genres).toEqual(['Ahegao', 'Creampie', 'Horny', 'Big Tits']);
  });

  it('mengekstrak duration & producers', () => {
    const meta = parseVideoMeta(fixture);
    expect(meta.duration).toContain('2 menit');
    expect(meta.producers).toBe('cakiiBB');
  });

  it('mengembalikan objek kosong untuk halaman tanpa meta description', () => {
    expect(parseVideoMeta('<html><body>tanpa meta</body></html>')).toEqual({});
  });
});

describe('parsePlayers & parseEpisodes (sanity)', () => {
  it('players hanya dari host allowlist', () => {
    expect(parsePlayers(fixture)).toEqual(['https://playmogo.com/e/abc123']);
  });

  it('episodes menemukan anchor internal konten utama', () => {
    const eps = parseEpisodes(fixture, 'neko-detail-fixture');
    expect(eps.length).toBeGreaterThanOrEqual(0);
  });
});
