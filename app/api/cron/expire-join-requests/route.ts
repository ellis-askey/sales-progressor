// Daily cron (Fix 8): expire pending agency join requests past their 7-day TTL
// and email the requester. Bearer-CRON_SECRET auth like the other cron routes.

import { NextRequest, NextResponse } from "next/server";
import { expireStaleJoinRequests } from "@/lib/services/agency-join-requests";
import { runJob } from "@/lib/cron/run-job";

export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return runJob("expire-join-requests", async () => {
    const expired = await expireStaleJoinRequests();
    return NextResponse.json({ ok: true, expired });
  });
}
