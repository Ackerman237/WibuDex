/**
 * scripts/dev/ui-check-video-watch.mjs — Uji anti-regresi runtime watch page
 * Neko Video (offline via request interception).
 *
 *   1. Sidebar episode ter-render dari stub (validasi konsolidasi card V1.1)
 *   2. Related sidebar ter-render
 *   3. Theater mode: toggle → layout.theater-mode + sidebar hilang
 *   4. Theater persisten setelah reload (localStorage)
 *
 * Jalankan (server harus sudah berjalan):
 *   node scripts/dev/ui-check-video-watch.mjs [base-url]
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

const STUB_DETAIL = {
  title: 'Stub Video untuk Gate',
  slug: 'stub-gate-video',
  thumb: 'https://nekopoi.care/wp-content/uploads/2026/08/stub-main.jpg',
  synopsis: '<p>Sinopsis stub.</p>',
  players: [],
  genres: ['Ahegao', 'Comedy', 'Fantasy'],
  duration: '16 menit',
  episodes: [
    { slug: 'stub-ep-1', title: 'Episode Pertama', number: '1', thumb: 'https://nekopoi.care/wp-content/uploads/2026/08/stub-ep1.jpg' },
    { slug: 'stub-ep-2', title: 'Episode Kedua', number: '2', thumb: 'https://nekopoi.care/wp-content/uploads/2026/08/stub-ep2.jpg' },
    { slug: 'stub-ep-3', title: 'Episode Ketiga', number: '3', thumb: '' },
  ],
  related: [
    { slug: 'stub-rel-1', title: 'Terkait Satu', type: 'Hentai', thumb: 'https://nekopoi.care/wp-content/uploads/2026/08/stub-rel1.jpg' },
    { slug: 'stub-rel-2', title: 'Terkait Dua', type: 'JAV', thumb: '' },
  ],
};

try {
  const browser = await getBrowser();
  const page = await newPage();
  await page.setViewport({ width: 1280, height: 800 });
  if (typeof page.setBypassServiceWorker === 'function') {
    await page.setBypassServiceWorker(true);
  }
  page.on('pageerror', (e) => browserLog.push(`[pageerror] ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error' && !m.text().includes('ERR_FAILED'))
      browserLog.push(`[console.error] ${m.text().slice(0, 120)}`);
  });

  await page.setRequestInterception(true);
  page.on('request', (req) => {
    const u = req.url();
    const json = (obj) =>
      req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify(obj) });
    if (u.includes('/api/video/detail')) return json({ success: true, data: STUB_DETAIL });
    return req.continue();
  });

  await page.goto(
    `${base}/video/html/watch.html?slug=stub-gate-video&_=${Date.now()}`,
    { waitUntil: 'domcontentloaded', timeout: 60000 }
  );

  // 1) Sidebar episode ter-render (konsolidasi card V1.1 di watch)
  await page.waitForFunction(
    () => document.querySelectorAll('#episodeList .episode-card').length >= 3,
    { timeout: 15000 }
  );
  ok('Sidebar episode ter-render (3 kartu)', true);

  // 2) Related ter-render
  const relCount = await page.evaluate(
    () => document.querySelectorAll('#episodeList .episode-card').length
  );
  ok('Sidebar gabungan (episode + related) ter-render',
     relCount >= 5, `${relCount} kartu`);

  // Duplikat bawah player sudah dihapus (hanya sidebar)
  const dupGone = await page.evaluate(() =>
    !document.getElementById('episodesMobile') && !document.getElementById('relatedMobile')
  );
  ok('Tanpa duplikat episode/related di bawah player', dupGone);

  // 2b) Thumbnail kartu memakai URL dari payload (bukan kosong) + genre chips
  const thumbs = await page.evaluate(() => ({
    withStub: [...document.querySelectorAll('#episodeList .episode-thumb')]
      .filter((i) => (i.getAttribute('src') || '').includes('stub-')).length,
    genres: [...document.querySelectorAll('#watchGenres .genre-chip')].map((c) => c.textContent.trim()),
  }));
  // Ekspektasi stub: ep1/ep2/rel1 ber-thumb; ep3 & rel2 sengaja kosong
  ok('Thumbnail episode & related memakai URL stub',
     thumbs.withStub === 3, `${thumbs.withStub}/5`);
  ok('Genre chips dirender (3)', thumbs.genres.length === 3, JSON.stringify(thumbs.genres));

  // 3) Theater toggle
  await page.click('#theaterToggleBtn');
  await new Promise((r) => setTimeout(r, 300));
  const on = await page.evaluate(() => ({
    cls: document.querySelector('.watch-layout')?.classList.contains('theater-mode'),
    sidebarHidden: getComputedStyle(document.querySelector('.watch-sidebar')).display === 'none',
    pressed: document.getElementById('theaterToggleBtn')?.getAttribute('aria-pressed') === 'true',
  }));
  ok('Theater ON → layout.theater-mode + sidebar hilang',
     on.cls && on.sidebarHidden && on.pressed);

  // 4) Persisten setelah reload
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('#theaterToggleBtn', { timeout: 15000 });
  await new Promise((r) => setTimeout(r, 300));
  const persisted = await page.evaluate(() => ({
    cls: document.querySelector('.watch-layout')?.classList.contains('theater-mode'),
    label: document.getElementById('theaterToggleBtn')?.textContent.trim(),
  }));
  ok('Theater persisten setelah reload',
     persisted.cls && /Keluar/i.test(persisted.label || ''), persisted.label);

  // Keluar theater agar state bersih untuk run berikutnya
  await page.click('#theaterToggleBtn');
  await new Promise((r) => setTimeout(r, 200));

  console.log('\n══════ HASIL UI-CHECK VIDEO WATCH ══════');
  if (browserLog.length) {
    console.log(`Log browser (${browserLog.length}):`);
    for (const line of browserLog.slice(0, 10)) console.log(`  ${line}`);
  }
  console.log(`VERDICT: ${failures === 0 ? '✅ LOLOS' : `⚠️ GAGAL (${failures} cek)`}`);
  process.exitCode = failures === 0 ? 0 : 1;
} catch (err) {
  logger.error({ err }, 'ui-check-video-watch gagal');
  console.error(`[ui-check-video-watch] error: ${err.message}`);
  process.exitCode = 1;
} finally {
  await closeBrowser().catch(() => {});
}
