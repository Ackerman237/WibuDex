// bottom-nav.js — Shared Bottom Navigation Component
// Injeksi mobile-only; desktop tetap pakai header.
(function () {
  const currentPath = window.location.pathname;
  const navItems = [
    { label: 'Home', path: '/doujinPage/html/index.html', icon: 'home' },
    { label: 'Jelajah', path: '/doujinPage/html/allManga.html', icon: 'compass' },
    { label: 'Video', path: '/nekoPage/html/', icon: 'video' },
    { label: 'Library', path: '/doujinPage/html/library.html', icon: 'bookmark' }
  ];

  function createBottomNav() {
    const nav = document.createElement('nav');
    nav.className = 'bottom-nav';
    
    let html = '';
    navItems.forEach(item => {
      const isActive = currentPath.includes(item.path);
      html += `
        <a href="${item.path}" class="bottom-nav__item ${isActive ? 'is-active' : ''}">
          ${isActive ? '<div class="bottom-nav__pill"></div>' : ''}
          <svg class="ic" aria-hidden="true"><use href="/doujinPage/icons.svg#i-${item.icon}"/></svg>
          <span style="font-size: 11px; font-weight: 600;">${item.label}</span>
        </a>
      `;
    });
    
    nav.innerHTML = html;
    document.body.appendChild(nav);
  }

  // Mobile only
  if (window.innerWidth <= 700) {
    createBottomNav();
  }
})();
