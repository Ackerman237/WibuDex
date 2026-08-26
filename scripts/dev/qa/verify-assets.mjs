// scripts/dev/verify-assets.mjs — cek aset flag & sprite ikon
import fs from 'fs';

let ok = true;
for (const c of ['jp', 'kr', 'cn']) {
  try {
    const s = fs.readFileSync(`website/icons/flags/${c}.svg`, 'utf8');
    const viewBox = (s.match(/viewBox="([^"]+)"/) || [])[1] || '?';
    const valid = s.includes('<svg');
    if (!valid) ok = false;
    console.log(c.padEnd(3), `svg=${valid}`, `viewBox=${viewBox}`, `len=${s.length}`);
  } catch {
    console.log(c.padEnd(3), 'HILANG');
    ok = false;
  }
}
process.exit(ok ? 0 : 1);
