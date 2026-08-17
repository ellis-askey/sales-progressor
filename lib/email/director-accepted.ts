import { sendAgentEmail } from "@/lib/email/agent-log";
import { resolveAgencySender } from "@/lib/email/agency-sender";

interface DirectorAcceptedEmailInput {
  negotiatorName: string;
  negotiatorEmail: string;
  directorName: string;
  agencyName: string;
  agencyId: string;
}

export async function sendDirectorAcceptedEmail(input: DirectorAcceptedEmailInput) {
  const subject = `${input.directorName} has joined Sales Progressor`;

  const text = `Hi ${input.negotiatorName},

${input.directorName} has accepted your invitation and set up their account at ${input.agencyName}.

They can now see all of your active sales and reach you directly through the platform.

Sales Progressor`;

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
              <h1 style="font-size: 22px; color: #2D1810; margin: 0 0 16px;">Your director has joined</h1>
              <p style="font-size: 15px; color: #4A3329; line-height: 1.5; margin: 0 0 16px;">
                Hi ${escapeHtml(input.negotiatorName)},
              </p>
              <p style="font-size: 15px; color: #4A3329; line-height: 1.5; margin: 0 0 20px;">
                <strong>${escapeHtml(input.directorName)}</strong> has accepted your invitation and set up their account at <strong>${escapeHtml(input.agencyName)}</strong>.
              </p>
              <p style="font-size: 14px; color: #6B5547; line-height: 1.5; margin: 0 0 28px;">
                They can now see all of your active sales and reach you directly through the platform.
              </p>
              <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td style="border-radius: 8px; background: #FF6B4A;">
                    <a href="${process.env.NEXTAUTH_URL ?? "https://portal.thesalesprogressor.co.uk"}/agent/hub" style="display: inline-block; padding: 12px 24px; color: white; text-decoration: none; font-weight: 500; font-size: 15px;">
                      Go to your hub
                    </a>
                  </td>
                </tr>
              </table>
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

  const { from, replyTo } = await resolveAgencySender(input.agencyId);
  return sendAgentEmail({
    to: input.negotiatorEmail,
    subject,
    text,
    html,
    from,
    replyTo,
    kind: "team_accepted",
    meta: { agencyName: input.agencyName },
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
