import { NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await requireSession();
  const userId = session.user.id;
  const agencyId = session.user.agencyId;

  // All checks scoped to this agent's own files
  const agentTxWhere = { agentUserId: userId, agencyId, status: { not: "draft" as const } };

  const [activeTxCount, contactWithDetails, contactWithEmail, verifiedEmail, user, firstTx] =
    await Promise.all([
      prisma.propertyTransaction.count({ where: agentTxWhere }),
      prisma.contact.count({
        where: {
          transaction: agentTxWhere,
          OR: [{ phone: { not: null } }, { email: { not: null } }],
        },
      }),
      prisma.contact.count({
        where: { transaction: agentTxWhere, email: { not: null } },
      }),
      prisma.userVerifiedEmail.count({
        where: { userId, status: "verified" },
      }),
      prisma.user.findUnique({ where: { id: userId }, select: { phone: true } }),
      prisma.propertyTransaction.findFirst({
        where: agentTxWhere,
        orderBy: { createdAt: "asc" },
        select: { id: true },
      }),
    ]);

  const steps = [
    activeTxCount > 0,
    contactWithDetails > 0,
    contactWithEmail > 0,
    verifiedEmail > 0,
    user?.phone != null && user.phone.trim() !== "",
  ];

  return NextResponse.json({ steps, firstTxId: firstTx?.id ?? null });
}
