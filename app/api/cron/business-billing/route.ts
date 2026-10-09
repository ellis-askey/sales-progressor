// Daily cron for progression-business -> TSP billing (C1).
//
// For each business with a card on file: reconcile the Stripe subscription seat
// count and push any accrued £5 per-sale items onto the next invoice. Both are
// idempotent (per-sale is guarded by businessPerSaleInvoicedAt; subscription
// sync reconciles), so a Vercel retry is safe.
//
// Gated by PROGRESSION_BILLING_COLLECT. Until that flag is "true" the cron is a
// no-op even when scheduled — so the schedule can be registered on production
// without taking any money. Also no-ops if Stripe isn't configured.
//
// Schedule: daily at 05:00 UTC (vercel.json).

import { NextRequest, NextResponse } from "next/server";
import { runBusinessBillingCron } from "@/lib/progression/business-stripe";
import { markOverdueBusinessesBlocked } from "@/lib/progression/business-dunning";
import { progressionBillingCollectEnabled } from "@/lib/progression/flags";
import { runJob } from "@/lib/cron/run-job";

export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return runJob("business-billing", async () => {
    if (!progressionBillingCollectEnabled()) {
      return NextResponse.json({ ok: true, skipped: "flag_disabled" });
    }
    try {
      // Dunning: businesses 7+ days past a failed payment move from grace to blocked.
      const { blockedCount } = await markOverdueBusinessesBlocked();
      const result = await runBusinessBillingCron();
      return NextResponse.json({ ok: true, blockedCount, ...result });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Business billing error";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  });
}
