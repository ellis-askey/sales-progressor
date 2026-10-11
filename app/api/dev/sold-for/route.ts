// Dev-only endpoint for the /dev/sold-for loading-game prototype ("Sold for…?").
// Given an outcode (postcode district, e.g. EN8), builds a playable deck of real
// registered sales: random full postcodes in the district via postcodes.io, sold
// prices via the existing Land Registry service, floor area + band via the
// existing EPC service, plus a last-sold context line where the same home has a
// prior registered sale. Blocked in production, same convention as
// /api/test-fixtures.
// Prototype seam: in the real SubmissionOverlay the outcode comes from the
// property postcode the agent just entered on the form, this moves behind a
// session-guarded route, and the deck prefetches during the form's last step.
import { NextRequest, NextResponse } from "next/server";
import { fetchPricePaid, fetchEpc, type PricePaidEntry } from "@/lib/services/property-intel";

export type SoldForCard = {
  id: string;
  address: string; // "14 Saville Crescent"
  postcode: string;
  lat: number | null;
  lng: number | null;
  propertyType: string; // "Semi-Detached"
  estateType: string; // "Freehold" / "Leasehold"
  newBuild: boolean;
  soldDate: string; // ISO date of the registered sale
  amount: number; // price paid, GBP
  floorAreaSqm: number | null; // from the EPC certificate, when matched
  epcBand: string | null; // "B" etc., when matched
  lastSold: { date: string; amount: number } | null; // prior sale of the SAME home
};

const OUTCODE_RE = /^[A-Z]{1,2}[0-9][0-9A-Z]?$/;
// Only deal sales from the current market: anything older is irrelevant to the
// guess and alienating for agents who weren't in the business then. Older sales
// of the same home still appear as the "last changed hands" context line.
const RECENCY_MONTHS = 18;
// More draws than before: the recency window thins each postcode's yield, so a
// wider net keeps decks full. All draws resolve in parallel, so wall-clock
// barely moves.
const POSTCODE_DRAWS = 16;
const MAX_CARDS = 14;

function recencyCutoff(): string {
  const d = new Date();
  d.setMonth(d.getMonth() - RECENCY_MONTHS);
  return d.toISOString().slice(0, 10);
}

function titleCase(s: string): string {
  return s
    .toLowerCase()
    .replace(/\b[a-z]/g, (c) => c.toUpperCase())
    .trim();
}

type RandomPostcode = {
  postcode: string;
  latitude: number | null;
  longitude: number | null;
  admin_district: string | null;
};

// One random live postcode inside the outcode, with centroid + district name.
// postcodes.io is free and keyless (already used by lib/geo/geocode.ts).
async function drawRandomPostcode(outcode: string): Promise<RandomPostcode | null> {
  try {
    const res = await fetch(`https://api.postcodes.io/random/postcodes?outcode=${encodeURIComponent(outcode)}`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    const json = await res.json();
    const r = json?.result;
    if (!r?.postcode) return null;
    return {
      postcode: String(r.postcode).toUpperCase(),
      latitude: typeof r.latitude === "number" ? r.latitude : null,
      longitude: typeof r.longitude === "number" ? r.longitude : null,
      admin_district: r.admin_district ?? null,
    };
  } catch {
    return null;
  }
}

function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([p, new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms))]);
}

export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }

  const outcode = (req.nextUrl.searchParams.get("outcode") ?? "").toUpperCase().replace(/\s+/g, "");
  if (!OUTCODE_RE.test(outcode)) {
    return NextResponse.json({ error: "Pass an outcode, e.g. ?outcode=EN8" }, { status: 400 });
  }

  // Draw random postcodes in the district, dedupe (random draws collide often
  // in small districts).
  const draws = (await Promise.all(Array.from({ length: POSTCODE_DRAWS }, () => drawRandomPostcode(outcode))))
    .filter((d): d is RandomPostcode => d !== null);
  const byPostcode = new Map<string, RandomPostcode>();
  for (const d of draws) byPostcode.set(d.postcode, d);
  const postcodes = Array.from(byPostcode.values());
  if (postcodes.length === 0) {
    return NextResponse.json({ outcode, district: null, cards: [] });
  }

  // Sold prices per postcode, in parallel. A slow SPARQL round-trip degrades to
  // an empty set for that postcode rather than stalling the whole deck.
  const priceSets = await Promise.all(
    postcodes.map((p) =>
      withTimeout(fetchPricePaid(p.postcode).catch((): PricePaidEntry[] => []), 9000, [] as PricePaidEntry[]),
    ),
  );

  // One entry per HOME: the newest sale is the playable card; the most recent
  // earlier sale of the same home becomes its last-sold context line (never a
  // separate card, which would spoil the guess).
  type Grouped = { pc: RandomPostcode; newest: PricePaidEntry; prior: PricePaidEntry | null };
  const homes = new Map<string, Grouped>();
  postcodes.forEach((pc, i) => {
    for (const e of priceSets[i]) {
      if (!e.amount || e.amount <= 0 || !e.date) continue;
      const key = `${pc.postcode}|${e.saon ?? ""}|${e.paon ?? ""}|${e.street ?? ""}`;
      const existing = homes.get(key);
      if (!existing) {
        homes.set(key, { pc, newest: e, prior: null });
      } else if (e.date > existing.newest.date) {
        homes.set(key, { pc, newest: e, prior: existing.newest });
      } else if (!existing.prior || e.date > existing.prior.date) {
        existing.prior = e;
      }
    }
  });

  // Recency gate applies to the HEADLINE sale only — an old prior sale is
  // welcome context ("last changed hands 2014 for £180k"), not a card.
  const cutoff = recencyCutoff();
  const grouped = Array.from(homes.values())
    .filter((g) => g.newest.date >= cutoff)
    .sort((a, b) => (a.newest.date < b.newest.date ? 1 : -1))
    .slice(0, MAX_CARDS);

  // EPC enrichment in parallel: floor area + band give the guesser real pricing
  // context. Postcode-level search responses are fetch-cached, so cards sharing
  // a postcode cost one register round-trip. Missing key / no match degrade to
  // nulls and the UI hides the fields.
  const cards: SoldForCard[] = await Promise.all(
    grouped.map(async ({ pc, newest, prior }) => {
      const epc = newest.paon
        ? await withTimeout(fetchEpc(pc.postcode, newest.paon).catch(() => null), 8000, null)
        : null;
      const address = [newest.saon, newest.paon, newest.street ? titleCase(newest.street) : null]
        .filter(Boolean)
        .join(" ")
        .trim();
      return {
        id: `${pc.postcode}|${newest.paon ?? ""}|${newest.saon ?? ""}|${newest.date}`,
        address: address || pc.postcode,
        postcode: pc.postcode,
        lat: pc.latitude,
        lng: pc.longitude,
        propertyType: newest.propertyType ? titleCase(newest.propertyType) : "Property",
        estateType: newest.estateType ? titleCase(newest.estateType) : "",
        newBuild: newest.newBuild,
        soldDate: newest.date,
        amount: newest.amount,
        floorAreaSqm: epc?.floorArea ?? null,
        epcBand: epc?.rating ? epc.rating.toUpperCase() : null,
        lastSold: prior ? { date: prior.date, amount: prior.amount } : null,
      };
    }),
  );

  const district = postcodes.find((p) => p.admin_district)?.admin_district ?? null;
  return NextResponse.json({ outcode, district, cards });
}
