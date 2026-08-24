// shared/storage.js — localStorage abstraction for bookmarks, favorites, history

function getBookmarks() {
  return JSON.parse(localStorage.getItem('bookmarks')) || {};
}

function toggleBookmark(manga) {
  const bookmarks = getBookmarks();
  if (bookmarks[manga.slug]) {
    delete bookmarks[manga.slug];
    localStorage.setItem('bookmarks', JSON.stringify(bookmarks));
    return false;
  }
  bookmarks[manga.slug] = {
    title: manga.title,
    slug: manga.slug,
    thumb: manga.thumb,
    rating: manga.rating,
    type: manga.type || '',
    savedAt: new Date().toISOString(),
  };
  localStorage.setItem('bookmarks', JSON.stringify(bookmarks));
  return true;
}

function getFavorites() {
  return JSON.parse(localStorage.getItem('favorites')) || {};
}

function toggleFavorite(manga) {
  const favorites = getFavorites();
  if (favorites[manga.slug]) {
    delete favorites[manga.slug];
    localStorage.setItem('favorites', JSON.stringify(favorites));
    return false;
  }
  favorites[manga.slug] = {
    title: manga.title,
    slug: manga.slug,
    thumb: manga.thumb,
    rating: manga.rating,
    type: manga.type || '',
    savedAt: new Date().toISOString(),
  };
  localStorage.setItem('favorites', JSON.stringify(favorites));
  return true;
}

function getReadingHistory() {
  return JSON.parse(localStorage.getItem('history')) || [];
}

function getLastReadChapter(slug) {
  const history = getReadingHistory();
  return history.find((item) => item.slug === slug);
}

function saveReadingHistory(data) {
  let history = getReadingHistory();
  const index = history.findIndex((item) => item.slug === data.slug);
  if (index !== -1) history.splice(index, 1);
  // type disertakan bila tersedia — dipakai untuk stempel bendera di kartu riwayat
  const entry = { ...data, type: data.type || '' };
  history.unshift(entry);
  history = history.slice(0, 10);
  localStorage.setItem('history', JSON.stringify(history));
}

function saveReadingPosition(data) {
  localStorage.setItem(
    'readingPosition',
    JSON.stringify({
      slug: data.slug,
      chapterId: data.chapterId,
      page: data.page,
      updatedAt: new Date().toISOString(),
    })
  );
}

/**
 * Daftar chapter yang pernah dibuka untuk satu manga (per-slug).
 * Dipakai reader drawer untuk menandai chapter "sudah dibaca".
 * @param {string} slug
 * @returns {string[]}
 */
function getReadChapters(slug) {
  if (!slug) return [];
  try {
    return JSON.parse(localStorage.getItem('readChapters:' + slug)) || [];
  } catch {
    return [];
  }
}

/**
 * Tandai sebuah chapter sebagai pernah dibaca (unik, cap 300 terbaru agar
 * localStorage tidak membengkak). Dipanggil saat chapter dibuka.
 * @param {string} slug
 * @param {string|number} chapterId
 */
function markChapterRead(slug, chapterId) {
  if (!slug || !chapterId) return;
  const idStr = String(chapterId);
  const list = getReadChapters(slug);
  if (list.some((id) => String(id) === idStr)) return;
  list.push(idStr);
  localStorage.setItem(
    'readChapters:' + slug,
    JSON.stringify(list.slice(-300))
  );
}

/**
 * Ambil nomor halaman yang tersimpan untuk satu chapter (logic murni).
 * @param {string} slug - Slug manga
 * @param {string} chapterId - ID chapter
 * @param {number|null} [targetPageOverride] - Override target page bila sudah diketahui
 * @returns {number|null} Nomor halaman (1-based) atau null bila tidak ada/tidak cocok
 */
function getSavedPage(slug, chapterId, targetPageOverride = null) {
  if (targetPageOverride && Number.isFinite(targetPageOverride)) {
    return targetPageOverride;
  }
  try {
    const saved = JSON.parse(localStorage.getItem('readingPosition'));
    if (!saved || saved.slug !== slug || saved.chapterId !== chapterId) return null;
    return Number.isFinite(saved.page) && saved.page >= 1 ? saved.page : null;
  } catch {
    return null;
  }
}

// ─── Server-side reading position ─────────────────────────────────────────────

/**
 * Ambil atau buat device ID yang persisten di localStorage.
 */
function getDeviceId() {
  let id = localStorage.getItem('deviceId');
  if (!id) {
    // crypto.randomUUID: entropi penuh (Math.random bisa ditebak → progress
    // device lain bisa dibaca/ditulis orang yang menebak ID).
    id = 'dev_' + (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36));
    localStorage.setItem('deviceId', id);
  }
  return id;
}

/**
 * Simpan posisi baca ke server (fire-and-forget, tidak block UI).
 * @param {{ slug: string, chapterId: string, page: number, chapterNum?: string|number }} data
 */
async function saveProgressToServer(data) {
  try {
    await fetch('/api/progress', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-device-id': getDeviceId(),
      },
      body: JSON.stringify({
        mangaSlug: data.slug,
        chapterId: data.chapterId,
        page: data.page || 1,
        chapterNum: data.chapterNum != null ? String(data.chapterNum) : null,
        mangaTitle: data.mangaTitle || null,
        coverUrl: data.coverUrl || null,
        mangaType: data.mangaType || null,
      }),
    });
  } catch {
    // silently fail — localStorage masih jadi fallback
  }
}

/**
 * Ambil posisi baca dari server untuk satu manga.
 * @param {string} mangaSlug
 * @returns {Promise<{chapter_id: string, page: number, chapter_num: string|null}|null>}
 */
async function fetchProgressFromServer(mangaSlug) {
  try {
    const res = await fetch(
      `/api/progress?slug=${encodeURIComponent(mangaSlug)}`,
      { headers: { 'x-device-id': getDeviceId() } }
    );
    if (!res.ok) return null;
    const json = await res.json();
    return json?.data || null;
  } catch {
    return null;
  }
}

