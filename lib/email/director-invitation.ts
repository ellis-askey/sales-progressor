import { sendEmail } from "@/lib/email";
import { agencyFrom } from "@/lib/email/from-name";

interface DirectorInvitationEmailInput {
  directorName: string;
  directorEmail: string;
  invitedByName: string;
  agencyName: string;
  acceptUrl: string;
}

export async function sendDirectorInvitationEmail(input: DirectorInvitationEmailInput) {
  const subject = `${input.invitedByName} wants you to join Sales Progressor`;

  const text = `Hi ${input.directorName},

${input.invitedByName} is using Sales Progressor at ${input.agencyName} and wants you set up as director.

It tracks every sale from offer accepted to completion, surfacing the deals that are quietly slipping before they fall through. As director you'll see every file across the team in one place.

Set up your account here:
${input.acceptUrl}

This invitation expires in 7 days.`;

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
              <h1 style="font-size: 22px; color: #2D1810; margin: 0 0 16px;">${escapeHtml(input.invitedByName)} wants you to join Sales Progressor</h1>
              <p style="font-size: 15px; color: #4A3329; line-height: 1.5; margin: 0 0 16px;">
                Hi ${escapeHtml(input.directorName)},
              </p>
              <p style="font-size: 15px; color: #4A3329; line-height: 1.5; margin: 0 0 20px;">
                <strong>${escapeHtml(input.invitedByName)}</strong> is using Sales Progressor at <strong>${escapeHtml(input.agencyName)}</strong> and wants you set up as director.
              </p>
              <p style="font-size: 14px; color: #6B5547; line-height: 1.5; margin: 0 0 28px;">
                It tracks every sale from offer accepted to completion, surfacing the deals that are quietly slipping before they fall through. As director you'll see every file across the team in one place.
              </p>
              <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td style="border-radius: 8px; background: #FF6B4A;">
                    <a href="${input.acceptUrl}" style="display: inline-block; padding: 12px 24px; color: white; text-decoration: none; font-weight: 500; font-size: 15px;">
                      Set up your account
                    </a>
                  </td>
                </tr>
              </table>
              <p style="font-size: 13px; color: #8B7565; line-height: 1.5; margin: 28px 0 0;">
                This invitation expires in 7 days.
              </p>
            </td>
          </tr>
        </table>
        <p style="margin:20px 0 0;font-size:11px;color:#c0c4d0;text-align:center">
          Powered by <a href="https://www.thesalesprogressor.co.uk" style="color:#c0c4d0;text-decoration:none">Sales Progressor</a>
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return sendEmail({
    to: input.directorEmail,
    subject,
    text,
    html,
    from: agencyFrom(input.agencyName),
  });
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
