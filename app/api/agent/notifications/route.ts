import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

// Returns count of portal milestone confirmations on transactions visible to this agent.
export async function GET(req: NextRequest) {
  const session = await requireSession();
  const after = req.nextUrl.searchParams.get("after");
  const since = after ? new Date(after) : new Date(0);

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true, canViewAllFiles: true, firmName: true },
  });

  const seeAll = user?.role === "director" || user?.canViewAllFiles === true;

  // Build the transaction filter — mirrors the pattern in resolveAgentVisibility / txWhere
  const txFilter = seeAll
    ? user?.firmName
      ? { agencyId: session.user.agencyId, agentUser: { firmName: user.firmName } }
      : { agencyId: session.user.agencyId, agentUserId: { not: null } }
    : { agencyId: session.user.agencyId, agentUserId: session.user.id };

  const count = await prisma.outboundMessage.count({
    where: {
      type: "internal_note",
      createdAt: { gt: since },
      AND: [
        { content: { contains: "confirmed" } },
        { content: { contains: "via the client portal" } },
      ],
      transaction: txFilter,
    },
  });

  return NextResponse.json({ count });
}
