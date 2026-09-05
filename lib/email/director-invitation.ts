import { sendAgentEmail } from "@/lib/email/agent-log";
import { resolveAgencySender } from "@/lib/email/agency-sender";
import { buildTeamInvitation } from "@/lib/emails/team-invitation";
import { greetingName, nameWithoutTitle } from "@/lib/contacts/displayName";

interface DirectorInvitationEmailInput {
  directorName: string;
  directorEmail: string;
  invitedByName: string;
  agencyName: string;
  agencyId: string;
  acceptUrl: string;
}

// Redesigned lifecycle template (buildTeamInvitation), director variant.
// Greeting first-name only; inviter name title-stripped for the body.
export async function sendDirectorInvitationEmail(input: DirectorInvitationEmailInput) {
  const built = buildTeamInvitation({
    recipientName: greetingName(input.directorName),
    invitedByName: nameWithoutTitle(input.invitedByName),
    agencyName: input.agencyName,
    role: "director",
    acceptUrl: input.acceptUrl,
  });

  const { from, replyTo } = await resolveAgencySender(input.agencyId);
  return sendAgentEmail({
    to: input.directorEmail,
    subject: built.subject,
    text: built.text,
    html: built.html,
    from,
    replyTo,
    kind: "team_invite",
    meta: { agencyName: input.agencyName, invitedByName: input.invitedByName },
  });
}
