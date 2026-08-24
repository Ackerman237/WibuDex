export function validatePage(value) {
  const num = parseInt(value, 10);
  if (!Number.isFinite(num) || num < 1) return 1;
  if (num > 1000) return 1000;
  return num;
}

export function validateLimit(value) {
  const num = parseInt(value, 10);
  if (!Number.isFinite(num) || num < 1) return 10;
  if (num > 100) return 100;
  return num;
}

export function validateQuery(value) {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (trimmed.length === 0) return '';
  if (trimmed.length > 200) return trimmed.slice(0, 200);
  return trimmed;
}

export function validateSlug(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().replace(/^["']+|["']+$/g, '');
  if (trimmed.length === 0 || trimmed.length > 200) return null;
  // Izinkan spasi dan karakter umum pada slug/judul manga seperti "a-wonderful-new-world" atau dengan spasi
  if (!/^[a-zA-Z0-9\-_.~%\s]+$/.test(trimmed)) return null;
  return trimmed;
}

export function validateId(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > 100) return null;
  return trimmed;
}

export function validateCategory(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > 100) return null;
  return trimmed;
}

/**
 * Validasi daftar genre koma-separated (multi-select katalog).
 * Setiap item wajib slug lowercase [a-z0-9-] ≤50 char; duplikat & item
 * invalid dibuang; hasil dipotong ke `max` (default 6) item pertama.
 * @param {unknown} value - Nilai mentah dari query param (attacker-controlled)
 * @param {number} [max=6]
 * @returns {string|null} "slug1,slug2" atau null bila tidak ada yang valid
 */
export function validateCategoryList(value, max = 6) {
  if (typeof value !== 'string') return null;
  const seen = new Set();
  for (const raw of value.split(',')) {
    const slug = raw.trim().toLowerCase();
    if (!/^[a-z0-9-]{1,50}$/.test(slug)) continue;
    seen.add(slug);
    if (seen.size >= max) break;
  }
  return seen.size > 0 ? [...seen].join(',') : null;
}

export function validateEnum(value, allowed, fallback) {
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim().toLowerCase();
  return allowed.has(normalized) ? normalized : fallback;
}

export function validateUrl(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    return trimmed;
  } catch {
    return null;
  }
}
