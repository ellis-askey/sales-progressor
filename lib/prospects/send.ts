// Prospect outreach sender. Sends from ellis@thesalesprogressor.co.uk with full
// tracking (open + click via SendGrid, joined back by the customArg
// prospectEmailId) and a tokenised Reply-To (reply+<token>@<inbound domain>) so
// SendGrid Inbound Parse can match replies to the ProspectEmail. Distinct from
// the transactional lib/email.ts path on purpose (different sender + tracking).

import { applyDevEmailRedirect } from "@/lib/email";

const FROM_EMAIL = process.env.PROSPECT_FROM_EMAIL ?? "ellis@salesprogressorapp.co.uk";
const FROM_NAME = process.env.PROSPECT_FROM_NAME ?? "Ellis Askey";
// Subdomain that MX-routes to SendGrid Inbound Parse (Ellis sets this up).
const INBOUND_DOMAIN = process.env.PROSPECT_INBOUND_DOMAIN ?? "reply.salesprogressorapp.co.uk";
// Public URL of Ellis's signature image (served from /public). Ellis provides
// the asset; until then the img simply doesn't render, the email still sends.
const SIGNATURE_URL = process.env.PROSPECT_SIGNATURE_URL ?? "https://portal.thesalesprogressor.co.uk/prospect-signature.png";

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Public site the signature image links to.
const SITE_URL = process.env.PROSPECT_SITE_URL ?? "https://www.thesalesprogressor.co.uk";

// Optional postal address for the compliance footer (CAN-SPAM / PECR good
// practice). Rendered only when set; unset = the unsubscribe line still shows,
// the address line is simply omitted.
const POSTAL_ADDRESS = process.env.OUTREACH_POSTAL_ADDRESS?.trim() ?? "";

function unsubFooterText(url: string): string {
  const lines = [
    "",
    "You're receiving this because we think The Sales Progressor is relevant to your agency. If you'd rather not hear from us, unsubscribe here:",
    url,
  ];
  if (POSTAL_ADDRESS) lines.push("", `The Sales Progressor, ${POSTAL_ADDRESS}`);
  return "\n" + lines.join("\n");
}

function unsubFooterHtml(url: string): string {
  return `<div style="margin-top:24px;padding-top:12px;border-top:1px solid #e5e5e5;font-size:12px;color:#8a8a8a;line-height:1.5">You're receiving this because we think The Sales Progressor is relevant to your agency. <a href="${url}" style="color:#8a8a8a;text-decoration:underline">Unsubscribe</a>.${POSTAL_ADDRESS ? `<br>The Sales Progressor, ${escapeHtml(POSTAL_ADDRESS)}` : ""}</div>`;
}

// Wrap plain outreach text in the standard signature template. Exported so the
// prospect drawer can preview a queued email exactly as the recipient sees it,
// using the same markup the send path produces.
export function renderProspectEmailHtml(text: string, footerHtml?: string): string {
  const bodyHtml = escapeHtml(text).replace(/\n/g, "<br>");
  return `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:14px;color:#111;line-height:1.5">
    <div>${bodyHtml}</div>
    <div style="margin-top:20px"><a href="${SITE_URL}" target="_blank" style="text-decoration:none;border:0"><img src="${SIGNATURE_URL}" alt="Ellis Askey, Operations Director, The Sales Progressor" style="max-width:340px;height:auto;border:0;display:block" /></a></div>
    ${footerHtml ?? ""}
  </div>`;
}

export async function sendProspectOutreach(args: {
  to: string;
  subject: string;
  text: string;
  replyToken: string;
  prospectEmailId: string;
  // When set, send this pre-built branded HTML (and the text as-is) instead of
  // wrapping the plain text in the Ellis-signature template. Used by the agency
  // invitation, which carries its own full design + footer.
  html?: string;
  // Per-send sender override. The AI outreach engine (Build Order H) passes its
  // own identity (hello@salesprogressorapp.co.uk) here; manual outreach passes
  // nothing and keeps the default PROSPECT_FROM_EMAIL identity unchanged.
  from?: { email: string; name: string };
  // Cold-outreach opt-out URL. When set (and no pre-built html), appends the
  // unsubscribe footer and sets the List-Unsubscribe / one-click headers.
  unsubscribeUrl?: string;
}): Promise<{ sgMessageId: string | null }> {
  const sgMail = (await import("@sendgrid/mail")).default;
  sgMail.setApiKey(process.env.SENDGRID_API_KEY ?? "");
  const isSandbox = process.env.EMAIL_SANDBOX_MODE === "true";

  // Footer + List-Unsubscribe only on the standard signature template (plain
  // cold outreach). A caller-supplied `html` (e.g. the invitation) owns its own
  // design + footer, so we don't inject into it.
  const unsub = !args.html ? args.unsubscribeUrl : undefined;
  const text = args.html
    ? args.text
    : `${args.text}\n\nEllis Askey\nOperations Director, The Sales Progressor\nellis@thesalesprogressor.co.uk${unsub ? unsubFooterText(unsub) : ""}`;
  const html = args.html ?? renderProspectEmailHtml(args.text, unsub ? unsubFooterHtml(unsub) : undefined);
  const headers = unsub
    ? {
        // https one-click (primary) + a tokenised mailto that lands in Inbound
        // Parse, where the reply-opt-out detector suppresses them.
        "List-Unsubscribe": `<${unsub}>, <mailto:reply+${args.replyToken}@${INBOUND_DOMAIN}?subject=unsubscribe>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      }
    : undefined;

  const [res] = await sgMail.send(applyDevEmailRedirect({
    to: args.to,
    from: args.from ?? { email: FROM_EMAIL, name: FROM_NAME },
    replyTo: `reply+${args.replyToken}@${INBOUND_DOMAIN}`,
    subject: args.subject,
    text,
    html,
    customArgs: { prospectEmailId: args.prospectEmailId },
    trackingSettings: { openTracking: { enable: true }, clickTracking: { enable: true, enableText: false } },
    mailSettings: { sandboxMode: { enable: isSandbox } },
    ...(headers ? { headers } : {}),
  }));

  const header = res?.headers?.["x-message-id"];
  return { sgMessageId: typeof header === "string" ? header : null };
}
