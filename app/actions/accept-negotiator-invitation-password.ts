"use server";

import { hash } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { validateNegotiatorInvitationToken } from "@/lib/auth/validate-negotiator-invitation-token";
import { notifyDirectorOfAcceptance } from "@/lib/notifications/negotiator-accepted";

export type AcceptNegotiatorPasswordResult =
  | { ok: true }
  | { ok: false; error: string };

export async function acceptNegotiatorInvitationPassword(
  formData: FormData
): Promise<AcceptNegotiatorPasswordResult> {
  const token    = formData.get("token")    as string | null;
  const name     = (formData.get("name")    as string | null)?.trim();
  const password = formData.get("password") as string | null;
  const confirm  = formData.get("confirm")  as string | null;

  if (!token || !name || !password || !confirm) {
    return { ok: false, error: "All fields are required." };
  }
  if (password.length < 8) {
    return { ok: false, error: "Password must be at least 8 characters." };
  }
  if (password !== confirm) {
    return { ok: false, error: "Passwords don't match." };
  }

  const result = await validateNegotiatorInvitationToken(token);
  if (!result.valid) {
    if (result.error === "already_accepted") {
      return { ok: false, error: "This invitation has already been used." };
    }
    return { ok: false, error: "This invitation link is no longer valid." };
  }

  const { invitation } = result;

  const existing = await prisma.user.findUnique({
    where: { email: invitation.negotiatorEmail },
  });
  if (existing) {
    return {
      ok: false,
      error: "An account with this email already exists. Please sign in instead.",
    };
  }

  const passwordHash = await hash(password, 12);

  // Atomic: create user + inherit firmName from inviter + mark invitation accepted
  const { invitationId } = await prisma.$transaction(async (tx) => {
    const inviter = await tx.user.findUnique({
      where: { id: invitation.invitedByUserId },
      select: { firmName: true },
    });

    const newUser = await tx.user.create({
      data: {
        name,
        email:    invitation.negotiatorEmail,
        password: passwordHash,
        role:     "negotiator",
        agencyId: invitation.agencyId,
        firmName: inviter?.firmName ?? null,
      },
    });

    await tx.negotiatorInvitation.update({
      where: { id: invitation.id },
      data: { acceptedAt: new Date(), acceptedByUserId: newUser.id },
    });

    return { invitationId: invitation.id };
  });

  // Non-blocking — a failed notification must not roll back the accept
  notifyDirectorOfAcceptance(invitationId).catch(console.error);

  console.log(`[AUDIT] negotiator_invitation_accepted_password invitationId=${invitationId}`);
  return { ok: true };
}
