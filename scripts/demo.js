/**
 * scripts/demo.js
 *
 * Demo live semua fungsi scraper doujin.desu.xxx dan nekopoi.care.
 * Menampilkan output setiap fungsi publik ke console untuk verifikasi cepat.
 *
 * Prasyarat:
 *   - .env terisi (DOUJIN_APP_SECRET, DOUJIN_SALT, PORT)
 *   - Koneksi internet aktif
 *   - Untuk nekopoi: jika diblokir, set NEKO_PROXY_URL di .env
 *
 * Penggunaan:
 *   node --env-file=.env scripts/demo.js
 *   npm run demo
 *
 * Flag opsional:
 *   node --env-file=.env scripts/demo.js --doujin-only   # hanya test doujin
 *   node --env-file=.env scripts/demo.js --neko-only     # hanya test nekopoi
 *   node --env-file=.env scripts/demo.js --skip-images   # skip scrapeChapterImages (lambat)
 */

import {
  scrapeMangaList,
  scrapeMangaDetail,
  scrapeChapterImages,
  scrapeGenres,
} from '../lib/scraper/doujinScraper.js';

import {
  scrapeNekoList,
  scrapeNekoCategory,
  scrapeNekoSearch,
  scrapeNekoDetail,
  scrapeNekoCategories,
} from '../lib/scraper/nekoScraper.js';
// disconnectVpn tinggal di vpnManager — sebelumnya salah impor dari
// nekoScraper (tidak pernah ada di sana; demo langsung crash saat start).
import { disconnectVpn } from '../lib/vpn/vpnManager.js';

// ── CLI flags ──────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const DOUJIN_ONLY = args.includes('--doujin-only');
const NEKO_ONLY = args.includes('--neko-only');
const SKIP_IMAGES = args.includes('--skip-images');
const RUN_DOUJIN = !NEKO_ONLY;
const RUN_NEKO = !DOUJIN_ONLY;

// ── Helpers output ─────────────────────────────────────────────────────────────
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';

let passed = 0;
let failed = 0;
const errors = [];

function header(title) {
  console.log(`\n${BOLD}${CYAN}═══ ${title} ═══${RESET}`);
}

function ok(label, preview) {
  passed++;
  const previewStr = preview !== undefined ? ` → ${JSON.stringify(preview).slice(0, 120)}` : '';
  console.log(`  ${GREEN}✓${RESET} ${label}${previewStr}`);
}

function fail(label, err) {
  failed++;
  const msg = err instanceof Error ? err.message : String(err);
  errors.push({ label, msg });
  console.log(`  ${RED}✗${RESET} ${label}: ${RED}${msg}${RESET}`);
}

function warn(label, msg) {
  console.log(`  ${YELLOW}⚠${RESET} ${label}: ${msg}`);
}

function previewArray(arr, field = 'title') {
  if (!Array.isArray(arr) || arr.length === 0) return '(kosong)';
  const first = arr[0]?.[field] || arr[0];
  return `[${arr.length} item] "${typeof first === 'string' ? first.slice(0, 50) : JSON.stringify(first).slice(0, 50)}"...`;
}

// ── Guard: pastikan env terisi ────────────────────────────────────────────────
function checkEnv() {
  const missing = [];
  if (!process.env.DOUJIN_APP_SECRET) missing.push('DOUJIN_APP_SECRET');
  if (!process.env.DOUJIN_SALT) missing.push('DOUJIN_SALT');

  if (missing.length > 0) {
    console.error(`\n${RED}[demo] ✗ Environment variables belum diset: ${missing.join(', ')}${RESET}`);
    console.error(`[demo] Jalankan "npm run get-secret" terlebih dahulu untuk mengekstrak key dari situs.`);
    if (!NEKO_ONLY) process.exit(1);
  }
}

// ── Demo doujin.desu.xxx ──────────────────────────────────────────────────────
async function demoDoujin() {
  header('doujin.desu.xxx');
  checkEnv();

  // 1. scrapeMangaList — daftar manga
  let firstSlug = null;
  let firstChapterId = null;

  try {
    const result = await scrapeMangaList({ page: 1, limit: 5 });
    const list = Array.isArray(result) ? result : result?.data || [];
    if (list.length === 0) {
      warn('scrapeMangaList', 'Berhasil fetch tapi list kosong — mungkin API berubah');
    } else {
      ok('scrapeMangaList', previewArray(list));
      firstSlug = list[0]?.slug;
      // Cari chapter pertama yang punya id
      for (const item of list) {
        const ch = item?.chapters?.[0];
        if (ch?.id || ch?.chapter_id) {
          firstChapterId = ch.chapter_id || ch.id;
          break;
        }
      }
    }
  } catch (err) {
    fail('scrapeMangaList', err);
  }

  // 2. scrapeMangaList dengan withMeta (total count)
  try {
    const result = await scrapeMangaList({ page: 1, limit: 5, withMeta: true });
    const list = result?.data || [];
    const total = result?.total;
    ok('scrapeMangaList (withMeta)', `total=${total}, ${list.length} item`);
    if (!firstSlug && list.length > 0) firstSlug = list[0]?.slug;
  } catch (err) {
    fail('scrapeMangaList (withMeta)', err);
  }

  // 3. scrapeMangaList dengan query search
  try {
    const result = await scrapeMangaList({ page: 1, limit: 3, query: 'sensei' });
    const list = Array.isArray(result) ? result : result?.data || [];
    ok('scrapeMangaList (search)', previewArray(list));
  } catch (err) {
    fail('scrapeMangaList (search)', err);
  }

  // 4. scrapeGenres — daftar genre
  try {
    const genres = await scrapeGenres();
    ok('scrapeGenres', previewArray(genres, 'name'));
  } catch (err) {
    fail('scrapeGenres', err);
  }

  // 5. scrapeMangaDetail — detail manga berdasarkan slug
  if (firstSlug) {
    try {
      const detail = await scrapeMangaDetail(firstSlug);
      ok('scrapeMangaDetail', `"${detail?.title?.slice(0, 60)}" | ${detail?.chapters?.length ?? 0} chapter`);

      // Ambil chapter ID dari detail jika belum dapat dari list
      if (!firstChapterId && detail?.chapters?.length > 0) {
        const ch = detail.chapters[detail.chapters.length - 1]; // chapter terlama (lebih stabil)
        firstChapterId = ch?.chapter_id || ch?.id;
      }
    } catch (err) {
      fail(`scrapeMangaDetail (slug: ${firstSlug})`, err);
    }
  } else {
    warn('scrapeMangaDetail', 'Dilewati — tidak dapat slug dari scrapeMangaList');
  }

  // 6. scrapeChapterImages — gambar chapter
  if (SKIP_IMAGES) {
    warn('scrapeChapterImages', 'Dilewati (--skip-images)');
  } else if (firstChapterId) {
    try {
      const result = await scrapeChapterImages(firstChapterId);
      const imgCount = result?.images?.length ?? 0;
      ok('scrapeChapterImages', `${imgCount} gambar | "${result?.title?.slice(0, 50)}"`);

      if (imgCount === 0) {
        warn('scrapeChapterImages', 'Berhasil fetch tapi tidak ada gambar — chapter mungkin premium/kosong');
      }
    } catch (err) {
      fail(`scrapeChapterImages (id: ${firstChapterId})`, err);
    }
  } else {
    warn('scrapeChapterImages', 'Dilewati — tidak dapat chapter ID dari scrapeMangaList/scrapeMangaDetail');
  }
}

// ── Demo nekopoi.care ─────────────────────────────────────────────────────────
async function demoNeko() {
  header('nekopoi.care');

  if (process.env.NEKO_PROXY_URL) {
    console.log(`  ${CYAN}[info]${RESET} Menggunakan proxy: ${process.env.NEKO_PROXY_URL.replace(/:\/\/.*@/, '://***@')}`);
  }

  // 1. scrapeNekoCategories — daftar kategori
  try {
    const cats = await scrapeNekoCategories();
    ok('scrapeNekoCategories', previewArray(cats, 'name'));
  } catch (err) {
    fail('scrapeNekoCategories', err);
  }

  // 2. scrapeNekoList — daftar video terbaru
  let firstNekoSlug = null;

  try {
    const result = await scrapeNekoList(1);
    const videos = result?.videos || result || [];
    if (Array.isArray(videos) && videos.length > 0) {
      ok('scrapeNekoList', previewArray(videos));
      firstNekoSlug = videos[0]?.slug;
    } else {
      warn('scrapeNekoList', 'Berhasil fetch tapi list kosong');
    }
  } catch (err) {
    fail('scrapeNekoList', err);
  }

  // 3. scrapeNekoSearch — cari video
  try {
    const result = await scrapeNekoSearch('ecchi', 1);
    const videos = result?.videos || result || [];
    ok('scrapeNekoSearch', previewArray(Array.isArray(videos) ? videos : []));
  } catch (err) {
    fail('scrapeNekoSearch', err);
  }

  // 4. scrapeNekoCategory — video per kategori
  // Catatan: 'hentai' adalah kategori yang benar-benar ada di situs;
  // 'ecchi' menghasilkan 404 asli dari upstream (sudah diverifikasi live).
  try {
    const result = await scrapeNekoCategory('hentai', 1);
    const videos = result?.videos || result || [];
    ok('scrapeNekoCategory (hentai)', previewArray(Array.isArray(videos) ? videos : []));
  } catch (err) {
    fail('scrapeNekoCategory (hentai)', err);
  }

  // 5. scrapeNekoDetail — detail video
  if (firstNekoSlug) {
    try {
      const detail = await scrapeNekoDetail(firstNekoSlug);
      const playerCount = detail?.players?.length ?? 0;
      ok('scrapeNekoDetail', `"${detail?.title?.slice(0, 60)}" | ${playerCount} player`);
    } catch (err) {
      fail(`scrapeNekoDetail (slug: ${firstNekoSlug})`, err);
    }
  } else {
    warn('scrapeNekoDetail', 'Dilewati — tidak dapat slug dari scrapeNekoList');
  }
}

// ── Entrypoint ─────────────────────────────────────────────────────────────────
async function main() {
  console.log(`${BOLD}${CYAN}`);
  console.log('╔══════════════════════════════════════════╗');
  console.log('║       DoujinScraper — Live Demo          ║');
  console.log('╚══════════════════════════════════════════╝');
  console.log(RESET);

  const startTime = Date.now();

  try {
    if (RUN_DOUJIN) await demoDoujin();
    if (RUN_NEKO) await demoNeko();
  } finally {
    // Selalu disconnect VPN setelah selesai
    try {
      await disconnectVpn();
    } catch {
      // abaikan error disconnect
    }
  }

  // ── Ringkasan ──────────────────────────────────────────────────────────────
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log(`\n${BOLD}═══ Ringkasan Demo ═══${RESET}`);
  console.log(`  Durasi  : ${elapsed}s`);
  console.log(`  ${GREEN}✓ Lulus  : ${passed}${RESET}`);
  console.log(`  ${failed > 0 ? RED : GREEN}✗ Gagal  : ${failed}${RESET}`);

  if (errors.length > 0) {
    console.log(`\n${BOLD}${RED}Daftar Kegagalan:${RESET}`);
    for (const { label, msg } of errors) {
      console.log(`  • ${label}: ${msg}`);
    }

    console.log(`\n${YELLOW}Tips debugging:${RESET}`);
    console.log('  1. Jika error "Gagal mendekripsi" → jalankan: npm run get-secret');
    console.log('  2. Jika error HTTP 403/429 → situs mungkin rate-limit; coba lagi dalam beberapa menit');
    console.log('  3. Jika error timeout nekopoi → set NEKO_PROXY_URL di .env');
    console.log('  4. Jika list kosong → kemungkinan struktur API berubah → cek scraper/doujinScraper.js');
  }

  console.log('');

  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(`\n${RED}[demo] Error fatal: ${err.message}${RESET}`);
  console.error(err.stack);
  process.exit(1);
});
