// Emails for the "get enquiries raised" chase (enquiries rework): a gentle
// buyer nudge and a direct solicitor chase. Plain and human, matching the
// existing enquiry chase style (no branded milestone template). Personal:
// greets the solicitor handler by name where we have it, names the buyers, and
// names the seller's firm rather than "the seller's solicitor".

import { timeGreeting } from "@/lib/emails/greeting";
import { solicitorEmailSubject } from "@/lib/enquiries/chase-email";
import { emailButton, type EmailTheme } from "@/lib/email/brand-theme";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function greetingLine(recipientFirstName: string | undefined, now: Date): string {
  const name = recipientFirstName?.trim();
  return name ? `Hi ${name},` : `${timeGreeting(now)},`;
}
function joinNames(names: string[]): string {
  const c = names.filter(Boolean);
  if (c.length === 0) return "";
  if (c.length === 1) return c[0];
  return `${c.slice(0, -1).join(", ")} & ${c[c.length - 1]}`;
}

const WRAP = "font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.55;color:#111;";
const BTN = "display:inline-block;background:#111;color:#fff;text-decoration:none;padding:10px 18px;border-radius:6px;font-weight:600;";

// ── Buyer nudge (email 1) ────────────────────────────────────────────────────
// Client-facing.
export function buildRaiseBuyerEmail(input: {
  firstName: string;
  address: string;
  senderName: string;
  agencyName: string; // brand shown in the eyebrow (the client's agency)
  fileUrl: string;
  // Client-email brand theme (agency colours; coral defaults). Themes the button
  // and the eyebrow accent so this buyer nudge matches the other client emails.
  theme: EmailTheme;
  // Self-managed files: the agent's own resolved signature, appended as a
  // sign-off. Unset on outsourced files (no personal sign-off, like today).
  agentSignatureHtml?: string | null;
  agentSignatureText?: string | null;
}): { subject: string; text: string; html: string } {
  const { firstName, address, agencyName, fileUrl, theme } = input;
  const subject = `A quick check on your enquiries: ${address}`;

  const text = [
    `Hi ${firstName},`,
    ``,
    `I hope you're well.`,
    ``,
    `Your solicitor should be raising their legal enquiries around now. These are the questions they put to the seller's solicitor to clarify the legal details of the property before they can prepare their final report to you on the purchase.`,
    ``,
    `Has your solicitor confirmed that they've raised these yet? If so, please let us know on your file and we'll update it.`,
    ``,
    fileUrl,
    ``,
    `We'll be checking in with your solicitor shortly too, but if you've received an update in the meantime, please let us know.`,
    ``,
    `If you'd like a quick catch-up on anything or would prefer to talk things through, just WhatsApp us and we can arrange a call.`,
    ...(input.agentSignatureText ? [``, `Best regards,`, input.agentSignatureText] : []),
  ].join("\n");

  // Client-card layout (matches the automated client-chase email): white card,
  // agency-name eyebrow in the brand accent, themed CTA button, light footer.
  const pStyle = "font-size:15px;color:#4a5162;line-height:1.6;margin:0 0 16px;";
  const eyebrow = agencyName
    ? `<p style="font-size:11px;font-weight:700;letter-spacing:.08em;color:${theme.buttonBg};text-transform:uppercase;margin:0 0 16px;">${esc(agencyName)}</p>`
    : "";
  const signature = input.agentSignatureHtml
    ? `<div style="margin-top:8px;">${input.agentSignatureHtml}</div>`
    : "";

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f5f5f5;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:#f5f5f5;padding:40px 20px;">
    <tr><td align="center">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="560" style="background:white;border-radius:12px;padding:40px;box-shadow:0 1px 3px rgba(0,0,0,0.05);">
        <tr><td>
          ${eyebrow}
          <p style="font-size:15px;color:#1a1d29;line-height:1.6;margin:0 0 16px;">Hi ${esc(firstName)},</p>
          <p style="${pStyle}">I hope you're well.</p>
          <p style="${pStyle}">Your solicitor should be raising their legal enquiries around now. These are the questions they put to the seller's solicitor to clarify the legal details of the property before they can prepare their final report to you on the purchase.</p>
          <p style="${pStyle}">Has your solicitor confirmed that they've raised these yet? If so, please let us know on your file and we'll update it.</p>
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:4px 0;"><tr><td>${emailButton({ theme, href: fileUrl, label: "Confirm on your file" })}</td></tr></table>
          <p style="${pStyle}">We'll be checking in with your solicitor shortly too, but if you've received an update in the meantime, please let us know.</p>
          <p style="${pStyle}">If you'd like a quick catch-up on anything or would prefer to talk things through, just WhatsApp us and we can arrange a call.</p>
          ${signature}
        </td></tr>
      </table>
      <p style="margin:20px 0 0;font-size:11px;color:#c0c4d0;text-align:center;">
        <a href="mailto:support@thesalesprogressor.co.uk" style="color:#c0c4d0;text-decoration:none;">support@thesalesprogressor.co.uk</a>
      </p>
    </td></tr>
  </table>
</body>
</html>`;

  return { subject, text, html };
}

// ── Solicitor raise chase (email 2) ──────────────────────────────────────────
// Goes to the buyer's solicitor.
export function buildRaiseSolicitorEmail(input: {
  address: string;
  clientNames: string[]; // the buyer(s)
  sellerFirmName?: string; // the seller's firm, named in the body
  recipientFirstName?: string; // the handler
  senderName: string;
  agencyName: string;
  provideUpdateUrl: string;
  now?: Date;
  // Self-managed files: the agent's own resolved signature (replaces the plain
  // "Best regards, {senderName} / {agencyName}"). Unset on outsourced files.
  agentSignatureHtml?: string | null;
  agentSignatureText?: string | null;
}): { subject: string; text: string; html: string } {
  const { address, clientNames, sellerFirmName, recipientFirstName, senderName, agencyName, provideUpdateUrl } = input;
  const greeting = greetingLine(recipientFirstName, input.now ?? new Date());
  const subject = solicitorEmailSubject({ side: "purchaser", address, clientNames });
  const buyers = joinNames(clientNames) || "the buyer";
  const sellerFirm = sellerFirmName?.trim() || "the seller's solicitor";

  const line1 = `I'm progressing the purchase of ${address} on behalf of ${buyers} and wanted to check where things stand with the legal enquiries.`;
  const line2 = `Have you been able to raise your enquiries with ${sellerFirm} yet?`;
  const line3 = `If so, please can you confirm using the button below. If not, but you have an idea of when you expect to raise them, please let me know and we'll hold off checking in again until then.`;

  const text = [
    greeting,
    ``,
    `I hope you are well.`,
    ``,
    line1,
    ``,
    line2,
    ``,
    line3,
    ``,
    provideUpdateUrl,
    ``,
    `Alternatively, simply reply to this email and it will come directly to me.`,
    ``,
    `Best regards,`,
    input.agentSignatureText ?? `${senderName}\n${agencyName}`,
  ].join("\n");

  const signoffHtml = input.agentSignatureHtml
    ? `<p>Best regards,</p>${input.agentSignatureHtml}`
    : `<p>Best regards,<br>${esc(senderName)}<br>${esc(agencyName)}</p>`;

  const html = `<div style="${WRAP}">
<p>${esc(greeting)}</p>
<p>I hope you are well.</p>
<p>${esc(line1)}</p>
<p>${esc(line2)}</p>
<p>${esc(line3)}</p>
<p><a href="${esc(provideUpdateUrl)}" style="${BTN}">Provide an update</a></p>
<p>Alternatively, simply reply to this email and it will come directly to me.</p>
${signoffHtml}
</div>`;

  return { subject, text, html };
}
