// detail.js — Manga detail page

let currentChapters = [];
let chapterOrder = 'desc';
let chapterSearchQuery = '';
let currentManga = null;
let globalTitleText = 'Tanpa Judul';

let currentMangaSlug = '';
let currentGenresArr = [];
let currentStatus = ''; // 'ongoing' | 'completed' | 'hiatus' (lowercase)
let recommendationsLoaded = false;
let recommendationsExpanded = false;

function renderChapterList() {
  const list = el("chapterList");
  const countEl = el("chapterCount");
  if (!list) return;

  list.innerHTML = "";

  let filtered = currentChapters.filter(ch => {
    const chNum = String(ch.number || ch.chapter || '');
    const chTitle = String(ch.title || '').toLowerCase();
    const query = chapterSearchQuery.toLowerCase();
    return chNum.includes(query) || chTitle.includes(query);
  });

  filtered.sort((a, b) => {
    const an = Number(a.number || a.chapter || 0);
    const bn = Number(b.number || b.chapter || 0);
    if (Number.isFinite(an) && Number.isFinite(bn) && an !== bn) {
      return chapterOrder === 'asc' ? an - bn : bn - an;
    }
    return 0;
  });

  if (countEl) countEl.textContent = filtered.length;

  if (filtered.length > 0) {
    filtered.forEach((ch, idx) => {
      const chId = ch.id || ch.chapter_id || ch.number || ch.chapter;
      if (!chId) return; // skip chapter tanpa ID valid
      const chNum = ch.number || ch.chapter || (idx + 1);
      const chTitle = ch.title || `${globalTitleText} Chapter ${chNum}`;
      const chDate = ch.date || ch.releaseTime || "-";
      const chViews = ch.views ? Number(ch.views).toLocaleString("id-ID") : "-";

      const row = document.createElement("a");
      row.href = `/manga/html/reader.html?id=${encodeURIComponent(chId)}`;
      // Stempel sadar-status (permintaan user 2026-08-24):
      //   completed → TAMAT hijau · hiatus → HIATUS merah · lainnya → BARU amber
      let variant = '';
      if (idx === 0 && chapterOrder === 'desc') {
        if (currentStatus === 'completed') variant = 'is-completed';
        else if (currentStatus === 'hiatus') variant = 'is-hiatus';
        else variant = 'is-latest';
      }
      row.className = 'chapter-row' + (variant ? ` ${variant}` : '');

      const numberDiv = document.createElement("div");
      numberDiv.className = "chapter-number";
      numberDiv.textContent = chNum;

      const bodyDiv = document.createElement("div");
      bodyDiv.className = "chapter-row-body";

      const title = document.createElement("h4");
      title.textContent = chTitle;

      const metaDiv = document.createElement("div");
      metaDiv.className = "chapter-row-meta";

      const dateSpan = document.createElement("span");
      dateSpan.className = "meta-item";
      dateSpan.innerHTML = `${ic('clock')} ${chDate}`;

      const viewsSpan = document.createElement("span");
      viewsSpan.className = "meta-item";
      viewsSpan.innerHTML = `${ic('eye')} ${chViews}`;

      metaDiv.appendChild(dateSpan);
      metaDiv.appendChild(viewsSpan);
      bodyDiv.appendChild(title);
      bodyDiv.appendChild(metaDiv);
      row.appendChild(numberDiv);
      row.appendChild(bodyDiv);
      list.appendChild(row);
    });
  } else {
    list.innerHTML = '<p class="error">Chapter tidak ditemukan.</p>';
  }
}

function starString(rating) {
  const score = parseFloat(rating) || 0;
  const full = Math.round(score / 2);
  return "★".repeat(Math.min(5, Math.max(0, full))) + "☆".repeat(Math.max(0, 5 - full));
}

/**
 * Tier warna rating (konvensi AniList/MAL): ≥8 hijau, 6–7.9 gold, <6 merah.
 * Diterapkan sebagai data-tier di .rating-row; CSS memetakan ke token semantik.
 */
function ratingTier(score) {
  if (!score) return 'none';
  if (score >= 8) return 'good';
  if (score >= 6) return 'mid';
  return 'low';
}

/**
 * Isi satu baris info detail; sembunyikan seluruh baris (label+nilai)
 * jika upstream tidak menyediakan datanya, agar panel tidak penuh "—".
 */
function setInfoValue(id, text) {
  const node = el(id);
  if (!node) return;
  const raw = typeof text === 'string' ? text.trim() : text;
  const hasValue = raw && raw !== "-" && raw !== "N/A";
  node.textContent = hasValue ? raw : "-";
  if (node.parentElement) node.parentElement.style.display = hasValue ? "" : "none";
}

async function renderDetail() {
  const params = new URLSearchParams(window.location.search);
  const slug = params.get("slug") || params.get("id");

  if (!slug) {
    if (el("detailLoading")) el("detailLoading").style.display = "none";
    if (el("detailError")) {
      el("detailError").textContent = "Slug/ID manga tidak ditemukan.";
      el("detailError").style.display = "block";
    }
    return;
  }

  try {
    const data = await fetchMangaDetail(slug);

    const coverUrl = data.cover || data.thumb || data.coverUrl || "https://placehold.co/420x560?text=No+Cover";
    const titleText = data.title || "Tanpa Judul";
    globalTitleText = titleText;
    const mangaSlug = data.slug || slug;
    const numRating = parseFloat(data.rating) || 0;

    currentManga = {
      title: titleText,
      slug: mangaSlug,
      thumb: coverUrl,
      rating: numRating,
      type: data.type || ""
    };

    const bookmarkBtn = el("bookmarkBtn");
    if (bookmarkBtn) {
      const bookmarks = getBookmarks();
      const isBookmarked = Boolean(bookmarks[mangaSlug]);
      setBookmarkLabel(bookmarkBtn, isBookmarked);
    }

    const favoriteBtn = el("favoriteBtn");
    if (favoriteBtn) {
      const favorites = getFavorites();
      const isFavorite = Boolean(favorites[mangaSlug]);
      favoriteBtn.classList.toggle("is-active", isFavorite);
    }

    const altTitlesArr = Array.isArray(data.altTitles)
      ? data.altTitles
      : typeof data.altTitles === 'string'
        ? data.altTitles.split(/[\,\n|]+/).map((s) => s.trim()).filter(Boolean)
        : [];
    const altShort = altTitlesArr.join(", ") || "-";
    const genresArr = Array.isArray(data.genres) ? data.genres : [];
    const authorText = data.authors || data.author || "-";
    const groupsText = data.groups || "-";
    const seriesText = data.series || data.title || "-";
    const serializationText = data.serialization || "-";
    const charactersText = data.characters || "-";
    const statusText = data.status || "Ongoing";
    currentStatus = String(statusText).trim().toLowerCase();
    const typeText = data.type || "Manga";
    // typeFlag upstream sering kosong → turunkan dari type; jika tetap tak dikenal, sembunyikan (jangan tampil "??")
    const typeFlagText = data.typeFlag || getMangaFlag(typeText) || "";

    currentChapters = Array.isArray(data.chapters) ? data.chapters : [];
    chapterOrder = 'desc';
    chapterSearchQuery = '';

    const chaptersAsc = [...currentChapters].sort((a, b) => {
      const an = Number(a.number || a.chapter || 0);
      const bn = Number(b.number || b.chapter || 0);
      if (Number.isFinite(an) && Number.isFinite(bn) && an !== bn) return an - bn;
      return 0;
    });

    if (el("coverFrame")) el("coverFrame").style.backgroundImage = `url('${coverUrl}')`;
    if (el("coverImg")) { el("coverImg").src = coverUrl; el("coverImg").alt = titleText; }

    if (el("mTitle")) el("mTitle").textContent = titleText;
    // Alt title kini HANYA di panel info (duplikasi di bawah judul dihapus)
    if (el("mTypeFlag")) {
      if (typeFlagText) {
        el("mTypeFlag").src = `/icons/flags/${typeFlagText}.svg`;
        el("mTypeFlag").style.display = "";
      } else {
        el("mTypeFlag").style.display = "none";
      }
    }
    if (el("mTypeText")) el("mTypeText").textContent = typeText;
    if (el("mStatusText")) el("mStatusText").textContent = statusText;

    if (el("infoTypeFlag")) {
      if (typeFlagText) {
        el("infoTypeFlag").src = `/icons/flags/${typeFlagText}.svg`;
        el("infoTypeFlag").style.display = "";
      } else {
        el("infoTypeFlag").style.display = "none";
      }
    }
    if (el("infoType")) el("infoType").textContent = typeText;
    if (el("infoStatus")) el("infoStatus").textContent = statusText;
    if (el("infoAltTitles")) el("infoAltTitles").textContent = altShort;
    setInfoValue("infoAuthors", authorText);
    setInfoValue("infoGroups", groupsText);
    setInfoValue("infoSeries", seriesText);
    setInfoValue("infoSerialization", serializationText);
    setInfoValue("infoCharacters", charactersText);

    const genreWrap = el("genreTags");
    if (genreWrap) {
      genreWrap.innerHTML = "";
      if (genresArr.length > 0) {
        genresArr.forEach((g) => {
          const span = document.createElement("span");
          span.className = "genre-tag";
          span.textContent = g;
          genreWrap.appendChild(span);
        });
      } else {
        genreWrap.innerHTML = '<span class="genre-tag">-</span>';
      }
    }

    if (el("ratingScore")) el("ratingScore").textContent = numRating ? numRating.toFixed(1) : "-";
    if (el("ratingStars")) el("ratingStars").textContent = starString(numRating);
    const ratingRow = el("ratingScore")?.closest(".rating-row");
    if (ratingRow) ratingRow.dataset.tier = ratingTier(numRating);
    if (el("viewsValue")) {
      el("viewsValue").textContent = data.views ? Number(data.views).toLocaleString("id-ID") : "-";
    }

    const synopsisContent = cleanSynopsis(data.synopsis || data.summary || data.description || '');
    const synopsisPanel = el("synopsisPanel");
    if (el("synopsisText")) {
      el("synopsisText").textContent = synopsisContent;
      el("synopsisText").classList.remove("expanded");
    }
    if (el("synopsisToggle")) el("synopsisToggle").style.display = synopsisContent ? "" : "none";
    if (synopsisPanel) synopsisPanel.style.display = synopsisContent ? "" : "none";

    renderChapterList();

    const readNowBtn = el("readNowBtn");
    if (readNowBtn) {
      const lastRead = getLastReadChapter(mangaSlug);
      if (lastRead) {
        readNowBtn.innerHTML = `${ic('play')} CONTINUE CHAPTER ${lastRead.chapter}`;
        readNowBtn.onclick = () => {
          window.location.href = `/manga/html/reader.html?id=${encodeURIComponent(lastRead.chapterId)}`;
        };
      } else if (chaptersAsc.length > 0) {
        const firstCh = chaptersAsc[0];
        const firstChId = firstCh.id || firstCh.chapter_id || firstCh.number || firstCh.chapter;
        readNowBtn.innerHTML = `${ic('play')} READ NOW`;
        readNowBtn.onclick = () => {
          window.location.href = `/manga/html/reader.html?id=${encodeURIComponent(firstChId)}`;
        };
      } else {
        readNowBtn.style.display = "none";
      }
    }

    if (el("detailLoading")) el("detailLoading").style.display = "none";
    if (el("detailLayout")) el("detailLayout").style.display = "grid";

    currentMangaSlug = mangaSlug;
    currentGenresArr = genresArr;
    recommendationsLoaded = false;
    recommendationsExpanded = false;
    showInfoTab();

  } catch (err) {
    console.error(err);
    if (el("detailLoading")) el("detailLoading").style.display = "none";
    if (el("detailError")) {
      const msg = err?.name === 'AbortError'
        ? "Request terlalu lama. Coba lagi sebentar."
        : err?.message === 'HTTP 404'
          ? "Manga tidak ditemukan."
          : "Gagal memuat detail manga.";
      el("detailError").textContent = msg;
      el("detailError").style.display = "block";

      // tambah retry button
      const retryBtn = document.createElement('button');
      retryBtn.type = 'button';
      retryBtn.className = 'retry-btn';
      retryBtn.textContent = 'COBA LAGI';
      retryBtn.style.display = 'block';
      retryBtn.style.margin = '16px auto 0';
      retryBtn.addEventListener('click', () => {
        el("detailError").style.display = "none";
        el("detailLoading").style.display = "block";
        retryBtn.remove();
        renderDetail();
      });
      el("detailError").after(retryBtn);
    }
  }
}

function showInfoTab() {
  const tabInfo = el("tabInfo");
  const tabMore = el("tabMoreSeries");
  const infoPanel = el("infoPanel");
  const synopsisPanel = el("synopsisPanel");
  const recommendSection = el("recommendSection");

  if (tabInfo) tabInfo.classList.add("active");
  if (tabMore) tabMore.classList.remove("active");

  if (infoPanel) infoPanel.style.display = "";
  if (synopsisPanel) {
    const p = el("synopsisText");
    const hasText = p && p.textContent && p.textContent.trim() !== "—";
    synopsisPanel.style.display = hasText ? "" : "none";
  }
  if (recommendSection) recommendSection.style.display = "none";
}

async function showMoreSeriesTab() {
  const tabInfo = el("tabInfo");
  const tabMore = el("tabMoreSeries");
  const infoPanel = el("infoPanel");
  const synopsisPanel = el("synopsisPanel");
  const recommendSection = el("recommendSection");

  if (tabMore) tabMore.classList.add("active");
  if (tabInfo) tabInfo.classList.remove("active");

  if (infoPanel) infoPanel.style.display = "none";
  if (synopsisPanel) synopsisPanel.style.display = "none";

  if (!recommendationsLoaded && currentMangaSlug) {
    await loadRecommendations(currentMangaSlug, currentGenresArr);
  }

  if (recommendSection) {
    recommendSection.style.display = "block";
    updateRecommendCollapse();
    recommendSection.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

async function loadRecommendations(currentSlug, genresArr) {
  const section = el("recommendSection");
  const grid = el("recommendGrid");
  if (!section || !grid) return;

  const firstGenre = Array.isArray(genresArr) && genresArr.length > 0 ? String(genresArr[0]).trim() : "";
  if (!firstGenre) return;

  try {
    const endpoint = `/api/manga?genre=${encodeURIComponent(firstGenre.toLowerCase().replace(/\s+/g, "-"))}&limit=12`;
    const result = await fetchJsonWithTimeout(endpoint);
    const mangaList = (Array.isArray(result) ? result : (result.data || result.results || []))
      .filter((m) => m && m.slug !== currentSlug)
      .slice(0, 10);

    if (mangaList.length === 0) return;

    grid.innerHTML = "";
    mangaList.forEach((m) => grid.appendChild(renderMangaCard(m)));
    recommendationsLoaded = true;
    recommendationsExpanded = false;
  } catch {
    // Rekomendasi bersifat best-effort
  }
}

function updateRecommendCollapse() {
  const grid = el("recommendGrid");
  const wrap = el("recommendMoreWrap");
  const text = el("recommendMoreText");
  const btn = el("recommendMoreBtn");
  if (!grid || !wrap) return;

  const cards = Array.from(grid.children);
  if (cards.length === 0) return;

  // HP/Tablet ≤700px: carousel horizontal murni
  if (window.innerWidth <= 700) {
    cards.forEach((c) => (c.style.display = ""));
    wrap.style.display = "none";
    return;
  }

  // Desktop: hitung kapasitas kolom 1 baris
  const firstCard = cards[0];
  const cardW = (firstCard ? firstCard.offsetWidth : 160) || 160;
  const gap = 16;
  const gridW = grid.clientWidth || 1160;
  const cols = Math.max(1, Math.floor((gridW + gap) / (cardW + gap)));

  if (cards.length <= cols) {
    cards.forEach((c) => (c.style.display = ""));
    wrap.style.display = "none";
    return;
  }

  // Jika item lebih dari 1 baris
  wrap.style.display = "flex";
  if (recommendationsExpanded) {
    cards.forEach((c) => (c.style.display = ""));
    if (btn) btn.classList.add("is-expanded");
    if (text) text.textContent = "Show Less";
  } else {
    cards.forEach((c, idx) => {
      c.style.display = idx < cols ? "" : "none";
    });
    if (btn) btn.classList.remove("is-expanded");
    if (text) text.textContent = "See More";
  }
}

/** Perbarui label tombol bookmark beserta ikonnya. */
function setBookmarkLabel(btn, active) {
  btn.innerHTML = `${ic(active ? 'bookmark-check' : 'bookmark')} <span class="btn-label">${active ? 'BOOKMARKED' : 'BOOKMARK'}</span>`;
}

document.addEventListener("DOMContentLoaded", () => {
  renderDetail();

  // Tombol kembali: referrer sama-origin → history.back() (kondisi scroll/
  // filter halaman asal terjaga); dibuka langsung dari luar → ke katalog.
  const backBtn = el("backBtn");
  if (backBtn) {
    backBtn.addEventListener("click", () => {
      if (document.referrer && document.referrer.startsWith(location.origin)) {
        history.back();
      } else {
        window.location.href = "/manga/html/catalog.html";
      }
    });
  }

  const bookmarkBtn = el("bookmarkBtn");
  if (bookmarkBtn) {
    bookmarkBtn.addEventListener("click", () => {
      if (!currentManga) return;
      const active = toggleBookmark(currentManga);
      setBookmarkLabel(bookmarkBtn, active);
    });
  }

  const favoriteBtn = el("favoriteBtn");
  if (favoriteBtn) {
    favoriteBtn.addEventListener("click", () => {
      if (!currentManga) return;
      const active = toggleFavorite(currentManga);
      favoriteBtn.classList.toggle("is-active", active);
    });
  }

  const chapterSearchInput = el("chapterSearch");
  if (chapterSearchInput) {
    chapterSearchInput.addEventListener("input", (e) => {
      chapterSearchQuery = e.target.value.trim();
      renderChapterList();
    });
  }

  const chapterSortBtn = el("chapterSortBtn");
  if (chapterSortBtn) {
    chapterSortBtn.addEventListener("click", () => {
      chapterOrder = chapterOrder === "desc" ? "asc" : "desc";
      chapterSortBtn.innerHTML = ic(chapterOrder === "asc" ? 'arrow-up' : 'arrow-up-down');
      renderChapterList();
    });
  }

  el("synopsisToggle")?.addEventListener("click", () => {
    const p = el("synopsisText");
    const toggleBtn = el("synopsisToggle");
    if (!p || !toggleBtn) return;
    const expanded = p.classList.toggle("expanded");
    toggleBtn.innerHTML = expanded ? `SHOW LESS ${ic('chevron-up')}` : `SHOW MORE ${ic('chevron-down')}`;
  });

  el("tabInfo")?.addEventListener("click", showInfoTab);
  el("tabMoreSeries")?.addEventListener("click", showMoreSeriesTab);
  el("recommendMoreBtn")?.addEventListener("click", () => {
    recommendationsExpanded = !recommendationsExpanded;
    updateRecommendCollapse();
  });

  window.addEventListener("resize", () => {
    if (recommendationsLoaded && el("recommendSection")?.style.display !== "none") {
      updateRecommendCollapse();
    }
  });

  setupBackToTop(el("backToTop"), 400);

  // Search dari halaman detail → redirect ke catalog dengan query
  const searchForm = document.getElementById('searchForm');
  const searchInput = document.getElementById('searchInput');
  if (searchForm) {
    searchForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const query = searchInput ? searchInput.value.trim() : '';
      if (!query) return;
      const params = new URLSearchParams();
      params.set('page', '1');
      params.set('query', query);
      window.location.href = `/manga/html/catalog.html?${params.toString()}`;
    });
  }

  // Perbaiki cover yang hilang saat kembali dari reader via browser back button (bfcache).
  window.addEventListener('pageshow', (event) => {
    if (!event.persisted) return;
    const coverImg = el("coverImg");
    const coverFrame = el("coverFrame");
    if (coverImg && (!coverImg.complete || coverImg.naturalWidth === 0)) {
      const currentSrc = coverImg.src;
      coverImg.src = '';
      coverImg.src = currentSrc;
    }
    if (coverFrame) {
      const bgImage = coverFrame.style.backgroundImage;
      if (bgImage && bgImage !== 'none' && bgImage !== 'url("")') {
        coverFrame.style.backgroundImage = '';
        coverFrame.style.backgroundImage = bgImage;
      }
    }
  });
});

function cleanSynopsis(raw) {
  if (!raw || typeof raw !== 'string') return '';

  // Upstream kadang mengirim sinopsis TER-ESCAPE ("&lt;p&gt;" sebagai teks)
  // — bukti: GalCli! -GALS Clinic-. Decode entitas dulu via textarea:
  // textarea adalah RCDATA (tag tak diparse, hanya entitas di-decode),
  // jadi aman tanpa risiko eksekusi apa pun.
  const decoder = document.createElement('textarea');
  decoder.innerHTML = raw;
  const decoded = decoder.value;

  const parser = new DOMParser();
  const doc = parser.parseFromString(decoded, 'text/html');

  doc.querySelectorAll('script, style, img').forEach(el => el.remove());

  const paragraphs = Array.from(doc.querySelectorAll('p'));
  const parts = [];

  for (const paragraph of paragraphs) {
    const text = paragraph.textContent.replace(/\s+/g, ' ').trim();
    if (!text) continue;
    if (/download\s*batch/i.test(text)) break;
    parts.push(text);
  }

  let text;
  if (parts.length > 0) {
    text = parts.join('\n\n');
  } else {
    text = doc.body.textContent.replace(/\s+/g, ' ').trim();
    text = text.split(/download\s*batch/i)[0].trim();
  }

  // Buang label "Sinopsis:" bawaan sumber (kita sudah punya heading panel)
  return text.replace(/^\s*sinopsis\s*:\s*/i, '').trim();
}
