// Pre-warm the HM Land Registry market-size cache for the All Files → Map view.
//
// The map's "your share of this district" bars need a registered-sale count per
// postcode district, from a Land Registry SPARQL endpoint that takes ~30s per
// outcode. Fetching on page load left the bars blank. This walks the outcodes
// of every live file and refreshes the stalest counts into AreaSalesCount, so
// the map reads them instantly (getAreaSalesCached). Bounded per run so a slow
// endpoint can't blow the function timeout; whatever's over the bound is picked
// up next run (logged, never silently dropped).
//
// Schedule: daily 01:00 UTC (vercel.json).

import { NextRequest, NextResponse } from "next/server";
import { runJob } from "@/lib/cron/run-job";
import { prisma } from "@/lib/prisma";
import { extractPostcode } from "@/lib/services/property-intel";
import { outcodeOf } from "@/lib/geo/postcode";
import { warmAreaSales } from "@/lib/services/area-sales";

export const maxDuration = 300;

// The only periods the map ever requests (the 12m/All lenses both query 12).
const PERIODS = [12, 24];

export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return runJob("area-sales-warm", async () => {
    // Districts the map could plot: every non-withdrawn file with an address.
    const files = await prisma.propertyTransaction.findMany({
      where: { status: { not: "withdrawn" } },
      select: { propertyAddress: true },
    });
    const outcodes = Array.from(
      new Set(
        files
          .map((f) => {
            const pc = extractPostcode(f.propertyAddress);
            return pc ? outcodeOf(pc) : null;
          })
          .filter((o): o is string => !!o),
      ),
    );

    const result = await warmAreaSales(outcodes, PERIODS, { limit: 40, concurrency: 5 });
    if (result.skipped > 0) {
      console.log(
        `[area-sales-warm] ${result.skipped} pairs over the per-run limit — picked up next run`,
      );
    }
    return NextResponse.json({ ok: true, outcodes: outcodes.length, ...result });
  });
}
