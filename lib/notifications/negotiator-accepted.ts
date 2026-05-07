import { prisma } from "@/lib/prisma";
import { sendNegotiatorAcceptedEmail } from "@/lib/email/negotiator-accepted";

export async function notifyDirectorOfAcceptance(invitationId: string): Promise<void> {
  const inv = await prisma.negotiatorInvitation.findUnique({
    where: { id: invitationId },
    include: {
      invitedBy: { select: { name: true, email: true } },
      agency:    { select: { name: true } },
    },
  });

  if (!inv) return;

  const appUrl = process.env.NEXTAUTH_URL ?? "https://portal.thesalesprogressor.co.uk";

  await sendNegotiatorAcceptedEmail({
    to:              inv.invitedBy.email,
    directorName:    inv.invitedBy.name,
    negotiatorName:  inv.negotiatorName,
    agencyName:      inv.agency.name,
    teamUrl:         `${appUrl}/agent/settings`,
  });
}
