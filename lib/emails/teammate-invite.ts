// Onboarding email for a progressor a business OWNER just added to their own
// team (distinct from client-agent-invite.ts, which greets an agency's agent as
// a client). This one is colleague-framed: "you've been added to the team so you
// can progress sales alongside them" — and it greets by first name. Reuses the
// same verificationToken + /reset-password set-password machinery via
// mintClientSetupLink, so there's one source of truth for the link shape (Law 4).

import { sendAgentEmail } from "@/lib/email/agent-log";
import { preheader } from "@/lib/email/preheader";
import { extractFirstName } from "@/lib/contacts/displayName";
import { mintClientSetupLink } from "@/lib/emails/client-agent-invite";

export function buildTeammateInvite(vars: {
  setupUrl: string;
  businessName: string;
  firstName: string;
}): { subject: string; text: string; html: string } {
  const greet = vars.firstName || "there";
  const subject = `You've been added to the ${vars.businessName} team on Sales Progressor`;
  const intro =
    `${vars.businessName} has added you to their team on Sales Progressor, the platform they use to progress property sales through to completion. ` +
    `Once you're set up, you'll be able to pick up and progress sales alongside the rest of the team.`;

  const text =
    `Hi ${greet},\n\n` +
    `${intro}\n\n` +
    `Set your password to log in (the link is valid for 7 days):\n` +
    `${vars.setupUrl}\n\n` +
    `Any sales assigned to you, and any the owner shares with you, will be waiting when you sign in.\n\n` +
    `Sales Progressor\n`;

  const html =
`<!DOCTYPE html>
<html>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#1a1d29;background:#fff">${preheader("Set your password and start progressing sales with the team.")}
  <p style="margin:0 0 16px;font-size:15px">Hi ${escapeHtml(greet)},</p>

  <p style="margin:0 0 16px;font-size:14px;line-height:1.7;color:#1a1d29">
    ${escapeHtml(intro)}
  </p>

  <p style="margin:0 0 20px">
    <a href="${vars.setupUrl}" style="display:inline-block;background:#FF6B4A;color:#fff;padding:13px 26px;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px">
      Set your password
    </a>
  </p>

  <p style="margin:0 0 16px;font-size:13px;line-height:1.6;color:#7a8493">
    The link is valid for 7 days. Any sales assigned to you, and any the owner shares with you, will be waiting when you sign in.
  </p>

  <p style="margin:0;font-size:14px;color:#1a1d29">Sales Progressor</p>
</body>
</html>`;

  return { subject, text, html };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Mint a set-password token and email a newly-added teammate their setup link.
 * Best-effort: a send failure is logged by the caller, not thrown — the account
 * is valid and they can always use "Forgot password" instead.
 */
export async function sendTeammateSetupEmail(input: {
  userId: string;
  email: string;
  name: string;
  businessName: string;
}): Promise<void> {
  const email = input.email.toLowerCase().trim();
  const setupUrl = await mintClientSetupLink(email);
  const firstName = safeFirstName(input.name);
  const built = buildTeammateInvite({ setupUrl, businessName: input.businessName, firstName });

  await sendAgentEmail({
    to: email,
    kind: "teammate_setup",
    userId: input.userId,
    agencyId: null,
    subject: built.subject,
    text: built.text,
    html: built.html,
    replyTo: "support@thesalesprogressor.co.uk",
  });
}

// extractFirstName can return a "the contact" style fallback when it can't find
// a usable given name; in a greeting we'd rather say "there".
function safeFirstName(name: string): string {
  const first = extractFirstName(name || "").trim();
  if (!first || first === "the contact" || first.includes(" ")) return "";
  return first;
}
