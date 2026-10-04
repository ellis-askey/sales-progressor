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
  // White-labelled to the business: the business is the sender (name as a text
  // wordmark, no Sales Progressor hero/logo), with a light "powered by" credit in
  // the footer. Our visual style (coral CTA, clean card), their identity.
  const subject = `You've been set up with ${vars.businessName}`;
  const intro = `${vars.businessName} is progressing your sales through to completion, and has set up an account for you so you can follow every sale in one place.`;

  const text =
    `Hi,\n\n` +
    `${intro}\n\n` +
    `Set your password to log in (the link is valid for 7 days):\n` +
    `${vars.setupUrl}\n\n` +
    `Once you're in, you'll see the sales being progressed for you and where each one is up to.\n\n` +
    `${vars.businessName}\n` +
    `powered by Sales Progressor\n`;

  const html =
`<!DOCTYPE html>
<html>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;margin:0;padding:0;background:#f6f7f9">${preheader("Set your password to follow your sales in one place.")}
  <div style="max-width:560px;margin:0 auto;padding:32px 24px">
    <div style="background:#fff;border:1px solid #eceef1;border-radius:16px;padding:28px 28px 24px;color:#1a1d29">
      <!-- Business wordmark (no logo/hero — white-labelled to the business) -->
      <p style="margin:0 0 6px;font-size:18px;font-weight:800;letter-spacing:-0.01em;color:#1a1d29">${escapeHtml(vars.businessName)}</p>
      <div style="height:3px;width:40px;background:#FF6B4A;border-radius:2px;margin:0 0 22px"></div>

      <p style="margin:0 0 16px;font-size:15px">Hi,</p>

      <p style="margin:0 0 20px;font-size:14px;line-height:1.7;color:#1a1d29">
        ${escapeHtml(intro)}
      </p>

      <p style="margin:0 0 22px">
        <a href="${vars.setupUrl}" style="display:inline-block;background:#FF6B4A;color:#fff;padding:13px 26px;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px">
          Set your password
        </a>
      </p>

      <p style="margin:0;font-size:13px;line-height:1.6;color:#7a8493">
        The link is valid for 7 days. Once you're in, you'll see the sales being progressed for you and where each one is up to.
      </p>
    </div>

    <p style="margin:18px 4px 0;font-size:13px;color:#1a1d29;font-weight:600">${escapeHtml(vars.businessName)}</p>
    <p style="margin:3px 4px 0;font-size:11px;color:#9aa3af">powered by Sales Progressor</p>
  </div>
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
 * Mint a fresh set-password token for a client user and return the live setup
 * link (reusing the verificationToken + /reset-password machinery). Minting a
 * new token invalidates any previously-issued one for this email, exactly like
 * a resend. Shared by the email send below and the "copy set-up link" action so
 * there's one source of truth for the link shape (Law 4).
 */
export async function mintClientSetupLink(rawEmail: string): Promise<string> {
  const email = rawEmail.toLowerCase().trim();
  await prisma.verificationToken.deleteMany({ where: { identifier: email } });
  const token = crypto.randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + SETUP_LINK_TTL_MS);
  await prisma.verificationToken.create({ data: { identifier: email, token, expires } });

  const base = process.env.NEXTAUTH_URL ?? "https://portal.thesalesprogressor.co.uk";
  return `${base}/reset-password?token=${token}&email=${encodeURIComponent(email)}`;
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
  senderEmail?: string | null;
}): Promise<void> {
  const email = input.email.toLowerCase().trim();
  const setupUrl = await mintClientSetupLink(email);
  const built = buildClientAgentInvite({ setupUrl, businessName: input.businessName });

  await sendAgentEmail({
    to: email,
    kind: "client_agent_setup",
    userId: input.userId,
    agencyId: null,
    subject: built.subject,
    text: built.text,
    html: built.html,
    // Replies go to the business (their own sending address), falling back to our
    // neutral address if they haven't set one — never a personal TSP support inbox.
    replyTo: input.senderEmail?.trim() || "updates@thesalesprogressor.co.uk",
  });
}
