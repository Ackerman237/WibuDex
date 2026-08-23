// shared/ui.js — UI helper functions

function el(id) {
  return document.getElementById(id);
}

/**
 * Escape karakter HTML berbahaya sebelum interpolasi ke innerHTML.
 * Global (bukan module): tersedia untuk semua page script yang
 * meng-include ui.js. WAJIB dipakai untuk teks dari sumber eksternal
 * (judul/thumbnail hasil scrape) maupun localStorage.
 */
function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function setupBackToTop(btn, threshold) {
  threshold = threshold || 300;
  if (!btn) return;
  const sync = () => btn.classList.toggle('show', window.scrollY > threshold);
  window.addEventListener('scroll', sync, { passive: true });
  btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  sync();
}

function formatFetchError(error, fallbackMessage) {
  fallbackMessage = fallbackMessage || 'Gagal mengambil data.';
  if (error?.name === 'AbortError') return 'Request terlalu lama. Coba lagi sebentar.';
  if (error?.message === 'HTTP 500') return 'Server sedang bermasalah. Coba beberapa saat lagi.';
  if (error?.message === 'HTTP 404') return 'Data tidak ditemukan.';
  if (error?.message === 'HTTP 429') return 'Terlalu banyak request. Tunggu sebentar.';
  // Pesan error dari upstream yang diteruskan server (bukan kode HTTP langsung)
  if (/server|bermasalah|kesalahan|upstream|timeout|tidak tersedia/i.test(error?.message || '')) {
    return 'Server sedang bermasalah. Coba beberapa saat lagi.';
  }
  return fallbackMessage;
}

/**
 * Render loading state ke dalam container element.
 * @param {HTMLElement} container
 * @param {string} [message]
 */
function showLoading(container, message) {
  if (!container) return;
  message = message || 'Memuat...';
  container.innerHTML = `<p class="loading">${message}</p>`;
}

/**
 * Render error state ke dalam container element, dengan optional retry button.
 * @param {HTMLElement} container
 * @param {string} message
 * @param {Function} [onRetry]
 */
function showError(container, message, onRetry) {
  if (!container) return;
  container.innerHTML = `
    <div class="state-box">
      <p class="error">${message}</p>
      ${onRetry ? '<button type="button" class="retry-btn">COBA LAGI</button>' : ''}
    </div>
  `;
  if (onRetry) {
    const btn = container.querySelector('.retry-btn');
    if (btn) btn.addEventListener('click', onRetry);
  }
}

/**
 * Render empty state ke dalam container element.
 * @param {HTMLElement} container
 * @param {string} message
 * @param {string} [btnLabel]
 * @param {Function} [onAction]
 */
function showEmpty(container, message, btnLabel, onAction) {
  if (!container) return;
  container.innerHTML = `
    <div class="state-box empty-state">
      <p>${message}</p>
      ${(btnLabel && onAction) ? `<button type="button" class="retry-btn">${btnLabel}</button>` : ''}
    </div>
  `;
  if (btnLabel && onAction) {
    const btn = container.querySelector('.retry-btn');
    if (btn) btn.addEventListener('click', onAction);
  }
}

function renderPaginationControls({ page, totalPages, hasPrevious, hasNext, onPageChange }) {
  const pageNumbers = document.getElementById('pageNumbers');
  const prevBtn = document.getElementById('prevBtn');
  const nextBtn = document.getElementById('nextBtn');

  if (prevBtn) prevBtn.disabled = !hasPrevious;
  if (nextBtn) nextBtn.disabled = !hasNext;
  if (!pageNumbers) return;

  pageNumbers.innerHTML = '';

  if (!Number.isFinite(totalPages) || totalPages < 1) totalPages = 1;

  const pages = new Set();
  pages.add(1);
  pages.add(totalPages);
  for (let number = page - 2; number <= page + 2; number++) {
    if (number >= 1 && number <= totalPages) pages.add(number);
  }

  const sortedPages = [...pages].sort((a, b) => a - b);
  let previousNumber = null;

  sortedPages.forEach(number => {
    if (previousNumber !== null && number - previousNumber > 1) {
      const ellipsis = document.createElement('span');
      ellipsis.className = 'page-ellipsis';
      ellipsis.textContent = '...';
      pageNumbers.appendChild(ellipsis);
    }

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'page-number';
    button.textContent = String(number);

    if (number === page) {
      button.classList.add('active');
      button.setAttribute('aria-current', 'page');
      button.disabled = true;
    } else if (onPageChange) {
      button.addEventListener('click', () => onPageChange(number));
    }

    pageNumbers.appendChild(button);
    previousNumber = number;
  });
}

/** Markup ikon SVG dari sprite bersama (lihat doujinPage/icons.svg). */
function ic(name) {
  return `<svg class="ic" aria-hidden="true"><use href="/doujinPage/icons.svg#i-${name}"></use></svg>`;
}

/**
 * Kode bendera negara untuk tipe manga — dipakai sebagai stempel bundar
 * di kartu (aset: /icons/flags/<kode>.svg). Kosong jika tipe tak dikenal.
 */
function getMangaFlag(type) {
  const t = (type || '').toLowerCase();
  if (t === 'manga') return 'jp';
  if (t === 'manhwa') return 'kr';
  if (t === 'manhua') return 'cn';
  if (t === 'doujinshi') return 'jp';
  return '';
}

function renderMangaCard(manga) {
  const card = document.createElement('div');
  card.className = 'manga-card';

  const mangaSlug = manga.slug || manga.endpoint || '';
  const flag = getMangaFlag(manga.type);
  if (flag) card.dataset.flag = flag;

  // Proxy cover lewat server: ?w=300 → server resize+optimasi via sharp (hemat bandwidth)
  const rawThumb = manga.thumb || manga.cover || '';
  const thumbSrc = rawThumb
    ? `/api/image-proxy?url=${encodeURIComponent(rawThumb)}&w=300`
    : 'https://placehold.co/110x140?text=No+Cover';

  let chaptersHTML = '';
  if (Array.isArray(manga.chapters) && manga.chapters.length > 0) {
    manga.chapters.slice(0, 2).forEach((ch) => {
      const chId = ch.id || ch.chapter_id || '';
      if (!chId) return; // skip chapter tanpa ID valid
      const isNew = ch.isNew ? '<span class="badge-new">NEW</span>' : '';
      const chTitle = escapeHtml(ch.title || 'Chapter ' + ch.chapter);
      chaptersHTML += `
        <a href="/doujinPage/html/reader.html?id=${encodeURIComponent(chId)}" class="chapter-btn" onclick="event.stopPropagation();">
          <span>${chTitle} ${isNew}</span>
          <span class="time-ago">${escapeHtml(ch.date || ch.releaseTime || '')}</span>
        </a>
      `;
    });
  }

  card.innerHTML = `
    <div class="thumb-container" data-slug="${mangaSlug}">
      <img src="${thumbSrc}" alt="${escapeHtml(manga.title || '')}" loading="lazy">
      <span class="rating-tag">${ic('star')} ${escapeHtml(manga.rating ?? '-')}</span>
    </div>
    <div class="manga-info">
      <h3 class="manga-title" data-slug="${mangaSlug}">${escapeHtml(manga.title || '')}</h3>
      <div class="chapter-list">${chaptersHTML}</div>
    </div>
  `;

  // Guard: hanya pasang click handler kalau slug valid
  if (mangaSlug) {
    card.querySelectorAll('[data-slug]').forEach((el) => {
      el.addEventListener('click', () => {
        window.location.href = `/doujinPage/html/detail.html?slug=${encodeURIComponent(mangaSlug)}`;
      });
    });
  }

  return card;
}
