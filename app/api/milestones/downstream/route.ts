// app/api/milestones/downstream/route.ts
// GET: returns completed downstream milestones + projected % after reversal

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getDownstreamCompleted } from "@/lib/services/milestones";

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
  const removeIds = new Set([milestoneDefinitionId, ...downstream.map((d) => d.id)]);

  const [allDefs, allCompletions] = await Promise.all([
    prisma.milestoneDefinition.findMany({ select: { id: true, side: true, weight: true } }),
    prisma.milestoneCompletion.findMany({
      where: { transactionId },
      select: { milestoneDefinitionId: true, state: true },
    }),
  ]);

  const completionMap = new Map(allCompletions.map((c) => [c.milestoneDefinitionId, c]));

  function sidePercent(side: string, removeFromCompleted: Set<string>): number {
    const sideDefs = allDefs.filter((d) => d.side === side);
    const applicable = sideDefs.filter((d) => completionMap.get(d.id)?.state !== "not_required");
    const applicableWeight = applicable.reduce((s, d) => s + Number(d.weight), 0);
    if (applicableWeight === 0) return 100;
    const completedWeight = applicable
      .filter((d) => completionMap.get(d.id)?.state === "complete" && !removeFromCompleted.has(d.id))
      .reduce((s, d) => s + Number(d.weight), 0);
    return (completedWeight / applicableWeight) * 100;
  }

  const emptySet = new Set<string>();
  const currentPercent = Math.round((sidePercent("vendor", emptySet) + sidePercent("purchaser", emptySet)) / 2);
  const projectedPercent = Math.round((sidePercent("vendor", removeIds) + sidePercent("purchaser", removeIds)) / 2);

  return NextResponse.json({ downstream, currentPercent, projectedPercent });
}
