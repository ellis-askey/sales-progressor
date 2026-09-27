// Founder-triggered "we saw you signed up, need any help?" email, sent from the
// Command Centre agents view. Goes out from Customer Support (support@) with the
// support signature banner. User-triggered per agent (never automated).
import { extractFirstName } from "@/lib/contacts/displayName";
import { EMAIL_ASSET } from "@/lib/emails/retention/index";

export const AGENT_SUPPORT_FROM = "Sales Progressor Support <support@thesalesprogressor.co.uk>";
export const AGENT_SUPPORT_REPLY_TO = "support@thesalesprogressor.co.uk";

export function buildAgentSupportEmail(name: string): { subject: string; html: string; text: string } {
  const first = extractFirstName(name) || "there";
  const subject = "Getting set up with Sales Progressor";

  const lines = [
    `Hi ${first},`,
    `We saw you've signed up to Sales Progressor, and we wanted to check in.`,
    `If there's anything you'd like a hand with, whether that's connecting your email, adding your first sale, or bringing your team on, just reply to this message and we'll help you get set up.`,
    `We're here whenever you need us.`,
  ];

  const text = [...lines, ``, `Customer Support`, `support@thesalesprogressor.co.uk`, `thesalesprogressor.co.uk`].join("\n\n");

  const paras = lines
    .map(
      (l) =>
        `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#2A2723;">${l}</p>`,
    )
    .join("");

  const html = `<!-- agent support check-in -->
<div style="margin:0;padding:0;background:#F4F0E9;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F0E9;">
    <tr><td align="center" style="padding:28px 16px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#FFFFFF;border:1px solid rgba(35,31,27,0.08);border-radius:16px;">
        <tr><td style="padding:32px 34px 8px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
          ${paras}
        </td></tr>
        <tr><td style="padding:8px 24px 24px;">
          <img src="${EMAIL_ASSET}/customer-support-signature.png" alt="Customer Support, support@thesalesprogressor.co.uk" width="552" style="display:block;width:100%;max-width:552px;height:auto;border:0;" />
        </td></tr>
      </table>
    </td></tr>
  </table>
</div>`;

  return { subject, html, text };
}
