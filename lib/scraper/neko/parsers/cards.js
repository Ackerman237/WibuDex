// neko/parsers/cards.js — Parser kartu daftar (homepage, kategori, search, series list).
import { BASE } from '../http.js';
import { cleanText, safeUrl } from '../text.js';

function makeCard(url, rawTitle, thumb, desc = '', date = '') {
  const cleanUrl = safeUrl(url);
  if (!cleanUrl || !cleanUrl.startsWith(BASE)) return null;
  const title = typeof rawTitle === 'string' ? cleanText(rawTitle) : '';
  if (!title) return null;
  return {
    title,
    slug: cleanUrl.split('/').filter(Boolean).pop() || '',
    url: cleanUrl,
    thumb: safeUrl(thumb),
    date: typeof date === 'string' ? cleanText(date) : '',
    synopsis: typeof desc === 'string' ? cleanText(desc) : '',
  };
}

// ===== Parser Utama: nk-post-card (untuk homepage) =====
export function parseCards(html) {
  const cards = [];
  const seen = new Set();

  const CARD_OPEN = 'class="nk-post-card"';
  let pos = 0;

  while (true) {
    const cardStart = html.indexOf(CARD_OPEN, pos);
    if (cardStart === -1) break;

    const divStart = html.lastIndexOf('<div', cardStart);
    if (divStart === -1) { pos = cardStart + 1; continue; }

    let depth = 0;
    let i = divStart;
    let blockEnd = -1;

    while (i < html.length) {
      if (html.startsWith('<div', i)) {
        depth++;
        i += 4;
      } else if (html.startsWith('</div>', i)) {
        depth--;
        if (depth === 0) { blockEnd = i + 6; break; }
        i += 6;
      } else {
        i++;
      }
    }

    if (blockEnd === -1) { pos = cardStart + 1; continue; }
    const block = html.slice(divStart, blockEnd);
    pos = blockEnd;

    // 1. Thumb — background-image di nk-thumb-crop
    const thumbMatch = block.match(/nk-thumb-crop[^>]*style=["'][^"']*background-image:\s*url\(['"]?([^'")]+)['"]?\)/i);
    const thumb = thumbMatch ? thumbMatch[1].trim() : '';

    // 2. URL + Title — dari <h2><a href="...">TITLE</a></h2>
    const linkMatch = block.match(/<h2[^>]*>\s*<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
    if (!linkMatch) continue;

    const url = linkMatch[1];
    const rawTitle = linkMatch[2];

    // Filter URL navigasi bukan post
    if (
      url.includes('/category/') ||
      url.includes('/page/') ||
      url.includes('/tag/') ||
      url === BASE + '/' ||
      !url.startsWith(BASE)
    ) continue;

    // 3. Date — teks setelah icon dashicons-calendar-alt di dalam span
    const dateMatch = block.match(/dashicons-calendar-alt[^<]*<\/span>([\s\S]*?)<\/span>/i);
    const date = dateMatch ? cleanText(dateMatch[1]) : '';

    const card = makeCard(url, rawTitle, thumb, '', date);
    if (card && !seen.has(card.slug)) {
      seen.add(card.slug);
      cards.push(card);
    }
  }

  // Jika homepage menghasilkan 0 card, coba parser fallback untuk kategori/search
  if (cards.length === 0) {
    cards.push(...parseSearchItems(html));
  }

  return cards;
}

// Fallback parser untuk halaman kategori/search (struktur nk-search-item)
export function parseSearchItems(html) {
  const cards = [];
  const seen = new Set();

  // Struktur asli (per 2026-08):
  // <a href="URL" class="nk-search-item">
  //   <div class="nk-search-thumb" style="background-image: url('THUMB')"></div>
  //   <div class="nk-search-info">
  //     <h2>TITLE</h2>
  //     <span class="nk-search-genres"></span>
  //     <p class="nk-search-desc">SINOPSIS</p>
  //   </div>
  // </a>
  const itemRegex = /<a\s+href="([^"]+)"[^>]*class="nk-search-item"[^>]*>[\s\S]*?nk-search-thumb[^>]*style=["'][^"']*background-image:\s*url\(['"]([^'")]+)['"]?\)[\s\S]*?<h2[^>]*>([\s\S]*?)<\/h2>[\s\S]*?(?:<p class="nk-search-desc">([\s\S]*?)<\/p>)?<\/a>/gi;
  let match;
  while ((match = itemRegex.exec(html)) !== null) {
    const url = match[1];
    const thumb = match[2];
    const title = match[3];
    const synopsis = match[4] || '';
    if (!url || !title) continue;
    if (!url.startsWith(BASE)) continue;
    const card = makeCard(url, title, thumb, synopsis, '');
    if (card && !seen.has(card.slug)) {
      seen.add(card.slug);
      cards.push(card);
    }
  }
  return cards;
}

export function parseHasNext(html, page) {
  return (
    html.includes(`/page/${page + 1}/`) ||
    /rel=["']next["']/i.test(html) ||
    /class=["'][^"']*next[^"']*["']/i.test(html)
  );
}
