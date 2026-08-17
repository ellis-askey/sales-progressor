import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { randomBytes } from "crypto";
import { sendNegotiatorInvitationEmail } from "@/lib/email/negotiator-invitation";

export async function POST(req: NextRequest) {
  const session = await requireSession();
  if (session.user.role !== "director") {
    return NextResponse.json({ error: "Director access required" }, { status: 403 });
  }

  const { userId } = await req.json();
  if (!userId) return NextResponse.json({ error: "Missing userId" }, { status: 400 });

  const user = await prisma.user.findFirst({
    where: { id: userId, agencyId: session.user.agencyId, role: "negotiator", password: null },
    select: { id: true, name: true, email: true },
  });
  if (!user) return NextResponse.json({ error: "User not found or invitation already accepted" }, { status: 404 });

  const agency = await prisma.agency.findUnique({
    where: { id: session.user.agencyId! },
    select: { name: true },
  });

  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  // Expire old pending invitations for this user
  await prisma.negotiatorInvitation.updateMany({
    where: { negotiatorEmail: user.email, agencyId: session.user.agencyId!, acceptedAt: null },
    data: { expiresAt: new Date(0) },
  });

  await prisma.negotiatorInvitation.create({
    data: {
      agencyId: session.user.agencyId!,
      invitedByUserId: session.user.id,
      negotiatorName: user.name,
      negotiatorEmail: user.email,
      token,
      expiresAt,
    },
  });

  const acceptUrl = `${process.env.NEXTAUTH_URL ?? ""}/invite-negotiator/${token}`;
  await sendNegotiatorInvitationEmail({
    to: user.email,
    negotiatorName: user.name,
    invitedByName: session.user.name ?? "Your director",
    agencyName: agency?.name ?? "your agency",
    agencyId: session.user.agencyId!,
    acceptUrl,
  });

  return NextResponse.json({ ok: true });
}
