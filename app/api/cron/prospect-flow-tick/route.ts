import { NextRequest, NextResponse } from "next/server";
import { runJob } from "@/lib/cron/run-job";
import { queueDueSteps } from "@/lib/prospects/flow-ops";

// Runs 07:15 weekdays via Vercel Cron (see vercel.json), just before the prospect
// follow-up digest at 07:30. Protected by CRON_SECRET.
//
// The flow "tick": queues every outreach-flow step that has fallen due, drafting
// it and moving it to "ready to approve". It does NOT send anything — outreach
// stays approval-gated. The follow-up digest that runs 15 minutes later then
// nudges Ellis about the steps waiting for approval.
export async function GET(req: NextRequest) {
  const secret = req.headers.get("authorization");
  if (secret !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return runJob("prospect-flow-tick", async () => {
    const queued = await queueDueSteps();
    return NextResponse.json({ queued });
  });
}
