import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { runJob } from "@/lib/cron/run-job";

export const dynamic = "force-dynamic";

type Interval = { start: string; end: string };

function computeSeconds(intervals: Interval[]): number {
  return Math.floor(
    intervals.reduce((sum, iv) => {
      const ms = new Date(iv.end).getTime() - new Date(iv.start).getTime();
      return sum + (ms > 0 ? ms : 0);
    }, 0) / 1000
  );
}

export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return runJob("file-time-close", async () => {
  const cutoff = new Date(Date.now() - 5 * 60 * 1000);

  const staleSessions = await prisma.fileTimeSession.findMany({
    where: { endedAt: null, lastActivityAt: { lt: cutoff } },
    select: { id: true, engagementIntervals: true },
  });

  let closed = 0;
  let discarded = 0;

  for (const s of staleSessions) {
    const intervals = (s.engagementIntervals as Interval[]) ?? [];
    const totalEngagedSeconds = computeSeconds(intervals);

    if (totalEngagedSeconds < 10) {
      await prisma.fileTimeSession.delete({ where: { id: s.id } });
      discarded++;
    } else {
      await prisma.fileTimeSession.update({
        where: { id: s.id },
        data: { totalEngagedSeconds, closedReason: "heartbeat-timeout", endedAt: new Date() },
      });
      closed++;
    }
  }

  return NextResponse.json({ ok: true, closed, discarded });
  });
}
