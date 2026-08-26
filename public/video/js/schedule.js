// video/js/schedule.js — Halaman Jadwal Rilis dengan Tab Hari Interaktif (Senin - Minggu)

const INDO_DAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const todayName = INDO_DAYS[new Date().getDay()];

async function loadSchedulePage() {
  const container = document.getElementById('scheduleContainer');
  const tabsContainer = document.getElementById('scheduleDayTabs');
  if (!container) return;

  try {
    const res = await fetch('/api/video/schedule');
    const json = await res.json();
    if (!json.success || !Array.isArray(json.data)) {
      container.innerHTML = `
        <div class="schedule-empty">
          <p class="schedule-empty__title">Jadwal belum tersedia</p>
          <button type="button" class="retry-btn">Coba lagi</button>
        </div>`;
      container.querySelector('.retry-btn')?.addEventListener('click', loadSchedulePage);
      return;
    }

    const scheduleData = json.data;
    if (scheduleData.length === 0) {
      container.innerHTML = '<p class="loading">Belum ada data jadwal rilis.</p>';
      return;
    }

    // Build Tabs
    if (tabsContainer) {
      tabsContainer.innerHTML = '';

      // Tombol Semua Hari
      const allBtn = document.createElement('button');
      allBtn.className = 'cmd-btn';
      allBtn.textContent = 'Semua Hari';
      allBtn.onclick = () => renderFilteredSchedule(scheduleData, 'all', allBtn);
      tabsContainer.appendChild(allBtn);

      scheduleData.forEach((group) => {
        const btn = document.createElement('button');
        const isToday = group.day && (group.day.toLowerCase().includes(todayName.toLowerCase()) || todayName.toLowerCase().includes(group.day.toLowerCase()));
        btn.className = `cmd-btn ${isToday ? 'active' : ''}`;
        btn.innerHTML = `${escapeHtml(group.day || '-')} ${isToday ? '<span style="color:var(--accent-primary);font-size:10px;">(HARI INI)</span>' : ''}`;
        btn.onclick = () => renderFilteredSchedule(scheduleData, group.day, btn);
        tabsContainer.appendChild(btn);
      });
    }

    // Default: Cari hari ini atau hari pertama
    const todayGroup = scheduleData.find((g) => g.day && (g.day.toLowerCase().includes(todayName.toLowerCase()) || todayName.toLowerCase().includes(g.day.toLowerCase())));
    const defaultDay = todayGroup ? todayGroup.day : (scheduleData[0]?.day || 'all');
    const activeTab = tabsContainer?.querySelector('.cmd-btn.active') || tabsContainer?.children[0];

    renderFilteredSchedule(scheduleData, defaultDay, activeTab);
  } catch (err) {
    container.innerHTML = `<p class="error">Gagal memuat jadwal: ${escapeHtml(err.message)}</p>`;
  }
}

function renderFilteredSchedule(scheduleData, selectedDay, activeBtn) {
  const container = document.getElementById('scheduleContainer');
  const tabsContainer = document.getElementById('scheduleDayTabs');
  if (!container) return;

  if (tabsContainer && activeBtn) {
    tabsContainer.querySelectorAll('.cmd-btn').forEach((b) => b.classList.remove('active'));
    activeBtn.classList.add('active');
  }

  container.innerHTML = '';
  const filtered = selectedDay === 'all'
    ? scheduleData
    : scheduleData.filter((g) => g.day === selectedDay);

  if (filtered.length === 0) {
    container.innerHTML = '<p class="error">Tidak ada rilis untuk hari ini.</p>';
    return;
  }

  filtered.forEach((dayGroup) => {
    const dayWrap = document.createElement('div');
    dayWrap.style.marginBottom = '32px';

    const title = document.createElement('h3');
    title.className = 'section-title';
    title.style.marginBottom = '16px';
    title.textContent = dayGroup.day || '-';
    dayWrap.appendChild(title);

    const grid = document.createElement('div');
    grid.className = 'video-grid';

    (dayGroup.series || []).forEach((item) => {
      grid.appendChild(renderMediaCard(item, {
        variant: 'grid',
        meta: `Rilis ${dayGroup.day || 'Mingguan'}`,
      }));
    });

    if ((dayGroup.series || []).length === 0) {
      grid.innerHTML = '<p style="color:var(--text-disabled);font-size:13px;">Belum ada judul yang dijadwalkan.</p>';
    }

    dayWrap.appendChild(grid);
    container.appendChild(dayWrap);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  loadSchedulePage();
});
