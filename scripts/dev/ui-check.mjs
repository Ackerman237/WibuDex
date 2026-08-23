/**
 * scripts/dev/ui-check.mjs — Uji anti-regresi UI halaman watch.
 *
 * Memeriksa lewat browser sungguhan (bukan CLI-only):
 *   1. Kode baru aktif?  → elemen #pfModeBtn / overlay #pfLoading ada
 *   2. Mode apa yang jalan? → <video> (native) vs iframe (filtered/direct)
 *   3. Popunder?  → hitung tab/target baru yang terbuka selama sesi uji
 *
 * Jalankan (server harus sudah berjalan):
 *   node scripts/dev/ui-check.mjs http://localhost:4000 <slug-nekopoi>
 */
import { getBrowser, newPage, closeBrowser } from '../../lib/browser.js';
import logger from '../../lib/logger.js';

const base = process.argv[2] || 'http://localhost:4000';
const slug = process.argv[3];
if (!slug || slug.startsWith('http')) {
  console.error('Usage: node scripts/dev/ui-check.mjs [base-url] <slug-nekopoi>');
  process.exit(1);
}

const url = `${base}/nekoPage/html/watch.html?slug=${encodeURIComponent(slug)}`;
console.log(`[ui-check] membuka ${url}`);

let popupCount = 0;
const extraTargets = [];

try {
  const browser = await getBrowser();
  const page = await newPage();

  // Pantau SEMUA target baru (tab/popup/window), KECUALI halaman uji kita
  // sendiri — newPage() memicu targetcreated dengan url about:blank sebelum
  // navigasi, jangan ikut terhitung sebagai popunder.
  const selfTarget = page.target();
  browser.on('targetcreated', (target) => {
    if (target.type() === 'page' && target !== selfTarget) {
      popupCount += 1;
      extraTargets.push(target.url());
    }
  });

  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

  // Tunggu detail + ekstraksi stream selesai (bisa belasan detik)
  try {
    await page.waitForFunction(
      () => {
        const box = document.getElementById('playerBox');
        return box && (box.querySelector('video') || box.querySelector('iframe') || box.querySelector('.player-error-text'));
      },
      { timeout: 45000 }
    );
  } catch {
    console.log('[ui-check] ⚠️ player belum juga muncul dalam 45 detik');
  }

  // Beri waktu popunder berbasis timer untuk mencoba kabur
  await new Promise((r) => setTimeout(r, 6000));

  const state = await page.evaluate(() => {
    const box = document.getElementById('playerBox');
    const video = box?.querySelector('video');
    const iframe = box?.querySelector('iframe');
    return {
      guardBtnPresent: Boolean(document.getElementById('pfModeBtn')),
      loadingVisible: (() => {
        const el = document.getElementById('pfLoading');
        return el ? el.style.display !== 'none' : false;
      })(),
      playerType: video ? 'native-video' : iframe ? 'iframe' : 'error/none',
      iframeSrc: iframe?.src?.slice(0, 80) || '',
      videoSrc: video?.src?.slice(0, 60) || '',
      title: document.getElementById('videoTitle')?.innerText || '(judul kosong)',
    };
  });

  console.log('\n══════ HASIL UI-CHECK ══════');
  console.log(`Judul video        : ${state.title}`);
  console.log(`Kode baru aktif?   : ${state.guardBtnPresent ? '✅ ya (tombol mode ada)' : '❌ TIDAK — masih JS lama dari cache!'}`);
  console.log(`Overlay loading    : ${state.loadingVisible ? 'masih tampil (jaringan lambat?)' : 'selesai/tersembunyi'}`);
  console.log(`Tipe player        : ${state.playerType === 'native-video' ? '✅ native <video> — nol JS penyedia' : state.playerType}`);
  if (state.playerType === 'iframe') console.log(`Iframe src         : ${state.iframeSrc}...`);
  if (state.videoSrc) console.log(`Video src          : ${state.videoSrc}...`);
  console.log(`Tab/popup baru     : ${popupCount === 0 ? '✅ 0 — tidak ada pelemparan' : `❌ ${popupCount}`}`);
  for (const t of extraTargets.slice(0, 5)) console.log(`   ↳ target: ${t.slice(0, 90)}`);

  const pass = state.guardBtnPresent && popupCount === 0 && state.playerType !== 'iframe-direct';
  console.log(`\nVERDICT: ${pass ? '✅ LOLOS' : '⚠️ PERLU PERHATIAN'}`);
  console.log('[ui-check] catatan: tutup browser uji dengan closeBrowser bila perlu.');
} catch (err) {
  logger.error({ err }, 'ui-check gagal');
  console.error(`[ui-check] error: ${err.message}`);
  process.exitCode = 1;
} finally {
  // Biarkan browser tetap terbuka bila dipakai proses lain; tutup jika milik sendiri.
  await closeBrowser().catch(() => {});
}
