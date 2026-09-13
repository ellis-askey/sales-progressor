import { sendAgentEmail } from "@/lib/email/agent-log";
import { resolveAgencySender } from "@/lib/email/agency-sender";
import { greetingName, nameWithoutTitle } from "@/lib/contacts/displayName";

// Invite-to-move email (docs/active/invite-to-move/SPEC.md). Sent when a director
// invites an email that ALREADY has a Sales Progressor account. Unlike the normal
// team invite ("set up your account"), this asks the person to sign in and
// confirm a move — nothing changes until they do. Sender resolves to the agency's
// verified address if set, else Sales Progressor.
interface SendMoveInvitationEmailInput {
  to: string;
  recipientName: string;
  invitedByName: string;
  agencyName: string;
  agencyId: string;
  acceptUrl: string;
}

const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

export async function sendMoveInvitationEmail(input: SendMoveInvitationEmailInput): Promise<void> {
  const recipient = greetingName(input.recipientName);
  const inviter = nameWithoutTitle(input.invitedByName);
  const agency = input.agencyName.trim();

  const subject = `${inviter} has invited you to move to ${agency} on Sales Progressor`;

  const text = [
    `Hi ${recipient},`,
    ``,
    `${inviter} has invited you to move your Sales Progressor account into ${agency}.`,
    ``,
    `You already have an account, so we just need you to confirm the move. Sign in to your account, then open this link:`,
    input.acceptUrl,
    ``,
    `Nothing changes until you confirm. Your invitation is open for 7 days.`,
    ``,
    `TSP · Sales Progressor`,
  ].join("\n");

  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const html = `<!DOCTYPE html><html lang="en"><body style="margin:0;padding:0;background:#f4f4f6;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f6;"><tr><td align="center" style="padding:28px 14px;">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="width:560px;max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #eae6e1;">
        <tr><td style="padding:32px 34px 8px;font-family:${FONT};font-size:16px;line-height:1.6;color:#374151;">
          <p style="margin:0 0 16px;">Hi ${esc(recipient)},</p>
          <p style="margin:0 0 16px;"><strong style="color:#1a1d29;">${esc(inviter)}</strong> has invited you to move your Sales Progressor account into <strong style="color:#1a1d29;">${esc(agency)}</strong>.</p>
          <p style="margin:0;">You already have an account, so we just need you to confirm the move. Nothing changes until you do.</p>
        </td></tr>
        <tr><td style="padding:24px 34px 8px;">
          <table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:0 auto;"><tr>
            <td bgcolor="#FF6B4A" style="border-radius:12px;">
              <a href="${input.acceptUrl}" style="display:block;padding:15px 30px;font-family:${FONT};font-size:16px;font-weight:700;color:#ffffff;text-decoration:none;">Review and confirm &rarr;</a>
            </td>
          </tr></table>
        </td></tr>
        <tr><td style="padding:10px 34px 30px;font-family:${FONT};font-size:13px;line-height:1.6;color:#8a93a3;text-align:center;">
          Sign in to your account first, then open the link. Your invitation is open for 7 days.
        </td></tr>
      </table>
    </td></tr></table>
  </body></html>`;

  const { from, replyTo } = await resolveAgencySender(input.agencyId, { fromPlatformAddress: true });
  await sendAgentEmail({
    to: input.to,
    subject,
    text,
    html,
    from,
    replyTo,
    kind: "team_invite",
    meta: { agencyName: agency, invitedByName: input.invitedByName, move: true },
  });
}
