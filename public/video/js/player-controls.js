// video/js/player-controls.js — V1.6 Custom Player Controls (Opsi A)
//
// Skin player di atas <video> native: seek bar amber, play/pause, volume,
// playback speed 0.5×–2×, PiP, fullscreen. TANPA dependency baru.
// Hanya aktif pada mode native — mode iframe tidak bisa dikontrol.
//
// Fallback graceful: bila init gagal, kontrol native browser tetap ada
// (attribute 'controls' tidak dihapus sampai init sukses).

(function () {
  'use strict';

  const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

  function fmtTime(sec) {
    if (!Number.isFinite(sec)) return '--:--';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  window.initPlayerControls = function (video) {
    if (!video || video.dataset.pcInit) return;
    video.dataset.pcInit = '1';

    // Cari wrapper (.video-wrapper)
    const wrap = video.closest('.video-wrapper');
    if (!wrap) return;

    // Sembunyikan kontrol native — custom controls mengambil alih
    video.removeAttribute('controls');

    // ── Bangun UI ──
    const overlay = document.createElement('div');
    overlay.className = 'pc-overlay';

    // Center: tombol play/pause besar (muncul saat pause)
    const centerBtn = document.createElement('button');
    centerBtn.className = 'pc-center';
    centerBtn.setAttribute('aria-label', 'Play / Pause');
    overlay.appendChild(centerBtn);

    // Bottom bar
    const bar = document.createElement('div');
    bar.className = 'pc-bar';

    // Play/pause kecil
    const ppBtn = document.createElement('button');
    ppBtn.className = 'pc-btn';
    ppBtn.setAttribute('aria-label', 'Play/Pause');
    bar.appendChild(ppBtn);

    // Seek slider
    const seekWrap = document.createElement('div');
    seekWrap.className = 'pc-seek-wrap';
    const seekBuf = document.createElement('div');
    seekBuf.className = 'pc-seek-buf';
    const seekFill = document.createElement('div');
    seekFill.className = 'pc-seek-fill';
    const seekThumb = document.createElement('div');
    seekThumb.className = 'pc-seek-thumb';
    seekWrap.append(seekBuf, seekFill, seekThumb);
    bar.appendChild(seekWrap);

    // Time display
    const timeEl = document.createElement('span');
    timeEl.className = 'pc-time numeric';
    bar.appendChild(timeEl);

    // Speed menu
    const speedWrap = document.createElement('div');
    speedWrap.className = 'pc-speed-wrap';
    const speedBtn = document.createElement('button');
    speedBtn.className = 'pc-btn pc-speed-btn';
    speedBtn.textContent = '1×';
    speedBtn.setAttribute('aria-label', 'Kecepatan pemutaran');
    speedWrap.appendChild(speedBtn);
    const speedMenu = document.createElement('div');
    speedMenu.className = 'pc-speed-menu';
    SPEEDS.forEach((s) => {
      const opt = document.createElement('button');
      opt.type = 'button';
      opt.className = 'pc-speed-opt';
      opt.textContent = `${s}×`;
      opt.dataset.speed = s;
      opt.addEventListener('click', (e) => {
        e.stopPropagation();
        video.playbackRate = s;
        speedMenu.querySelectorAll('.pc-speed-opt').forEach((o) => o.classList.toggle('is-selected', parseFloat(o.dataset.speed) === s));
        speedMenu.style.display = 'none';
      });
      speedMenu.appendChild(opt);
    });
    speedWrap.appendChild(speedMenu);
    bar.appendChild(speedWrap);

    // Volume
    const volBtn = document.createElement('button');
    volBtn.className = 'pc-btn';
    volBtn.innerHTML = '<svg class="ic" aria-hidden="true"><use href="/manga/icons.svg#i-settings"></use></svg>';
    volBtn.setAttribute('aria-label', 'Mute/Unmute');
    bar.appendChild(volBtn);

    // PiP
    const pipBtn = document.createElement('button');
    pipBtn.className = 'pc-btn';
    pipBtn.innerHTML = '<svg class="ic" aria-hidden="true"><use href="/manga/icons.svg#i-play"></use></svg>';
    pipBtn.setAttribute('aria-label', 'Picture-in-Picture');
    bar.appendChild(pipBtn);

    // Fullscreen
    const fsBtn = document.createElement('button');
    fsBtn.className = 'pc-btn';
    fsBtn.innerHTML = '<svg class="ic" aria-hidden="true"><use href="/manga/icons.svg#i-arrow-up"></use></svg>';
    fsBtn.setAttribute('aria-label', 'Fullscreen');
    bar.appendChild(fsBtn);

    overlay.appendChild(bar);
    wrap.appendChild(overlay);

    // ── State helpers ──
    function updatePlayIcon() {
      const isPlaying = !video.paused && !video.ended;
      ppBtn.innerHTML = isPlaying ? '⏸' : '▶';
      centerBtn.classList.toggle('is-paused', !isPlaying);
    }

    function updateTime() {
      const dur = video.duration;
      const cur = video.currentTime;
      timeEl.textContent = `${fmtTime(cur)} / ${fmtTime(dur)}`;
      if (dur > 0) {
        const pct = (cur / dur) * 100;
        seekFill.style.width = `${pct}%`;
        seekThumb.style.left = `${pct}%`;
      }
      if (video.buffered.length > 0) {
        const end = video.buffered.end(video.buffered.length - 1);
        seekBuf.style.width = `${(end / dur) * 100}%`;
      }
    }

    function togglePlay() { video.paused ? video.play().catch(() => {}) : video.pause(); }
    function seekTo(clientX) {
      const rect = seekWrap.getBoundingClientRect();
      const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      if (video.duration) video.currentTime = pct * video.duration;
    }

    // ── Events ──
    video.addEventListener('play', updatePlayIcon);
    video.addEventListener('pause', updatePlayIcon);
    video.addEventListener('timeupdate', updateTime);
    video.addEventListener('loadedmetadata', updateTime);
    video.addEventListener('progress', updateTime);

    ppBtn.addEventListener('click', (e) => { e.stopPropagation(); togglePlay(); });
    centerBtn.addEventListener('click', (e) => { e.stopPropagation(); togglePlay(); });
    video.addEventListener('click', () => togglePlay());

    // Seek: klik/drag pada seekWrap
    let seeking = false;
    seekWrap.addEventListener('mousedown', (e) => {
      seeking = true; seekTo(e.clientX);
      const move = (ev) => seekTo(ev.clientX);
      const up = () => { seeking = false; document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up); };
      document.addEventListener('mousemove', move);
      document.addEventListener('mouseup', up);
    });

    volBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      video.muted = !video.muted;
      volBtn.classList.toggle('is-muted', video.muted);
    });

    pipBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (document.pictureInPictureElement) video.requestPictureInPicture?.();
      else video.requestPictureInPicture?.();
    });

    fsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (document.fullscreenElement) document.exitFullscreen?.();
      else wrap.requestFullscreen?.();
    });

    speedBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      speedMenu.style.display = speedMenu.style.display === 'block' ? 'none' : 'block';
    });
    document.addEventListener('click', () => { speedMenu.style.display = 'none'; });

    // Auto-hide controls setelah 3 detik tanpa interaksi
    let hideTimer;
    function resetHideTimer() {
      clearTimeout(hideTimer);
      overlay.classList.remove('is-hidden-bar');
      hideTimer = setTimeout(() => {
        if (!video.paused) overlay.classList.add('is-hidden-bar');
      }, 3000);
    }
    wrap.addEventListener('mousemove', resetHideTimer);
    wrap.addEventListener('touchstart', resetHideTimer, { passive: true });
    video.addEventListener('play', resetHideTimer);

    updatePlayIcon();
    updateTime();

    // Keyboard shortcut (hanya saat fokus di dalam wrap)
    wrap.tabIndex = 0;
    wrap.addEventListener('keydown', (e) => {
      if (e.key === ' ') { e.preventDefault(); togglePlay(); }
      if (e.key === 'ArrowRight') video.currentTime += 5;
      if (e.key === 'ArrowLeft') video.currentTime -= 5;
      if (e.key === 'f') fsBtn.click();
    });
  };
})();
