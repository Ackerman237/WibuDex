// scripts/dev/verify-icons.mjs — verifikasi migrasi emoji → ikon SVG
import fs from 'fs';
import path from 'path';

let fail = false;
const warn = (m) => console.log('WARN:', m);
const bad = (m) => { console.log('FAIL:', m); fail = true; };

// 1) kumpulkan ID yang tersedia di sprite
const sprite = fs.readFileSync('website/manga/icons.svg', 'utf8');
const available = new Set([...sprite.matchAll(/id="i-([a-z0-9-]+)"/g)].map((m) => m[1]));
console.log('Sprite berisi', available.size, 'ikon:', [...available].join(', '));

if (!/^<svg[\s\S]*<\/svg>\s*$/i.test(sprite.trim())) bad('icons.svg tidak well-formed');

// 2) pemindaian emoji sisa di HTML & JS frontend
const dirs = ['website/manga/js', 'website/shared', 'website/video/js', 'website/video/html'];
const emojiRe = /[\u2190-\u2BFF\u{1F000}-\u{1FAFF}\uFE0F]/gu;
const ALLOWED = /^[★☆›‹]$/u; // rating bintang & chevron tipografis reader

for (const d of dirs) {
  for (const f of fs.readdirSync(d)) {
    if (!/\.(html|js)$/.test(f)) continue;
    const p = path.join(d, f);
    const lines = fs.readFileSync(p, 'utf8').split(/\r?\n/);
    lines.forEach((line, i) => {
      for (const ch of line.match(emojiRe) || []) {
        if (ALLOWED.test(ch)) continue;
        // komentar kode boleh (mis. panah dalam teks komentar)
        const isComment = /^\s*(\/\/|\/\*|\*)/.test(line.trim()) || line.includes('<!--');
        if (isComment) continue;
          warn(`emoji tersisa ${p}:${i + 1} [${ch}] ${line.trim().slice(0, 70)}`);
      }
    });
  }
}

// 3) semua use href menunjuk ID yang ada
const refs = new Set();
for (const d of dirs) {
  for (const f of fs.readdirSync(d)) {
    if (!/\.(html|js)$/.test(f)) continue;
    const p = path.join(d, f);
    const s = fs.readFileSync(p, 'utf8');
    for (const m of s.matchAll(/#i-([a-z0-9-]+)/g)) refs.add(m[1]);
  }
}
for (const r of refs) if (!available.has(r)) bad(`referensi hilang di sprite: i-${r}`);
console.log('Referensi ikon unik terpakai:', refs.size);

// 4) file bendera lengkap
for (const c of ['jp', 'kr', 'cn']) {
  const p = `website/icons/flags/${c}.svg`;
  if (!fs.existsSync(p)) bad(`flag hilang: ${p}`);
}

// 5) tidak ada U+FFFD (mojibake) di file frontend yang pernah rusak
for (const f of ['index.js', 'detail.js', 'reader.js']) {
  const s = fs.readFileSync(`website/manga/js/${f}`, 'utf8');
  if (s.includes('\uFFFD')) bad(`manga/js/${f} masih mengandung U+FFFD`);
}

console.log(fail ? '\n=== GAGAL ===' : '\n=== SEMUA VERIFIKASI LOLOS ===');
process.exit(fail ? 1 : 0);
