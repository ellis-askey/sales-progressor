import type { SolicitorSide } from "./codes";
import { preheader } from "@/lib/email/preheader";

// Builds the solicitor confirmation digest email — the productionised version
// of the validated demo. One email per (file, side): a single open step shows
// the same "update" flow as multiple, all landing on the confirm page which
// holds the real per-step controls. Voice is first-person in-house staff (not
// outsourced) and the body names the SELLER (our instructing client); the
// subject names the RECIPIENT's own client.
//
// 2026-08-27 redesign to the approved mock: concise progress-update tone, a
// hosted QR to open on a phone, a reply-by-email line, one trust sentence, and
// a personal signature (the person looking after the file: name, agency, phone,
// avatar). Icons are hosted PNGs (public/email-icons/*) so they render in every
// client. See docs/active/solicitor-portal/00-discovery.md.

export type SolicitorDigestInput = {
  brand: string; // agency name — letterhead + signature
  address: string;
  pricePence: number | null;
  sellerNames: string; // body: "I'm looking after {sellerNames}"
  buyerNames: string;
  side: SolicitorSide;
  firmName: string | null; // recipient firm (matter block)
  ownClientNames: string; // subject: recipient solicitor's own client(s)
  steps: { label: string }[];
  confirmUrl: string; // {baseUrl}/s/{token}
  stopUrl: string; // {baseUrl}/s/{token}/stop
  qrUrl?: string; // {baseUrl}/s/{token}/qr — hosted PNG; scan to open on phone
  // Signature: the person looking after the file (assigned progressor on an
  // outsourced file, else the agency's agent).
  personName: string;
  personPhone?: string | null;
  avatarUrl?: string | null; // public avatar URL, or null
};

const NAVY = "#0f2740";
const INK = "#33475b";
const MUTED = "#6b7c93";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function formatPrice(pence: number | null): string | null {
  if (pence == null) return null;
  return `£${Math.round(pence / 100).toLocaleString("en-GB")}`;
}

export function solicitorDigestSubject(address: string, ownClientNames: string): string {
  // "Client:" for one, "Clients:" for a joint pair. No em dash (Law 21).
  const plural = / & |, /.test(ownClientNames);
  return `${address} - ${plural ? "Clients" : "Client"}: ${ownClientNames}`;
}

export function buildSolicitorDigestEmail(input: SolicitorDigestInput): {
  subject: string;
  html: string;
  text: string;
} {
  const { brand, address, sellerNames, side, firmName, steps, confirmUrl, stopUrl, qrUrl } = input;
  const { personName, personPhone, avatarUrl } = input;
  const single = steps.length === 1;
  const actingFor = side === "vendor" ? "The seller" : "The buyer";
  const price = formatPrice(input.pricePence);
  const subject = solicitorDigestSubject(address, input.ownClientNames);
  const itemsWord = single ? "item" : "items";
  const theseItems = single ? "this item" : `these ${steps.length} items`;

  // Hosted PNG badge icons (render in every client, unlike inline SVG). Base is
  // derived from the confirm URL so it points at the same deployment.
  const assetBase = confirmUrl.split("/s/")[0];
  const icon = (file: string, size: number) =>
    `<img src="${assetBase}/email-icons/${file}" width="${size}" height="${size}" alt="" style="display:block;" />`;

  const matterRow = (label: string, value: string) =>
    `<tr><td style="padding:6px 0;color:${MUTED};font-size:13px;line-height:1.5;">${label}</td><td align="right" style="padding:6px 0;color:${NAVY};font-size:13px;font-weight:600;line-height:1.5;text-align:right;">${esc(value)}</td></tr>`;

  const matterRows = [
    matterRow("Property", address),
    price ? matterRow("Sale price", price) : "",
    sellerNames ? matterRow("Seller", sellerNames) : "",
    input.buyerNames ? matterRow("Buyer", input.buyerNames) : "",
    firmName ? matterRow("Your firm", firmName) : "",
    matterRow("You are acting for", actingFor),
  ].join("");

  // Steps: a plain bordered rounded box, each row a doc badge + label.
  const stepsList = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #dde5ee;border-radius:10px;">
    ${steps
      .map(
        (s, i) =>
          `<tr><td style="padding:14px 16px;${i < steps.length - 1 ? "border-bottom:1px solid #eaeff5;" : ""}">
             <table role="presentation" cellpadding="0" cellspacing="0" width="100%"><tr>
               <td width="30" valign="middle">${icon("doc.png", 30)}</td>
               <td valign="middle" style="padding-left:12px;font-size:14px;font-weight:600;color:${NAVY};line-height:1.4;">${esc(s.label)}</td>
             </tr></table>
           </td></tr>`,
      )
      .join("")}
  </table>`;

  // Bulletproof button: fill + padding on the <td> (Outlook ignores them on <a>).
  const button = `<table role="presentation" cellpadding="0" cellspacing="0" width="100%"><tr>
     <td align="center" bgcolor="${NAVY}" style="border-radius:8px;padding:15px 18px;">
       <a href="${confirmUrl}" style="font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;">Update ${theseItems}</a>
     </td></tr></table>`;

  const qrRow = qrUrl
    ? `<table role="presentation" cellpadding="0" cellspacing="0"><tr>
         <td valign="middle" width="116"><img src="${qrUrl}" alt="Scan to open on your phone" width="104" height="104" style="display:block;border:1px solid #e3e9f0;border-radius:10px;" /></td>
         <td valign="middle" style="padding-left:16px;">
           <table role="presentation" cellpadding="0" cellspacing="0"><tr>
             <td valign="top" width="36">${icon("phone.png", 36)}</td>
             <td valign="middle" style="padding-left:12px;">
               <p style="margin:0;font-size:14px;font-weight:700;color:${NAVY};line-height:1.4;">On your phone?</p>
               <p style="margin:2px 0 0;font-size:13px;color:${MUTED};line-height:1.4;">Scan to update instead.</p>
             </td>
           </tr></table>
         </td>
       </tr></table>`
    : "";

  // Signature: avatar (if any) + name / agency / phone.
  const signature = `<table role="presentation" cellpadding="0" cellspacing="0"><tr>
    ${avatarUrl ? `<td valign="middle" width="48"><img src="${avatarUrl}" width="48" height="48" alt="" style="display:block;border-radius:24px;" /></td>` : ""}
    <td valign="middle" style="${avatarUrl ? "padding-left:12px;" : ""}">
      <p style="margin:0;font-size:14px;font-weight:700;color:${NAVY};line-height:1.4;">${esc(personName)}</p>
      <p style="margin:2px 0 0;font-size:13px;color:${MUTED};line-height:1.4;">${esc(brand)}</p>
      ${personPhone ? `<p style="margin:2px 0 0;font-size:13px;color:${MUTED};line-height:1.4;">${esc(personPhone)}</p>` : ""}
    </td>
  </tr></table>`;

  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:24px;background:#eef1f5;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">${preheader(`A couple of steps on this sale are waiting for your update.`)}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;"><tr><td>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${NAVY};border-radius:10px 10px 0 0;">
    <tr><td style="padding:22px 28px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      <td style="font-size:18px;font-weight:700;color:#ffffff;letter-spacing:.2px;">${esc(brand)}</td>
      <td align="right" style="font-size:11px;color:#9fb3c8;text-transform:uppercase;letter-spacing:1.4px;">Progress update</td>
    </tr></table></td></tr>
  </table>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border-left:1px solid #dfe5ec;border-right:1px solid #dfe5ec;">
    <tr><td style="padding:30px 28px 6px;">
      <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:${INK};">I hope you&rsquo;re well. I&rsquo;m looking after <strong style="color:${NAVY};">${esc(sellerNames || "our client")}</strong> and helping keep things moving on this sale.</p>
      <p style="margin:0;font-size:15px;line-height:1.6;color:${INK};">When you get a moment, could you let me know where things stand with the ${itemsWord} below?</p>
    </td></tr>
    <tr><td style="padding:18px 28px 6px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f8fb;border:1px solid #e3e9f0;border-radius:8px;"><tr><td style="padding:16px 18px;">
        <p style="margin:0 0 8px;font-size:10px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;color:${MUTED};">Matter details</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${matterRows}</table>
      </td></tr></table>
    </td></tr>
    <tr><td style="padding:20px 28px 4px;">
      <p style="margin:0 0 12px;font-size:15px;font-weight:600;color:${NAVY};">Could you update me on ${theseItems}?</p>
      ${stepsList}
    </td></tr>
    <tr><td style="padding:22px 28px 4px;">
      ${button}
      <p style="margin:12px 0 0;font-size:13px;line-height:1.55;color:${INK};">Rather reply by email? Just reply to this message with an update. Thank you!</p>
      <p style="margin:12px 0 0;font-size:13px;line-height:1.55;color:${INK};">A quick update here keeps the buyer and seller informed on our side, so you hear from us less.</p>
    </td></tr>
    ${qrUrl ? `<tr><td style="padding:16px 28px 8px;"><div style="border-top:1px solid #eef1f5;padding-top:18px;">${qrRow}</div></td></tr>` : ""}
    <tr><td style="padding:18px 28px 26px;">
      <p style="margin:0 0 12px;font-size:14px;color:${INK};line-height:1.6;">Many thanks for your help,</p>
      ${signature}
    </td></tr>
  </table>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f8fb;border:1px solid #dfe5ec;border-top:none;border-radius:0 0 10px 10px;">
    <tr><td style="padding:18px 28px;">
      <p style="margin:0 0 6px;font-size:11px;line-height:1.6;color:#8493a8;">Sent by ${esc(brand)} in relation to the matter above. If you&rsquo;re not the right person for this file, just reply and let me know.</p>
      <p style="margin:0;font-size:11px;color:#8493a8;">Can&rsquo;t use the button? Open <a href="${confirmUrl}" style="color:#3a5a80;">this secure link</a> &nbsp;&middot;&nbsp; <a href="${stopUrl}" style="color:#8493a8;">Stop these emails for this matter</a></p>
    </td></tr>
  </table>
</td></tr></table></body></html>`;

  const text =
    `I'm looking after ${sellerNames || "our client"} and helping keep things moving on ${address}. Could you let me know where things stand with ${theseItems}:\n\n` +
    steps.map((s) => `- ${s.label}`).join("\n") +
    `\n\nUpdate them here: ${confirmUrl}` +
    `\nRather reply by email? Just reply to this message with an update. Thank you!` +
    `\n\n${personName}\n${brand}${personPhone ? `\n${personPhone}` : ""}` +
    `\n\nStop these emails for this matter: ${stopUrl}`;

  return { subject, html, text };
}
