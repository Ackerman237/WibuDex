// shared/api.js — API fetch utilities

const REQUEST_TIMEOUT_MS = 12000;

async function fetchJsonWithTimeout(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchMangaDetail(slug) {
  const result = await fetchJsonWithTimeout(
    `/api/manga/detail?slug=${encodeURIComponent(slug)}`
  );
  if (!result.success) throw new Error(result.message || 'Gagal memuat detail manga.');
  return result.data;
}

async function fetchChapter(chapterId) {
  const result = await fetchJsonWithTimeout(
    `/api/chapter?id=${encodeURIComponent(chapterId)}`
  );
  if (!result.success) throw new Error(result.message || 'Gagal memuat chapter.');
  return result.data;
}
