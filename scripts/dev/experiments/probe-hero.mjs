/**
 * scripts/dev/probe-hero.mjs — Verifikasi UI hero featured dinamis:
 * judul terisi, dots = pool, rotasi otomatis maju, panah & swipe terpasang.
 */
import { getBrowser, newPage } from '../../lib/browser.js';

const base = process.argv[2] || 'http://localhost:4123';

const page = await newPage();
page.on('pageerror', (e) => console.log(`[pageerror] ${e.message.slice(0, 160)}`));

await page.goto(`${base}/doujinPage/html/index.html`, { waitUntil: 'domcontentloaded', timeout: 60000 });

// Tunggu judul hero terisi (fetch selesai)
try {
  await page.waitForFunction(
    () => {
      const t = document.getElementById('heroTitle')?.textContent || '';
      return t && t !== 'Memuat featured…' && t !== 'Featured tidak tersedia';
    },
    { timeout: 30000 }
  );
} catch {
  console.log('[probe] ⚠️ hero tidak kunjung terisi dalam 30 dtk');
}

const s1 = await page.evaluate(() => ({
  judul: document.getElementById('heroTitle')?.textContent,
  rating: document.getElementById('heroRatingText')?.textContent,
  tipe: document.getElementById('heroTypeBadge')?.textContent || '(tersembunyi)',
  tipeVisible: document.getElementById('heroTypeBadge')?.style.display !== 'none',
  dots: document.querySelectorAll('.hero-dot').length,
  dotActive: [...document.querySelectorAll('.hero-dot')].findIndex((d) => d.classList.contains('active')),
  bg: (document.getElementById('heroBg')?.style.backgroundImage || '').slice(0, 60),
  readBtnHref: document.getElementById('heroReadBtn')?.getAttribute('href'),
  adaPanah: Boolean(document.getElementById('heroPrevBtn') && document.getElementById('heroNextBtn')),
  popularCards: document.querySelectorAll('#popularGrid .manga-card').length,
}));

console.log('\n── kondisi awal ──');
console.log(JSON.stringify(s1, null, 2));

// Klik panah next → slide harus berganti
await page.click('#heroNextBtn');
await new Promise((r) => setTimeout(r, 1200));
const s2 = await page.evaluate(() => ({
  judulSetelahNext: document.getElementById('heroTitle')?.textContent,
  dotActive: [...document.querySelectorAll('.hero-dot')].findIndex((d) => d.classList.contains('active')),
}));

console.log('\n── setelah klik panah next ──');
console.log(JSON.stringify(s2, null, 2));
console.log(s2.judulSetelahNext !== s1.judul ? '✅ panah bekerja — slide berganti' : '⚠️ judul sama (bukan berarti bug jika pool <2)');

// Tunggu auto-slide (8 dtk interval)
console.log('[probe] menunggu auto-slide ±9 dtk…');
await new Promise((r) => setTimeout(r, 9000));
const s3 = await page.evaluate(
  () => [...document.querySelectorAll('.hero-dot')].findIndex((d) => d.classList.contains('active'))
);
console.log(`dot aktif setelah tunggu: ${s3} (sebelumnya ${s2.dotActive})`);
console.log(s3 !== s2.dotActive ? '✅ auto-slide berjalan' : '⚠️ auto-slide belum terlihat');

process.exit(0);
