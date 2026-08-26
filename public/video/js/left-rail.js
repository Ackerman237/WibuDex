// video/js/left-rail.js — Desktop left rail (V1.5)
(function () {
  const KEY = 'videoLeftRailCollapsed';
  const main = document.querySelector('main');
  if (!main) return;

  const rail = document.createElement('aside');
  rail.id = 'leftRail';
  rail.className = 'left-rail';
  rail.innerHTML = `
    <a href="/video/html/index.html"><svg class="ic" aria-hidden="true"><use href="/manga/icons.svg#i-house"></use></svg><span class="label">Beranda</span></a>
    <a href="/video/html/series.html?type=hentai"><svg class="ic" aria-hidden="true"><use href="/manga/icons.svg#i-play"></use></svg><span class="label">Hentai</span></a>
    <a href="/video/html/series.html?type=jav"><span class="label">JAV</span></a>
    <a href="/video/html/schedule.html"><svg class="ic" aria-hidden="true"><use href="/manga/icons.svg#i-clock"></use></svg><span class="label">Jadwal</span></a>
  `;
  document.body.appendChild(rail);
  main.classList.add('has-left-rail');

  let collapsed = false;
  try { collapsed = localStorage.getItem(KEY) === '1'; } catch {}
  if (collapsed) { rail.classList.add('is-collapsed'); main.classList.add('rail-collapsed'); }

  // Toggle via hamburger (reuse existing handler)
  const burger = document.getElementById('navHamburger');
  if (burger) {
    burger.addEventListener('click', () => {
      if (window.innerWidth <= 1023) return;
      collapsed = !collapsed;
      rail.classList.toggle('is-collapsed', collapsed);
      main.classList.toggle('rail-collapsed', collapsed);
      try { localStorage.setItem(KEY, collapsed ? '1' : '0'); } catch {}
    });
  }

  // Highlight aktif
  const cur = location.pathname + location.search;
  rail.querySelectorAll('a').forEach(a => {
    if (cur.includes(a.getAttribute('href'))) a.classList.add('active');
  });
})();
