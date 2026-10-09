import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAccessScope, scopeOwnershipWhere } from "@/lib/security/access-scope";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { transactionId, userAgent } = await req.json();
  if (!transactionId) return NextResponse.json({ error: "transactionId required" }, { status: 400 });

  // Validate ownership through the access-scope helper (Law 7). The old code
  // treated every "internal" role — including an EXTERNAL progression business's
  // members — as allowed to open any file by id, which let a progression user start
  // a timer against files outside their book. scopeOwnershipWhere restricts each
  // caller to what they can actually see: an agency to its files, a progression
  // business to its own book, a TSP progressor to their assigned files, TSP admin
  // to TSP's own files.
  const scope = getAccessScope(session);
  const transaction = await prisma.propertyTransaction.findFirst({
    where: scopeOwnershipWhere(scope, transactionId),
    select: { id: true, agencyId: true },
  });
  if (!transaction) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const fileTimeSession = await prisma.fileTimeSession.create({
    data: {
      transactionId,
      userId: session.user.id,
      agencyId: transaction.agencyId,
      userAgent: userAgent ?? null,
    },
    select: { id: true },
  });

  return NextResponse.json({ sessionId: fileTimeSession.id });
}
