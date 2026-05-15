import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function computeSeconds(intervals: Array<{ start: string; end: string }>): number {
  return Math.floor(
    intervals.reduce((sum, iv) => {
      const ms = new Date(iv.end).getTime() - new Date(iv.start).getTime();
      return sum + (ms > 0 ? ms : 0);
    }, 0) / 1000
  );
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { sessionId, intervals, reason } = await req.json();
  if (!sessionId) return NextResponse.json({ error: "sessionId required" }, { status: 400 });

  const fileTimeSession = await prisma.fileTimeSession.findFirst({
    where: { id: sessionId, userId: session.user.id, endedAt: null },
    select: { id: true },
  });
  if (!fileTimeSession) return NextResponse.json({ ok: true });

  const totalEngagedSeconds = computeSeconds(intervals ?? []);

  if (totalEngagedSeconds < 10) {
    await prisma.fileTimeSession.delete({ where: { id: sessionId } });
  } else {
    await prisma.fileTimeSession.update({
      where: { id: sessionId },
      data: {
        engagementIntervals: intervals ?? [],
        totalEngagedSeconds,
        closedReason: reason ?? null,
        endedAt: new Date(),
      },
    });
  }

  return NextResponse.json({ ok: true });
}
