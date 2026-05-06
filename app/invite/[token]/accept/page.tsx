import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { validateInvitationToken } from "@/lib/auth/validate-invitation-token";
import { prisma } from "@/lib/prisma";
import { notifyNegotiatorOfAcceptance } from "@/lib/notifications/director-accepted";

interface AcceptPageProps {
  params: Promise<{ token: string }>;
}

// This page is the callbackUrl for SSO sign-ins from the invite landing page.
// By the time the user reaches here, NextAuth has created (or found) their account.
// We validate the invitation, check email match, and attach them to the agency.
export default async function InviteAcceptPage({ params }: AcceptPageProps) {
  const { token } = await params;

  const session = await getServerSession(authOptions);

  // No session means the OAuth flow didn't complete — send back to landing
  if (!session?.user) {
    redirect(`/invite/${token}`);
  }

  const result = await validateInvitationToken(token);

  if (!result.valid) {
    // Invitation is gone/expired/already used — send to hub if they have a role,
    // otherwise send to login so they can figure out their account state.
    if (session.user.agencyId) {
      redirect("/agent/hub");
    }
    redirect(`/invite/${token}`);
  }

  // Email must match. If they signed in with a different account, don't attach.
  const emailMatch =
    session.user.email.toLowerCase() === result.invitation.directorEmail.toLowerCase();

  if (!emailMatch) {
    // Wrong account — redirect back to landing with a message
    redirect(`/invite/${token}?mismatch=1`);
  }

  // Check the user doesn't already have an agency (idempotency)
  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { agencyId: true, role: true },
  });

  if (!dbUser?.agencyId) {
    // Atomically attach user to the invitation's agency as director
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: session.user.id },
        data: { role: "director", agencyId: result.invitation.agencyId },
      });
      await tx.directorInvitation.update({
        where: { id: result.invitation.id },
        data: { acceptedAt: new Date(), acceptedByUserId: session.user.id },
      });
    });

    await notifyNegotiatorOfAcceptance(result.invitation.id);

    console.log(`[AUDIT] director_invitation_accepted invitationId=${result.invitation.id} userId=${session.user.id}`);
  }
  // If dbUser.agencyId is already set, the invitation was already processed
  // (e.g. double-hit from the browser). Redirect to hub without re-processing.

  // The JWT still has the old role/agencyId from the OAuth sign-in moment.
  // Redirecting to / triggers the jwt callback which re-fetches from DB and
  // updates the token (the needsSignupCompletion re-fetch path covers this).
  redirect("/");
}
