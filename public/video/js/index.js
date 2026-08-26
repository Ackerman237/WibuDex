// video/js/index.js — Homepage Video Streaming Wibudex
// Hero Spotlight, Continue Watching, Category Carousels, & Video Grid.

let currentOffset = 1;
let currentCategory = new URLSearchParams(window.location.search).get('category') || '';
let currentPage = parseInt(new URLSearchParams(window.location.search).get('page')) || 1;
let currentQuery = '';
let lastHasNext = false;
const HYBRID_THRESHOLD = 60;

function renderVideoCard(video) {
  return renderMediaCard(video, { variant: 'grid' });
}

// ─── Continue Watching (Lanjutkan Menonton) ───
function loadContinueWatching() {
  const container = document.getElementById('continueWatchingTrack');
  const section = document.getElementById('continueWatchingSection');
  if (!container || !section) return;

  try {
    const historyKeys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('video_progress_')) {
        const raw = localStorage.getItem(key);
        if (raw) {
          const item = JSON.parse(raw);
          if (item && item.slug) historyKeys.push(item);
        }
      }
    }

    if (historyKeys.length === 0) {
      section.style.display = 'none';
      return;
    }

    // Sort by last watched time
    historyKeys.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    container.innerHTML = '';

    historyKeys.slice(0, 10).forEach((item) => {
      const card = renderMediaCard(item, {
        variant: 'grid',
        meta: item.lastPositionFormatted ? `Lanjut ${item.lastPositionFormatted}` : (item.date || 'Tersimpan'),
      });
      container.appendChild(card);
    });

    section.style.display = 'block';
  } catch {
    section.style.display = 'none';
  }
}

// ─── Load Main Video Feed & Hero Spotlight ───
async function loadVideos(reset = false) {
  const grid = document.getElementById('videoGrid');
  const sectionTitle = document.getElementById('sectionTitle');
  const loadMoreBtn = document.getElementById('loadMoreBtn');

  if (!grid) return;

  if (reset) {
    currentOffset = 1;
    currentQuery = '';
    grid.innerHTML = '';
  }

  try {
    let endpoint;
    if (currentCategory) {
      endpoint = `/api/video/category?category=${encodeURIComponent(currentCategory)}&page=${currentPage}`;
    } else if (currentQuery) {
      endpoint = `/api/video/search?query=${encodeURIComponent(currentQuery)}&page=${currentOffset}`;
    } else {
      endpoint = `/api/video?page=${currentOffset}`;
    }

    const res = await fetch(endpoint);
    const result = await res.json();
    if (!result.success) throw new Error(result.message || 'Gagal memuat video.');

    const payload = result.data || {};
    const videos = Array.isArray(payload) ? payload : (payload.videos || []);
    const hasNext = Array.isArray(payload) ? videos.length > 0 : Boolean(payload.hasNext);
    lastHasNext = hasNext;

    if (reset) grid.innerHTML = '';

    if (videos.length === 0 && currentOffset === 1) {
      grid.innerHTML = '<p class="error">Tidak ada video ditemukan.</p>';
      if (loadMoreBtn) loadMoreBtn.style.display = 'none';
      return;
    }

    // Inisialisasi Hero Spotlight pada kunjungan beranda awal
    if (reset && !currentCategory && !currentQuery && window.initHeroSpotlight && videos.length >= 3) {
      window.initHeroSpotlight(videos);
    }

    if (sectionTitle) {
      sectionTitle.textContent = currentQuery
        ? `Hasil Pencarian: "${currentQuery}"`
        : currentCategory
          ? `Kategori: ${currentCategory}`
          : 'Rilis Video Terbaru';
    }

    videos.forEach((video) => {
      grid.appendChild(renderVideoCard(video));
    });

    if (currentCategory) {
      renderCategoryPagination(currentPage, hasNext);
      if (loadMoreBtn) loadMoreBtn.style.display = 'none';
    } else {
      currentOffset++;
      if (loadMoreBtn) {
        loadMoreBtn.style.display = hasNext ? 'block' : 'none';
        loadMoreBtn.textContent = 'SEE MORE';
        loadMoreBtn.onclick = () => loadVideos(false);
      }
      const pag = document.getElementById('videoPagination');
      if (pag) pag.style.display = 'none';
    }
  } catch (err) {
    console.error('Gagal memuat video:', err);
    if (reset) {
      grid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center;">
          <p class="error">Gagal memuat video: ${escapeHtml(err.message)}</p>
          <button type="button" class="retry-btn">COBA LAGI</button>
        </div>`;
      grid.querySelector('.retry-btn')?.addEventListener('click', () => loadVideos(true));
    }
  }
}

function renderCategoryPagination(page, hasNext) {
  const nav = document.getElementById('videoPagination');
  const prevBtn = document.getElementById('prevBtn');
  const nextBtn = document.getElementById('nextBtn');
  const pageNumbers = document.getElementById('pageNumbers');
  if (!nav || !prevBtn || !nextBtn || !pageNumbers) return;
  nav.style.display = 'flex';
  prevBtn.disabled = page <= 1;
  nextBtn.disabled = !hasNext;
  prevBtn.onclick = () => { if (page > 1) goToCategoryPage(page - 1); };
  nextBtn.onclick = () => { if (hasNext) goToCategoryPage(page + 1); };
  pageNumbers.innerHTML = '';
  const pages = new Set([1, page]);
  if (page > 1) pages.add(page - 1);
  if (hasNext) pages.add(page + 1);
  if (page > 2) pages.add(2);
  const sorted = [...pages].sort((a, b) => a - b).filter((n) => n >= 1);
  sorted.forEach((n) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'page-number' + (n === page ? ' active' : '');
    btn.textContent = String(n);
    if (n !== page) btn.addEventListener('click', () => goToCategoryPage(n));
    else btn.disabled = true;
    pageNumbers.appendChild(btn);
  });
}

function goToCategoryPage(page) {
  currentPage = page;
  const url = new URL(window.location.href);
  url.searchParams.set('page', String(page));
  if (currentCategory) url.searchParams.set('category', currentCategory);
  history.pushState({}, '', url);
  const grid = document.getElementById('videoGrid');
  if (grid) grid.innerHTML = '<p class="loading">Memuat...</p>';
  window.scrollTo({ top: 0, behavior: 'smooth' });
  loadVideos(false);
}

// ─── Carousel Controls (Scroll Prev/Next) ───
function setupCarouselScroll(track, prevBtn, nextBtn) {
  if (!track) return;
  const scrollAmount = () => track.clientWidth * 0.75;
  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      track.scrollBy({ left: -scrollAmount(), behavior: 'smooth' });
    });
  }
  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      track.scrollBy({ left: scrollAmount(), behavior: 'smooth' });
    });
  }
}

// ─── Home Category Horizontal Rows ───
async function loadCategorySections() {
  const host = document.getElementById('categorySections');
  if (!host || currentCategory || currentQuery) return;

  let cats;
  try {
    const res = await fetch('/api/video/categories');
    cats = (await res.json())?.data || [];
  } catch { return; }

  for (const cat of cats.slice(0, 6)) {
    const sec = document.createElement('section');
    sec.className = 'carousel-section';
    sec.dataset.slug = cat.slug;
    sec.innerHTML = `
      <div class="section-header">
        <h2 class="section-title">
          <svg class="ic section-title__icon" viewBox="0 0 24 24" fill="currentColor"><path d="M4 6h16v2H4zm0 5h16v2H4zm0 5h16v2H4z"/></svg>
          ${escapeHtml(cat.name || cat.slug)}
        </h2>
        <a class="section-more-link" href="/video/html/series.html?category=${encodeURIComponent(cat.slug)}">
          Lihat Semua
          <svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="9 18 15 12 9 6"></polyline></svg>
        </a>
      </div>
      <div class="carousel-wrap">
        <button class="carousel-btn prev" type="button" aria-label="Sebelumnya">‹</button>
        <div class="carousel-track"></div>
        <button class="carousel-btn next" type="button" aria-label="Berikutnya">›</button>
      </div>
    `;
    host.appendChild(sec);
    setupCarouselScroll(
      sec.querySelector('.carousel-track'),
      sec.querySelector('.carousel-btn.prev'),
      sec.querySelector('.carousel-btn.next')
    );
    observeCatSection(sec, cat);
  }
}

function observeCatSection(sec, cat) {
  const io = new IntersectionObserver((entries) => {
    entries.forEach(async (entry) => {
      if (!entry.isIntersecting) return;
      io.unobserve(entry.target);
      await loadCatVideos(sec, cat);
    });
  }, { rootMargin: '400px 0px' });
  io.observe(sec);
}

async function loadCatVideos(sec, cat) {
  const track = sec.querySelector('.carousel-track');
  try {
    const res = await fetch(`/api/video/category?category=${encodeURIComponent(cat.slug)}&page=1`);
    const result = await res.json();
    if (!result.success) throw new Error();
    const videos = (result.data?.videos || []).slice(0, 10);
    videos.forEach((v) => {
      track.appendChild(renderMediaCard(v, { variant: 'grid' }));
    });
  } catch {
    // Abaikan jika kategori kosong
  }
}

function setupHybridInfiniteScroll() {
  const sentinel = document.getElementById('infiniteSentinel');
  const grid = document.getElementById('videoGrid');
  const loadMoreBtn = document.getElementById('loadMoreBtn');
  if (!sentinel || !grid || !loadMoreBtn) return;

  let isLoading = false;
  const observer = new IntersectionObserver(async (entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting || isLoading) continue;
      if (currentCategory || currentQuery) continue;
      const total = grid.querySelectorAll('.video-card').length;
      if (total >= HYBRID_THRESHOLD) continue;
      if (!lastHasNext) continue;
      isLoading = true;
      await loadVideos(false);
      isLoading = false;
    }
  }, { rootMargin: '600px 0px' });
  observer.observe(sentinel);
}

document.addEventListener('DOMContentLoaded', () => {
  if (currentCategory) {
    document.getElementById('heroSpotlight')?.style.setProperty('display', 'none');
    document.getElementById('continueWatchingSection')?.style.setProperty('display', 'none');
  }

  const searchForm = document.getElementById('searchForm');
  const searchInput = document.getElementById('searchInput');

  if (searchForm) {
    searchForm.addEventListener('submit', (e) => {
      e.preventDefault();
      currentQuery = searchInput ? searchInput.value.trim() : '';
      currentOffset = 1;
      const grid = document.getElementById('videoGrid');
      if (grid) grid.innerHTML = '';
      document.getElementById('heroSpotlight')?.style.setProperty('display', 'none');
      document.getElementById('continueWatchingSection')?.style.setProperty('display', 'none');
      document.getElementById('categorySections')?.style.setProperty('display', 'none');
      loadVideos(false);
    });
  }

  // Setup Carousel Continue Watching
  const cwSection = document.getElementById('continueWatchingSection');
  if (cwSection) {
    setupCarouselScroll(
      cwSection.querySelector('.carousel-track'),
      cwSection.querySelector('.carousel-btn.prev'),
      cwSection.querySelector('.carousel-btn.next')
    );
  }

  loadContinueWatching();
  loadVideos(true).then(() => setupHybridInfiniteScroll());
  loadCategorySections();
});