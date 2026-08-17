"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { sendNegotiatorInvitationEmail } from "@/lib/email/negotiator-invitation";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type InviteNegotiatorResult =
  | { ok: true }
  | { ok: false; error: string };

// ─── inviteNegotiator ─────────────────────────────────────────────────────────

export async function inviteNegotiator(
  formData: FormData
): Promise<InviteNegotiatorResult> {
  const session = await requireSession();

  if (session.user.role !== "director") {
    return { ok: false, error: "Only directors can invite negotiators" };
  }

  if (!session.user.agencyId) {
    return { ok: false, error: "You must be in an agency to invite a negotiator" };
  }

  const rawName  = (formData.get("name")  as string | null)?.trim() ?? "";
  const rawEmail = (formData.get("email") as string | null)?.trim() ?? "";

  if (!rawName || rawName.length > 100) {
    return { ok: false, error: "Please enter the negotiator's name" };
  }
  if (!rawEmail || rawEmail.length > 255 || !EMAIL_RE.test(rawEmail)) {
    return { ok: false, error: "Please enter a valid email address" };
  }

  const negotiatorEmail = rawEmail.toLowerCase();

  if (negotiatorEmail === session.user.email.toLowerCase()) {
    return { ok: false, error: "You can't invite yourself" };
  }

  const existingUser = await prisma.user.findUnique({ where: { email: negotiatorEmail } });
  if (existingUser) {
    return {
      ok: false,
      error: "A Sales Progressor account already exists for that email.",
    };
  }

  const pendingInvite = await prisma.negotiatorInvitation.findFirst({
    where: {
      agencyId:        session.user.agencyId,
      negotiatorEmail,
      cancelledAt:     null,
      acceptedAt:      null,
      expiresAt:       { gt: new Date() },
    },
  });
  if (pendingInvite) {
    return {
      ok: false,
      error: "A pending invitation already exists for that email. Use Resend to send again.",
    };
  }

  const agency = await prisma.agency.findUnique({
    where: { id: session.user.agencyId },
    select: { name: true },
  });
  if (!agency) {
    return { ok: false, error: "Agency not found" };
  }

  const token     = randomBytes(32).toString("hex");
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  await prisma.negotiatorInvitation.create({
    data: {
      agencyId:        session.user.agencyId,
      invitedByUserId: session.user.id,
      negotiatorName:  rawName,
      negotiatorEmail,
      token,
      expiresAt,
    },
  });

  const appUrl = process.env.NEXTAUTH_URL ?? "https://portal.thesalesprogressor.co.uk";

  try {
    await sendNegotiatorInvitationEmail({
      to:              negotiatorEmail,
      negotiatorName:  rawName,
      invitedByName:   session.user.name,
      agencyName:      agency.name,
      agencyId:        session.user.agencyId!,
      acceptUrl:       `${appUrl}/invite-negotiator/${token}`,
    });
  } catch (emailError) {
    await prisma.negotiatorInvitation.deleteMany({
      where: { token },
    });
    console.error("Failed to send negotiator invitation email:", emailError);
    return { ok: false, error: "Couldn't send the email. Please check the address and try again." };
  }

  console.log(`[AUDIT] negotiator_invitation_sent agencyId=${session.user.agencyId} invitedBy=${session.user.id} email=${negotiatorEmail}`);
  revalidatePath("/agent/account/team");
  return { ok: true };
}

// ─── resendNegotiatorInvitation ───────────────────────────────────────────────

export async function resendNegotiatorInvitation(
  invitationId: string
): Promise<InviteNegotiatorResult> {
  const session = await requireSession();

  if (session.user.role !== "director") {
    return { ok: false, error: "Only directors can resend invitations" };
  }

  const invitation = await prisma.negotiatorInvitation.findFirst({
    where: {
      id:          invitationId,
      agencyId:    session.user.agencyId,
      cancelledAt: null,
      acceptedAt:  null,
    },
  });
  if (!invitation) {
    return { ok: false, error: "Invitation not found" };
  }

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  await prisma.negotiatorInvitation.update({
    where: { id: invitationId },
    data:  { expiresAt },
  });

  const agency = await prisma.agency.findUnique({
    where: { id: session.user.agencyId },
    select: { name: true },
  });

  const appUrl = process.env.NEXTAUTH_URL ?? "https://portal.thesalesprogressor.co.uk";

  try {
    await sendNegotiatorInvitationEmail({
      to:              invitation.negotiatorEmail,
      negotiatorName:  invitation.negotiatorName,
      invitedByName:   session.user.name,
      agencyName:      agency?.name ?? "your agency",
      agencyId:        session.user.agencyId!,
      acceptUrl:       `${appUrl}/invite-negotiator/${invitation.token}`,
    });
  } catch (emailError) {
    console.error("Failed to resend negotiator invitation email:", emailError);
    return { ok: false, error: "Couldn't send the email. Please try again." };
  }

  console.log(`[AUDIT] negotiator_invitation_resent invitationId=${invitationId} invitedBy=${session.user.id}`);
  revalidatePath("/agent/account/team");
  return { ok: true };
}

// ─── cancelNegotiatorInvitation ───────────────────────────────────────────────

export async function cancelNegotiatorInvitation(
  invitationId: string
): Promise<InviteNegotiatorResult> {
  const session = await requireSession();

  if (session.user.role !== "director") {
    return { ok: false, error: "Only directors can cancel invitations" };
  }

  const invitation = await prisma.negotiatorInvitation.findFirst({
    where: {
      id:          invitationId,
      agencyId:    session.user.agencyId,
      cancelledAt: null,
      acceptedAt:  null,
    },
  });
  if (!invitation) {
    return { ok: false, error: "Invitation not found" };
  }

  await prisma.negotiatorInvitation.update({
    where: { id: invitationId },
    data:  { cancelledAt: new Date() },
  });

  console.log(`[AUDIT] negotiator_invitation_cancelled invitationId=${invitationId} cancelledBy=${session.user.id}`);
  revalidatePath("/agent/account/team");
  return { ok: true };
}
