// app/api/milestones/implied/route.ts
// GET: returns implied incomplete predecessors for a milestone
// Used to populate the "This milestone implies others" pop-up

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getImpliedPredecessors } from "@/lib/services/milestones";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const milestoneDefinitionId = searchParams.get("milestoneDefinitionId");
  const transactionId = searchParams.get("transactionId");

  if (!milestoneDefinitionId || !transactionId) {
    return NextResponse.json({ error: "Missing params" }, { status: 400 });
  }

  // Verify transaction belongs to this agency
  const tx = await prisma.propertyTransaction.findFirst({
    where: { id: transactionId, agencyId: session.user.agencyId },
    select: { id: true },
  });
  if (!tx) return NextResponse.json({ error: "Transaction not found" }, { status: 404 });

  const implied = await getImpliedPredecessors(milestoneDefinitionId, transactionId);
  return NextResponse.json(implied);
}
