/**
 * probe-stream.mjs — Apakah URL stream ditolak universal atau hanya di Chrome?
 * Bandingkan: curl langsung VS fetch dari konteks Chrome VS goto halaman mp4.
 */
import { execFile } from 'child_process';
import { promisify } from 'util';
import { getBrowser, newPage } from '../../lib/browser.js';
import { USER_AGENT } from '../../lib/constants.js';

const execFileAsync = promisify(execFile);

const slug =
  process.argv[3] || 'jdsy-364-pemuda-pemalu-itu-dipaksa-memijat-bokong-dan-colek-memek-kakak-ipar-perempuannya-sendiri';
const base = process.argv[2] || 'http://localhost:4123';

// 1. Ekstrak URL fresh via API
const apiRes = await fetch(
  `${base}/api/neko/stream?url=${encodeURIComponent('https://playmogo.com/e/zqloikpof9gq')}&slug=${encodeURIComponent(slug)}`
);
const json = await apiRes.json();
if (!json?.success) {
  console.log('[probe] ekstraksi gagal:', JSON.stringify(json));
  process.exit(1);
}
const streamUrl = json.data.url;
console.log(`[probe] URL stream : ${streamUrl.slice(0, 70)}...`);

// 2. Curl langsung
try {
  const r = await execFileAsync('curl.exe', [
    '-s', '-o', 'NUL', '-w', '%{http_code} %{content_type} %{size_download}',
    '-m', '15', '-A', USER_AGENT, '-r', '0-1023', streamUrl,
  ], { windowsHide: true });
  console.log(`[curl ] ${r.stdout}`);
} catch (e) {
  console.log(`[curl ] GAGAL: ${e.message}`);
}

// 3. Fetch dari konteks Chrome (same machine)
const page = await newPage();
const inChrome = await page.evaluate(async (u) => {
  const t0 = performance.now();
  try {
    const res = await fetch(u, { mode: 'no-cors', headers: { Range: 'bytes=0-1023' } });
    return { type: res.type, status: res.status, ms: Math.round(performance.now() - t0) };
  } catch (err) {
    return { error: String(err).slice(0, 100), ms: Math.round(performance.now() - t0) };
  }
}, streamUrl);
console.log(`[chrome-fetch] ${JSON.stringify(inChrome)}`);

// 4. Chrome membuka MP4 langsung sebagai dokumen
try {
  const resp = await page.goto(streamUrl, { timeout: 20000 });
  console.log(`[chrome-goto] status=${resp.status()} contentType=${(resp.headers()['content-type'] || '?')}`);
} catch (e) {
  console.log(`[chrome-goto] GAGAL: ${String(e).slice(0, 120)}`);
}

process.exit(0);
