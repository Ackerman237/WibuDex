// video/js/hero-spotlight.js — Hero Billboard Cinematic Spotlight Slider
// Menampilkan banner video unggulan dengan backdrop sinematik dan transisi halus.

(function () {
  'use strict';

  window.initHeroSpotlight = function (items) {
    const container = document.getElementById('heroSpotlight');
    if (!container || !Array.isArray(items) || items.length === 0) return;

    // Batasi 5 item teratas untuk spotlight slider
    const slides = items.slice(0, 5);
    let currentIndex = 0;
    let autoSlideInterval = null;

    container.innerHTML = `
      <div class="hero-slider">
        <div class="hero-slides-track">
          ${slides.map((item, idx) => `
            <div class="hero-slide ${idx === 0 ? 'is-active' : ''}" data-index="${idx}">
              <div class="hero-backdrop-wrap">
                <img class="hero-backdrop" src="${item.thumb || ''}" alt="${item.title || ''}" loading="${idx === 0 ? 'eager' : 'lazy'}">
                <div class="hero-vignette"></div>
              </div>
              <div class="hero-content">
                <div class="hero-badges">
                  <span class="hero-badge-tag"><svg class="ic" viewBox="0 0 24 24" fill="currentColor" width="12" height="12"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg> UNGGULAN HARI INI</span>
                  <span class="hero-badge-type">${item.type || 'HENTAI'}</span>
                  ${item.date ? `<span class="hero-badge-date">${item.date}</span>` : ''}
                </div>
                <h2 class="hero-title">${item.title || 'Tanpa Judul'}</h2>
                <p class="hero-synopsis">Nikmati streaming video kualitas terbaik dengan pemutar anti-iklan dan pergantian server instan di Wibudex.</p>
                <div class="hero-actions">
                  <a href="/video/html/watch.html?slug=${encodeURIComponent(item.slug)}" class="hero-btn-play">
                    <svg class="ic" viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M8 5v14l11-7z"/></svg>
                    NONTON SEKARANG
                  </a>
                  <a href="/video/html/series.html?type=${encodeURIComponent(item.type ? item.type.toLowerCase() : 'hentai')}" class="hero-btn-info">
                    <svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
                    JELAJAHI SERI
                  </a>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
        <div class="hero-dots">
          ${slides.map((_, idx) => `
            <button class="hero-dot ${idx === 0 ? 'is-active' : ''}" type="button" data-index="${idx}" aria-label="Slide ${idx + 1}"></button>
          `).join('')}
        </div>
      </div>
    `;

    const slideEls = container.querySelectorAll('.hero-slide');
    const dotEls = container.querySelectorAll('.hero-dot');

    function goToSlide(index) {
      if (index === currentIndex) return;
      slideEls[currentIndex]?.classList.remove('is-active');
      dotEls[currentIndex]?.classList.remove('is-active');
      currentIndex = (index + slides.length) % slides.length;
      slideEls[currentIndex]?.classList.add('is-active');
      dotEls[currentIndex]?.classList.add('is-active');
    }

    function startAutoSlide() {
      stopAutoSlide();
      autoSlideInterval = setInterval(() => {
        goToSlide(currentIndex + 1);
      }, 6000);
    }

    function stopAutoSlide() {
      if (autoSlideInterval) {
        clearInterval(autoSlideInterval);
        autoSlideInterval = null;
      }
    }

    dotEls.forEach((dot, idx) => {
      dot.addEventListener('click', () => {
        goToSlide(idx);
        startAutoSlide();
      });
    });

    container.addEventListener('mouseenter', stopAutoSlide);
    container.addEventListener('mouseleave', startAutoSlide);

    startAutoSlide();
  };
})();
