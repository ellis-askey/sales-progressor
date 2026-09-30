// Onboarding email for a client agent a progression business just added. Sends
// an honest "you've been set up, set your password" message (not the
// password-reset wording) with a live set-password link that reuses the
// existing verificationToken + /reset-password machinery.

import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { sendAgentEmail } from "@/lib/email/agent-log";
import { preheader } from "@/lib/email/preheader";

const SETUP_LINK_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days (onboarding, not a security reset)

export function buildClientAgentInvite(vars: {
  setupUrl: string;
  businessName: string;
}): { subject: string; text: string; html: string } {
  const subject = "You've been set up on Sales Progressor";
  const intro = `${vars.businessName} is using Sales Progressor to progress your sales through to completion, and has set up an account for you so you can follow every sale in one place.`;

  const text =
    `Hi,\n\n` +
    `${intro}\n\n` +
    `Set your password to log in (the link is valid for 7 days):\n` +
    `${vars.setupUrl}\n\n` +
    `Once you're in, you'll see the sales being progressed for you and where each one is up to.\n\n` +
    `Sales Progressor\n`;

  const html =
`<!DOCTYPE html>
<html>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#1a1d29;background:#fff">${preheader("Set your password to follow your sales in one place.")}
  <p style="margin:0 0 16px;font-size:15px">Hi,</p>

  <p style="margin:0 0 16px;font-size:14px;line-height:1.7;color:#1a1d29">
    ${escapeHtml(intro)}
  </p>

  <p style="margin:0 0 20px">
    <a href="${vars.setupUrl}" style="display:inline-block;background:#FF6B4A;color:#fff;padding:13px 26px;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px">
      Set your password
    </a>
  </p>

  <p style="margin:0 0 16px;font-size:13px;line-height:1.6;color:#7a8493">
    The link is valid for 7 days. Once you're in, you'll see the sales being progressed for you and where each one is up to.
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
 * Mint a set-password token and email a newly-added client agent their setup
 * link. Best-effort: a send failure is logged, not thrown — the account is valid
 * and the agent can always use "Forgot password" instead.
 */
export async function sendClientAgentSetupEmail(input: {
  userId: string;
  email: string;
  businessName: string;
}): Promise<void> {
  const email = input.email.toLowerCase().trim();
  await prisma.verificationToken.deleteMany({ where: { identifier: email } });
  const token = crypto.randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + SETUP_LINK_TTL_MS);
  await prisma.verificationToken.create({ data: { identifier: email, token, expires } });

  const base = process.env.NEXTAUTH_URL ?? "https://portal.thesalesprogressor.co.uk";
  const setupUrl = `${base}/reset-password?token=${token}&email=${encodeURIComponent(email)}`;
  const built = buildClientAgentInvite({ setupUrl, businessName: input.businessName });

  await sendAgentEmail({
    to: email,
    kind: "client_agent_setup",
    userId: input.userId,
    agencyId: null,
    subject: built.subject,
    text: built.text,
    html: built.html,
    replyTo: "support@thesalesprogressor.co.uk",
  });
}
