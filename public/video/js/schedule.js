// schedule.js — Halaman jadwal standalone (CSP-safe, tanpa inline script)
async function loadSchedulePage() {
  const c = document.getElementById('scheduleContainer');
  if (!c) return;
  try {
    const r = await fetch('/api/video/schedule');
    const j = await r.json();
    if (!j.success || !Array.isArray(j.data)) {
      c.innerHTML = '<div class="schedule-empty"><svg class="ic schedule-empty__icon" aria-hidden="true"><use href="/manga/icons.svg#i-clock"></use></svg><p class="schedule-empty__title">Jadwal belum tersedia</p><p class="schedule-empty__hint">Coba lagi nanti.</p><button type="button" class="retry-btn schedule-empty__retry">Coba lagi</button></div>';
      c.querySelector('.schedule-empty__retry')?.addEventListener('click', loadSchedulePage);
      return;
    }
    if (j.data.length === 0) {
      c.innerHTML = '<div class="schedule-empty"><svg class="ic schedule-empty__icon" aria-hidden="true"><use href="/manga/icons.svg#i-clock"></use></svg><p class="schedule-empty__title">Belum ada jadwal tayang</p><p class="schedule-empty__hint">Sumber belum mempublikasikan jadwal — daftar akan muncul otomatis begitu tersedia.</p><button type="button" class="retry-btn schedule-empty__retry">Coba lagi</button></div>';
      c.querySelector('.schedule-empty__retry')?.addEventListener('click', loadSchedulePage);
      return;
    }
    c.innerHTML = '';
    j.data.forEach((dayGroup) => {
      const wrap = document.createElement('div');
      wrap.className = 'schedule-day';
      wrap.hidden = (dayGroup.series || []).length === 0;
      const head = document.createElement('h3');
      head.className = 'schedule-day-title';
      head.textContent = dayGroup.day || '-';
      wrap.appendChild(head);
      const list = document.createElement('div');
      list.className = 'schedule-series-list';
      (dayGroup.series || []).forEach((item) => {
        const card = document.createElement('a');
        card.className = 'schedule-card';
        card.href = `/video/html/watch.html?slug=${encodeURIComponent(item.slug)}`;
        const thumb = item.thumb || '';
        const thumbImg = thumb ? `<img src="${escapeHtml(thumb)}" alt="${escapeHtml(item.title || '')}" loading="lazy" referrerpolicy="no-referrer">` : '<span class="schedule-card__ph">?</span>';
        card.innerHTML = `${thumbImg}<span class="schedule-card-title">${escapeHtml(item.title || '')}</span>`;
        list.appendChild(card);
      });
      wrap.appendChild(list);
      c.appendChild(wrap);
    });
  } catch (_e) {
    c.innerHTML = '<p class="error">Gagal memuat jadwal.</p><div style="text-align:center"><button type="button" class="retry-btn">COBA LAGI</button></div>';
    c.querySelector('.retry-btn')?.addEventListener('click', loadSchedulePage);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const b = document.getElementById('backToTop');
  if (typeof setupBackToTop === 'function') setupBackToTop(b, 300);
  loadSchedulePage();
});
