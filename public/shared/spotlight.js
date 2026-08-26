// shared/spotlight.js — Premium Spotlight Glow & 3D Tilt Card Interaction
// Shared oleh manga & video. Dijalankan otomatis saat DOM siap.

(function () {
  'use strict';

  const MAX_TILT = 6; // Max rotation in degrees

  function handleMouseMove(e) {
    const card = e.currentTarget;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const xc = rect.width / 2;
    const yc = rect.height / 2;

    const rotateY = ((x - xc) / xc) * MAX_TILT;
    const rotateX = -((y - yc) / yc) * MAX_TILT;

    // Gunakan requestAnimationFrame untuk performa maksimal bebas jank (60+ FPS)
    requestAnimationFrame(() => {
      card.style.transform = `perspective(800px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) scale3d(1.02, 1.02, 1.02)`;
      card.style.setProperty('--mouse-x', `${((x / rect.width) * 100).toFixed(1)}%`);
      card.style.setProperty('--mouse-y', `${((y / rect.height) * 100).toFixed(1)}%`);
    });
  }

  function handleMouseLeave(e) {
    const card = e.currentTarget;
    requestAnimationFrame(() => {
      card.style.transform = '';
      card.style.setProperty('--mouse-x', '50%');
      card.style.setProperty('--mouse-y', '50%');
    });
  }

  function initSpotlight() {
    const selector = '.manga-card, .video-card, .history-card, .episode-card, .related-card';
    
    // Gunakan event delegation untuk menghemat memori & menangani konten dinamis (lazy load)
    document.body.addEventListener('mouseenter', (e) => {
      const card = e.target.closest(selector);
      if (card && !card.dataset.spotlightInitialized) {
        card.dataset.spotlightInitialized = '1';
        card.addEventListener('mousemove', handleMouseMove);
        card.addEventListener('mouseleave', handleMouseLeave);
      }
    }, true); // Use capture phase to intercept mouseenter on elements
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSpotlight);
  } else {
    initSpotlight();
  }
})();
