// video/js/series.js — Halaman daftar seri Hentai/JAV (2:3 Poster Format)

let currentType = 'hentai';
let currentPage = 1;
let seriesHasNext = false;
const SERIES_HYBRID_THRESHOLD = 60;

function renderSeriesCard(item) {
  return renderMediaCard(item, {
    variant: 'series',
    href: `/video/html/episodes.html?slug=${encodeURIComponent(item.slug)}`,
    meta: item.type || (currentType === 'jav' ? 'JAV Series' : 'Hentai Series'),
  });
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
    seriesHasNext = hasNext;

    if (reset) grid.innerHTML = '';

    if (items.length === 0 && currentPage === 1) {
      grid.innerHTML = '<p class="error">Daftar seri tidak ditemukan.</p>';
      if (loadMoreBtn) loadMoreBtn.style.display = 'none';
      return;
    }

    if (sectionTitle) {
      sectionTitle.textContent = currentType === 'jav' ? 'Katalog Seri JAV' : 'Katalog Seri Hentai';
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

function setupSeriesInfiniteScroll() {
  const sentinel = document.getElementById('infiniteSentinelSeries');
  const grid = document.getElementById('seriesGrid');
  const loadMoreBtn = document.getElementById('loadMoreBtn');
  if (!sentinel || !grid || !loadMoreBtn) return;

  let isLoading = false;
  const observer = new IntersectionObserver(async (entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting || isLoading) continue;
      const total = grid.querySelectorAll('.series-card').length;
      if (total >= SERIES_HYBRID_THRESHOLD || !seriesHasNext) continue;
      isLoading = true;
      await loadSeries(false);
      isLoading = false;
    }
  }, { rootMargin: '600px 0px' });
  observer.observe(sentinel);
}

document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  const typeParam = params.get('type');
  if (typeParam === 'jav' || typeParam === 'hentai') {
    selectType(typeParam, { reload: false });
  }

  document.querySelectorAll('#typeTabsContainer .category-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      selectType(btn.dataset.type, { reload: true });
    });
  });

  loadSeries(true).then(() => setupSeriesInfiniteScroll());
});
