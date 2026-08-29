// Weekday cron entrypoint for the enquiries chase (enquiries rework, 1.4b).
// Walks every open enquiries tracker, sends the 9-working-day nudge to whoever
// holds the ball, and escalates to a task after 3 weeks of silence.
//
// Gated by the SolicitorChaseSettings master switch (Settings -> Automation):
// off by default, so the scheduled cron is a no-op until the founder turns it
// on. Set EMAIL_SANDBOX_MODE=true to exercise the path without delivering.
//
// Schedule: weekdays 09:00 UTC (vercel.json).

import { NextRequest, NextResponse } from "next/server";
import { runEnquiryChaseCron } from "@/lib/enquiries/chase";
import { runJob } from "@/lib/cron/run-job";

export const maxDuration = 120;

export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return runJob("enquiries-chase", async () => {
    try {
      const result = await runEnquiryChaseCron(new Date());
      return NextResponse.json({ ok: true, ...result });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Enquiry chase error";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  });
}
