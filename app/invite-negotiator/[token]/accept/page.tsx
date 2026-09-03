import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { validateNegotiatorInvitationToken } from "@/lib/auth/validate-negotiator-invitation-token";
import { prisma } from "@/lib/prisma";
import { notifyDirectorOfAcceptance } from "@/lib/notifications/negotiator-accepted";

interface AcceptPageProps {
  params: Promise<{ token: string }>;
}

// OAuth callbackUrl target. By the time the user lands here, NextAuth/PrismaAdapter
// has already created (or found) their User record. We validate the invitation,
// check email match, and atomically assign role + agencyId.
export default async function NegotiatorInviteAcceptPage({ params }: AcceptPageProps) {
  const { token } = await params;

  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect(`/invite-negotiator/${token}`);
  }

  const result = await validateNegotiatorInvitationToken(token);

  if (!result.valid) {
    if (session.user.agencyId) {
      redirect("/agent/hub");
    }
    redirect(`/invite-negotiator/${token}`);
  }

  const emailMatch =
    session.user.email.toLowerCase() === result.invitation.negotiatorEmail.toLowerCase();

  if (!emailMatch) {
    redirect(`/invite-negotiator/${token}?mismatch=1`);
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { agencyId: true },
  });

  if (!dbUser?.agencyId) {
    // Inherit the inviting director's firm badge — same branch the password
    // acceptance path assigns (accept-negotiator-invitation-password.ts). This
    // OAuth path previously omitted firmName, so Microsoft-signup negotiators
    // landed with a null branch and became invisible to their firm-scoped
    // director (Siobhan Becker / Walnut Tree Barn, 2026-09). Fall back to the
    // agency name so a negotiator can never be created branch-less again.
    const inviter = await prisma.user.findUnique({
      where: { id: result.invitation.invitedByUserId },
      select: { firmName: true },
    });
    const firmName = inviter?.firmName ?? result.invitation.agencyName;

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: session.user.id },
        data: { role: "negotiator", agencyId: result.invitation.agencyId, firmName },
      });
      await tx.negotiatorInvitation.update({
        where: { id: result.invitation.id },
        data: { acceptedAt: new Date(), acceptedByUserId: session.user.id },
      });
    });

    notifyDirectorOfAcceptance(result.invitation.id).catch(console.error);

    console.log(`[AUDIT] negotiator_invitation_accepted invitationId=${result.invitation.id} userId=${session.user.id}`);
  }

  redirect("/");
}
