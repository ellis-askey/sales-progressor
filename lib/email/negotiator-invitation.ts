import { sendAgentEmail } from "@/lib/email/agent-log";
import { resolveAgencySender } from "@/lib/email/agency-sender";
import { buildTeamInvitation } from "@/lib/emails/team-invitation";
import { greetingName, nameWithoutTitle } from "@/lib/contacts/displayName";

interface SendNegotiatorInvitationEmailInput {
  to: string;
  negotiatorName: string;
  invitedByName: string;
  agencyName: string;
  agencyId: string;
  acceptUrl: string;
}

// Redesigned lifecycle template (buildTeamInvitation). Greeting is first-name
// only (greetingName, "there" fallback); the inviter's name has any title
// stripped for the body sentence. Sender resolves to the agency's verified
// address if set, else Sales Progressor.
export async function sendNegotiatorInvitationEmail(
  input: SendNegotiatorInvitationEmailInput
): Promise<void> {
  const { to, negotiatorName, invitedByName, agencyName, agencyId, acceptUrl } = input;

  const built = buildTeamInvitation({
    recipientName: greetingName(negotiatorName),
    invitedByName: nameWithoutTitle(invitedByName),
    agencyName,
    role: "negotiator",
    acceptUrl,
  });

  const { from, replyTo } = await resolveAgencySender(agencyId);
  await sendAgentEmail({
    to,
    subject: built.subject,
    text: built.text,
    html: built.html,
    from,
    replyTo,
    kind: "team_invite",
    meta: { agencyName, invitedByName },
  });
}
