// Nightly self-heal for stranded milestone locks.
//
// A milestone's locked/available status is a cached field, only flipped by
// unlockDirectDependents as a post-completion side effect. If that cascade is ever
// missed (a swallowed failure, a concurrent-write skip, or a completion written
// outside the normal path — seed / back-fill / repair), the dependent step is
// stranded "locked" forever with nothing to recompute it. This walks every active
// file and flips any locked step whose prerequisites are actually satisfied.
// See docs/active/milestone-unlock-selfheal. Idempotent — a no-op when nothing's
// stranded.
//
// Schedule: daily 02:00 UTC (vercel.json).

import { NextRequest, NextResponse } from "next/server";
import { reconcileAllActiveMilestoneStates } from "@/lib/services/milestones";
import { runJob } from "@/lib/cron/run-job";

export const maxDuration = 300;

export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return runJob("reconcile-milestone-states", async () => {
    try {
      const result = await reconcileAllActiveMilestoneStates();
      return NextResponse.json({ ok: true, ...result });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Reconcile error";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  });
}
