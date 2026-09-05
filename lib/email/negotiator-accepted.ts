import { sendAgentEmail } from "@/lib/email/agent-log";
import { resolveAgencySender } from "@/lib/email/agency-sender";
import { buildTeamJoined } from "@/lib/emails/team-joined";
import { greetingName, nameWithoutTitle } from "@/lib/contacts/displayName";

interface SendNegotiatorAcceptedEmailInput {
  to: string;
  directorName: string;
  negotiatorName: string;
  agencyName: string;
  agencyId: string;
  teamUrl: string;
}

// A negotiator accepted → notify the inviting director ("Your team just grew").
// Redesigned lifecycle template. Greeting first-name only (the director);
// the joiner's name (negotiator) title-stripped for the body.
export async function sendNegotiatorAcceptedEmail(
  input: SendNegotiatorAcceptedEmailInput
): Promise<void> {
  const { to, directorName, negotiatorName, agencyName, agencyId, teamUrl } = input;

  const built = buildTeamJoined({
    recipientName: greetingName(directorName),
    joinerName: nameWithoutTitle(negotiatorName),
    agencyName,
    joinerRole: "negotiator",
    ctaUrl: teamUrl,
  });

  const { from, replyTo } = await resolveAgencySender(agencyId);
  await sendAgentEmail({
    to,
    subject: built.subject,
    text: built.text,
    html: built.html,
    from,
    replyTo,
    kind: "team_accepted",
    meta: { agencyName },
  });
}
