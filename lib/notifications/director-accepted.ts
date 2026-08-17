import { prisma } from "@/lib/prisma";
import { sendDirectorAcceptedEmail } from "@/lib/email/director-accepted";

export async function notifyNegotiatorOfAcceptance(invitationId: string): Promise<void> {
  const invitation = await prisma.directorInvitation.findUnique({
    where: { id: invitationId },
    include: {
      invitedBy: { select: { id: true, email: true, name: true } },
      acceptedBy: { select: { name: true } },
      agency: { select: { name: true } },
    },
  });

  if (!invitation?.acceptedBy) return;

  await prisma.user.update({
    where: { id: invitation.invitedByUserId },
    data: {
      directorJoinedNotificationName: invitation.acceptedBy.name,
      directorJoinedNotificationAt: new Date(),
    },
  });

  try {
    await sendDirectorAcceptedEmail({
      negotiatorName: invitation.invitedBy.name,
      negotiatorEmail: invitation.invitedBy.email,
      directorName: invitation.acceptedBy.name,
      agencyName: invitation.agency.name,
      agencyId: invitation.agencyId,
    });
  } catch (err) {
    console.error("Failed to send director-accepted email:", err);
    // In-app notification already set; email failure is non-fatal.
  }
}
