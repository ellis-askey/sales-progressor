// One-shot: send the "added to chain" agent invite email to a fixed
// recipient with realistic test data so Ellis can see the inbox render.
// Mirrors lib/chain/invite.ts → buildInviteHtml/buildInviteText
// byte-for-byte; the production builders aren't exported, so they're
// inlined here. If the prod template changes, update both.
//
// Run:
//   npx tsx scripts/send-test-chain-invite.ts
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import sgMail from "@sendgrid/mail";

const RECIPIENT = "ellisaskey@googlemail.com";
const FROM = "Akeman Residential via Sales Progressor <updates@thesalesprogressor.co.uk>";

// ─── Test data ───────────────────────────────────────────────────────
const v = {
  recipientName: "Bramham & Brown",
  originatorName: "Sarah Hughes",
  originatorAgency: "Akeman Residential",
  originatorAddress: "12 Mill Lane, Chesham, HP5 1JF",
  stubAddress: "47 Greenway, Aylesbury, HP19 8DB",
  positionDesc: "sale above",
  linkPosition: 2,
  totalLinks: 4,
  claimedCount: 2,
  claimUrl: "https://portal.thesalesprogressor.co.uk/claim?token=TEST_TOKEN_DO_NOT_CLICK",
  declineUrl: "https://portal.thesalesprogressor.co.uk/claim/decline?token=TEST_TOKEN_DO_NOT_CLICK",
};

type InviteVars = {
  recipientName: string;
  originatorName: string;
  originatorAgency: string;
  originatorAddress: string;
  stubAddress: string;
  positionDesc: string;
  linkPosition: number;
  totalLinks: number;
  claimedCount: number;
  claimUrl: string;
  declineUrl: string;
};

// ─── Inlined builders (kept in sync with lib/chain/invite.ts) ────────
function buildInviteHtml(v: InviteVars): string {
  const claimedSuffix = v.claimedCount === 1 ? "agent is" : "agents are";
  return `<!DOCTYPE html><html><body style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:560px;margin:0 auto;padding:0;color:#1a1d29;background:#fff">
<div style="background:linear-gradient(135deg,#FF8A65 0%,#FFB74D 100%);padding:32px 32px 28px;border-radius:0 0 24px 24px">
  <p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:rgba(255,255,255,0.75)">Chain invite</p>
  <h1 style="margin:0;font-size:20px;font-weight:700;color:#fff;line-height:1.3">You've been added to a live chain</h1>
</div>
<div style="padding:28px 32px">
  <p style="margin:0 0 16px;font-size:15px">Hello ${v.recipientName},</p>
  <p style="margin:0 0 16px;font-size:14px;line-height:1.7;color:#4a5162">${v.originatorName} at ${v.originatorAgency} has added you to a live sales chain on Sales Progressor.</p>
  <p style="margin:0 0 24px;font-size:14px;line-height:1.7;color:#4a5162">They're tracking the sale of <strong>${v.originatorAddress}</strong> and have linked your sale at <strong>${v.stubAddress}</strong> as the ${v.positionDesc}.</p>
  <div style="margin:0 0 24px;padding:16px 20px;background:#FFF8F6;border-left:3px solid #FF6B4A;border-radius:8px">
    <p style="margin:0 0 4px;font-size:13px;font-weight:600;color:#1a1d29">You're #${v.linkPosition} of ${v.totalLinks} in this chain</p>
    <p style="margin:0;font-size:12px;color:#8b91a3">${v.claimedCount} ${claimedSuffix} already tracking this chain together</p>
  </div>
  <p style="margin:0 0 24px;font-size:14px;line-height:1.7;color:#4a5162">Claim your place and you'll see how every sale in the chain is progressing in real time. Fewer chase calls, no more guessing where the holdup is, faster exchanges for everyone.</p>
  <p style="margin:0 0 28px">
    <a href="${v.claimUrl}" style="display:inline-block;background:#FF6B4A;color:#fff;padding:13px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px">Claim this sale</a>
  </p>
  <p style="margin:0 0 16px;font-size:12px;color:#8b91a3">If the button doesn't work, copy and paste this link into your browser:<br><a href="${v.claimUrl}" style="color:#3b82f6;word-break:break-all">${v.claimUrl}</a></p>
  <p style="margin:0 0 24px;font-size:12px;color:#8b91a3">Not the right agent for this sale? <a href="${v.declineUrl}" style="color:#8b91a3;text-decoration:underline">Decline this invite →</a></p>
  <p style="margin:0;font-size:12px;color:#8b91a3">Need help? <a href="mailto:support@thesalesprogressor.co.uk" style="color:#8b91a3">support@thesalesprogressor.co.uk</a></p>
  <p style="margin:24px 0 0;font-size:11px;color:#c0c4d0;text-align:center">Powered by <a href="https://www.thesalesprogressor.co.uk" style="color:#c0c4d0;text-decoration:none">Sales Progressor</a></p>
</div>
</body></html>`;
}

function buildInviteText(v: InviteVars): string {
  return `Hello ${v.recipientName},

${v.originatorName} at ${v.originatorAgency} has added you to a live sales chain on Sales Progressor.

They're tracking the sale of ${v.originatorAddress} and have linked your sale at ${v.stubAddress} as the ${v.positionDesc}.

You're #${v.linkPosition} of ${v.totalLinks} in this chain. ${v.claimedCount} agent${v.claimedCount !== 1 ? "s are" : " is"} already tracking it together.

Claim your place and you'll see how every sale in the chain is progressing in real time. Fewer chase calls, no more guessing where the holdup is, faster exchanges for everyone.

Claim this sale: ${v.claimUrl}

Not the right agent for this sale? Decline this invite: ${v.declineUrl}

Need help? support@thesalesprogressor.co.uk
`;
}

async function main() {
  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) {
    console.error("SENDGRID_API_KEY is not set in env.");
    process.exit(1);
  }
  sgMail.setApiKey(apiKey);

  const subject = `${v.originatorAgency} has added you to a live chain: ${v.originatorAddress}`;
  const html = buildInviteHtml(v);
  const text = buildInviteText(v);

  console.log("Subject:", subject);
  console.log("From:   ", FROM);
  console.log("To:     ", RECIPIENT);
  console.log("Sending...");

  await sgMail.send({ to: RECIPIENT, from: FROM, subject, text, html });
  console.log("✓ Sent.");
}

main().catch((err: unknown) => {
  console.error("Send failed:", err);
  const errObj = err as { response?: { body?: unknown } };
  if (errObj.response?.body) console.error(JSON.stringify(errObj.response.body, null, 2));
  process.exit(1);
});
