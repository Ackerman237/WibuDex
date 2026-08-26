/**
 * scripts/dev/ui-check-collections.mjs — Uji anti-regresi runtime halaman
 * Library & Riwayat (browser nyata), pola gate lain.
 *
 * LIBRARY:
 *   1. Seed favorit & bookmark → kartu ter-render (2/2)
 *   2. Tombol hapus hanya di bookmark
 *   3. Pencarian menyaring; hasil kosong → empty state tampil
 *   4. See More: >6 item → hanya 6 tampak, klik memunculkan sisanya
 *
 * RIWAYAT:
 *   5. Kosong → pesan "Belum ada riwayat membaca"
 *   6. POST progress dengan deviceId halaman → kartu riwayat ter-render
 *
 * Jalankan (server harus sudah berjalan):
 *   node scripts/dev/ui-check-collections.mjs [base-url]
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

const seedItem = (i) => ({
  slug: `test-manga-${i}`,
  title: `Test Manga ${i}`,
  thumb: '',
  rating: 8,
  type: 'manga',
});

try {
  const browser = await getBrowser();
  const page = await newPage();
  await page.setViewport({ width: 1280, height: 800 });
  page.on('pageerror', (e) => browserLog.push(`[pageerror] ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error' && !m.text().includes('ERR_FAILED'))
      browserLog.push(`[console.error] ${m.text().slice(0, 120)}`);
  });

  // ════════════════════════ LIBRARY ════════════════════════
  // Seed: 8 favorit (>6 → uji see-more) + 3 bookmark, lalu reload
  await page.goto(`${base}/manga/html/library.html`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.evaluate(() => {
    const mk = (i) => ({
      slug: `test-fav-${i}`, title: `Favorit Test ${i}`, thumb: '',
      rating: 8, type: 'manga',
    });
    const favorites = Object.fromEntries([1, 2, 3, 4, 5, 6, 7, 8].map((i) => [`test-fav-${i}`, mk(i)]));
    const bookmarks = Object.fromEntries([1, 2, 3].map((i) => [`test-bm-${i}`, {
      ...mk(i), slug: `test-bm-${i}`, title: `Bookmark Test ${i}`,
    }]));
    localStorage.setItem('favorites', JSON.stringify(favorites));
    localStorage.setItem('bookmarks', JSON.stringify(bookmarks));
  });
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(
    () => document.querySelectorAll('#favoriteGrid .manga-card').length > 0,
    { timeout: 15000 }
  );

  const counts = await page.evaluate(() => ({
    fav: document.querySelectorAll('#favoriteGrid .manga-card').length,
    visibleFav: [...document.querySelectorAll('#favoriteGrid .manga-card')]
      .filter((c) => !c.classList.contains('is-hidden')).length,
    bm: document.querySelectorAll('#bookmarkGrid .manga-card').length,
    removeBtns: document.querySelectorAll('#bookmarkGrid .btn-remove-item').length,
    favRemoveBtns: document.querySelectorAll('#favoriteGrid .btn-remove-item').length,
    seeMoreShown: getComputedStyle(document.getElementById('favoriteSeeMore')).display !== 'none',
  }));
  ok('Library: 8 favorit ter-render', counts.fav === 8, `${counts.fav}`);
  ok('See More tampil (>6 item), hanya 6 kartu tampak',
     counts.seeMoreShown && counts.visibleFav === 6,
     `visible=${counts.visibleFav}`);
  ok('Library: 3 bookmark ter-render', counts.bm === 3, `${counts.bm}`);
  ok('Tombol hapus HANYA di bookmark', counts.removeBtns === 3 && counts.favRemoveBtns === 0);

  // See More memunculkan sisa kartu
  await page.click('#favoriteSeeMore');
  await new Promise((r) => setTimeout(r, 200));
  const expanded = await page.evaluate(() =>
    [...document.querySelectorAll('#favoriteGrid .manga-card')]
      .filter((c) => !c.classList.contains('is-hidden')).length
  );
  ok('SEE MORE memunculkan semua kartu', expanded === 8, `${expanded}/8`);

  // Pencarian menyaring + kosong memunculkan empty state
  await page.type('#librarySearch', 'Bookmark Test 1');
  await new Promise((r) => setTimeout(r, 300));
  const searchProbe = await page.evaluate(() => ({
    favVisible: [...document.querySelectorAll('#favoriteGrid .manga-card')]
      .filter((c) => !c.classList.contains('is-hidden')).length,
    bmVisible: [...document.querySelectorAll('#bookmarkGrid .manga-card')]
      .filter((c) => !c.classList.contains('is-hidden')).length,
    favEmptyShown: getComputedStyle(document.getElementById('favoriteEmpty')).display !== 'none',
  }));
  ok('Pencarian: favorit tersaring jadi empty state', searchProbe.favVisible === 0 && searchProbe.favEmptyShown);
  ok('Pencarian: bookmark cocok tetap tampil', searchProbe.bmVisible === 1);

  // Link tanpa underline (reset global a di tokens.css)
  const linkDeco = await page.evaluate(() =>
    getComputedStyle(document.querySelector('#favoriteEmpty a.retry-btn')).textDecorationLine
  );
  ok('Link empty-state tanpa underline', linkDeco === 'none', `deco=${linkDeco}`);
  await page.evaluate(() => {
    const s = document.getElementById('librarySearch');
    s.value = '';
    s.dispatchEvent(new Event('input', { bubbles: true }));
  });

  // ════════════════════════ RIWAYAT ════════════════════════
  await page.goto(`${base}/manga/html/history.html`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await new Promise((r) => setTimeout(r, 800));
  const emptyProbe = await page.evaluate(() =>
    document.querySelector('#historyGrid')?.textContent || ''
  );
  ok('Riwayat kosong → pesan "Belum ada riwayat membaca"',
     emptyProbe.includes('Belum ada riwayat membaca'));

  // POST satu progres dengan deviceId milik halaman
  const deviceId = await page.evaluate(() => localStorage.getItem('deviceId'));
  const postRes = await fetch(`${base}/api/progress`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-device-id': deviceId },
    body: JSON.stringify({
      mangaSlug: 'test-riwayat-manga',
      chapterId: 'test-chapter-id-1',
      page: 5,
      chapterNum: '12',
      mangaTitle: 'Manga Riwayat Test',
      coverUrl: '',
      mangaType: 'manga',
    }),
    signal: AbortSignal.timeout(30000),
  });
  const postJson = await postRes.json();
  ok('POST /api/progress sukses', postRes.ok && postJson.success === true);

  await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('.history-item', { timeout: 15000 });
  const hist = await page.evaluate(() => ({
    items: document.querySelectorAll('.history-item').length,
    title: document.querySelector('.history-title')?.textContent.trim() || '',
    meta: document.querySelector('.history-meta')?.textContent.trim() || '',
    continueBtn: Boolean(document.querySelector('.history-item .btn-continue')),
  }));
  ok('Kartu riwayat ter-render setelah POST', hist.items >= 1, `${hist.items} kartu`);
  ok('Judul & meta sesuai payload', hist.title === 'Manga Riwayat Test' &&
     /Chapter 12/.test(hist.meta), `"${hist.title}" / "${hist.meta}"`);
  ok('Tombol LANJUT BACA ada', hist.continueBtn);

  console.log('\n══════ HASIL UI-CHECK COLLECTIONS ══════');
  if (browserLog.length) {
    console.log(`Log browser (${browserLog.length}):`);
    for (const line of browserLog.slice(0, 10)) console.log(`  ${line}`);
  }
  console.log(`VERDICT: ${failures === 0 ? '✅ LOLOS' : `⚠️ GAGAL (${failures} cek)`}`);
  process.exitCode = failures === 0 ? 0 : 1;
} catch (err) {
  logger.error({ err }, 'ui-check-collections gagal');
  console.error(`[ui-check-collections] error: ${err.message}`);
  process.exitCode = 1;
} finally {
  await closeBrowser().catch(() => {});
}
