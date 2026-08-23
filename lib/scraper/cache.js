export class CacheManager {
  constructor({ maxSize = Infinity, defaultTTL = 60_000 } = {}) {
    this.map = new Map();
    this.maxSize = maxSize;
    this.defaultTTL = defaultTTL;
  }

  get(key) {
    const entry = this.map.get(key);
    if (!entry) return null;
    if (entry.expiresAt < Date.now()) {
      this.map.delete(key);
      return null;
    }
    return entry.value;
  }

  has(key) {
    const entry = this.map.get(key);
    if (!entry) return false;
    if (entry.expiresAt < Date.now()) {
      this.map.delete(key);
      return false;
    }
    return true;
  }

  set(key, value, ttl) {
    if (this.map.size >= this.maxSize) {
      const oldestKey = this.map.keys().next().value;
      if (oldestKey) this.map.delete(oldestKey);
    }
    this.map.set(key, { value, expiresAt: Date.now() + (ttl || this.defaultTTL) });
  }

  clear() {
    this.map.clear();
  }
}
