// app/api/milestones/route.ts

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { PurchaseType } from "@prisma/client";
import {
  completeMilestone,
  markNotRequiredWithCascade,
  reverseMilestoneWithCascade,
  bulkCompleteMilestones,
} from "@/lib/services/milestones";
import { getAccessScope, scopeOwnershipWhere } from "@/lib/security/access-scope";
import { forRound, milestoneScopeWhere } from "@/lib/services/milestone-scope";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const scope = getAccessScope(session);
  const body = await req.json();
  const { action, transactionId, milestoneDefinitionId, eventDate, reason, impliedIds, downstreamIds, purchaseType, newPurchaseType } = body;

  if (!transactionId || !milestoneDefinitionId) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const tx = await prisma.propertyTransaction.findFirst({
    where: scopeOwnershipWhere(scope, transactionId),
    select: { id: true, agentUserId: true },
  });
  if (!tx) return NextResponse.json({ error: "Transaction not found" }, { status: 404 });

  // Negotiators without canViewAllFiles may only act on their own files
  if (session.user.role === "negotiator") {
    const actor = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { canViewAllFiles: true },
    });
    if (!actor?.canViewAllFiles && tx.agentUserId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  try {
    if (action === "complete") {
      if (impliedIds && Array.isArray(impliedIds) && impliedIds.length > 0) {
        await bulkCompleteMilestones(impliedIds, transactionId, session.user.id, session.user.name ?? "");
      }

      // Resolve counterpart definition id before the transaction (read-only lookup)
      const def = await prisma.milestoneDefinition.findUnique({
        where: { id: milestoneDefinitionId },
        select: { code: true },
      });
      const BILATERAL_PAIRS: Record<string, string> = {
        VM19: "PM26", PM26: "VM19",
        VM20: "PM27", PM27: "VM20",
      };
      const counterCode = def?.code ? BILATERAL_PAIRS[def.code] : undefined;
      let counterDefId: string | undefined;
      if (counterCode) {
        const counterDef = await prisma.milestoneDefinition.findFirst({
          where: { code: counterCode },
          select: { id: true },
        });
        counterDefId = counterDef?.id;
      }

      // Primary + bilateral counterpart writes in a single atomic transaction
      const apiConfirmer = { kind: "user" as const, id: session.user.id, name: session.user.name ?? "" };
      const result = await prisma.$transaction(async (ptx) => {
        const primary = await completeMilestone({
          transactionId,
          milestoneDefinitionId,
          confirmer: apiConfirmer,
          eventDate: eventDate ? new Date(eventDate) : null,
        }, ptx);

        if (counterDefId) {
          const apiTxRow = await ptx.propertyTransaction.findUnique({
            where: { id: transactionId },
            select: { activeBuyerRoundId: true },
          });
          const apiScope = forRound(apiTxRow?.activeBuyerRoundId ?? null, transactionId);
          const alreadyDone = await ptx.milestoneCompletion.findFirst({
            where: {
              transactionId,
              milestoneDefinitionId: counterDefId,
              state: "complete",
              ...milestoneScopeWhere(apiScope),
            },
          });
          if (!alreadyDone) {
            await completeMilestone({
              transactionId,
              milestoneDefinitionId: counterDefId,
              confirmer: apiConfirmer,
              eventDate: eventDate ? new Date(eventDate) : null,
            }, ptx);
          }
        }

        // Exchange Forecast sync: lock in confirmed exchange date
        if ((def?.code === "VM19" || def?.code === "PM26") && eventDate) {
          await ptx.propertyTransaction.update({
            where: { id: transactionId },
            data: { expectedExchangeDate: new Date(eventDate) },
          });
        }

        return primary;
      });

      return NextResponse.json(result, { status: 201 });
    }

    if (action === "reverse") {
      await reverseMilestoneWithCascade({
        transactionId,
        milestoneDefinitionId,
        completedById: session.user.id,
        completedByName: session.user.name ?? "",
        reason,
        downstreamIds: Array.isArray(downstreamIds) ? downstreamIds : [],
        newPurchaseType: newPurchaseType as PurchaseType | undefined,
      });
      return NextResponse.json({ success: true });
    }

    if (action === "not_required") {
      if (!reason || typeof reason !== "string" || !reason.trim()) {
        return NextResponse.json({ error: "A reason is required when marking a milestone as not required" }, { status: 400 });
      }
      const result = await markNotRequiredWithCascade({
        transactionId,
        milestoneDefinitionId,
        completedById: session.user.id,
        completedByName: session.user.name ?? "",
        reason: reason.trim(),
        purchaseType: purchaseType as PurchaseType | undefined,
      });
      return NextResponse.json(result, { status: 201 });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Operation failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
