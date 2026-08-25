/**
 * Scraping logic based on doujin-scraper by kyy0887
 * Original repository: https://github.com/kyy0887/doujin-scraper
 * License: MIT
 *
 * Modified/extended for use in this project.
 */
// neko/parsers/anchors.js — Ekstraksi item dari anchor internal nekopoi.
// Logika judul fallback tiga lapis (<hN> → alt= → title=) + slug + thumb
// dulunya diduplikasi identik di parseEpisodes, parseRelated, dan parseSchedule.
// Satu perubahan struktur situs kini cukup diperbaiki di sini.
import { cleanText, stripHtml, safeUrl } from '../text.js';

/**
 * @param {string} url - URL anchor internal (https://nekopoi.care/...)
 * @param {string} inner - HTML di dalam anchor
 * @param {object} opts
 * @param {number|null} opts.maxTitleLength - Buang judul lebih panjang dari ini (null = tanpa batas)
 * @param {boolean} opts.withThumb - Ekstrak thumbnail dari <img>/background-image
 */
export function extractAnchorItem(url, inner, { maxTitleLength = 200, withThumb = true } = {}) {
  const titleMatch =
    inner.match(/<h\d[^>]*>([\s\S]*?)<\/h\d>/i) ||
    inner.match(/alt=["']([^"']+)["']/i) ||
    inner.match(/title=["']([^"']+)["']/i);
  const rawTitle = titleMatch ? titleMatch[1] : '';
  const title = cleanText(rawTitle || stripHtml(inner));
  if (!title) return null;
  if (maxTitleLength !== null && title.length > maxTitleLength) return null;

  const slug = url.split('/').filter(Boolean).pop() || '';
  if (!slug) return null;

  let thumb = '';
  if (withThumb) {
    const imgMatch =
      inner.match(/<img[^>]+src=["']([^"']+)["']/i) ||
      inner.match(/background-image:\s*url\(['"]?([^'")]+)/i);
    thumb = imgMatch ? safeUrl(imgMatch[1]) : '';
  }

  return { title, slug, url: safeUrl(url), thumb };
}
