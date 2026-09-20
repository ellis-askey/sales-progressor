// lib/services/property-enrichment.ts
//
// "TSP already knows this property." Orchestrates the external facts we can
// confidently obtain for a property address into one payload for the Property
// Information (passport) card. Everything here is free/official:
//   - EPC (GOV.UK EPC Register)            → energy + property basics + UPRN
//   - Sold prices (HM Land Registry)       → sold history
//   - postcodes.io                         → coordinates + local authority
//   - planning.data.gov.uk (MHCLG)         → conservation area / Article 4 / listed
//
// Design rules baked in:
//   - Failure is invisible: every source is fetched independently
//     (Promise.allSettled) and degrades on its own. Nothing here can block or
//     break the Overview tab.
//   - Accuracy over completeness: designations are point-in-polygon from
//     official data with partial national coverage, so a miss is reported as
//     "none found in available data", never a definitive "No".
//   - Source-specific caching via the data cache (revalidate seconds): historic
//     data long, live-ish data shorter. Natural invalidation — the cache key is
//     the URL (postcode / coordinates), so a changed address refetches.
//   - Extension points: councilTax / connectivity / flood / planningApplications
//     are shaped now (link-outs, or parked) so a future real integration fills
//     the same slot without an architectural rewrite.

import { unstable_cache } from "next/cache";
import {
  extractPostcode,
  extractPaon,
  fetchPricePaid,
  fetchEpcStatus,
  buildLandRegUrl,
  type EpcData,
  type PricePaidEntry,
} from "@/lib/services/property-intel";

// Source-specific TTLs (seconds).
const TTL = {
  geo: 60 * 60 * 24 * 30, // 30d — postcode centroids barely move
  planning: 60 * 60 * 24 * 30, // 30d — designations change slowly
  // EPC + sold keep their own 24h TTL inside property-intel.ts.
} as const;

export type Designation = { found: boolean; label?: string; reference?: string; grade?: string };
export type SourceRef = { label: string; url?: string };

export type PropertyEnrichment = {
  postcode: string | null;
  address: string;
  identity: {
    uprn: string | null;
    lat: number | null;
    lng: number | null;
    localAuthority: string | null;
  };
  epc: { status: "ok" | "none" | "error" | "unconfigured"; data: EpcData | null };
  sold: { status: "ok" | "none" | "error"; entries: PricePaidEntry[] };
  planning: {
    status: "ok" | "error" | "no-coords";
    conservationArea: Designation;
    article4: Designation;
    listedBuilding: Designation;
    coverageNote: string;
  };
  // ── Reserved extension points ─────────────────────────────────────────────
  // Secondary link-outs today; each slot can later carry real values without a
  // schema/shape rewrite (e.g. councilTax.band, flood.riskBand, connectivity.*).
  councilTax: { status: "link"; link: SourceRef };
  connectivity: { status: "parked" }; // deliberately no UI until a proper API lands
  flood: { status: "link"; link: SourceRef };
  planningApplications: { status: "link"; link: SourceRef | null };
  worthKnowing: string[];
  sources: SourceRef[];
};

const COVERAGE_NOTE =
  "From published local-authority planning data, which is still being completed nationally. A blank here doesn't guarantee no designation.";

// ── postcodes.io: coordinates + local authority (free, keyless) ──────────────
type Geo = { lat: number; lng: number; localAuthority: string | null; localAuthorityCode: string | null } | null;
async function geocode(postcode: string): Promise<Geo> {
  try {
    const res = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(postcode.replace(/\s+/g, ""))}`, {
      next: { revalidate: TTL.geo },
    });
    if (!res.ok) return null;
    const j = await res.json();
    const r = j?.result;
    if (!r || r.latitude == null || r.longitude == null) return null;
    return {
      lat: r.latitude,
      lng: r.longitude,
      localAuthority: r.admin_district ?? null,
      localAuthorityCode: r.codes?.admin_district ?? null,
    };
  } catch {
    return null;
  }
}

// ── planning.data.gov.uk: designations at the point (free, keyless) ──────────
type PlanningResult =
  | { status: "ok"; conservationArea: Designation; article4: Designation; listedBuilding: Designation }
  | { status: "error" };

async function fetchPlanning(lat: number, lng: number): Promise<PlanningResult> {
  try {
    const datasets = ["conservation-area", "article-4-direction-area", "listed-building"];
    const qs = datasets.map((d) => `dataset=${d}`).join("&");
    const url = `https://www.planning.data.gov.uk/entity.json?latitude=${lat}&longitude=${lng}&${qs}&limit=100`;
    const res = await fetch(url, { next: { revalidate: TTL.planning } });
    if (!res.ok) return { status: "error" };
    const j = await res.json();
    const entities: Record<string, string>[] = Array.isArray(j?.entities) ? j.entities : [];
    const pick = (ds: string): Designation => {
      const hit = entities.find((e) => e.dataset === ds);
      if (!hit) return { found: false };
      return {
        found: true,
        label: hit.name || undefined,
        reference: hit.reference || undefined,
        grade: hit["listed-building-grade"] || undefined,
      };
    };
    return {
      status: "ok",
      conservationArea: pick("conservation-area"),
      article4: pick("article-4-direction-area"),
      listedBuilding: pick("listed-building"),
    };
  } catch {
    return { status: "error" };
  }
}

// ── Worth knowing: only genuinely noteworthy, never alarmist ─────────────────
function computeWorthKnowing(p: {
  planning: PropertyEnrichment["planning"];
  epc: PropertyEnrichment["epc"];
}): string[] {
  const out: string[] = [];
  const { conservationArea, article4, listedBuilding } = p.planning;
  if (listedBuilding.found) {
    out.push(
      listedBuilding.grade
        ? `This property is recorded as a listed building (Grade ${listedBuilding.grade}).`
        : "This property is recorded as a listed building.",
    );
  }
  if (conservationArea.found) {
    out.push(
      conservationArea.label
        ? `This property appears to be within the ${conservationArea.label} conservation area.`
        : "This property appears to be within a conservation area.",
    );
  }
  if (article4.found) {
    out.push("An Article 4 direction applies here, so some permitted development rights may be restricted.");
  }
  // EPC expiry — only when it's soon or already lapsed.
  if (p.epc.status === "ok" && p.epc.data?.validUntil) {
    const until = new Date(p.epc.data.validUntil);
    const months = Math.round((until.getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 30.44));
    if (months < 0) out.push("The EPC has expired.");
    else if (months <= 6) out.push(`The EPC expires in ${months <= 1 ? "under a month" : `${months} months`}.`);
  }
  return out.slice(0, 3);
}

// Official secondary link-outs (used until/if a real property-level integration
// is approved for each). Kept official + honest — never a fabricated value.
function councilTaxLink(postcode: string): SourceRef {
  return { label: "Check council tax band", url: `https://www.tax.service.gov.uk/check-council-tax-band/search?postcode=${encodeURIComponent(postcode)}` };
}
function floodLink(): SourceRef {
  return { label: "Check long-term flood risk", url: "https://www.gov.uk/check-long-term-flood-risk" };
}
function nearbyPlanningLink(lat: number, lng: number): SourceRef {
  return { label: "View nearby planning", url: `https://www.planning.data.gov.uk/map/#16/${lat}/${lng}/0` };
}

export async function getPropertyEnrichment(address: string): Promise<PropertyEnrichment> {
  const postcode = extractPostcode(address);
  const paon = extractPaon(address);
  const epcConfigured = !!process.env.EPC_API_KEY;

  // Base payload — everything defaults to a safe, empty, non-error state so a
  // missing postcode (or any failed source) still returns a usable object.
  const out: PropertyEnrichment = {
    postcode,
    address,
    identity: { uprn: null, lat: null, lng: null, localAuthority: null },
    epc: { status: epcConfigured ? "none" : "unconfigured", data: null },
    sold: { status: "none", entries: [] },
    planning: {
      status: "no-coords",
      conservationArea: { found: false },
      article4: { found: false },
      listedBuilding: { found: false },
      coverageNote: COVERAGE_NOTE,
    },
    councilTax: { status: "link", link: { label: "Check council tax band", url: "https://www.gov.uk/council-tax-bands" } },
    connectivity: { status: "parked" },
    flood: { status: "link", link: floodLink() },
    planningApplications: { status: "link", link: null },
    worthKnowing: [],
    sources: [],
  };

  if (!postcode) return out;
  out.councilTax.link = councilTaxLink(postcode);

  // Wave 1: EPC + sold + geocode, all independent.
  const [epcR, soldR, geoR] = await Promise.allSettled([
    fetchEpcStatus(postcode, paon),
    fetchPricePaid(postcode, paon),
    geocode(postcode),
  ]);

  // EPC
  if (epcR.status === "fulfilled") {
    if (epcR.value.status === "error") out.epc = { status: "error", data: null };
    else out.epc = { status: epcR.value.data ? "ok" : out.epc.status, data: epcR.value.data };
  } else {
    out.epc = { status: "error", data: null };
  }
  if (out.epc.data?.uprn) out.identity.uprn = out.epc.data.uprn;
  if (out.epc.data?.localAuthority) out.identity.localAuthority = out.epc.data.localAuthority;

  // Sold
  if (soldR.status === "fulfilled") out.sold = { status: soldR.value.length ? "ok" : "none", entries: soldR.value };
  else out.sold = { status: "error", entries: [] };

  // Geocode
  const geo = geoR.status === "fulfilled" ? geoR.value : null;
  if (geo) {
    out.identity.lat = geo.lat;
    out.identity.lng = geo.lng;
    if (!out.identity.localAuthority && geo.localAuthority) out.identity.localAuthority = geo.localAuthority;
    out.planningApplications.link = nearbyPlanningLink(geo.lat, geo.lng);
  }

  // Wave 2: planning designations (needs coordinates).
  if (geo) {
    const pl = await fetchPlanning(geo.lat, geo.lng).catch(() => ({ status: "error" as const }));
    if (pl.status === "ok") {
      out.planning = {
        status: "ok",
        conservationArea: pl.conservationArea,
        article4: pl.article4,
        listedBuilding: pl.listedBuilding,
        coverageNote: COVERAGE_NOTE,
      };
    } else {
      out.planning.status = "error";
    }
  }

  // Worth knowing + source attributions (only for sources that produced data).
  out.worthKnowing = computeWorthKnowing({ planning: out.planning, epc: out.epc });

  const sources: SourceRef[] = [];
  if (out.epc.status === "ok") sources.push({ label: "GOV.UK EPC Register", url: "https://www.gov.uk/find-energy-certificate" });
  if (out.sold.status === "ok") sources.push({ label: "HM Land Registry", url: buildLandRegUrl(postcode) });
  if (out.planning.status === "ok") sources.push({ label: "planning.data.gov.uk", url: "https://www.planning.data.gov.uk/" });
  if (out.identity.lat != null) sources.push({ label: "postcodes.io" });
  out.sources = sources;

  return out;
}

// Perceived-performance (Layer 3): cache the whole enrichment per address for a
// day. Every source inside is external and slow-changing (EPC, sold prices,
// planning designations), and PropertyEnrichment is plain JSON — no Prisma Date
// or Decimal — so it survives the cache's serialization cleanly. This turns the
// Property Information card's slowest work into a single cache hit on re-open,
// shared across everyone who views the same property. Bump the key suffix to
// invalidate the whole cache after a shape or source change.
export const getPropertyEnrichmentCached = unstable_cache(
  (address: string) => getPropertyEnrichment(address),
  ["property-enrichment-v1"],
  { revalidate: 60 * 60 * 24 },
);
