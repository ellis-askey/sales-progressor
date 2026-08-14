// The enquiries chase email — plain, human, and pointed at whoever holds the
// ball. Deliberately NOT the branded milestone template: it reads like a note
// a person would send from Outlook, and the solicitor can just reply (which
// lands in the sender's inbox and counts as a movement) or tap the button.
//
// Two directions, keyed on the tracker's whose-court state:
//   - seller_solicitor: they owe the replies -> "any update on the replies?"
//   - buyer_solicitor:  they're reviewing    -> "satisfied, or anything left?"
//
// Variant-agnostic: enquiries chasing is identical across freehold/leasehold
// and every funding type, so there is no tenure/purchaseType conditioning.

import { timeGreeting } from "@/lib/emails/greeting";

export type EnquiryChaseCourt = "seller_solicitor" | "buyer_solicitor";

export type EnquiryChaseInput = {
  court: EnquiryChaseCourt;
  address: string;
  senderName: string; // the person the email is from
  agencyName: string;
  provideUpdateUrl: string;
  now?: Date;
};

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildEnquiryChaseEmail(input: EnquiryChaseInput): {
  subject: string;
  text: string;
  html: string;
} {
  const { court, address, senderName, agencyName, provideUpdateUrl } = input;
  const greeting = timeGreeting(input.now ?? new Date());
  const subject = `Enquiries on ${address}`;

  const isSeller = court === "seller_solicitor";
  const opener = isSeller
    ? `I'm just chasing for an update on the outstanding enquiries for ${address}.`
    : `I'm just chasing for an update on the enquiries for ${address}.`;
  const ask = isSeller
    ? `Would you be able to let me know where things currently stand, and whether there's anything holding up the remaining responses at your end?`
    : `Would you be able to let me know whether you're now satisfied with the replies, or if anything is still outstanding?`;

  const text = [
    `${greeting},`,
    ``,
    `I hope you are well.`,
    ``,
    `${opener} ${ask}`,
    ``,
    `If it's easier, you can use the link below to post a quick update, or simply reply to this email.`,
    ``,
    provideUpdateUrl,
    ``,
    `Kind regards,`,
    senderName,
    agencyName,
  ].join("\n");

  const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.55;color:#111;">
<p>${esc(greeting)},</p>
<p>I hope you are well.</p>
<p>${esc(opener)} ${esc(ask)}</p>
<p>If it's easier, you can use the button below to post a quick update, or simply reply to this email.</p>
<p><a href="${esc(provideUpdateUrl)}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:10px 18px;border-radius:6px;font-weight:600;">Provide an update</a></p>
<p>Kind regards,<br>${esc(senderName)}<br>${esc(agencyName)}</p>
</div>`;

  return { subject, text, html };
}
