import { NextRequest, NextResponse } from "next/server";
import { cleanupExpiredDemos } from "@/lib/services/demo-sale";
import { runJob } from "@/lib/cron/run-job";

// Removes demo showcase files whose ~1-week expiry has passed. Runs daily via
// Vercel Cron (see vercel.json) so a demo is gone within a day of expiring.
// Protected by CRON_SECRET header. See docs/active/demo-sale/SPEC.md.
export async function GET(req: NextRequest) {
  const secret = req.headers.get("authorization");
  if (secret !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return runJob("demo-cleanup", async () => {
    try {
      const result = await cleanupExpiredDemos();
      return NextResponse.json({ success: true, ...result });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Cleanup error";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  });
}
