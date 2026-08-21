// app/api/cron/exchange-day-emails/route.ts
//
// Sends the exchange-day solicitor emails (08:45 / 12:30 / 15:30 UK) for any
// file actively in exchange day. Idempotent + slot-guarded, so running it
// frequently is safe — each slot fires once, at/just after its time. Runs
// every 15 minutes across the working day; the per-slot logic (in
// lib/exchange-day/send.ts) decides what actually goes. Auth via CRON_SECRET.
// See docs/active/exchange-day-SPEC.md.

import { NextRequest, NextResponse } from "next/server";
import { sendDueExchangeDayEmails } from "@/lib/exchange-day/send";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await sendDueExchangeDayEmails(new Date());
  return NextResponse.json({ ok: true, ...result });
}
