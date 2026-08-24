/**
 * scripts/dev/ui-check-detail.mjs — Uji anti-regresi runtime halaman detail
 * manga (browser nyata), mengikuti pola ui-check-catalog.mjs.
 *
 *   1. Tombol Kembali: catalog → klik kartu → detail → backBtn → kembali
 *   2. Layout ter-render (display:grid, judul terisi)
 *   3. Blok alt-title lama TIDAK ada; baris panel "Judul Alternatif" terisi
 *   4. Genre chips ada
 *   5. Chapter list terisi; badge sinkron; stempel sadar-status konsisten
 *   6. Pencarian chapter memfilter
 *   7. Bookmark toggle dua arah (+audit hit-target overlay)
 *   8. Favorit toggle + ikon hati SOLID tampak saat aktif
 *   9. Tab More Series ↔ Detail Info
 *  10. Tema dinamis: --cover-accent + --cover-accent-text ter-set,
 *      kontras text vs bg-base ≥4.5, nav ber-class has-cover-accent
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

async function openDetail(page, slug) {
  await page.goto(
    `${base}/manga/html/detail.html?slug=${encodeURIComponent(slug)}`,
    { waitUntil: 'domcontentloaded', timeout: 60000 }
  );
  await page.waitForFunction(
    () => {
      const layout = document.getElementById('detailLayout');
      return layout && getComputedStyle(layout).display === 'grid' &&
        (document.getElementById('mTitle')?.textContent || '').length > 1;
    },
    { timeout: 45000 }
  );
}

try {
  // Ambil slug umum + slug completed untuk uji stempel
  const res = await fetch(`${base}/api/manga?limit=1&page=1`, { signal: AbortSignal.timeout(30000) });
  const slug = (await res.json())?.data?.[0]?.slug;
  if (!slug) throw new Error('tidak ada slug dari /api/manga');
  const resC = await fetch(`${base}/api/manga?status=completed&limit=1&page=1`, { signal: AbortSignal.timeout(30000) });
  const slugCompleted = (await resC.json())?.data?.[0]?.slug;

  const browser = await getBrowser();
  const page = await newPage();
  page.on('pageerror', (e) => browserLog.push(`[pageerror] ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error' && !m.text().includes('ERR_FAILED'))
      browserLog.push(`[console.error] ${m.text().slice(0, 120)}`);
  });

  // ── 1) Alur tombol Kembali ──
  await page.setViewport({ width: 1280, height: 800 });
  await page.goto(`${base}/manga/html/catalog.html`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('.manga-card .manga-title', { timeout: 30000 });
  await page.click('.manga-card .manga-title');
  await page.waitForFunction(
    () => location.pathname.includes('/manga/html/detail.html'),
    { timeout: 30000 }
  );
  await page.waitForSelector('#backBtn', { timeout: 15000 });
  await page.click('#backBtn');
  await page
    .waitForFunction(() => location.pathname.includes('/manga/html/catalog.html'), { timeout: 15000 })
    .then(() => ok('Tombol Kembali → balik ke halaman sebelumnya', true))
    .catch(() => ok('Tombol Kembali → balik ke halaman sebelumnya', false, `url=${page.url()}`));

  // ── Halaman utama pengujian ──
  await openDetail(page, slug);
  ok('Layout detail ter-render (grid) + judul terisi', true);

  // 3) Alt title: blok lama hilang, baris panel tetap
  const altProbe = await page.evaluate(() => ({
    legacyBlock: Boolean(document.querySelector('.alt-titles-block')),
    infoFilled: (document.getElementById('infoAltTitles')?.textContent || '').trim().length > 0,
  }));
  ok('Blok alt-title bawah-judul sudah dihapus', !altProbe.legacyBlock);
  ok('Baris "Judul Alternatif" di info panel tetap terisi', altProbe.infoFilled);

  // 4) Genre chips
  const genreCount = await page.evaluate(
    () => document.querySelectorAll('#genreTags .genre-tag').length
  );
  ok('Genre chips dirender', genreCount > 0, `${genreCount} chip`);

  // 5) Chapter rows + badge sinkron + stempel konsisten status
  await page.waitForFunction(() => document.querySelectorAll('.chapter-row').length > 0, {
    timeout: 30000,
  });
  const chapProbe = await page.evaluate(() => {
    const rows = document.querySelectorAll('.chapter-row');
    const first = rows[0];
    const status = (document.getElementById('mStatusText')?.textContent || '').trim().toLowerCase();
    let expectedClass = 'is-latest';
    if (status === 'completed') expectedClass = 'is-completed';
    else if (status === 'hiatus') expectedClass = 'is-hiatus';
    return {
      rows: rows.length,
      badge: Number(document.getElementById('chapterCount')?.textContent || -1),
      firstClass: first ? first.className : '',
      expectedClass,
      status,
    };
  });
  ok('Chapter list terisi + badge sinkron',
     chapProbe.rows > 0 && chapProbe.badge === chapProbe.rows,
     `rows=${chapProbe.rows}, badge=${chapProbe.badge}`);
  ok('Stempel chapter sadar-status',
     chapProbe.firstClass.includes(chapProbe.expectedClass),
     `status=${chapProbe.status}, class=${chapProbe.firstClass.split(' ').pop()}`);

  // 6) Pencarian chapter memfilter
  await page.type('#chapterSearch', '1');
  await new Promise((r) => setTimeout(r, 300));
  const filtered = await page.evaluate(() =>
    Number(document.getElementById('chapterCount')?.textContent || -1)
  );
  ok('Pencarian chapter memfilter', filtered >= 0 && filtered <= chapProbe.rows,
     `${chapProbe.rows} → ${filtered}`);
  await page.evaluate(() => {
    const s = document.getElementById('chapterSearch');
    s.value = '';
    s.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await new Promise((r) => setTimeout(r, 200));

  // 7) Bookmark dua arah (evaluate-click bebas flakiness hit-test +
  //    audit elementFromPoint untuk deteksi overlay nyata)
  const hitProbe = await page.evaluate(() => {
    const b = document.getElementById('bookmarkBtn');
    b.scrollIntoView({ block: 'center', behavior: 'instant' });
    const r = b.getBoundingClientRect();
    const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return !(el === b || b.contains(el));
  });
  ok('BookmarkBtn tidak tertutup elemen lain', !hitProbe);
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

  // 8) Favorit + hati SOLID saat aktif
  await page.evaluate(() => document.getElementById('favoriteBtn').click());
  await new Promise((r) => setTimeout(r, 200));
  const favProbe = await page.evaluate(() => ({
    active: document.getElementById('favoriteBtn')?.classList.contains('is-active'),
    filledVisible: (() => {
      const f = document.querySelector('.btn-favorite .ic-heart-filled');
      return f && getComputedStyle(f).display !== 'none';
    })(),
    outlineHidden: (() => {
      const o = document.querySelector('.btn-favorite .ic-heart-outline');
      return o && getComputedStyle(o).display === 'none';
    })(),
  }));
  ok('Favorit ON (.is-active)', favProbe.active === true);
  ok('Hati SOLID merah tampil saat favorit aktif',
     favProbe.filledVisible && favProbe.outlineHidden);
  await page.evaluate(() => document.getElementById('favoriteBtn').click());
  await new Promise((r) => setTimeout(r, 200));
  const favOff = await page.evaluate(() =>
    !document.getElementById('favoriteBtn')?.classList.contains('is-active')
  );
  ok('Favorit OFF (toggle balik)', favOff === true);

  // 9) Tab rekomendasi
  await page.click('#tabMoreSeries');
  await new Promise((r) => setTimeout(r, 1200));
  let recVisible = await page.evaluate(
    () => document.getElementById('recommendSection')?.style.display !== 'none'
  );
  ok('Tab More Series menampilkan rekomendasi', recVisible);
  await page.click('#tabInfo');
  recVisible = await page.evaluate(
    () => document.getElementById('recommendSection')?.style.display !== 'none'
  );
  ok('Tab Detail Info menyembunyikan rekomendasi', !recVisible);

  // 10) Tema dinamis: dua var + kontras + class nav (tiap assertion mandiri)
  let themeOk = false;
  try {
    await page.waitForFunction(
      () =>
        document.documentElement.style.getPropertyValue('--cover-accent').trim() !== '' &&
        document.documentElement.style.getPropertyValue('--cover-accent-text').trim() !== '',
      { timeout: 25000 }
    );
    themeOk = true;
  } catch {
    /* dibiarkan gagal lewat assertion di bawah */
  }
  ok('Tema dinamis: kedua var accent ter-set', themeOk);

  const themeProbe = await page.evaluate(() => {
    try {
      const hexLum = (hex) => {
        const v = hex.replace('#', '').match(/\w\w/g).map((x) => parseInt(x, 16) / 255)
          .map((x) => (x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4)));
        return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
      };
      const root = document.documentElement;
      const t = root.style.getPropertyValue('--cover-accent-text').trim();
      const lt = hexLum(t);
      const lb = hexLum('#0D0C0C');
      return {
        text: t,
        accent: root.style.getPropertyValue('--cover-accent').trim(),
        contrast: (Math.max(lt, lb) + 0.05) / (Math.min(lt, lb) + 0.05),
        navClass: root.classList.contains('has-cover-accent'),
        err: null,
      };
    } catch (e) {
      return { err: String(e && e.message) };
    }
  });
  if (themeProbe.err) console.log(`   [diag] themeProbe error: ${themeProbe.err}`);
  else {
    console.log(`   [diag] accent=${themeProbe.accent} text=${themeProbe.text}`);
    ok('Kontras --cover-accent-text ≥ 4.5', themeProbe.contrast >= 4.49,
       `rasio=${themeProbe.contrast.toFixed(2)}`);
    ok('Nav ber-class has-cover-accent (scope detail)', themeProbe.navClass === true);
  }

  // ── Kontras tombol READ NOW diuji pada 3 cover berbeda ──
  // (regresi kelas: teks accent di atas bg accent, Koutei no Shinanyaku
  //  terbukti kontras cuma 2.00)
  const readNowSlugs = [slug];
  try {
    const rK = await fetch(
      `${base}/api/manga?limit=5&query=Koutei no Shinanyaku`,
      { signal: AbortSignal.timeout(30000) }
    );
    const sK = (await rK.json())?.data?.[0]?.slug;
    if (sK && !readNowSlugs.includes(sK)) readNowSlugs.push(sK);
  } catch { /* best-effort */ }
  if (slugCompleted && !readNowSlugs.includes(slugCompleted)) {
    readNowSlugs.push(slugCompleted);
  }

  for (const s of readNowSlugs) {
    await openDetail(page, s);
    await page.waitForFunction(
      () => document.documentElement.style.getPropertyValue('--cover-accent').trim() !== '',
      { timeout: 25000 }
    );
    await new Promise((r) => setTimeout(r, 200));
    const btnProbe = await page.evaluate(() => {
      const cs = getComputedStyle(document.getElementById('readNowBtn'));
      const lum = (cssColor) => {
        const m = cssColor.match(/\d+/g).map(Number);
        const f = (v) => {
          const c = v / 255;
          return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
        };
        return 0.2126 * f(m[0]) + 0.7152 * f(m[1]) + 0.0722 * f(m[2]);
      };
      const l1 = lum(cs.backgroundColor);
      const l2 = lum(cs.color);
      return {
        bg: cs.backgroundColor,
        color: cs.color,
        contrast: (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05),
      };
    });
    ok(`READ NOW kontras ≥4.5 (${s})`, btnProbe.contrast >= 4.49,
       `${btnProbe.bg} / ${btnProbe.color} = ${btnProbe.contrast.toFixed(2)}`);
  }

  // ── Stempel TAMAT pada manga completed ──
  if (slugCompleted) {
    await openDetail(page, slugCompleted);
    await page.waitForFunction(() => document.querySelectorAll('.chapter-row').length > 0, {
      timeout: 30000,
    });
    const stamp = await page.evaluate(() => {
      const first = document.querySelector('.chapter-row');
      const content = getComputedStyle(first, '::after').content;
      return {
        cls: first.className,
        content: content === 'none' ? '' : content.replace(/"/g, ''),
      };
    });
    ok('Manga completed: stempel TAMAT hijau (tanpa BARU)',
       stamp.cls.includes('is-completed') &&
       !stamp.cls.includes('is-latest') &&
       /tamati?/i.test(stamp.content),
       `content="${stamp.content}"`);
  }

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
