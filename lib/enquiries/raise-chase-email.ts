// Emails for the "get enquiries raised" chase (enquiries rework): a gentle
// buyer nudge and a direct solicitor chase. Plain and human, matching the
// existing enquiry chase style (no branded milestone template). The solicitor
// subject follows the house convention "Purchase of <address>, Client(s): ...".

import { timeGreeting } from "@/lib/emails/greeting";
import { solicitorEmailSubject } from "@/lib/enquiries/chase-email";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const WRAP = "font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.55;color:#111;";
const BTN = "display:inline-block;background:#111;color:#fff;text-decoration:none;padding:10px 18px;border-radius:6px;font-weight:600;";

// ── Buyer nudge ──────────────────────────────────────────────────────────────
// Client-facing. Subject matches the house pattern "<statement>: <address>".
export function buildRaiseBuyerEmail(input: {
  firstName: string;
  address: string;
  senderName: string;
  agencyName: string;
  fileUrl: string;
}): { subject: string; text: string; html: string } {
  const { firstName, address, senderName, agencyName, fileUrl } = input;
  const subject = `A quick check on your enquiries: ${address}`;

  const text = [
    `Hi ${firstName},`,
    ``,
    `Around now, your solicitor should be raising the legal enquiries on ${address}. These are the questions your solicitor puts to the seller's side about the property before you're committed.`,
    ``,
    `Has your solicitor told you they've raised them yet? If so, let us know on your file and we'll update it.`,
    ``,
    fileUrl,
    ``,
    `If not, there's nothing you need to do. We're checking in with your solicitor too, and we'll keep things moving.`,
    ``,
    `Kind regards,`,
    senderName,
    agencyName,
  ].join("\n");

  const html = `<div style="${WRAP}">
<p>Hi ${esc(firstName)},</p>
<p>Around now, your solicitor should be raising the legal enquiries on ${esc(address)}. These are the questions your solicitor puts to the seller's side about the property before you're committed.</p>
<p>Has your solicitor told you they've raised them yet? If so, let us know on your file and we'll update it.</p>
<p><a href="${esc(fileUrl)}" style="${BTN}">Confirm on your file</a></p>
<p>If not, there's nothing you need to do. We're checking in with your solicitor too, and we'll keep things moving.</p>
<p>Kind regards,<br>${esc(senderName)}<br>${esc(agencyName)}</p>
</div>`;

  return { subject, text, html };
}

// ── Solicitor chase ─────────────────────────────────────────────────────────
// Goes to the buyer's solicitor. Subject: "Purchase of <address>, Client(s): ...".
export function buildRaiseSolicitorEmail(input: {
  address: string;
  clientNames: string[]; // the buyer(s)
  senderName: string;
  agencyName: string;
  provideUpdateUrl: string;
  now?: Date;
}): { subject: string; text: string; html: string } {
  const { address, clientNames, senderName, agencyName, provideUpdateUrl } = input;
  const greeting = timeGreeting(input.now ?? new Date());
  const subject = solicitorEmailSubject({ side: "purchaser", address, clientNames });

  const text = [
    `${greeting},`,
    ``,
    `I hope you are well.`,
    ``,
    `I'm progressing the purchase of ${address} on behalf of the buyer, and just wanted to check on the enquiries. Have you been able to raise your enquiries with the seller's solicitor yet?`,
    ``,
    `If you have, you can confirm using the link below. If you have a date in mind, let me know and we'll hold off chasing until then.`,
    ``,
    provideUpdateUrl,
    ``,
    `Or simply reply to this email and it will reach me directly.`,
    ``,
    `Kind regards,`,
    senderName,
    agencyName,
  ].join("\n");

  const html = `<div style="${WRAP}">
<p>${esc(greeting)},</p>
<p>I hope you are well.</p>
<p>I'm progressing the purchase of ${esc(address)} on behalf of the buyer, and just wanted to check on the enquiries. Have you been able to raise your enquiries with the seller's solicitor yet?</p>
<p>If you have, you can confirm using the button below. If you have a date in mind, let me know and we'll hold off chasing until then.</p>
<p><a href="${esc(provideUpdateUrl)}" style="${BTN}">Provide an update</a></p>
<p>Or simply reply to this email and it will reach me directly.</p>
<p>Kind regards,<br>${esc(senderName)}<br>${esc(agencyName)}</p>
</div>`;

  return { subject, text, html };
}
