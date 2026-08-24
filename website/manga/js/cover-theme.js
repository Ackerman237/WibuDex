// cover-theme.js — Signature element sekunder: tema dinamis dari cover
// (HANYA halaman detail, sesuai docs/06-architecture/style-guide.md).
//
// ALGORITMA (v2 — dipertegas atas permintaan user, sebelumnya "hampir sama
// semua"): warna DOMINAN via 12 bucket hue berbobot saturasi×jumlah piksel,
// BUKAN rata-rata seluruh piksel (rata-rata selalu menghasilkan lumpur
// cokelat-abu yang mirip antar cover). Saturasi/lightness di-clamp lebih
// longgar (S≤0.85, L 0.28–0.62) agar karakter cover terasa.
//
// DUA VARIABEL dengan jaminan kontras:
//   --cover-accent      → permukaan (bg tombol, gradient, border, badge)
//   --cover-accent-text → teks/ikon/garis; lightness diiterasi otomatis
//                         sampai kontras ≥4.5:1 terhadap --bg-base
//
// Cache localStorage `dominantColor:<slug>` = JSON {accent,text}
// (format lama string hex tetap dibaca). Fallback: amber terkunci.
//
// POSTMORTEM-CLASS NOTES: canvas same-origin via image-proxy (anti-taint);
// textarea-decode tidak dipakai di sini — hanya DOM read.

(function () {
  'use strict';

  const CACHE_PREFIX = 'dominantColor:';
  const FALLBACK_ACCENT = '#D97706'; // --accent-primary terkunci
  const BG_BASE = [13, 12, 12]; // #0D0C0C Espresso

  function getSlug() {
    const params = new URLSearchParams(window.location.search);
    return params.get('slug') || params.get('id') || '';
  }

  function readCache(slug) {
    try {
      const raw = localStorage.getItem(CACHE_PREFIX + slug);
      if (!raw) return null;
      if (raw.startsWith('#')) return { accent: raw, text: raw }; // format lama
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
      // Saturasi HSL standar
      const l = (max + min) / 2;
      const s = max === min ? 0 : l > 0.5 ? (max - min) / (2 - max - min) : (max - min) / (max + min);
      if (s < 0.18) continue; // buang abu mendekati netral

      // Hue → bucket 30°
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
      const weight = 1 + s * 3; // piksel pekat bobot lebih besar
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
      else if (max === gn) h = (bn - rn) / d + 2;
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

  /** Vivid clamp untuk permukaan: S ≤0.85, L 0.28–0.62. */
  function vividClamp(rgb) {
    const [h, s, l] = rgbToHsl(rgb[0], rgb[1], rgb[2]);
    return hslToHex(h, Math.min(0.85, s), Math.min(0.62, Math.max(0.28, l)));
  }

  /** Relative luminance WCAG. */
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

  /** Hex → varian yang lolos kontras ≥4.5 vs bg-base (geser lightness). */
  function textSafe(hex) {
    const rgb = hex.match(/\w\w/g).map((v) => parseInt(v, 16));
    const [h, s] = rgbToHsl(rgb[0], rgb[1], rgb[2]);
    if (contrast(rgb, BG_BASE) >= 4.5) return hex;

    // Coba naikkan lightness (bg kita gelap → arah terang)
    for (let l = 0.62; l <= 0.9; l += 0.02) {
      const cand = hslToHex(h, Math.min(s, 0.9), l);
      const crgb = cand.match(/\w\w/g).map((v) => parseInt(v, 16));
      if (contrast(crgb, BG_BASE) >= 4.5) return cand;
    }
    return '#F59E0B'; // fallback accent-hover (sudah teruji kontrasnya)
  }

  function applyPair(pair) {
    document.documentElement.style.setProperty('--cover-accent', pair.accent);
    document.documentElement.style.setProperty('--cover-accent-text', pair.text);
    document.documentElement.classList.add('has-cover-accent');
  }

  async function init() {
    const slug = getSlug();
    if (!slug) return;

    const cached = readCache(slug);
    if (cached) {
      applyPair(cached);
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
      const pair = { accent, text: textSafe(accent) };
      applyPair(pair);
      writeCache(slug, pair);
    } catch {
      applyPair({ accent: FALLBACK_ACCENT, text: '#F59E0B' });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
