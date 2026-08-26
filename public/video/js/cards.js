// video/js/cards.js — SATU sumber markup kartu video untuk semua konteks.
//
// Sebelumnya ada 4+ blok innerHTML serupa di index.js / series.js / watch.js
// (grid, sidebar episode, episode mobile, related sidebar/mobile) dengan
// escaping & fallback thumb yang tidak seragam (series.js bahkan lupa
// meng-escape src thumbnail). Helper ini menjadi satu-satunya tempat:
//   - escapeHtml dari /shared/utils.js
//   - fallback thumb placeholder
//   - navigasi ke watch.html?slug=
// Sementara KELAS CSS & URUTAN anak mengikuti konteks masing-masing (peta
// MEDIA_CARD_VARIANTS) agar seluruh styling existing — hover spotlight,
// is-active, focus-visible — tidak berubah sedikit pun.
//
// Field opsional masa depan (durasi/views/genre — lihat roadmap Bagian 2)
// tinggal ditambah di sini, semua konteks langsung ikut.

const PLACEHOLDER_THUMB = 'data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%27100%27 height=%27140%27%3E%3Crect width=%27100%25%27 height=%27100%25%27 fill=%27%23222%27/%3E%3C/svg%3E';
const MEDIA_CARD_VARIANTS = {
  grid: {
    card: 'video-card',
    thumb: 'video-thumb',
    body: 'video-info',
    title: 'video-title',
    titleTag: 'h3',
    meta: 'video-date',
    order: ['meta', 'title'],
    fallbackThumb: PLACEHOLDER_THUMB,
  },
  episode: {
    card: 'episode-card',
    thumb: 'episode-thumb',
    body: 'episode-info',
    meta: 'episode-number',
    title: 'episode-title',
    titleTag: 'div',
    metaPrefix: 'Ep.',
    order: ['meta', 'title'],
    fallbackThumb: PLACEHOLDER_THUMB,
  },
  episodeMobile: {
    card: 'episode-card-mobile',
    thumb: 'episode-thumb-mobile',
    meta: 'episode-number-mobile',
    title: 'episode-title-mobile',
    titleTag: 'div',
    metaPrefix: 'Ep.',
    order: ['meta', 'title'],
    fallbackThumb: PLACEHOLDER_THUMB,
  },
  related: {
    card: 'related-card',
    thumb: 'related-thumb',
    body: 'related-info',
    title: 'related-name',
    titleTag: 'div',
    typeClass: 'related-type',
    order: ['title', 'type'],
    fallbackThumb: PLACEHOLDER_THUMB,
  },
  relatedMobile: {
    card: 'related-card-mobile',
    thumb: 'related-thumb-mobile',
    title: 'related-name-mobile',
    titleTag: 'div',
    order: ['title'],
    fallbackThumb: PLACEHOLDER_THUMB,
  },
};

/**
 * Bangun satu kartu video (elemen <a>) siap append.
 * @param {object} item                - { slug, title, thumb, date?, number?, type? }
 * @param {object} [opts]
 * @param {string} [opts.variant='grid']  - kunci MEDIA_CARD_VARIANTS
 * @param {boolean} [opts.isActive=false] - tandai episode yang sedang dibuka
 * @param {string} [opts.meta]            - teks meta eksplisit (menimpa number/date)
 * @returns {HTMLAnchorElement}
 */
function renderMediaCard(item, opts = {}) {
  const v = MEDIA_CARD_VARIANTS[opts.variant || 'grid'] || MEDIA_CARD_VARIANTS.grid;
  const slug = item?.slug || '';
  const thumbUrl = item?.thumb || v.fallbackThumb;
  const title = escapeHtml(item?.title || 'Tanpa Judul');

  // Meta opsional: nomor episode (dengan prefix), tanggal, atau teks eksplisit
  let metaHtml = '';
  const metaValue = opts.meta ?? item?.number ?? item?.date;
  if (v.meta && metaValue !== undefined && metaValue !== null && metaValue !== '') {
    const prefix = v.metaPrefix ? `${escapeHtml(v.metaPrefix)} ` : '';
    metaHtml = `<div class="${v.meta}">${prefix}${escapeHtml(String(metaValue))}</div>`;
  }

  // Type hanya untuk varian yang punya slotnya (related desktop)
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

  const card = document.createElement('a');
  card.className = v.card + (opts.isActive ? ' is-active' : '');
  card.href = `/video/html/watch.html?slug=${encodeURIComponent(slug)}`;
  card.innerHTML = `
    <img class="${v.thumb}" src="${escapeHtml(thumbUrl)}" alt="${title}" loading="lazy" referrerpolicy="no-referrer" style="view-transition-name: cover-${slug}">
    ${inner}
  `;

  return card;
}
