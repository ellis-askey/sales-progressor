// Daily cron — day-before-completion heads-up to client agencies, for each
// progression business that opted in (ProgressionBusiness.invoiceRemindDayBefore).
// Schedule: 0 7 * * * (07:00 UTC daily). Bearer-CRON_SECRET auth.

import { NextRequest, NextResponse } from "next/server";
import { progressionBusinessesEnabled } from "@/lib/progression/flags";
import { runCompletionReminders } from "@/lib/progression/client-invoice-cron";
import { runJob } from "@/lib/cron/run-job";

export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!progressionBusinessesEnabled()) {
    return NextResponse.json({ ok: true, skipped: "progression businesses disabled" });
  }
  return runJob("invoice-completion-reminders", async () => {
    try {
      const result = await runCompletionReminders();
      return NextResponse.json({ ok: true, ...result });
    } catch (err) {
      console.error("[invoice-completion-reminders] failed:", err);
      return NextResponse.json({ error: err instanceof Error ? err.message : "unknown" }, { status: 500 });
    }
  });
}
