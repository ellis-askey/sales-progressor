// Prospect outreach sender. Sends from ellis@thesalesprogressor.co.uk with full
// tracking (open + click via SendGrid, joined back by the customArg
// prospectEmailId) and a tokenised Reply-To (reply+<token>@<inbound domain>) so
// SendGrid Inbound Parse can match replies to the ProspectEmail. Distinct from
// the transactional lib/email.ts path on purpose (different sender + tracking).

const FROM_EMAIL = process.env.PROSPECT_FROM_EMAIL ?? "ellis@thesalesprogressor.co.uk";
const FROM_NAME = process.env.PROSPECT_FROM_NAME ?? "Ellis Askey";
// Subdomain that MX-routes to SendGrid Inbound Parse (Ellis sets this up).
const INBOUND_DOMAIN = process.env.PROSPECT_INBOUND_DOMAIN ?? "reply.thesalesprogressor.co.uk";
// Public URL of Ellis's signature image (served from /public). Ellis provides
// the asset; until then the img simply doesn't render, the email still sends.
const SIGNATURE_URL = process.env.PROSPECT_SIGNATURE_URL ?? "https://portal.thesalesprogressor.co.uk/prospect-signature.png";

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Public site the signature image links to.
const SITE_URL = process.env.PROSPECT_SITE_URL ?? "https://www.thesalesprogressor.co.uk";

function renderHtml(text: string): string {
  const bodyHtml = escapeHtml(text).replace(/\n/g, "<br>");
  return `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:14px;color:#111;line-height:1.5">
    <div>${bodyHtml}</div>
    <div style="margin-top:20px"><a href="${SITE_URL}" target="_blank" style="text-decoration:none;border:0"><img src="${SIGNATURE_URL}" alt="Ellis Askey, Operations Director, The Sales Progressor" style="max-width:340px;height:auto;border:0;display:block" /></a></div>
  </div>`;
}

export async function sendProspectOutreach(args: {
  to: string;
  subject: string;
  text: string;
  replyToken: string;
  prospectEmailId: string;
}): Promise<{ sgMessageId: string | null }> {
  const sgMail = (await import("@sendgrid/mail")).default;
  sgMail.setApiKey(process.env.SENDGRID_API_KEY ?? "");
  const isSandbox = process.env.EMAIL_SANDBOX_MODE === "true";

  const [res] = await sgMail.send({
    to: args.to,
    from: { email: FROM_EMAIL, name: FROM_NAME },
    replyTo: `reply+${args.replyToken}@${INBOUND_DOMAIN}`,
    subject: args.subject,
    text: `${args.text}\n\nEllis Askey\nOperations Director, The Sales Progressor\nellis@thesalesprogressor.co.uk`,
    html: renderHtml(args.text),
    customArgs: { prospectEmailId: args.prospectEmailId },
    trackingSettings: { openTracking: { enable: true }, clickTracking: { enable: true, enableText: false } },
    mailSettings: { sandboxMode: { enable: isSandbox } },
  });

  const header = res?.headers?.["x-message-id"];
  return { sgMessageId: typeof header === "string" ? header : null };
}
