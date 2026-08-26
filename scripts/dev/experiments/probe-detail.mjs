/**
 * scripts/dev/probe-detail.mjs — Bedah spesifik: apakah fetch /api/neko/detail
 * dari KONTEKS BROWSER selesai? Bandingkan dengan semua request halaman lain.
 */
import { getBrowser, newPage } from '../../lib/browser.js';

const base = process.argv[2] || 'http://localhost:4123';
const slug =
  process.argv[3] || 'jdsy-364-pemuda-pemalu-itu-dipaksa-memijat-bokong-dan-colek-memek-kakak-ipar-perempuannya-sendiri';

const page = await newPage();

page.on('request', (r) => console.log(`→ REQ  ${r.method()} ${r.url().slice(0, 90)}`));
page.on('response', async (r) => {
  let extra = '';
  try {
    const h = r.headers();
    extra = ` len=${h['content-length'] ?? '?'}`;
  } catch {
    // headers bisa saja sudah tidak tersedia — abaikan
  }
  console.log(`← RESP ${r.status()} ${r.url().slice(0, 90)}${extra}`);
});
page.on('requestfailed', (r) => console.log(`✗ FAIL ${r.failure()?.errorText} ${r.url().slice(0, 90)}`));
page.on('pageerror', (e) => console.log(`✗ PAGEERROR ${e.message.slice(0, 160)}`));

await page.goto(`${base}/nekoPage/html/watch.html?slug=${encodeURIComponent(slug)}`, {
  waitUntil: 'domcontentloaded',
});

console.log('\n[probe] fetch /api/neko/detail dari konteks halaman (timeout 20 dtk)...\n');
const result = await page.evaluate(async (slug) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  const t0 = performance.now();
  try {
    const res = await fetch(`/api/neko/detail?slug=${encodeURIComponent(slug)}`, {
      signal: controller.signal,
    });
    const text = await res.text();
    return {
      status: res.status,
      ms: Math.round(performance.now() - t0),
      head: text.slice(0, 150),
      headers: {
        contentType: res.headers.get('content-type'),
        contentLength: res.headers.get('content-length'),
        transferEncoding: res.headers.get('transfer-encoding'),
        cacheControl: res.headers.get('cache-control'),
      },
    };
  } catch (err) {
    return { error: String(err), ms: Math.round(performance.now() - t0) };
  } finally {
    clearTimeout(timer);
  }
}, slug);

console.log('\n[probe] HASIL:', JSON.stringify(result, null, 2));

await new Promise((r) => setTimeout(r, 2000));
process.exit(0);
