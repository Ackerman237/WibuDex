// neko/parsers/detail.js — Parser halaman detail: player, episode, related.
import logger from '../../../logger.js';
import { isAllowedPlayerHost } from '../../../config/playerHosts.js';
import { safeUrl } from '../text.js';
import { extractAnchorItem } from './anchors.js';

export function parsePlayers(html) {
  const players = [];
  const iframeRe = /<iframe[^>]+src=["']([^"']+)["'][^>]*>/gi;
  iframeRe.lastIndex = 0;
  let match;
  while ((match = iframeRe.exec(html))) {
    const raw = match[1].startsWith('http') ? match[1] : `https:${match[1]}`;
    const clean = safeUrl(raw);
    if (!clean) continue;
    let host;
    try {
      host = new URL(clean).hostname;
    } catch {
      continue;
    }
    if (isAllowedPlayerHost(host)) {
      players.push(clean);
    } else {
      // Catat agar update allowlist di lib/config/playerHosts.js bisa berdasar data nyata
      logger.warn({ host, url: clean }, 'Iframe player dilewati: host tidak ada di allowlist');
    }
  }
  return [...new Set(players)];
}

// ===== Parser daftar episode pada halaman seri =====
// Halaman seri (mis. hasil tombol acak yang mendarat di koleksi) tidak memuat
// iframe player, hanya link ke post episode lain. Parser defensif: kumpulkan
// anchor internal dari konten utama, buang nav/kategori/related/slug sendiri.
export function parseEpisodes(html, currentSlug) {
  const items = [];
  const seen = new Set();

  // Batasi ke konten utama bila polanya dikenali; kalau tidak, pakai seluruh dokumen
  const contentMatch =
    html.match(/<div[^>]+class=["'][^"']*(?:entry-content|post-content|single-content)[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
  const scope = contentMatch ? contentMatch[1] : html;

  const anchorRe = /<a\s+href="(https?:\/\/nekopoi\.care\/[^"#]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = anchorRe.exec(scope))) {
    const url = match[1];
    const inner = match[2];
    if (/category\/|tag\/|page\/|genre-list|hentai-list|jav-list|jadwal|#|\.(png|jpg|jpeg|gif|css|js)/i.test(url)) continue;

    const slug = url.split('/').filter(Boolean).pop() || '';
    if (!slug || slug === currentSlug || seen.has(slug)) continue;

    const item = extractAnchorItem(url, inner, { maxTitleLength: 200, withThumb: false });
    if (!item) continue;

    seen.add(slug);
    items.push({ title: item.title, slug, url: item.url });
    if (items.length >= 50) break;
  }
  return items;
}

// ===== Kumpulan thumbnail per-slug dari SELURUH halaman =====
// Dua pola nyata upstream:
//   1) div.ltd(style="background-image:url(THUMB)") > a(href=...)
//   2) <a href=...><img src=THUMB …>
// Dipakai untuk meng-enrich episodes yang tidak punya thumb sendiri.
export function collectPageThumbs(html) {
  const map = {};
  const pairRe =
    /class=["'][^"']*ltd[^"']*["'][^>]*style=["'][^"']*background-image:\s*url\(['"]?([^'")]+)['"]?\)[^"']*["'][^>]*>\s*(?:<\/div>\s*)?<a[^>]+href="(https?:\/\/nekopoi\.care\/[^"#]+)"/gi;
  let m;
  while ((m = pairRe.exec(html))) {
    const slug = m[2].split('/').filter(Boolean).pop();
    if (slug && !map[slug]) {
      const u = safeUrl(m[1]);
      if (u) map[slug] = u;
    }
  }
  const imgRe =
    /<a\s+href="(https?:\/\/nekopoi\.care\/[^"#]+)"[^>]*>\s*<img[^>]*\bsrc=["']([^"']+)["']/gi;
  while ((m = imgRe.exec(html))) {
    const slug = m[1].split('/').filter(Boolean).pop();
    if (slug && !map[slug]) {
      const u = safeUrl(m[2]);
      if (u) map[slug] = u;
    }
  }
  return map;
}

// ===== Parser blok rekomendasi/related di halaman detail =====
// Struktur nyata upstream 2026-08: per <li> berisi
//   div.ltd(style="background-image:url(THUMB)") > a(kosong, href+title)
//   div.nf > h2 > a(JUDUL)
// Karena anchor pertama KOSONG, ekstraksi per-anchor tidak menangkap
// thumbnail — maka parser iterasi per <li> dan membaca ketiga sumber.
export function parseRelated(html) {
  // Utama: kontainer .related-list--info (struktur nyata upstream 2026-08).
  // Fallback: pendekatan heading untuk struktur lama.
  const listMatch = html.match(
    /class=["'][^"']*related-list--info[^"']*["'][^>]*>([\s\S]*?)(?:<\/ul>|$)/i
  );
  const sectionMatch = html.match(
    /<h[23][^>]*>[^<]*(?:rekomendasi|related|recommend|serupa)[^<]*<\/h[23]>([\s\S]*?)(?=<h[12][^>]*|<footer|$)/i
  );
  const block = listMatch ? listMatch[1] : sectionMatch ? sectionMatch[1] : '';
  if (!block) return [];

  const items = [];
  const seen = new Set();
  const liRe = /<li[\s\S]*?<\/li>/gi;
  let match;
  while ((match = liRe.exec(block))) {
    const li = match[0];

    const urlM = li.match(/href="(https?:\/\/nekopoi\.care\/[^"#]+)"/i);
    if (!urlM) continue;
    const url = urlM[1];
    if (/category\/|tag\/|page\/|genre-list/.test(url)) continue;

    const slug = url.split('/').filter(Boolean).pop() || '';
    if (!slug || seen.has(slug)) continue;

    // Judul: h2 > a di dalam li, fallback title= attribute
    const titleM =
      li.match(/<h\d[^>]*>\s*<a[^>]*>([\s\S]*?)<\/a>/i) ||
      li.match(/title=["']([^"']+)["']/i);
    const rawTitle = titleM ? titleM[1] : '';
    // Decode entity umum (&#8211; dsb.)
    const title = rawTitle
      .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, '&')
      .trim();
    if (!title) continue;

    // Thumbnail dari background-image div.ltd
    const thumbM = li.match(/background-image:\s*url\(['"]?([^'")]+)/i);
    const thumb = thumbM ? safeUrl(thumbM[1]) : '';

    seen.add(slug);
    items.push({ title, slug, url: safeUrl(url), thumb });
    if (items.length >= 12) break;
  }
  return items;
}

// ===== Meta video dari <meta name="description"> =====
// Upstream menaruh blok "Original Title : … Producers : … Duration : …
// Genre : A, B, C" di meta description (terverifikasi live 2026-08-24).
const ENTITIES = { quot: '"', amp: '&', apos: "'", lt: '<', gt: '>' };
function decodeEntities(str) {
  return String(str)
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&(quot|amp|apos|lt|gt);/g, (_, name) => ENTITIES[name]);
}

export function parseVideoMeta(html) {
  const descM = html.match(
    /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i
  );
  if (!descM) return {};
  const content = decodeEntities(descM[1]);

  const grab = (label) => {
    const m = content.match(new RegExp(`${label}\\s*:\\s*([^<]+?)(?=\\s*(?:${[
      'Original Title', 'Producers', 'Duration', 'Genre', 'Skor', '$',
    ].join('|')})\\s*:|$)`, 'i'));
    return m ? m[1].replace(/\s+/g, ' ').trim() : '';
  };

  const genresStr = grab('Genre');
  const genres = genresStr
    ? genresStr
        .split(/[,/]/)
        .map((g) => g.replace(/\.{2,}\s*$/, '').trim()) // buang elipsis "...", "...."
        .filter(Boolean)
    : [];

  const out = {};
  if (genres.length) out.genres = genres;
  const duration = grab('Duration');
  if (duration) out.duration = duration;
  const producers = grab('Producers');
  if (producers) out.producers = producers;
  const originalTitle = grab('Original Title');
  if (originalTitle) out.originalTitle = originalTitle;
  return out;
}
