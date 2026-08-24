// Utilitas keamanan bersama: sanitasi URL dan HTML untuk konten eksternal.

export function sanitizeUrl(rawUrl) {
  if (typeof rawUrl !== 'string') return '';

  const trimmed = rawUrl.trim();

  if (/^\s*(javascript|data|vbscript):/i.test(trimmed)) return '';

  return trimmed;
}


export function stripHtml(raw) {
  if (typeof raw !== 'string') return '';

  return raw
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    // Pemisah blok jadi newline dulu, agar teks tidak menempel saat tag dibuang
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}


export function isPrivateHost(hostname) {
  if (!hostname) return true;

  const host = hostname.toLowerCase();

  if (
    host === 'localhost' ||
    host === '::1'
  ) {
    return true;
  }

  const ipv4Private = [
    /^127\./,
    /^10\./,
    /^192\.168\./,
    /^169\.254\./,
    /^172\.(1[6-9]|2\d|3[0-1])\./
  ];

  return ipv4Private.some(rule => rule.test(host));
}

const ALLOWED_IMAGE_DOMAIN_SUFFIXES = [
  "desu.pics",
  "desu.xxx"
];

export function isAllowedImageHost(hostname) {
  if (!hostname) return false;

  const host = hostname.toLowerCase();

  return ALLOWED_IMAGE_DOMAIN_SUFFIXES.some((suffix) => {
    return host === suffix || host.endsWith(`.${suffix}`);
  });
}

// safeHttpUrl — validasi URL generik: protokol http(s) + bukan host privat (SSRF).
// TIDAK ada allowlist domain di sini; untuk URL gambar doujin gunakan safeImageUrl().
export function safeHttpUrl(rawUrl) {
  const cleaned = sanitizeUrl(rawUrl);

  if (!cleaned) return '';

  try {
    const url = new URL(cleaned);

    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return '';
    }

    if (isPrivateHost(url.hostname)) {
      return '';
    }

    return url.href;

  } catch {
    return '';
  }
}

// safeImageUrl — safeHttpUrl + allowlist domain gambar doujin.
// Pemisahan ini memperbaiki desain lama di mana safeHttpUrl() bernama generik
// tapi diam-diam membuang semua URL di luar desu.pics/desu.xxx.
export function safeImageUrl(rawUrl) {
  const url = safeHttpUrl(rawUrl);
  if (!url) return '';

  try {
    return isAllowedImageHost(new URL(url).hostname) ? url : '';
  } catch {
    return '';
  }
}