// app/api/milestones/route.ts

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  completeMilestone,
  reverseMilestone,
  markNotRequired,
  bulkMarkNotRequired,
  bulkCompleteMilestones,
  bulkReverseMilestones,
} from "@/lib/services/milestones";

// Codes that cascade N/R when their anchor is marked N/R
const NR_CASCADE: Record<string, string[]> = {
  PM4: ["PM5", "PM6"],
  PM7: ["PM20"],
};

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const body = await req.json();
  const { action, transactionId, milestoneDefinitionId, eventDate, reason, impliedIds, downstreamIds, purchaseType, newPurchaseType } = body;

  if (!transactionId || !milestoneDefinitionId) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const tx = await prisma.propertyTransaction.findFirst({
    where: { id: transactionId, agencyId: session.user.agencyId },
    select: { id: true },
  });
  if (!tx) return NextResponse.json({ error: "Transaction not found" }, { status: 404 });

  try {
    if (action === "complete") {
      if (impliedIds && Array.isArray(impliedIds) && impliedIds.length > 0) {
        await bulkCompleteMilestones(impliedIds, transactionId, session.user.id, session.user.name ?? "");
      }
      const result = await completeMilestone({
        transactionId,
        milestoneDefinitionId,
        completedById: session.user.id,
        completedByName: session.user.name ?? "",
        eventDate: eventDate ? new Date(eventDate) : null,
      });
      return NextResponse.json(result, { status: 201 });
    }

    if (action === "reverse") {
      // Look up the def's code to detect PM4/PM7 special handling
      const def = await prisma.milestoneDefinition.findUnique({
        where: { id: milestoneDefinitionId },
        select: { code: true },
      });

      // For PM4/PM7 reversals: also reverse any auto-cascaded N/R milestones
      if (def?.code && NR_CASCADE[def.code]) {
        const cascadeCodes = NR_CASCADE[def.code];
        const cascadeDefs = await prisma.milestoneDefinition.findMany({
          where: { code: { in: cascadeCodes } },
          select: { id: true },
        });
        const nrCascaded = await prisma.milestoneCompletion.findMany({
          where: {
            transactionId,
            milestoneDefinitionId: { in: cascadeDefs.map((d) => d.id) },
            isActive: true,
            isNotRequired: true,
          },
          select: { milestoneDefinitionId: true },
        });
        if (nrCascaded.length > 0) {
          await bulkReverseMilestones(
            nrCascaded.map((c) => c.milestoneDefinitionId),
            transactionId,
            session.user.id,
            session.user.name ?? ""
          );
        }
      }

      // Update purchaseType back to mortgage on PM4 reinstate
      if (newPurchaseType) {
        await prisma.propertyTransaction.update({
          where: { id: transactionId },
          data: { purchaseType: newPurchaseType },
        });
      }

      // Regular downstream complete-milestones reversal
      if (Array.isArray(downstreamIds) && downstreamIds.length > 0) {
        await bulkReverseMilestones(downstreamIds, transactionId, session.user.id, session.user.name ?? "");
      }

      await reverseMilestone(transactionId, milestoneDefinitionId, session.user.id, session.user.name ?? "", reason);
      return NextResponse.json({ success: true });
    }

    if (action === "not_required") {
      if (!reason || typeof reason !== "string" || !reason.trim()) {
        return NextResponse.json({ error: "A reason is required when marking a milestone as not required" }, { status: 400 });
      }

      // Look up code for cascade logic
      const def = await prisma.milestoneDefinition.findUnique({
        where: { id: milestoneDefinitionId },
        select: { code: true },
      });

      // Cascade N/R to downstream milestones (PM5+PM6 for PM4, PM20 for PM7)
      if (def?.code && NR_CASCADE[def.code]) {
        const cascadeCodes = NR_CASCADE[def.code];
        const cascadeDefs = await prisma.milestoneDefinition.findMany({
          where: { code: { in: cascadeCodes } },
          select: { id: true },
        });
        if (cascadeDefs.length > 0) {
          await bulkMarkNotRequired(
            cascadeDefs.map((d) => d.id),
            transactionId,
            session.user.id,
            reason.trim()
          );
        }
      }

      // Update purchaseType when mortgage milestones marked N/R
      if (purchaseType) {
        await prisma.propertyTransaction.update({
          where: { id: transactionId },
          data: { purchaseType },
        });
      }

      const result = await markNotRequired(
        transactionId,
        milestoneDefinitionId,
        session.user.id,
        session.user.name ?? "",
        reason.trim()
      );
      return NextResponse.json(result, { status: 201 });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Operation failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
