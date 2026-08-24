// filter-dropdown.js — Dropdown kustom untuk filter bar katalog.
//
// Progressive enhancement di atas <select> native:
//   - Select ASLI tetap ada di DOM sebagai sumber nilai (form semantics),
//     hanya disembunyikan secara visual.
//   - Klik opsi → tulis select.value lalu dispatch event 'change' ASLI,
//     jadi listener catalog.js yang sudah ada bekerja tanpa modifikasi.
//   - Kalau file ini gagal jalan, halaman tetap berfungsi pakai select native.
//
// Penandaan default untuk state aktif amber: atribut [data-default] pada
// <select> (filter: "", sort: "newest").

(function () {
  'use strict';

  let openDropdown = null;

  function closeAll() {
    if (openDropdown) {
      openDropdown.classList.remove('is-open');
      openDropdown.querySelector('.fdrop__trigger')
        ?.setAttribute('aria-expanded', 'false');
      openDropdown = null;
    }
  }

  function enhance(select) {
    if (!select || select.dataset.fdropEnhanced) return;
    select.dataset.fdropEnhanced = '1';

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
    panel.hidden = true;

    // Pindahkan select ke dalam root agar posisi panel relatif benar
    select.parentNode.insertBefore(root, select);
    root.appendChild(select);
    root.appendChild(trigger);
    root.appendChild(panel);

    /** Bangun ulang opsi panel dari <select> (genre diisi belakangan oleh API). */
    function syncOptions() {
      const selected = select.options[select.selectedIndex];
      label.textContent = selected ? selected.textContent.trim() : '';

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
          syncState();
        });
        panel.appendChild(li);
      });

      // State aktif amber: pilihan ≠ default
      root.classList.toggle('is-active', select.value !== defaultValue);
    }

    function toggle() {
      const isOpen = root.classList.contains('is-open');
      closeAll();
      if (!isOpen) {
        root.classList.add('is-open');
        trigger.setAttribute('aria-expanded', 'true');
        openDropdown = root;
      }
    }

    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      toggle();
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

    // Tutup saat klik di luar / Escape (global)
    document.addEventListener('click', closeAll);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeAll();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', enhanceAll);
  } else {
    enhanceAll();
  }
})();
