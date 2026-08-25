// video/js/index.js — Neko Video list page

let currentOffset = 1;
let currentCategory = new URLSearchParams(window.location.search).get('category') || '';
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
      endpoint = `/api/video/category?category=${encodeURIComponent(currentCategory)}&page=${currentOffset}`;
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

    currentOffset++; // naik ke halaman selanjutnya

    if (loadMoreBtn) {
      loadMoreBtn.style.display = hasNext ? 'block' : 'none';
      loadMoreBtn.textContent = 'SEE MORE';
      loadMoreBtn.onclick = () => loadVideos(false);
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

        const thumbUrl = item.thumb || 'https://placehold.co/100x140?text=?';
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
  loadVideos(true);
  loadCategorySections();
});

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
      const more = document.createElement('button');
      more.className = 'btn-see-more cat-more';
      more.textContent = `Lihat lebih banyak (${videos.length - CAT_VISIBLE} lagi)`;
      more.addEventListener('click', () => {
        const cards = [...grid.children];
        const anyHidden = cards.some((c) => c.hidden);
        cards.forEach((c, i) => { if (i >= CAT_VISIBLE) c.hidden = anyHidden; });
        more.textContent = anyHidden ? 'Tampilkan lebih sedikit' : `Lihat lebih banyak (${videos.length - CAT_VISIBLE} lagi)`;
      });
      grid.after(more);
    }
  } catch {
    if (statusEl) statusEl.textContent = 'Gagal memuat.';
  }
}