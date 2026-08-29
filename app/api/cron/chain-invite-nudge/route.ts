// app/api/cron/chain-invite-nudge/route.ts
//
// Sends the one-time reminder to chain invites that were delivered but never
// opened (see lib/chain/invite-nudge.ts). Runs once each weekday morning; the
// eligibility rules (3-day wait, not-viewed, not-terminal, one-nudge cap) live in
// the service, so re-running is safe. Auth via CRON_SECRET.

import { NextRequest, NextResponse } from "next/server";
import { sendDueChainInviteNudges } from "@/lib/chain/invite-nudge";
import { runJob } from "@/lib/cron/run-job";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return runJob("chain-invite-nudge", async () => {
    const result = await sendDueChainInviteNudges(new Date());
    return NextResponse.json({ ok: true, ...result });
  });
}
