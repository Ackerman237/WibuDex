// catalog.js — Paginated manga list with Floating Pill Filter Bar & Bento Grid

const currentLimit = 50;

const urlParams = new URLSearchParams(window.location.search);
let currentPage = parseInt(urlParams.get('page')) || 1;
let currentQuery = urlParams.get('query') || '';
let currentSort = urlParams.get('sort') || 'newest';
let currentGenre = urlParams.get('genre') || '';
let currentStatus = urlParams.get('status') || '';
let currentType = urlParams.get('type') || '';

if (currentPage < 1) currentPage = 1;

// --- Filter State (Genre from select, Status, Tipe) ---
const genreSelect = document.getElementById('genreSelect');
const statusSelect = document.getElementById('statusSelect');
const typeSelect = document.getElementById('typeSelect');
const sortSelect = document.getElementById('sortSelect');

// Show original filter selects so users can filter (replaces hidden + pill bar logic for reliability)
function showFilters() {
  if (genreSelect) genreSelect.style.display = '';
  if (statusSelect) statusSelect.style.display = '';
  if (typeSelect) typeSelect.style.display = '';
  if (sortSelect) sortSelect.style.display = '';
}

// Hide filter selects (alternative: pill bar mode)
function hideFilters() {
  if (genreSelect) genreSelect.style.display = 'none';
  if (statusSelect) statusSelect.style.display = 'none';
  if (typeSelect) typeSelect.style.display = 'none';
}

// Initialize filter values from URL params
function initFiltersFromURL() {
  if (genreSelect) {
    if (genreSelect.multiple) {
      // Multi-genre: URL "genre=a,b" → tandai tiap option yang cocok
      const wanted = new Set((currentGenre || '').split(',').filter(Boolean));
      [...genreSelect.options].forEach((o) => {
        o.selected = wanted.has(o.value);
      });
    } else {
      genreSelect.value = currentGenre || '';
    }
  }
  if (statusSelect) statusSelect.value = currentStatus || '';
  if (typeSelect) typeSelect.value = currentType || '';
  if (sortSelect) sortSelect.value = (urlParams.get('sort') || 'newest');
}

/** Baca nilai efektif sebuah select — mendukung mode multiple. */
function readSelectValue(sel) {
  if (!sel) return '';
  if (sel.multiple) {
    return [...sel.selectedOptions]
      .map((o) => o.value)
      .filter(Boolean)
      .join(',');
  }
  return sel.value;
}

// Event listeners for filter changes
function setupFilterListeners() {
  if (genreSelect) {
    genreSelect.addEventListener('change', () => {
      currentGenre = readSelectValue(genreSelect);
      goToPage(1);
    });
  }
  if (statusSelect) {
    statusSelect.addEventListener('change', () => {
      currentStatus = statusSelect.value;
      goToPage(1);
    });
  }
  if (typeSelect) {
    typeSelect.addEventListener('change', () => {
      currentType = typeSelect.value;
      goToPage(1);
    });
  }
  if (sortSelect) {
    sortSelect.addEventListener('change', () => {
      currentSort = sortSelect.value;
      goToPage(1);
    });
  }
}



// --- Load Genres from API & Initialize ---

async function loadGenres() {
  const select = document.getElementById('genreSelect');
  if (!select) return;

  try {
    const result = await fetchJsonWithTimeout('/api/manga/categories');
    const genres = result?.data || [];

    // Keep select in sync: reset and add default "Semua Genre" first
    select.innerHTML = '<option value="">Semua Genre</option>';

    genres.forEach((g) => {
      const option = document.createElement('option');
      option.value = g.slug || g.name;
      option.textContent = g.name;
      select.appendChild(option);
    });

    // Re-select dari URL — innerHTML reset di atas menghapus seleksi awal
    // (multi: "genre=a,b"; single: satu slug).
    const wanted = new Set((currentGenre || '').split(',').filter(Boolean));
    [...select.options].forEach((o) => {
      o.selected = wanted.has(o.value);
    });
    if (!select.multiple && !wanted.size) {
      select.selectedIndex = 0; // "Semua Genre"
    }
  } catch {
    // Fallback jika API gagal: pastikan minimal ada opsi default
    if (select.children.length === 0) {
      select.innerHTML = '<option value="">Semua Genre</option>';
    }
  }
}

async function loadManga(query = '', page = 1, sort = 'newest', genre = '', status = '', type = '') {
  const grid = document.getElementById('mangaGrid');
  const sectionTitle = document.getElementById('sectionTitle');

  if (!grid) return;

  showLoading(grid, 'Memuat manga...');

  try {
    let endpoint = `/api/manga?page=${page}&limit=${currentLimit}`;
    if (query) endpoint += `&query=${encodeURIComponent(query)}`;
    if (sort && sort !== 'newest') endpoint += `&sort=${encodeURIComponent(sort)}`;
    if (genre) endpoint += `&genre=${encodeURIComponent(genre)}`;
    if (status) endpoint += `&status=${encodeURIComponent(status)}`;
    if (type) endpoint += `&type=${encodeURIComponent(type)}`;

    const result = await fetchJsonWithTimeout(endpoint);
    const mangaList = Array.isArray(result) ? result : (result.data || result.results || []);

    const pagination = result?.pagination || {
      page,
      limit: currentLimit,
      total: mangaList.length,
      totalPages: 1,
      hasPrevious: page > 1,
      hasNext: false,
    };

    grid.innerHTML = '';
    renderPagination(pagination);

    if (mangaList.length === 0) {
      const emptyMessage = query
        ? `Tidak ada manga yang ditemukan untuk "${query}".`
        : genre
          ? `Tidak ada manga untuk genre ini.`
          : 'Manga tidak ditemukan.';

      const btnLabel = query ? 'LIHAT SEMUA MANGA' : page > 1 ? `${ic('arrow-left')} KEMBALI KE HALAMAN SEBELUMNYA` : null;
      const btnAction = query
        ? () => { window.location.href = '/manga/html/catalog.html?page=1'; }
        : page > 1
          ? () => goToPage(page - 1)
          : null;

      showEmpty(grid, emptyMessage, btnLabel, btnAction);
      renderPagination({ page, totalPages: 1, hasPrevious: page > 1, hasNext: false });
      return;
    }

    if (sectionTitle) {
      if (query) {
        sectionTitle.textContent = `Search Results — "${query}"`;
      } else if (genre) {
        sectionTitle.textContent = `Genre: ${genre} — Page ${page}`;
      } else {
        sectionTitle.textContent = `All Series — Page ${page}`;
      }
    }

    mangaList.forEach(manga => {
      grid.appendChild(renderMangaCard(manga));
    });

  } catch (error) {
    console.error('Fetch Error:', error);
    showError(grid, formatFetchError(error, 'Gagal mengambil data manga.'), () => loadManga(query, page, sort, genre, status, type));
  }
}

function buildListParams(page) {
  const params = new URLSearchParams();
  params.set('page', String(page));
  if (currentQuery) params.set('query', currentQuery);
  if (currentSort && currentSort !== 'newest') params.set('sort', currentSort);
  if (currentGenre) params.set('genre', currentGenre);
  if (currentStatus) params.set('status', currentStatus);
  if (currentType) params.set('type', currentType);
  return params;
}

function goToPage(page) {
  if (page < 1) return;
  currentPage = page;
  currentGenre = readSelectValue(genreSelect);
  currentStatus = statusSelect ? statusSelect.value : '';
  currentType = typeSelect ? typeSelect.value : '';
  currentSort = sortSelect ? sortSelect.value : 'newest';
  
  const params = buildListParams(page);
  window.location.href = `/manga/html/catalog.html?${params.toString()}`;
}

function renderPagination(pagination) {
  renderPaginationControls({
    ...pagination,
    onPageChange: (newPage) => goToPage(newPage),
    pageNumbersEl: document.getElementById('pageNumbers'),
    prevBtnEl: document.getElementById('prevBtn'),
    nextBtnEl: document.getElementById('nextBtn'),
  });
}

document.addEventListener('DOMContentLoaded', () => {
  const searchForm = document.getElementById('searchForm');
  const searchInput = document.getElementById('searchInput');
  const prevBtn = document.getElementById('prevBtn');
  const nextBtn = document.getElementById('nextBtn');
  const backToTopBtn = document.getElementById('backToTop');
  const sortSelect = document.getElementById('sortSelect');

  // Initialize filter selects (show them so users can filter)
  showFilters();
  initFiltersFromURL();

  if (searchInput && currentQuery) searchInput.value = currentQuery;
  if (sortSelect) sortSelect.value = currentSort;

  if (prevBtn) {
    prevBtn.disabled = currentPage <= 1;
    prevBtn.addEventListener('click', () => {
      if (currentPage > 1) goToPage(currentPage - 1);
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      if (!nextBtn.disabled) goToPage(currentPage + 1);
    });
  }

  if (searchForm) {
    searchForm.addEventListener('submit', (e) => {
      e.preventDefault();
      currentQuery = searchInput ? searchInput.value.trim() : '';
      const params = buildListParams(1);
      window.location.href = `/manga/html/catalog.html?${params.toString()}`;
    });
  }

  setupFilterListeners();

  // CATATAN: listener change untuk statusSelect/typeSelect cukup satu kali —
  // sudah dipasang setupFilterListeners() di atas (dulu terpasang dobel di
  // sini, membuat goToPage(1) terpanggil dua kali per ganti filter).

  setupBackToTop(backToTopBtn, 300);

  loadGenres();
  loadManga(currentQuery, currentPage, currentSort, currentGenre, currentStatus, currentType);

  // Perbaiki cover yang hilang saat kembali dari reader via browser back button (bfcache).
  // Saat halaman di-restore dari bfcache, gambar dengan loading="lazy" yang belum masuk
  // viewport tidak diload ulang oleh browser. Solusi: paksa re-trigger src pada gambar
  // yang gagal atau belum selesai dimuat.
  window.addEventListener('pageshow', (event) => {
    if (!event.persisted) return; // hanya jalankan kalau restore dari bfcache
    const grid = document.getElementById('mangaGrid');
    if (!grid) return;
    grid.querySelectorAll('img').forEach((img) => {
      // Gambar dianggap gagal jika belum complete atau naturalWidth = 0 (blank/error)
      if (!img.complete || img.naturalWidth === 0) {
        const currentSrc = img.src;
        img.src = '';
        img.src = currentSrc;
      }
    });
  });
});
