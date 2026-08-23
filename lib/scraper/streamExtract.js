// streamExtract.js — Ekstraksi URL stream langsung dari halaman embed penyedia.
//
// Terbukti live (spike 2026-08-23, lihat changelog): playmogo = keluarga
// DoodStream, MP4 progresif. Alur:
//   1. Halaman embed memuat $.get('/pass_md5/<hash>/<fileid>') + cookie file_id
//   2. GET /pass_md5/... (Referer = halaman embed) -> teks base URL CDN
//      [endpoint ini dilindungi Cloudflare -> wajib lewat curl, bukan fetch Node]
//   3. URL final = base + 10 char alfanumerik acak + "?token=<fileid>"
//      (replicasi fungsi makePlay() di JS penyedia)
// Hasil: video bisa dimainkan <video> milik sendiri — nol JS penyedia,
// mustahil ada klik iklan/popunder/redirect.
//
// Belum didukung: streampoi (logika player ada di /js/xupload.js eksternal)
// → caller diharapkan jatuh ke mode player-frame terfilter.
import { randomBytes } from 'crypto';
import { curlGetText } from './playerFrame.js';
import { USER_AGENT } from '../constants.js';

/**
 * Parser murni: ambil path pass_md5 + file_id dari HTML embed.
 * Dipisah dari I/O agar bisa di-golden-test offline dengan fixture.
 */
export function parseDoodStreamEmbed(html) {
  const md5Match = String(html).match(/['"]\/pass_md5\/([^'"]+)['"]/);
  if (!md5Match) return null;
  const passPath = md5Match[1];
  const fileIdCookie = String(html).match(/\$\.cookie\('file_id',\s*'(\d+)'/)?.[1] || '';
  return { passPath, fileIdCookie };
}

/** Replicasi makePlay(): 10 char alfanumerik acak + "?token=<token>" */
export function buildMakePlaySuffix(fileToken, randStr = randomBytes(10).toString('base64url').replace(/[^a-zA-Z0-9]/g, '').slice(0, 10)) {
  const rand = randStr.padEnd(10, '0').slice(0, 10);
  return `${rand}?token=${encodeURIComponent(fileToken)}`;
}

/**
 * Ekstrak URL stream langsung dari satu embed penyedia.
 * Return { url } saat berhasil, null jika pola tidak dikenali (caller fallback).
 */
export async function extractDirectStream(embedUrl, { slug = '', timeoutMs = 20000 } = {}) {
  // Impor lazy untuk menghindari dependensi siklus saat hanya parser dipakai di test
  const { fetchProviderEmbed } = await import('./playerFrame.js');
  const html = await fetchProviderEmbed(embedUrl, { slug, timeoutMs });

  const parsed = parseDoodStreamEmbed(html);
  if (!parsed) return null;

  const origin = new URL(embedUrl).origin;
  const base = (
    await curlGetText(`${origin}/pass_md5/${parsed.passPath}`, {
      referer: embedUrl,
      cookie: parsed.fileIdCookie ? `file_id=${parsed.fileIdCookie}` : '',
      timeoutMs,
    })
  ).trim();

  if (!base.startsWith('http')) return null; // CF challenge / pola berubah

  const fileToken = parsed.passPath.split('/').pop();
  return { url: `${base}${buildMakePlaySuffix(fileToken)}`, type: 'video/mp4' };
}

/** Probe murah: pastikan CDN mengizinkan Range request ( playable ) */
export async function probeStream(url, refererHost = '') {
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': USER_AGENT,
        ...(refererHost ? { Referer: `https://${refererHost}/` } : {}),
        Range: 'bytes=0-1023',
      },
    });
    // Batalkan sisa body — kita hanya butuh status + content-type
    try { await res.body?.cancel(); } catch {
      // body mungkin sudah tertutup sendiri
    }
    return res.status === 206 || res.status === 200;
  } catch {
    return false;
  }
}
