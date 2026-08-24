/**
 * scripts/get-secret.js
 *
 * Ekstrak DOUJIN_APP_SECRET dan DOUJIN_SALT dari bundle JavaScript situs doujin.desu.xxx,
 * lalu tulis ke file .env secara otomatis.
 *
 * Cara kerja:
 *   1. Buka situs dengan Puppeteer (headless Chrome) untuk load bundle React.
 *   2. Intersep semua respons JS yang merupakan bundle utama.
 *   3. Cari pola string yang menyimpan APP_SECRET dan SALT di dalam bundle.
 *   4. Tulis/update .env dengan nilai yang ditemukan.
 *
 * Penggunaan:
 *   node --env-file=.env scripts/get-secret.js
 *   npm run get-secret
 *
 * Dependensi: puppeteer-core (sudah ada di project), tidak ada dependensi baru.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer-core';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const ENV_PATH = path.join(ROOT, '.env');
const TARGET_URL = 'https://doujin.desu.xxx/';

// ── Resolve Chrome path (sama dengan lib/browser.js) ─────────────────────────
function resolveChromePath() {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) return process.env.PUPPETEER_EXECUTABLE_PATH;
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;

  const platform = process.platform;
  const candidates = [];

  if (platform === 'win32') {
    candidates.push(
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      `${process.env.LOCALAPPDATA || ''}\\Google\\Chrome\\Application\\chrome.exe`,
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    );
  } else if (platform === 'darwin') {
    candidates.push(
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
    );
  } else {
    candidates.push(
      '/usr/bin/google-chrome',
      '/usr/bin/google-chrome-stable',
      '/usr/bin/chromium',
      '/usr/bin/chromium-browser',
      '/snap/bin/chromium',
    );
  }

  for (const p of candidates) {
    if (p && fs.existsSync(p)) return p;
  }

  // Fallback — Puppeteer akan error dengan pesan yang jelas jika tidak ada
  return 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
}

// ── Pola regex untuk ekstrak secret dari bundle JS ───────────────────────────
// Pola ini bisa perlu disesuaikan jika bundle situs berubah signifikan.
// Pantau: jika get-secret gagal ekstrak, kemungkinan pola di bawah sudah tidak valid.
const SECRET_PATTERNS = [
  // Pola eksplisit: APP_SECRET="<hash>", appSecret:"<hash>", dll.
  /(?:APP[_-]?SECRET|appSecret|app_secret)\s*[:=]\s*["']([a-f0-9]{24,64})["']/i,
  // Pola header X-App-Secret yang di-hardcode di bundle
  /["']X-App-Secret["']\s*:\s*["']([a-f0-9]{24,64})["']/i,
  // Pola dengan nama variabel pendek yang umum di minified bundle
  /\bsecret\s*[:=]\s*["']([a-f0-9]{24,64})["']/i,
  // Pola baru: variabel pendek di bundle Vite (we, xe, dll)
  /\b(?:we|xe|ye|ze)\s*=\s*["']([a-f0-9]{32})["']/i,
  // Pola generik: variable = "32-char-hex"
  /\b[a-z]{1,3}\s*=\s*["']([a-f0-9]{32})["']/i,
];

const SALT_PATTERNS = [
  // Pola eksplisit: DOUJIN_SALT="...", salt:"...", SALT="..."
  /(?:DOUJIN[_-]SALT|doujin[_-]salt)\s*[:=]\s*["']([^"']{16,120})["']/i,
  /\bsalt\s*[:=]\s*["'](doujin[^"']{10,100})["']/i,
  /\bsalt\s*[:=]\s*["']([a-zA-Z0-9_\-]{20,120})["']/i,
  // Pola baru: variabel pendek di bundle Vite (Wi, Xi, dll)
  /\b(?:Wi|Xi|Yi|Zi)\s*=\s*["'](doujin[^"']{16,120})["']/i,
  // Pola generik: variable = "doujin...salt..."
  /\b[a-zA-Z]{1,3}\s*=\s*["'](doujin[^"']{16,120})["']/i,
];

// ── Cari nilai dari daftar pola ───────────────────────────────────────────────
function extractFromBundle(content, patterns) {
  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match?.[1]) return match[1];
  }
  return null;
}

// ── Update atau tambahkan key di .env ─────────────────────────────────────────
function updateEnv(envPath, updates) {
  let content = '';

  if (fs.existsSync(envPath)) {
    content = fs.readFileSync(envPath, 'utf8');
  }

  for (const [key, value] of Object.entries(updates)) {
    const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const linePattern = new RegExp(`^${escapedKey}=.*$`, 'm');

    if (linePattern.test(content)) {
      content = content.replace(linePattern, `${key}=${value}`);
    } else {
      // Tambahkan baris baru di akhir file
      if (content.length > 0 && !content.endsWith('\n')) content += '\n';
      content += `${key}=${value}\n`;
    }
  }

  fs.writeFileSync(envPath, content, 'utf8');
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const chromePath = resolveChromePath();
  console.log(`[get-secret] Menggunakan Chrome: ${chromePath}`);
  console.log(`[get-secret] Target: ${TARGET_URL}`);

  let browser;
  const bundleContents = [];
  let foundSecret = null;
  let foundSalt = null;
  let foundInUrl = '';

  try {
    browser = await puppeteer.launch({
      executablePath: chromePath,
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
    });

    const page = await browser.newPage();

    // Set User-Agent agar tidak terdeteksi sebagai bot
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    );

    // Intersep semua respons JS untuk scrape bundle
    page.on('response', async (response) => {
      const url = response.url();
      const contentType = response.headers()['content-type'] || '';

      // Tangkap SEMUA file JS
      if (contentType.includes('javascript')) {
        try {
          const text = await response.text();
          // Log semua JS untuk debug
          if (text.length > 1000) {
            bundleContents.push({ url, text });
            console.log(`[get-secret] JS found: ${url.split('/').pop()} (${text.length} chars)`);
          }
        } catch {
          // Abaikan jika gagal baca response (sudah consumed)
        }
      }
    });

    console.log('[get-secret] Membuka situs...');

    try {
      const response = await page.goto(TARGET_URL, {
        waitUntil: 'networkidle2',
        timeout: 60_000,
      });

      // Cek HTML response untuk inline scripts/meta tags
      const html = await response.text();
      console.log('[get-secret] HTML length:', html.length);
      
      // Cari patterns di HTML
      const htmlSecret = extractFromBundle(html, SECRET_PATTERNS);
      const htmlSalt = extractFromBundle(html, SALT_PATTERNS);
      
      if (htmlSecret) {
        console.log('[get-secret] DOUJIN_APP_SECRET ditemukan di HTML response!');
        foundSecret = htmlSecret;
      }
      if (htmlSalt) {
        console.log('[get-secret] DOUJIN_SALT ditemukan di HTML response!');
        foundSalt = htmlSalt;
      }

      // Cek inline scripts
      const scriptMatches = html.match(/<script[^>]*>([\s\S]*?)<\/script>/gi);
      if (scriptMatches) {
        for (const script of scriptMatches) {
          const content = script.replace(/<\/?script[^>]*>/gi, '');
          if (content.length > 100) {
            const s = extractFromBundle(content, SECRET_PATTERNS);
            const sa = extractFromBundle(content, SALT_PATTERNS);
            if (s) {
              console.log('[get-secret] DOUJIN_APP_SECRET ditemukan di inline script!');
              foundSecret = s;
            }
            if (sa) {
              console.log('[get-secret] DOUJIN_SALT ditemukan di inline script!');
              foundSalt = sa;
            }
          }
        }
      }

    } catch (err) {
      if (err.name === 'TimeoutError') {
        console.warn('[get-secret] Timeout menunggu networkidle2, mencoba lanjutkan dengan bundle yang sudah dikumpulkan...');
      } else {
        throw err;
      }
    }

    // Tunggu lebih lama untuk bundle lazy-loaded
    await new Promise((r) => setTimeout(r, 5000));

    // Scroll untuk memicu lazy loading
    await page.evaluate(() => {
      return new Promise(resolve => {
        let totalHeight = 0;
        const distance = 100;
        const timer = setInterval(() => {
          window.scrollBy(0, distance);
          totalHeight += distance;
          if (totalHeight >= document.body.scrollHeight) {
            clearInterval(timer);
            resolve();
          }
        }, 100);
      });
    });

    // Tunggu sebentar setelah scroll
    await new Promise((r) => setTimeout(r, 3000));

  } finally {
    if (browser) {
      await browser.close();
      console.log('[get-secret] Browser ditutup.');
    }
  }

  if (bundleContents.length === 0) {
      console.error('[get-secret] ✗ Tidak ada bundle JS yang berhasil diunduh.');
      console.error('[get-secret] Kemungkinan penyebab: situs tidak dapat diakses, Chrome tidak ditemukan, atau situs memblokir headless browser.');
      process.exit(1);
    }

    // Debug: tampilkan preview bundle pertama
    for (const { url, text } of bundleContents) {
      console.log(`[get-secret] Bundle: ${url.split('/').pop()} (${text.length} chars)`);
      console.log(`[get-secret] Preview: ${text.slice(0, 500)}`);
    }

    console.log(`[get-secret] ${bundleContents.length} bundle JS ditemukan, mulai ekstraksi...`);

  for (const { url, text } of bundleContents) {
    if (!foundSecret) {
      const secret = extractFromBundle(text, SECRET_PATTERNS);
      if (secret) {
        foundSecret = secret;
        foundInUrl = url;
        console.log(`[get-secret] DOUJIN_APP_SECRET ditemukan di: ${url.split('/').pop()}`);
      }
    }

    if (!foundSalt) {
      const salt = extractFromBundle(text, SALT_PATTERNS);
      if (salt) {
        foundSalt = salt;
        if (!foundInUrl) foundInUrl = url;
        console.log(`[get-secret] DOUJIN_SALT ditemukan di: ${url.split('/').pop()}`);
      }
    }

    if (foundSecret && foundSalt) break;
  }

  // ── Laporan hasil ─────────────────────────────────────────────────────────
  if (!foundSecret && !foundSalt) {
    console.error('\n[get-secret] ✗ Gagal mengekstrak APP_SECRET maupun SALT dari bundle.');
    console.error('[get-secret] Kemungkinan penyebab:');
    console.error('  1. Pola regex sudah tidak cocok karena bundle situs diperbarui (obfuscation berubah).');
    console.error('  2. Situs menggunakan teknik anti-bot yang memblokir Puppeteer.');
    console.error('  3. Nama variabel di bundle telah diubah.');
    console.error('\n[get-secret] Langkah debug:');
    console.error('  - Buka DevTools situs secara manual dan cari "X-App-Secret" atau "appSecret" di Sources.');
    console.error('  - Update pola regex di SECRET_PATTERNS dan SALT_PATTERNS di scripts/get-secret.js.');
    console.error('  - Catat perubahan di docs/04-progress-log/changelog.md.');
    process.exit(1);
  }

  const updates = {};

  if (foundSecret) {
    updates['DOUJIN_APP_SECRET'] = foundSecret;
  } else {
    console.warn('[get-secret] ⚠ DOUJIN_APP_SECRET tidak ditemukan — nilai di .env tidak diubah.');
  }

  if (foundSalt) {
    updates['DOUJIN_SALT'] = foundSalt;
  } else {
    console.warn('[get-secret] ⚠ DOUJIN_SALT tidak ditemukan — nilai di .env tidak diubah.');
  }

  if (Object.keys(updates).length > 0) {
    updateEnv(ENV_PATH, updates);
    console.log(`\n[get-secret] ✓ .env berhasil diperbarui: ${ENV_PATH}`);
    for (const [key, value] of Object.entries(updates)) {
      // Tampilkan sebagian nilai saja untuk keamanan
      const preview = value.length > 8 ? `${value.slice(0, 8)}...` : value;
      console.log(`  ${key}=${preview} (${value.length} karakter)`);
    }
    console.log('\n[get-secret] Restart server atau jalankan ulang demo untuk menggunakan key baru.');
  }
}

main().catch((err) => {
  console.error('[get-secret] Error tidak terduga:', err.message);
  process.exit(1);
});
