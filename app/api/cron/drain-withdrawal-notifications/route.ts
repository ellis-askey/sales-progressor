import { NextRequest, NextResponse } from "next/server";
import { fireChainCascadeNotifications, sendChainWaitNudges } from "@/lib/email/chainNotifications";
import { runJob } from "@/lib/cron/run-job";

// Daily fallback drain via Vercel Cron (see vercel.json: 0 9 * * 1-6).
// Two passes:
//   1. fireChainCascadeNotifications — drains any ChainNotificationQueue rows
//      where emailSentAt IS NULL (normally these go out synchronously during
//      cascadeChainWithdrawal / cascadeChainRemarketing; this catches any that
//      failed).
//   2. sendChainWaitNudges — sends a one-time nudge email to agents who
//      responded WAITING 14+ days ago and haven't been nudged yet, then sets
//      nudgeSentAt so they aren't nudged again.
export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return runJob("drain-withdrawal-notifications", async () => {
    try {
      const cascade = await fireChainCascadeNotifications();
      const nudges = await sendChainWaitNudges();
      return NextResponse.json({ ok: true, cascade, nudges });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Drain error";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  });
}
