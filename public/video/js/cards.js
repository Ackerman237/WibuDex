// video/js/cards.js — SATU sumber markup kartu video untuk semua konteks streaming.
// Mendukung rasio 16:9 Widescreen (Episode/Watch/Grid) dan 2:3 Poster (Series).

const PLACEHOLDER_THUMB = 'data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%27320%27 height=%27180%27 viewBox=%270 0 320 180%27%3E%3Crect width=%27100%25%27 height=%27100%25%27 fill=%27%23181615%27/%3E%3Cpath d=%27M145 75 L185 90 L145 105 Z%27 fill=%27%235E5854%27/%3E%3C/svg%3E';

const MEDIA_CARD_VARIANTS = {
  grid: {
    card: 'video-card',
    thumb: 'video-thumb',
    thumbWrap: 'video-thumb-wrap',
    body: 'video-info',
    title: 'video-title',
    titleTag: 'h3',
    meta: 'video-date',
    aspect: '16-9',
    order: ['title', 'meta'],
    fallbackThumb: PLACEHOLDER_THUMB,
  },
  series: {
    card: 'series-card',
    thumb: 'series-thumb',
    thumbWrap: 'series-thumb-wrap',
    body: 'series-info',
    title: 'series-title',
    titleTag: 'h3',
    meta: 'series-meta',
    aspect: '2-3',
    order: ['title', 'meta'],
    fallbackThumb: PLACEHOLDER_THUMB,
  },
  episode: {
    card: 'episode-card',
    thumb: 'episode-thumb',
    thumbWrap: 'episode-thumb-wrap',
    body: 'episode-info',
    meta: 'episode-number',
    title: 'episode-title',
    titleTag: 'div',
    metaPrefix: 'Ep.',
    aspect: '16-9',
    order: ['meta', 'title'],
    fallbackThumb: PLACEHOLDER_THUMB,
  },
  episodeMobile: {
    card: 'episode-card-mobile',
    thumb: 'episode-thumb-mobile',
    thumbWrap: 'episode-thumb-wrap',
    meta: 'episode-number-mobile',
    title: 'episode-title-mobile',
    titleTag: 'div',
    metaPrefix: 'Ep.',
    aspect: '16-9',
    order: ['meta', 'title'],
    fallbackThumb: PLACEHOLDER_THUMB,
  },
  related: {
    card: 'related-card',
    thumb: 'related-thumb',
    thumbWrap: 'related-thumb-wrap',
    body: 'related-info',
    title: 'related-name',
    titleTag: 'div',
    typeClass: 'related-type',
    aspect: '16-9',
    order: ['title', 'type'],
    fallbackThumb: PLACEHOLDER_THUMB,
  },
  relatedMobile: {
    card: 'related-card-mobile',
    thumb: 'related-thumb-mobile',
    thumbWrap: 'related-thumb-wrap',
    title: 'related-name-mobile',
    titleTag: 'div',
    aspect: '16-9',
    order: ['title'],
    fallbackThumb: PLACEHOLDER_THUMB,
  },
};

/**
 * Baca progress tontonan dari localStorage (0 - 100%)
 */
function getSavedProgress(slug) {
  if (!slug) return 0;
  try {
    const raw = localStorage.getItem(`video_progress_${slug}`);
    if (raw) {
      const data = JSON.parse(raw);
      if (data && data.percentage) return Math.min(100, Math.max(0, data.percentage));
    }
  } catch {
    // Abaikan jika localStorage diblokir
  }
  return 0;
}

/**
 * Bangun satu kartu video (elemen <a>) siap append.
 * @param {object} item                - { slug, title, thumb, date?, number?, type?, duration? }
 * @param {object} [opts]
 * @param {string} [opts.variant='grid']  - kunci MEDIA_CARD_VARIANTS
 * @param {boolean} [opts.isActive=false] - tandai episode yang sedang dibuka
 * @param {string} [opts.meta]            - teks meta eksplisit (menimpa number/date)
 * @param {string} [opts.href]            - link custom (misal ke episodes.html untuk series)
 * @returns {HTMLAnchorElement}
 */
function renderMediaCard(item, opts = {}) {
  const v = MEDIA_CARD_VARIANTS[opts.variant || 'grid'] || MEDIA_CARD_VARIANTS.grid;
  const slug = item?.slug || '';
  const thumbUrl = item?.thumb || v.fallbackThumb;
  const title = escapeHtml(item?.title || 'Tanpa Judul');
  const targetHref = opts.href || `/video/html/watch.html?slug=${encodeURIComponent(slug)}`;

  // Meta opsional: nomor episode (dengan prefix), tanggal, atau teks eksplisit
  let metaHtml = '';
  const metaValue = opts.meta ?? item?.number ?? item?.date;
  if (v.meta && metaValue !== undefined && metaValue !== null && metaValue !== '') {
    const prefix = v.metaPrefix ? `${escapeHtml(v.metaPrefix)} ` : '';
    metaHtml = `<div class="${v.meta}">${prefix}${escapeHtml(String(metaValue))}</div>`;
  }

  // Type hanya untuk varian yang punya slotnya
  const typeHtml =
    v.typeClass && item?.type
      ? `<div class="${v.typeClass}">${escapeHtml(String(item.type))}</div>`
      : '';

  const parts = { meta: metaHtml, title: '', type: typeHtml };
  if (v.title && v.order.includes('title')) {
    parts.title = `<${v.titleTag} class="${v.title}">${title}</${v.titleTag}>`;
  }

  const inner = v.body
    ? `<div class="${v.body}">${v.order.map((k) => parts[k]).join('')}</div>`
    : v.order.map((k) => parts[k]).join('');

  // Progress tontonan jika ada
  const progress = getSavedProgress(slug);
  const progressBarHtml = progress > 5
    ? `<div class="card-progress-bar" style="--progress-width: ${progress}%"><span class="card-progress-fill"></span></div>`
    : '';

  // Badge durasi / HD / Episode overlay di thumbnail
  const badgeText = item?.duration || (item?.number ? `Ep. ${escapeHtml(String(item.number))}` : '');
  const badgeHtml = badgeText ? `<span class="card-badge-overlay">${escapeHtml(badgeText)}</span>` : '';

  const card = document.createElement('a');
  card.className = `${v.card} ${v.aspect ? `card-${v.aspect}` : ''}` + (opts.isActive ? ' is-active' : '');
  card.href = targetHref;
  card.innerHTML = `
    <div class="${v.thumbWrap || 'card-thumb-wrap'}">
      <img class="${v.thumb}" src="${escapeHtml(thumbUrl)}" alt="${title}" loading="lazy" referrerpolicy="no-referrer" onerror="this.src='${PLACEHOLDER_THUMB}'">
      <div class="card-play-overlay" aria-hidden="true">
        <svg class="ic play-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
      </div>
      ${badgeHtml}
      ${progressBarHtml}
    </div>
    ${inner}
  `;

  return card;
}
