// Portal message — sent to the agent when a client (buyer/seller) sends a
// message on the file. Redesigned into the lifecycle email family. On desktop the
// personalised title ("{name} sent you a message.") + address are overlaid on the
// image; on mobile the image bakes the generic "You've got a message." (a name
// can't be baked per-send), so the personal detail lives in the message card.
import { EMAIL_ASSET, FONT_STACK, emailHead, emailHeaderRow, pageFooter } from "./retention";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function buildPortalMessage(vars: {
  senderFirstName: string; // "Sarah"
  senderName: string; // "Sarah Bennett"
  senderRole: string; // display role, "Buyer" / "Seller"
  addressLine1: string; // "14 Elm Grove, Wimbledon"
  addressLine2?: string; // "SW19 4QP"
  timestamp: string; // preformatted, "Today at 16:42"
  message: string;
  replyUrl: string;
  avatarUrl?: string; // the sender's actual photo, if they have one
  unsubscribeUrl?: string;
}): { subject: string; html: string; text: string } {
  const senderFirstName = escapeHtml(vars.senderFirstName.trim());
  const senderName = escapeHtml(vars.senderName.trim());
  const senderRole = escapeHtml(vars.senderRole.trim());
  const line1 = escapeHtml(vars.addressLine1.trim());
  const line2 = vars.addressLine2 ? escapeHtml(vars.addressLine2.trim()) : "";
  const timestamp = escapeHtml(vars.timestamp.trim());
  const message = escapeHtml(vars.message.trim()).replace(/\n/g, "<br>");
  const subject = `${vars.senderName.trim()} sent you a message`;

  // Single baked hero ("You've got a message.") for every breakpoint — no overlay.
  const hero = `<img src="${EMAIL_ASSET}/hero-message.png" alt="You’ve got a message." style="display:block;width:100%;max-width:100%;border:0;">`;

  // Avatar: the sender's real photo in a circle when they have one, else the
  // branded id-card avatar tinted to their side (buyer = green, seller = blue),
  // matching the contacts section of the file (ContactAvatar).
  const side = /sell|vendor/i.test(vars.senderRole) ? "seller" : /buy|purchas/i.test(vars.senderRole) ? "buyer" : "fallback";
  const avatar = vars.avatarUrl
    ? `<img src="${vars.avatarUrl}" width="48" height="48" alt="" style="display:block;border:0;width:48px;height:48px;border-radius:50%;object-fit:cover;">`
    : `<img src="${EMAIL_ASSET}/avatar-${side}.png" width="48" height="48" alt="" style="display:block;border:0;width:48px;height:48px;border-radius:50%;">`;

  const messageCard = `<div style="background:#F7F8FA;border-radius:16px;padding:22px 24px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      <td class="msg-av" valign="middle" width="56">${avatar}</td>
      <td class="msg-meta" valign="middle" style="padding-left:14px;">
        <div style="font-family:${FONT_STACK};font-size:17px;font-weight:800;color:#0F1B2D;line-height:1.25;">${senderName}</div>
        <div style="font-family:${FONT_STACK};font-size:13.5px;color:#8a93a3;margin-top:2px;">${senderRole} &middot; ${line1}</div>
      </td>
      <td class="msg-time" valign="top" align="right" style="font-family:${FONT_STACK};font-size:12.5px;color:#9aa2b1;white-space:nowrap;padding-left:8px;">${timestamp}</td>
    </tr></table>
    <div style="border-top:1px solid #E7E9EE;margin-top:16px;padding-top:16px;font-family:${FONT_STACK};font-size:16px;line-height:1.6;color:#1a1d29;">${message}</div>
  </div>`;

  const body = [
    `<tr><td style="padding:22px 0 0;">${messageCard}</td></tr>`,
    `<tr><td style="padding:26px 0 0;">
      <div style="background:#FF6B4A;background:linear-gradient(180deg,#FF7E57 0%,#F0511A 100%);border-radius:16px;text-align:center;box-shadow:0 6px 16px rgba(240,81,26,0.34);">
        <a href="${vars.replyUrl}" style="display:block;padding:17px 20px;font-family:${FONT_STACK};font-size:16px;font-weight:700;color:#ffffff;text-decoration:none;">Reply on the file  &rarr;</a>
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
        <tr><td class="px" style="padding:6px 34px 18px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${body}</table>
        </td></tr>
      </table>
    </td></tr></table>
  </body></html>`;

  const text = [
    `${vars.senderName.trim()} (${vars.senderRole.trim()}) sent you a message about ${[vars.addressLine1.trim(), vars.addressLine2?.trim()].filter(Boolean).join(", ")}:`,
    ``,
    `"${vars.message.trim()}"`,
    ``,
    `Reply on the file: ${vars.replyUrl}`,
    ``,
    `TSP · Sales Progressor`,
    `A simpler, better way to progress property sales.`,
    vars.unsubscribeUrl ? `\nDon’t want these emails? ${vars.unsubscribeUrl}` : "",
  ].filter(Boolean).join("\n");

  return { subject, html, text };
}
