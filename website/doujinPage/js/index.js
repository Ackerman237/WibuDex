// index.js — Home page logic (history carousel + latest manga grid)

let currentLimit = 10;
let currentQuery = '';

function renderHomeHistory() {
  const container = document.getElementById('historyContainer');
  const wrapper = document.getElementById('historyWrapper');
  if (!container || !wrapper) return;

  const history = getReadingHistory();

  if (history.length === 0) {
    container.innerHTML = '<p class="error" style="font-size: 13px; color: var(--text-muted, #888); padding: 10px;">Belum ada riwayat membaca.</p>';
    return;
  }

  container.innerHTML = '';

  history.slice(0, 5).forEach(item => {
    const card = document.createElement('a');
    card.href = `/doujinPage/html/detail.html?slug=${encodeURIComponent(item.slug)}`;
    card.className = 'history-card';

    // stempel bendera (entri riwayat lama tanpa `type` → tanpa stempel)
    const flag = typeof getMangaFlag === 'function' ? getMangaFlag(item.type) : '';
    if (flag) card.dataset.flag = flag;

    const thumbUrl = item.thumb || 'https://placehold.co/110x140?text=No+Cover';
    const formattedDate = item.lastRead ? new Date(item.lastRead).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) : '-';

    card.innerHTML = `
      <img src="${escapeHtml(thumbUrl)}" alt="${escapeHtml(item.title)}" class="history-card-thumb" loading="lazy" referrerpolicy="no-referrer">
      <div class="history-card-body">
        <h4 class="history-card-title" title="${escapeHtml(item.title)}">${escapeHtml(item.title)}</h4>
        <div class="history-card-meta">Ch. ${escapeHtml(item.chapter ?? '-')}</div>
      </div>
    `;

    container.appendChild(card);
  });

  let autoScrollInterval = null;
  const scrollSpeed = 1;
  const scrollIntervalTime = 30;

  function startAutoScroll() {
    if (autoScrollInterval) return;
    autoScrollInterval = setInterval(() => {
      if (!container) return;
      if (container.scrollLeft + container.clientWidth >= container.scrollWidth - 2) {
        container.scrollTo({ left: 0, behavior: 'smooth' });
      } else {
        container.scrollLeft += scrollSpeed;
      }
    }, scrollIntervalTime);
  }

  function stopAutoScroll() {
    if (autoScrollInterval) {
      clearInterval(autoScrollInterval);
      autoScrollInterval = null;
    }
  }

  startAutoScroll();

  wrapper.addEventListener('mouseenter', stopAutoScroll);
  wrapper.addEventListener('mouseleave', startAutoScroll);
  wrapper.addEventListener('touchstart', stopAutoScroll, { passive: true });
  wrapper.addEventListener('wheel', () => {
    stopAutoScroll();
    clearTimeout(window.resumeScrollTimer);
    window.resumeScrollTimer = setTimeout(startAutoScroll, 4000);
  }, { passive: true });
}

async function loadManga(query = '', page = 1) {
  const grid = document.getElementById('mangaGrid');
  const sectionTitle = document.getElementById('sectionTitle');

  if (!grid) return;

  showLoading(grid, 'Memuat manga...');

  try {
    let endpoint = `/api/manga?page=${page}&limit=${currentLimit}`;
    if (query) {
      endpoint += `&query=${encodeURIComponent(query)}`;
    }

    const result = await fetchJsonWithTimeout(endpoint);
    const mangaList = Array.isArray(result) ? result : (result.data || result.results || []);

    grid.innerHTML = '';

    if (mangaList.length === 0) {
      showEmpty(grid,
        query ? `Tidak ada hasil untuk "${query}".` : 'Manga tidak ditemukan.',
        query ? 'LIHAT SEMUA' : null,
        query ? () => loadManga('', 1) : null
      );
      return;
    }

    if (sectionTitle) {
      sectionTitle.textContent = query ? `Hasil Pencarian: "${query}"` : 'Update Terbaru';
    }

    mangaList.forEach(manga => {
      grid.appendChild(renderMangaCard(manga));
    });

  } catch (error) {
    console.error('Fetch Error:', error);
    showError(grid, formatFetchError(error, 'Gagal mengambil data manga.'), () => loadManga(query, page));
  }
}

async function loadPopular() {
  const grid = document.getElementById('popularGrid');
  if (!grid) return;

  try {
    const result = await fetchJsonWithTimeout('/api/manga?sort=rating&page=1&limit=12');
    const mangaList = Array.isArray(result) ? result : (result.data || result.results || []);

    grid.innerHTML = '';

    if (mangaList.length === 0) {
      grid.innerHTML = '<p class="error" style="font-size: 13px; color: var(--text-muted, #888);">Belum ada data populer.</p>';
      return;
    }

    mangaList.forEach(manga => {
      grid.appendChild(renderMangaCard(manga));
    });
  } catch (error) {
    console.error('Popular Fetch Error:', error);
    grid.innerHTML = '<p class="error" style="font-size: 13px; color: var(--text-muted, #888);">Gagal memuat manga populer.</p>';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const searchForm = document.getElementById('searchForm');
  const searchInput = document.getElementById('searchInput');
  const backToTopBtn = document.getElementById('backToTop');

  renderHomeHistory();

  searchForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    currentQuery = searchInput.value.trim();
    loadManga(currentQuery, 1);
  });

  setupBackToTop(backToTopBtn, 300);

  loadPopular();
  loadManga();

  // Perbaiki cover yang hilang saat kembali dari detail/reader via browser back button (bfcache).
  window.addEventListener('pageshow', (event) => {
    if (!event.persisted) return;
    document.querySelectorAll('main img').forEach((img) => {
      if (!img.complete || img.naturalWidth === 0) {
        const currentSrc = img.src;
        img.src = '';
        img.src = currentSrc;
      }
    });
  });
});
