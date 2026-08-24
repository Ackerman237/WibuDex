/**
 * scripts/dev/ui-check-catalog.mjs — Uji anti-regresi runtime halaman katalog
 * manga (browser nyata). Melahirkan dari postmortem 2026-08-24:
 *
 *   1. Dropdown kustom TERBUKA nyata?  → panel .fdrop__panel visible saat
 *      trigger diklik (regresi: atribut hidden tak pernah dilepas)
 *   2. Panel di dalam viewport?        → position fixed + clamp bekerja
 *      (regresi: rail scroll mengklip keturunan absolut)
 *   3. Pilih opsi → navigasi URL?      → dispatch 'change' asli bekerja,
 *      listener catalog.js ikut (goToPage via ?sort=...)
 *   4. Mobile 360px: hamburger & searchbar SATU BARIS dengan logo?
 *      (regresi: flex-basis auto dari lebar intrinsik input)
 *   5. Multi-genre: toggle 2 opsi → Terapkan → URL ?genre=a,b
 *   6. Multi-genre: pilihan ke-7 ditolak + peringatan tampil
 *   7. Badge jumlah genre ter-render di trigger ("2")
 *   8. Judul seksi memakai nama genre (bukan slug)
 *
 * Jalankan (server harus sudah berjalan):
 *   node scripts/dev/ui-check-catalog.mjs [base-url]
 */
import { getBrowser, newPage, closeBrowser } from '../../lib/browser.js';
import logger from '../../lib/logger.js';

const base = process.argv[2] || 'http://localhost:4000';
const url = `${base}/manga/html/catalog.html`;

const browserLog = [];
let failures = 0;
const ok = (name, cond, detail = '') => {
  console.log(`${cond ? '✅' : '❌'} ${name}${detail ? ` — ${detail}` : ''}`);
  if (!cond) failures += 1;
};

try {
  const browser = await getBrowser();
  const page = await newPage();
  page.on('pageerror', (e) => browserLog.push(`[pageerror] ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') browserLog.push(`[console.error] ${m.text().slice(0, 120)}`);
  });

  // ── Desktop ──────────────────────────────────────────────────────────
  await page.setViewport({ width: 1280, height: 800 });
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('.fdrop__trigger', { timeout: 15000 });

  // 1) Klik trigger pertama → panel harus benar-benar terlihat
  await page.click('.fdrop__trigger');
  await new Promise((r) => setTimeout(r, 100));
  let probe = await page.evaluate(() => {
    const root = document.querySelector('.fdrop');
    const panel = root?.querySelector('.fdrop__panel');
    if (!panel) return { present: false };
    const cs = getComputedStyle(panel);
    const r = panel.getBoundingClientRect();
    return {
      present: true,
      display: cs.display,
      position: cs.position,
      open: root.classList.contains('is-open'),
      inViewport:
        r.width > 0 && r.height > 0 &&
        r.top >= 0 && r.left >= -1 &&
        r.right <= innerWidth && r.bottom <= innerHeight,
    };
  });
  ok('Panel dropdown terbuka (display ≠ none)', probe.present && probe.open && probe.display !== 'none',
     `display=${probe.display ?? '-'}`);
  ok('Panel position:fixed & dalam viewport', probe.position === 'fixed' && probe.inViewport,
     `position=${probe.position}, inViewport=${probe.inViewport}`);

  // Escape menutup
  await page.keyboard.press('Escape');
  await new Promise((r) => setTimeout(r, 100));
  const closedAfterEsc = await page.evaluate(
    () => !document.querySelector('.fdrop')?.classList.contains('is-open')
  );
  ok('Escape menutup dropdown', closedAfterEsc);

  // 3) Pilih opsi sort "Rating Tertinggi" → navigasi ?sort=rating
  const triggers = await page.$$('.fdrop__trigger');
  await triggers[triggers.length - 1].click(); // sortSelect = terakhir
  await new Promise((r) => setTimeout(r, 100));
  await page.evaluate(() => {
    const panels = [...document.querySelectorAll('.fdrop__panel')];
    const li = panels[panels.length - 1]?.querySelector('li[value="rating"], li:not(.is-selected)');
    li?.click();
  });
  await page
    .waitForFunction(() => location.search.includes('sort=rating'), { timeout: 10000 })
    .then(() => ok("Pilih opsi → navigasi '?sort=rating'", true))
    .catch(() => ok("Pilih opsi → navigasi '?sort=rating'", false, `url=${page.url()}`));

  // ── 5) Multi-genre: toggle 2 opsi → Terapkan → URL ?genre=a,b ──
  await page.waitForFunction(
    () => document.querySelectorAll('#genreSelect option').length >= 7,
    { timeout: 30000 }
  );
  await page.click('.fdrop__trigger'); // genreSelect = trigger pertama
  await new Promise((r) => setTimeout(r, 150));
  const picked = await page.evaluate(() => {
    // Toggle 2 opsi pertama yang bukan "Semua Genre"
    const lis = [...document.querySelectorAll('.fdrop.is-open .fdrop__panel li[role="option"]')]
      .filter((li) => li.dataset.value !== '');
    lis[0]?.click();
    lis[1]?.click();
    return [lis[0]?.dataset.value, lis[1]?.dataset.value];
  });
  await new Promise((r) => setTimeout(r, 100));
  // Terapkan memicu navigasi full-page (goToPage) → tunggu dokumen baru siap
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {}),
    page.click('.fdrop__apply'),
  ]);
  await page.waitForSelector('.fdrop__trigger', { timeout: 15000 });
  await new Promise((r) => setTimeout(r, 500)); // rAF sinkron awal dropdown

  // Badge jumlah genre pada trigger harus ter-render dengan angka yang benar
  // (regresi: elemen badge dibuat tapi tak pernah di-append ke DOM)
  await page
    .waitForFunction(
      () => {
        const b = document.querySelector('.fdrop__count');
        return b && !b.hidden && b.textContent === '2';
      },
      { timeout: 10000 }
    )
    .then(() => ok('Badge jumlah genre tampil "2" di trigger', true))
    .catch(() => ok('Badge jumlah genre tampil "2" di trigger', false));

  // Judul seksi memakai NAMA genre (bukan slug mentah) setelah daftar genre
  // selesai dimuat dari API
  await page
    .waitForFunction(
      () => /Age Progression/.test(document.getElementById('sectionTitle')?.textContent || ''),
      { timeout: 15000 }
    )
    .then(() => ok('Judul seksi memakai nama genre (bukan slug)', true))
    .catch(() =>
      ok(
        'Judul seksi memakai nama genre (bukan slug)',
        false,
        document.getElementById('sectionTitle')?.textContent || '(kosong)'
      )
    );
  await page
    .waitForFunction(
      (vals) => new URLSearchParams(location.search).get('genre') === vals.join(','),
      { timeout: 10000 },
      picked.filter(Boolean)
    )
    .then(() => ok('Multi-genre: Terapkan → URL ?genre=a,b', true, `genre=${picked.join(',')}`))
    .catch(() => ok('Multi-genre: Terapkan → URL ?genre=a,b', false, `url=${page.url()}`));

  // ── 6) Multi-genre: pilihan ke-7 ditolak + peringatan tampil ──
  await page.click('.fdrop__trigger'); // buka genre lagi (URL sudah bawa 2 genre)
  await new Promise((r) => setTimeout(r, 150));
  const warnProbe = await page.evaluate(() => {
    const panel = document.querySelector('.fdrop.is-open .fdrop__panel');
    if (!panel) return { open: false };
    // Klik semua opsi tersisa sampai melewati batas 6
    [...panel.querySelectorAll('li[role="option"]')]
      .filter((li) => li.dataset.value !== '')
      .forEach((li) => li.click());
    const warn = panel.querySelector('.fdrop__warn');
    const pendingCount = panel.querySelectorAll('li[role="option"].is-selected').length;
    return {
      open: true,
      warnVisible: warn ? !warn.hidden : false,
      pendingCount,
      capped: pendingCount <= 6,
    };
  });
  ok('Multi-genre: pilihan ke-7 ditolak (≤6 terpilih)', warnProbe.open && warnProbe.capped,
     `pending=${warnProbe.pendingCount ?? '-'}`);
  ok('Multi-genre: peringatan maksimum tampil', warnProbe.warnVisible === true);

  // ── 7) Bersihkan → instant apply: navigasi TANPA param genre ──
  await page.evaluate(() => {
    document.querySelector('.fdrop.is-open .fdrop__clear')?.click();
  });
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {}),
  ]);
  await page.waitForSelector('.fdrop__trigger', { timeout: 15000 });
  await new Promise((r) => setTimeout(r, 500));
  const genreParam = await page.evaluate(
    () => new URLSearchParams(location.search).get('genre')
  );
  ok('Bersihkan → instant apply (URL tanpa genre)', !genreParam, `genre=${genreParam ?? '(tidak ada)'}`);

  // Badge jumlah harus TERSEMBUNYI saat nol genre (regresi bulatan oranye)
  const badgeHidden = await page.evaluate(() => {
    const b = document.querySelector('.fdrop__count');
    return Boolean(b) && getComputedStyle(b).display === 'none';
  });
  ok('Badge count tersembunyi saat kosong', badgeHidden);

  // ── Mobile 360px ─────────────────────────────────────────────────────
  await page.setViewport({ width: 360, height: 740 });
  await page.goto(`${base}/manga/html/catalog.html`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('.fdrop__trigger', { timeout: 15000 });
  await new Promise((r) => setTimeout(r, 300));

  // 4) Logo, searchbar, hamburger satu baris
  const navRow = await page.evaluate(() => {
    const rect = (sel) => document.querySelector(sel)?.getBoundingClientRect();
    const brand = rect('.site-nav__brand');
    const search = rect('.nav-search');
    const burger = rect('.nav-hamburger');
    return {
      sameRow: brand && search && burger &&
        Math.abs(brand.top - burger.top) < 8 && Math.abs(brand.top - search.top) < 8,
      searchWidth: search ? Math.round(search.width) : 0,
    };
  });
  ok('Mobile 360px: logo+search+hamburger satu baris', navRow.sameRow,
     `lebar search=${navRow.searchWidth}px`);

  // Panel terbuka & dalam viewport meski filter bar = scroll container
  await page.click('.fdrop__trigger');
  await new Promise((r) => setTimeout(r, 100));
  probe = await page.evaluate(() => {
    const panel = document.querySelector('.fdrop.is-open .fdrop__panel');
    if (!panel) return { open: false };
    const r = panel.getBoundingClientRect();
    return {
      open: true,
      inViewport:
        r.width > 0 && r.top >= 0 && r.left >= -1 &&
        r.right <= innerWidth && r.bottom <= innerHeight,
    };
  });
  ok('Mobile 360px: panel terbuka TIDAK terklip rail scroll',
     probe.open && probe.inViewport, `inViewport=${probe.inViewport}`);

  console.log('\n══════ HASIL UI-CHECK CATALOG ══════');
  if (browserLog.length) {
    console.log(`Log browser (${browserLog.length}):`);
    for (const line of browserLog.slice(0, 10)) console.log(`  ${line}`);
  }
  console.log(`VERDICT: ${failures === 0 ? '✅ LOLOS' : `⚠️ GAGAL (${failures} cek)`}`);
  process.exitCode = failures === 0 ? 0 : 1;
} catch (err) {
  logger.error({ err }, 'ui-check-catalog gagal');
  console.error(`[ui-check-catalog] error: ${err.message}`);
  process.exitCode = 1;
} finally {
  await closeBrowser().catch(() => {});
}
