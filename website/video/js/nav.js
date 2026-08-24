// video/js/nav.js — Hamburger mobile + dropdown CATEGORIES dinamis
// Load di semua halaman neko (index, series, watch).

(function () {
  // ─── Hamburger (port pola manga/shared/nav.js) ─────────────────────
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
      if (window.innerWidth > 700) closeNav();
    });
  }

  // ─── Dropdown CATEGORIES ─────────────────────────────────────────────────
  const dropdown = document.getElementById('categoriesDropdown');
  const toggleBtn = dropdown?.querySelector('.nav-drop-toggle');
  const menu = dropdown?.querySelector('.nav-drop-menu');

  if (!dropdown || !toggleBtn || !menu) return;

  function setOpen(open) {
    dropdown.classList.toggle('is-open', open);
    toggleBtn.setAttribute('aria-expanded', String(open));
  }
  const isOpen = () => dropdown.classList.contains('is-open');

  toggleBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    setOpen(!isOpen());
  });

  // Hover hanya efek visual via CSS; klik luar & Escape menutup
  document.addEventListener('click', (e) => {
    if (isOpen() && !dropdown.contains(e.target)) setOpen(false);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isOpen()) setOpen(false);
  });

  // Tutup dropdown saat item dipilih / link lain diklik di mode mobile
  menu.addEventListener('click', (e) => {
    if (e.target.closest('a')) setOpen(false);
  });

  // ─── Muat kategori (cache sessionStorage TTL 10 menit) ──────────────────
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

  function writeCache(data) {
    try {
      sessionStorage.setItem(CACHE_KEY, JSON.stringify({ data, expiresAt: Date.now() + CACHE_TTL }));
    } catch {
      // storage penuh / diblokir — abaikan, fetch ulang tiap halaman
    }
  }

  function renderItems(cats) {
    menu.innerHTML = '';
    cats.forEach((cat) => {
      if (!cat?.slug) return;
      const a = document.createElement('a');
      a.href = `/video/html/index.html?category=${encodeURIComponent(cat.slug)}`;
      a.textContent = cat.name || cat.slug;
      menu.appendChild(a);
    });
  }

  function renderFallback() {
    menu.innerHTML = '';
    const a = document.createElement('a');
    a.href = '/video/html/series.html?type=hentai';
    a.textContent = 'Daftar Lengkap →';
    menu.appendChild(a);
  }

  async function loadCategories() {
    const cached = readCache();
    if (cached && cached.length > 0) {
      renderItems(cached);
      return;
    }

    try {
      const res = await fetch('/api/neko/categories');
      const json = await res.json();
      const cats = Array.isArray(json?.data) ? json.data : [];
      if (cats.length === 0) throw new Error('kosong');
      writeCache(cats);
      renderItems(cats);
    } catch {
      renderFallback();
    }
  }

  loadCategories();
})();
