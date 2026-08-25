/**
 * Scraping logic based on doujin-scraper by kyy0887
 * Original repository: https://github.com/kyy0887/doujin-scraper
 * License: MIT
 *
 * Modified/extended for use in this project.
 */
// neko/parsers/schedule.js — Parser halaman jadwal nekopoi.
// STRUKTUR BARU upstream (terverifikasi live 2026-08-24): grup berbasis
// status, bukan nama hari — heading "Hentai Yang Akan Datang" dan
// "Hentai Yang Sudah Lewat", tiap grup berisi anchor internal seri.
import { extractAnchorItem } from './anchors.js';

function grabSeries(segment, seen) {
  const items = [];
  const re =
    /<a\s+href="(https?:\/\/nekopoi\.care\/[^"#]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = re.exec(segment))) {
    const url = match[1];
    if (/category\/|tag\/|page\/|genre-list|hentai-list|jav-list|#|\.(png|jpg|jpeg|gif|css|js)/i.test(url)) continue;
    // Buang link navigasi/judul halaman jadwal sendiri
    if (/jadwal/i.test(url)) continue;
    const item = extractAnchorItem(url, match[2], { maxTitleLength: 200 });
    if (!item) continue;
    if (/jadwal/i.test(item.title)) continue;
    if (seen.has(item.slug)) continue;
    seen.add(item.slug);
    items.push({ title: item.title, slug: item.slug, thumb: item.thumb || '', url: item.url });
  }
  return items;
}

export function parseSchedule(html) {
  const lower = html.toLowerCase();
  const groups = [];
  const seen = new Set();

  const iA = lower.indexOf('akan datang');
  const iP = lower.indexOf('sudah lewat');

  if (iA === -1 && iP === -1) {
    // Struktur tidak dikenali — perlakukan seluruh dokumen sebagai satu grup
    const items = grabSeries(html, seen);
    if (items.length) groups.push({ day: 'Jadwal', series: items });
    return groups;
  }

  if (iA >= 0) {
    const seg = html.slice(iA, iP > iA ? iP : undefined);
    const items = grabSeries(seg, seen);
    if (items.length) groups.push({ day: 'Akan Datang', series: items });
  }
  if (iP >= 0) {
    const items = grabSeries(html.slice(iP), seen);
    if (items.length) groups.push({ day: 'Sudah Lewat', series: items });
  }

  return groups;
}
