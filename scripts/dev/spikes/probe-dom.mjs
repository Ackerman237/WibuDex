// probe-dom.mjs — Dump kondisi #playerBox & sekitarnya setelah halaman berjalan
import { getBrowser, newPage } from '../../lib/browser.js';

const base = process.argv[2] || 'http://localhost:4123';
const slug =
  process.argv[3] || 'jdsy-364-pemuda-pemalu-itu-dipaksa-memijat-bokong-dan-colek-memek-kakak-ipar-perempuannya-sendiri';

const page = await newPage();
page.on('pageerror', (e) => console.log(`[pageerror] ${e.message.slice(0, 200)}`));
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log(`[console.${m.type()}] ${m.text().slice(0, 160)}`); });

await page.goto(`${base}/nekoPage/html/watch.html?slug=${encodeURIComponent(slug)}`, {
  waitUntil: 'domcontentloaded',
});

for (const sec of [3, 8, 15]) {
  await new Promise((r) => setTimeout(r, sec === 3 ? 3000 : 5000));
  const snap = await page.evaluate(() => {
    const box = document.getElementById('playerBox');
    return {
      judul: document.getElementById('videoTitle')?.innerText,
      playerBoxHTML: box ? box.innerHTML.replace(/\s+/g, ' ').slice(0, 220) : '(playerBox hilang!)',
      adaLoading: Boolean(document.getElementById('pfLoading')),
      adaModeBtn: Boolean(document.getElementById('pfModeBtn')),
      jumlahServerBtn: document.querySelectorAll('#serverSelectorContainer .server-btn').length,
    };
  });
  console.log(`\n── t+${sec}s ──`);
  console.log(JSON.stringify(snap, null, 2));
}

process.exit(0);
