/**
 * scripts/dev/m3u8-spike.mjs — SPIKE Fase B: ekstraksi URL stream langsung
 * dari embed penyedia (tanpa player penyedia).
 *
 * Pola playmogo (keluarga DoodStream, dari tests/fixtures/playmogo.html):
 *   1. GET halaman embed  -> ekstrak path /pass_md5/<hash>/<fileid> + token
 *   2. GET /pass_md5/...  -> respons teks = base URL CDN
 *   3. URL final = base + 10 char acak + "?token=<token>"   (fungsi makePlay)
 *
 * Jalankan: node --env-file=.env scripts/dev/m3u8-spike.mjs <slug-nekopoi>
 */
import { execFile } from 'child_process';
import { promisify } from 'util';
import { fetchProviderEmbed } from '../../lib/scraper/player-frame.js';
import { USER_AGENT } from '../../lib/constants.js';

const execFileAsync = promisify(execFile);

// Fetch via curl.exe — fingerprint TLS-nya lolos Cloudflare (terbukti di lab)
async function curlGet(url, { referer, cookie = '' } = {}) {
  const args = ['-s', '-L', '--compressed', '-m', '20', '-A', USER_AGENT];
  if (referer) args.push('-e', referer);
  if (cookie) args.push('-b', cookie);
  args.push(url);
  const { stdout } = await execFileAsync('curl.exe', args, {
    maxBuffer: 10 * 1024 * 1024,
    windowsHide: true,
  });
  return stdout;
}

const slugArg = process.argv[2];

const { scrapeNekoDetail, scrapeNekoList } = await import('../../lib/scraper/neko-scraper.js');

let slug = slugArg;
if (!slug || slug === 'latest') {
  const list = await scrapeNekoList(1);
  slug = list.videos?.[0]?.slug;
  console.log(`[spike] pakai post terbaru: ${slug}`);
}
if (!slug) {
  console.error('Usage: node --env-file=.env scripts/dev/m3u8-spike.mjs <slug-nekopoi|latest>');
  process.exit(1);
}
const detail = await scrapeNekoDetail(slug);
const players = detail.players || [];
console.log(`[spike] players ditemukan: ${players.length}`);
if (players.length === 0) process.exit(1);

for (const playerUrl of players) {
  const host = new URL(playerUrl).hostname;
  console.log(`\n=== ${host} ===`);
  try {
    const html = await fetchProviderEmbed(playerUrl, { slug });

    // Ekstrak pemanggilan $.get('/pass_md5/<path>') dan token
    const md5Match = html.match(/['"]\/pass_md5\/([^'"]+)['"]/);
    if (!md5Match) {
      console.log('[spike] tidak ada pola pass_md5 di HTML ini');
      continue;
    }
    const passPath = md5Match[1];
    const fileToken = passPath.split('/').pop();
    console.log(`[spike] pass_md5 path : /${passPath}`);
    console.log(`[spike] token        : ${fileToken}`);

    // Replicasi makePlay(): 10 char acak + ?token=
    const rand = Array.from({ length: 10 }, () =>
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'.charAt(Math.floor(Math.random() * 62))
    ).join('');

    // Cookie yang diset halaman sebelum panggilan pass_md5
    const fileIdMatch = html.match(/\$\.cookie\('file_id',\s*'(\d+)'/);
    const cookie = fileIdMatch ? `file_id=${fileIdMatch[1]}` : '';
    console.log(`[spike] cookie       : ${cookie || '(kosong)'}`);

    const base = (await curlGet(`${new URL(playerUrl).origin}/pass_md5/${passPath}`, {
      referer: playerUrl,
      cookie,
    })).trim();
    console.log(`[spike] pass_md5 (curl) -> base: ${base.slice(0, 60)}...`);

    if (!base.startsWith('http')) {
      console.log('[spike] respons tidak berupa URL CDN — pola berubah?');
      continue;
    }

    const finalUrl = `${base}${rand}?token=${fileToken}`;
    // Verifikasi: minta 1KB pertama dari CDN via curl (Range)
    try {
      const probe = await execFileAsync('curl.exe', [
        '-s', '-o', 'NUL', '-w', '%{http_code} %{content_type} %{size_download}',
        '-m', '20', '-A', USER_AGENT, '-e', `${host}/`,
        '-r', '0-1023',
        finalUrl,
      ], { windowsHide: true });
      console.log(`[spike] probe CDN (curl): ${probe.stdout}`);
      const ok = String(probe.stdout).startsWith('206') || String(probe.stdout).startsWith('200');
      console.log(ok
        ? '[spike] ✅ EKSTRAKSI BERHASIL — stream bisa dimainkan player sendiri'
        : '[spike] ❌ probe gagal — perlu investigasi lanjut');
    } catch (probeErr) {
      console.log(`[spike] ❌ probe error: ${probeErr.message}`);
    }
  } catch (err) {
    console.log(`[spike] error: ${err.message}`);
  }
}
