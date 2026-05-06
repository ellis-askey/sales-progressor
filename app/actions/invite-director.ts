"use server";

import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { sendDirectorInvitationEmail } from "@/lib/email/director-invitation";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface InviteDirectorResult {
  ok: boolean;
  error?: string;
  invitationId?: string;
}

export async function inviteDirector(formData: FormData): Promise<InviteDirectorResult> {
  const session = await requireSession();

  if (session.user.role !== "negotiator") {
    return { ok: false, error: "Only negotiators can invite a director" };
  }

  if (!session.user.agencyId) {
    return { ok: false, error: "You must be in an agency to invite a director" };
  }

  const existingDirector = await prisma.user.findFirst({
    where: { agencyId: session.user.agencyId, role: "director" },
  });

  if (existingDirector) {
    return { ok: false, error: "Your agency already has a director" };
  }

  const rawName = (formData.get("directorName") as string | null)?.trim() ?? "";
  const rawEmail = (formData.get("directorEmail") as string | null)?.trim() ?? "";

  if (!rawName || rawName.length > 100) {
    return { ok: false, error: "Please enter the director's name" };
  }
  if (!rawEmail || rawEmail.length > 255 || !EMAIL_RE.test(rawEmail)) {
    return { ok: false, error: "Please enter a valid email address" };
  }

  const directorEmail = rawEmail.toLowerCase();

  if (directorEmail === session.user.email.toLowerCase()) {
    return { ok: false, error: "You can't invite yourself" };
  }

  const existingUser = await prisma.user.findUnique({ where: { email: directorEmail } });
  if (existingUser) {
    return {
      ok: false,
      error: "A Sales Progressor account already exists for that email. Ask your director to sign in instead.",
    };
  }

  const existingInvite = await prisma.directorInvitation.findFirst({
    where: {
      agencyId: session.user.agencyId,
      directorEmail,
      acceptedAt: null,
      expiresAt: { gt: new Date() },
    },
  });

  if (existingInvite) {
    return {
      ok: false,
      error: "An invitation has already been sent to that email. Wait for them to accept, or wait for it to expire.",
    };
  }

  const agency = await prisma.agency.findUnique({
    where: { id: session.user.agencyId },
    select: { name: true },
  });

  if (!agency) {
    return { ok: false, error: "Agency not found" };
  }

  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  const invitation = await prisma.directorInvitation.create({
    data: {
      agencyId: session.user.agencyId,
      invitedByUserId: session.user.id,
      directorName: rawName,
      directorEmail,
      token,
      expiresAt,
    },
  });

  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const acceptUrl = `${baseUrl}/invite/${token}`;

  try {
    await sendDirectorInvitationEmail({
      directorName: rawName,
      directorEmail,
      invitedByName: session.user.name,
      agencyName: agency.name,
      acceptUrl,
    });
  } catch (emailError) {
    await prisma.directorInvitation.delete({ where: { id: invitation.id } });
    console.error("Failed to send director invitation email:", emailError);
    return { ok: false, error: "Couldn't send the email. Please check the address and try again." };
  }

  console.log(`[AUDIT] director_invitation_sent invitationId=${invitation.id} agencyId=${session.user.agencyId} invitedBy=${session.user.id}`);
  return { ok: true, invitationId: invitation.id };
}
