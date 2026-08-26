// scripts/dev/apply-html-updates.mjs — one-off: font link, asset versioning v3, synopsisPanel id
import fs from 'fs';

const dir = 'website/doujinPage/html';
const FONT_BLOCK = [
  '  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
  '  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Oswald:wght@400;500;600;700&family=Inter:wght@400;500;600&display=swap">',
].join('\n');

for (const name of fs.readdirSync(dir).filter((f) => f.endsWith('.html'))) {
  const p = `${dir}/${name}`;
  let c = fs.readFileSync(p, 'utf8');

  // 1) preconnect gstatic + stylesheet font (idempotent)
  if (!c.includes('fonts.gstatic.com')) {
    c = c.replace(
      /([ \t]*<link rel="preconnect" href="https:\/\/fonts\.googleapis\.com">)/,
      `$1\n${FONT_BLOCK}`
    );
  }

  // 2) versi aset ?v=3 untuk CSS & JS doujin (bukan register-sw.js)
  c = c.replace(/(href="\/doujinPage\/css\/[a-zA-Z]+\.css)(?!\?v)"/g, '$1?v=3"');
  c = c.replace(/(src="\/doujinPage\/(?:shared|js)\/[a-zA-Z]+\.js)(?!\?v)"/g, '$1?v=3"');

  // 3) id panel sinopsis (khusus detail.html) — toleran CRLF/LF
  if (name === 'detail.html') {
    c = c.replace(
      /<section class="panel">(\r?\n\s*<h3 class="panel-title"><span class="icon">☰<\/span> Synopsis<\/h3>)/,
      '<section class="panel" id="synopsisPanel">$1'
    );
  }

  fs.writeFileSync(p, c, 'utf8');
  console.log('OK', name);
}
