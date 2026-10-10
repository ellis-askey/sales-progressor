// app/api/transactions/price/route.ts
// POST: update purchase price, override predicted date, or agent fee
// Logs price changes to audit trail automatically

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAccessScope, scopeOwnershipWhere } from "@/lib/security/access-scope";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const body = await req.json();
  const {
    transactionId,
    purchasePrice,
    overridePredictedDate,
    completionDate,
    agentFeeAmount,
    agentFeePercent,
    agentFeeIsVatInclusive,
  } = body;

  // Law 7: scope the ownership guard through the access-scope helper so it works for
  // internal staff (agencyId null) too, not the old agencyId-only filter (which
  // matched zero rows for internal users and bypassed the helper).
  const tx = await prisma.propertyTransaction.findFirst({
    where: scopeOwnershipWhere(getAccessScope(session), transactionId),
    select: { id: true, purchasePrice: true, activeBuyerRoundId: true },
  });
  if (!tx) return NextResponse.json({ error: "Transaction not found" }, { status: 404 });

  const updates: Record<string, unknown> = {};

  if (purchasePrice !== undefined) {
    updates.purchasePrice = purchasePrice;

    // Log price change to audit trail.
    // Phase 1 commit 4e — stamp activeBuyerRoundId per Phase 0
    // attribution (price is always buyer-side).
    if (tx.purchasePrice !== purchasePrice) {
      await prisma.priceHistory.create({
        data: {
          transactionId,
          oldPrice: tx.purchasePrice,
          newPrice: purchasePrice,
          changedById: session.user.id,
          buyerRoundId: tx.activeBuyerRoundId,
        },
      });

      // Also log as a system communication for the activity timeline
      const oldFormatted = tx.purchasePrice ? `£${(tx.purchasePrice / 100).toLocaleString("en-GB")}` : "not set";
      const newFormatted = `£${(purchasePrice / 100).toLocaleString("en-GB")}`;
      await prisma.outboundMessage.create({
        data: {
          transactionId,
          type: "internal_note",
          contactIds: [],
          content: `${session.user.name} updated purchase price from ${oldFormatted} to ${newFormatted}.`,
          createdById: session.user.id,
        },
      });
    }
  }

  if (overridePredictedDate !== undefined) {
    updates.overridePredictedDate = overridePredictedDate ? new Date(overridePredictedDate) : null;
  }

  if (completionDate !== undefined) {
    updates.completionDate = completionDate ? new Date(completionDate) : null;
  }

  if (agentFeeAmount !== undefined) updates.agentFeeAmount = agentFeeAmount;
  if (agentFeePercent !== undefined) updates.agentFeePercent = agentFeePercent;
  if (agentFeeIsVatInclusive !== undefined) updates.agentFeeIsVatInclusive = agentFeeIsVatInclusive;

  await prisma.propertyTransaction.update({
    where: { id: transactionId },
    data: updates,
  });

  return NextResponse.json({ success: true });
}
