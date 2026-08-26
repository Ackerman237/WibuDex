// video/js/nav.js — Navbar Modern Streaming & Spotlight Search (Ctrl+K)
// Dijalankan di seluruh modul video (index, watch, series, episodes, schedule).

(function () {
  'use strict';

  // ─── 1. Hamburger Mobile Menu ──────────────────────────────────────────
  const hamburger = document.getElementById('navHamburger');
  const navLinks = document.getElementById('navLinks');

  if (hamburger && navLinks) {
    function closeNav() {
      navLinks.classList.remove('is-open');
      hamburger.classList.remove('is-active');
      hamburger.setAttribute('aria-expanded', 'false');
    }

    hamburger.addEventListener('click', () => {
      const isOpen = navLinks.classList.toggle('is-open');
      hamburger.classList.toggle('is-active', isOpen);
      hamburger.setAttribute('aria-expanded', String(isOpen));
    });

    navLinks.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', closeNav);
    });

    window.addEventListener('resize', () => {
      if (window.innerWidth > 768) closeNav();
    });
  }

  // ─── 2. Auto-hide Header pada Mobile Scroll ────────────────────────────
  const headerEl = document.querySelector('header');
  if (headerEl) {
    let lastScroll = 0;
    window.addEventListener('scroll', () => {
      if (window.innerWidth >= 768) return;
      const y = window.scrollY || document.documentElement.scrollTop;
      if (y > lastScroll && y > 80) headerEl.classList.add('header-is-hidden');
      else if (y < lastScroll) headerEl.classList.remove('header-is-hidden');
      lastScroll = Math.max(y, 0);
    }, { passive: true });
  }

  // ─── 3. Dropdown Kategori (dengan Cache sessionStorage) ─────────────────
  const dropdown = document.getElementById('categoriesDropdown');
  const toggleBtn = dropdown?.querySelector('.nav-drop-toggle');
  const menu = dropdown?.querySelector('.nav-drop-menu');

  if (dropdown && toggleBtn && menu) {
    function setOpen(open) {
      dropdown.classList.toggle('is-open', open);
      toggleBtn.setAttribute('aria-expanded', String(open));
    }
    const isOpen = () => dropdown.classList.contains('is-open');

    toggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      setOpen(!isOpen());
    });

    document.addEventListener('click', (e) => {
      if (isOpen() && !dropdown.contains(e.target)) setOpen(false);
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && isOpen()) setOpen(false);
    });

    // Muat data kategori
    const CACHE_KEY = 'nekoCategoriesCache';
    const CACHE_TTL = 10 * 60 * 1000;

    function readCache() {
      try {
        const raw = sessionStorage.getItem(CACHE_KEY);
        if (!raw) return null;
        const entry = JSON.parse(raw);
        if (!entry || Date.now() > entry.expiresAt || !Array.isArray(entry.data)) return null;
        return entry.data;
      } catch {
        return null;
      }
    }

    function renderItems(cats) {
      menu.innerHTML = '';
      if (!cats || cats.length === 0) {
        menu.innerHTML = '<p class="nav-drop-loading">Tidak ada kategori.</p>';
        return;
      }
      cats.forEach((cat) => {
        const a = document.createElement('a');
        a.href = `/video/html/series.html?category=${encodeURIComponent(cat.slug || cat.name)}`;
        a.textContent = cat.name;
        menu.appendChild(a);
      });
    }

    const cached = readCache();
    if (cached) {
      renderItems(cached);
    } else {
      fetch('/api/video/categories')
        .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
        .then((json) => {
          const cats = Array.isArray(json) ? json : (json.data || json.categories || []);
          try {
            sessionStorage.setItem(CACHE_KEY, JSON.stringify({ data: cats, expiresAt: Date.now() + CACHE_TTL }));
          } catch {
            // Abaikan storage error
          }
          renderItems(cats);
        })
        .catch(() => {
          menu.innerHTML = '<p class="nav-drop-loading">Gagal memuat kategori.</p>';
        });
    }
  }

  // ─── 4. Quick Randomizer Button ─────────────────────────────────────────
  const randomBtns = document.querySelectorAll('.btn-random, #randomBtn, #navRandomBtn');
  randomBtns.forEach((btn) => {
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      btn.style.opacity = '0.5';
      try {
        const res = await fetch('/api/video/random');
        if (!res.ok) throw new Error('Failed');
        const data = await res.json();
        const slug = data?.slug || data?.video?.slug;
        if (slug) {
          window.location.href = `/video/html/watch.html?slug=${encodeURIComponent(slug)}`;
        }
      } catch (err) {
        window.location.href = '/video/html/series.html?type=hentai';
      } finally {
        btn.disabled = false;
        btn.style.opacity = '1';
      }
    });
  });

  // ─── 5. Spotlight Search Modal (Ctrl + K / Search Icon) ───────────────────
  let spotlightModal = document.getElementById('spotlightModal');
  if (!spotlightModal) {
    spotlightModal = document.createElement('div');
    spotlightModal.id = 'spotlightModal';
    spotlightModal.className = 'spotlight-backdrop';
    spotlightModal.innerHTML = `
      <div class="spotlight-container" role="dialog" aria-modal="true" aria-label="Pencarian Cepat">
        <div class="spotlight-input-wrap">
          <svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <input type="text" class="spotlight-input" id="spotlightInput" placeholder="Cari anime, episode, judul video... (Esc untuk keluar)" autocomplete="off">
          <span style="font-size:11px;color:var(--text-disabled);border:1px solid var(--border-subtle);padding:2px 6px;border-radius:4px">ESC</span>
        </div>
        <div class="spotlight-results" id="spotlightResults">
          <p style="text-align:center;padding:24px;color:var(--text-secondary);font-size:13px;margin:0">Ketik kata kunci untuk mencari...</p>
        </div>
      </div>
    `;
    document.body.appendChild(spotlightModal);
  }

  const spotlightInput = document.getElementById('spotlightInput');
  const spotlightResults = document.getElementById('spotlightResults');

  function openSpotlight() {
    spotlightModal.classList.add('is-open');
    setTimeout(() => spotlightInput?.focus(), 50);
  }

  function closeSpotlight() {
    spotlightModal.classList.remove('is-open');
    if (spotlightInput) spotlightInput.value = '';
  }

  // Keyboard shortcut Ctrl+K atau Slash (/)
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey && e.key.toLowerCase() === 'k') || (e.key === '/' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA')) {
      e.preventDefault();
      openSpotlight();
    }
    if (e.key === 'Escape' && spotlightModal.classList.contains('is-open')) {
      closeSpotlight();
    }
  });

  spotlightModal.addEventListener('click', (e) => {
    if (e.target === spotlightModal) closeSpotlight();
  });

  // Tombol search di navbar membuka spotlight di mobile/desktop
  const navSearchBtns = document.querySelectorAll('.nav-search-trigger, #navSearchTrigger');
  navSearchBtns.forEach((btn) => btn.addEventListener('click', openSpotlight));

  // Live search debounce
  let searchTimer = null;
  spotlightInput?.addEventListener('input', (e) => {
    const q = e.target.value.trim();
    clearTimeout(searchTimer);
    if (!q) {
      spotlightResults.innerHTML = '<p style="text-align:center;padding:24px;color:var(--text-secondary);font-size:13px;margin:0">Ketik kata kunci untuk mencari...</p>';
      return;
    }

    spotlightResults.innerHTML = '<p style="text-align:center;padding:24px;color:var(--text-secondary);font-size:13px;margin:0">Mencari...</p>';
    searchTimer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/video/search?q=${encodeURIComponent(q)}`);
        if (!res.ok) throw new Error('Search error');
        const items = await res.json();
        const results = Array.isArray(items) ? items : items.data || [];
        if (results.length === 0) {
          spotlightResults.innerHTML = '<p style="text-align:center;padding:24px;color:var(--text-secondary);font-size:13px;margin:0">Tidak ada hasil ditemukan.</p>';
          return;
        }
        spotlightResults.innerHTML = '';
        results.slice(0, 8).forEach((item) => {
          const a = document.createElement('a');
          a.className = 'spotlight-item';
          a.href = `/video/html/watch.html?slug=${encodeURIComponent(item.slug)}`;
          a.innerHTML = `
            <img class="spotlight-thumb" src="${item.thumb || ''}" alt="" onerror="this.style.display='none'">
            <div class="spotlight-item-info">
              <div class="spotlight-item-title">${item.title || 'Tanpa Judul'}</div>
              <div class="spotlight-item-meta">${item.date || ''}</div>
            </div>
          `;
          spotlightResults.appendChild(a);
        });
      } catch {
        spotlightResults.innerHTML = '<p style="text-align:center;padding:24px;color:var(--error);font-size:13px;margin:0">Gagal memuat hasil pencarian.</p>';
      }
    }, 250);
  });

  // ─── 6. Back to Top Smooth ──────────────────────────────────────────────
  const backToTop = document.getElementById('backToTop');
  if (backToTop) {
    window.addEventListener('scroll', () => {
      if (window.scrollY > 400) backToTop.classList.add('show');
      else backToTop.classList.remove('show');
    }, { passive: true });

    backToTop.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }
})();
