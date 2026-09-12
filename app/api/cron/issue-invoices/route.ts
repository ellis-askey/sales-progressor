// Monthly cron — flips prior-month building invoices to issued + creates
// Stripe invoices for them, triggering automatic collection via each
// customer's default payment method.
//
// Schedule: 0 5 1 * * (05:00 UTC on the 1st of each month — gives the
// accrual cron at 03:00 UTC time to write any final billedAtExchange rows
// from late-night exchanges on the last day of the prior month).
//
// Bearer-CRON_SECRET auth as with the other cron routes.

import { NextRequest, NextResponse } from "next/server";
import { issuePriorMonthInvoices } from "@/lib/billing/issuance";
import { runJob } from "@/lib/cron/run-job";

export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // Automated Stripe billing is OFF by default (2026-09-12). Billing is being
  // done manually for now, so this cron must not charge anyone. The issuance
  // logic — including the P0-2 idempotency + per-invoice-isolation fix — stays
  // in place and ready; it only runs when BILLING_AUTO_ISSUE_ENABLED === "true"
  // is set in the environment. This is the single charge trigger (accrual just
  // builds draft invoice rows; it never charges), so gating it here is enough to
  // stop all automated collection.
  if (process.env.BILLING_AUTO_ISSUE_ENABLED !== "true") {
    return NextResponse.json({ ok: true, skipped: "auto-issue disabled (manual billing)" });
  }
  return runJob("issue-invoices", async () => {
    try {
      const result = await issuePriorMonthInvoices();
      return NextResponse.json({ ok: true, ...result });
    } catch (err) {
      console.error("[issue-invoices] failed:", err);
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "unknown" },
        { status: 500 },
      );
    }
  });
}
