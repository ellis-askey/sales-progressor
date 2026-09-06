import { NextRequest, NextResponse } from "next/server";
import { scanWhatsAppPromises } from "@/lib/services/whatsapp-promises";
import { runJob } from "@/lib/cron/run-job";

// "Promises" — read the newest outbound WhatsApp messages and turn the
// progressor's own dated commitments ("I'll chase Monday") into internal
// to-dos. Passive: it never sends anything. See lib/services/whatsapp-promises.ts.
// Mirrors the outlook-sync interpreter contract (bearer CRON_SECRET + runJob).

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return runJob("whatsapp-promises", async () => {
    const res = await scanWhatsAppPromises(25).catch(() => ({ scanned: 0, created: 0 }));
    return NextResponse.json(res);
  });
}
