// video/js/series.js — Halaman daftar seri Hentai/JAV

let currentType = 'hentai';
let currentPage = 1;

function renderSeriesCard(item) {
  // Markup terkonsolidasi di cards.js (dulu: src thumb lupa di-escape)
  return renderMediaCard(item, { variant: 'grid' });
}

async function loadSeries(reset = false) {
  const grid = document.getElementById('seriesGrid');
  const sectionTitle = document.getElementById('sectionTitle');
  const loadMoreBtn = document.getElementById('loadMoreBtn');

  if (!grid) return;

  if (reset) {
    currentPage = 1;
    grid.innerHTML = '<p class="loading">Memuat daftar seri...</p>';
  }

  try {
    const res = await fetch(`/api/video/series?type=${encodeURIComponent(currentType)}&page=${currentPage}`);
    const result = await res.json();
    if (!result.success) throw new Error(result.message || 'Gagal memuat daftar seri.');

    const payload = result.data || {};
    const items = Array.isArray(payload.series) ? payload.series : [];
    const hasNext = Boolean(payload.hasNext);

    if (reset) grid.innerHTML = '';

    if (items.length === 0 && currentPage === 1) {
      grid.innerHTML = '<p class="error">Daftar seri tidak ditemukan.</p>';
      if (loadMoreBtn) loadMoreBtn.style.display = 'none';
      return;
    }

    if (sectionTitle) {
      sectionTitle.textContent = currentType === 'jav' ? 'Daftar Seri JAV' : 'Daftar Seri Hentai';
    }

    items.forEach((item) => grid.appendChild(renderSeriesCard(item)));

    currentPage += 1;

    if (loadMoreBtn) {
      loadMoreBtn.style.display = hasNext ? 'block' : 'none';
      loadMoreBtn.onclick = () => loadSeries(false);
    }
  } catch (err) {
    console.error('Gagal memuat daftar seri:', err);
    if (reset) {
      grid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center;">
          <p class="error">Gagal memuat daftar seri: ${escapeHtml(err.message)}</p>
          <button type="button" class="retry-btn">COBA LAGI</button>
        </div>`;
      grid.querySelector('.retry-btn')?.addEventListener('click', () => loadSeries(true));
    }
  }
}

function selectType(type, { reload = true } = {}) {
  currentType = type === 'jav' ? 'jav' : 'hentai';
  document.querySelectorAll('#typeTabsContainer .category-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.type === currentType);
  });
  const params = new URLSearchParams(window.location.search);
  params.set('type', currentType);
  window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
  if (reload) loadSeries(true);
}

document.addEventListener('DOMContentLoaded', () => {
  const backToTopBtn = document.getElementById('backToTop');

  const urlType = new URLSearchParams(window.location.search).get('type');
  selectType(urlType || 'hentai', { reload: false });

  document.querySelectorAll('#typeTabsContainer .category-btn').forEach((btn) => {
    btn.addEventListener('click', () => selectType(btn.dataset.type));
  });

  setupBackToTop(backToTopBtn, 300);
  loadSeries(true);
});
