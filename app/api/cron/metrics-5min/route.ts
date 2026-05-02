import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { computeDailyMetric, londonDateStr } from "@/lib/services/metrics-rollup";

export const dynamic = "force-dynamic";

// Runs every 5 minutes via Vercel Cron (see vercel.json).
// Updates today's DailyMetric rows so the command centre has live intra-day counts.
export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const jobRun = await prisma.jobRun.create({ data: { jobName: "rollup-metrics-5min" } });

  try {
    const now = new Date();
    const { rowsWritten } = await computeDailyMetric(now);

    await prisma.jobRun.update({
      where: { id: jobRun.id },
      data: { finishedAt: new Date(), success: true, rowsWritten },
    });

    return NextResponse.json({ ok: true, date: londonDateStr(now), rowsWritten });
  } catch (err) {
    await prisma.jobRun.update({
      where: { id: jobRun.id },
      data: {
        finishedAt: new Date(),
        success: false,
        errorMessage: err instanceof Error ? err.message : String(err),
      },
    });
    throw err;
  }
}
