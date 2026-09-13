// Invite-to-move (docs/active/invite-to-move/SPEC.md).
//
// When a director invites an email that ALREADY has an account, the person can
// accept a move into the director's agency. This service is the consent-guarded
// heart of the accept: it decides whether the move is safe to do automatically
// or must be handed to the internal team.
//
// SAFETY RULE (D1): auto-move only when the person's current agency is SOLO
// (they're the only member) AND has ZERO sales — i.e. there is nothing to
// migrate but the user record itself. Anything else goes to the support queue
// and is completed by hand. This makes the auto path carry zero data-migration
// risk by construction.

import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { createNotification } from "@/lib/services/notifications";

const SUPPORT_EMAIL = "support@thesalesprogressor.co.uk";

// Minimal shapes so the helpers don't depend on Prisma's generated include types.
type Invite = {
  id: string;
  agencyId: string;
  invitedByUserId: string;
  negotiatorEmail: string;
  agency: { name: string };
};
type Mover = { id: string; email: string; name: string | null; agencyId: string | null };

export type MoveSafety = {
  fromAgencyId: string;
  salesCount: number;
  otherStaffCount: number;
  safe: boolean;
};

export type MoveOutcome =
  | { ok: true; outcome: "moved"; agencyName: string }
  | { ok: true; outcome: "flagged"; agencyName: string }
  | { ok: false; error: string };

/**
 * Is it safe to auto-move this user out of `fromAgencyId`? Only when that agency
 * is solo (no other members) and has no sales. (SPEC D1.)
 */
export async function evaluateMoveSafety(userId: string, fromAgencyId: string): Promise<MoveSafety> {
  const [salesCount, otherStaffCount] = await Promise.all([
    prisma.propertyTransaction.count({ where: { agencyId: fromAgencyId } }),
    prisma.user.count({ where: { agencyId: fromAgencyId, id: { not: userId } } }),
  ]);
  return { fromAgencyId, salesCount, otherStaffCount, safe: salesCount === 0 && otherStaffCount === 0 };
}

/**
 * Consent-guarded accept. The caller (server action) MUST pass the authenticated
 * session user; we verify the invite's email matches before touching anything.
 */
export async function acceptMoveInvite(input: {
  token: string;
  sessionUserId: string;
  sessionEmail: string;
}): Promise<MoveOutcome> {
  const invitation = await prisma.negotiatorInvitation.findUnique({
    where: { token: input.token },
    select: {
      id: true, agencyId: true, invitedByUserId: true, negotiatorEmail: true,
      acceptedAt: true, cancelledAt: true, expiresAt: true,
      agency: { select: { name: true } },
    },
  });
  if (!invitation) return { ok: false, error: "This invitation link is no longer valid." };
  if (invitation.cancelledAt) return { ok: false, error: "This invitation was cancelled." };
  if (invitation.acceptedAt) return { ok: false, error: "This invitation has already been used." };
  if (invitation.expiresAt < new Date()) return { ok: false, error: "This invitation has expired. Ask them to send a new one." };

  // Consent + identity: the accepting session must own the invited email.
  if (input.sessionEmail.toLowerCase() !== invitation.negotiatorEmail.toLowerCase()) {
    return { ok: false, error: "You're signed in with a different email than the invitation." };
  }

  const user = await prisma.user.findUnique({
    where: { id: input.sessionUserId },
    select: { id: true, email: true, name: true, agencyId: true },
  });
  if (!user) return { ok: false, error: "Account not found." };

  const invite: Invite = {
    id: invitation.id,
    agencyId: invitation.agencyId,
    invitedByUserId: invitation.invitedByUserId,
    negotiatorEmail: invitation.negotiatorEmail,
    agency: { name: invitation.agency.name },
  };

  // Already on the target agency -> consume the invite, nothing to move.
  if (user.agencyId === invite.agencyId) {
    await prisma.negotiatorInvitation
      .update({ where: { id: invite.id }, data: { acceptedAt: new Date(), acceptedByUserId: user.id } })
      .catch(() => {});
    return { ok: true, outcome: "moved", agencyName: invite.agency.name };
  }

  // No current agency -> this is a plain join, not a move. Attach like a normal
  // invite acceptance and finish.
  if (!user.agencyId) {
    await attachUser(user as Mover, invite);
    await notifyInviterJoined(invite.invitedByUserId, displayName(user), invite.agency.name);
    console.log(`[AUDIT] move_invite_joined userId=${user.id} agencyId=${invite.agencyId}`);
    return { ok: true, outcome: "moved", agencyName: invite.agency.name };
  }

  // Real move. Decide auto vs support against the live state.
  const safety = await evaluateMoveSafety(user.id, user.agencyId);
  return safety.safe ? autoMove(user as Mover, invite) : flagForSupport(user as Mover, invite, safety);
}

// ── internals ────────────────────────────────────────────────────────────────

function displayName(u: { name: string | null; email: string }): string {
  return u.name ?? u.email;
}

async function inviterFirmName(inviterUserId: string, fallback: string): Promise<string> {
  const inviter = await prisma.user.findUnique({ where: { id: inviterUserId }, select: { firmName: true } });
  return inviter?.firmName ?? fallback;
}

// Attach a no-agency user to the invite's agency (the normal-join case).
async function attachUser(user: Mover, invite: Invite): Promise<void> {
  const firmName = await inviterFirmName(invite.invitedByUserId, invite.agency.name);
  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { role: "negotiator", agencyId: invite.agencyId, firmName },
    }),
    prisma.negotiatorInvitation.update({
      where: { id: invite.id },
      data: { acceptedAt: new Date(), acceptedByUserId: user.id },
    }),
  ]);
}

// Auto path: move the sole member, retire the emptied shell (soft-archive), and
// tell both sides. Only ever called when evaluateMoveSafety said `safe`.
async function autoMove(user: Mover, invite: Invite): Promise<MoveOutcome> {
  const fromAgencyId = user.agencyId as string;
  const firmName = await inviterFirmName(invite.invitedByUserId, invite.agency.name);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { role: "negotiator", agencyId: invite.agencyId, firmName },
    }),
    prisma.agency.update({
      where: { id: fromAgencyId },
      data: {
        archivedAt: new Date(),
        archivedReason: `Emptied by invite-to-move; sole member ${user.email} moved into agency ${invite.agencyId}`,
      },
    }),
    prisma.negotiatorInvitation.update({
      where: { id: invite.id },
      data: { acceptedAt: new Date(), acceptedByUserId: user.id },
    }),
  ]);

  await createNotification({
    userId: user.id,
    type: "agency_move_done",
    payload: { title: "You're in", body: `You're now part of ${invite.agency.name}.` },
  }).catch(() => {});
  await notifyInviterJoined(invite.invitedByUserId, displayName(user), invite.agency.name);

  console.log(`[AUDIT] move_invite_auto userId=${user.id} from=${fromAgencyId} to=${invite.agencyId}`);
  return { ok: true, outcome: "moved", agencyName: invite.agency.name };
}

// Support path: real data on the current agency. Move NOTHING. Record the queue
// row (idempotent), consume the invite (consent captured), email support, and
// reassure both sides.
async function flagForSupport(user: Mover, invite: Invite, safety: MoveSafety): Promise<MoveOutcome> {
  const fromAgencyId = user.agencyId as string;

  const existing = await prisma.agencyMoveRequest.findFirst({
    where: { requesterUserId: user.id, status: "pending" },
    select: { id: true },
  });
  if (!existing) {
    await prisma.agencyMoveRequest.create({
      data: {
        requesterUserId: user.id,
        requesterEmail: user.email,
        requesterName: displayName(user),
        fromAgencyId,
        toAgencyId: invite.agencyId,
        invitedByUserId: invite.invitedByUserId,
        salesCount: safety.salesCount,
        otherStaffCount: safety.otherStaffCount,
      },
    });
  }

  await prisma.negotiatorInvitation
    .update({ where: { id: invite.id }, data: { acceptedAt: new Date(), acceptedByUserId: user.id } })
    .catch(() => {});

  const fromAgency = await prisma.agency.findUnique({ where: { id: fromAgencyId }, select: { name: true } });
  await sendEmail({
    to: SUPPORT_EMAIL,
    subject: `[Agency move] ${displayName(user)} needs moving into ${invite.agency.name}`,
    text:
      `${displayName(user)} (${user.email}) has accepted an invite to move into ${invite.agency.name}.\n\n` +
      `Their current agency "${fromAgency?.name ?? fromAgencyId}" can't be auto-moved because it has real data:\n` +
      `  - sales on it: ${safety.salesCount}\n` +
      `  - other staff on it: ${safety.otherStaffCount}\n\n` +
      `From agency id: ${fromAgencyId}\n` +
      `To agency id: ${invite.agencyId}\n` +
      `Invited by user id: ${invite.invitedByUserId}\n\n` +
      `Complete the move by hand, then mark the AgencyMoveRequest row completed.`,
  }).catch(() => {});

  await createNotification({
    userId: user.id,
    type: "agency_move_pending",
    payload: {
      title: "We're on it",
      body: `We'll move your existing sales into ${invite.agency.name} carefully and be in touch. Nothing has changed yet.`,
    },
  }).catch(() => {});
  await notifyInviterPending(invite.invitedByUserId, displayName(user));

  console.log(
    `[AUDIT] move_invite_flagged userId=${user.id} from=${fromAgencyId} to=${invite.agencyId} sales=${safety.salesCount} staff=${safety.otherStaffCount}`,
  );
  return { ok: true, outcome: "flagged", agencyName: invite.agency.name };
}

async function notifyInviterJoined(inviterUserId: string, name: string, agencyName: string): Promise<void> {
  await createNotification({
    userId: inviterUserId,
    type: "team_member_joined",
    payload: { title: `${name} has joined`, body: `${name} is now part of ${agencyName}.` },
  }).catch(() => {});
}

async function notifyInviterPending(inviterUserId: string, name: string): Promise<void> {
  await createNotification({
    userId: inviterUserId,
    type: "team_member_move_pending",
    payload: { title: `${name}'s move is underway`, body: `Our team is completing ${name}'s move into your agency.` },
  }).catch(() => {});
}
