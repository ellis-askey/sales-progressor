// Daily cron — checks for agencies with overdue failed payments and flips
// their newFileCreationBlockedAt flag once the 7-day grace period has
// elapsed since paymentFailedAt was first set.
//
// Idempotent at the DB layer (lib/billing/payment-block.ts uses an
// updateMany with a NULL guard in the WHERE clause). Re-runs after the
// flag is set are no-ops.
//
// Stripe's own retry schedule handles the actual payment retries during
// the grace window. This cron just enforces the hard block when Stripe
// gives up.
//
// Schedule: 0 4 * * * (daily 04:00 UTC, separate from the 03:00 housekeeping).

import { NextRequest, NextResponse } from "next/server";
import { markOverdueAgenciesBlocked } from "@/lib/billing/payment-block";

export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await markOverdueAgenciesBlocked();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[check-failed-payments] failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "unknown" },
      { status: 500 },
    );
  }
}
