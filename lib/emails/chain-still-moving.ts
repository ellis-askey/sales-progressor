// Chain "still moving" reminder — the day-14 re-engagement to a neighbour who
// was invited to a chain but still hasn't joined. Sits after the 3-day nudge in
// the invite flow. Single baked hero ("Your chain is still moving. Your sale is
// one part of a much bigger picture.") for all breakpoints.
import { EMAIL_ASSET, FONT_STACK, emailHead, emailHeaderRow, pageFooter } from "./retention";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function buildChainStillMoving(vars: {
  addressLine1: string; // their sale — street
  addressLine2?: string; // their sale — town + postcode
  originatingAddress: string; // the file the chain is linked to
  chainUrl: string;
  declineUrl: string;
  unsubscribeUrl?: string;
}): { subject: string; html: string; text: string } {
  const theirAddress = escapeHtml([vars.addressLine1.trim(), vars.addressLine2?.trim()].filter(Boolean).join(", "));
  const originatingAddress = escapeHtml(vars.originatingAddress.trim());
  const subject = "Your chain is still moving";

  // Single baked hero (title + sub baked into the art) for all breakpoints.
  const hero = `<img src="${EMAIL_ASSET}/hero-chainstillmoving-full.png" alt="Your chain is still moving." style="display:block;width:100%;max-width:100%;border:0;">`;

  const body = [
    `<tr><td style="padding:22px 2px 0;font-family:${FONT_STACK};font-size:16px;line-height:1.6;color:#374151;">
      <p style="margin:0 0 16px;">Your sale at <strong style="color:#1a1d29;">${theirAddress}</strong> remains part of the live chain linked to <strong style="color:#1a1d29;">${originatingAddress}</strong>.</p>
      <p style="margin:0;">The chain has continued to move since we first invited you. You can still join the other agents to keep sight of the wider chain as your sale progresses towards exchange.</p>
    </td></tr>`,
    `<tr><td style="padding:26px 0 0;">
      <div style="background:#FF6B4A;background:linear-gradient(180deg,#FF7E57 0%,#F0511A 100%);border-radius:16px;text-align:center;box-shadow:0 6px 16px rgba(240,81,26,0.34);">
        <a href="${vars.chainUrl}" style="display:block;padding:17px 20px;font-family:${FONT_STACK};font-size:16px;font-weight:700;color:#ffffff;text-decoration:none;">Join the chain  &rarr;</a>
      </div>
    </td></tr>`,
    `<tr><td style="padding:26px 2px 0;">
      <div style="border-top:1px solid #ECECEC;padding-top:16px;">
        <table role="presentation" cellpadding="0" cellspacing="0"><tr>
          <td valign="top" width="30"><img src="${EMAIL_ASSET}/icon-info-grey.png" width="20" height="20" alt="" style="display:block;border:0;margin-top:1px;"></td>
          <td valign="top" style="font-family:${FONT_STACK};font-size:13.5px;color:#8a93a3;line-height:1.5;">Not dealing with this sale? <a href="${vars.declineUrl}" style="color:#3b82f6;text-decoration:underline;">Let us know</a> and we’ll stop the reminders.</td>
        </tr></table>
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
    `Your sale at ${[vars.addressLine1.trim(), vars.addressLine2?.trim()].filter(Boolean).join(", ")} remains part of the live chain linked to ${vars.originatingAddress.trim()}.`,
    ``,
    `The chain has continued to move since we first invited you. You can still join the other agents to keep sight of the wider chain as your sale progresses towards exchange.`,
    ``,
    `Join the chain: ${vars.chainUrl}`,
    ``,
    `Not dealing with this sale? Let us know and we’ll stop the reminders: ${vars.declineUrl}`,
    ``,
    `TSP · Sales Progressor`,
    `A simpler, better way to progress property sales.`,
    vars.unsubscribeUrl ? `\nDon’t want these emails? ${vars.unsubscribeUrl}` : "",
  ].filter(Boolean).join("\n");

  return { subject, html, text };
}
