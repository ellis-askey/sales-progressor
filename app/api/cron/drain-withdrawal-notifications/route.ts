import { NextRequest, NextResponse } from "next/server";
import { fireWithdrawalNotifications } from "@/lib/email/chainNotifications";

// Hourly fallback via Vercel Cron (see vercel.json).
// Drains any ChainNotificationQueue records where notifiedAt IS NULL.
// Normally these are sent synchronously on withdrawal; this catches any that failed.
export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await fireWithdrawalNotifications();
    return NextResponse.json({ ok: true, ...result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Drain error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
