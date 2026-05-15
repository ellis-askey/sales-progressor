import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { sessionId, intervals } = await req.json();
  if (!sessionId) return NextResponse.json({ error: "sessionId required" }, { status: 400 });

  const fileTimeSession = await prisma.fileTimeSession.findFirst({
    where: { id: sessionId, userId: session.user.id, endedAt: null },
    select: { id: true },
  });
  if (!fileTimeSession) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.fileTimeSession.update({
    where: { id: sessionId },
    data: { engagementIntervals: intervals ?? [], lastActivityAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
