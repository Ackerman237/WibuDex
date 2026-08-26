import { newPage, closeBrowser } from './lib/browser.js';

try {
  console.log('🧪 Memulai test browser...');

  const page = await newPage();

  await page.goto('https://example.com', {
    waitUntil: 'domcontentloaded',
    timeout: 30000
  });

  console.log('Title:', await page.title());

  const html = await page.content();

  console.log('HTML berhasil diambil.');
  console.log('Panjang HTML:', html.length);

  await page.close();
  await closeBrowser();

  console.log('✅ TEST BERHASIL');
} catch (error) {
  console.error('❌ TEST GAGAL');
  console.error(error);

  await closeBrowser();
  process.exit(1);
}