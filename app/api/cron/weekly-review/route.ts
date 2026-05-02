// Runs at 07:00 UTC Monday (= 07:00 GMT / 08:00 BST).

import { NextResponse } from "next/server";
import { runWeeklyReview } from "@/lib/services/insight/weekly-review";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runWeeklyReview();
  return NextResponse.json({ ok: true, ...result });
}
