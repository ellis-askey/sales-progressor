import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const INTERNAL_ROLES = ["superadmin", "admin", "sales_progressor"];

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { transactionId, userAgent } = await req.json();
  if (!transactionId) return NextResponse.json({ error: "transactionId required" }, { status: 400 });

  const isInternal = INTERNAL_ROLES.includes(session.user.role ?? "");

  // Agents: validate ownership via agencyId. Internal staff: look up by id only.
  const transaction = await prisma.propertyTransaction.findFirst({
    where: isInternal ? { id: transactionId } : { id: transactionId, agencyId: session.user.agencyId! },
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
