"use server";

import { prisma } from "@/lib/prisma";
import { hash } from "bcryptjs";

type Result = { ok: true } | { error: string };

export async function acceptNegotiatorInvitation(
  _prev: Result | null,
  formData: FormData
): Promise<Result> {
  const token = formData.get("token") as string;
  const password = formData.get("password") as string;
  const name = (formData.get("name") as string)?.trim();

  if (!token || !password || !name) {
    return { error: "Missing required fields" };
  }
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters" };
  }

  const invitation = await prisma.negotiatorInvitation.findUnique({
    where: { token },
    include: { agency: { select: { name: true } } },
  });

  if (!invitation) return { error: "Invalid or expired invitation link" };
  if (invitation.acceptedAt) return { error: "This invitation has already been accepted" };
  if (invitation.expiresAt < new Date()) return { error: "This invitation link has expired. Ask your director to resend it." };

  const user = await prisma.user.findUnique({
    where: { email: invitation.negotiatorEmail },
    select: { id: true, password: true },
  });

  if (!user) return { error: "Account not found. Please contact your director." };
  if (user.password !== null) return { error: "Password has already been set for this account." };

  const passwordHash = await hash(password, 12);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { password: passwordHash, name },
    }),
    prisma.negotiatorInvitation.update({
      where: { token },
      data: { acceptedAt: new Date(), acceptedByUserId: user.id },
    }),
  ]);

  return { ok: true };
}
