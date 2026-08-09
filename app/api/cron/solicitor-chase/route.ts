// Stage 2b of the solicitor-confirm feature.
//
// Weekday cron entrypoint for the automated solicitor confirmation pipeline.
// Calls runSolicitorChaseCron, which finds due (file, side) digests (open
// solicitor-owned steps past the grace window, respecting the per-side pause
// flag, expected-date snoozes, repeat interval and chase cap), sends one
// digest per file+side via sendChainEmail, records SolicitorChaseState, then
// runs the escalation pass (notify the assigned agent after the cap).
//
// Gated by SOLICITOR_CHASE_ENABLED — until it's "true" the cron is a no-op
// even when scheduled, so the schedule can register on prod without
// committing to live sends. Set EMAIL_SANDBOX_MODE=true on staging to
// exercise the whole path without delivering.
//
// Schedule: weekdays 09:00 UTC (vercel.json).

import { NextRequest, NextResponse } from "next/server";
import { runSolicitorChaseCron } from "@/lib/solicitor-confirm/chase";

export const maxDuration = 120;

export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (process.env.SOLICITOR_CHASE_ENABLED !== "true") {
    return NextResponse.json({ ok: true, skipped: "flag_disabled" });
  }

  try {
    const result = await runSolicitorChaseCron(new Date());
    return NextResponse.json({ ok: true, ...result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Solicitor chase error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
