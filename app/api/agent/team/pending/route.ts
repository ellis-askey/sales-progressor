import { NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await requireSession();

  if (session.user.role !== "director") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [negotiators, directors] = await Promise.all([
    prisma.negotiatorInvitation.findMany({
      where: { agencyId: session.user.agencyId, cancelledAt: null, acceptedAt: null },
      select: { id: true, negotiatorName: true, negotiatorEmail: true, expiresAt: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.directorInvitation.findMany({
      where: { agencyId: session.user.agencyId, cancelledAt: null, acceptedAt: null },
      select: { id: true, directorName: true, directorEmail: true, expiresAt: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  // One list, tagged by role so the Team roster can badge each pending invite and
  // route resend/cancel to the matching action.
  const pending = [
    ...directors.map((inv) => ({
      id: inv.id,
      name: inv.directorName,
      email: inv.directorEmail,
      role: "director" as const,
      expiresAt: inv.expiresAt.toISOString(),
      createdAt: inv.createdAt.toISOString(),
    })),
    ...negotiators.map((inv) => ({
      id: inv.id,
      name: inv.negotiatorName,
      email: inv.negotiatorEmail,
      role: "negotiator" as const,
      expiresAt: inv.expiresAt.toISOString(),
      createdAt: inv.createdAt.toISOString(),
    })),
  ].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return NextResponse.json(pending);
}
