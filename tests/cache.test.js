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

  it('evicts oldest by byte budget (maxBytes + sizeOf)', () => {
    const cache = new CacheManager({
      defaultTTL: 60000,
      maxBytes: 100,
      sizeOf: (v) => v?.buffer?.byteLength || 0,
    });
    const mk = (n) => ({ buffer: { byteLength: n } });
    cache.set('small', mk(40));
    cache.set('medium', mk(50));
    // total 90 — 'small' masih ada
    expect(cache.get('small')).not.toBeNull();
    // memasukkan 60 byte melebihi budget → evict tertua sampai muat:
    // 'small' lalu 'medium' ikut terbuang (total sebelumnya 90 + 60 > 100)
    cache.set('big', mk(60));
    expect(cache.get('small')).toBeNull();
    expect(cache.get('medium')).toBeNull();
    expect(cache.get('big')).not.toBeNull();
    expect(cache.totalBytes).toBe(60);
  });

  it('overwriting key updates totalBytes correctly', () => {
    const cache = new CacheManager({
      defaultTTL: 60000,
      maxBytes: 100,
      sizeOf: (v) => v?.buffer?.byteLength || 0,
    });
    const mk = (n) => ({ buffer: { byteLength: n } });
    cache.set('x', mk(80));
    cache.set('x', mk(20)); // timpa: 80 dibuang, 20 masuk — bukan 100 total
    expect(cache.totalBytes).toBe(20);
    expect(cache.get('x')).not.toBeNull();
  });
});
