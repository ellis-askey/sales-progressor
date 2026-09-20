import "server-only";

// Driving routes between chain properties for the Map view. Given postcode
// pairs, returns distance (m), duration (s) and the road polyline for each —
// from the PostcodeRoute cache first, else geocoded server-side (postcodes.io)
// and routed via OpenRouteService (free tier), then cached. No key / no route =
// omitted, and the client falls back to a straight line. postcodes.io + ORS are
// unblocked server-side (no CSP, no cost for the Directions free tier).

import { prisma } from "@/lib/prisma";
import { extractPostcode } from "@/lib/geo/postcode";

type LatLng = { lat: number; lng: number };
export type LegInput = { fromPostcode: string; toPostcode: string };
export type RouteResult = { distanceMeters: number; durationSeconds: number; geometry: number[][]; viaRoads: string[] };

export const routeKey = (a: string, b: string) => `${a}__${b}`;

// The major roads a route travels ("Via A41, A418"), from the route steps. We
// keep classified roads (M/A/B + number) — the useful "via" markers — and rank
// them by distance travelled, dropping residential street noise. Falls back to
// the longest-distance named steps if the route has no classified roads.
function extractViaRoads(segments: { steps?: { name?: string; distance?: number }[] }[] | undefined): string[] {
  if (!segments) return [];
  const byRoad = new Map<string, number>();
  for (const seg of segments) {
    for (const st of seg.steps ?? []) {
      const name = (st.name ?? "").trim();
      if (!name || name === "-") continue;
      byRoad.set(name, (byRoad.get(name) ?? 0) + (st.distance ?? 0));
    }
  }
  const all = [...byRoad.entries()];
  const classified = all.filter(([n]) => /\b[AMB]\d/i.test(n));
  return (classified.length ? classified : all).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([n]) => n);
}

async function geocode(postcodes: string[]): Promise<Record<string, LatLng>> {
  const unique = Array.from(new Set(postcodes.map((p) => p.toUpperCase()).filter(Boolean)));
  const out: Record<string, LatLng> = {};
  for (let i = 0; i < unique.length; i += 100) {
    const chunk = unique.slice(i, i + 100);
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
        if (row.result) out[row.query.toUpperCase()] = { lat: row.result.latitude, lng: row.result.longitude };
      }
    } catch { /* leave uncached */ }
  }
  return out;
}

async function fetchORS(o: LatLng, d: LatLng): Promise<RouteResult | null> {
  const apiKey = process.env.ORS_API_KEY;
  if (!apiKey) return null;
  try {
    const url = `https://api.openrouteservice.org/v2/directions/driving-car?api_key=${apiKey}&start=${o.lng},${o.lat}&end=${d.lng},${d.lat}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = (await res.json()) as {
      features?: {
        geometry?: { coordinates?: number[][] };
        properties?: {
          summary?: { distance?: number; duration?: number };
          segments?: { steps?: { name?: string; distance?: number }[] }[];
        };
      }[];
    };
    const feat = json.features?.[0];
    const dist = feat?.properties?.summary?.distance;
    const dur = feat?.properties?.summary?.duration;
    const geom = feat?.geometry?.coordinates;
    if (dist == null || dur == null || !geom || geom.length === 0) return null;
    return {
      distanceMeters: Math.round(dist),
      durationSeconds: Math.round(dur),
      geometry: geom,
      viaRoads: extractViaRoads(feat?.properties?.segments),
    };
  } catch {
    return null;
  }
}

export async function getChainRoutes(legs: LegInput[]): Promise<Record<string, RouteResult>> {
  const out: Record<string, RouteResult> = {};
  const norm = legs
    .map((l) => ({
      from: (extractPostcode(l.fromPostcode) ?? l.fromPostcode ?? "").toUpperCase(),
      to: (extractPostcode(l.toPostcode) ?? l.toPostcode ?? "").toUpperCase(),
    }))
    .filter((l) => l.from && l.to && l.from !== l.to);
  const seen = new Set<string>();
  const uniq = norm.filter((l) => { const k = routeKey(l.from, l.to); if (seen.has(k)) return false; seen.add(k); return true; });
  if (uniq.length === 0) return out;

  const cached = await prisma.postcodeRoute
    .findMany({ where: { OR: uniq.map((l) => ({ originPostcode: l.from, destPostcode: l.to })) } })
    .catch(() => [] as { originPostcode: string; destPostcode: string; distanceMeters: number; durationSeconds: number; geometry: unknown; viaRoads: unknown }[]);
  const cachedMap = new Map(cached.map((c) => [routeKey(c.originPostcode, c.destPostcode), c]));

  const misses: typeof uniq = [];
  for (const l of uniq) {
    const c = cachedMap.get(routeKey(l.from, l.to));
    // A row cached before road names existed has viaRoads == null → treat as a
    // miss so it re-fetches once and backfills. An empty array is a real hit.
    if (c && c.viaRoads != null) {
      out[routeKey(l.from, l.to)] = {
        distanceMeters: c.distanceMeters, durationSeconds: c.durationSeconds,
        geometry: c.geometry as number[][], viaRoads: c.viaRoads as string[],
      };
    } else {
      misses.push(l);
    }
  }
  if (misses.length === 0) return out;

  const geo = await geocode(Array.from(new Set(misses.flatMap((l) => [l.from, l.to]))));
  for (const l of misses) {
    const o = geo[l.from], d = geo[l.to];
    if (!o || !d) continue;
    const r = await fetchORS(o, d);
    if (!r) continue;
    out[routeKey(l.from, l.to)] = r;
    // Upsert (not create) — a null-viaRoads row may already exist from before.
    await prisma.postcodeRoute
      .upsert({
        where: { originPostcode_destPostcode: { originPostcode: l.from, destPostcode: l.to } },
        create: { originPostcode: l.from, destPostcode: l.to, distanceMeters: r.distanceMeters, durationSeconds: r.durationSeconds, geometry: r.geometry, viaRoads: r.viaRoads },
        update: { distanceMeters: r.distanceMeters, durationSeconds: r.durationSeconds, geometry: r.geometry, viaRoads: r.viaRoads },
      })
      .catch(() => {});
  }
  return out;
}
