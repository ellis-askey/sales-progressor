import { NextResponse } from "next/server";
import { buildWeeklyWindow, runAllDetectors } from "@/lib/services/signals";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const window = buildWeeklyWindow();
  const result = await runAllDetectors(window);

  return NextResponse.json({ ok: true, ...result });
}
