import { NextRequest, NextResponse } from "next/server";
import { refreshInbox } from "@/lib/command/content/inbox";

// Content inbox refresh (docs/active/content-brand/SPEC.md, Phase 1.3). Pulls
// fresh candidates from the signal engine + topic queue + saved thoughts,
// enriches them, and files them in the inbox. Guarded by CRON_SECRET.
//
// NOTE: not yet registered in vercel.json — the account is on the Vercel Hobby
// plan (daily-cron limit) and the inbox also refreshes on demand from the UI, so
// scheduling is a coordinated follow-up (see docs/active/ELLIS_MANUAL_TODO.md).

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await refreshInbox(new Date());
  return NextResponse.json({ ok: true, ...result });
}
