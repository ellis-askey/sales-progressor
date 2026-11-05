import { prisma } from "@/lib/prisma";

export interface ValidatedInvitation {
  id: string;
  agencyId: string;
  agencyName: string;
  directorName: string;
  directorEmail: string;
  invitedByName: string;
  // The inviting director's firm, copied onto the accepting co-director so they
  // land in the same firm-scoped team roster (which filters by firmName). Null
  // when the inviter has no firm set.
  invitedByFirmName: string | null;
}

export type InvitationValidationResult =
  | { valid: true; invitation: ValidatedInvitation }
  | { valid: false; error: "not_found" | "expired" | "already_accepted" };

export async function validateInvitationToken(token: string): Promise<InvitationValidationResult> {
  const invitation = await prisma.directorInvitation.findUnique({
    where: { token },
    include: {
      agency: { select: { name: true } },
      invitedBy: { select: { name: true, firmName: true } },
    },
  });

  if (!invitation) {
    return { valid: false, error: "not_found" };
  }

  // A cancelled invitation's link must stop working — treat it as gone.
  if (invitation.cancelledAt) {
    return { valid: false, error: "not_found" };
  }

  if (invitation.acceptedAt) {
    return { valid: false, error: "already_accepted" };
  }

  if (invitation.expiresAt < new Date()) {
    return { valid: false, error: "expired" };
  }

  return {
    valid: true,
    invitation: {
      id: invitation.id,
      agencyId: invitation.agencyId,
      agencyName: invitation.agency.name,
      directorName: invitation.directorName,
      directorEmail: invitation.directorEmail,
      invitedByName: invitation.invitedBy.name,
      invitedByFirmName: invitation.invitedBy.firmName,
    },
  };
}
