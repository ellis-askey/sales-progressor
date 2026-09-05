// Chain invite reminder — a gentle nudge to an invited agent who hasn't yet
// joined the live chain connected to their sale. TSP-branded (it invites them
// onto the chain view). Redesigned into the lifecycle email family. The title +
// address are overlaid at the top-left of the image on desktop (the art keeps
// that corner clear); the title is baked into the image on mobile.
import { EMAIL_ASSET, FONT_STACK, emailHead, emailHeaderRow, pageFooter } from "./retention";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function buildChainInvite(vars: {
  addressLine1: string; // their sale — street, e.g. "8 Birchwood Close"
  addressLine2?: string; // their sale — town + postcode, e.g. "Guildford, GU1 3RF"
  originatingAddress: string; // the file the chain is linked to, e.g. "22 Willow Road, Richmond"
  chainUrl: string;
  declineUrl: string;
  unsubscribeUrl?: string;
}): { subject: string; html: string; text: string } {
  const line1 = escapeHtml(vars.addressLine1.trim());
  const line2 = vars.addressLine2 ? escapeHtml(vars.addressLine2.trim()) : "";
  const originatingAddress = escapeHtml(vars.originatingAddress.trim());
  const subject = "Your chain is waiting for you";

  // Title + address, overlaid at the top-left on desktop.
  const heroCopy = `<h1 class="hl" style="margin:0;font-family:${FONT_STACK};font-size:28px;line-height:1.1;font-weight:800;color:#0F1B2D;letter-spacing:-0.6px;">Your chain is<br><span style="color:#FF6B4A;">waiting for you.</span></h1>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:14px;"><tr>
      <td valign="top" width="24"><img src="${EMAIL_ASSET}/icon-pin.png" width="17" height="17" alt="" style="display:block;border:0;margin-top:2px;"></td>
      <td valign="top" style="font-family:${FONT_STACK};font-size:14.5px;font-weight:600;color:#54617d;line-height:1.4;">${line1}${line2 ? `<br>${line2}` : ""}</td>
    </tr></table>`;

  // Desktop: title + address overlaid on the empty left of the art (chain cards
  // sit on the right). Mobile / tablet uses the baked image with no overlay.
  const heroDesktop = `<div class="hero-desk" style="background-color:#ffffff;background-image:url('${EMAIL_ASSET}/hero-chainwaiting-desktop.png');background-repeat:no-repeat;background-size:cover;background-position:right center;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      <td class="hero-text" width="50%" height="214" valign="middle" style="padding:20px 8px 20px 34px;">${heroCopy}</td>
      <td width="50%" height="214">&nbsp;</td>
    </tr></table>
  </div>`;

  const heroMobile = `<div class="hero-mob" style="display:none;background-color:#ffffff;">
    <img src="${EMAIL_ASSET}/hero-chainwaiting-mobile.png" alt="Your chain is waiting for you." style="display:block;width:100%;max-width:100%;border:0;">
  </div>`;

  const body = [
    `<tr><td style="padding:16px 2px 0;font-family:${FONT_STACK};font-size:16px;line-height:1.6;color:#374151;">
      <p style="margin:0 0 16px;">A few days ago, we invited you to join the live chain linked to <strong style="color:#1a1d29;">${originatingAddress}</strong>.</p>
      <p style="margin:0;">Your invitation is still open. Join the chain to see where the connected sales have reached and keep sight of how the chain is progressing towards exchange.</p>
    </td></tr>`,
    `<tr><td style="padding:26px 0 0;">
      <div style="background:#FF6B4A;background:linear-gradient(180deg,#FF7E57 0%,#F0511A 100%);border-radius:16px;text-align:center;box-shadow:0 6px 16px rgba(240,81,26,0.34);">
        <a href="${vars.chainUrl}" style="display:block;padding:17px 20px;font-family:${FONT_STACK};font-size:16px;font-weight:700;color:#ffffff;text-decoration:none;">View the chain  &rarr;</a>
      </div>
    </td></tr>`,
    `<tr><td style="padding:26px 2px 0;">
      <div style="border-top:1px solid #ECECEC;padding-top:16px;">
        <table role="presentation" cellpadding="0" cellspacing="0"><tr>
          <td valign="top" width="30"><img src="${EMAIL_ASSET}/icon-info-grey.png" width="20" height="20" alt="" style="display:block;border:0;margin-top:1px;"></td>
          <td valign="top" style="font-family:${FONT_STACK};font-size:13.5px;color:#8a93a3;line-height:1.5;">Not the right agent for this sale? <a href="${vars.declineUrl}" style="color:#3b82f6;text-decoration:underline;">Let us know</a> and we won’t send you any more reminders.</td>
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
        <tr><td style="padding:0;">${heroDesktop}${heroMobile}</td></tr>
        <tr><td class="px" style="padding:6px 34px 18px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${body}</table>
        </td></tr>
      </table>
    </td></tr></table>
  </body></html>`;

  const text = [
    `A few days ago, we invited you to join the live chain linked to ${vars.originatingAddress.trim()}.`,
    ``,
    `Your invitation is still open. Join the chain to see where the connected sales have reached and keep sight of how the chain is progressing towards exchange.`,
    ``,
    `View the chain: ${vars.chainUrl}`,
    ``,
    `Not the right agent for this sale? Let us know and we won’t send you any more reminders: ${vars.declineUrl}`,
    ``,
    `TSP · Sales Progressor`,
    `A simpler, better way to progress property sales.`,
    vars.unsubscribeUrl ? `\nDon’t want these emails? ${vars.unsubscribeUrl}` : "",
  ].filter(Boolean).join("\n");

  return { subject, html, text };
}
