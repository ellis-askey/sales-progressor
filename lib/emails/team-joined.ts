// Team joined — sent to the inviter (director) when a colleague they invited
// accepts and sets up their account. Redesigned into the lifecycle email family;
// reuses the shared header / footer / button helpers. The hero bakes the generic
// "Your team has joined." headline, so the body goes straight into the greeting.
import { EMAIL_ASSET, FONT_STACK, emailHead, emailHeaderRow, pageFooter } from "./retention";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function buildTeamJoined(vars: {
  recipientName: string; // the inviter (first name)
  joinerName: string; // the colleague who accepted (full name)
  agencyName: string;
  joinerRole?: "director" | "negotiator"; // picks the baked hero art
  ctaUrl: string;
  unsubscribeUrl?: string;
}): { subject: string; html: string; text: string } {
  const recipientName = escapeHtml(vars.recipientName.trim());
  const joinerName = escapeHtml(vars.joinerName.trim());
  const agencyName = escapeHtml(vars.agencyName.trim());

  const subject = `${vars.joinerName.trim()} has joined ${vars.agencyName.trim()} on Sales Progressor`;

  // Single baked hero (title in the art) for all breakpoints. A director joining
  // gets its own "Your director has joined." art; anyone else gets the generic
  // "Your team just grew." art.
  const isDirector = vars.joinerRole === "director";
  const hero = `<img src="${EMAIL_ASSET}/${isDirector ? "hero-directorjoined-full.png" : "hero-teamgrew-full.png"}" alt="${isDirector ? "Your director has joined." : "Your team just grew."}" style="display:block;width:100%;max-width:100%;border:0;">`;

  const body = [
    `<tr><td style="padding:6px 2px 0;font-family:${FONT_STACK};font-size:16px;line-height:1.6;color:#374151;">
      <p style="margin:0 0 16px;">Hi ${recipientName},</p>
      <p style="margin:0 0 16px;"><strong style="color:#1a1d29;">${joinerName}</strong> has accepted your invitation and joined <strong style="color:#1a1d29;">${agencyName}</strong>.</p>
      <p style="margin:0;">They can now access the agency’s sales and start managing files alongside the rest of the team.</p>
    </td></tr>`,
    `<tr><td style="padding:28px 0 4px;">
      <div style="background:#FF6B4A;background:linear-gradient(180deg,#FF7E57 0%,#F0511A 100%);border-radius:16px;text-align:center;box-shadow:0 6px 16px rgba(240,81,26,0.34);">
        <a href="${vars.ctaUrl}" style="display:block;padding:17px 20px;font-family:${FONT_STACK};font-size:16px;font-weight:700;color:#ffffff;text-decoration:none;">View your team  &rarr;</a>
      </div>
    </td></tr>`,
    pageFooter(vars.unsubscribeUrl),
  ].join("");

  const html = `<!DOCTYPE html><html lang="en">${emailHead()}<body style="margin:0;padding:0;background:#ffffff;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;"><tr><td align="center" style="padding:24px 14px 22px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;background:#ffffff;border-radius:22px;overflow:hidden;border:1px solid #EAE6E1;box-shadow:0 6px 26px rgba(17,24,39,0.07);">
        <tr><td class="px" style="padding:30px 32px 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${emailHeaderRow("A simpler, better way<br>to progress property sales.")}</table>
        </td></tr>
        <tr><td style="padding:0;">${hero}</td></tr>
        <tr><td class="px" style="padding:6px 34px 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${body}</table>
        </td></tr>
      </table>
    </td></tr></table>
  </body></html>`;

  const text = [
    `Hi ${vars.recipientName.trim()},`,
    ``,
    `${vars.joinerName.trim()} has accepted your invitation and joined ${vars.agencyName.trim()}.`,
    ``,
    `They can now access the agency’s sales and start managing files alongside the rest of the team.`,
    ``,
    `View your team: ${vars.ctaUrl}`,
    ``,
    `TSP · Sales Progressor`,
    `A simpler, better way to progress property sales.`,
    vars.unsubscribeUrl ? `\nDon’t want these emails? ${vars.unsubscribeUrl}` : "",
  ].filter(Boolean).join("\n");

  return { subject, html, text };
}
