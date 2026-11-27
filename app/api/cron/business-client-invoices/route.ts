// Monthly cron — auto-issue + email each opted-in progression business's
// prior-month invoices to its client agencies. Schedule: 0 6 1 * * (06:00 UTC on
// the 1st, after the agency issuance cron at 05:00). Owner-opt-in via
// ProgressionBusiness.invoiceAutoMonthly. Bearer-CRON_SECRET auth.

import { NextRequest, NextResponse } from "next/server";
import { progressionBusinessesEnabled } from "@/lib/progression/flags";
import { runMonthlyClientInvoices } from "@/lib/progression/client-invoice-cron";
import { runJob } from "@/lib/cron/run-job";

export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!progressionBusinessesEnabled()) {
    return NextResponse.json({ ok: true, skipped: "progression businesses disabled" });
  }
  return runJob("business-client-invoices", async () => {
    try {
      const result = await runMonthlyClientInvoices();
      return NextResponse.json({ ok: true, ...result });
    } catch (err) {
      console.error("[business-client-invoices] failed:", err);
      return NextResponse.json({ error: err instanceof Error ? err.message : "unknown" }, { status: 500 });
    }
  });
}
