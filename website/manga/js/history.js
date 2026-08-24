// history.js — Halaman riwayat baca dari posisi tersimpan di server (node:sqlite)

// escapeHtml: pakai global dari shared/ui.js (sudah termasuk escape kutip).

async function loadServerHistory() {
  const grid = document.getElementById('historyGrid');
  if (!grid) return;

  try {
    const res = await fetch('/api/progress/all', {
      headers: { 'x-device-id': getDeviceId() },
    });
    const json = await res.json();
    if (!json.success || !Array.isArray(json.data)) throw new Error(json.message || 'Gagal memuat riwayat.');

    const rows = json.data;
    if (rows.length === 0) {
      grid.innerHTML = '<p class="error">Belum ada riwayat membaca. Mulai baca manga dari halaman All Manga.</p>';
      return;
    }

    grid.innerHTML = '';
    rows.forEach((row) => {
      const title = row.manga_title || row.manga_slug || 'Manga';
      const coverUrl = row.cover_url || 'https://placehold.co/420x560?text=No+Cover';
      const chapterNum = row.chapter_num || row.chapter_id || '-';
      const updatedText = row.updated_at
        ? new Date(Number(row.updated_at) * 1000).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
        : '-';

      const card = document.createElement('div');
      card.className = 'history-item';

      // stempel bendera dari metadata server (baris lama tanpa manga_type → tanpa stempel)
      const flag = typeof getMangaFlag === 'function' ? getMangaFlag(row.manga_type) : '';

      card.innerHTML = `
        <a class="history-cover" ${flag ? `data-flag="${flag}"` : ''} href="/manga/html/detail.html?slug=${encodeURIComponent(row.manga_slug)}">
          <img src="${escapeHtml(coverUrl)}" alt="${escapeHtml(title)}" loading="lazy" referrerpolicy="no-referrer">
        </a>
        <div class="history-info">
          <h3 class="history-title">
            <a href="/manga/html/detail.html?slug=${encodeURIComponent(row.manga_slug)}">${escapeHtml(title)}</a>
          </h3>
          <p class="history-meta">Chapter ${escapeHtml(chapterNum)} · halaman ${Number(row.page) || 1}</p>
          <p class="history-date">${escapeHtml(updatedText)}</p>
          <button class="btn-continue" type="button">${typeof ic === 'function' ? ic('play') : '▶'} LANJUT BACA</button>
        </div>
      `;

      card.querySelector('.btn-continue').addEventListener('click', () => {
        window.location.href = `/manga/html/reader.html?id=${encodeURIComponent(row.chapter_id)}`;
      });

      grid.appendChild(card);
    });
  } catch (err) {
    console.error('Gagal memuat riwayat:', err);
    grid.innerHTML = '<p class="error">Gagal memuat riwayat baca dari server.</p>';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  loadServerHistory();

  setupBackToTop(document.getElementById('backToTop'), 300);
});
