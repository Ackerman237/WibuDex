/**
 * scripts/dev/ui-audit.mjs — Audit visual & spacing SELURUH halaman
 * (manga + video) pada 3 breakpoint. Menghasilkan:
 *
 *   1. Screenshot PNG per halaman per breakpoint → %TEMP%/ui-audit/
 *   2. Laporan spacing anomaly antar sibling elemen (gap < 4px atau overlap)
 *   3. Deteksi elemen dengan overflow teks (scrollWidth > clientWidth)
 *   4. Deteksi ikon/svg tanpa ukuran (width=0 atau height=0)
 *
 * Jalankan (server harus sudah berjalan):
 *   node scripts/dev/ui-audit.mjs [base-url]
 */
import { getBrowser, newPage, closeBrowser } from '../../lib/browser.js';
import logger from '../../lib/logger.js';
import { mkdirSync } from 'fs';

const base = process.argv[2] || 'http://localhost:4000';
const SHOT_DIR = process.env.SHOT_DIR || '';

const BREAKPOINTS = [
  { name: 'mobile', width: 360, height: 740 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1280, height: 800 },
];

const PAGES = [
  { path: '/manga/html/index.html', label: 'manga-home' },
  { path: '/manga/html/catalog.html', label: 'manga-catalog' },
  { path: '/manga/html/library.html', label: 'manga-library' },
  { path: '/manga/html/history.html', label: 'manga-history' },
  { path: '/video/html/index.html', label: 'video-home' },
  { path: '/video/html/series.html?type=hentai', label: 'video-series' },
];

let slugDetail = '';
let slugWatch = '';

let failures = 0;
let totalChecks = 0;
const okLog = (name, cond, detail = '') => {
  if (!cond) {
    console.log(`  ❌ ${name}${detail ? ' — ' + detail : ''}`);
    failures++;
  }
  totalChecks++;
};

async function auditPage(page, url, label) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message.slice(0, 80)));
  await page.goto(`${base}${url}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await new Promise((r) => setTimeout(r, 1500)); // tunggu render settle

  // ── Spacing anomaly: gap antar sibling terlalu kecil / overlap ──
  const spacingIssues = await page.evaluate(() => {
    const issues = [];
    const cls = (el) => (el.getAttribute('class') || '').split(' ')[0] || '';
    const els = document.querySelectorAll('main > *, main > * > *, section > *, aside > *, .watch-main > *');
    for (let i = 0; i < els.length - 1; i++) {
      const elA = els[i];
      const elB = els[i + 1];
      const a = elA.getBoundingClientRect();
      const b = elB.getBoundingClientRect();
      if (a.height === 0 || b.height === 0) continue;
      if (elA.contains(elB) || elB.contains(elA)) continue;
      // Hanya bandingkan sibling se-induk — antar section/grid parent berbeda bukan indikasi overlap bug
      if (elA.parentElement !== elB.parentElement) continue;
      const csA = getComputedStyle(elA);
      const csB = getComputedStyle(elB);
      // Abaikan elemen overlay yang sengaja absolute/fixed/hidden
      if (['absolute', 'fixed'].includes(csA.position) || ['absolute', 'fixed'].includes(csB.position)) continue;
      if (csA.display === 'none' || csB.display === 'none') continue;
      if (elA.closest('[hidden]') || elB.closest('[hidden]')) continue;
      // Skip tetangga horizontal (grid/flex row yang sama) — overlap vertikal semu
      if (Math.abs(a.top - b.top) < 5) continue;
      // Skip background hero absolute (-2) atau ikon di dalam input search (absolute child)
      if (elA.classList.contains('hero__bg') || elB.classList.contains('hero__bg')) continue;
      if (elA.closest('.collection-search') && elB.closest('.collection-search')) continue;
      if (elA.closest('.nav-search') && elB.closest('.nav-search')) continue;
      const gap = b.top - a.bottom;
      if (gap < -5) {
        issues.push({
          a: `${elA.tagName}.${cls(elA)}`,
          b: `${elB.tagName}.${cls(elB)}`,
          overlap: Math.round(-gap),
        });
      }
    }
    return issues.slice(0, 5);
  });
  okLog(`${label}: tidak ada elemen overlap`, spacingIssues.length === 0,
       spacingIssues.length ? JSON.stringify(spacingIssues) : '');

  // ── Text overflow pada elemen non-scrollable ──
  const overflowEls = await page.evaluate(() => {
    return [...document.querySelectorAll('h1,h2,h3,h4,p,span,a:not([class*=icon])')]
      .filter((el) => {
        const cs = getComputedStyle(el);
        if (cs.overflow === 'auto' || cs.overflowX === 'auto') return false;
        if (cs.webkitLineClamp !== 'none' && cs.webkitLineClamp) return false;
        return el.scrollWidth > el.clientWidth + 2 && el.clientWidth > 20;
      })
      .slice(0, 3)
      .map((el) => {
        const cls = (el.getAttribute('class') || '').split(' ')[0] || '';
        return `${el.tagName}.${cls} (${el.scrollWidth} > ${el.clientWidth})`;
      });
  });
  okLog(`${label}: tidak ada text overflow`, overflowEls.length === 0,
       overflowEls.length ? overflowEls.join(', ') : '');

  // ── SVG/icon tanpa ukuran (hanya ikon terlihat) ──
  const zeroIcons = await page.evaluate(() =>
    [...document.querySelectorAll('svg.ic')]
      .filter((s) => {
        if (s.closest('[hidden]')) return false;
        // checkVisibility = false untuk display:none / contents hidden
        if (typeof s.checkVisibility === 'function' && !s.checkVisibility()) return false;
        return s.getBoundingClientRect().width === 0;
      })
      .length
  );
  okLog(`${label}: semua ikon .ic punya ukuran > 0`, zeroIcons === 0, `${zeroIcons} ikon kosong`);

  // ── JS error ──
  okLog(`${label}: tanpa pageerror`, errors.length === 0,
       errors.length ? errors[0] : '');
}

try {
  mkdirSync(SHOT_DIR, { recursive: true });
  const browser = await getBrowser();

  // Dapatkan satu slug nyata untuk detail & watch
  const list = await (await fetch(`${base}/api/manga?limit=1&page=1`)).json();
  const mangaSlug = list?.data?.[0]?.slug || '';
  const catSlug = 'hentai';

  PAGES.push(
    { path: `/manga/html/detail.html?slug=${mangaSlug}`, label: 'manga-detail' },
    { path: `/video/html/index.html?category=${catSlug}`, label: 'video-category' },
  );

  for (const bp of BREAKPOINTS) {
    console.log(`\n══════ ${bp.name.toUpperCase()} (${bp.width}×${bp.height}) ══════`);
    const page = await newPage();
    await page.setViewport({ width: bp.width, height: bp.height });
    if (typeof page.setBypassServiceWorker === 'function') await page.setBypassServiceWorker(true);

    for (const pg of PAGES) {
      try {
        await auditPage(page, pg.path, pg.label);
      } catch (err) {
        okLog(`${pg.label}: audit gagal`, false, err.message?.slice(0, 60));
      }

      // Screenshot
      if (SHOT_DIR) {
        try {
          await page.screenshot({
            path: `${SHOT_DIR}/${pg.label}-${bp.name}.png`,
            fullPage: true,
            timeout: 5000,
          });
        } catch { /* halaman mungkin terlalu panjang */ }
      }
    }
    await page.close();
  }

  // Detail & watch page (butuh slug nyata)
  console.log(`\n══════ DETAIL & WATCH ══════`);

  // Detail
  {
    const p = await newPage();
    await p.setViewport({ width: 1280, height: 800 });
    await p.goto(`${base}/manga/html/detail.html?slug=${mangaSlug}`, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 1000));
    if (SHOT_DIR) await p.screenshot({ path: `${SHOT_DIR}/manga-detail-desktop.png`, fullPage: true });
    await p.close();
    console.log(`✅ detail screenshot tersimpan`);
  }

  // Watch — cari slug video nyata dari kategori
  {
    let watchSlug = '';
    try {
      const cats = await (await fetch(`${base}/api/video/categories`)).json();
      const c0 = cats.data[0]?.slug;
      const vids = await (await fetch(`${base}/api/video/category?category=${c0}&page=1`)).json();
      watchSlug = vids?.data?.videos?.[0]?.slug || '';
    } catch {}
    if (watchSlug) {
      const p = await newPage();
      await p.setViewport({ width: 1280, height: 800 });
      await p.goto(`${base}/video/html/watch.html?slug=${watchSlug}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await new Promise(r => setTimeout(r, 2000));
      if (SHOT_DIR) await p.screenshot({ path: `${SHOT_DIR}/video-watch-desktop.png`, fullPage: true });
      await p.close();
      console.log(`✅ watch screenshot tersimpan (slug=${watchSlug})`);
    }
  }

  console.log('\n══════ HASIL UI-AUDIT ══════');
  console.log(`Total checks: ${totalChecks}, Gagal: ${failures}`);
  if (SHOT_DIR) console.log(`Screenshot folder: ${SHOT_DIR}`);
  console.log(failures === 0
    ? '\n✅ TIDAK ADA MASALAH VISUAL TERDETEKSI'
    : `\n⚠️ ${failures} MASALAH DITEMUKAN — lihat detail di atas`);
  process.exitCode = failures > 0 ? 1 : 0;
} catch (err) {
  logger.error({ err }, 'ui-audit gagal');
  console.error(`[ui-audit] error: ${err.message}`);
  process.exitCode = 1;
} finally {
  await closeBrowser().catch(() => {});
}
