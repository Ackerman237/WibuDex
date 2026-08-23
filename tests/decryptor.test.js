// decryptor.test.js — Golden test dekripsi response doujin (offline).
//
// Tujuan: menangkap regresi pada generateKey/decryptHex/candidateKeys.
// Skenario diuji dengan waktu di-pin (fake timers) agar bucket jam deterministik,
// dan ciphertext dibangun dengan enkripsi cermin dari algoritme XOR berantai.
import { describe, it, expect, vi, beforeAll } from 'vitest';

const TEST_SALT = 'golden-test-salt';
// Waktu di-pin: bucket = floor(Date.now() / 3600000) harus stabil selama test
const PINNED_TIME = Date.UTC(2026, 7, 23, 12, 0, 0); // 2026-08-23T12:00Z

process.env.DOUJIN_SALT = TEST_SALT;

let decryptor;

beforeAll(async () => {
  vi.useFakeTimers();
  vi.setSystemTime(PINNED_TIME);
  // Import dinamis agar SALT terbaca setelah env diset (ESM meng-hoist import statis)
  decryptor = await import('../lib/scraper/decryptor.js');
});

function expectedBucket() {
  return Math.floor(PINNED_TIME / 3600000);
}

// Enkripsi cermin: w = ch ^ key ^ (d*13) ^ n, lalu n = (n + w) % 256.
// Identik dengan rantai decryptHex karena XOR simetris dan n berevolusi
// dari byte CIPHERTEXT (bukan plaintext).
function encryptHex(str, key) {
  const bytes = [];
  let n = 42;
  for (let d = 0; d < str.length; d++) {
    const ch = str.charCodeAt(d) & 255;
    // Mask & 255 WAJIB: di jalur dekripsi, w selalu byte dari parse hex [0..255],
    // dan evolusi n memakai w yang sudah termask.
    const w = (ch ^ key.charCodeAt(d % key.length) ^ (d * 13) ^ n) & 255;
    bytes.push(w);
    n = (n + w) % 256;
  }
  return bytes.map((b) => b.toString(16).padStart(2, '0')).join('');
}

describe('decryptor (golden)', () => {
  it('generateKey deterministik: input sama -> key sama, panjang 32', () => {
    const k1 = decryptor._internals.generateKey(`${TEST_SALT}_${expectedBucket()}`);
    const k2 = decryptor._internals.generateKey(`${TEST_SALT}_${expectedBucket()}`);
    expect(k1).toBe(k2);
    expect(k1).toHaveLength(32);
  });

  it('mendekripsi payload yang dienkripsi dengan key bucket saat ini', () => {
    const payload = JSON.stringify({ data: [{ title: 'Test Manga', id: 1 }], total: 1 });
    const key = decryptor._internals.generateKey(`${TEST_SALT}_${expectedBucket()}`);
    const enc = encryptHex(payload, key);
    expect(decryptor.decryptResponse(enc)).toEqual(JSON.parse(payload));
  });

  it('fallback ke key bucket sebelumnya (rotasi antar jam)', () => {
    const payload = JSON.stringify({ ok: true });
    const prevKey = decryptor._internals.generateKey(`${TEST_SALT}_${expectedBucket() - 1}`);
    const enc = encryptHex(payload, prevKey);
    expect(decryptor.decryptResponse(enc)).toEqual({ ok: true });
  });

  it('fallback ke key bucket berikutnya', () => {
    const payload = JSON.stringify({ ok: 'next' });
    const nextKey = decryptor._internals.generateKey(`${TEST_SALT}_${expectedBucket() + 1}`);
    const enc = encryptHex(payload, nextKey);
    expect(decryptor.decryptResponse(enc)).toEqual({ ok: 'next' });
  });

  it('melempar error untuk ciphertext sampah', () => {
    expect(() => decryptor.decryptResponse('deadbeef')).toThrow('Gagal mendekripsi');
  });
});
