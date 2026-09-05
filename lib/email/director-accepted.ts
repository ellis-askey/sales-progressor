import { sendAgentEmail } from "@/lib/email/agent-log";
import { resolveAgencySender } from "@/lib/email/agency-sender";
import { buildTeamJoined } from "@/lib/emails/team-joined";
import { greetingName, nameWithoutTitle } from "@/lib/contacts/displayName";

interface DirectorAcceptedEmailInput {
  negotiatorName: string;
  negotiatorEmail: string;
  directorName: string;
  agencyName: string;
  agencyId: string;
}

// A director accepted → notify the inviting negotiator ("Your director has
// joined"). Redesigned lifecycle template. Greeting first-name only (the
// negotiator); the joiner's name (director) title-stripped for the body.
export async function sendDirectorAcceptedEmail(input: DirectorAcceptedEmailInput) {
  const built = buildTeamJoined({
    recipientName: greetingName(input.negotiatorName),
    joinerName: nameWithoutTitle(input.directorName),
    agencyName: input.agencyName,
    joinerRole: "director",
    ctaUrl: `${process.env.NEXTAUTH_URL ?? "https://portal.thesalesprogressor.co.uk"}/agent/hub`,
  });

  const { from, replyTo } = await resolveAgencySender(input.agencyId);
  return sendAgentEmail({
    to: input.negotiatorEmail,
    subject: built.subject,
    text: built.text,
    html: built.html,
    from,
    replyTo,
    kind: "team_accepted",
    meta: { agencyName: input.agencyName },
  });
}
