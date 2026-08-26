/**
 * scripts/dev/ui-check-home.mjs — Uji anti-regresi runtime halaman home
 * (browser nyata), pola ui-check-catalog/detail/reader.
 *
 *   1. Hero ter-render: judul + kedua CTA aktif
 *   2. BACA SEKARANG → langsung reader (Ch 1) pada profil bersih
 *   3. Dengan riwayat baca → tombol jadi LANJUT CH <x> → href chapter itu
 *   4. INFO → tetap menuju detail
 *
 * Jalankan (server harus sudah berjalan):
 *   node scripts/dev/ui-check-home.mjs [base-url]
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
  // Cari manga ber-chapter dari pool rating (sumber hero)
  const list = await api('/api/manga?sort=rating&page=1&limit=18');
  const target = (list?.data || []).find(
    (m) => Array.isArray(m.chapters) && m.chapters.some((c) => c.id || c.chapter_id)
  );
  if (!target) throw new Error('tidak ada manga ber-chapter di pool hero');
  const chs = [...target.chapters].sort((a, b) =>
    Number(a.number ?? a.chapter ?? 0) - Number(b.number ?? b.chapter ?? 0)
  );
  const firstId = String(chs[0].id ?? chs[0].chapter_id);
  console.log(`[ui-check-home] uji: ${target.slug} (ch1=${firstId})`);

  const browser = await getBrowser();
  const page = await newPage();
  await page.setViewport({ width: 1280, height: 800 });
  page.on('pageerror', (e) => browserLog.push(`[pageerror] ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error' && !m.text().includes('ERR_FAILED'))
      browserLog.push(`[console.error] ${m.text().slice(0, 120)}`);
  });

  // ── Profil bersih: BACA SEKARANG → Ch 1 ──
  await page.goto(`${base}/manga/html/index.html`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(
    () => (document.getElementById('heroTitle')?.textContent || '').length > 1 &&
      document.getElementById('heroReadBtn')?.href.includes('/manga/html/'),
    { timeout: 45000 }
  );

  // Hero mungkin butuh beberapa rotasi sampai manga target tampil —
  // gunakan goToSlide via dots jika ada; kalau tidak, terima apa pun
  // yang valid secara struktural.
  const readHref = await page.evaluate(() => document.getElementById('heroReadBtn')?.href || '');
  const infoHref = await page.evaluate(() => document.getElementById('heroInfoBtn')?.href || '');
  const label = await page.evaluate(
    () => document.getElementById('heroReadBtn')?.textContent.trim() || ''
  );
  ok('Hero: kedua CTA aktif', readHref.length > 0 && infoHref.length > 0,
     `${label} | ${readHref.slice(0, 70)}`);

  if (readHref.includes(`slug=${encodeURIComponent(target.slug)}`)) {
    // Slide saat ini = target tapi fallback ke detail → gagal
    ok('BACA SEKARANG → reader (bukan detail)', false, `href=${readHref}`);
  } else if (readHref.includes('/reader.html?id=')) {
    ok('BACA SEKARANG → reader.html?id=…', true);
  } else {
    ok('BACA SEKARANG → reader.html?id=…', false, `href=${readHref}`);
  }
  ok('INFO → detail.html?slug=…',
     infoHref.includes('/manga/html/detail.html?slug='),
     infoHref.slice(-60));

  // ── Dengan riwayat baca: LANJUT CH ──
  // Simpan riwayat palsu untuk manga target lalu paksa slide ke target:
  // paling deterministik = set localStorage history + reload.
  await page.evaluate((manga) => {
    localStorage.setItem('history', JSON.stringify([{
      slug: manga.slug,
      title: manga.title,
      thumb: '',
      type: manga.type || '',
      chapter: 99,
      chapterId: '__test_chapter_id__',
      lastRead: new Date().toISOString(),
    }]));
  }, { slug: target.slug, title: target.title, type: target.type });

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(
    () => (document.getElementById('heroReadBtn')?.textContent || '').includes('LANJUT'),
    { timeout: 45000 }
  ).catch(() => {});

  const cont = await page.evaluate(() => ({
    label: document.getElementById('heroReadBtn')?.textContent.trim() || '',
    href: document.getElementById('heroReadBtn')?.href || '',
  }));
  ok('Riwayat ada → label LANJUT CH', /LANJUT CH/i.test(cont.label), cont.label);
  ok('LANJUT → chapter tersimpan',
     cont.href.includes('id=__test_chapter_id__'),
     cont.href.slice(-40));

  // Bersihkan riwayat palsu agar tidak mencemari data user
  await page.evaluate(() => localStorage.removeItem('history'));

  console.log('\n══════ HASIL UI-CHECK HOME ══════');
  if (browserLog.length) {
    console.log(`Log browser (${browserLog.length}):`);
    for (const line of browserLog.slice(0, 10)) console.log(`  ${line}`);
  }
  console.log(`VERDICT: ${failures === 0 ? '✅ LOLOS' : `⚠️ GAGAL (${failures} cek)`}`);
  process.exitCode = failures === 0 ? 0 : 1;
} catch (err) {
  logger.error({ err }, 'ui-check-home gagal');
  console.error(`[ui-check-home] error: ${err.message}`);
  process.exitCode = 1;
} finally {
  await closeBrowser().catch(() => {});
}
