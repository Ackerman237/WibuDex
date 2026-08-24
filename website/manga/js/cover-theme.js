// cover-theme.js — Signature element sekunder: tema dinamis dari cover
// (HANYA halaman detail, sesuai docs/06-architecture/style-guide.md).
//
// Alur: ambil warna rata-rata cover via canvas → softkan (S & L di-clamp)
// → set CSS var --cover-accent → CSS memakainya untuk gradient ambience
// lembut + border CTA. Cache per slug di localStorage (`dominantColor:<slug>`).
//
// Keamanan & fallback:
//   - Cover diambil lewat /api/image-proxy (same-origin) agar canvas tidak
//     tainted; kalau gagal apa pun → biarkan var() default amber terkunci.
//   - Teks selalu pakai token standar; warna dinamis hanya dekoratif
//     (gradient transparan + border), lightness di-clamp agar kontras aman.

(function () {
  'use strict';

  const CACHE_PREFIX = 'dominantColor:';
  const FALLBACK = '#D97706'; // --accent-primary terkunci

  function getSlug() {
    const params = new URLSearchParams(window.location.search);
    return params.get('slug') || params.get('id') || '';
  }

  function readCache(slug) {
    try {
      return localStorage.getItem(CACHE_PREFIX + slug);
    } catch {
      return null;
    }
  }

  function writeCache(slug, color) {
    try {
      localStorage.setItem(CACHE_PREFIX + slug, color);
    } catch {
      /* storage penuh/blocked — abaikan */
    }
  }

  /** Rata-rata piksel gambar (same-origin via proxy) → "rgb(r,g,b)". */
  function averageColor(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      const timer = setTimeout(() => reject(new Error('timeout')), 10000);
      img.onload = () => {
        clearTimeout(timer);
        try {
          const size = 24;
          const canvas = document.createElement('canvas');
          canvas.width = size;
          canvas.height = size;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          ctx.drawImage(img, 0, 0, size, size);
          const { data } = ctx.getImageData(0, 0, size, size);
          let r = 0;
          let g = 0;
          let b = 0;
          let n = 0;
          for (let i = 0; i < data.length; i += 4) {
            // Abaikan piksel yang hampir hitam pekat & putih pucat
            const [pr, pg, pb] = [data[i], data[i + 1], data[i + 2]];
            if (pr + pg + pb < 45) continue;
            r += pr;
            g += pg;
            b += pb;
            n += 1;
          }
          if (!n) throw new Error('no-pixels');
          resolve(`rgb(${Math.round(r / n)},${Math.round(g / n)},${Math.round(b / n)})`);
        } catch (err) {
          clearTimeout(timer);
          reject(err);
        }
      };
      img.onerror = () => {
        clearTimeout(timer);
        reject(new Error('image-error'));
      };
      img.src = src;
    });
  }

  /** Softkan warna: saturasi & lightness di-clamp agar tidak norak. */
  function soften(rgbStr) {
    const [r, g, b] = rgbStr.match(/\d+/g).map(Number);
    const max = Math.max(r, g, b) / 255;
    const min = Math.min(r, g, b) / 255;
    const l = (max + min) / 2;
    let s = 0;
    if (max !== min) {
      s = l > 0.5 ? (max - min) / (2 - max - min) : (max - min) / (max + min);
    }
    const clampedL = Math.min(0.55, Math.max(0.35, l));
    const clampedS = Math.min(0.62, s);

    // HSL → RGB
    const hue = (() => {
      const rr = r / 255;
      const gg = g / 255;
      const bb = b / 255;
      const d = max - min;
      if (d === 0) return 0;
      let h = 0;
      if (max === rr) h = ((gg - bb) / d) % 6;
      else if (max === gg) h = (bb - rr) / d + 2;
      else h = (rr - gg) / d + 4;
      h *= 60;
      return h < 0 ? h + 360 : h;
    })();

    const c = (1 - Math.abs(2 * clampedL - 1)) * clampedS;
    const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
    const m = clampedL - c / 2;
    const seg = Math.floor(hue / 60) % 6;
    const table = [
      [c, x, 0], [x, c, 0], [0, c, x], [0, x, c], [x, 0, c], [c, 0, x],
    ][seg];
    const to255 = (v) => Math.round((v + m) * 255);
    return `#${[to255(table[0]), to255(table[1]), to255(table[2])]
      .map((v) => v.toString(16).padStart(2, '0'))
      .join('')}`;
  }

  function applyAccent(color) {
    document.documentElement.style.setProperty('--cover-accent', color);
    document.documentElement.classList.add('has-cover-accent');
  }

  async function init() {
    const slug = getSlug();
    if (!slug) return;

    const cached = readCache(slug);
    if (cached) {
      applyAccent(cached);
      return;
    }

    // Tunggu detail.js mengisi cover (polling ringan, maks ~15 detik)
    const coverImg = await new Promise((resolve) => {
      let elapsed = 0;
      const timer = setInterval(() => {
        elapsed += 250;
        const el = document.getElementById('coverImg');
        if (el && el.src && !el.src.includes('placehold.co')) {
          clearInterval(timer);
          resolve(el);
        } else if (elapsed > 15000) {
          clearInterval(timer);
          resolve(null);
        }
      }, 250);
    });
    if (!coverImg) return;

    try {
      const proxied =
        '/api/image-proxy?url=' + encodeURIComponent(coverImg.src) + '&w=64';
      const color = soften(await averageColor(proxied));
      applyAccent(color);
      writeCache(slug, color);
    } catch {
      applyAccent(FALLBACK); // tetap eksplisit; visual = default amber
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
