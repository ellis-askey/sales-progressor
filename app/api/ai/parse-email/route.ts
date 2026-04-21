import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseEmailForMilestones } from "@/lib/services/email-parse";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { transactionId, emailText } = await req.json() as { transactionId: string; emailText: string };
  if (!transactionId || !emailText?.trim()) {
    return NextResponse.json({ error: "Missing transactionId or emailText" }, { status: 400 });
  }

  // Verify transaction belongs to this agency
  const tx = await prisma.propertyTransaction.findFirst({
    where: { id: transactionId, agencyId: session.user.agencyId },
    select: { id: true },
  });
  if (!tx) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Get open milestones for this transaction
  const completedIds = await prisma.milestoneCompletion.findMany({
    where: { transactionId, isActive: true },
    select: { milestoneDefinitionId: true },
  });
  const completedSet = new Set(completedIds.map((c) => c.milestoneDefinitionId));

  const allDefs = await prisma.milestoneDefinition.findMany({
    orderBy: { orderIndex: "asc" },
    select: { id: true, code: true, name: true, side: true },
  });

  const openMilestones = allDefs.filter((d) => !completedSet.has(d.id));

  const result = await parseEmailForMilestones(emailText, openMilestones);

  return NextResponse.json(result);
}
