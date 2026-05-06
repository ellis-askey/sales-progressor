import { sendEmail } from "@/lib/email";

export async function sendNegotiatorInvitationEmail({
  to,
  negotiatorName,
  invitedByName,
  agencyName,
  acceptUrl,
}: {
  to: string;
  negotiatorName: string;
  invitedByName: string;
  agencyName: string;
  acceptUrl: string;
}) {
  const firstName = negotiatorName.trim().split(/\s+/)[0];

  await sendEmail({
    to,
    subject: `${invitedByName} has added you to ${agencyName} on Sales Progressor`,
    text: [
      `Hi ${firstName},`,
      "",
      `${invitedByName} has added you as a negotiator at ${agencyName} on Sales Progressor.`,
      "",
      `To get started, set your password and sign in:`,
      "",
      acceptUrl,
      "",
      `This link expires in 7 days. If you weren't expecting this, you can safely ignore it.`,
      "",
      "Sales Progressor",
    ].join("\n"),
    html: `<!DOCTYPE html>
<html>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#1a1d29;background:#fff">
  <div style="margin-bottom:28px">
    <div style="width:40px;height:40px;background:linear-gradient(135deg,#FF6B4A 0%,#e85535 100%);border-radius:12px;display:flex;align-items:center;justify-content:center"></div>
  </div>
  <p style="margin:0 0 8px;font-size:22px;font-weight:700;color:#1a1d29;letter-spacing:-0.02em">You've been added to ${agencyName}</p>
  <p style="margin:0 0 24px;font-size:15px;color:#64748b;line-height:1.6">
    Hi ${firstName}, ${invitedByName} has added you as a negotiator on Sales Progressor. Set your password to get started.
  </p>
  <p style="margin:0 0 28px">
    <a href="${acceptUrl}" style="display:inline-block;background:#FF6B4A;color:#fff;padding:14px 32px;border-radius:12px;text-decoration:none;font-weight:700;font-size:15px">
      Set my password →
    </a>
  </p>
  <div style="padding:16px 20px;background:#f8f9fb;border-radius:12px;margin-bottom:24px">
    <p style="margin:0;font-size:13px;color:#64748b;line-height:1.5">
      This link expires in <strong>7 days</strong>. If you weren't expecting this invitation, you can safely ignore this email.
    </p>
  </div>
  <p style="margin:0;font-size:12px;color:#94a3b8">Sales Progressor · thesalesprogressor.co.uk</p>
</body>
</html>`,
  });
}
