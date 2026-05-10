import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { extractPaon, fetchPricePaid, fetchEpc } from "@/lib/services/property-intel";

// ── In-memory cache ───────────────────────────────────────────────────────────
// Module-level Map, TTL 1 hour. Keyed by normalised postcode + paon.

type PropertyIntelResponse = {
  address: { street: string | null; city: string | null; postcode: string };
  lastSold: { price: number; date: string } | null;
  saleHistory: Array<{ year: number; price: number }> | null;
  recentLocalSales: Array<{ address: string; price: number; date: string }> | null;
  epc: { rating: string; score: number | null; validUntil: string | null } | null;
  tenure: { value: "freehold" | "leasehold"; since: number | null } | null;
  councilTaxBand: null;
  marketPulse: null;
};

const cache = new Map<string, { data: PropertyIntelResponse; expiresAt: number }>();
const CACHE_TTL_MS = 60 * 60 * 1000;

function cacheKey(postcode: string, paon: string | null): string {
  return `${postcode.toUpperCase().replace(/\s/g, "")}:${(paon ?? "").toUpperCase()}`;
}

function buildAddressLine(paon?: string, saon?: string, street?: string): string {
  const secondary = saon?.trim();
  const primary = paon?.trim() && street?.trim()
    ? `${paon.trim()} ${street.trim()}`
    : (paon?.trim() || street?.trim() || "");
  return [secondary, primary].filter(Boolean).join(", ");
}

function epcValidUntil(inspectionDate: string): string | null {
  if (!inspectionDate) return null;
  try {
    const d = new Date(inspectionDate);
    if (isNaN(d.getTime())) return null;
    d.setFullYear(d.getFullYear() + 10);
    return d.toISOString().slice(0, 10);
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  let body: { street?: string; city?: string; postcode?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const postcode = (body.postcode ?? "").trim().toUpperCase().replace(/\s+/, " ");
  if (!postcode || !/^[A-Z]{1,2}[0-9][0-9A-Z]?\s*[0-9][A-Z]{2}$/.test(postcode)) {
    return NextResponse.json({ error: "Valid UK postcode required" }, { status: 400 });
  }

  const street = body.street?.trim() || null;
  const city = body.city?.trim() || null;
  const paon = street ? extractPaon(street) : null;

  const key = cacheKey(postcode, paon);
  const hit = cache.get(key);
  if (hit && hit.expiresAt > Date.now()) {
    return NextResponse.json(hit.data);
  }

  const [priceResult, epcResult] = await Promise.allSettled([
    fetchPricePaid(postcode, paon),
    fetchEpc(postcode, paon),
  ]);

  const prices = priceResult.status === "fulfilled" ? priceResult.value : [];
  const epcData = epcResult.status === "fulfilled" ? epcResult.value : null;

  const lastSold = prices.length > 0
    ? { price: prices[0].amount, date: prices[0].date }
    : null;

  const historyPoints = [...prices]
    .reverse()
    .filter((p) => p.amount > 0 && p.date?.length >= 4)
    .map((p) => ({ year: parseInt(p.date.slice(0, 4), 10), price: p.amount }));
  const saleHistory = historyPoints.length >= 2 ? historyPoints : null;

  let tenure: PropertyIntelResponse["tenure"] = null;
  if (prices.length > 0) {
    const et = prices[0].estateType?.toLowerCase().trim();
    if (et === "freehold" || et === "leasehold") {
      const since = prices[0].date?.length >= 4
        ? parseInt(prices[0].date.slice(0, 4), 10)
        : null;
      tenure = { value: et, since };
    }
  }

  const epc: PropertyIntelResponse["epc"] = epcData
    ? { rating: epcData.rating, score: epcData.score, validUntil: epcValidUntil(epcData.inspectionDate) }
    : null;

  const recentLocalSales = prices.length > 0
    ? prices.slice(0, 5).map((e) => ({
        address: buildAddressLine(e.paon, e.saon, e.street),
        price: e.amount,
        date: e.date,
      }))
    : null;

  const data: PropertyIntelResponse = {
    address: { street, city, postcode },
    lastSold,
    saleHistory,
    recentLocalSales,
    epc,
    tenure,
    councilTaxBand: null,
    marketPulse: null,
  };

  cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });

  return NextResponse.json(data);
}
