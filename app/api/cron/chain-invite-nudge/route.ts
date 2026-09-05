// app/api/cron/chain-invite-nudge/route.ts
//
// Sends the one-time reminder to chain invites that were delivered but never
// opened (see lib/chain/invite-nudge.ts). Runs once each weekday morning; the
// eligibility rules (3-day wait, not-viewed, not-terminal, one-nudge cap) live in
// the service, so re-running is safe. Auth via CRON_SECRET.

import { NextRequest, NextResponse } from "next/server";
import { sendDueChainInviteNudges } from "@/lib/chain/invite-nudge";
import { sendDueChainReminders } from "@/lib/chain/invite-reminder";
import { runJob } from "@/lib/cron/run-job";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return runJob("chain-invite-nudge", async () => {
    const now = new Date();
    // Two one-time follow-ups share this pass: the 3-day nudge (never-opened) and
    // the 14-day "still moving" reminder (anyone still not joined). Each has its
    // own stamp, so they can't overlap or repeat.
    const nudge = await sendDueChainInviteNudges(now);
    const reminder = await sendDueChainReminders(now).catch((err) => {
      console.error("[chain-invite-nudge] reminder pass failed:", err);
      return { candidates: 0, sent: 0 };
    });
    return NextResponse.json({ ok: true, nudge, reminder });
  });
}
