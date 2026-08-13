// POST /api/portal/[token]/time/start
//
// Opens a portal engaged-time session for the token's client. Auth is the
// portal token itself (same model as the rest of the portal) — the token
// resolves to exactly one Contact + their transaction. Body: { userAgent? }.
// Returns { sessionId }. Twin of /api/file-time/start (agent side).

import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const contact = await prisma.contact.findUnique({
    where: { portalToken: token },
    select: { id: true, propertyTransactionId: true },
  });
  if (!contact) return NextResponse.json({ error: "not found" }, { status: 404 });

  const { userAgent } = await req.json().catch(() => ({}));

  const session = await prisma.portalTimeSession.create({
    data: {
      transactionId: contact.propertyTransactionId,
      contactId: contact.id,
      userAgent: typeof userAgent === "string" ? userAgent : null,
    },
    select: { id: true },
  });

  return NextResponse.json({ sessionId: session.id });
}
