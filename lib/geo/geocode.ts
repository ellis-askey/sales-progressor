// Client-side postcode → centroid geocoding for the Map feature, via
// postcodes.io (free, no API key). Results — including "not found" (cached as
// null so we don't re-ask) — are kept in localStorage, so a returning user
// geocodes nothing. There is no CSP in the app, so the browser can call
// api.postcodes.io directly; keeping it client-side means zero server load and
// no database. Only ever invoked from the client-only map components.

export type LatLng = { lat: number; lng: number };

const CACHE_KEY = "sp-postcode-geo-v1";

type Cache = Record<string, LatLng | null>;

function loadCache(): Cache {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(CACHE_KEY) || "{}") as Cache;
  } catch {
    return {};
  }
}

function saveCache(c: Cache): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(c));
  } catch {
    /* quota / private mode — geocoding still works, just uncached */
  }
}

// Resolve a set of UK postcodes to centroids. Bulk-POSTs the uncached ones to
// postcodes.io in chunks of 100, caches every answer, and returns a map of the
// ones that resolved. Postcodes that don't resolve are cached as null and
// simply omitted from the result.
export async function geocodePostcodes(postcodes: string[]): Promise<Record<string, LatLng>> {
  const cache = loadCache();
  const unique = Array.from(new Set(postcodes.map((p) => p.toUpperCase()).filter(Boolean)));
  const missing = unique.filter((p) => !(p in cache));

  for (let i = 0; i < missing.length; i += 100) {
    const chunk = missing.slice(i, i + 100);
    try {
      const res = await fetch("https://api.postcodes.io/postcodes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postcodes: chunk }),
      });
      const json = (await res.json()) as {
        result?: { query: string; result: { latitude: number; longitude: number } | null }[];
      };
      for (const row of json.result ?? []) {
        const key = row.query.toUpperCase();
        cache[key] = row.result ? { lat: row.result.latitude, lng: row.result.longitude } : null;
      }
    } catch {
      // Network blip — leave this chunk uncached so it retries next time.
    }
  }

  saveCache(cache);

  const out: Record<string, LatLng> = {};
  for (const p of unique) {
    const v = cache[p];
    if (v) out[p] = v;
  }
  return out;
}
