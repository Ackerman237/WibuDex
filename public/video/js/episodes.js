// episodes.js — Halaman daftar episode per-seri (V2, halaman baru)
const slug = new URLSearchParams(location.search).get('slug') || '';

async function loadEpisodes() {
  const grid = document.getElementById('episodeGrid');
  const titleEl = document.getElementById('sectionTitle');
  if (!grid || !slug) {
    grid.innerHTML = '<p class="error">Slug seri tidak ditemukan di URL.</p>';
    return;
  }

  try {
    const res = await fetch(`/api/video/detail?slug=${encodeURIComponent(slug)}`);
    const json = await res.json();
    if (!json.success || !json.data) throw new Error(json.message || 'Gagal');

    const detail = json.data;
    if (titleEl) titleEl.textContent = detail.title ? `${detail.title} — Episode` : 'Episode';

    const episodes = Array.isArray(detail.episodes) ? detail.episodes : [];
    if (episodes.length === 0) {
      grid.innerHTML = '<p class="error">Belum ada episode untuk seri ini.</p>';
      return;
    }

    grid.innerHTML = '';
    episodes.forEach((ep) => {
      // Channel row uses title inside, but card handles thumb/title; related uses thumb too
      grid.appendChild(renderMediaCard(ep, { variant: 'episode', isActive: false }));
    });
  } catch (err) {
    grid.innerHTML = `<p class="error">Gagal memuat episode: ${escapeHtml(err.message)}</p>`;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const backToTopBtn = document.getElementById('backToTop');
  setupBackToTop(backToTopBtn, 300);
  loadEpisodes();
});
