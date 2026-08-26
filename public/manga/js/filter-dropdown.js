// filter-dropdown.js — Dropdown kustom untuk filter bar katalog.
//
// Progressive enhancement di atas <select> native:
//   - Select ASLI tetap ada di DOM sebagai sumber nilai (form semantics),
//     hanya disembunyikan secara visual.
//   - Klik opsi → tulis select.value lalu dispatch event 'change' ASLI,
//     jadi listener catalog.js yang sudah ada bekerja tanpa modifikasi.
//   - Kalau file ini gagal jalan, halaman tetap berfungsi pakai select native.
//
// MODE MULTI (select.multiple, dipakai genre):
//   Konsep checkbox, tampilan tetap list row (centang amber). Klik opsi =
//   toggle PENDING (belum commit). Commit lewat tombol "Terapkan" di footer;
//   "Bersihkan" mengosongkan pending. Klik-luar/Escape saat ada pending yang
//   berubah = batalkan (kembali ke state ter-apply). Mencoba memilih melebihi
//   data-max → ditolak + peringatan inline muncul.
//
// DUA ATURAN HASIL POSTMORTEM 2026-08-24 (docs/04-progress-log/reports/):
//   1. Visibilitas panel = SATU mekanisme saja: class .is-open pada root
//      (anti-pola dual source of truth atribut+class).
//   2. Panel memakai position: FIXED terukur dari rect trigger — bukan
//      absolute (ancestor overflow-x:auto mengklip keturunan absolut).

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
    const root = openRoot;
    openRoot = null;
    if (typeof root.__onClose === 'function') root.__onClose();
    setOpen(root, false);
  }

  /** Posisikan panel fixed di bawah trigger, di-clamp ke tepi viewport. */
  function placePanel(root) {
    const trigger = root.querySelector('.fdrop__trigger');
    const panel = root.querySelector('.fdrop__panel');
    const r = trigger.getBoundingClientRect();
    // Panel sudah display:block (is-open) saat fungsi ini dipanggil,
    // jadi offsetWidth bisa diukur.
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

    const isMulti = select.multiple === true;
    const placeholder = select.dataset.placeholder || '';
    const defaultValue = select.dataset.default ?? '';
    const maxItems = Number(select.dataset.max) || 6;
    const warnText =
      select.dataset.warningMsg ||
      `Maksimal ${maxItems} pilihan — lepas salah satu dulu.`;

    /** Nilai non-kosong yang sedang TER-APPLY di select. */
    function appliedValues() {
      return [...select.options]
        .filter((o) => o.selected && o.value !== '')
        .map((o) => o.value);
    }

    // Pending = pilihan sementara sebelum "Terapkan" (multi saja)
    let pending = [];

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

    const countBadge = document.createElement('span');
    countBadge.className = 'fdrop__count numeric';
    countBadge.hidden = !isMulti;

    // Urutan trigger: label → badge jumlah → chevron
    // (POSTMORTEM 2026-08-24: badge ini pernah dibuat tapi tak pernah
    // di-append — elemen tanpa sambungan DOM tidak akan pernah tampil)
    if (isMulti) trigger.appendChild(countBadge);

    trigger.insertAdjacentHTML(
      'beforeend',
      '<svg class="ic fdrop__chevron" aria-hidden="true"><use href="/manga/icons.svg#i-chevron-down"></use></svg>'
    );

    const panel = document.createElement('ul');
    panel.className = 'fdrop__panel';
    panel.setAttribute('role', 'listbox');
    if (isMulti) panel.setAttribute('aria-multiselectable', 'true');

    // Elemen khusus multi: baris info, peringatan, footer aksi
    let counterEl = null;
    let warnEl = null;
    let footerEl = null;
    if (isMulti) {
      counterEl = document.createElement('li');
      counterEl.className = 'fdrop__info numeric';

      warnEl = document.createElement('li');
      warnEl.className = 'fdrop__warn';
      warnEl.textContent = warnText;
      warnEl.hidden = true;

      footerEl = document.createElement('li');
      footerEl.className = 'fdrop__footer';
      const clearBtn = document.createElement('button');
      clearBtn.type = 'button';
      clearBtn.className = 'fdrop__clear';
      clearBtn.textContent = 'Bersihkan';
      const applyBtn = document.createElement('button');
      applyBtn.type = 'button';
      applyBtn.className = 'fdrop__apply';
      applyBtn.textContent = 'Terapkan';
      footerEl.append(clearBtn, applyBtn);

      clearBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        // INSTANT-APPLY: bersihkan langsung diterapkan tanpa tombol Terapkan
        [...select.options].forEach((o) => { o.selected = false; });
        pending = [];
        hideWarn();
        // Event 'change' ASLI → catalog.js navigasi ke URL tanpa genre
        select.dispatchEvent(new Event('change', { bubbles: true }));
        closeAll();
      });

      applyBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        [...select.options].forEach(
          (o) => (o.selected = pending.includes(o.value))
        );
        // Event 'change' ASLI → listener catalog.js ikut jalan (goToPage)
        select.dispatchEvent(new Event('change', { bubbles: true }));
        closeAll();
      });
    }

    function showWarn() {
      if (warnEl) warnEl.hidden = false;
    }
    function hideWarn() {
      if (warnEl) warnEl.hidden = true;
    }

    // Pindahkan select ke dalam root agar posisi fixed dihitung dari trigger
    select.parentNode.insertBefore(root, select);
    root.appendChild(select);
    root.appendChild(trigger);
    root.appendChild(panel);

    /** Label trigger dari nilai ter-APPLY (bukan pending). */
    function syncTrigger() {
      if (!isMulti) {
        const sel = select.options[select.selectedIndex];
        label.textContent = sel ? sel.textContent.trim() : placeholder;
        root.classList.toggle('is-active', select.value !== defaultValue);
        return;
      }
      const applied = appliedValues();
      if (applied.length === 0) {
        label.textContent = placeholder;
        root.classList.remove('is-active');
        countBadge.hidden = true;
      } else {
        const names = applied.map((v) => {
          const opt = [...select.options].find((o) => o.value === v);
          return opt ? opt.textContent.trim() : v;
        });
        label.textContent =
          names.length <= 2 ? names.join(', ') : `${names[0]}, ${names[1]} +${names.length - 2}`;
        countBadge.hidden = false;
        countBadge.textContent = String(applied.length);
        root.classList.add('is-active');
      }
    }

    /** Bangun ulang opsi panel dari <select> (genre diisi belakangan oleh API). */
    function renderList() {
      panel.innerHTML = '';

      if (isMulti) {
        counterEl.textContent = `Pilih maksimal ${maxItems} — cocok salah satu`;
        panel.appendChild(counterEl);
        panel.appendChild(warnEl);
      }

      [...select.options].forEach((opt) => {
        const isSelected = isMulti
          ? pending.includes(opt.value)
          : opt.selected;
        const li = document.createElement('li');
        li.setAttribute('role', 'option');
        li.textContent = opt.textContent.trim();
        li.dataset.value = opt.value;
        if (isSelected) {
          li.classList.add('is-selected');
          li.setAttribute('aria-selected', 'true');
        }

        li.addEventListener('click', () => {
          if (!isMulti) {
            if (opt.value !== select.value) {
              select.value = opt.value;
              // Event 'change' ASLI → listener catalog.js ikut jalan
              select.dispatchEvent(new Event('change', { bubbles: true }));
            }
            closeAll();
            renderList();
            syncTrigger();
            return;
          }

          // INSTANT-APPLY "Semua Genre": langsung terapkan tanpa Terapkan
          if (opt.value === '') {
            [...select.options].forEach((o) => { o.selected = false; });
            pending = [];
            select.dispatchEvent(new Event('change', { bubbles: true }));
            closeAll();
            return;
          }

          // ── Mode multi: toggle pending, batas maksimal ──
          const idx = pending.indexOf(opt.value);
          if (idx >= 0) {
            pending.splice(idx, 1);
            hideWarn();
          } else if (pending.length >= maxItems) {
            showWarn(); // tolak pilihan ke-(max+1)
            return;
          } else {
            pending.push(opt.value);
            hideWarn();
          }
          renderList();
        });

        panel.appendChild(li);
      });

      if (isMulti) {
        panel.appendChild(footerEl);
        if (counterEl) {
          counterEl.dataset.count = String(pending.length);
          counterEl.dataset.max = String(maxItems);
        }
      }
    }

    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = root.classList.contains('is-open');
      closeAll();
      if (!isOpen) {
        if (isMulti) pending = [...appliedValues()]; // mulai dari state ter-apply
        setOpen(root, true);
        openRoot = root;
        placePanel(root); // setelah is-open → display:block → bisa diukur
        renderList();
        syncTrigger();
      }
    });

    // Tutup via Escape di dalam trigger
    trigger.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeAll();
    });

    panel.addEventListener('click', (e) => e.stopPropagation());

    // Batalkan pending bila tertutup tanpa "Terapkan"
    if (isMulti) {
      root.__onClose = () => {
        pending = [...appliedValues()];
        hideWarn();
      };
    }

    // Genre bisa terisi belakangan (fetch API) → pantau perubahan anak select
    new MutationObserver(() => {
      renderList();
      syncTrigger();
    }).observe(select, { childList: true });

    // Sinkron awal setelah handler DOMContentLoaded script lain selesai
    // (catalog.js mengisi nilai awal dari URL di sana).
    requestAnimationFrame(() => {
      renderList();
      syncTrigger();
    });
  }

  function enhanceAll() {
    document.querySelectorAll('.filter-bar select').forEach(enhance);

    // Tutup saat interaksi di luar dropdown
    document.addEventListener('click', closeAll);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeAll();
    });

    // Posisi fixed basi kalau halaman bergulir/resize → tutup saja
    window.addEventListener('scroll', closeAll, { passive: true });
    window.addEventListener('resize', closeAll);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', enhanceAll);
  } else {
    enhanceAll();
  }
})();
