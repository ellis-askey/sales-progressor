import { sendEmail } from "@/lib/email";

interface SendNegotiatorAcceptedEmailInput {
  to: string;
  directorName: string;
  negotiatorName: string;
  agencyName: string;
  teamUrl: string;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function sendNegotiatorAcceptedEmail(
  input: SendNegotiatorAcceptedEmailInput
): Promise<void> {
  const { to, directorName, negotiatorName, agencyName, teamUrl } = input;

  const subject = `${negotiatorName} has joined ${agencyName} on Sales Progressor`;

  const text = [
    `Hi ${directorName},`,
    ``,
    `Great news — ${negotiatorName} has accepted your invitation and set up their account at ${agencyName}.`,
    ``,
    `They can now log in and start managing files.`,
    ``,
    `View your team: ${teamUrl}`,
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
              <h1 style="font-size: 22px; color: #2D1810; margin: 0 0 16px;">Your team just grew</h1>
              <p style="font-size: 15px; color: #4A3329; line-height: 1.5; margin: 0 0 16px;">
                Hi ${escapeHtml(directorName)},
              </p>
              <p style="font-size: 15px; color: #4A3329; line-height: 1.5; margin: 0 0 20px;">
                Great news — <strong>${escapeHtml(negotiatorName)}</strong> has accepted your invitation and set up their account at <strong>${escapeHtml(agencyName)}</strong>.
              </p>
              <p style="font-size: 14px; color: #6B5547; line-height: 1.5; margin: 0 0 28px;">
                They can now log in and start managing files alongside your team.
              </p>
              <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td style="border-radius: 8px; background: #E86A4B;">
                    <a href="${teamUrl}" style="display: inline-block; padding: 12px 24px; color: white; text-decoration: none; font-weight: 500; font-size: 15px;">
                      View your team
                    </a>
                  </td>
                </tr>
              </table>
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
