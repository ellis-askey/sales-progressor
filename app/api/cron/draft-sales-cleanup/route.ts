// Daily cron: permanently delete draft sales left untouched for 30 days (Ellis
// critique). Bearer-CRON_SECRET auth like the other cron routes.

import { NextRequest, NextResponse } from "next/server";
import { deleteStaleDraftSales } from "@/lib/services/draft-sales-cleanup";
import { runJob } from "@/lib/cron/run-job";

export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return runJob("draft-sales-cleanup", async () => {
    const deleted = await deleteStaleDraftSales();
    return NextResponse.json({ ok: true, deleted });
  });
}
