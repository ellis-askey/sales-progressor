// A tiny per-key TTL memo for expensive, scope-only server reads that re-run on
// every navigation (a server-component page recomputes everything when the URL
// changes). Returns the same key's value for a short window so tab/filter/toggle
// clicks reuse it. In-memory, per server instance; keyed per user+scope so
// nothing leaks between users. Preserves object identity — unlike JSON-backed
// caches (unstable_cache), so results carrying Date fields stay real Dates.
//
// The key must capture everything the value depends on. Keep TTLs short — this
// is for "snappy repeated clicks," not durable caching.

export type TtlMemo<K, V> = {
  get(key: K, produce: () => Promise<V>): Promise<V>;
  clear(): void;
};

export function createTtlMemo<K, V>(opts: {
  ttlMs: number;
  maxEntries?: number;
  // Injectable clock for deterministic tests.
  now?: () => number;
}): TtlMemo<K, V> {
  const ttl = opts.ttlMs;
  const max = opts.maxEntries ?? 200;
  const clock = opts.now ?? Date.now;
  const store = new Map<K, { at: number; value: V }>();

  return {
    async get(key, produce) {
      const t = clock();
      const hit = store.get(key);
      if (hit && t - hit.at < ttl) return hit.value;
      const value = await produce();
      store.set(key, { at: t, value });
      if (store.size > max) {
        // Evict the oldest entry — tiny maps, linear scan is fine.
        let oldestKey: K | undefined;
        let oldestAt = Infinity;
        for (const [k, v] of store) if (v.at < oldestAt) { oldestAt = v.at; oldestKey = k; }
        if (oldestKey !== undefined) store.delete(oldestKey);
      }
      return value;
    },
    clear() { store.clear(); },
  };
}
