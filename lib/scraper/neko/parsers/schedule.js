// neko/parsers/schedule.js — Parser jadwal New Hentai (/jadwal-new-hentai/).
import { cleanText, stripHtml, safeUrl } from '../text.js';

const NEKO_DAY_NAMES = new Set(['senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu', 'minggu']);

// Parser toleran: pindai dokumen berurutan; heading berisi nama hari membuka grup baru,
// anchor internal setelahnya dimasukkan ke grup hari aktif.
export function parseSchedule(html) {
  const days = [];
  let current = null;
  const seen = new Set();

  const tokenRe =
    /<h[23][^>]*>([\s\S]*?)<\/h[23]>|<a\s+href="(https?:\/\/nekopoi\.care\/[^"#]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = tokenRe.exec(html))) {
    if (match[1] !== undefined) {
      const label = cleanText(match[1]).toLowerCase();
      if (NEKO_DAY_NAMES.has(label)) {
        current = { day: label.charAt(0).toUpperCase() + label.slice(1), series: [] };
        days.push(current);
      }
      continue;
    }

    if (!current) continue;
    const url = match[2];
    const inner = match[3];
    if (/category\/|tag\/|page\/|genre-list|hentai-list|jav-list|#|\.(png|jpg|css|js)/i.test(url)) continue;

    const titleMatch =
      inner.match(/<h\d[^>]*>([\s\S]*?)<\/h\d>/i) ||
      inner.match(/alt=["']([^"']+)["']/i) ||
      inner.match(/title=["']([^"']+)["']/i);
    const rawTitle = titleMatch ? titleMatch[1] : '';
    const title = cleanText(rawTitle || stripHtml(inner));
    if (!title || title.length > 200) continue;

    const slug = url.split('/').filter(Boolean).pop() || '';
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);

    const imgMatch =
      inner.match(/<img[^>]+src=["']([^"']+)["']/i) ||
      inner.match(/background-image:\s*url\(['"]?([^'")]+)/i);
    const thumb = imgMatch ? safeUrl(imgMatch[1]) : '';

    current.series.push({ title, slug, url: safeUrl(url), thumb });
  }

  return days.filter((d) => d.series.length > 0);
}
