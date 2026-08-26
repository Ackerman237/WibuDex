// shared/nav.js — Hamburger menu toggle (mobile nav)
// Load di SEMUA halaman kecuali reader.html

(function () {
  const hamburger = document.getElementById('navHamburger');
  const navLinks = document.getElementById('navLinks');

  if (!hamburger || !navLinks) return;

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
    if (window.innerWidth > 700) closeNav();
  });

  // Auto-hide/show navbar on mobile scroll
  (function () {
    const header = document.querySelector('header');
    if (!header) return;

    let lastScroll = 0;
    const scrollThreshold = 80;
    let hideLockUntil = 0;

    window.addEventListener('scroll', () => {
      // Hanya aktif di mobile (lebih kecil dari 768px)
      if (window.innerWidth >= 768) return;

      const currentScroll = window.pageYOffset || document.documentElement.scrollTop;

      // Menu mobile terbuka → header TIDAK boleh menghilang (bug UX
      // 2026-08-24: jitter scroll saat menu dibaca melorotkan header).
      // Scroll-bawah signifikan (>40px) → tutup menu + auto-hide normal.
      if (navLinks.classList.contains('is-open')) {
        header.classList.remove('header-is-hidden');
        const delta = currentScroll - lastScroll;
        if (currentScroll > lastScroll && delta > 40) {
          closeNav();
          // Lipatan tinggi menu memicu koreksi scrollTop ke atas — kunci
          // pelepasan sebentar agar header tetap tersembunyi.
          hideLockUntil = Date.now() + 300;
          // jatuh ke logika auto-hide normal di bawah
        } else {
          lastScroll = currentScroll <= 0 ? 0 : currentScroll;
          return;
        }
      }

      if (currentScroll > lastScroll && currentScroll > scrollThreshold) {
        // Scroll ke bawah -> sembunyikan header
        header.classList.add('header-is-hidden');
      } else if (currentScroll < lastScroll) {
        // Scroll ke atas -> tampilkan kembali (kecuali baru saja menutup
        // menu — ekor koreksi scrollTop bisa berdurasi >1 detik, jadi
        // kunci diperpanjang selama ekornya masih berjalan)
        if (Date.now() >= hideLockUntil) {
          header.classList.remove('header-is-hidden');
        } else {
          hideLockUntil = Math.max(hideLockUntil, Date.now() + 250);
        }
      }

      lastScroll = currentScroll <= 0 ? 0 : currentScroll;
    }, { passive: true });
  })();
})();
