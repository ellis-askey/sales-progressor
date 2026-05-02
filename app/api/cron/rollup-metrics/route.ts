import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  computeDailyMetric,
  computeWeeklyCohort,
  londonDateStr,
  toMondayUtc,
} from "@/lib/services/metrics-rollup";

export const dynamic = "force-dynamic";

// Runs 02:00 UTC nightly via Vercel Cron (see vercel.json).
// Computes yesterday's DailyMetric + recomputes WeeklyCohorts for the last 13 weeks.
export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const jobRun = await prisma.jobRun.create({ data: { jobName: "rollup-metrics-nightly" } });

  try {
    const now = new Date();

    // Yesterday in London time
    const yesterdayUtc = new Date(now);
    yesterdayUtc.setUTCDate(yesterdayUtc.getUTCDate() - 1);
    const { rowsWritten: dailyRows } = await computeDailyMetric(yesterdayUtc);

    // Recompute WeeklyCohorts for last 13 weeks (covers all activeWeek12 lookbacks)
    let cohortRows = 0;
    for (let weeksAgo = 0; weeksAgo <= 12; weeksAgo++) {
      const weekRef = new Date(now);
      weekRef.setUTCDate(weekRef.getUTCDate() - weeksAgo * 7);
      const { rowsWritten } = await computeWeeklyCohort(toMondayUtc(weekRef));
      cohortRows += rowsWritten;
    }

    await prisma.jobRun.update({
      where: { id: jobRun.id },
      data: { finishedAt: now, success: true, rowsWritten: dailyRows + cohortRows },
    });

    return NextResponse.json({ ok: true, date: londonDateStr(yesterdayUtc), dailyRows, cohortRows });
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
