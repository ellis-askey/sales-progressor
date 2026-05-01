import { NextRequest, NextResponse } from "next/server";
import { runRetentionEmailSweep } from "@/lib/services/retention";

// Runs 09:00 UTC daily via Vercel Cron (see vercel.json).
// Protected by CRON_SECRET header.
export async function GET(req: NextRequest) {
  const secret = req.headers.get("authorization");
  if (secret !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runRetentionEmailSweep();
    return NextResponse.json({ success: true, ...result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Sweep error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
