// nekoFeatures.test.js — Unit test offline untuk fitur nekopoi baru:
// jadwal, daftar seri, random, dan related videos di detail.
// Semua fetch di-stub — tidak ada network call.

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/vpn/vpn-manager.js', () => ({
  ensureVpn: vi.fn(async () => ({ provider: null })),
  reportFailure: vi.fn(),
  reportSuccess: vi.fn(),
}));

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

import {
  scrapeNekoSchedule,
  scrapeNekoSeriesList,
  scrapeNekoRandom,
  scrapeNekoDetail,
  decodeEntities,
  _clearNekoCacheForTests,
} from '../lib/scraper/neko-scraper.js';

function htmlResponse(body) {
  return {
    ok: true,
    status: 200,
    text: async () => body,
  };
}

beforeEach(() => {
  fetchMock.mockReset();
  _clearNekoCacheForTests();
});

describe('scrapeNekoSchedule', () => {
  it('mengelompokkan seri per status (Akan Datang/Sudah Lewat) sesuai struktur baru upstream', async () => {
    fetchMock.mockResolvedValueOnce(
      htmlResponse(`
        <html><body>
          <h2>Hentai Yang Akan Datang</h2>
          <a href="https://nekopoi.care/hentai/anime-a/"><img src="https://nekopoi.care/a.jpg" alt="Anime A"></a>
          <a href="https://nekopoi.care/hentai/anime-c/">Anime C</a>
          <h3>Hentai Yang Sudah Lewat</h3>
          <a href="https://nekopoi.care/hentai/anime-b/">Anime B</a>
          <a href="https://nekopoi.care/category/hentai/">Kategori (harus diabaikan)</a>
        </body></html>
      `)
    );

    const groups = await scrapeNekoSchedule();

    expect(groups).toHaveLength(2);
    expect(groups[0].day).toBe('Akan Datang');
    expect(groups[0].series.map((s) => s.slug)).toEqual(['anime-a', 'anime-c']);
    expect(groups[0].series[0].title).toBe('Anime A');
    expect(groups[0].series[0].thumb).toContain('a.jpg');
    expect(groups[1].day).toBe('Sudah Lewat');
    expect(groups[1].series[0].slug).toBe('anime-b');
  });

  it('tidak menghasilkan grup kosong', async () => {
    fetchMock.mockResolvedValueOnce(
      htmlResponse(`
        <html><body>
          <h2>Hentai Yang Akan Datang</h2>
          <p>Tidak ada konten.</p>
        </body></html>
      `)
    );

    const groups = await scrapeNekoSchedule();
    expect(groups).toHaveLength(0);
  });
});

describe('scrapeNekoSeriesList', () => {
  it('mem-parse item dari halaman hentai-list (struktur nk-search-item)', async () => {
    fetchMock.mockResolvedValueOnce(
      htmlResponse(`
        <html><body>
          <a href="https://nekopoi.care/hentai/series-one/" class="nk-search-item">
            <div class="nk-search-thumb" style="background-image: url('https://nekopoi.care/s1.jpg')"></div>
            <div class="nk-search-info">
              <h2>Series One</h2>
              <p class="nk-search-desc">Deskripsi seri satu.</p>
            </div>
          </a>
        </body></html>
      `)
    );

    const result = await scrapeNekoSeriesList('hentai', 1);

    expect(result.type).toBe('hentai');
    expect(result.series).toHaveLength(1);
    expect(result.series[0].title).toBe('Series One');
    expect(result.series[0].slug).toBe('series-one');
  });

  it('menolak type selain hentai/jav', async () => {
    await expect(scrapeNekoSeriesList('doujin', 1)).rejects.toThrow('hentai atau jav');
  });

  it('menggunakan path page untuk halaman > 1', async () => {
    fetchMock.mockResolvedValueOnce(htmlResponse('<html><body>kosong</body></html>'));

    await scrapeNekoSeriesList('jav', 2);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const calledUrl = fetchMock.mock.calls[0][0];
    expect(calledUrl).toContain('/jav-list/page/2/');
  });
});

describe('scrapeNekoDetail - halaman seri (fallback episode)', () => {
  it('mengembalikan episodes terisi saat tidak ada iframe player', async () => {
    fetchMock.mockResolvedValueOnce(
      htmlResponse(`
        <html><head><title>The Sleazy Family &#8211; NekoPoi</title>
        <meta property="og:image" content="https://nekopoi.care/img/sleazy.jpg"></head>
        <body>
          <div class="entry-content">
            <p>Sinopsis seri panjang lebih dari empat puluh karakter untuk pengujian.</p>
            <a href="https://nekopoi.care/the-sleazy-family-episode-1/">The Sleazy Family Episode 1</a>
            <a href="https://nekopoi.care/the-sleazy-family-episode-2/">The Sleazy Family Episode 2</a>
          </div>
          <h3>Direkomendasikan</h3>
          <a href="https://nekopoi.care/hentai/other-show/"><img src="https://nekopoi.care/o.jpg" alt="Other Show"></a>
          <a href="https://nekopoi.care/category/hentai/">Kategori (harus diabaikan)</a>
          <a href="https://nekopoi.care/the-sleazy-family/">Self link (harus diabaikan)</a>
        </body></html>
      `)
    );

    const detail = await scrapeNekoDetail('the-sleazy-family');

    expect(detail.players).toHaveLength(0);
    expect(detail.episodes.length).toBeGreaterThanOrEqual(2);
    const slugs = detail.episodes.map((e) => e.slug);
    expect(slugs).toContain('the-sleazy-family-episode-1');
    expect(slugs).toContain('the-sleazy-family-episode-2');
    // Self, kategori, dan blok related tidak masuk daftar episode
    expect(slugs).not.toContain('the-sleazy-family');
    expect(slugs).not.toContain('other-show');
  });

  it('tetap mengembalikan players saat iframe host allowlist ada', async () => {
    fetchMock.mockResolvedValueOnce(
      htmlResponse(`
        <html><head><title>Single Video &#8211; NekoPoi</title></head>
        <body>
          <iframe src="https://playmogo.com/embed/abc123"></iframe>
        </body></html>
      `)
    );

    const detail = await scrapeNekoDetail('single-video-test');

    expect(detail.players).toHaveLength(1);
    expect(detail.players[0]).toContain('playmogo.com');
  });
});

describe('scrapeNekoRandom', () => {
  it('mengembalikan slug dari Location header redirect /random', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 302,
      headers: { get: (name) => (name.toLowerCase() === 'location' ? 'https://nekopoi.care/hentai/random-pick/' : null) },
    });

    const result = await scrapeNekoRandom();

    expect(result.slug).toBe('random-pick');
    expect(result.url).toBe('https://nekopoi.care/hentai/random-pick/');
    // Harus pakai redirect manual agar redirect tidak diikuti otomatis
    expect(fetchMock.mock.calls[0][1].redirect).toBe('manual');
  });

  it('melempar error jika redirect tidak menghasilkan post', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 302,
      headers: { get: () => '/' },
    });

    await expect(scrapeNekoRandom()).rejects.toThrow('random');
  });
});

describe('decodeEntities (regresi BUG-1)', () => {
  it('men-decode &amp; &quot; &#039; dan &nbsp; dengan benar', () => {
    expect(decodeEntities('A &amp; B')).toBe('A & B');
    expect(decodeEntities('&quot;Judul&quot;')).toBe('"Judul"');
    expect(decodeEntities('It&#039;s')).toBe("It's");
    expect(decodeEntities('It&#39;s')).toBe("It's");
    expect(decodeEntities('spasi&nbsp;jarak')).toBe('spasi jarak');
  });

  it('tidak double-decode entity berantai', () => {
    // "&amp;quot;" harus menjadi "&quot;", bukan '"'
    expect(decodeEntities('&amp;quot;')).toBe('&quot;');
  });

  it('men-decode entity numerik tanda baca', () => {
    expect(decodeEntities('A &#8211; B')).toBe('A \u2013 B');
    expect(decodeEntities('apa&#8230;')).toBe('apa\u2026');
  });
});
