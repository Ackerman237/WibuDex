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
    card.href = `/manga/html/detail.html?slug=${encodeURIComponent(item.slug)}`;
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

// ---------- Hero featured dinamis (rotasi otomatis + manual) ----------
const HERO_POOL_SIZE = 6;
const HERO_SLIDE_INTERVAL_MS = 8000;

let heroPool = [];
let heroIndex = 0;
let heroTimer = null;

/** Cover lewat image-proxy (konsisten renderMangaCard, ukuran hero w=1200). */
function heroProxyImage(thumb) {
  return thumb
    ? `/api/image-proxy?url=${encodeURIComponent(thumb)}&w=1200`
    : 'https://placehold.co/1200x400/201b16/ece6dc?text=Featured+Manga';
}

const HERO_PLACEHOLDER_BG =
  'url("https://placehold.co/1200x400/201b16/ece6dc?text=Featured+Manga")';

/** Terapkan satu manga ke seluruh elemen hero (dengan crossfade halus). */
function applyHeroSlide(manga) {
  const bg = document.getElementById('heroBg');
  const title = document.getElementById('heroTitle');
  const ratingText = document.getElementById('heroRatingText');
  const typeBadge = document.getElementById('heroTypeBadge');
  const readBtn = document.getElementById('heroReadBtn');
  const infoBtn = document.getElementById('heroInfoBtn');
  const banner = document.getElementById('heroBanner');
  if (!bg || !title || !manga) return;

  // Crossfade: pudarkan → ganti gambar → munculkan lagi
  bg.style.opacity = '0';
  setTimeout(() => {
    bg.style.backgroundImage = `url("${heroProxyImage(manga.thumb)}")`;
    bg.style.opacity = '1';
  }, 250);

  // textContent (bukan innerHTML) — judul berasal dari scraper, anti-XSS
  title.textContent = manga.title || 'Tanpa Judul';
  ratingText.textContent = manga.rating ?? '-';

  const type = (manga.type || '').trim();
  if (type) {
    typeBadge.style.display = '';
    typeBadge.textContent = type.toUpperCase();
  } else {
    typeBadge.style.display = 'none';
  }
  const flag = typeof getMangaFlag === 'function' ? getMangaFlag(type) : '';
  if (flag) banner.dataset.flag = flag; else delete banner.dataset.flag;

  const slug = manga.slug || '';
  const detailHref = slug ? `/manga/html/detail.html?slug=${encodeURIComponent(slug)}` : '#';
  [readBtn, infoBtn].forEach((a) => {
    a.href = detailHref;
    a.style.opacity = slug ? '' : '0.5';
    if (!slug) a.setAttribute('aria-disabled', 'true');
    else a.removeAttribute('aria-disabled');
  });
}

function syncHeroDots() {
  const dots = document.getElementById('heroDots');
  if (!dots) return;
  [...dots.children].forEach((dot, i) => dot.classList.toggle('active', i === heroIndex));
}

// SATU pintu navigasi slide: dipakai timer otomatis, dots, panah, dan swipe.
// Selalu me-reset timer supaya tidak "baru geser manual, langsung pindah lagi".
function goToSlide(i) {
  if (!heroPool.length) return;
  heroIndex = ((i % heroPool.length) + heroPool.length) % heroPool.length;
  applyHeroSlide(heroPool[heroIndex]);
  syncHeroDots();
  startHeroTimer();
}

function startHeroTimer() {
  stopHeroTimer();
  heroTimer = setInterval(() => goToSlide(heroIndex + 1), HERO_SLIDE_INTERVAL_MS);
}
function stopHeroTimer() {
  clearInterval(heroTimer);
  heroTimer = null;
}

/** Preload sisa gambar pool di belakang layar agar crossfade tak "kedip kosong". */
function preloadHeroPool(pool) {
  pool.forEach((m) => {
    const img = new Image();
    img.src = heroProxyImage(m.thumb);
  });
}

function startHeroRotation(pool) {
  stopHeroTimer();
  heroPool = pool;
  heroIndex = Math.floor(Date.now() / 86400000) % pool.length; // seed harian deterministik

  // Bangun dots
  const dots = document.getElementById('heroDots');
  if (dots) {
    dots.innerHTML = '';
    pool.forEach((_, i) => {
      const dot = document.createElement('button');
      dot.type = 'button';
      dot.className = 'hero-dot';
      dot.setAttribute('aria-label', `Featured ${i + 1}`);
      dot.addEventListener('click', () => goToSlide(i));
      dots.appendChild(dot);
    });
  }

  // Panah desktop
  document.getElementById('heroPrevBtn')?.addEventListener('click', () => goToSlide(heroIndex - 1));
  document.getElementById('heroNextBtn')?.addEventListener('click', () => goToSlide(heroIndex + 1));

  // Swipe mobile: delta horizontal ≥48px & mendominasi sumbu vertikal
  // (guard dy menjaga scroll halaman tetap normal). Tap biasa = klik normal.
  const banner = document.getElementById('heroBanner');
  if (banner) {
    let startX = 0, startY = 0, swiping = false;
    banner.addEventListener('touchstart', (e) => {
      startX = e.changedTouches[0].clientX;
      startY = e.changedTouches[0].clientY;
      swiping = true;
      stopHeroTimer();
    }, { passive: true });
    banner.addEventListener('touchend', (e) => {
      if (!swiping) return;
      swiping = false;
      const dx = e.changedTouches[0].clientX - startX;
      const dy = e.changedTouches[0].clientY - startY;
      if (Math.abs(dx) >= 48 && Math.abs(dx) > Math.abs(dy)) {
        goToSlide(heroIndex + (dx < 0 ? 1 : -1));
      } else {
        startHeroTimer(); // tap biasa — lanjutkan siklus
      }
    }, { passive: true });

    // Pause saat kursor di atas banner (pola sama dengan history carousel)
    banner.addEventListener('mouseenter', stopHeroTimer);
    banner.addEventListener('mouseleave', () => {
      if (!swiping) startHeroTimer();
    });
  }

  applyHeroSlide(pool[heroIndex]);
  syncHeroDots();
  preloadHeroPool(pool);
  startHeroTimer();
}

/** Fallback rapi: fetch gagal/kosong — hero tidak pernah tampak rusak. */
function showHeroUnavailable(message) {
  stopHeroTimer();
  heroPool = [];
  const dots = document.getElementById('heroDots');
  if (dots) dots.innerHTML = '';
  const bg = document.getElementById('heroBg');
  if (bg) { bg.style.opacity = '1'; bg.style.backgroundImage = HERO_PLACEHOLDER_BG; }
  const title = document.getElementById('heroTitle');
  if (title) title.textContent = message || 'Featured tidak tersedia';
  const ratingText = document.getElementById('heroRatingText');
  if (ratingText) ratingText.textContent = '-';
  const typeBadge = document.getElementById('heroTypeBadge');
  if (typeBadge) typeBadge.style.display = 'none';
  ['#heroReadBtn', '#heroInfoBtn'].forEach((sel) => {
    const a = document.querySelector(sel);
    if (a) { a.href = '#'; a.style.opacity = '0.5'; a.setAttribute('aria-disabled', 'true'); }
  });
}

/** Tampilan awal hero selagi fetch berjalan. */
function setHeroLoading() {
  const title = document.getElementById('heroTitle');
  if (title) title.textContent = 'Memuat featured…';
  const typeBadge = document.getElementById('heroTypeBadge');
  if (typeBadge) typeBadge.style.display = 'none';
  const bg = document.getElementById('heroBg');
  if (bg) { bg.style.backgroundImage = HERO_PLACEHOLDER_BG; bg.style.opacity = '1'; }
}

/**
 * Toggle "Lihat Semua" untuk grid populer.
 * Collapse kartu ditangani CSS (#popularGrid tanpa .is-expanded menampilkan
 * 5 kartu di desktop / 6 di layar sempit); JS hanya mengubah class + label.
 * @param {number} totalShown - Jumlah kartu yang benar-benar dirender
 */
function setupPopularMore(totalShown) {
  const btn = document.getElementById('popularMoreBtn');
  const grid = document.getElementById('popularGrid');
  if (!btn || !grid) return;

  // Reset: setelah fetch retry, grid dibangun ulang — mulai dari collapsed lagi
  grid.classList.remove('is-expanded');

  const labelEl = btn.querySelector('.btn-more__label');
  if (!labelEl) return;

  // ≤ jumlah tampilan collapsed (maks 6 di layar sempit)? tombol tak perlu ada
  if (!totalShown || totalShown <= 6) {
    btn.hidden = true;
    return;
  }

  btn.hidden = false;
  btn.setAttribute('aria-expanded', 'false');
  labelEl.textContent = 'Lihat Semua';

  // onclick (bukan addEventListener): aman dipanggil ulang saat fetch retry,
  // handler lama otomatis tergantikan tanpa numpuk
  btn.onclick = () => {
    const expanded = grid.classList.toggle('is-expanded');
    btn.setAttribute('aria-expanded', String(expanded));
    labelEl.textContent = expanded ? 'Tampilkan Lebih Sedikit' : 'Lihat Semua';
  };
}

async function loadHeroAndPopular() {
  const grid = document.getElementById('popularGrid');
  if (!grid) return;

  setHeroLoading();

  try {
    // limit=18: 6 pertama jadi pool featured, 12 sisanya utuh untuk grid populer
    const result = await fetchJsonWithTimeout('/api/manga?sort=rating&page=1&limit=18');
    const mangaList = Array.isArray(result) ? result : (result.data || result.results || []);

    grid.innerHTML = '';

    if (mangaList.length === 0) {
      showHeroUnavailable('Belum ada data populer.');
      grid.innerHTML = '<p class="error" style="font-size: 13px; color: var(--text-muted, #888);">Belum ada data populer.</p>';
      return;
    }

    const pool = mangaList.slice(0, Math.min(HERO_POOL_SIZE, mangaList.length));
    startHeroRotation(pool);

    mangaList.slice(pool.length).forEach(manga => {
      grid.appendChild(renderMangaCard(manga));
    });

    setupPopularMore(mangaList.length - pool.length);
  } catch (error) {
    console.error('Hero/Popular Fetch Error:', error);
    // Grid gagal dimuat → tombol see-more tidak relevan, sembunyikan
    const moreBtn = document.getElementById('popularMoreBtn');
    if (moreBtn) moreBtn.hidden = true;
    showHeroUnavailable(formatFetchError(error, 'Gagal memuat manga populer.'));
    showError(grid, formatFetchError(error, 'Gagal memuat manga populer.'), () => loadHeroAndPopular());
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

  loadHeroAndPopular();
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
