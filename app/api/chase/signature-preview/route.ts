// GET /api/chase/signature-preview?transactionId=…
// Returns the white-label signature that /api/chase/send-email will append, so
// the chase drawer can show the agent exactly how their email signs off, plus
// which pieces are still missing (for the "finish your signature" nudge).

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAccessScope, scopeOwnershipWhere } from "@/lib/security/access-scope";
import { resolveEmailSignature } from "@/lib/email/signature";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const transactionId = req.nextUrl.searchParams.get("transactionId");
  if (!transactionId) return NextResponse.json({ error: "Missing transactionId" }, { status: 400 });

  const scope = getAccessScope(session);
  const tx = await prisma.propertyTransaction.findFirst({
    where: scopeOwnershipWhere(scope, transactionId),
    select: { agency: { select: { name: true, logoPath: true, logoTileColor: true, logoScale: true, logoAlign: true } } },
  });
  if (!tx) return NextResponse.json({ error: "Transaction not found" }, { status: 404 });

  // Same resolver the real send uses, so the drawer preview matches the send
  // exactly (BASIC / IMAGE / CUSTOM).
  const sig = await resolveEmailSignature({
    userId: session.user.id,
    agency: tx.agency,
    fallbackName: session.user.name,
  });

  return NextResponse.json({ html: sig.html, missing: sig.missing, mode: sig.mode, name: session.user.name ?? null });
}
