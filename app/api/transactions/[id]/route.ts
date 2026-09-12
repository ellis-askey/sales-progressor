// app/api/transactions/[id]/route.ts

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAccessScope, scopeOwnershipWhere } from "@/lib/security/access-scope";
import { recordPredictionChangeIfMoved } from "@/lib/services/exchange-prediction-history";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { id } = await params;
  const scope = getAccessScope(session);

  const existing = await prisma.propertyTransaction.findFirst({
    where: scopeOwnershipWhere(scope, id),
    select: { id: true, agentUserId: true, expectedExchangeDate: true },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Negotiators without canViewAllFiles may only update their own files
  if (session.user.role === "negotiator") {
    const actor = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { canViewAllFiles: true },
    });
    if (!actor?.canViewAllFiles && existing.agentUserId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const body = await req.json();
  const {
    notes,
    vendorSolicitorFirmId,
    vendorSolicitorContactId,
    purchaserSolicitorFirmId,
    purchaserSolicitorContactId,
    assignedUserId,
    expectedExchangeDate,
  } = body;

  // Resolve the new expected-exchange value once (undefined = field not in this
  // PATCH, so it is left untouched — behaviour unchanged).
  const newExpected =
    expectedExchangeDate !== undefined
      ? (expectedExchangeDate ? new Date(expectedExchangeDate) : null)
      : undefined;

  const updated = await prisma.$transaction(async (txc) => {
    const u = await txc.propertyTransaction.update({
      where: { id },
      data: {
        ...(notes !== undefined && { notes }),
        ...(vendorSolicitorFirmId !== undefined && { vendorSolicitorFirmId }),
        ...(vendorSolicitorContactId !== undefined && { vendorSolicitorContactId }),
        ...(purchaserSolicitorFirmId !== undefined && { purchaserSolicitorFirmId }),
        ...(purchaserSolicitorContactId !== undefined && { purchaserSolicitorContactId }),
        ...(assignedUserId !== undefined && { assignedUserId: assignedUserId || null }),
        ...(newExpected !== undefined && { expectedExchangeDate: newExpected }),
        lastActivityAt: new Date(),
      },
    });

    // Capture-only prediction history (PR4): an arbitrary agent-entered
    // expected-exchange edit through this route is otherwise irrecoverable.
    // Change-only by calendar day, coupled in-transaction with the update above.
    if (newExpected !== undefined) {
      await recordPredictionChangeIfMoved(txc, {
        transactionId: id,
        field: "expectedExchangeDate",
        previousDate: existing.expectedExchangeDate,
        predictedDate: newExpected,
        source: "api_patch",
        isOverride: false,
        changedByUserId: session.user.id,
      });
    }
    return u;
  });

  return NextResponse.json(updated);
}
