const SALT = process.env.DOUJIN_SALT || '';

function generateKey(s) {
  let hash = 0;
  for (let n = 0; n < s.length; n++) {
    hash = (hash << 5) - hash + s.charCodeAt(n);
    hash |= 0;
  }
  let out = '';
  let x = Math.abs(hash) || 123456789;
  for (let n = 0; n < 32; n++) {
    x = (x * 1664525 + 1013904223) % 4294967296;
    out += String.fromCharCode(33 + (x % 93));
  }
  return out;
}

function decryptHex(hex, key) {
  const bytes = [];
  for (let d = 0; d < hex.length; d += 2) bytes.push(parseInt(hex.substring(d, d + 2), 16));
  const out = [];
  let n = 42;
  for (let d = 0; d < bytes.length; d++) {
    const w = bytes[d];
    const ch = w ^ key.charCodeAt(d % key.length) ^ (d * 13) ^ n;
    out.push(String.fromCharCode(ch & 255));
    n = (n + w) % 256;
  }
  return out.join('');
}

function candidateKeys() {
  const bucket = Math.floor(Date.now() / 3600000);
  return [bucket, bucket - 1, bucket + 1].map((b) => generateKey(`${SALT}_${b}`));
}

export function decryptResponse(enc) {
  for (const key of candidateKeys()) {
    try {
      return JSON.parse(decodeURIComponent(decryptHex(enc, key)));
    } catch {
      // Key kandidat salah / hasil bukan JSON valid — coba key berikutnya.
      // Jika semua gagal, throw di bawah.
    }
  }
  throw new Error('Gagal mendekripsi response server');
}

// Akses internal untuk golden test (jangan dipakai di jalur produksi lain)
export const _internals = { generateKey, decryptHex };
