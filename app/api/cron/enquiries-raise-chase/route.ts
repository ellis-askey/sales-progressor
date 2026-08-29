// Weekday cron entrypoint for the "get enquiries raised" chase (enquiries
// rework). Walks every open raise-chase on a live file, nudges the buyer or
// their solicitor on the founder-approved cadence, and escalates to the file
// owner at the 2-week + 3-day ceiling.
//
// Gated by the SolicitorChaseSettings master switch (Settings -> Automation):
// off by default, so the scheduled cron is a no-op until the founder turns it
// on. Shares the switch with the reply-loop enquiries chase.
//
// Schedule: weekdays 09:00 UTC (vercel.json).

import { NextRequest, NextResponse } from "next/server";
import { runRaiseChaseCron } from "@/lib/enquiries/raise-chase";
import { runJob } from "@/lib/cron/run-job";

export const maxDuration = 120;

export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return runJob("enquiries-raise-chase", async () => {
    try {
      const result = await runRaiseChaseCron(new Date());
      return NextResponse.json({ ok: true, ...result });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Raise chase error";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  });
}
