// Team invitation — sent when a director adds a colleague (negotiator or another
// director) to their agency on Sales Progressor. Redesigned into the lifecycle
// email family; reuses the shared header / footer / button / feature helpers so
// it matches the rest. One template, role-aware copy. The hero bakes the
// "You're invited. Join the team." headline, so the body goes straight into the
// personalised invite line.
import { EMAIL_ASSET, FONT_STACK, emailHead, emailHeaderRow, pageFooter } from "./retention";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function buildTeamInvitation(vars: {
  recipientName: string;
  invitedByName: string;
  agencyName: string;
  role: "negotiator" | "director";
  acceptUrl: string;
  unsubscribeUrl?: string;
}): { subject: string; html: string; text: string } {
  const recipientName = vars.recipientName.trim();
  const invitedByName = escapeHtml(vars.invitedByName.trim());
  const agencyName = escapeHtml(vars.agencyName.trim());
  const roleWord = vars.role === "director" ? "director" : "negotiator";

  const subject = `${vars.invitedByName.trim()} wants you to join ${vars.agencyName.trim()} on Sales Progressor`;

  const valueLine =
    vars.role === "director"
      ? "See every sale across the team from offer accepted to completion, know what needs attention and keep clients updated, all without the constant chasing."
      : "Track every sale from offer accepted to completion, keep clients updated and see what needs attention without constantly chasing for updates.";

  // One feature cell. The wrapping divs carry the responsive widths: 3-across on
  // desktop; on mobile the first two go 50/50 and the third spans full width
  // underneath, all centre-aligned (.inv2 / .inv1 rules in emailHead).
  const col = (icon: string, title: string, sub: string) =>
    `<img src="${EMAIL_ASSET}/${icon}" width="52" height="52" alt="" style="border:0;display:block;margin:0 auto 12px;"><div style="font-family:${FONT_STACK};font-size:14px;font-weight:700;color:#1a1d29;line-height:1.35;">${title}</div><div style="font-family:${FONT_STACK};font-size:12.5px;color:#8a93a3;line-height:1.45;margin-top:5px;">${sub}</div>`;

  const features = `<div style="background:#FDF0EA;background:linear-gradient(180deg,#FEF4EF 0%,#FBE6DC 100%);border:1px solid #FBE1D5;border-radius:16px;padding:26px 8px;box-shadow:0 2px 12px rgba(216,90,53,0.07);"><div style="text-align:center;font-size:0;"><div class="inv2" style="display:inline-block;box-sizing:border-box;width:33.33%;max-width:33.33%;vertical-align:top;text-align:center;padding:0 8px;">${col("icon-doc-peach.png", "See every sale", "Know exactly where each file is up to.")}</div><div class="inv2" style="display:inline-block;box-sizing:border-box;width:33.33%;max-width:33.33%;vertical-align:top;text-align:center;padding:0 8px;border-left:1px solid #F3DACE;">${col("icon-target-peach.png", "Know what needs attention", "See blockers and next actions at a glance.")}</div><div class="inv1" style="display:inline-block;box-sizing:border-box;width:33.33%;max-width:33.33%;vertical-align:top;text-align:center;padding:0 8px;border-left:1px solid #F3DACE;">${col("icon-team.png", "Fewer update chases", "Clients stay informed without constantly calling the office.")}</div></div></div>`;

  const body = [
    `<tr><td style="padding:20px 2px 0;font-family:${FONT_STACK};font-size:16px;line-height:1.6;color:#374151;">
      <p style="margin:0 0 16px;">Hi ${escapeHtml(recipientName)},</p>
      <p style="margin:0 0 16px;"><strong style="color:#1a1d29;">${invitedByName}</strong> has invited you to join <strong style="color:#1a1d29;">${agencyName}</strong> as a ${roleWord} on Sales Progressor.</p>
      <p style="margin:0;">${valueLine}</p>
    </td></tr>`,
    `<tr><td style="padding:26px 0 0;">
      <div style="background:#FF6B4A;background:linear-gradient(180deg,#FF7E57 0%,#F0511A 100%);border-radius:16px;text-align:center;box-shadow:0 6px 16px rgba(240,81,26,0.34);">
        <a href="${vars.acceptUrl}" style="display:block;padding:17px 20px;font-family:${FONT_STACK};font-size:16px;font-weight:700;color:#ffffff;text-decoration:none;">Set up your account  &rarr;</a>
      </div>
    </td></tr>`,
    `<tr><td style="padding:16px 2px 0;">
      <table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:0 auto;"><tr>
        <td valign="middle" width="30"><img src="${EMAIL_ASSET}/icon-clock-coral.png" width="24" height="24" alt="" style="display:block;border:0;"></td>
        <td valign="middle" style="padding-left:10px;font-family:${FONT_STACK};font-size:14px;color:#8a93a3;">Your invitation is open for 7 days.</td>
      </tr></table>
    </td></tr>`,
    `<tr><td style="padding:26px 0 0;">${features}</td></tr>`,
    `<tr><td style="padding:24px 0 0;">
      <div style="background:#F3F5F7;border-radius:14px;padding:16px 18px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
          <td valign="middle" width="52"><img src="${EMAIL_ASSET}/icon-chat.png" width="44" height="44" alt="" style="display:block;border:0;"></td>
          <td valign="middle" style="padding-left:14px;">
            <div style="font-family:${FONT_STACK};font-size:15px;font-weight:700;color:#1a1d29;">Need a hand getting started?</div>
            <div style="font-family:${FONT_STACK};font-size:13.5px;color:#7a8493;margin-top:2px;">Just reply to this email and we’re happy to help.</div>
          </td>
        </tr></table>
      </div>
    </td></tr>`,
    pageFooter(vars.unsubscribeUrl),
  ].join("");

  const html = `<!DOCTYPE html><html lang="en">${emailHead()}<body style="margin:0;padding:0;background:#ffffff;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;"><tr><td align="center" style="padding:24px 14px 22px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;background:#ffffff;border-radius:22px;overflow:hidden;border:1px solid #EAE6E1;box-shadow:0 6px 26px rgba(17,24,39,0.07);">
        <tr><td class="px" style="padding:30px 32px 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${emailHeaderRow("A simpler, better way<br>to progress property sales.", 10)}</table>
        </td></tr>
        <tr><td style="padding:0;"><img src="${EMAIL_ASSET}/hero-invited-full.png" alt="You’re invited. Join the team." style="display:block;width:100%;max-width:100%;border:0;"></td></tr>
        <tr><td class="px" style="padding:6px 34px 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${body}</table>
        </td></tr>
      </table>
    </td></tr></table>
  </body></html>`;

  const text = [
    `Hi ${recipientName},`,
    ``,
    `${vars.invitedByName.trim()} has invited you to join ${vars.agencyName.trim()} as a ${roleWord} on Sales Progressor.`,
    ``,
    valueLine,
    ``,
    `Set up your account: ${vars.acceptUrl}`,
    ``,
    `Your invitation is open for 7 days.`,
    ``,
    `Need a hand getting started? Just reply to this email and we’re happy to help.`,
    ``,
    `TSP · Sales Progressor`,
    `A simpler, better way to progress property sales.`,
    vars.unsubscribeUrl ? `\nDon’t want these emails? ${vars.unsubscribeUrl}` : "",
  ].filter(Boolean).join("\n");

  return { subject, html, text };
}
