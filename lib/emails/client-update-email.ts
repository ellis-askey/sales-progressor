import type { EmailTheme } from "@/lib/email/brand-theme";

// The single branded template for a written client update: a person (agent or
// progressor) posting a visible update to a buyer or seller. One source of truth
// so the comms-panel update, the "Draft for everyone" update, the after-chase
// "keep the other side posted" updates, and progressor portal replies all look
// identical and carry the agency's colours. Replaces the old divergent markup
// (the unbranded blue one that used to live inline in portal-messages.ts).
//
// Content is agency/progressor-authored free text, rendered pre-wrap inside the
// card (parity with the previous comms.ts markup; not escaped).

export function buildClientUpdateEmail(opts: {
  agencyName: string;
  address: string;
  saleWord: string; // "sale" | "purchase"
  greeting: string; // already built, e.g. buildGreeting(contact.name)
  content: string;
  portalUrl: string;
  theme: EmailTheme;
}): { subject: string; text: string; html: string } {
  const { agencyName, address, saleWord, greeting, content, portalUrl, theme } = opts;

  const subject = `Update on your ${saleWord}: ${address}`;

  const text = [
    greeting,
    "",
    `There's a new update on your ${saleWord} at ${address}:`,
    "",
    content,
    "",
    `View your portal: ${portalUrl}`,
    "",
    agencyName,
  ].join("\n");

  const html = `<!DOCTYPE html><html><body style="font-family:-apple-system,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#1a1d29;background:#fff">
<p style="margin:0 0 8px;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:${theme.buttonBg}">${agencyName}</p>
<p style="margin:0 0 20px;font-size:14px;color:#4a5162">${address}</p>
<p style="margin:0 0 16px;font-size:15px">${greeting}</p>
<p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#8b91a3;text-transform:uppercase;letter-spacing:0.06em">New update</p>
<div style="margin:0 0 24px;padding:16px 20px;background:#F8F9FB;border-radius:12px;font-size:14px;line-height:1.6;color:#1a1d29;white-space:pre-wrap">${content}</div>
<p><a href="${portalUrl}" style="display:inline-block;background:${theme.buttonBg};color:${theme.buttonText};padding:12px 28px;border-radius:12px;text-decoration:none;font-weight:700;font-size:14px">View in portal</a></p>
<p style="margin:24px 0 0;font-size:12px;color:#8b91a3">You're receiving this because you have a ${saleWord} in progress with ${agencyName}.</p>
</body></html>`;

  return { subject, text, html };
}
