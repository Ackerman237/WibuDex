#!/usr/bin/env node
// scripts/build.mjs — Production hardening build (non-destructive)
// Output: dist/public/ (mirror of public/ tapi JS dibundle+minify+mangle, HTML tanpa comment, nama file di-hash)
import { readFileSync, writeFileSync, mkdirSync, cpSync, existsSync, readdirSync } from 'fs';
import { join, dirname, basename, extname, relative } from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import * as esbuild from 'esbuild';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const srcDir = join(root, 'public');
const outDir = join(root, 'dist', 'public');

// Bersihkan dist
if (existsSync(join(root, 'dist'))) {
  // Node 20+ fs.rmSync
  const { rmSync } = await import('fs');
  rmSync(join(root, 'dist'), { recursive: true, force: true });
}
mkdirSync(outDir, { recursive: true });

// 1. Copy semua aset non-JS/non-HTML verbatim DULU (icons, css, manifest, sw.js, offline.html, dll)
//    JS & HTML akan diproses khusus; sw.js tetap di root public tanpa hash
function copyStatic(src, dest) {
  const entries = readdirSync(src, { withFileTypes: true });
  for (const e of entries) {
    const s = join(src, e.name);
    const d = join(dest, e.name);
    if (e.isDirectory()) {
      mkdirSync(d, { recursive: true });
      copyStatic(s, d);
    } else if (e.isFile()) {
      const ext = extname(e.name);
      // JS & HTML akan di-bundle/minify nanti — skip di copy awal (kecuali sw.js yang harus tetap di /sw.js)
      if (ext === '.js' && basename(s) !== 'sw.js') continue;
      if (ext === '.html') continue;
      // css, svg, png, json, dll copy verbatim
      mkdirSync(dirname(d), { recursive: true });
      cpSync(s, d);
    }
  }
}
copyStatic(srcDir, outDir);
// sw.js copy verbatim (tanpa hash, tanpa minify comment strip? tapi kita strip comment JS-nya via copy)
cpSync(join(srcDir, 'sw.js'), join(outDir, 'sw.js'));
// manifest, offline.html copy
if (existsSync(join(srcDir, 'manifest.json'))) cpSync(join(srcDir, 'manifest.json'), join(outDir, 'manifest.json'));
if (existsSync(join(srcDir, 'offline.html'))) cpSync(join(srcDir, 'offline.html'), join(outDir, 'offline.html'));

// 2. Kumpulkan semua HTML entry
function collectHtml(dir, list = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) collectHtml(p, list);
    else if (e.isFile() && extname(e.name) === '.html') list.push(p);
  }
  return list;
}
const htmlEntries = collectHtml(srcDir);
console.log(`[build] Ditemukan ${htmlEntries.length} HTML entry`);

let totalOriginalJs = 0;
let totalBundledJs = 0;

for (const htmlPath of htmlEntries) {
  const relHtml = relative(srcDir, htmlPath); // e.g. manga/html/index.html
  const htmlRaw = readFileSync(htmlPath, 'utf8');

  // Strip HTML comments DULU untuk analisis (tapi simpan raw untuk rewrite)
  // Cari semua <script src="..."> lokal (awalan /)
  const scriptRe = /<script\s+[^>]*src=["']([^"']+)["'][^>]*>\s*<\/script>/gi;
  const localSrcs = [];
  const externalScripts = [];
  let m;
  while ((m = scriptRe.exec(htmlRaw))) {
    const src = m[1];
    // Abaikan CDN external (none currently selain fonts yang link, bukan script)
    if (src.startsWith('http') || src.startsWith('//')) {
      externalScripts.push(src);
      continue;
    }
    // Hanya bundle script lokal yang di public (awalan /)
    if (src.startsWith('/')) {
      const filePath = join(srcDir, src.replace(/^\//, ''));
      if (existsSync(filePath) && extname(filePath) === '.js') {
        localSrcs.push({ tag: m[0], src, filePath });
      }
    }
  }

  if (localSrcs.length === 0) {
    // HTML tanpa script lokal (unlikely) — cukup strip comment & copy
    const outHtml = htmlRaw.replace(/<!--[\s\S]*?-->/g, '');
    const outPath = join(outDir, relHtml);
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, outHtml, 'utf8');
    console.log(`[build] ${relHtml} — no local JS, copied (comments stripped)`);
    continue;
  }

  // Baca & gabung semua JS lokal untuk halaman ini (urutan sesuai HTML)
  let combined = '';
  for (const { filePath } of localSrcs) {
    const content = readFileSync(filePath, 'utf8');
    totalOriginalJs += Buffer.byteLength(content);
    combined += `\n/* ---- ${relative(srcDir, filePath)} ---- */\n` + content;
  }

  // esbuild transform: minify + mangle (tanpa sourcemap, tanpa legalComments)
  const result = await esbuild.transform(combined, {
    minify: true,
    sourcemap: false,
    legalComments: 'none',
    target: 'es2018',
    format: 'iife',
  });
  const code = result.code;
  totalBundledJs += Buffer.byteLength(code);

  // Hash nama file (8 hex)
  const hash = crypto.createHash('sha256').update(code).digest('hex').slice(0, 8);
  const baseName = basename(relHtml, '.html'); // index, watch, etc
  const dirName = dirname(relHtml).replace(/\\/g, '/'); // manga/html, video/html
  // Simpan bundle di folder yang sama dengan html-nya agar path relatif tetap dekat
  // Misal: public/manga/html/index.html -> dist/public/manga/html/index.[hash].js
  // Tapi HTML refer pakai /manga/html/index.[hash].js (absolute)
  const bundleFileName = `${baseName}.${hash}.js`;
  const bundleRelPath = `${dirName}/${bundleFileName}`.replace(/^\.\//, '');
  const bundleOutPath = join(outDir, bundleRelPath);
  mkdirSync(dirname(bundleOutPath), { recursive: true });
  writeFileSync(bundleOutPath, code, 'utf8');

  // Rewrite HTML: strip semua HTML comment, hapus semua <script src lokal>, ganti dengan 1 bundle
  let outHtml = htmlRaw.replace(/<!--[\s\S]*?-->/g, '');
  // Hapus semua tag script lokal satu per satu
  for (const { tag } of localSrcs) {
    outHtml = outHtml.replace(tag, '');
  }
  // Sisipkan 1 bundle tag sebelum </body> (atau sebelum </head> jika tidak ada body)
  const bundleTag = `<script src="/${bundleRelPath}" defer></script>`;
  if (outHtml.includes('</body>')) {
    outHtml = outHtml.replace('</body>', `  ${bundleTag}\n</body>`);
  } else {
    outHtml += `\n${bundleTag}\n`;
  }
  // Juga strip JS comment sudah dilakukan esbuild; HTML comment sudah di atas
  // Collapse multiple blank lines biar rapi
  outHtml = outHtml.replace(/\n{3,}/g, '\n\n');

  const outPath = join(outDir, relHtml);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, outHtml, 'utf8');
  console.log(`[build] ${relHtml} — ${localSrcs.length} src → /${bundleRelPath} (${Math.round(Buffer.byteLength(code)/1024)} KB, hash ${hash})`);
}

// 3. Copy CSS verbatim (sudah di-copy di copyStatic) — tapi minify ringan jika mau
// Untuk sekarang biarkan apa adanya agar tidak merusak token

console.log(`\n[build] Selesai. dist/public siap deploy.`);
console.log(`[build] JS original total ~${Math.round(totalOriginalJs/1024)} KB → bundled ~${Math.round(totalBundledJs/1024)} KB`);
console.log(`[build] Cek manual: Get-ChildItem dist -Recurse -Include *.map (harus 0), cek nama file hash, cek HTML tanpa <!--`);
