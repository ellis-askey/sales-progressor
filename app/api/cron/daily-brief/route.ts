// Runs at 06:00 UTC (= 06:00 GMT / 07:00 BST in summer).
// Fires after the nightly signal detector run (02:00 UTC) so signals are fresh.

import { NextResponse } from "next/server";
import { runDailyBrief } from "@/lib/services/insight/daily-brief";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runDailyBrief();
  return NextResponse.json({ ok: true, ...result });
}
