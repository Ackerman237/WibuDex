// video/js/episodes.js — Halaman Detail Seri & Daftar Episode
const slug = new URLSearchParams(location.search).get('slug') || '';

async function loadEpisodes() {
  const grid = document.getElementById('episodeGrid');
  const titleEl = document.getElementById('sectionTitle');
  const seriesHeader = document.getElementById('seriesHeader');
  const seriesTitle = document.getElementById('seriesTitle');
  const seriesCover = document.getElementById('seriesCover');
  const seriesSynopsis = document.getElementById('seriesSynopsis');
  const seriesEpCount = document.getElementById('seriesEpCount');
  const playFirstEpBtn = document.getElementById('playFirstEpBtn');

  if (!grid || !slug) {
    grid.innerHTML = '<p class="error">Slug seri tidak ditemukan di URL.</p>';
    return;
  }

  try {
    const res = await fetch(`/api/video/detail?slug=${encodeURIComponent(slug)}`);
    const json = await res.json();
    if (!json.success || !json.data) throw new Error(json.message || 'Gagal memuat detail seri.');

    const detail = json.data;
    const episodes = Array.isArray(detail.episodes) ? detail.episodes : [];

    // Render Series Header
    if (seriesHeader) {
      seriesHeader.style.display = 'block';
      if (seriesTitle) seriesTitle.textContent = detail.title || 'Seri Video';
      if (seriesSynopsis) seriesSynopsis.textContent = detail.synopsis || 'Daftar episode lengkap untuk seri ini.';
      if (seriesCover && detail.thumb) {
        seriesCover.src = detail.thumb;
        seriesCover.alt = detail.title || '';
      }
      if (seriesEpCount) seriesEpCount.textContent = `${episodes.length} Episode`;
      if (playFirstEpBtn && episodes.length > 0) {
        playFirstEpBtn.href = `/video/html/watch.html?slug=${encodeURIComponent(episodes[0].slug)}`;
      }
    }

    if (titleEl) titleEl.textContent = `Daftar Episode (${episodes.length})`;

    if (episodes.length === 0) {
      grid.innerHTML = '<p class="error">Belum ada episode untuk seri ini.</p>';
      return;
    }

    grid.innerHTML = '';
    episodes.forEach((ep) => {
      grid.appendChild(renderMediaCard(ep, { variant: 'episode', isActive: false }));
    });
  } catch (err) {
    grid.innerHTML = `<p class="error">Gagal memuat episode: ${escapeHtml(err.message)}</p>`;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  loadEpisodes();
});
