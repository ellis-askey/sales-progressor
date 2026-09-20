import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getChainRoutes, type LegInput } from "@/lib/services/chain-routes";

// POST /api/chain/routes — driving distance/time + road polyline per postcode
// pair, for the chain map. Body: { legs: { fromPostcode, toPostcode }[] }.
// Auth-gated (any signed-in user); returns only public routing data, no tenant
// data. Degrades to {} when routing is unavailable — the client draws straight
// lines then.
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const legs: LegInput[] = Array.isArray(body?.legs)
    ? body.legs
        .filter((l: unknown): l is LegInput =>
          !!l && typeof (l as LegInput).fromPostcode === "string" && typeof (l as LegInput).toPostcode === "string")
        .slice(0, 40) // a chain never has 40 moves; cap for safety
    : [];
  if (legs.length === 0) return NextResponse.json({ routes: {} });

  const routes = await getChainRoutes(legs);
  return NextResponse.json({ routes });
}
