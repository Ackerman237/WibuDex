// reader.js — Chapter reader with immersive chrome

function getChapterId(chapter) {
  return chapter?.id ?? chapter?.chapter_id ?? '';
}

function getCurrentChapterIndex(chapters, chapterId) {
  return chapters.findIndex((ch) => String(getChapterId(ch)) === String(chapterId));
}

function chapterLabel(chapterData, currentIndex) {
  const num = chapterData?.number ?? chapterData?.chapter;
  if (num !== undefined && num !== null && String(num).trim() !== '') {
    return `Ch ${num}`;
  }
  if (chapterData?.title) return chapterData.title;
  if (currentIndex >= 0) return `Ch ${currentIndex + 1}`;
  return 'Chapter';
}

function setupLazyImages(container) {
  const images = Array.from(container.querySelectorAll('img[data-src]'));
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const img = entry.target;
        if (img.dataset.src) {
          img.src = img.dataset.src;
          img.removeAttribute('data-src');
        }
        observer.unobserve(img);
      });
    }, { rootMargin: '1500px 0px' });

    images.forEach((img) => observer.observe(img));
    return;
  }

  images.forEach((img) => {
    if (img.dataset.src) {
      img.src = img.dataset.src;
      img.removeAttribute('data-src');
    }
  });
}

function loadInitialPages(container, count = 10) {
  const images = Array.from(container.querySelectorAll('img'));
  images.slice(0, count).forEach((img) => {
    if (img.dataset.src) {
      img.src = img.dataset.src;
      img.removeAttribute('data-src');
    }
  });
}

/**
 * Scroll ke halaman tersimpan. WAJIB dipanggil setelah setupLazyImages() agar
 * IntersectionObserver sudah terdaftar — kalau scroll dilakukan lebih dulu,
 * gambar di sekitar posisi target tidak akan pernah dimuat (known issue lama).
 */
function scrollToReadingPosition(container, targetPage) {
  const pages = container.querySelectorAll('.reader-page');
  if (!targetPage || targetPage <= 1 || targetPage > pages.length) return;

  // Buffer-load halaman sekitar posisi target agar tidak blank saat sampai sana
  const from = Math.max(0, targetPage - 2);
  const to = Math.min(pages.length, targetPage + 2);
  for (let i = from; i < to; i++) {
    const img = pages[i]?.querySelector('img');
    if (img?.dataset.src) {
      img.src = img.dataset.src;
      img.removeAttribute('data-src');
    }
  }

  // Tunggu satu frame + delay singkat agar layout halaman settle sebelum scroll
  requestAnimationFrame(() => {
    setTimeout(() => {
      pages[targetPage - 1]?.scrollIntoView({ block: 'start' });
    }, 250);
  });
}

const IMAGE_RETRY_DELAYS = [1000, 2000, 4000];

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function describeImageFailure(url) {
  try {
    const res = await fetch(url);
    if (res.status === 504) return 'Server sumber lambat merespons (timeout).';
    if (res.status >= 500) return 'Server sumber sedang bermasalah.';
    if (res.status === 404 || res.status === 400) return 'Gambar tidak ditemukan atau ditolak server.';
    return `Server sumber menjawab dengan kode ${res.status}.`;
  } catch {
    return 'Koneksi ke server terputus — periksa internet atau VPN.';
  }
}

function createLoadStatus(totalPages) {
  let ready = 0;
  let failed = 0;
  const bar = document.createElement('div');
  bar.className = 'reader-load-status';
  bar.innerHTML = `<span class="reader-load-status__text">Memuat halaman 0/${totalPages}...</span><div class="reader-load-status__track"><div class="reader-load-status__fill" style="width:0%"></div></div>`;

  function update() {
    const done = ready + failed;
    const text = bar.querySelector('.reader-load-status__text');
    const fill = bar.querySelector('.reader-load-status__fill');
    if (text) {
      text.textContent =
        done >= totalPages
          ? failed > 0
            ? `${ready}/${totalPages} halaman siap, ${failed} gagal dimuat`
            : `Semua ${totalPages} halaman siap`
          : `Memuat halaman ${done}/${totalPages}...`;
    }
    if (fill) fill.style.width = `${Math.round((done / totalPages) * 100)}%`;
    if (done >= totalPages) bar.classList.add('is-done', failed > 0 ? 'has-failure' : 'is-complete');
  }

  return {
    element: bar,
    pageSettled(success) {
      if (success) ready += 1;
      else failed += 1;
      update();
    },
  };
}

function setupReadingProgress(imageList, totalPages, readingData) {
  const progress = document.createElement('div');
  progress.className = 'reader-progress';
  progress.textContent = `Page 0 / ${totalPages}`;
  document.body.appendChild(progress);

  let hideTimer;
  function showProgress() {
    progress.classList.add("show");
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => progress.classList.remove("show"), 500);
  }

  window.addEventListener("scroll", showProgress, { passive: true });

  const pages = Array.from(imageList.querySelectorAll('img'));

  // Simpan ke localStorage secara langsung + kirim server via debounce
  let saveTimer = null;
  let currentPageIndex = 1;

  function handlePageVisible(page) {
    currentPageIndex = page;
    const data = { ...readingData, page };
    saveReadingPosition(data); // Instan simpan ke localStorage

    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveProgressToServer(data);
    }, 3000);
  }

  // Simpan saat pengguna meninggalkan halaman / tab di-minimize
  const saveOnExit = () => {
    if (currentPageIndex > 0) {
      const data = { ...readingData, page: currentPageIndex };
      saveReadingPosition(data);
      saveProgressToServer(data);
    }
  };

  window.addEventListener('beforeunload', saveOnExit);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') saveOnExit();
  });

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const index = pages.indexOf(entry.target);
      if (index >= 0) {
        const page = index + 1;
        progress.textContent = `Page ${page} / ${totalPages}`;
        handlePageVisible(page);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -10% 0px' });

  pages.forEach(img => observer.observe(img));
  return progress;
}

function observeChapterEnd(endSentinel, onReachEnd) {
  if (!endSentinel || !('IntersectionObserver' in window)) return null;
  const observer = new IntersectionObserver((entries) => {
    if (entries.some((entry) => entry.isIntersecting)) onReachEnd();
  }, { rootMargin: '0px 0px 120px 0px', threshold: 0.1 });
  observer.observe(endSentinel);
  return observer;
}

// Chrome integration

function syncSiteHeaderHeight() {
  const header = document.querySelector('header');
  if (!header) return;
  document.documentElement.style.setProperty('--site-header-h', `${header.offsetHeight}px`);
}

function markReaderShell() {
  document.querySelector('main.container')?.classList.add('reader-shell');
}

function setupBackToTopBtn() {
  const btn = el('backToTop');
  if (!btn) return;
  const sync = () => btn.classList.toggle('show', window.scrollY > 400);
  window.addEventListener('scroll', sync, { passive: true });
  btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  sync();
}

// Chrome builders

function makeIconButton({ label, text, icon, className, disabled = false, onClick }) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className;
  button.setAttribute('aria-label', label);
  button.title = label;
  if (icon && typeof ic === 'function') {
    button.innerHTML = ic(icon);
  } else {
    button.textContent = text;
  }
  if (disabled) {
    button.disabled = true;
    button.classList.add('is-disabled');
  } else if (onClick) {
    button.addEventListener('click', onClick);
  }
  return button;
}

function buildTopBar({ mangaTitle, chapterLabelText, mangaSlug }) {
  const bar = document.createElement('header');
  bar.className = 'reader-topbar';

  const backBtn = makeIconButton({
    label: 'Kembali',
    icon: 'arrow-left',
    className: 'reader-tb-btn',
    onClick: () => {
      if (mangaSlug) {
        window.location.href = `/manga/html/detail.html?slug=${encodeURIComponent(mangaSlug)}`;
      } else if (document.referrer) {
        window.history.back();
      } else {
        window.location.href = '/manga/html/';
      }
    },
  });

  const titleWrap = document.createElement('div');
  titleWrap.className = 'reader-tb-title';

  const seriesSpan = document.createElement('span');
  seriesSpan.id = 'readerSeriesTitle';
  seriesSpan.textContent = mangaTitle;

  const arrowSpan = document.createElement('span');
  arrowSpan.className = 'reader-tb-arrow';
  arrowSpan.textContent = '›';

  const chapterSpan = document.createElement('span');
  chapterSpan.id = 'readerChapterLabel';
  chapterSpan.className = 'reader-tb-chapter';
  chapterSpan.textContent = chapterLabelText;

  titleWrap.append(seriesSpan, arrowSpan, chapterSpan);

  const homeBtn = document.createElement('a');
  homeBtn.href = '/manga/html/index.html';
  homeBtn.className = 'reader-tb-btn';
  homeBtn.setAttribute('aria-label', 'Beranda');
  homeBtn.title = 'Beranda';
  homeBtn.innerHTML = typeof ic === 'function' ? ic('house') : '⌂';

  bar.append(backBtn, titleWrap, homeBtn);
  return bar;
}

function buildBottomBar({ prevChapter, nextChapter, onPlayToggle, onSettings, onMenu }) {
  const bar = document.createElement('nav');
  bar.className = 'reader-bottombar';

  const prevBtn = makeIconButton({
    label: 'Chapter sebelumnya',
    icon: 'arrow-left',
    className: 'reader-bb-btn',
    disabled: !prevChapter,
    onClick: prevChapter ? () => {
      window.location.href = `/manga/html/reader.html?id=${encodeURIComponent(getChapterId(prevChapter))}`;
    } : null,
  });

  const settingsBtn = makeIconButton({
    label: 'Pengaturan baca',
    icon: 'settings',
    className: 'reader-bb-btn',
    onClick: onSettings,
  });

  const playBtn = makeIconButton({
    label: 'Mulai auto-scroll',
    icon: 'play',
    className: 'reader-bb-btn is-play',
    onClick: () => onPlayToggle(playBtn),
  });

  const menuBtn = makeIconButton({
    label: 'Daftar chapter',
    icon: 'list',
    className: 'reader-bb-btn',
    onClick: onMenu,
  });

  const nextBtn = makeIconButton({
    label: 'Chapter berikutnya',
    icon: 'arrow-right',
    className: 'reader-bb-btn',
    disabled: !nextChapter,
    onClick: nextChapter ? () => {
      window.location.href = `/manga/html/reader.html?id=${encodeURIComponent(getChapterId(nextChapter))}`;
    } : null,
  });

  bar.append(prevBtn, settingsBtn, playBtn, menuBtn, nextBtn);
  return bar;
}

// Side controls (panah atas/bawah mengambang) DIHAPUS 2026-08-24 atas
// masukan user: mengganggu pembaca — scroll native + auto-scroll +
// back-to-top sudah menutup fungsinya.

function buildChapterDrawer({ chapters, currentChapterId, readSet }) {
  const drawer = document.createElement('div');
  drawer.className = 'reader-drawer';

  const head = document.createElement('div');
  head.className = 'reader-drawer-head';

  const heading = document.createElement('h3');
  heading.textContent = 'Daftar Chapter';

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'reader-drawer-close';
  closeBtn.setAttribute('aria-label', 'Tutup');
  closeBtn.innerHTML = typeof ic === 'function' ? ic('x') : '✕';

  head.append(heading, closeBtn);

  const body = document.createElement('div');
  body.className = 'reader-drawer-body';

  if (chapters.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'loading';
    empty.textContent = 'Daftar chapter tidak tersedia.';
    body.appendChild(empty);
  } else {
    chapters.forEach((chapter, index) => {
      const id = getChapterId(chapter);
      const isCurrent = String(id) === String(currentChapterId);

      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'reader-drawer-item';
      if (isCurrent) item.classList.add('is-current');
      // Penanda "pernah dibaca" (readSet dari storage.getReadChapters)
      else if (readSet && readSet.has(String(id))) item.classList.add('is-read');

      const labelSpan = document.createElement('span');
      const num = chapter.number ?? chapter.chapter;
      labelSpan.textContent = (num !== undefined && num !== null && String(num).trim() !== '')
        ? `Chapter ${num}`
        : (chapter.title || `Chapter ${index + 1}`);
      item.appendChild(labelSpan);

      // Tanggal dihapus atas permintaan user — cukup nomor chapter

      if (isCurrent || !id) {
        item.disabled = true;
      } else {
        item.addEventListener('click', () => {
          window.location.href = `/manga/html/reader.html?id=${encodeURIComponent(id)}`;
        });
      }

      body.appendChild(item);
    });
  }

  drawer.append(head, body);
  return { drawer, closeBtn };
}

function buildSettingsPanel({ imageList }) {
  const panel = document.createElement('div');
  panel.className = 'reader-settings-panel';

  const head = document.createElement('div');
  head.className = 'reader-settings-head';

  const heading = document.createElement('h3');
  heading.textContent = 'Pengaturan Baca';

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'reader-drawer-close';
  closeBtn.setAttribute('aria-label', 'Tutup');
  closeBtn.innerHTML = typeof ic === 'function' ? ic('x') : '✕';

  head.append(heading, closeBtn);

  const body = document.createElement('div');
  body.className = 'reader-settings-body';

  const widthRow = document.createElement('label');
  widthRow.className = 'reader-setting-row';
  const widthLabel = document.createElement('span');
  widthLabel.textContent = 'Lebar Gambar';
  const widthInput = document.createElement('input');
  widthInput.type = 'range';
  widthInput.min = '60';
  widthInput.max = '100';
  // Persist: muat nilai tersimpan dari localStorage, fallback 100
  const savedWidth = localStorage.getItem('readerPageWidth') || '100';
  widthInput.value = savedWidth;
  imageList.style.setProperty('--page-w', `${savedWidth}%`);
  widthInput.addEventListener('input', () => {
    const val = `${widthInput.value}%`;
    imageList.style.setProperty('--page-w', val);
    localStorage.setItem('readerPageWidth', String(widthInput.value));
  });
  widthRow.append(widthLabel, widthInput);

  const speedRow = document.createElement('label');
  speedRow.className = 'reader-setting-row';
  const speedLabel = document.createElement('span');
  speedLabel.textContent = 'Kecepatan Auto-Scroll';
  const speedInput = document.createElement('input');
  speedInput.type = 'range';
  speedInput.min = '1';
  speedInput.max = '10';
  // Persist: muat nilai tersimpan dari localStorage, fallback 4
  speedInput.value = localStorage.getItem('readerAutoScrollSpeed') || '4';
  speedInput.id = 'readerAutoScrollSpeed';
  speedInput.addEventListener('change', () => {
    localStorage.setItem('readerAutoScrollSpeed', String(speedInput.value));
  });
  speedRow.append(speedLabel, speedInput);

  body.append(widthRow, speedRow);
  panel.append(head, body);
  return { panel, closeBtn, speedInput };
}

function setupChromeToggle({ topbar, bottombar, tapTarget }) {
  let visible = true;

  function applyVisibility() {
    [topbar, bottombar].forEach((node) => {
      if (!node) return;
      node.classList.toggle('is-hidden', !visible);
    });
  }

  function toggle() { visible = !visible; applyVisibility(); }
  function show() { visible = true; applyVisibility(); }
  function hide() { if (!visible) return; visible = false; applyVisibility(); }

  if (tapTarget) {
    tapTarget.addEventListener('click', (event) => {
      if (event.target.closest('a, button')) return;
      toggle();
    });
  }

  return { toggle, show, hide };
}

function setupOverlayPanels({ drawer, drawerClose, settingsPanel, settingsClose, backdrop, menuBtn, settingsBtn, showChrome }) {
  function closeAll() {
    drawer.classList.remove('is-open');
    settingsPanel.classList.remove('is-open');
    backdrop.classList.remove('is-open');
  }

  function openDrawer() {
    settingsPanel.classList.remove('is-open');
    drawer.classList.add('is-open');
    backdrop.classList.add('is-open');
    showChrome();
  }

  function openSettings() {
    drawer.classList.remove('is-open');
    settingsPanel.classList.add('is-open');
    backdrop.classList.add('is-open');
    showChrome();
  }

  menuBtn.addEventListener('click', () => {
    if (drawer.classList.contains('is-open')) closeAll();
    else openDrawer();
  });

  settingsBtn.addEventListener('click', () => {
    if (settingsPanel.classList.contains('is-open')) closeAll();
    else openSettings();
  });

  drawerClose.addEventListener('click', closeAll);
  settingsClose.addEventListener('click', closeAll);
  backdrop.addEventListener('click', closeAll);
}

// Auto-scroll

function createAutoScroller(getSpeedValue) {
  let active = false;
  let rafId = null;

  function step() {
    if (!active) return;
    const speed = 0.6 + Number(getSpeedValue() || 4) * 0.35;
    window.scrollBy(0, speed);
    const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
    if (atBottom) { stop(); return; }
    rafId = requestAnimationFrame(step);
  }

  function start() { active = true; step(); }
  function stop() { active = false; if (rafId) cancelAnimationFrame(rafId); rafId = null; }
  function isActive() { return active; }

  return { start, stop, isActive };
}

// Main

async function loadChapter() {
  markReaderShell();
  syncSiteHeaderHeight();
  window.addEventListener('resize', syncSiteHeaderHeight);
  setupBackToTopBtn();

  const container = el('reader');
  const headerInfo = el('info');
  const urlParams = new URLSearchParams(window.location.search);
  const chapterId = urlParams.get('id');

  if (!container) return;

  if (!chapterId) {
    container.className = 'error';
    container.textContent = 'ID Chapter tidak ditemukan di URL.';
    return;
  }

  container.innerHTML = '<p class="loading">Memuat chapter...</p>';

  // Fungsi helper: retry fetch sekali lagi setelah delay singkat jika kena error server
  async function fetchChapterWithRetry(id) {
    try {
      return await fetchChapter(id);
    } catch (err) {
      // Retry sekali setelah 1.5 detik untuk error server sementara (500/upstream timeout)
      const isServerError = err?.message !== 'HTTP 404' && err?.name !== 'AbortError';
      if (!isServerError) throw err;
      await new Promise((resolve) => setTimeout(resolve, 1500));
      return await fetchChapter(id);
    }
  }

  try {
    const chapterData = await fetchChapterWithRetry(chapterId);
    const mangaSlug = chapterData.mangaSlug || chapterData.manga_slug || '';

    let mangaDetail = null;
    if (mangaSlug) {
      try { mangaDetail = await fetchMangaDetail(mangaSlug); }
      catch { mangaDetail = null; }
    }

    const mangaTitle = chapterData.mangaTitle || chapterData.manga_title || mangaDetail?.title || 'Manga';
    const chaptersRaw = Array.isArray(mangaDetail?.chapters) ? mangaDetail.chapters : [];
    const chapters = [...chaptersRaw].sort((a, b) => {
      const aNum = Number(a.number ?? a.chapter ?? 0);
      const bNum = Number(b.number ?? b.chapter ?? 0);
      return aNum - bNum;
    });

    const currentIndex = getCurrentChapterIndex(chapters, chapterId);
    const prevChapter = currentIndex > 0 ? chapters[currentIndex - 1] : null;
    const nextChapter = currentIndex >= 0 && currentIndex < chapters.length - 1 ? chapters[currentIndex + 1] : null;
    const chapterLabelText = chapterLabel(chapterData, currentIndex);
    const imageUrls = Array.isArray(chapterData.images) ? chapterData.images : [];

    document.title = `${chapterLabelText} - ${mangaTitle}`;

    headerInfo.innerHTML = '';
    const topBar = buildTopBar({ mangaTitle, chapterLabelText, mangaSlug });
    headerInfo.appendChild(topBar);

    container.className = 'reader';
    container.innerHTML = '';

    const imageList = document.createElement('div');
    imageList.className = 'reader-pages';

    if (imageUrls.length > 0) {
      const loadStatus = createLoadStatus(imageUrls.length);
      container.insertBefore(loadStatus.element, container.firstChild);

      const settlePage = (success) => loadStatus.pageSettled(success);

      imageUrls.forEach((imgUrl, index) => {
        const imageUrl = `/api/image-proxy?url=${encodeURIComponent(imgUrl)}&chapterId=${encodeURIComponent(chapterId)}`;

        const pageWrap = document.createElement('div');
        pageWrap.className = 'reader-page';

        const skeleton = document.createElement('div');
        skeleton.className = 'reader-page-skeleton';
        skeleton.innerHTML = `
          <div class="reader-page-skeleton__spinner"></div>
          <p class="reader-page-skeleton__text">Memuat hal. ${index + 1}</p>
        `;

        const img = document.createElement('img');
        img.alt = `Halaman ${index + 1}`;
        img.loading = 'lazy';
        img.decoding = 'async';
        img.dataset.src = imageUrl;

        let attempts = 0;
        const maxAttempts = IMAGE_RETRY_DELAYS.length;

        const showSkeletonRetry = (attempt) => {
          skeleton.classList.remove('is-failed');
          const text = skeleton.querySelector('.reader-page-skeleton__text');
          if (text) text.textContent = `Mengulang hal. ${index + 1} (${attempt}/${maxAttempts})...`;
        };

        const showErrorBox = async () => {
          const reason = await describeImageFailure(imageUrl);
          skeleton.classList.add('is-failed');
          skeleton.innerHTML = `
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="13"/>
              <circle cx="12" cy="16.5" r="0.5" fill="currentColor"/>
            </svg>
            <p class="reader-page-skeleton__text">Gambar halaman ${index + 1} gagal dimuat.<br><small>${reason}</small></p>
            <button type="button" class="reader-page-skeleton__retry">Coba Lagi</button>
          `;
          const retryBtn = skeleton.querySelector('.reader-page-skeleton__retry');
          if (retryBtn) {
            retryBtn.addEventListener('click', () => {
              attempts = 0;
              skeleton.classList.remove('is-failed');
              skeleton.innerHTML = `
                <div class="reader-page-skeleton__spinner"></div>
                <p class="reader-page-skeleton__text">Memuat hal. ${index + 1}</p>
              `;
              img.src = `${imageUrl}&t=${Date.now()}`;
            });
          }
        };

        img.addEventListener('load', () => {
          pageWrap.classList.add('is-loaded');
          skeleton.remove();
          settlePage(true);
        });

        img.addEventListener('error', async () => {
          if (!img.getAttribute('src')) return;
          if (attempts < maxAttempts) {
            attempts += 1;
            showSkeletonRetry(attempts);
            await delay(IMAGE_RETRY_DELAYS[attempts - 1]);
            img.src = `${imageUrl}&t=${Date.now()}`;
          } else {
            settlePage(false);
            await showErrorBox();
          }
        });

        pageWrap.append(skeleton, img);
        imageList.appendChild(pageWrap);
      });

      saveReadingHistory({
        slug: mangaSlug,
        title: mangaTitle,
        thumb: chapterData.thumb || mangaDetail?.thumb || mangaDetail?.cover || mangaDetail?.coverUrl || "https://placehold.co/420x560?text=No+Cover",
        type: mangaDetail?.type || '',
        chapter: chapterData.number ?? chapterData.chapter ?? (currentIndex >= 0 ? currentIndex + 1 : 1),
        chapterId: chapterId,
        lastRead: new Date().toISOString()
      });

      // Catat untuk penanda "sudah dibaca" di drawer daftar chapter
      markChapterRead(mangaSlug, chapterId);

    } else {
      const empty = document.createElement('p');
      empty.className = 'error';
      empty.textContent = 'Gambar chapter kosong atau gagal diambil.';
      imageList.appendChild(empty);
    }

    const endSentinel = document.createElement('div');
    endSentinel.className = 'reader-end-sentinel';
    imageList.appendChild(endSentinel);

    container.appendChild(imageList);

    // 1. Restore posisi dari localStorage (logic murni dari storage.js, validasi batas halaman di sini)
    const totalPagesCount = imageList.querySelectorAll('img').length;
    const rawSavedPage = getSavedPage(mangaSlug, chapterId);
    const restoredPage = (rawSavedPage && rawSavedPage >= 1 && rawSavedPage <= totalPagesCount) ? rawSavedPage : null;

    // 2. Ambil progres dari server secara background (asinkron) untuk sinkronisasi cross-device
    if (mangaSlug) {
      fetchProgressFromServer(mangaSlug).then((serverPos) => {
        if (serverPos && serverPos.chapter_id === chapterId && serverPos.page > 1) {
          // Jika server punya posisi yang lebih baru / berbeda, sesuaikan jika belum di-restore
          const currentSaved = JSON.parse(localStorage.getItem('readingPosition') || '{}');
          if (!currentSaved.page || serverPos.page > currentSaved.page) {
            scrollToReadingPosition(imageList, serverPos.page);
          }
        }
      }).catch(() => {});
    }

    // 3. Muat lebih banyak halaman awal (10 halaman pertama) secara langsung agar IntersectionObserver
    //    tidak gagal memicu halaman berikutnya di awal scroll (mencegah layar blank/mulai dari halaman 4).
    loadInitialPages(imageList, 10);

    // 4. Daftarkan sisa gambar ke lazy loading (IntersectionObserver)
    setupLazyImages(imageList);

    // 5. Restore posisi baca: scroll SETELAH lazy loading aktif (fix known issue lama)
    if (restoredPage > 1) {
      scrollToReadingPosition(imageList, restoredPage);
    }

    const chapterNum = chapterData.number ?? chapterData.chapter ?? null;
    setupReadingProgress(imageList, imageUrls.length, {
      slug: mangaSlug,
      chapterId: chapterId,
      chapterNum: chapterNum,
      mangaTitle: mangaTitle,
      coverUrl: chapterData.thumb || mangaDetail?.thumb || mangaDetail?.cover || mangaDetail?.coverUrl || '',
      mangaType: mangaDetail?.type || '',
    });

    const goNext = () => {
      if (!nextChapter) return;
      window.location.href = `/manga/html/reader.html?id=${encodeURIComponent(getChapterId(nextChapter))}`;
    };

    const goNextBtn = document.createElement('button');
    goNextBtn.type = 'button';
    goNextBtn.className = 'reader-next-chapter';
    goNextBtn.textContent = nextChapter ? 'Lanjut Chapter Berikutnya' : 'Chapter terakhir';
    if (nextChapter) {
      goNextBtn.addEventListener('click', goNext);
    } else {
      goNextBtn.disabled = true;
      goNextBtn.classList.add('is-disabled');
    }
    container.appendChild(goNextBtn);

    const { drawer, closeBtn: drawerClose } = buildChapterDrawer({
      chapters,
      currentChapterId: chapterId,
      readSet: new Set(getReadChapters(mangaSlug).map(String)),
    });
    const { panel: settingsPanel, closeBtn: settingsClose, speedInput } = buildSettingsPanel({ imageList });

    const backdrop = document.createElement('div');
    backdrop.className = 'reader-drawer-backdrop';

    container.append(drawer, settingsPanel, backdrop);

    const autoScroller = createAutoScroller(() => speedInput.value);

    function togglePlay(playBtn) {
      if (autoScroller.isActive()) {
        autoScroller.stop();
        playBtn.innerHTML = typeof ic === 'function' ? ic('play') : '▶';
        playBtn.setAttribute('aria-label', 'Mulai auto-scroll');
        playBtn.title = 'Mulai auto-scroll';
      } else {
        autoScroller.start();
        playBtn.innerHTML = typeof ic === 'function' ? ic('pause') : '⏸';
        playBtn.setAttribute('aria-label', 'Jeda auto-scroll');
        playBtn.title = 'Jeda auto-scroll';
      }
    }

    let chromeApi;
    const bottomBar = buildBottomBar({
      prevChapter,
      nextChapter,
      onPlayToggle: togglePlay,
      onSettings: () => {},
      onMenu: () => {},
    });
    container.appendChild(bottomBar);

    const menuBtn = bottomBar.querySelector('.reader-bb-btn:nth-child(4)');
    const settingsBtn = bottomBar.querySelector('.reader-bb-btn:nth-child(2)');

    setupOverlayPanels({
      drawer,
      drawerClose,
      settingsPanel,
      settingsClose,
      backdrop,
      menuBtn,
      settingsBtn,
      showChrome: () => chromeApi?.show(),
    });

    chromeApi = setupChromeToggle({
      topbar: topBar,
      bottombar: bottomBar,
      tapTarget: imageList,
    });

    let scrollHideRaf = null;
    window.addEventListener('scroll', () => {
      if (window.scrollY <= 10) return;
      if (scrollHideRaf) return;
      scrollHideRaf = requestAnimationFrame(() => {
        chromeApi.hide();
        scrollHideRaf = null;
      });
    }, { passive: true });

    imageList.addEventListener('click', () => {
      if (autoScroller.isActive()) {
        autoScroller.stop();
        const playBtn = bottomBar.querySelector('.reader-bb-btn.is-play');
        if (playBtn) {
          playBtn.innerHTML = typeof ic === 'function' ? ic('play') : '▶';
          playBtn.setAttribute('aria-label', 'Mulai auto-scroll');
        }
      }
    });
  } catch (err) {
    console.error(err);
    container.className = 'error';
    const errMsg = formatFetchError(err, 'Gagal memuat gambar chapter.');
    container.innerHTML = `
      <div class="state-box">
        <p class="error">${errMsg}</p>
        <button type="button" class="retry-btn">COBA LAGI</button>
      </div>
    `;
    const retryBtn = container.querySelector('.retry-btn');
    if (retryBtn) {
      retryBtn.addEventListener('click', () => {
        container.innerHTML = '';
        loadChapter();
      });
    }
  }
}

document.addEventListener('DOMContentLoaded', loadChapter);
