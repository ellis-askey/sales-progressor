// POST /api/portal/[token]/time/end
//
// Closes a portal time session (unmount / beforeunload). Computes total engaged
// seconds from the intervals; sessions under 10s are discarded as noise (a
// glance, a bounce). Twin of /api/file-time/end. Auth is the portal token.

import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function computeSeconds(intervals: Array<{ start: string; end: string }>): number {
  return Math.floor(
    intervals.reduce((sum, iv) => {
      const ms = new Date(iv.end).getTime() - new Date(iv.start).getTime();
      return sum + (ms > 0 ? ms : 0);
    }, 0) / 1000,
  );
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const contact = await prisma.contact.findUnique({
    where: { portalToken: token },
    select: { id: true },
  });
  if (!contact) return NextResponse.json({ ok: true });

  const { sessionId, intervals, reason } = await req.json().catch(() => ({}));
  if (!sessionId) return NextResponse.json({ error: "sessionId required" }, { status: 400 });

  const session = await prisma.portalTimeSession.findFirst({
    where: { id: sessionId, contactId: contact.id, endedAt: null },
    select: { id: true },
  });
  if (!session) return NextResponse.json({ ok: true });

  const totalEngagedSeconds = computeSeconds(intervals ?? []);

  if (totalEngagedSeconds < 10) {
    await prisma.portalTimeSession.delete({ where: { id: sessionId } });
  } else {
    await prisma.portalTimeSession.update({
      where: { id: sessionId },
      data: {
        engagementIntervals: intervals ?? [],
        totalEngagedSeconds,
        closedReason: typeof reason === "string" ? reason : null,
        endedAt: new Date(),
      },
    });
  }

  return NextResponse.json({ ok: true });
}
