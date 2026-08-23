// neko/parsers/schedule.js — Parser jadwal New Hentai (/jadwal-new-hentai/).
import { cleanText } from '../text.js';
import { extractAnchorItem } from './anchors.js';

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

    const item = extractAnchorItem(url, inner, { maxTitleLength: 200, withThumb: true });
    if (!item) continue;
    if (seen.has(item.slug)) continue;
    seen.add(item.slug);

    current.series.push(item);
  }

  return days.filter((d) => d.series.length > 0);
}
