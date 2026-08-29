// Closes portal time sessions whose client left without a clean unload (mobile
// tab killed, connection dropped) — any session with no heartbeat for >5min.
// Twin of /api/cron/file-time-close. Runs nightly (vercel.json).

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
    }, 0) / 1000,
  );
}

export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return runJob("portal-time-close", async () => {
  const cutoff = new Date(Date.now() - 5 * 60 * 1000);

  const staleSessions = await prisma.portalTimeSession.findMany({
    where: { endedAt: null, lastActivityAt: { lt: cutoff } },
    select: { id: true, engagementIntervals: true },
  });

  let closed = 0;
  let discarded = 0;

  for (const s of staleSessions) {
    const intervals = (s.engagementIntervals as Interval[]) ?? [];
    const totalEngagedSeconds = computeSeconds(intervals);

    if (totalEngagedSeconds < 10) {
      await prisma.portalTimeSession.delete({ where: { id: s.id } });
      discarded++;
    } else {
      await prisma.portalTimeSession.update({
        where: { id: s.id },
        data: { totalEngagedSeconds, closedReason: "heartbeat-timeout", endedAt: new Date() },
      });
      closed++;
    }
  }

  return NextResponse.json({ ok: true, closed, discarded });
  });
}
