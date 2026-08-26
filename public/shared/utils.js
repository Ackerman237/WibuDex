// website/shared/utils.js — Utilitas frontend bersama (logic murni)
// Di-load oleh SEMUA halaman (doujin & neko) sebelum script spesifik halaman.
// Tidak boleh menyentuh DOM — fungsi di sini adalah pure transformasi/helper.

/**
 * Escape karakter HTML berbahaya sebelum interpolasi ke innerHTML.
 * Wajib dipakai untuk semua teks dari sumber eksternal (API, localStorage).
 * @param {*} value
 * @returns {string}
 */
function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Setup tombol "kembali ke atas" — scroll ke top saat diklik,
 * tampil/sembunyikan berdasarkan posisi scroll.
 * @param {HTMLElement|null} btn - Elemen tombol back-to-top
 * @param {number} [threshold=300] - Jarak scroll (px) sebelum tombol muncul
 */
function setupBackToTop(btn, threshold) {
  threshold = threshold || 300;
  if (!btn) return;
  const sync = () => btn.classList.toggle('show', window.scrollY > threshold);
  window.addEventListener('scroll', sync, { passive: true });
  btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  sync();
}

// Load spotlight.js dynamically on DOM content loaded (Premium Hover/3D effects)
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    const scr = document.createElement('script');
    scr.src = '/shared/spotlight.js';
    scr.defer = true;
    document.head.appendChild(scr);
  });
}
