import { sendEmail } from "@/lib/email";

interface SendNegotiatorInvitationEmailInput {
  to: string;
  negotiatorName: string;
  invitedByName: string;
  agencyName: string;
  acceptUrl: string;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function sendNegotiatorInvitationEmail(
  input: SendNegotiatorInvitationEmailInput
): Promise<void> {
  const { to, negotiatorName, invitedByName, agencyName, acceptUrl } = input;

  const subject = `${invitedByName} wants you to join ${agencyName} on Sales Progressor`;

  const text = [
    `Hi ${negotiatorName},`,
    ``,
    `${invitedByName} has invited you to join ${agencyName} as a negotiator on Sales Progressor.`,
    ``,
    `Sales Progressor tracks every sale from offer accepted to completion, flagging stalls before they cost you the deal.`,
    ``,
    `Set up your account here:`,
    acceptUrl,
    ``,
    `This link expires in 7 days.`,
    ``,
    `If you weren't expecting this invitation, you can safely ignore this email.`,
    ``,
    `— The Sales Progressor team`,
  ].join("\n");

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background: #f5f5f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="560" style="background: white; border-radius: 12px; padding: 40px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
          <tr>
            <td>
              <h1 style="font-size: 22px; color: #2D1810; margin: 0 0 16px;">${escapeHtml(invitedByName)} wants you to join Sales Progressor</h1>
              <p style="font-size: 15px; color: #4A3329; line-height: 1.5; margin: 0 0 16px;">
                Hi ${escapeHtml(negotiatorName)},
              </p>
              <p style="font-size: 15px; color: #4A3329; line-height: 1.5; margin: 0 0 20px;">
                <strong>${escapeHtml(invitedByName)}</strong> has invited you to join <strong>${escapeHtml(agencyName)}</strong> as a negotiator on Sales Progressor.
              </p>
              <p style="font-size: 14px; color: #6B5547; line-height: 1.5; margin: 0 0 28px;">
                Sales Progressor tracks every sale from offer accepted to completion, flagging stalls before they cost you the deal.
              </p>
              <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td style="border-radius: 8px; background: #E86A4B;">
                    <a href="${acceptUrl}" style="display: inline-block; padding: 12px 24px; color: white; text-decoration: none; font-weight: 500; font-size: 15px;">
                      Set up your account
                    </a>
                  </td>
                </tr>
              </table>
              <p style="font-size: 13px; color: #8B7565; line-height: 1.5; margin: 28px 0 0;">
                This invitation expires in 7 days.
              </p>
              <p style="font-size: 13px; color: #8B7565; line-height: 1.5; margin: 12px 0 0;">
                If you weren't expecting this invitation, you can safely ignore this email.
              </p>
            </td>
          </tr>
        </table>
        <p style="font-size: 12px; color: #8B7565; margin: 20px 0 0;">
          Sales Progressor — sales progression for estate agents
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;

  await sendEmail({ to, subject, text, html });
}
