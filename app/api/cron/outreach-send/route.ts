import { NextRequest, NextResponse } from "next/server";
import { runJob } from "@/lib/cron/run-job";
import { processExperimentSends } from "@/lib/outreach/launch";
import { OUTREACH_SEND_LIMITS } from "@/lib/outreach/send-limits";

// Recurring drip for AI-outreach experiment sends. Without this, a launched
// campaign only ever sends its one initial batch and nothing more. Runs
// frequently through the day; processExperimentSends self-gates to Europe/London
// business hours and the warm-up daily cap, and sends only a few per tick
// (CRON_PER_RUN_CAP) so sends are naturally spaced rather than fired in a burst.
// It also advances and sends due follow-up steps. Protected by CRON_SECRET.
export async function GET(req: NextRequest) {
  const secret = req.headers.get("authorization");
  if (secret !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return runJob("outreach-send", async () => {
    const tally = await processExperimentSends({ perRunCap: OUTREACH_SEND_LIMITS.CRON_PER_RUN_CAP });
    return NextResponse.json(tally);
  });
}
