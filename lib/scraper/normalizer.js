import { safeImageUrl } from '../security.js';

const API_BASE = 'https://doujin.desu.xxx';

function resolveUrl(raw) {
  if (!raw || typeof raw !== 'string') return '';
  const trimmed = raw.trim();
  if (trimmed.startsWith('/')) return `${API_BASE}${trimmed}`;
  return trimmed;
}

export function mapListItem(item) {
  return {
    title: typeof item?.title === 'string' ? item.title : '',
    slug: typeof item?.slug === 'string' ? item.slug : '',
    thumb: safeImageUrl(resolveUrl(item?.cover_url)) || '',
    rating: item?.rating ?? null,
    type: typeof item?.type === 'string' ? item.type : '',
    chapters: Array.isArray(item?.chapters)
      ? item.chapters.map((ch) => ({
          id: ch?.id,
          chapter_id: ch?.chapter_id,
          title: ch?.title || '',
          number: ch?.chapter_number ?? ch?.chapter ?? null,
          chapter: ch?.chapter_number ?? ch?.chapter ?? '',
          date: ch?.created_at ? new Date(ch.created_at).toLocaleDateString('id-ID') : '',
        }))
      : [],
  };
}

export function mapDetail(detail) {
  const altTitlesRaw =
    Array.isArray(detail?.alt_titles) ? detail.alt_titles
      : Array.isArray(detail?.altTitles) ? detail.altTitles
      : typeof detail?.alt_titles === 'string' ? detail.alt_titles.split(/[,\n|]+/)
      : typeof detail?.altTitles === 'string' ? detail.altTitles.split(/[,\n|]+/)
      : [];

  const genres = (Array.isArray(detail?.manga_genres) ? detail.manga_genres : [])
    .map((g) =>
      typeof g?.genres?.name === 'string'
        ? g.genres.name
        : typeof g?.name === 'string'
          ? g.name
          : ''
    )
    .filter(Boolean);

  const synopsis =
    detail?.description ||
    detail?.synopsis ||
    detail?.summary ||
    detail?.content ||
    detail?.body ||
    '';

  return {
    title: typeof detail?.title === 'string' ? detail.title : '',
    altTitles: altTitlesRaw.map((t) => (typeof t === 'string' ? t.trim() : '')).filter(Boolean),
    thumb:
      safeImageUrl(resolveUrl(detail?.cover_url)) ||
      safeImageUrl(resolveUrl(detail?.cover)) ||
      safeImageUrl(resolveUrl(detail?.thumbnail)) ||
      '',
    rating: detail?.rating ?? null,
    synopsis: typeof synopsis === 'string' ? synopsis : '',
    status: typeof detail?.status === 'string' ? detail.status : typeof detail?.state === 'string' ? detail.state : '',
    type: typeof detail?.type === 'string' ? detail.type : '',
    typeFlag: typeof detail?.type_flag === 'string' ? detail.type_flag : typeof detail?.typeFlag === 'string' ? detail.typeFlag : '',
    author:
      typeof detail?.author === 'string'
        ? detail.author
        : typeof detail?.authors === 'string'
          ? detail.authors
          : typeof detail?.author?.name === 'string'
            ? detail.author.name
            : typeof detail?.authors?.name === 'string'
              ? detail.authors.name
              : '',
    groups: typeof detail?.groups === 'string' ? detail.groups : '',
    series: typeof detail?.series === 'string' ? detail.series : '',
    serialization:
      typeof detail?.serialization === 'string'
        ? detail.serialization
        : typeof detail?.published_in === 'string'
          ? detail.published_in
          : '',
    characters: typeof detail?.characters === 'string' ? detail.characters : '',
    views: Number.isFinite(detail?.views) ? detail.views : Number.isFinite(detail?.view_count) ? detail.view_count : 0,
    genres,
    chapters: Array.isArray(detail?.chapters)
      ? detail.chapters.map((ch) => ({
          id: ch?.id,
          chapter_id: ch?.chapter_id,
          title: ch?.title || '',
          number: ch?.chapter_number ?? ch?.chapter ?? null,
          chapter: ch?.chapter_number ?? ch?.chapter ?? '',
          date: ch?.created_at ? new Date(ch.created_at).toLocaleDateString('id-ID') : '',
          views: Number.isFinite(ch?.views) ? ch.views : 0,
        }))
      : [],
    mangaSlug: typeof detail?.slug === 'string' ? detail.slug : '',
  };
}
