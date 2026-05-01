import { NextResponse } from "next/server";
import { backfillModeProfiles } from "@/scripts/backfill-mode-profile";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await backfillModeProfiles();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[cron] backfill-mode-profile error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
