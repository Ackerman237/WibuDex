/**
 * scripts/dev/ui-check-detail.mjs — Uji anti-regresi runtime halaman detail
 * manga (browser nyata), mengikuti pola ui-check-catalog.mjs.
 *
 *   1. Layout ter-render (display:grid, judul terisi)
 *   2. Genre chips ada
 *   3. Chapter list terisi; jumlah sinkron dengan badge
 *   4. Pencarian chapter memfilter
 *   5. Toggle bookmark bekerja dua arah
 *   6. Toggle favorit (.is-active)
 *   7. Tab More Series ↔ Detail Info
 *   8. Tema dinamis cover: --cover-accent ter-set (signature sekunder)
 *
 * Jalankan (server harus sudah berjalan):
 *   node scripts/dev/ui-check-detail.mjs [base-url]
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

try {
  // Ambil satu slug nyata untuk pengujian
  const res = await fetch(`${base}/api/manga?limit=1&page=1`, { signal: AbortSignal.timeout(30000) });
  const json = await res.json();
  const slug = json?.data?.[0]?.slug;
  if (!slug) throw new Error('tidak ada slug dari /api/manga');
  console.log(`[ui-check-detail] uji dengan slug: ${slug}`);

  const browser = await getBrowser();
  const page = await newPage();
  page.on('pageerror', (e) => browserLog.push(`[pageerror] ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error' && !m.text().includes('ERR_FAILED'))
      browserLog.push(`[console.error] ${m.text().slice(0, 120)}`);
  });

  await page.goto(
    `${base}/manga/html/detail.html?slug=${encodeURIComponent(slug)}`,
    { waitUntil: 'domcontentloaded', timeout: 60000 }
  );

  // 1) Layout ter-render
  await page.waitForFunction(
    () => {
      const layout = document.getElementById('detailLayout');
      return layout && getComputedStyle(layout).display === 'grid' &&
        (document.getElementById('mTitle')?.textContent || '').length > 1;
    },
    { timeout: 45000 }
  );
  ok('Layout detail ter-render (grid) + judul terisi', true);

  // 2) Genre chips
  const genreCount = await page.evaluate(
    () => document.querySelectorAll('#genreTags .genre-tag').length
  );
  ok('Genre chips dirender', genreCount > 0, `${genreCount} chip`);

  // 3) Chapter rows + badge sinkron
  await page.waitForFunction(() => document.querySelectorAll('.chapter-row').length > 0, {
    timeout: 30000,
  });
  const chapSync = await page.evaluate(() => ({
    rows: document.querySelectorAll('.chapter-row').length,
    badge: Number(document.getElementById('chapterCount')?.textContent || -1),
  }));
  ok('Chapter list terisi + badge sinkron', chapSync.rows > 0 && chapSync.badge === chapSync.rows,
     `rows=${chapSync.rows}, badge=${chapSync.badge}`);

  // 4) Pencarian chapter memfilter
  await page.type('#chapterSearch', '1');
  await new Promise((r) => setTimeout(r, 300));
  const filtered = await page.evaluate(() => ({
    rows: document.querySelectorAll('.chapter-row').length,
    badge: Number(document.getElementById('chapterCount')?.textContent || -1),
  }));
  ok('Pencarian chapter memfilter', filtered.badge >= 0 && filtered.badge <= chapSync.rows,
     `${chapSync.rows} → ${filtered.badge}`);
  await page.evaluate(() => { document.getElementById('chapterSearch').value = ''; });
  await page.evaluate(() =>
    document.getElementById('chapterSearch').dispatchEvent(new Event('input', { bubbles: true }))
  );
  await new Promise((r) => setTimeout(r, 200));

  // 5) Bookmark toggle dua arah — sumber kebenaran: localStorage + label.
  // Klik memakai evaluate() agar bebas flakiness hit-test puppeteer;
  // DI SISI ITU kita tetap audit apakah ada elemen yang menghalangi tombol
  // secara nyata (elementFromPoint) — kalau ya, itu bug overlay sungguhan.
  const hitProbe = await page.evaluate(() => {
    const b = document.getElementById('bookmarkBtn');
    // Posisikan seperti pandangan user: tengah viewport, bukan nempel
    // tepi atas tempat nav sticky wajar menutupi
    b.scrollIntoView({ block: 'center', behavior: 'instant' });
    const r = b.getBoundingClientRect();
    const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return {
      interceptor: el ? `${el.tagName}#${el.id || '-'}${typeof el.className === 'string' ? '.' + el.className.split(' ')[0] : ''}` : 'none',
      intercepted: !(el === b || b.contains(el)),
    };
  });
  console.log(`   [diag] hit-test bookmarkBtn → ${JSON.stringify(hitProbe)}`);
  ok('BookmarkBtn tidak tertutup elemen lain', !hitProbe.intercepted, hitProbe.interceptor);

  const readBookmarkState = () =>
    page.evaluate(() => ({
      stored: Object.keys(JSON.parse(localStorage.getItem('bookmarks') || '{}')).length > 0,
      label: document.getElementById('bookmarkBtn')?.textContent || '',
    }));
  await page.evaluate(() => document.getElementById('bookmarkBtn').click());
  await new Promise((r) => setTimeout(r, 200));
  let bm = await readBookmarkState();
  ok('Bookmark ON', bm.stored && /BOOKMARKED/i.test(bm.label), JSON.stringify(bm));
  await page.evaluate(() => document.getElementById('bookmarkBtn').click());
  await new Promise((r) => setTimeout(r, 200));
  bm = await readBookmarkState();
  ok('Bookmark OFF (toggle balik)', !bm.stored && !/BOOKMARKED/i.test(bm.label), JSON.stringify(bm));

  // 6) Favorit toggle
  await page.click('#favoriteBtn');
  let favActive = await page.evaluate(() =>
    document.getElementById('favoriteBtn')?.classList.contains('is-active')
  );
  ok('Favorit ON (.is-active)', favActive === true);
  await page.click('#favoriteBtn');
  favActive = await page.evaluate(() =>
    document.getElementById('favoriteBtn')?.classList.contains('is-active')
  );
  ok('Favorit OFF (toggle balik)', favActive === false);

  // 7) Tab More Series → rekomendasi tampil; kembali ke Detail Info
  await page.click('#tabMoreSeries');
  await new Promise((r) => setTimeout(r, 1200)); // ruang fetch rekomendasi
  let recVisible = await page.evaluate(
    () => document.getElementById('recommendSection')?.style.display !== 'none'
  );
  ok('Tab More Series menampilkan rekomendasi', recVisible);
  await page.click('#tabInfo');
  recVisible = await page.evaluate(
    () => document.getElementById('recommendSection')?.style.display !== 'none'
  );
  ok('Tab Detail Info menyembunyikan rekomendasi', !recVisible);

  // 8) Tema dinamis cover — var --cover-accent ter-set (cache atau komputasi)
  await page
    .waitForFunction(
      () => document.documentElement.style.getPropertyValue('--cover-accent').trim() !== '',
      { timeout: 25000 }
    )
    .then(() => ok('Tema dinamis cover aktif (--cover-accent ter-set)', true))
    .catch(() => ok('Tema dinamis cover aktif (--cover-accent ter-set)', false));

  console.log('\n══════ HASIL UI-CHECK DETAIL ══════');
  if (browserLog.length) {
    console.log(`Log browser (${browserLog.length}):`);
    for (const line of browserLog.slice(0, 10)) console.log(`  ${line}`);
  }
  console.log(`VERDICT: ${failures === 0 ? '✅ LOLOS' : `⚠️ GAGAL (${failures} cek)`}`);
  process.exitCode = failures === 0 ? 0 : 1;
} catch (err) {
  logger.error({ err }, 'ui-check-detail gagal');
  console.error(`[ui-check-detail] error: ${err.message}`);
  process.exitCode = 1;
} finally {
  await closeBrowser().catch(() => {});
}
