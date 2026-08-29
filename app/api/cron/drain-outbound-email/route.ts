import { NextRequest, NextResponse } from "next/server";
import { drainOutboundQueue } from "@/lib/email/outboundQueue";
import { runJob } from "@/lib/cron/run-job";

// Runs every hour via Vercel Cron (see vercel.json).
// Sends OutboundEmailQueue records where scheduledFor <= now and sentAt IS NULL.
// Capped at 50 records per run to prevent runaway sends.
export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return runJob("drain-outbound-email", async () => {
    try {
      const result = await drainOutboundQueue();
      return NextResponse.json({ ok: true, ...result });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Drain error";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  });
}
