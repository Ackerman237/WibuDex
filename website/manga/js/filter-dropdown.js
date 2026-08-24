// filter-dropdown.js — Dropdown kustom untuk filter bar katalog.
//
// Progressive enhancement di atas <select> native:
//   - Select ASLI tetap ada di DOM sebagai sumber nilai (form semantics),
//     hanya disembunyikan secara visual.
//   - Klik opsi → tulis select.value lalu dispatch event 'change' ASLI,
//     jadi listener catalog.js yang sudah ada bekerja tanpa modifikasi.
//   - Kalau file ini gagal jalan, halaman tetap berfungsi pakai select native.
//
// DUA ATURAN HASIL POSTMORTEM 2026-08-24 (docs/04-progress-log/reports/):
//   1. Visibilitas panel = SATU mekanisme saja: class .is-open pada root.
//      DULUNYA pakai atribut hidden + class bersamaan dan hanya class yang
//      dibuka → panel tak pernah muncul. Satu kondisi state UI = satu
//      mekanisme toggling (anti-pola dual source of truth).
//   2. Panel memakai position: FIXED terukur dari rect trigger — BUKAN
//      absolute. Sebab: ancestor dengan overflow-x:auto (rail filter
//      mobile) mengklip semua keturunan absolut. Fixed kebal clipping.

(function () {
  'use strict';

  let openRoot = null;

  function setOpen(root, open) {
    const trigger = root.querySelector('.fdrop__trigger');
    const panel = root.querySelector('.fdrop__panel');
    root.classList.toggle('is-open', open);
    if (trigger) trigger.setAttribute('aria-expanded', String(open));
    if (!open) panel.style.top = ''; // bersihkan posisi fixed saat tertutup
  }

  function closeAll() {
    if (!openRoot) return;
    setOpen(openRoot, false);
    openRoot = null;
  }

  /** Posisikan panel fixed di bawah trigger, di-clamp ke tepi viewport. */
  function placePanel(root) {
    const trigger = root.querySelector('.fdrop__trigger');
    const panel = root.querySelector('.fdrop__panel');
    const r = trigger.getBoundingClientRect();
    // Panel sudah display:block (is-open) saat fungsi ini dipanggil,
    // jadi offsetWidth/Height bisa diukur.
    const pw = panel.offsetWidth;
    let left = r.left;
    left = Math.max(8, Math.min(left, window.innerWidth - pw - 8));
    panel.style.left = `${left}px`;
    panel.style.position = 'fixed';
    panel.style.top = `${Math.round(r.bottom + 8)}px`;
  }

  function enhance(select) {
    if (!select || select.dataset.fdropEnhanced) return;
    select.dataset.fdropEnhanced = '1';

    const placeholder = select.dataset.placeholder || '';
    const defaultValue = select.dataset.default ?? '';

    // Struktur: .fdrop > select(tersembunyi) + trigger + panel
    const root = document.createElement('div');
    root.className = 'fdrop';

    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'fdrop__trigger';
    trigger.setAttribute('aria-haspopup', 'listbox');
    trigger.setAttribute('aria-expanded', 'false');

    const label = document.createElement('span');
    label.className = 'fdrop__label';
    trigger.appendChild(label);
    trigger.insertAdjacentHTML(
      'beforeend',
      '<svg class="ic fdrop__chevron" aria-hidden="true"><use href="/manga/icons.svg#i-chevron-down"></use></svg>'
    );

    const panel = document.createElement('ul');
    panel.className = 'fdrop__panel';
    panel.setAttribute('role', 'listbox');

    // Pindahkan select ke dalam root agar posisi fixed dihitung dari trigger
    select.parentNode.insertBefore(root, select);
    root.appendChild(select);
    root.appendChild(trigger);
    root.appendChild(panel);

    /** Bangun ulang opsi panel dari <select> (genre diisi belakangan oleh API). */
    function syncOptions() {
      const selected = select.options[select.selectedIndex];
      // Placeholder saat opsi belum terisi (genre menunggu fetch API)
      label.textContent = selected ? selected.textContent.trim() : placeholder;

      panel.innerHTML = '';
      [...select.options].forEach((opt) => {
        const li = document.createElement('li');
        li.setAttribute('role', 'option');
        li.textContent = opt.textContent.trim();
        if (opt.selected) {
          li.classList.add('is-selected');
          li.setAttribute('aria-selected', 'true');
        }
        li.addEventListener('click', () => {
          if (opt.value !== select.value) {
            select.value = opt.value;
            // Event 'change' ASLI → listener catalog.js ikut jalan
            select.dispatchEvent(new Event('change', { bubbles: true }));
          }
          closeAll();
          syncOptions();
        });
        panel.appendChild(li);
      });

      // State aktif amber: pilihan ≠ default
      root.classList.toggle('is-active', select.value !== defaultValue);
    }

    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = root.classList.contains('is-open');
      closeAll();
      if (!isOpen) {
        setOpen(root, true);
        openRoot = root;
        placePanel(root); // setelah is-open → display:block → bisa diukur
        syncOptions();    // opsi genre bisa baru saja terisi oleh fetch
      }
    });

    trigger.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeAll();
    });

    panel.addEventListener('click', (e) => e.stopPropagation());

    // Genre bisa terisi belakangan (fetch API) → pantau perubahan anak select
    new MutationObserver(syncOptions).observe(select, { childList: true });

    // Sinkron awal setelah handler DOMContentLoaded script lain selesai
    // (catalog.js mengisi nilai awal dari URL di sana).
    requestAnimationFrame(syncOptions);
  }

  function enhanceAll() {
    document.querySelectorAll('.filter-bar select').forEach(enhance);

    // Tutup saat interaksi di luar dropdown
    document.addEventListener('click', closeAll);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeAll();
    });

    // Posisi fixed basi kalau halaman bergulir/rasize → tutup saja
    window.addEventListener('scroll', closeAll, { passive: true });
    window.addEventListener('resize', closeAll);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', enhanceAll);
  } else {
    enhanceAll();
  }
})();
