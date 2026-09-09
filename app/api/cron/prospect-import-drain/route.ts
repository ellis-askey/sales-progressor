import { NextRequest, NextResponse } from "next/server";
import { runJob } from "@/lib/cron/run-job";
import { drainProcessingBatches } from "@/lib/prospects/import-core";

// Finishes any prospect-import batch left "processing" server-side, so a batch
// completes even if the operator closed the tab (or a request died mid-research).
// It claims pending items atomically, so it is safe to run alongside the tab's
// own loop. Protected by CRON_SECRET. Given research is slow (~1 min/agency),
// this needs a long function budget.
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const secret = req.headers.get("authorization");
  if (secret !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return runJob("prospect-import-drain", async () => {
    // Leave headroom under the 300s function limit for the final DB writes.
    const { batches, processed } = await drainProcessingBatches(240_000);
    return NextResponse.json({ batches, processed });
  });
}
