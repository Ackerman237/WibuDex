// Debug one-off: dump HTML embed yang diterima fetchProviderEmbed
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { scrapeNekoDetail } from '../../lib/scraper/neko-scraper.js';
import { fetchProviderEmbed } from '../../lib/scraper/player-frame.js';

const slug = process.argv[2] || 'latest';
let target = slug;
if (target === 'latest') {
  const { scrapeNekoList } = await import('../../lib/scraper/neko-scraper.js');
  const list = await scrapeNekoList(1);
  target = list.videos?.[0]?.slug;
}
const detail = await scrapeNekoDetail(target);
console.log('players:', JSON.stringify(detail.players));

mkdirSync('.data/spike', { recursive: true });
for (let i = 0; i < detail.players.length; i++) {
  const url = detail.players[i];
  try {
    const html = await fetchProviderEmbed(url, { slug: target });
    const file = join('.data', 'spike', `embed-${i}-${new URL(url).hostname}.html`);
    writeFileSync(file, html);
    console.log(`saved ${file} (${html.length} bytes) | awal: ${html.slice(0, 120).replace(/\n/g, ' ')}`);
  } catch (err) {
    console.log(`player ${i} gagal: ${err.message}`);
  }
}
