// neko/text.js — Util teks & URL untuk parser HTML nekopoi.
//
// Catatan desain: stripHtml() di sini sengaja TIDAK didelegasikan ke
// security.stripHtml() — versi security mempertahankan struktur baris baru
// (untuk dokumen), sedangkan parser judul butuh collapse semua whitespace.

// Diekspor untuk unit test regresi (pernah korup: entity &amp;/&quot; menjadi
// no-op replace yang mengganti karakter dengan dirinya sendiri).
export function decodeEntities(s = '') {
  return String(s)
    .replace(/&#8211;/g, '–')
    .replace(/&#8217;/g, '’')
    .replace(/&#8216;/g, '‘')
    .replace(/&#8220;/g, '“')
    .replace(/&#8221;/g, '”')
    .replace(/&#8230;/g, '…')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    // &amp; HARUS paling akhir agar tidak double-decode (mis. "&amp;quot;" → "&quot;" → '"')
    .replace(/&amp;/g, '&')
    .trim();
}

export function stripHtml(raw = '') {
  return String(raw)
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function cleanText(raw = '') {
  return decodeEntities(stripHtml(raw));
}

export function safeUrl(raw) {
  if (!raw) return '';
  const candidate = String(raw).trim();
  if (/^(javascript|data|vbscript):/i.test(candidate)) return '';
  const normalized = candidate.startsWith('//') ? `https:${candidate}` : candidate;
  try {
    const url = new URL(normalized);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return '';
    return url.href;
  } catch {
    return '';
  }
}
