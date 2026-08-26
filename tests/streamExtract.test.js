// streamExtract.test.js — Test offline parser ekstraksi stream (fixture live).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parseDoodStreamEmbed, buildMakePlaySuffix } from '../lib/scraper/stream-extract.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const playmogoHtml = readFileSync(join(__dirname, 'fixtures', 'playmogo.html'), 'utf-8');

describe('parseDoodStreamEmbed', () => {
  it('mengekstrak pass_md5 path + file_id dari fixture playmogo', () => {
    const parsed = parseDoodStreamEmbed(playmogoHtml);
    expect(parsed).not.toBeNull();
    expect(parsed.passPath).toMatch(/^[0-9a-f-]+\/[a-z0-9]+$/i);
    expect(parsed.fileIdCookie).toBe('275752923');
  });

  it('return null untuk HTML tanpa pola (mis. streampoi / halaman challenge)', () => {
    expect(parseDoodStreamEmbed('<html><body>Just a moment...</body></html>')).toBeNull();
    expect(parseDoodStreamEmbed('')).toBeNull();
  });
});

describe('buildMakePlaySuffix', () => {
  it('menghasilkan 10 char acak + ?token=<token>', () => {
    const suffix = buildMakePlaySuffix('abc123def456');
    expect(suffix).toMatch(/^[a-zA-Z0-9]{10}\?token=abc123def456$/);
  });

  it('randStr custom dipakai apa adanya (deterministik untuk test)', () => {
    expect(buildMakePlaySuffix('tok', 'ABCDEFGHIJ')).toBe('ABCDEFGHIJ?token=tok');
  });

  it('randStr pendek di-pad, panjang dipotong ke 10', () => {
    expect(buildMakePlaySuffix('tok', 'AB')).toBe('AB00000000?token=tok');
    expect(buildMakePlaySuffix('tok', 'ABCDEFGHIJKLMNOP')).toBe('ABCDEFGHIJ?token=tok');
  });
});
