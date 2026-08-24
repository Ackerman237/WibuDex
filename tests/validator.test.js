import { describe, it, expect } from 'vitest';
import {
  validatePage,
  validateLimit,
  validateQuery,
  validateSlug,
  validateId,
  validateCategory,
  validateCategoryList,
  validateUrl,
  validateEnum,
} from '../lib/validator.js';

describe('validatePage', () => {
  it('returns 1 for undefined', () => {
    expect(validatePage(undefined)).toBe(1);
  });

  it('returns 1 for non-numeric', () => {
    expect(validatePage('abc')).toBe(1);
  });

  it('returns 1 for 0', () => {
    expect(validatePage('0')).toBe(1);
  });

  it('returns 1 for negative', () => {
    expect(validatePage('-5')).toBe(1);
  });

  it('clamps to 1000 max', () => {
    expect(validatePage('9999')).toBe(1000);
  });

  it('returns valid page', () => {
    expect(validatePage('5')).toBe(5);
  });
});

describe('validateLimit', () => {
  it('returns 10 for undefined', () => {
    expect(validateLimit(undefined)).toBe(10);
  });

  it('returns 1 for non-numeric', () => {
    expect(validateLimit('abc')).toBe(10);
  });

  it('clamps to 100 max', () => {
    expect(validateLimit('200')).toBe(100);
  });

  it('returns valid limit', () => {
    expect(validateLimit('50')).toBe(50);
  });
});

describe('validateQuery', () => {
  it('returns empty for non-string', () => {
    expect(validateQuery(123)).toBe('');
  });

  it('returns empty for empty string', () => {
    expect(validateQuery('')).toBe('');
  });

  it('trims whitespace', () => {
    expect(validateQuery('  naruto  ')).toBe('naruto');
  });

  it('truncates at 200 chars', () => {
    const long = 'a'.repeat(300);
    expect(validateQuery(long)).toHaveLength(200);
  });

  it('returns valid query', () => {
    expect(validateQuery('one piece')).toBe('one piece');
  });
});

describe('validateSlug', () => {
  it('returns null for non-string', () => {
    expect(validateSlug(123)).toBeNull();
  });

  it('returns null for empty', () => {
    expect(validateSlug('')).toBeNull();
  });

  it('returns null for special chars like slash', () => {
    expect(validateSlug('manga/title')).toBeNull();
  });

  it('accepts alphanumeric with hyphens', () => {
    expect(validateSlug('manga-title_123')).toBe('manga-title_123');
  });

  it('truncates at 200 chars', () => {
    const long = 'a'.repeat(300);
    expect(validateSlug(long)).toBeNull();
  });
});

describe('validateId', () => {
  it('returns null for non-string', () => {
    expect(validateId(123)).toBeNull();
  });

  it('returns null for empty', () => {
    expect(validateId('')).toBeNull();
  });

  it('returns trimmed id', () => {
    expect(validateId('  123  ')).toBe('123');
  });
});

describe('validateCategory', () => {
  it('returns null for non-string', () => {
    expect(validateCategory(123)).toBeNull();
  });

  it('returns null for empty', () => {
    expect(validateCategory('')).toBeNull();
  });

  it('returns trimmed category', () => {
    expect(validateCategory('  ecchi  ')).toBe('ecchi');
  });
});

describe('validateCategoryList', () => {
  it('returns null for non-string', () => {
    expect(validateCategoryList(123)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(validateCategoryList('')).toBeNull();
  });

  it('returns null when no item is valid', () => {
    expect(validateCategoryList(',,,')).toBeNull();
    expect(validateCategoryList('bad genre!, <script>')).toBeNull();
  });

  it('passes a single slug through unchanged', () => {
    expect(validateCategoryList('ecchi')).toBe('ecchi');
  });

  it('splits comma-separated slugs and joins them back', () => {
    expect(validateCategoryList('ahegao,ecchi')).toBe('ahegao,ecchi');
  });

  it('trims whitespace around items', () => {
    expect(validateCategoryList(' ahegao , ecchi ')).toBe('ahegao,ecchi');
  });

  it('lowercases and drops duplicates', () => {
    expect(validateCategoryList('Ecchi,Ahegao,ECCHI')).toBe('ecchi,ahegao');
  });

  it('drops items with invalid characters', () => {
    expect(validateCategoryList('ahegao,<script>,ecchi;drop,x.y')).toBe('ahegao');
  });

  it('drops items longer than 50 chars', () => {
    const tooLong = `${'a'.repeat(51)}`;
    expect(validateCategoryList(`ecchi,${tooLong}`)).toBe('ecchi');
  });

  it('caps result at 6 items by default', () => {
    const seven = ['g1', 'g2', 'g3', 'g4', 'g5', 'g6', 'g7'].join(',');
    expect(validateCategoryList(seven)).toBe('g1,g2,g3,g4,g5,g6');
  });

  it('honors custom max', () => {
    expect(validateCategoryList('a,b,c', 2)).toBe('a,b');
  });
});

describe('validateUrl', () => {
  it('returns null for non-string', () => {
    expect(validateUrl(123)).toBeNull();
  });

  it('returns null for empty', () => {
    expect(validateUrl('')).toBeNull();
  });

  it('returns null for invalid url', () => {
    expect(validateUrl('not-a-url')).toBeNull();
  });

  it('returns null for javascript: protocol', () => {
    expect(validateUrl('javascript:alert(1)')).toBeNull();
  });

  it('returns null for ftp: protocol', () => {
    expect(validateUrl('ftp://example.com')).toBeNull();
  });

  it('accepts http url', () => {
    expect(validateUrl('http://example.com')).toBe('http://example.com');
  });

  it('accepts https url', () => {
    expect(validateUrl('https://example.com/path?q=1')).toBe('https://example.com/path?q=1');
  });
});

describe('validateEnum', () => {
  const ALLOWED = new Set(['ongoing', 'completed', 'hiatus']);

  it('returns fallback for non-string', () => {
    expect(validateEnum(123, ALLOWED, '')).toBe('');
  });

  it('returns fallback for value outside whitelist', () => {
    expect(validateEnum('random-value', ALLOWED, '')).toBe('');
  });

  it('is case-insensitive and trims', () => {
    expect(validateEnum('  Ongoing ', ALLOWED, '')).toBe('ongoing');
  });

  it('returns matched lowercase value', () => {
    expect(validateEnum('completed', ALLOWED, '')).toBe('completed');
  });

  it('returns custom fallback when provided', () => {
    expect(validateEnum(undefined, ALLOWED, 'newest')).toBe('newest');
  });
});
