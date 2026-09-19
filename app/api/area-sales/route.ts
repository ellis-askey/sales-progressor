import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { fetchAreaSales } from "@/lib/services/property-intel";

// Market size per postcode district for the All Files → Map view. Given a set
// of outcodes, returns the count of registered (completed) sales in each over
// the period, from Land Registry. Each lookup is cached 24h at the fetch layer
// (fetchAreaSales), so repeat loads are cheap. Session-guarded (internal use);
// the data itself is public Land Registry data.
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const outcodes = (req.nextUrl.searchParams.get("outcodes") ?? "")
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean)
    .slice(0, 30); // bound the fan-out
  const months = Math.min(60, Math.max(1, parseInt(req.nextUrl.searchParams.get("months") ?? "12", 10) || 12));

  const entries = await Promise.all(
    outcodes.map(async (oc) => [oc, await fetchAreaSales(oc, months).catch(() => null)] as const),
  );
  const sales: Record<string, number | null> = {};
  for (const [oc, n] of entries) sales[oc] = n;

  return NextResponse.json({ months, sales });
}
