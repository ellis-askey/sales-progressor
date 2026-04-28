// app/api/milestones/downstream/route.ts
// GET: returns completed downstream milestones + projected % after reversal

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getDownstreamCompleted } from "@/lib/services/milestones";
import { MILESTONE_WEIGHTS } from "@/lib/services/fees";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const milestoneDefinitionId = searchParams.get("milestoneDefinitionId");
  const transactionId = searchParams.get("transactionId");

  if (!milestoneDefinitionId || !transactionId) {
    return NextResponse.json({ error: "Missing params" }, { status: 400 });
  }

  const tx = await prisma.propertyTransaction.findFirst({
    where: { id: transactionId, agencyId: session.user.agencyId },
    select: { id: true, createdAt: true },
  });
  if (!tx) return NextResponse.json({ error: "Transaction not found" }, { status: 404 });

  const downstream = await getDownstreamCompleted(milestoneDefinitionId, transactionId);

  // Compute projected % after reversing target + all downstream
  const POST_EXCHANGE = new Set(["VM19", "VM20", "PM26", "PM27"]);
  const removeIds = new Set([milestoneDefinitionId, ...downstream.map((d) => d.id)]);

  const [allDefs, allCompletions] = await Promise.all([
    prisma.milestoneDefinition.findMany({ select: { id: true, code: true } }),
    prisma.milestoneCompletion.findMany({
      where: { transactionId },
      select: { milestoneDefinitionId: true, state: true },
    }),
  ]);

  const completionMap = new Map(allCompletions.map((c) => [c.milestoneDefinitionId, c]));

  const applicable = allDefs.filter((d) => !POST_EXCHANGE.has(d.code));
  const active = applicable.filter((d) => {
    const c = completionMap.get(d.id);
    return c?.state !== "not_required";
  });

  const totalWeight = active.reduce((sum, d) => sum + (MILESTONE_WEIGHTS[d.code] ?? 2), 0);

  // Current completed weight
  const currentCompleted = active.filter((d) => completionMap.get(d.id)?.state === "complete");
  const currentWeight = currentCompleted.reduce((sum, d) => sum + (MILESTONE_WEIGHTS[d.code] ?? 2), 0);
  const currentPercent = totalWeight > 0 ? Math.round((currentWeight / totalWeight) * 100) : 0;

  // Projected weight after removing target + downstream
  const projectedCompleted = currentCompleted.filter((d) => !removeIds.has(d.id));
  const projectedWeight = projectedCompleted.reduce((sum, d) => sum + (MILESTONE_WEIGHTS[d.code] ?? 2), 0);
  const projectedPercent = totalWeight > 0 ? Math.round((projectedWeight / totalWeight) * 100) : 0;

  return NextResponse.json({ downstream, currentPercent, projectedPercent });
}
