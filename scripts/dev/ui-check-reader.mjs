/**
 * scripts/dev/ui-check-reader.mjs — Uji anti-regresi runtime halaman reader
 * (browser nyata), pola ui-check-catalog/detail.
 *
 *   1. Topbar ter-render di #info dengan judul seri & label chapter
 *   2. Halaman chapter dibuat + 10 halaman pertama langsung diberi src
 *   3. Bottombar 5 tombol
 *   4. Drawer daftar chapter buka/tutup + item current ditandai
 *   5. Panel pengaturan: slider lebar mengubah --page-w
 *   6. Auto-hide chrome saat scroll; tap area baca memunculkan kembali
 *   7. Elemen progress halaman ada
 *
 * Jalankan (server harus sudah berjalan):
 *   node scripts/dev/ui-check-reader.mjs [base-url]
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

async function api(path) {
  const r = await fetch(`${base}${path}`, { signal: AbortSignal.timeout(30000) });
  return r.json();
}

try {
  // Pilih manga yang punya ≥2 chapter agar prev/next & drawer bermakna
  const list = await api('/api/manga?limit=10&page=1');
  let chosen = null;
  for (const m of list?.data || []) {
    try {
      const d = await api(`/api/manga/detail?slug=${encodeURIComponent(m.slug)}`);
      const chs = Array.isArray(d?.data?.chapters) ? d.data.chapters : [];
      const withId = chs.filter((c) => c.id || c.chapter_id);
      if (withId.length >= 2) {
        chosen = { slug: m.slug, chapterId: String(withId[0].id || withId[0].chapter_id) };
        break;
      }
    } catch { /* coba kandidat berikutnya */ }
  }
  if (!chosen) throw new Error('tidak ada manga dengan ≥2 chapter');
  console.log(`[ui-check-reader] uji: ${chosen.slug} ch=${chosen.chapterId}`);

  const browser = await getBrowser();
  const page = await newPage();
  await page.setViewport({ width: 1280, height: 800 });
  page.on('pageerror', (e) => browserLog.push(`[pageerror] ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error' && !m.text().includes('ERR_FAILED'))
      browserLog.push(`[console.error] ${m.text().slice(0, 120)}`);
  });

  await page.goto(
    `${base}/manga/html/reader.html?id=${encodeURIComponent(chosen.chapterId)}`,
    { waitUntil: 'domcontentloaded', timeout: 60000 }
  );

  // 1) Topbar ter-render
  await page.waitForFunction(() => Boolean(document.querySelector('#info .reader-topbar')), {
    timeout: 45000,
  });
  const tb = await page.evaluate(() => ({
    series: document.getElementById('readerSeriesTitle')?.textContent || '',
    chapter: document.getElementById('readerChapterLabel')?.textContent || '',
    homeBtn: Boolean(document.querySelector('.reader-topbar .reader-tb-btn[href]')),
  }));
  ok('Topbar ter-render + judul & label chapter', tb.series.length > 1 && tb.chapter.length > 1,
     `"${tb.series}" / "${tb.chapter}"`);
  ok('Tombol beranda di topbar', tb.homeBtn);

  // 2) Halaman dibuat + initial pages diberi src
  await page.waitForFunction(() => document.querySelectorAll('.reader-page').length > 0, {
    timeout: 30000,
  });
  const pagesProbe = await page.evaluate(() => {
    const imgs = [...document.querySelectorAll('.reader-pages img')];
    return {
      pages: document.querySelectorAll('.reader-page').length,
      withSrc: imgs.filter((i) => i.getAttribute('src')).length,
      skeletons: document.querySelectorAll('.reader-page-skeleton').length,
    };
  });
  ok('Halaman chapter dibuat', pagesProbe.pages > 0, `${pagesProbe.pages} halaman`);
  ok('10 halaman pertama langsung diberi src (loadInitialPages)', pagesProbe.withSrc > 0,
     `${pagesProbe.withSrc} img bersrc`);

  // 3) Bottombar 5 tombol
  const bbCount = await page.evaluate(
    () => document.querySelectorAll('.reader-bottombar .reader-bb-btn').length
  );
  ok('Bottombar 5 tombol', bbCount === 5, `${bbCount} tombol`);

  // 6a) Auto-hide saat scroll
  await page.evaluate(() => {
    window.scrollTo(0, 600);
    window.dispatchEvent(new Event('scroll'));
  });
  await new Promise((r) => setTimeout(r, 400));
  const hiddenAfterScroll = await page.evaluate(() =>
    document.querySelector('.reader-topbar')?.classList.contains('is-hidden')
  );
  ok('Chrome auto-hide saat scroll', hiddenAfterScroll === true);

  // 6b) Tap area baca memunculkan chrome kembali
  await page.evaluate(() => document.querySelector('.reader-pages').click());
  await new Promise((r) => setTimeout(r, 400));
  const shownAfterTap = await page.evaluate(() =>
    !document.querySelector('.reader-topbar')?.classList.contains('is-hidden')
  );
  ok('Tap area baca memunculkan chrome', shownAfterTap === true);

  // 7) Progress element
  const progressEl = await page.evaluate(() => Boolean(document.querySelector('.reader-progress')));
  ok('Elemen progress halaman ada', progressEl);

  // 4) Drawer buka/tutup
  await page.click('.reader-bottombar .reader-bb-btn:nth-child(4)');
  await new Promise((r) => setTimeout(r, 400));
  const drawerOpen = await page.evaluate(() => ({
    open: document.querySelector('.reader-drawer')?.classList.contains('is-open'),
    backdrop: document.querySelector('.reader-drawer-backdrop')?.classList.contains('is-open'),
    items: document.querySelectorAll('.reader-drawer-item').length,
    current: document.querySelectorAll('.reader-drawer-item.is-current').length,
  }));
  ok('Drawer daftar chapter terbuka', drawerOpen.open && drawerOpen.backdrop);
  ok('Item chapter terisi + current ditandai',
     drawerOpen.items > 0 && drawerOpen.current === 1,
     `${drawerOpen.items} item, current=${drawerOpen.current}`);
  await page.click('.reader-drawer-close');
  await new Promise((r) => setTimeout(r, 400));
  const drawerClosed = await page.evaluate(() =>
    !document.querySelector('.reader-drawer')?.classList.contains('is-open')
  );
  ok('Drawer tertutup lewat tombol X', drawerClosed);

  // 5) Settings: slider lebar mengubah --page-w
  // (evaluate-click: bebas flakiness hit-test saat transisi backdrop)
  await page.evaluate(() =>
    document.querySelectorAll('.reader-bottombar .reader-bb-btn')[1].click()
  );
  await new Promise((r) => setTimeout(r, 500));
  const settingsOpen = await page.evaluate(() =>
    document.querySelector('.reader-settings-panel')?.classList.contains('is-open')
  );
  ok('Panel pengaturan terbuka', settingsOpen === true);
  await page.evaluate(() => {
    const input = document.querySelector('.reader-settings-panel input[type="range"]');
    input.value = '60';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await new Promise((r) => setTimeout(r, 200));
  const pageW = await page.evaluate(() =>
    document.querySelector('.reader-pages').style.getPropertyValue('--page-w')
  );
  ok('Slider lebar mengubah --page-w', pageW === '60%', `--page-w=${pageW}`);
  await page.evaluate(() =>
    document.querySelector('.reader-settings-panel .reader-drawer-close').click()
  );

  console.log('\n══════ HASIL UI-CHECK READER ══════');
  if (browserLog.length) {
    console.log(`Log browser (${browserLog.length}):`);
    for (const line of browserLog.slice(0, 10)) console.log(`  ${line}`);
  }
  console.log(`VERDICT: ${failures === 0 ? '✅ LOLOS' : `⚠️ GAGAL (${failures} cek)`}`);
  process.exitCode = failures === 0 ? 0 : 1;
} catch (err) {
  logger.error({ err }, 'ui-check-reader gagal');
  console.error(`[ui-check-reader] error: ${err.message}`);
  process.exitCode = 1;
} finally {
  await closeBrowser().catch(() => {});
}
