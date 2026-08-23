import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CacheManager } from '../lib/scraper/cache.js';

describe('CacheManager', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });
  it('stores and retrieves value', () => {
    const cache = new CacheManager({ defaultTTL: 60000 });
    cache.set('key1', 'value1');
    expect(cache.get('key1')).toBe('value1');
  });

  it('returns null for missing key', () => {
    const cache = new CacheManager();
    expect(cache.get('missing')).toBeNull();
  });

  it('returns null for expired entry', () => {
    const cache = new CacheManager({ defaultTTL: 1 });
    cache.set('key1', 'value1');
    vi.advanceTimersByTime(10);
    expect(cache.get('key1')).toBeNull();
  });

  it('respects custom TTL', () => {
    const cache = new CacheManager({ defaultTTL: 60000 });
    cache.set('key1', 'value1', 1);
    vi.advanceTimersByTime(10);
    expect(cache.get('key1')).toBeNull();
  });

  it('evicts oldest when maxSize reached', () => {
    const cache = new CacheManager({ maxSize: 2 });
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);
    expect(cache.get('a')).toBeNull();
    expect(cache.get('b')).toBe(2);
    expect(cache.get('c')).toBe(3);
  });

  it('overwrites existing key', () => {
    const cache = new CacheManager();
    cache.set('key1', 'old');
    cache.set('key1', 'new');
    expect(cache.get('key1')).toBe('new');
  });

  it('clear() menghapus semua entry', () => {
    const cache = new CacheManager({ defaultTTL: 60000 });
    cache.set('a', 1);
    cache.set('b', 2);
    cache.clear();
    expect(cache.get('a')).toBeNull();
    expect(cache.get('b')).toBeNull();
    expect(cache.has('a')).toBe(false);
  });
});
