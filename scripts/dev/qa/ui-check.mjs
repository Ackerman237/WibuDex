/**
 * scripts/dev/ui-check.mjs — Uji anti-regresi UI halaman watch (browser nyata).
 *
 * Pemeriksaan:
 *   1. Kode baru aktif?   → elemen #pfModeBtn ada
 *   2. Mode player?       → <video> (native) vs iframe (filtered/direct)
 *   3. PUTAR NYATA?       → play() + currentTime bertambah (bukan sekadar elemen ada)
 *   4. Popunder?          → hitung tab/target baru selama sesi uji
 *
 * Semua listener dipasang SEBELUM goto() — error JS dini tidak lagi lolos.
 *
 * Jalankan (server harus sudah berjalan):
 *   node scripts/dev/ui-check.mjs [base-url] <slug-nekopoi>
 */
import { getBrowser, newPage, closeBrowser } from '../../lib/browser.js';
import logger from '../../lib/logger.js';

const base = process.argv[2] || 'http://localhost:4000';
const slug = process.argv[3];
if (!slug || slug.startsWith('http')) {
  console.error('Usage: node scripts/dev/ui-check.mjs [base-url] <slug-nekopoi>');
  process.exit(1);
}

const url = `${base}/video/html/watch.html?slug=${encodeURIComponent(slug)}`;
console.log(`[ui-check] membuka ${url}`);

let popupCount = 0;
const extraTargets = [];
const browserLog = [];

try {
  const browser = await getBrowser();
  const page = await newPage();

  // ── Listener SEBELUM goto(): error dini & request bermasalah tak lolos ──
  const selfTarget = page.target();
  browser.on('targetcreated', (target) => {
    if (target.type() === 'page' && target !== selfTarget) {
      popupCount += 1;
      extraTargets.push(target.url());
    }
  });
  page.on('pageerror', (e) => browserLog.push(`[pageerror] ${e.message}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error') browserLog.push(`[console.error] ${msg.text().slice(0, 120)}`);
  });
  page.on('requestfailed', (r) =>
    browserLog.push(`[reqfail] ${r.failure()?.errorText} ${r.url().slice(0, 90)}`)
  );
  page.on('response', (r) => {
    if (r.status() >= 400) browserLog.push(`[http${r.status()}] ${r.url().slice(0, 90)}`);
  });

  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

  // ── Probe konteks halaman: apakah fetch dari BROWSER bekerja & secepat apa ──
  const fetchProbe = await page.evaluate(async () => {
    const t0 = performance.now();
    try {
      const res = await fetch('/api/video/player-mode');
      const json = await res.json();
      return { ok: res.ok, mode: json?.data?.mode ?? '?', ms: Math.round(performance.now() - t0) };
    } catch (err) {
      return { ok: false, error: String(err), ms: Math.round(performance.now() - t0) };
    }
  });
  console.log(`[probe] fetch in-page /api/video/player-mode: ${JSON.stringify(fetchProbe)}`);

  // Apakah watch.js?v=3 benar-benar terunduh & tereksekusi?
  await new Promise((r) => setTimeout(r, 1500));
  const scriptProbe = await page.evaluate(() => ({
    mountPlayerLoaded: typeof window.mountPlayer !== 'undefined'
      ? 'global'
      : document.querySelector('script[src*="watch.js?v=3"]')
        ? 'script-tag-ada (fungsi non-global, cek via efek DOM)'
        : 'TIDAK ADA di DOM',
    resources: performance
      .getEntriesByType('resource')
      .filter((e) => e.name.includes('watch.js'))
      .map((e) => `${e.name.split('/').pop()} dur=${Math.round(e.duration)}ms size=${e.transferSize}`),
  }));
  console.log(`[probe] watch.js: ${JSON.stringify(scriptProbe)}`);

  // ── Tunggu player muncul ──
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

  // ── UJI PUTAR NYATA (bukan sekadar elemen ada) ──
  let playback = { attempted: false };
  const hasVideo = await page.evaluate(() => Boolean(document.querySelector('#playerBox video')));
  if (hasVideo) {
    playback.attempted = true;
    playback = await page.evaluate(async () => {
      const v = document.querySelector('#playerBox video');
      if (!v || !v.src) return { attempted: true, playable: false, reason: 'video/src hilang' };
      const result = { attempted: true, readyStateBefore: v.readyState };
      try {
        await v.play();
      } catch (err) {
        result.playable = false;
        result.reason = `play() ditolak: ${err.message}`;
        return result;
      }
      // Tunggu metadata + waktu berjalan maks 12 dtk
      const okMeta = await Promise.race([
        new Promise((res) => v.addEventListener('loadedmetadata', () => res(true), { once: true })),
        new Promise((res) => setTimeout(() => res(v.readyState >= 1), 8000)),
      ]);
      if (!okMeta) return { ...result, playable: false, reason: 'loadedmetadata tidak kunjung (CDN diam)' };
      result.duration = Number.isFinite(v.duration) ? Math.round(v.duration) : null;
      const t0 = v.currentTime;
      await new Promise((res) => setTimeout(res, 5000));
      const advanced = v.currentTime > t0 && !v.paused && !v.errored;
      return { ...result, playable: advanced, currentTime: v.currentTime.toFixed(1), reason: advanced ? null : 'currentTime tidak berjalan' };
    });
  }

  // Beri waktu popunder berbasis timer mencoba kabur
  await new Promise((r) => setTimeout(r, 4000));

  const state = await page.evaluate(() => {
    const box = document.getElementById('playerBox');
    const video = box?.querySelector('video');
    const iframe = box?.querySelector('iframe');
    return {
      guardBtnPresent: Boolean(document.getElementById('pfModeBtn')),
      title: document.getElementById('videoTitle')?.innerText || '(judul kosong)',
      playerType: video ? 'native-video' : iframe ? 'iframe' : 'error/none',
      iframeSrc: iframe?.src?.slice(0, 80) || '',
      videoSrc: video?.src?.slice(0, 60) || '',
    };
  });

  console.log('\n══════ HASIL UI-CHECK ══════');
  console.log(`Judul video        : ${state.title}`);
  console.log(`Kode baru aktif?   : ${state.guardBtnPresent ? '✅ ya' : '❌ TIDAK — JS lama/error dini!'}`);
  console.log(`Fetch in-page      : ${fetchProbe.ok ? `✅ ${fetchProbe.ms}ms` : `❌ ${fetchProbe.error}`}`);
  console.log(`Tipe player        : ${state.playerType === 'native-video' ? '✅ native <video>' : state.playerType}`);
  if (playback.attempted) {
    console.log(
      playback.playable
        ? `PUTAR NYATA        : ✅ BERJALAN (t=${playback.currentTime}s, durasi=${playback.duration ?? '?'}s)`
        : `PUTAR NYATA        : ❌ ${playback.reason}`
    );
  }
  console.log(`Tab/popup baru     : ${popupCount === 0 ? '✅ 0' : `❌ ${popupCount}`}`);
  for (const t of extraTargets.slice(0, 5)) console.log(`   ↳ target: ${t.slice(0, 90)}`);
  if (browserLog.length) {
    console.log(`\nLog browser (${browserLog.length}):`);
    for (const line of browserLog.slice(0, 10)) console.log(`  ${line}`);
  }

  const pass =
    state.guardBtnPresent &&
    popupCount === 0 &&
    (!playback.attempted || playback.playable);
  console.log(`\nVERDICT: ${pass ? '✅ LOLOS (termasuk putar nyata)' : '⚠️ PERLU PERHATIAN'}`);
} catch (err) {
  logger.error({ err }, 'ui-check gagal');
  console.error(`[ui-check] error: ${err.message}`);
  process.exitCode = 1;
} finally {
  await closeBrowser().catch(() => {});
}
