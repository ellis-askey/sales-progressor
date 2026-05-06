"use server";

import { hash } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { validateInvitationToken } from "@/lib/auth/validate-invitation-token";
import { notifyNegotiatorOfAcceptance } from "@/lib/notifications/director-accepted";

interface ActionResult {
  ok?: boolean;
  error?: string;
}

export async function acceptInvitationPassword(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const token = formData.get("token");
  const password = formData.get("password");
  const name = formData.get("name");

  if (typeof token !== "string" || !token) return { error: "Invalid request." };
  if (typeof password !== "string" || password.length < 8) return { error: "Password must be at least 8 characters." };
  if (typeof name !== "string" || !name.trim()) return { error: "Please enter your full name." };

  const result = await validateInvitationToken(token);
  if (!result.valid) {
    if (result.error === "already_accepted") return { error: "This invitation has already been used." };
    return { error: "This invitation link is no longer valid." };
  }

  const { invitation } = result;

  // Check if a user with this email already exists
  const existing = await prisma.user.findUnique({
    where: { email: invitation.directorEmail.toLowerCase() },
    select: { id: true, agencyId: true },
  });

  if (existing?.agencyId) {
    // Already attached to an agency — invitation was already processed
    return { ok: true };
  }

  const passwordHash = await hash(password, 12);

  try {
    let userId: string;

    if (existing) {
      // User exists (e.g. created via OAuth previously) — set password + attach
      await prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: existing.id },
          data: {
            name: name.trim(),
            password: passwordHash,
            role: "director",
            agencyId: invitation.agencyId,
          },
        });
        await tx.directorInvitation.update({
          where: { id: invitation.id },
          data: { acceptedAt: new Date(), acceptedByUserId: existing.id },
        });
      });
      userId = existing.id;
    } else {
      // Net-new user — create and attach
      const newUser = await prisma.$transaction(async (tx) => {
        const created = await tx.user.create({
          data: {
            name: name.trim(),
            email: invitation.directorEmail.toLowerCase(),
            password: passwordHash,
            role: "director",
            agencyId: invitation.agencyId,
          },
          select: { id: true },
        });
        await tx.directorInvitation.update({
          where: { id: invitation.id },
          data: { acceptedAt: new Date(), acceptedByUserId: created.id },
        });
        return created;
      });
      userId = newUser.id;
    }

    await notifyNegotiatorOfAcceptance(invitation.id);
    console.log(`[AUDIT] director_invitation_accepted_password invitationId=${invitation.id} userId=${userId}`);

    return { ok: true };
  } catch (err) {
    console.error("acceptInvitationPassword error:", err);
    return { error: "Something went wrong. Please try again." };
  }
}
