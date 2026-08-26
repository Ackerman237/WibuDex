// cover-theme-video.js — Signature element sekunder: tema dinamis dari cover thumbnail video
// (HANYA halaman watch, sesuai docs/06-architecture/style-guide.md).

(function () {
  'use strict';

  const CACHE_PREFIX = 'dominantColor:video:';
  const FALLBACK_ACCENT = '#D97706'; // --accent-primary terkunci
  const BG_BASE = [13, 12, 12]; // #0D0C0C Espresso

  function getSlug() {
    const params = new URLSearchParams(window.location.search);
    return params.get('slug') || '';
  }

  function readCache(slug) {
    try {
      const raw = localStorage.getItem(CACHE_PREFIX + slug);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed && parsed.accent ? parsed : null;
    } catch {
      return null;
    }
  }

  function writeCache(slug, pair) {
    try {
      localStorage.setItem(CACHE_PREFIX + slug, JSON.stringify(pair));
    } catch {
      /* storage penuh/blocked — abaikan */
    }
  }

  /** Kumpulkan piksel kandidat (bukan near-black/near-white/abu) → bucket hue. */
  function extractDominant(img) {
    const size = 24;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, size, size);
    const { data } = ctx.getImageData(0, 0, size, size);

    const buckets = Array.from({ length: 12 }, () => ({ w: 0, r: 0, g: 0, b: 0 }));
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const sum = r + g + b;
      if (sum < 60 || sum > 700) continue; // buang near-black & near-white

      const max = Math.max(r, g, b) / 255;
      const min = Math.min(r, g, b) / 255;
      const l = (max + min) / 2;
      const s = max === min ? 0 : l > 0.5 ? (max - min) / (2 - max - min) : (max - min) / (max + min);
      if (s < 0.18) continue; // buang abu mendekati netral

      const rr = r / 255;
      const gg = g / 255;
      const bb = b / 255;
      const d = max - min;
      let h = 0;
      if (d !== 0) {
        if (max === rr) h = ((gg - bb) / d) % 6;
        else if (max === gg) h = (bb - rr) / d + 2;
        else h = (rr - gg) / d + 4;
        h *= 60;
        if (h < 0) h += 360;
      }
      const idx = Math.floor(h / 30) % 12;
      const weight = 1 + s * 3;
      buckets[idx].w += weight;
      buckets[idx].r += r * weight;
      buckets[idx].g += g * weight;
      buckets[idx].b += b * weight;
    }

    let best = null;
    for (const bk of buckets) {
      if (bk.w > 0 && (!best || bk.w > best.w)) best = bk;
    }
    if (!best) throw new Error('no-dominant');
    return [best.r / best.w, best.g / best.w, best.b / best.w];
  }

  function rgbToHsl(r, g, b) {
    const rn = r / 255;
    const gn = g / 255;
    const bn = b / 255;
    const max = Math.max(rn, gn, bn);
    const min = Math.min(rn, gn, bn);
    const l = (max + min) / 2;
    let h = 0;
    let s = 0;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === rn) h = ((gn - bn) / d) % 6;
      else if (max === gg) h = (bn - rn) / d + 2;
      else h = (rn - gn) / d + 4;
      h *= 60;
      if (h < 0) h += 360;
    }
    return [h, s, l];
  }

  function hslToHex(h, s, l) {
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l - c / 2;
    const seg = Math.floor(h / 60) % 6;
    const table = [[c, x, 0], [x, c, 0], [0, c, x], [0, x, c], [x, 0, c], [c, 0, x]][seg];
    const to255 = (v) => Math.round((v + m) * 255);
    return `#${[to255(table[0]), to255(table[1]), to255(table[2])]
      .map((v) => v.toString(16).padStart(2, '0'))
      .join('')}`;
  }

  function vividClamp(rgb) {
    const [h, s, l] = rgbToHsl(rgb[0], rgb[1], rgb[2]);
    return hslToHex(h, Math.min(0.85, s), Math.min(0.62, Math.max(0.28, l)));
  }

  function relLum([r, g, b]) {
    const f = (v) => {
      const c = v / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  }

  function contrast(a, b) {
    const la = relLum(a);
    const lb = relLum(b);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  }

  const IVORY = [243, 239, 234]; // #F3EFEA --text-primary

  function pickOnAccent(accentHex) {
    const rgb = accentHex.match(/\w\w/g).map((v) => parseInt(v, 16));
    return contrast(rgb, IVORY) >= contrast(rgb, BG_BASE) ? '#F3EFEA' : '#0D0C0C';
  }

  function textSafe(hex) {
    const rgb = hex.match(/\w\w/g).map((v) => parseInt(v, 16));
    const [h, s] = rgbToHsl(rgb[0], rgb[1], rgb[2]);
    if (contrast(rgb, BG_BASE) >= 4.5) return hex;

    for (let l = 0.62; l <= 0.9; l += 0.02) {
      const cand = hslToHex(h, Math.min(s, 0.9), l);
      const crgb = cand.match(/\w\w/g).map((v) => parseInt(v, 16));
      if (contrast(crgb, BG_BASE) >= 4.5) return cand;
    }
    return '#F59E0B'; // fallback
  }

  function applyPair(pair) {
    const onAccent = pair.contrast || pickOnAccent(pair.accent);
    document.documentElement.style.setProperty('--cover-accent', pair.accent);
    document.documentElement.style.setProperty('--cover-accent-text', pair.text);
    document.documentElement.style.setProperty('--cover-accent-contrast', onAccent);
    document.documentElement.classList.add('has-cover-accent');
  }

  async function processThumbnail(thumbUrl, slug) {
    if (!thumbUrl) return;
    try {
      const proxied = '/api/image-proxy?url=' + encodeURIComponent(thumbUrl) + '&w=64';
      const img = await new Promise((resolve, reject) => {
        const im = new Image();
        im.crossOrigin = 'anonymous';
        const timer = setTimeout(() => reject(new Error('timeout')), 10000);
        im.onload = () => {
          clearTimeout(timer);
          resolve(im);
        };
        im.onerror = () => {
          clearTimeout(timer);
          reject(new Error('image-error'));
        };
        im.src = proxied;
      });

      const dominant = extractDominant(img);
      const accent = vividClamp(dominant);
      const pair = {
        accent,
        text: textSafe(accent),
        contrast: pickOnAccent(accent),
      };
      applyPair(pair);
      writeCache(slug, pair);
    } catch (e) {
      applyPair({ accent: FALLBACK_ACCENT, text: '#F59E0B' });
    }
  }

  // Tunggu custom event dari watch.js
  document.addEventListener('video-detail-loaded', (e) => {
    const detail = e.detail;
    const slug = getSlug();
    if (!slug || !detail) return;

    const cached = readCache(slug);
    if (cached) {
      applyPair(cached);
      return;
    }

    if (detail.thumb) {
      processThumbnail(detail.thumb, slug);
    } else {
      applyPair({ accent: FALLBACK_ACCENT, text: '#F59E0B' });
    }
  });

  // Fallback initial paint dari cache jika sudah ada sebelum detail dimuat
  const slug = getSlug();
  if (slug) {
    const cached = readCache(slug);
    if (cached) applyPair(cached);
  }
})();
