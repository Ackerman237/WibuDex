/**
 * generate-icons.mjs
 * ------------------
 * Render website/icons/icon.svg menjadi favicon.png (64x64),
 * icon-192.png, icon-512.png, dan icon-maskable-512.png.
 * Dipakai sekali setiap kali icon.svg diubah.
 *
 * Jalankan: npm run icons
 */

import sharp from 'sharp';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const iconsDir = path.resolve(__dirname, '..', 'website', 'icons');
const svgPath = path.join(iconsDir, 'icon.svg');
const BG_COLOR = '#15120f'; // sama dengan theme_color di manifest.json

async function main() {
  const svgBuffer = await readFile(svgPath);

  await sharp(svgBuffer)
    .resize(64, 64)
    .png()
    .toFile(path.join(iconsDir, 'favicon.png'));
  console.log('✔ website/icons/favicon.png (64x64) dibuat');

  // Ikon PWA standar
  for (const size of [192, 512]) {
    await sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toFile(path.join(iconsDir, `icon-${size}.png`));
    console.log(`✔ website/icons/icon-${size}.png (${size}x${size}) dibuat`);
  }

  // Maskable: konten diskalakan ke 80% (safe zone) di atas background solid,
  // agar aman dipotong bentuk apapun oleh launcher Android.
  const inner = Math.round(512 * 0.8);
  const padded = await sharp(svgBuffer)
    .resize(inner, inner)
    .png()
    .toBuffer();
  await sharp({
    create: { width: 512, height: 512, channels: 4, background: BG_COLOR },
  })
    .composite([{ input: padded, gravity: 'center' }])
    .png()
    .toFile(path.join(iconsDir, 'icon-maskable-512.png'));
  console.log('✔ website/icons/icon-maskable-512.png (maskable safe-zone) dibuat');

  console.log('Selesai.');
}

main().catch((err) => {
  console.error('Gagal generate icon:', err);
  process.exit(1);
});
