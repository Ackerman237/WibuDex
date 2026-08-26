// shared/nav.js — Hamburger menu toggle, auto-hide header, & Spotlight Search (Ctrl+K)
// Dijalankan di seluruh halaman manga (index, catalog, detail, library, history).

(function () {
  'use strict';

  // ─── 1. Hamburger Mobile Nav ───────────────────────────────────────────
  const hamburger = document.getElementById('navHamburger');
  const navLinks = document.getElementById('navLinks');

  if (hamburger && navLinks) {
    function closeNav() {
      navLinks.classList.remove('is-open');
      hamburger.classList.remove('is-active');
      hamburger.setAttribute('aria-expanded', 'false');
    }

    function toggleNav() {
      const isOpen = navLinks.classList.toggle('is-open');
      hamburger.classList.toggle('is-active', isOpen);
      hamburger.setAttribute('aria-expanded', String(isOpen));
    }

    hamburger.addEventListener('click', toggleNav);

    navLinks.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', closeNav);
    });

    window.addEventListener('resize', () => {
      if (window.innerWidth > 768) closeNav();
    });
  }

  // ─── 2. Auto-hide Header pada Mobile Scroll ────────────────────────────
  const header = document.querySelector('header');
  if (header) {
    let lastScroll = 0;
    const scrollThreshold = 80;
    let hideLockUntil = 0;

    window.addEventListener('scroll', () => {
      if (window.innerWidth >= 768) return;

      const currentScroll = window.pageYOffset || document.documentElement.scrollTop;

      if (navLinks && navLinks.classList.contains('is-open')) {
        header.classList.remove('header-is-hidden');
        const delta = currentScroll - lastScroll;
        if (currentScroll > lastScroll && delta > 40) {
          navLinks.classList.remove('is-open');
          hamburger?.classList.remove('is-active');
          hideLockUntil = Date.now() + 300;
        } else {
          lastScroll = currentScroll <= 0 ? 0 : currentScroll;
          return;
        }
      }

      if (currentScroll > lastScroll && currentScroll > scrollThreshold) {
        header.classList.add('header-is-hidden');
      } else if (currentScroll < lastScroll) {
        if (Date.now() >= hideLockUntil) {
          header.classList.remove('header-is-hidden');
        } else {
          hideLockUntil = Math.max(hideLockUntil, Date.now() + 250);
        }
      }

      lastScroll = currentScroll <= 0 ? 0 : currentScroll;
    }, { passive: true });
  }

  // ─── 3. Spotlight Search Modal Manga (Ctrl+K / /) ──────────────────────
  let spotlightModal = document.getElementById('spotlightModal');
  if (!spotlightModal) {
    spotlightModal = document.createElement('div');
    spotlightModal.id = 'spotlightModal';
    spotlightModal.className = 'spotlight-backdrop';
    spotlightModal.innerHTML = `
      <div class="spotlight-container" role="dialog" aria-modal="true" aria-label="Pencarian Cepat Manga">
        <div class="spotlight-input-wrap">
          <svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <input type="text" class="spotlight-input" id="mangaSpotlightInput" placeholder="Cari judul manga, manhwa, komik... (Esc untuk keluar)" autocomplete="off">
          <span style="font-size:11px;color:var(--text-disabled);border:1px solid var(--border-subtle);padding:2px 6px;border-radius:4px">ESC</span>
        </div>
        <div class="spotlight-results" id="mangaSpotlightResults">
          <p style="text-align:center;padding:24px;color:var(--text-secondary);font-size:13px;margin:0">Ketik judul untuk mencari...</p>
        </div>
      </div>
    `;
    document.body.appendChild(spotlightModal);
  }

  const spotlightInput = document.getElementById('mangaSpotlightInput');
  const spotlightResults = document.getElementById('mangaSpotlightResults');

  function openSpotlight() {
    spotlightModal.classList.add('is-open');
    setTimeout(() => spotlightInput?.focus(), 50);
  }

  function closeSpotlight() {
    spotlightModal.classList.remove('is-open');
    if (spotlightInput) spotlightInput.value = '';
  }

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

  const searchTriggers = document.querySelectorAll('.nav-search, .nav-search-trigger');
  searchTriggers.forEach((el) => {
    el.addEventListener('click', (e) => {
      // Buka modal spotlight saat search bar diklik
      e.preventDefault();
      openSpotlight();
    });
  });

  let searchTimer = null;
  spotlightInput?.addEventListener('input', (e) => {
    const q = e.target.value.trim();
    clearTimeout(searchTimer);
    if (!q) {
      spotlightResults.innerHTML = '<p style="text-align:center;padding:24px;color:var(--text-secondary);font-size:13px;margin:0">Ketik judul untuk mencari...</p>';
      return;
    }

    spotlightResults.innerHTML = '<p style="text-align:center;padding:24px;color:var(--text-secondary);font-size:13px;margin:0">Mencari manga...</p>';
    searchTimer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/manga/search?q=${encodeURIComponent(q)}`);
        if (!res.ok) throw new Error('Search error');
        const json = await res.json();
        const results = Array.isArray(json) ? json : (json.data || []);
        if (results.length === 0) {
          spotlightResults.innerHTML = '<p style="text-align:center;padding:24px;color:var(--text-secondary);font-size:13px;margin:0">Tidak ada judul ditemukan.</p>';
          return;
        }
        spotlightResults.innerHTML = '';
        results.slice(0, 8).forEach((item) => {
          const a = document.createElement('a');
          a.className = 'spotlight-item';
          a.href = `/manga/html/detail.html?slug=${encodeURIComponent(item.slug)}`;
          a.innerHTML = `
            <img class="spotlight-thumb" src="${item.thumb || ''}" alt="" onerror="this.style.display='none'" style="aspect-ratio:2/3;width:44px;object-fit:cover;border-radius:4px;">
            <div class="spotlight-item-info">
              <div class="spotlight-item-title">${item.title || 'Tanpa Judul'}</div>
              <div class="spotlight-item-meta">${item.type || 'Manga'} ${item.score ? `· ⭐ ${item.score}` : ''}</div>
            </div>
          `;
          spotlightResults.appendChild(a);
        });
      } catch {
        spotlightResults.innerHTML = '<p style="text-align:center;padding:24px;color:var(--error);font-size:13px;margin:0">Gagal memuat hasil pencarian.</p>';
      }
    }, 250);
  });
})();
