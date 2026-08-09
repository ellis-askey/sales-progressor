import type { SolicitorSide } from "./codes";

// Builds the solicitor confirmation digest email — the productionised version
// of the validated demo. One email per (file, side): a single open step shows
// the three action buttons; multiple steps list them under one "Confirm or
// update these" button. All buttons land on the confirm page, which holds the
// real per-step controls. Voice is first-person in-house staff (not outsourced)
// and the body names the SELLER (our instructing client); the subject names
// the RECIPIENT's own client. See docs/active/solicitor-confirm/scope.md.

export type SolicitorDigestInput = {
  brand: string; // agency name — letterhead + footer
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
};

const NAVY = "#0f2740";

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
  const { brand, address, sellerNames, side, firmName, steps, confirmUrl, stopUrl } = input;
  const single = steps.length === 1;
  const actingFor = side === "vendor" ? "The seller" : "The buyer";
  const price = formatPrice(input.pricePence);
  const subject = solicitorDigestSubject(address, input.ownClientNames);

  const matterRows = [
    `<tr><td style="padding:3px 0;color:#6b7c93;width:150px;">Property</td><td style="padding:3px 0;color:${NAVY};font-weight:600;">${esc(address)}</td></tr>`,
    price ? `<tr><td style="padding:3px 0;color:#6b7c93;">Sale price</td><td style="padding:3px 0;color:${NAVY};font-weight:600;">${esc(price)}</td></tr>` : "",
    sellerNames ? `<tr><td style="padding:3px 0;color:#6b7c93;">Seller</td><td style="padding:3px 0;color:${NAVY};">${esc(sellerNames)}</td></tr>` : "",
    input.buyerNames ? `<tr><td style="padding:3px 0;color:#6b7c93;">Buyer</td><td style="padding:3px 0;color:${NAVY};">${esc(input.buyerNames)}</td></tr>` : "",
    firmName ? `<tr><td style="padding:3px 0;color:#6b7c93;">Your firm</td><td style="padding:3px 0;color:${NAVY};">${esc(firmName)}</td></tr>` : "",
    `<tr><td style="padding:3px 0;color:#6b7c93;">You are acting for</td><td style="padding:3px 0;color:${NAVY};">${actingFor}</td></tr>`,
  ].join("");

  const stepsList = single
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #cdd8e6;border-left:4px solid ${NAVY};border-radius:6px;">
        <tr><td style="padding:14px 16px;"><p style="margin:0;font-size:15px;font-weight:600;color:${NAVY};line-height:1.4;">${esc(steps[0].label)}</p></td></tr>
      </table>`
    : `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #cdd8e6;border-left:4px solid ${NAVY};border-radius:6px;">
        ${steps
          .map(
            (s, i) =>
              `<tr><td style="padding:13px 16px;${i < steps.length - 1 ? "border-bottom:1px solid #e6ecf3;" : ""}"><p style="margin:0;font-size:14px;font-weight:600;color:${NAVY};line-height:1.4;">${esc(s.label)}</p></td></tr>`,
          )
          .join("")}
      </table>`;

  const cta = single
    ? `<table role="presentation" cellpadding="0" cellspacing="0" width="100%"><tr><td>
         <a href="${confirmUrl}" style="display:block;background:${NAVY};color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;text-align:center;padding:13px 18px;border-radius:7px;">Confirm this is done</a>
       </td></tr></table>
       <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-top:10px;"><tr>
         <td style="padding-right:5px;"><a href="${confirmUrl}" style="display:block;background:#ffffff;color:${NAVY};text-decoration:none;font-size:13px;font-weight:600;text-align:center;padding:12px 10px;border-radius:7px;border:1px solid #cdd8e6;">Give an expected date</a></td>
         <td style="padding-left:5px;"><a href="${confirmUrl}" style="display:block;background:#ffffff;color:${NAVY};text-decoration:none;font-size:13px;font-weight:600;text-align:center;padding:12px 10px;border-radius:7px;border:1px solid #cdd8e6;">Provide an update</a></td>
       </tr></table>`
    : `<table role="presentation" cellpadding="0" cellspacing="0" width="100%"><tr><td>
         <a href="${confirmUrl}" style="display:block;background:${NAVY};color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;text-align:center;padding:13px 18px;border-radius:7px;">Confirm or update these</a>
       </td></tr></table>`;

  const intro = single
    ? "Could you please confirm the status of the following:"
    : `Could you please confirm where these ${steps.length} steps stand:`;

  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:24px;background:#eef1f5;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;"><tr><td>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${NAVY};border-radius:10px 10px 0 0;">
    <tr><td style="padding:22px 28px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      <td style="font-size:16px;font-weight:600;color:#ffffff;letter-spacing:.2px;">${esc(brand)}</td>
      <td align="right" style="font-size:11px;color:#9fb3c8;text-transform:uppercase;letter-spacing:1.2px;">Sale progression</td>
    </tr></table></td></tr>
  </table>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border-left:1px solid #dfe5ec;border-right:1px solid #dfe5ec;">
    <tr><td style="padding:30px 28px 8px;">
      <p style="margin:0 0 14px;font-size:15px;color:${NAVY};">Dear Sir or Madam,</p>
      <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#33475b;">I hope you&rsquo;re well. I&rsquo;m looking after <strong style="color:${NAVY};">${esc(sellerNames || "our client")}</strong> and overseeing the progression on this sale. I&rsquo;m writing to ask if you could kindly confirm where things stand on the ${single ? "step" : "steps"} below, so I can keep both parties updated and things moving forward.</p>
    </td></tr>
    <tr><td style="padding:4px 28px 8px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f8fb;border:1px solid #e3e9f0;border-radius:8px;"><tr><td style="padding:16px 18px;">
        <p style="margin:0 0 12px;font-size:10px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;color:#6b7c93;">Matter details</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;color:#33475b;line-height:1.5;">${matterRows}</table>
      </td></tr></table>
    </td></tr>
    <tr><td style="padding:20px 28px 4px;">
      <p style="margin:0 0 10px;font-size:14px;color:#33475b;">${intro}</p>
      ${stepsList}
    </td></tr>
    <tr><td style="padding:22px 28px 6px;">
      ${cta}
      <p style="margin:14px 0 0;font-size:12px;line-height:1.55;color:#8493a8;">${single ? "These links are unique to this matter and don&rsquo;t need a password. " : "On the next screen you can, for each step, confirm it&rsquo;s done, give an expected date, or leave a short update. It needs no password. "}Nothing you confirm here is binding; it simply keeps our file up to date so everyone can see progress.</p>
    </td></tr>
    <tr><td style="padding:22px 28px 26px;">
      <p style="margin:0 0 2px;font-size:14px;color:#33475b;line-height:1.6;">Many thanks for your help,</p>
      <p style="margin:8px 0 0;font-size:14px;color:${NAVY};line-height:1.5;"><strong>${esc(brand)}</strong></p>
    </td></tr>
  </table>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f8fb;border:1px solid #dfe5ec;border-top:none;border-radius:0 0 10px 10px;">
    <tr><td style="padding:18px 28px;">
      <p style="margin:0 0 6px;font-size:11px;line-height:1.6;color:#8493a8;">Sent by ${esc(brand)} in relation to the matter above. If you&rsquo;re not the right person for this file, just reply and let me know.</p>
      <p style="margin:0;font-size:11px;color:#8493a8;">Can&rsquo;t use the ${single ? "buttons" : "button"}? Open <a href="${confirmUrl}" style="color:#3a5a80;">this secure link</a> &nbsp;&middot;&nbsp; <a href="${stopUrl}" style="color:#8493a8;">Stop these emails for this matter</a></p>
    </td></tr>
  </table>
</td></tr></table></body></html>`;

  const text =
    `${single ? "Please confirm where this step stands" : `Please confirm where these ${steps.length} steps stand`} on ${address}:\n\n` +
    steps.map((s) => `- ${s.label}`).join("\n") +
    `\n\nOpen your secure link: ${confirmUrl}\nStop these emails for this matter: ${stopUrl}`;

  return { subject, html, text };
}
