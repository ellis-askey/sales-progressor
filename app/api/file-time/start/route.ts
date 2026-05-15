import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (!session.user.agencyId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { transactionId, userAgent } = await req.json();
  if (!transactionId) return NextResponse.json({ error: "transactionId required" }, { status: 400 });

  const transaction = await prisma.propertyTransaction.findFirst({
    where: { id: transactionId, agencyId: session.user.agencyId },
    select: { id: true },
  });
  if (!transaction) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const fileTimeSession = await prisma.fileTimeSession.create({
    data: {
      transactionId,
      userId: session.user.id,
      agencyId: session.user.agencyId,
      userAgent: userAgent ?? null,
    },
    select: { id: true },
  });

  return NextResponse.json({ sessionId: fileTimeSession.id });
}
