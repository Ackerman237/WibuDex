// neko/parsers/detail.js — Parser halaman detail: player, episode, related.
import logger from '../../../logger.js';
import { isAllowedPlayerHost } from '../../../config/playerHosts.js';
import { cleanText, stripHtml, safeUrl } from '../text.js';

export function parsePlayers(html) {
  const players = [];
  const iframeRe = /<iframe[^>]+src=["']([^"']+)["'][^>]*>/gi;
  iframeRe.lastIndex = 0;
  let match;
  while ((match = iframeRe.exec(html))) {
    const raw = match[1].startsWith('http') ? match[1] : `https:${match[1]}`;
    const clean = safeUrl(raw);
    if (!clean) continue;
    let host = '';
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

    const titleMatch =
      inner.match(/<h\d[^>]*>([\s\S]*?)<\/h\d>/i) ||
      inner.match(/alt=["']([^"']+)["']/i) ||
      inner.match(/title=["']([^"']+)["']/i);
    const rawTitle = titleMatch ? titleMatch[1] : '';
    const title = cleanText(rawTitle || stripHtml(inner));
    if (!title || title.length > 200) continue;

    seen.add(slug);
    items.push({ title, slug, url: safeUrl(url) });
    if (items.length >= 50) break;
  }
  return items;
}

// ===== Parser blok rekomendasi/related di halaman detail =====
// Struktur bervariasi antar post — parser defensif: cari heading yang mengandung
// kata kunci, lalu kumpulkan anchor internal sampai heading berikutnya.
export function parseRelated(html) {
  const sectionMatch = html.match(
    /<h[23][^>]*>[^<]*(?:rekomendasi|related|recommend|serupa)[^<]*<\/h[23]>([\s\S]*?)(?=<h[12][^>]*|<footer|$)/i
  );
  if (!sectionMatch) return [];

  const block = sectionMatch[1];
  const items = [];
  const seen = new Set();
  const anchorRe = /<a\s+href="(https?:\/\/nekopoi\.care\/[^"#]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = anchorRe.exec(block))) {
    const url = match[1];
    const inner = match[2];
    if (/category\/|tag\/|page\/|genre-list|#/.test(url)) continue;

    // Judul: prioritas <h2/h3>, lalu alt attribute img, terakhir teks anchor
    const titleMatch =
      inner.match(/<h\d[^>]*>([\s\S]*?)<\/h\d>/i) ||
      inner.match(/alt=["']([^"']+)["']/i) ||
      inner.match(/title=["']([^"']+)["']/i);
    const rawTitle = titleMatch ? titleMatch[1] : '';
    const title = cleanText(rawTitle || stripHtml(inner));
    if (!title) continue;

    const imgMatch =
      inner.match(/<img[^>]+src=["']([^"']+)["']/i) ||
      inner.match(/background-image:\s*url\(['"]?([^'")]+)/i);
    const thumb = imgMatch ? safeUrl(imgMatch[1]) : '';

    const slug = url.split('/').filter(Boolean).pop() || '';
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);

    items.push({ title, slug, url: safeUrl(url), thumb });
    if (items.length >= 8) break;
  }
  return items;
}
