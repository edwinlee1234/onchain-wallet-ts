const EXPIRED_TIME_DAYS = 3;

/**
 * Tracks symbols and their insertion timestamps.
 * Returns true if a symbol exists and is not expired; otherwise records it and returns false.
 */
export class SymbolCache {
  private cache: Map<string, number>;
  private expirationMs: number;

  constructor(expiredTimeDays = EXPIRED_TIME_DAYS) {
    this.cache = new Map();
    this.expirationMs = expiredTimeDays * 24 * 60 * 60 * 1000;
  }

  isExist(symbol: string): boolean {
    const now = Date.now();
    const ts = this.cache.get(symbol);
    if (ts !== undefined && now - ts < this.expirationMs) {
      return true;
    }
    this.cache.set(symbol, now);
    return false;
  }
}

export const symbolCache = new SymbolCache();
