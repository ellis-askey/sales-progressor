// Pure data-shaping for the All Files → Map view. Turns raw file rows into
// map data (a status + a postcode + a date each), and groups them by postcode
// district (outcode) into the "patches" that drive the leaderboard and the
// heat bubbles. No geo here — that's layered on client-side by the map
// component after geocoding (lib/geo/geocode.ts). Client-safe (no server deps).

import { extractPostcode, outcodeOf, districtOf } from "@/lib/geo/postcode";

export type MapStatus = "agreed" | "completed" | "withdrawn";

export type MapFile = {
  id: string;
  address: string;
  postcode: string | null;
  outcode: string | null;
  status: MapStatus;
  feePence: number;
  district: string | null;
  // For the time filter: completion date for completed sales, else the
  // expected exchange, else when the file was created. Epoch ms, or null.
  dateMs: number | null;
};

export type MapFileInput = {
  id: string;
  propertyAddress: string;
  status: string;
  feePence: number;
  completionDate?: Date | string | null;
  expectedExchangeDate?: Date | string | null;
  createdAt?: Date | string | null;
};

// A live file (active / on_hold) is a sale "agreed"; completed is a sale done;
// withdrawn fell through. We keep withdrawn out of totals but can still plot it.
function toStatus(raw: string): MapStatus {
  if (raw === "completed") return "completed";
  if (raw === "withdrawn") return "withdrawn";
  return "agreed";
}

export function toMapFile(r: MapFileInput): MapFile {
  const postcode = extractPostcode(r.propertyAddress);
  const status = toStatus(r.status);
  const dateRaw = status === "completed" ? (r.completionDate ?? r.createdAt) : (r.expectedExchangeDate ?? r.createdAt);
  const dateMs = dateRaw ? new Date(dateRaw).getTime() : null;
  return {
    id: r.id,
    address: r.propertyAddress,
    postcode,
    outcode: postcode ? outcodeOf(postcode) : null,
    status,
    feePence: r.feePence,
    district: districtOf(r.propertyAddress),
    dateMs,
  };
}

export type PatchOutcode = {
  outcode: string;
  label: string; // "Redland · BS6" when a district is known, else the outcode
  agreed: number;
  completed: number;
  withdrawn: number;
  total: number; // agreed + completed (the sales that count)
  feePence: number;
  files: MapFile[];
  // Phase 3 — filled in from Land Registry once fetched.
  marketSold?: number | null; // registered sales in this outcode over the period
  sharePct?: number | null; // completed / marketSold, 0..100
};

// The most common district name among a patch's files, for a friendly label.
function modalDistrict(files: MapFile[]): string | null {
  const counts = new Map<string, number>();
  for (const f of files) if (f.district) counts.set(f.district, (counts.get(f.district) ?? 0) + 1);
  let best: string | null = null;
  let bestN = 0;
  for (const [d, n] of counts) if (n > bestN) { best = d; bestN = n; }
  return best;
}

// Group map files by outcode into patches, ranked by total sales (agreed +
// completed) descending. Withdrawn files attach to their patch but don't count
// toward totals or fees.
export function groupByOutcode(files: MapFile[]): PatchOutcode[] {
  const m = new Map<string, PatchOutcode>();
  for (const f of files) {
    if (!f.outcode) continue;
    let g = m.get(f.outcode);
    if (!g) {
      g = { outcode: f.outcode, label: f.outcode, agreed: 0, completed: 0, withdrawn: 0, total: 0, feePence: 0, files: [] };
      m.set(f.outcode, g);
    }
    g.files.push(f);
    if (f.status === "agreed") g.agreed++;
    else if (f.status === "completed") g.completed++;
    else g.withdrawn++;
    if (f.status !== "withdrawn") {
      g.total++;
      g.feePence += f.feePence;
    }
  }
  for (const g of m.values()) {
    const d = modalDistrict(g.files);
    g.label = d ? `${d} · ${g.outcode}` : g.outcode;
  }
  return [...m.values()].sort((a, b) => b.total - a.total);
}
