// B7 of the client-chase arc (Sub-arc B).
//
// Daily cron entrypoint for the automated client chase pipeline. Calls
// runClientChaseCron, which finds due (transaction, contact, milestone)
// tuples, enqueues one digest per contact via B4's enqueueClientChaseDigest,
// then runs the escalation pass (chase-count cap / 14-day silence).
//
// Gated by CLIENT_CHASE_ENABLED env var. Until that flag is "true", the
// cron is a no-op even when scheduled — letting us register the schedule
// safely on production without committing to live behaviour.
//
// Schedule: daily at 09:00 UTC (vercel.json). Vercel Hobby plan only
// allows daily granularity; that's plenty for chase emails (intra-day
// changes don't need same-day chase reflexes).
//
// drainOutboundQueue (separate hourly cron) handles the actual send —
// this cron only enqueues. That separation means the digest goes into
// the OutboundEmailQueue with the sourceId dedup guard, so a cron retry
// (Vercel retries 5xx responses) is safe: the second enqueue is a no-op.

import { NextRequest, NextResponse } from "next/server";
import { runClientChaseCron } from "@/lib/services/client-chase-cron";
import { runJob } from "@/lib/cron/run-job";

export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return runJob("client-chase", async () => {
    if (process.env.CLIENT_CHASE_ENABLED !== "true") {
      return NextResponse.json({ ok: true, skipped: "flag_disabled" });
    }

    try {
      const result = await runClientChaseCron(new Date());
      return NextResponse.json({ ok: true, ...result });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Client chase error";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  });
}
