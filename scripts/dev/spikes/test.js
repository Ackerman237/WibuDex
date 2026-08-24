// import { scrapeNekoList, disconnectVpn } from './lib/nekoScraper.js';

// async function test() {
//   try {
//     const data = await scrapeNekoList(1);
//     console.log('Hasil Scrape:', data);
//   } catch (err) {
//     console.error('Error:', err);
//   } finally {
//     // Matikan VPN kembali agar jaringan PC normal
//     await disconnectVpn();
//   }
// }

// test();

import { scrapeNekoList, scrapeNekoDetail, disconnectVpn } from './lib/nekoScraper.js';

async function main() {
  try {
    // 1. Tes Ambil Daftar Video (List)
    console.log('--- 1. Testing Scrape List ---');
    const listData = await scrapeNekoList(1);
    console.log('Hasil Scrape List:', listData);

    console.log('\n-----------------------------------\n');

    // 2. Tes Ambil Detail Video berdasarkan Slug
    console.log('--- 2. Testing Scrape Detail ---');
    const slug = 'amanee-tomodachinchi-de-konna-koto-ni-naru-nante-episode-1-subtitle-indonesia';
    const detailData = await scrapeNekoDetail(slug);
    console.log('Hasil Scrape Detail:');
    console.log(JSON.stringify(detailData, null, 2));

  } catch (err) {
    console.error('Terjadi kesalahan:', err.message);
  } finally {
    // 3. Matikan VPN hanya setelah SELURUH proses selesai
    console.log('\nMematikan koneksi VPN...');
    await disconnectVpn();
  }
}

main();