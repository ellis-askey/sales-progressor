import { prisma } from "@/lib/prisma";

export interface ValidatedNegotiatorInvitation {
  id: string;
  agencyId: string;
  agencyName: string;
  negotiatorName: string;
  negotiatorEmail: string;
  invitedByName: string;
  invitedByUserId: string;
}

export type NegotiatorInvitationValidationResult =
  | { valid: true; invitation: ValidatedNegotiatorInvitation }
  | { valid: false; error: "not_found" | "expired" | "already_accepted" | "cancelled" };

export async function validateNegotiatorInvitationToken(
  token: string
): Promise<NegotiatorInvitationValidationResult> {
  const inv = await prisma.negotiatorInvitation.findUnique({
    where: { token },
    include: {
      agency:    { select: { name: true } },
      invitedBy: { select: { name: true } },
    },
  });

  if (!inv)              return { valid: false, error: "not_found" };
  if (inv.cancelledAt)   return { valid: false, error: "cancelled" };
  if (inv.acceptedAt)    return { valid: false, error: "already_accepted" };
  if (inv.expiresAt < new Date()) return { valid: false, error: "expired" };

  return {
    valid: true,
    invitation: {
      id:              inv.id,
      agencyId:        inv.agencyId,
      agencyName:      inv.agency.name,
      negotiatorName:  inv.negotiatorName,
      negotiatorEmail: inv.negotiatorEmail,
      invitedByName:   inv.invitedBy.name,
      invitedByUserId: inv.invitedByUserId,
    },
  };
}
