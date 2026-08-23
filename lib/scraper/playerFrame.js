// playerFrame.js — Reverse-proxy transformasi halaman embed penyedia video neko.
// ISOLASI PENUH: modul ini tidak mengimpor scraper/VPN manapun agar mudah di-roll back.
import { execFile } from 'child_process';
import { promisify } from 'util';
import logger from '../logger.js';
import { USER_AGENT } from '../constants.js';
// Allowlist dari satu sumber kebenaran; re-export demi kompatibilitas konsumen lama
import { PLAYER_HOSTS, isAllowedPlayerHost } from '../config/playerHosts.js';
export { PLAYER_HOSTS };

const execFileAsync = promisify(execFile);

const CHROME_UA = USER_AGENT;

// Domain script iklan/popunder yang dibuang dari <script src="...">
const AD_SRC_DOMAINS = [
  'hikerfaquirs.com',
  'wearadmiration.com',
  'tsyndicate.com',
  'badlandlispyippee.com',
  'bowsguaka.cfd',
  'df6pt2obl092n.cloudfront.net',
  'blockadsnot.com',
  'propellerads',
  'popads',
];

// Penanda konten inline <script> yang dibuang:
// - penghukum adblock ("The publisher doesnt allow adblock")
// - checker redirect /blocked & /embedblocked
// - DisableDevtool
// - loader popunder base64 (config "popundersPerIP")
// - loader WebAssembly terobfuscasi (marker "hbvqq" / wasm-base64 "AGFzbQE")
const INLINE_STRIP_MARKERS = [
  'The publisher doesnt allow adblock',
  '/embedblocked?referer=',
  'DisableDevtool',
  'popundersPerIP',
  'hbvqq(',
  '"AGFzbQE',
];

export function isAllowedPlayerUrl(rawUrl) {
  try {
    const url = new URL(String(rawUrl));
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    return isAllowedPlayerHost(url.hostname) ? url.href : null;
  } catch {
    return null;
  }
}

export function stripAdScripts(html) {
  return String(html).replace(
    /<script\b([^>]*)>([\s\S]*?)<\/script>/gi,
    (match, attrs, body) => {
      const srcMatch = attrs.match(/src\s*=\s*["']([^"']+)["']/i);
      if (srcMatch) {
        const src = srcMatch[1].toLowerCase();
        if (AD_SRC_DOMAINS.some((d) => src.includes(d))) return '';
        // Buat sisa atribut on* yang merujuk loader iklan tidak berbahaya
        return match.replace(/\son(?:error|load)\s*=\s*["'][^"']*hbvqq[^"']*["']/gi, '');
      }
      if (INLINE_STRIP_MARKERS.some((k) => body.includes(k))) return '';
      return match;
    }
  );
}

function stealthShim(providerHost, refererUrl) {
  return [
    `<base href="https://${providerHost}/">`,
    '<script>(function(){',
    `try{Object.defineProperty(document,'referrer',{get:function(){return ${JSON.stringify(refererUrl)};},configurable:true});}catch(e){}`,
    'window.googleAd=window.googleAd||{};',
    'window.hab=function(){return false;};',
    `var ROUTE='/pf/${providerHost}';`,
    '(function poll(){',
    'var jq=window.jQuery||window.$;',
    'if(jq&&jq.get&&!jq.__pfPatched){',
    'var orig=jq.get;',
    'jq.get=function(url){if(typeof url==="string"&&url.charAt(0)==="/"){url=ROUTE+url;}return orig.apply(this,arguments);};',
    'jq.__pfPatched=true;}',
    'setTimeout(poll,10);})();',
    '})();</script>',
  ].join('');
}

export function buildPlayerFrameHtml({ html, providerHost, slug }) {
  const refererUrl = slug
    ? `https://nekopoi.care/${String(slug).replace(/^\/+|\/+$/g, '')}/`
    : 'https://nekopoi.care/';

  let cleaned = stripAdScripts(html);
  const injection = stealthShim(providerHost, refererUrl);

  const headMatch = cleaned.match(/<head[^>]*>/i);
  if (headMatch) {
    cleaned = cleaned.replace(/<head[^>]*>/i, (m) => m + injection);
  } else {
    cleaned = injection + cleaned;
  }
  return cleaned;
}

export async function fetchProviderEmbed(url, { slug, timeoutMs = 20000 } = {}) {
  const headers = {
    'User-Agent': CHROME_UA,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
    Referer: slug ? `https://nekopoi.care/${slug}/` : 'https://nekopoi.care/',
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers, signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } catch (err) {
    clearTimeout(timer);
    logger.warn({ err, url }, 'playerFrame: fetch langsung gagal, coba curl');
    // Strategi 2: curl.exe — fingerprint TLS-nya lolos Cloudflare (terbukti untuk playmogo)
    try {
      return await fetchViaCurl(url, { slug, timeoutMs });
    } catch (curlErr) {
      logger.warn({ err: curlErr, url }, 'playerFrame: curl gagal, fallback Puppeteer');
      return fetchViaPuppeteer(url, { slug, timeoutMs });
    }
  } finally {
    clearTimeout(timer);
  }
}

async function fetchViaCurl(url, { slug, timeoutMs }) {
  const refererUrl = slug ? `https://nekopoi.care/${slug}/` : 'https://nekopoi.care/';
  const args = [
    '-s', '-L', '--compressed',
    '-m', String(Math.max(5, Math.ceil(timeoutMs / 1000))),
    '-A', CHROME_UA,
    '-e', refererUrl,
    url,
  ];
  const { stdout } = await execFileAsync('curl.exe', args, {
    maxBuffer: 10 * 1024 * 1024,
    windowsHide: true,
  });
  if (!stdout || stdout.length < 200) throw new Error('curl: respons terlalu pendek/kosong');
  return stdout;
}

async function fetchViaPuppeteer(url, { slug, timeoutMs }) {
  const { newPage } = await import('../browser.js');
  const refererUrl = slug ? `https://nekopoi.care/${slug}/` : 'https://nekopoi.care/';
  let page;
  try {
    page = await newPage();
    await page.setUserAgent(CHROME_UA);
    await page.setExtraHTTPHeaders({ Referer: refererUrl, 'Accept-Language': 'id-ID,id;q=0.9' });
    // Spoof document.referrer SEBELUM skrip penyedia dieksekusi
    await page.evaluateOnNewDocument((ref) => {
      try {
        Object.defineProperty(document, 'referrer', { get: () => ref, configurable: true });
      } catch (e) {}
    }, refererUrl);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
    await new Promise((r) => setTimeout(r, 2500));
    return await page.content();
  } finally {
    if (page) await page.close().catch(() => {});
  }
}
