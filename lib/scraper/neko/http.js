// neko/http.js — Lapisan fetch HTML nekopoi: VPN routing, timeout, retry transien.
import { ensureVpn, reportFailure, reportSuccess } from '../../vpn/vpn-manager.js';
import { USER_AGENT } from '../../constants.js';
import { safeUrl } from './text.js';

export const BASE = 'https://nekopoi.care';

const VPN_SETTLE_DELAY_MS = 1500;
const HTML_TIMEOUT_MS = 15000;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Regresi BUG-2 lama: retry memakai ulang AbortController yang timernya sudah
// di-clear sehingga retry berjalan TANPA timeout (bisa hang selamanya).
// Kini tiap percobaan fetch membuat controller + timer sendiri.
async function fetchHtmlText(fullUrl, route, path) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), HTML_TIMEOUT_MS);
  try {
    const res = await fetch(fullUrl, { ...buildFetchOptions(route), signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status} untuk ${path}`);
    return await res.text();
  } finally {
    clearTimeout(timeoutId);
  }
}

function buildFetchOptions(route) {
  const options = {
    method: 'GET',
    headers: {
      'User-Agent': USER_AGENT,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
      'Referer': BASE,
    },
  };
  // Catatan: global fetch mengabaikan opsi `agent` — hanya `dispatcher`
  // (undici ProxyAgent) yang efektif untuk proxy.
  if (route.dispatcher) options.dispatcher = route.dispatcher;
  return options;
}

function isTransientNetworkError(error) {
  // EACCES/ECONNREFUSED = koneksi telnet sebelum VPN siap; ETIMEDOUT & Cloudflare
  // challenge = transien. Sama seperti pola doujinScraper.js.
  return Boolean(
    error.code === 'EACCES' ||
      error.code === 'ECONNREFUSED' ||
      error.message?.includes('ETIMEDOUT') ||
      error.message?.includes('Performing security verification')
  );
}

function timeoutError(path) {
  return new Error(`Timeout ${HTML_TIMEOUT_MS / 1000} detik saat mengakses ${path}`);
}

export async function getHtml(path) {
  const fullUrl = path.startsWith('http') ? path : `${BASE}${path}`;

  // Percobaan 1: route aktif
  const route = await ensureVpn('neko');
  try {
    const text = await fetchHtmlText(fullUrl, route, path);
    reportSuccess('neko');
    return text;
  } catch (error) {
    if (error.name === 'AbortError') throw timeoutError(path);
    if (!isTransientNetworkError(error)) throw error;

    // Percobaan 2: sambungkan VPN baru + settle delay (dengan timeout sendiri)
    reportFailure('neko', error);
    const newRoute = await ensureVpn('neko');
    if (newRoute?.provider) await delay(VPN_SETTLE_DELAY_MS);
    try {
      const text = await fetchHtmlText(fullUrl, newRoute, path);
      reportSuccess('neko');
      return text;
    } catch {
      // Retry gagal — lempar error ASLI agar penyebab pertama tidak tertimpa
      if (error.name === 'AbortError') throw timeoutError(path);
      throw error;
    }
  }
}

// ===== Acak (mengikuti redirect /random ke post acak) =====
export async function resolveRandomSlug(route) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), HTML_TIMEOUT_MS);

  try {
    const fetchOptions = {
      method: 'GET',
      redirect: 'manual',
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,*/*;q=0.8',
        Referer: `${BASE}/`,
      },
      signal: controller.signal,
    };
    if (route.dispatcher) fetchOptions.dispatcher = route.dispatcher;

    const res = await fetch(`${BASE}/random`, fetchOptions);
    clearTimeout(timeoutId);

    const location = res.headers.get('location') || '';
    const finalUrl = safeUrl(location.startsWith('http') ? location : `${BASE}${location}`);
    if (finalUrl && finalUrl !== `${BASE}/`) {
      const slug = finalUrl.split('/').filter(Boolean).pop() || '';
      if (slug) return { slug, url: finalUrl };
    }
    throw new Error('Redirect /random tidak menghasilkan post');
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

export async function getRandomWithRetry() {
  let route = await ensureVpn('neko');
  try {
    return await resolveRandomSlug(route);
  } catch (err) {
    await reportFailure('neko', err);
    try {
      route = await ensureVpn('neko');
      if (route?.provider) await delay(VPN_SETTLE_DELAY_MS);
      return await resolveRandomSlug(route);
    } catch {
      // Retry gagal — lempar error ASLI agar penyebab pertama tidak tertimpa
      throw err;
    }
  }
}
