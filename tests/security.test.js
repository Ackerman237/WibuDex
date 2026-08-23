import { describe, it, expect } from 'vitest';
import {
  sanitizeUrl,
  stripHtml,
  isPrivateHost,
  isAllowedImageHost,
  safeHttpUrl,
  safeImageUrl,
} from '../lib/security.js';

describe('sanitizeUrl', () => {
  it('returns empty for non-string', () => {
    expect(sanitizeUrl(123)).toBe('');
  });

  it('blocks javascript:', () => {
    expect(sanitizeUrl('javascript:alert(1)')).toBe('');
  });

  it('blocks data:', () => {
    expect(sanitizeUrl('data:text/html,<h1>hi</h1>')).toBe('');
  });

  it('blocks vbscript:', () => {
    expect(sanitizeUrl('vbscript:MsgBox(1)')).toBe('');
  });

  it('allows http', () => {
    expect(sanitizeUrl('http://example.com')).toBe('http://example.com');
  });

  it('allows https', () => {
    expect(sanitizeUrl('https://example.com')).toBe('https://example.com');
  });
});

describe('stripHtml', () => {
  it('removes script tags', () => {
    expect(stripHtml('<p>hi</p><script>bad()</script>')).toBe('hi');
  });

  it('removes style tags', () => {
    expect(stripHtml('<p>hi</p><style>.x{}</style>')).toBe('hi');
  });

  it('removes all tags', () => {
    expect(stripHtml('<div><b>bold</b></div>')).toBe('bold');
  });
});

describe('isPrivateHost', () => {
  it('returns true for localhost', () => {
    expect(isPrivateHost('localhost')).toBe(true);
  });

  it('returns true for 127.x', () => {
    expect(isPrivateHost('127.0.0.1')).toBe(true);
  });

  it('returns true for 10.x', () => {
    expect(isPrivateHost('10.0.0.1')).toBe(true);
  });

  it('returns true for 192.168.x', () => {
    expect(isPrivateHost('192.168.1.1')).toBe(true);
  });

  it('returns true for 172.16.x', () => {
    expect(isPrivateHost('172.16.0.1')).toBe(true);
  });

  it('returns true for empty', () => {
    expect(isPrivateHost('')).toBe(true);
  });

  it('returns false for public host', () => {
    expect(isPrivateHost('example.com')).toBe(false);
  });
});

describe('isAllowedImageHost', () => {
  it('returns true for allowed host', () => {
    expect(isAllowedImageHost('doujin.desu.xxx')).toBe(true);
  });

  it('returns true for any subdomain of allowed domain suffix', () => {
    expect(isAllowedImageHost('ch-img.desu.pics')).toBe(true);
    expect(isAllowedImageHost('amz-ch.desu.pics')).toBe(true);
    expect(isAllowedImageHost('img2.desu.pics')).toBe(true);
    expect(isAllowedImageHost('pic.desu.xxx')).toBe(true);
  });

  it('returns false for lookalike domain that only ends with suffix without dot boundary', () => {
    expect(isAllowedImageHost('evildesu.pics')).toBe(false);
    expect(isAllowedImageHost('desu.pics.evil.com')).toBe(false);
  });

  it('returns false for unknown host', () => {
    expect(isAllowedImageHost('evil.com')).toBe(false);
  });
});

describe('safeHttpUrl (generik: protokol + anti-SSRF, TANPA allowlist domain)', () => {
  it('returns empty for non-string', () => {
    expect(safeHttpUrl(123)).toBe('');
  });

  it('returns empty for blocked protocol', () => {
    expect(safeHttpUrl('javascript:alert(1)')).toBe('');
  });

  it('returns empty for private host', () => {
    expect(safeHttpUrl('http://localhost/image.jpg')).toBe('');
    expect(safeHttpUrl('http://127.0.0.1/x')).toBe('');
    expect(safeHttpUrl('http://192.168.1.5/x')).toBe('');
  });

  it('accepts any public http(s) host (generik)', () => {
    expect(safeHttpUrl('https://evil.com/image.jpg')).toContain('evil.com');
    expect(safeHttpUrl('https://example.com/a.png')).toContain('example.com');
  });
});

describe('safeImageUrl (safeHttpUrl + allowlist domain gambar doujin)', () => {
  it('returns empty for non-string', () => {
    expect(safeImageUrl(123)).toBe('');
  });

  it('returns empty for blocked protocol', () => {
    expect(safeImageUrl('javascript:alert(1)')).toBe('');
  });

  it('returns empty for private host', () => {
    expect(safeImageUrl('http://localhost/image.jpg')).toBe('');
  });

  it('returns empty for disallowed host', () => {
    expect(safeImageUrl('https://evil.com/image.jpg')).toBe('');
  });

  it('returns valid url for allowed host', () => {
    const result = safeImageUrl('https://doujin.desu.xxx/image.jpg');
    expect(result).toContain('doujin.desu.xxx');
    expect(safeImageUrl('https://img2.desu.pics/x.webp')).toContain('desu.pics');
  });
});
