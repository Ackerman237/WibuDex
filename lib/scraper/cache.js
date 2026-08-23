export class CacheManager {
  constructor({ maxSize = Infinity, defaultTTL = 60_000, maxBytes = Infinity, sizeOf = null } = {}) {
    this.map = new Map();
    this.maxSize = maxSize;
    this.defaultTTL = defaultTTL;
    // Budget memori opsional (byte): butuh sizeOf(value) untuk mengukur entri.
    this.maxBytes = maxBytes;
    this.sizeOf = sizeOf;
    this.totalBytes = 0;
  }

  _sizeOf(value) {
    return this.sizeOf ? this.sizeOf(value) : 0;
  }

  _delete(key) {
    const entry = this.map.get(key);
    if (entry) {
      this.totalBytes -= entry.bytes;
      this.map.delete(key);
    }
  }

  get(key) {
    const entry = this.map.get(key);
    if (!entry) return null;
    if (entry.expiresAt < Date.now()) {
      this._delete(key);
      return null;
    }
    return entry.value;
  }

  has(key) {
    const entry = this.map.get(key);
    if (!entry) return false;
    if (entry.expiresAt < Date.now()) {
      this._delete(key);
      return false;
    }
    return true;
  }

  set(key, value, ttl) {
    const bytes = this._sizeOf(value);
    // Timpa entri lama dengan key sama: hitung bersih dulu.
    this._delete(key);

    // Evict tertua sampai muat (dari sisi jumlah entri maupun budget byte).
    while (
      this.map.size > 0 &&
      (this.map.size >= this.maxSize ||
        (this.maxBytes !== Infinity && this.totalBytes + bytes > this.maxBytes))
    ) {
      const oldestKey = this.map.keys().next().value;
      this._delete(oldestKey);
    }

    this.totalBytes += bytes;
    this.map.set(key, { value, bytes, expiresAt: Date.now() + (ttl || this.defaultTTL) });
  }

  clear() {
    this.map.clear();
    this.totalBytes = 0;
  }
}
