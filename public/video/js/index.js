// video/js/index.js — Neko Video list page

let currentOffset = 1;
let currentCategory = new URLSearchParams(window.location.search).get('category') || '';
let currentPage = parseInt(new URLSearchParams(window.location.search).get('page')) || 1;
let currentQuery = '';

function renderVideoCard(video) {
  // Markup terkonsolidasi di cards.js (escaping + fallback thumb seragam)
  return renderMediaCard(video, { variant: 'grid' });
}

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
    // Determin endpoint berdasarkan filter yang aktif
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

    // Normalisasi payload: API mengembalikan {videos, hasNext} atau array langsung
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

    if (sectionTitle) {
      sectionTitle.textContent = currentQuery
        ? `Hasil Pencarian: "${currentQuery}"`
        : currentCategory
          ? `Kategori: ${currentCategory}`
          : 'Video Terbaru';
    }

    videos.forEach(video => {
      grid.appendChild(renderVideoCard(video));
    });

    // Pagination: kategori pakai halaman bernomor, lainnya pakai SEE MORE
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
    if (n === 1 && sorted.includes(2) && page > 3) {
      // ellipsis handled simply: skip
    }
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

async function loadSchedule() {
  const container = document.getElementById('scheduleContainer');
  if (!container) return;

  try {
    const res = await fetch('/api/video/schedule');
    const result = await res.json();
    if (!result.success || !Array.isArray(result.data)) {
      container.innerHTML = `
        <p class="error">Jadwal belum tersedia dari sumber. Coba lagi nanti.</p>
        <div style="text-align:center;">
          <button type="button" class="retry-btn">COBA LAGI</button>
        </div>`;
      container.querySelector('.retry-btn')?.addEventListener('click', loadSchedule);
      return;
    }

    if (result.data.length === 0) {
      // Sumber resmi belum mengisi jadwal (bukan error) — empty state ramah
      container.innerHTML = `
        <div class="schedule-empty">
          <svg class="ic schedule-empty__icon" aria-hidden="true"><use href="/manga/icons.svg#i-clock"></use></svg>
          <p class="schedule-empty__title">Belum ada jadwal tayang</p>
          <p class="schedule-empty__hint">Sumber belum mempublikasikan jadwal — daftar akan muncul otomatis begitu tersedia.</p>
          <button type="button" class="retry-btn schedule-empty__retry">Coba lagi</button>
        </div>`;
      container.querySelector('.schedule-empty__retry')?.addEventListener('click', loadSchedule);
      return;
    }

    container.innerHTML = '';
    result.data.forEach((dayGroup) => {
      const dayWrap = document.createElement('div');
      dayWrap.className = 'schedule-day';
      dayWrap.hidden = (dayGroup.series || []).length === 0;

      const head = document.createElement('h3');
      head.className = 'schedule-day-title';
      head.textContent = dayGroup.day || '-';
      dayWrap.appendChild(head);

      const list = document.createElement('div');
      list.className = 'schedule-series-list';

      (dayGroup.series || []).forEach((item) => {
        const card = document.createElement('a');
        card.className = 'schedule-card';
        card.href = `/video/html/watch.html?slug=${encodeURIComponent(item.slug)}`;

        const thumbUrl = item.thumb || '';
        const title = escapeHtml(item.title || '');

        card.innerHTML = `
          <img src="${escapeHtml(thumbUrl)}" alt="${title}" loading="lazy" referrerpolicy="no-referrer">
          <span class="schedule-card-title">${title}</span>
        `;
        list.appendChild(card);
      });

      if ((dayGroup.series || []).length === 0) {
        list.innerHTML = '<p class="error">Belum ada seri untuk grup ini.</p>';
      }

      dayWrap.appendChild(list);
      container.appendChild(dayWrap);
    });
  } catch (err) {
    console.error('Gagal memuat jadwal:', err);
    container.innerHTML = `
      <p class="error">Gagal memuat jadwal.</p>
      <div style="text-align: center;">
        <button type="button" class="retry-btn">COBA LAGI</button>
      </div>`;
    container.querySelector('.retry-btn')?.addEventListener('click', loadSchedule);
  }
}

async function setupRandomButton() {
  const btn = document.getElementById('randomBtn');
  if (!btn) return;

  btn.addEventListener('click', async () => {
    if (btn.disabled) return;
    btn.disabled = true;
    const original = btn.textContent;
    btn.textContent = 'MENCARI...';
    try {
      const res = await fetch('/api/video/random');
      const result = await res.json();
      if (!result.success || !result.data?.slug) throw new Error(result.message || 'Gagal');
      window.location.href = `/video/html/watch.html?slug=${encodeURIComponent(result.data.slug)}`;
    } catch (err) {
      console.error('Gagal ambil video acak:', err);
      alert('Gagal mengambil video acak, coba lagi.');
      btn.disabled = false;
      btn.textContent = original;
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  // Kategori view: jadwal tak relevan, sembunyikan (hemat tempat)
  if (currentCategory) {
    document.querySelector('.schedule-section')?.style.setProperty('display', 'none');
  }

  const searchForm = document.getElementById('searchForm');
  const searchInput = document.getElementById('searchInput');
  const backToTopBtn = document.getElementById('backToTop');

  if (searchForm) {
    searchForm.addEventListener('submit', (e) => {
      e.preventDefault();
      // FIX BUG: dulu memakai loadVideos(true) yang me-RESET currentQuery=''
      // sebelum endpoint dibangun → pencarian selalu menampilkan video
      // terbaru. Sekarang: kosongkan grid manual + jalankan tanpa reset.
      currentQuery = searchInput ? searchInput.value.trim() : '';
      currentOffset = 1;
      const grid = document.getElementById('videoGrid');
      if (grid) grid.innerHTML = '';
      loadVideos(false);
    });
  }

  setupBackToTop(backToTopBtn, 300);

  loadSchedule();
  setupRandomButton();
  loadVideos(true).then(() => setupHybridInfiniteScroll());
  loadCategorySections();
});

let lastHasNext = false;
const HYBRID_THRESHOLD = 60;

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

// ─── Home per-kategori (lazy-load + link ke halaman kategori) ───

const CAT_VISIBLE = 3;

function buildCatSection(cat) {
  const sec = document.createElement('section');
  sec.className = 'cat-section manga-section';
  sec.dataset.slug = cat.slug;
  sec.innerHTML = `
    <div class="cat-head">
      <h2 class="section-title">${escapeHtml(cat.name || cat.slug)}</h2>
      <a class="cat-all" href="/video/html/index.html?category=${encodeURIComponent(cat.slug)}">Lihat semua</a>
    </div>
    <div class="video-grid cat-grid"></div>
    <p class="cat-status loading">Memuat…</p>`;
  return sec;
}

async function loadCategorySections() {
  const host = document.getElementById('categorySections');
  if (!host) return;

  let cats;
  try {
    const res = await fetch('/api/video/categories');
    cats = (await res.json())?.data || [];
  } catch { return; }

  for (const cat of cats) {
    const sec = buildCatSection(cat);
    host.appendChild(sec);
    observeCatSection(sec, cat);
  }
}

function observeCatSection(sec, cat) {
  const io = new IntersectionObserver(async (entries) => {
    entries.forEach(async (entry) => {
      if (!entry.isIntersecting) return;
      io.unobserve(entry.target);
      await loadCatVideos(sec, cat);
    });
  }, { rootMargin: '400px 0px' });
  io.observe(sec);
}

async function loadCatVideos(sec, cat) {
  const grid = sec.querySelector('.cat-grid');
  const statusEl = sec.querySelector('.cat-status');
  try {
    const res = await fetch(`/api/video/category?category=${encodeURIComponent(cat.slug)}&page=1`);
    const result = await res.json();
    if (!result.success) throw new Error();
    const videos = (result.data?.videos || []).slice(0, 15);
    statusEl.remove();

    videos.forEach((v, idx) => {
      const card = renderMediaCard(v, { variant: 'grid' });
      if (idx >= CAT_VISIBLE) card.hidden = true;
      grid.appendChild(card);
    });

    if (videos.length > CAT_VISIBLE) {
      const more = document.createElement('a');
      more.className = 'btn-see-more cat-more';
      more.href = `/video/html/index.html?category=${encodeURIComponent(cat.slug)}`;
      more.textContent = `Lihat semua — ${videos.length} video`;
      grid.after(more);
    }
  } catch {
    if (statusEl) statusEl.textContent = 'Gagal memuat.';
  }
}