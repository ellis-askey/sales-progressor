// POST /api/portal/[token]/time/heartbeat
//
// Periodic (30s) update of a portal time session's engaged intervals. Auth is
// the portal token; the session must belong to that token's contact and still
// be open. Body: { sessionId, intervals }. Twin of /api/file-time/heartbeat.

import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const contact = await prisma.contact.findUnique({
    where: { portalToken: token },
    select: { id: true },
  });
  if (!contact) return NextResponse.json({ error: "not found" }, { status: 404 });

  const { sessionId, intervals } = await req.json().catch(() => ({}));
  if (!sessionId) return NextResponse.json({ error: "sessionId required" }, { status: 400 });

  const session = await prisma.portalTimeSession.findFirst({
    where: { id: sessionId, contactId: contact.id, endedAt: null },
    select: { id: true },
  });
  if (!session) return NextResponse.json({ error: "not found" }, { status: 404 });

  await prisma.portalTimeSession.update({
    where: { id: sessionId },
    data: { engagementIntervals: intervals ?? [], lastActivityAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
