// Stage 2b of the solicitor-confirm feature.
//
// Weekday cron entrypoint for the automated solicitor confirmation pipeline.
// Calls runSolicitorChaseCron, which finds due (file, side) digests (open
// solicitor-owned steps past the grace window, respecting the per-side pause
// flag, expected-date snoozes, repeat interval and chase cap), sends one
// digest per file+side via sendChainEmail, records SolicitorChaseState, then
// runs the escalation pass (notify the assigned agent after the cap).
//
// On/off is the SolicitorChaseSettings admin switch (Settings → Automation):
// off by default, so the scheduled cron is a no-op until the founder turns it
// on. Set EMAIL_SANDBOX_MODE=true to exercise the whole path without delivering.
//
// Schedule: weekdays 09:00 UTC (vercel.json).

import { NextRequest, NextResponse } from "next/server";
import { runSolicitorChaseCron } from "@/lib/solicitor-confirm/chase";
import { runJob } from "@/lib/cron/run-job";

export const maxDuration = 120;

export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // On/off is controlled by the SolicitorChaseSettings row (Settings →
  // Automation), not an env var — runSolicitorChaseCron returns enabled:false
  // and does nothing when the admin switch is off.
  return runJob("solicitor-chase", async () => {
    try {
      const result = await runSolicitorChaseCron(new Date());
      return NextResponse.json({ ok: true, ...result });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Solicitor chase error";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  });
}
