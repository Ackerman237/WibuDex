/**
 * scripts/dev/ui-check-video-home.mjs — Uji anti-regresi runtime home Neko
 * Video dengan REQUEST INTERCEPTION (offline deterministik — tidak menyentuh
 * upstream), fokus pada konsolidasi card V1.1.
 *
 *   1. Grid ter-render dari payload stub (3 kartu .video-card)
 *   2. Struktur card hasil renderMediaCard: h3.video-title + .video-date,
 *      thumb bersrc, judul ter-escape (payload mengandung <b>)
 *   3. Klik kartu → navigasi watch.html?slug=
 *   4. Pencarian (stub search) → sectionTitle berubah
 *
 * Jalankan (server harus sudah berjalan):
 *   node scripts/dev/ui-check-video-home.mjs [base-url]
 */
import { getBrowser, newPage, closeBrowser } from '../../lib/browser.js';
import logger from '../../lib/logger.js';

const base = process.argv[2] || 'http://localhost:4000';

const browserLog = [];
let failures = 0;
const ok = (name, cond, detail = '') => {
  console.log(`${cond ? '✅' : '❌'} ${name}${detail ? ` — ${detail}` : ''}`);
  if (!cond) failures += 1;
};

const STUB_VIDEOS = [
  { slug: 'stub-video-1', title: 'Video Pertama', date: '2026-08-01', thumb: '' },
  { slug: 'stub-video-2', title: '<b>Escaped</b> Title', date: '2026-08-02', thumb: '' },
  { slug: 'stub-video-3', title: 'Video Ketiga', date: '', thumb: '' },
];

try {
  const browser = await getBrowser();
  const page = await newPage();
  await page.setViewport({ width: 1280, height: 800 });
  // Service worker memicu fetch ganda (SW passthrough vs stub halaman) yang
  // membuat interception tak reliable — bypass penuh untuk pengujian.
  if (typeof page.setBypassServiceWorker === 'function') {
    await page.setBypassServiceWorker(true);
  } else {
    await page.evaluateOnNewDocument(() => {
      navigator.serviceWorker.getRegistrations().then((rs) => rs.forEach((r) => r.unregister()));
    });
  }
  page.on('pageerror', (e) => browserLog.push(`[pageerror] ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error' && !m.text().includes('ERR_FAILED') && !m.text().includes('Failed to load resource'))
      browserLog.push(`[console.error] ${m.text().slice(0, 120)}`);
  });

  // Intercept semua endpoint video API → stub offline
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    const u = req.url();
    const json = (obj) =>
      req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify(obj) });
    if (u.includes('/api/video?')) return json({ success: true, data: { videos: STUB_VIDEOS, hasNext: false } });
    if (u.includes('/api/video/search')) return json({ success: true, data: { videos: [STUB_VIDEOS[0]], hasNext: false } });
    if (u.includes('/api/video/schedule')) return json({ success: true, data: [] });
    if (u.includes('/api/video/random')) return json({ success: false, message: 'skip' });
    req.continue();
  });

  await page.goto(
    `${base}/video/html/index.html?_=${Date.now()}`, // cache-buster: SWR tak menyajikan aset lama
    { waitUntil: 'domcontentloaded', timeout: 60000 }
  );
  await page.waitForFunction(
    () => document.querySelectorAll('#videoGrid .video-card').length >= 3,
    { timeout: 15000 }
  );
  ok('Grid video ter-render dari payload stub', true, '3 kartu');

  // 0) Tema ter-unifikasi: tokens termuat + body espresso + brand amber
  const theme = await page.evaluate(() => {
    const tokLoaded = [...document.styleSheets].some((s) =>
      (s.href || '').includes('/css/wibudex-tokens.css'));
    const bg = getComputedStyle(document.body).backgroundColor;
    const brandBar = getComputedStyle(document.querySelector('header .brand-badge')).backgroundColor;
    return { tokLoaded, bg, brandBar };
  });
  ok('Tema unifikasi: tokens.css termuat', theme.tokLoaded);
  ok('Body espresso #0D0C0C', theme.bg === 'rgb(13, 12, 12)', theme.bg);
  ok('Aksen brand amber (bukan merah legacy)',
     theme.brandBar === 'rgb(217, 119, 6)', theme.brandBar);

  // Identitas: brand Wibudex + ikon modul pada nav
  const ident = await page.evaluate(() => ({
    h1: document.querySelector('header h1')?.textContent.trim() || '',
    badge: document.querySelector('header .brand-badge')?.textContent.trim() || '',
    playIconOnVideo: Boolean(document.querySelector('.nav-links a[href*="/video"] .nav-ic use')),
    bookIconOnManga: Boolean(document.querySelector('.nav-links a[href*="/manga"] .nav-ic use')),
    staleHref: Boolean(document.querySelector('.nav-links a[href="/neko/"], .nav-links a[href="/"]')),
  }));
  ok('Brand header = Wibudex + badge Video',
     ident.h1.startsWith('Wibudex') && ident.badge === 'Video',
     `"${ident.h1}" / "${ident.badge}"`);
  ok('Ikon modul di nav (play/buku) & tanpa href mati',
     ident.playIconOnVideo && ident.bookIconOnManga && !ident.staleHref);

  // 2) Struktur markup konsolidasi
  const struct = await page.evaluate(() => {
    const cards = [...document.querySelectorAll('#videoGrid .video-card')];
    return {
      allAnchor: cards.every((c) => c.tagName === 'A' && c.href.includes('/video/html/watch.html?slug=')),
      titles: cards.map((c) => c.querySelector('.video-title')?.innerHTML || ''),
      dates: cards.map((c) => c.querySelector('.video-date')?.textContent || '(kosong)'),
      thumbsWithSrc: cards.filter((c) => c.querySelector('.video-thumb')?.getAttribute('src')).length,
      literalBoldVisible: cards.some((c) => c.querySelector('.video-title b')),
    };
  });
  ok('Kartu = <a> navigasi watch.html?slug=', struct.allAnchor);
  ok('Judul ter-escape (payload <b> tampil sebagai teks)',
     !struct.literalBoldVisible && struct.titles[1].includes('&lt;b&gt;'),
     struct.titles[1]);
  ok('Tanggal kosong → baris meta tak dirender', struct.dates[2] === '(kosong)');
  ok('Semua thumb punya src (fallback placeholder)', struct.thumbsWithSrc === 3);

  // 3) Klik kartu pertama → navigasi watch
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => {}),
    page.click('#videoGrid .video-card'),
  ]);
  ok('Klik kartu → navigasi ke watch.html',
     page.url().includes('/video/html/watch.html?slug=stub-video-1'), page.url().slice(-50));

  // 4) Pencarian via form (stub search)
  await page.goto(
    `${base}/video/html/index.html?_=${Date.now()}s`, // cache-buster
    { waitUntil: 'domcontentloaded', timeout: 60000 }
  );
  await page.type('#searchInput', 'pertama');
  await page.evaluate(() =>
    document.getElementById('searchForm').dispatchEvent(new Event('submit', { bubbles: true }))
  );
  let s4 = false;
  let diag4 = '';
  for (let i = 0; i < 12 && !s4; i++) {
    await new Promise((r) => setTimeout(r, 600));
    const st = await page.evaluate(() => ({
      t: document.getElementById('sectionTitle')?.textContent || '',
      n: document.querySelectorAll('#videoGrid .video-card').length,
      err: document.querySelector('#videoGrid .error')?.textContent?.slice(0, 60) || '',
      u: location.search,
    }));
    diag4 = JSON.stringify(st);
    s4 = st.t.includes('Hasil Pencarian');
  }
  ok('Pencarian: sectionTitle berubah + hasil stub', s4, diag4.slice(0, 120));

  console.log('\n══════ HASIL UI-CHECK VIDEO HOME ══════');
  if (browserLog.length) {
    console.log(`Log browser (${browserLog.length}):`);
    for (const line of browserLog.slice(0, 10)) console.log(`  ${line}`);
  }
  console.log(`VERDICT: ${failures === 0 ? '✅ LOLOS' : `⚠️ GAGAL (${failures} cek)`}`);
  process.exitCode = failures === 0 ? 0 : 1;
} catch (err) {
  logger.error({ err }, 'ui-check-video-home gagal');
  console.error(`[ui-check-video-home] error: ${err.message}`);
  process.exitCode = 1;
} finally {
  await closeBrowser().catch(() => {});
}
