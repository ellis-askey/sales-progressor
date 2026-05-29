// /api/cron/send-milestone-digests
//
// Runs every 3 minutes (see vercel.json). Drains OutboundEmailQueue rows
// where emailType = "MILESTONE_CONFIRMATION" and scheduledFor <= now and
// sentAt IS NULL. Groups by recipientContactId; N=1 sends the row's
// payload as-is (the locked single-event copy from the FINAL email
// matrix); N>=2 assembles a digest via lib/email/milestone-digest.
//
// The existing /api/cron/drain-outbound-email excludes MILESTONE_CONFIRMATION,
// so the two cron paths don't race.

import { NextRequest, NextResponse } from "next/server";
import { drainMilestoneDigests } from "@/lib/email/milestone-digest-drain";

export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await drainMilestoneDigests();
    return NextResponse.json({ ok: true, ...result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Drain error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
