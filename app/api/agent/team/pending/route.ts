import { NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await requireSession();

  if (session.user.role !== "director") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const pending = await prisma.negotiatorInvitation.findMany({
    where: {
      agencyId:    session.user.agencyId,
      cancelledAt: null,
      acceptedAt:  null,
    },
    select: {
      id:              true,
      negotiatorName:  true,
      negotiatorEmail: true,
      expiresAt:       true,
      createdAt:       true,
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(
    pending.map((inv) => ({
      ...inv,
      expiresAt: inv.expiresAt.toISOString(),
      createdAt: inv.createdAt.toISOString(),
    }))
  );
}
