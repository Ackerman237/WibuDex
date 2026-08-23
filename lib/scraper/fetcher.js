import { ProxyAgent } from 'undici';
import logger from '../logger.js';

const REQUEST_TIMEOUT_MS = 12000;
const MAX_RETRIES = 2;
const MAX_CONCURRENCY = 5;
const RETRYABLE_STATUS = new Set([502, 503, 504]);

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

let activeCount = 0;
const queue = [];

// P1 (fix): global fetch Node.js (undici) MENGABAIKAN opsi `agent` — itu API
// node-fetch. Satu-satunya jalur proxy yang benar adalah `dispatcher`.
// Dispatcher di-cache agar tidak dibuat ulang per request.
let cachedDispatcher = null;
let cachedProxyUrl = '';

function maskUrl(url) {
  return url.replace(/\/\/[^@]*@/, '//***@');
}

function getProxyDispatcher() {
  const proxyUrl =
    process.env.NEKO_PROXY_URL ||
    process.env.HTTPS_PROXY ||
    process.env.HTTP_PROXY ||
    process.env.ALL_PROXY ||
    '';
  if (!proxyUrl) return undefined;
  if (proxyUrl === cachedProxyUrl && cachedDispatcher) return cachedDispatcher;
  if (proxyUrl.startsWith('socks')) {
    // undici tidak mendukung SOCKS — warn eksplisit, jangan diam-diam diabaikan
    logger.warn(
      { proxyUrl: maskUrl(proxyUrl) },
      'Proxy SOCKS tidak didukung fetch bawaan Node (undici). Gunakan proxy http(s) atau VPN system-level.'
    );
    return undefined;
  }
  try {
    cachedDispatcher = new ProxyAgent(proxyUrl);
    cachedProxyUrl = proxyUrl;
    return cachedDispatcher;
  } catch (err) {
    logger.warn({ err }, 'Gagal membuat undici ProxyAgent — request berjalan tanpa proxy');
    return undefined;
  }
}

function enqueue() {
  return new Promise((resolve) => {
    queue.push(resolve);
  });
}

function release() {
  if (queue.length > 0) {
    const next = queue.shift();
    next();
  } else {
    activeCount--;
  }
}

function isRetryable(err) {
  if (err.name === 'AbortError') return true;
  if (err.message && err.message.startsWith('HTTP ')) {
    const status = parseInt(err.message.split(' ')[1], 10);
    return RETRYABLE_STATUS.has(status);
  }
  return false;
}

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function fetchJSON(url, options = {}) {
  if (activeCount >= MAX_CONCURRENCY) {
    await enqueue();
  }
  activeCount++;

  const maxRetries = options.retries ?? MAX_RETRIES;

  try {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), options.timeout || REQUEST_TIMEOUT_MS);

      try {
        const response = await fetch(url, {
          signal: controller.signal,
          dispatcher: options.dispatcher ?? getProxyDispatcher(),
          headers: {
            'User-Agent': USER_AGENT,
            Accept: 'application/json',
            ...options.headers,
          },
          ...options.fetchOptions,
        });

        clearTimeout(timeout);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        return response;
      } catch (err) {
        clearTimeout(timeout);

        if (attempt < maxRetries && isRetryable(err)) {
          await delay(1000 * (attempt + 1));
          continue;
        }

        throw err;
      }
    }
  } finally {
    release();
  }
}

export { REQUEST_TIMEOUT_MS, USER_AGENT, MAX_CONCURRENCY };
