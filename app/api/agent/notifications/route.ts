import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

// Returns count of portal-originated activity on transactions visible to this
// agent — milestone confirmations, expected-date updates, and chase notes.
// All three event types include the "via the client portal" marker phrase
// in their OutboundMessage content; that single phrase is the canonical
// portal-event signal (see lib/services/portal.ts and app/actions/portal.ts).
//
// Previously this endpoint required content contains "confirmed" AND
// "via the client portal", which only counted confirms. After B7+ added
// per-action signals for set-date and leave-note, the filter was broadened
// to count any "via the client portal" content (which is portal-exclusive).
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
      content: { contains: "via the client portal" },
      transaction: txFilter,
    },
  });

  return NextResponse.json({ count });
}
