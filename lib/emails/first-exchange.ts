// First exchange — sent to a self-progressing agent when their first sale
// exchanges contracts. A celebration + the free-pricing reassurance + a nudge to
// add the next sale. Redesigned into the lifecycle email family. The hero title
// (headline + address) is overlaid on the image on desktop via a background
// image; on mobile the Gmail app can't overlay, so the title renders as live
// text above a plain copy of the image.
import { EMAIL_ASSET, FONT_STACK, emailHead, emailHeaderRow, pageFooter } from "./retention";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function buildFirstExchange(vars: {
  firstName: string;
  addressLine1: string; // street + town, e.g. "8 Birchwood Close, Guildford"
  addressLine2?: string; // postcode, e.g. "GU1 3RF"
  fileUrl: string;
  addSaleUrl: string;
  unsubscribeUrl?: string;
}): { subject: string; html: string; text: string } {
  const firstName = escapeHtml(vars.firstName.trim());
  const fullAddress = [vars.addressLine1.trim(), vars.addressLine2?.trim()].filter(Boolean).join(", ");
  const subject = "Your first sale has exchanged";

  // Single baked hero ("Your first sale. Exchanged.") for all breakpoints — the
  // title lives in the art, so the address stays in the body copy below.
  const hero = `<img src="${EMAIL_ASSET}/hero-exchanged-full.png" alt="Your first sale. Exchanged." style="display:block;width:100%;max-width:100%;border:0;">`;

  const body = [
    `<tr><td style="padding:4px 2px 0;font-family:${FONT_STACK};font-size:16px;line-height:1.6;color:#374151;">
      <p style="margin:0 0 16px;">Hi ${firstName},</p>
      <p style="margin:0 0 14px;font-size:17px;font-weight:700;color:#1a1d29;">That’s your first exchange through Sales Progressor.</p>
      <p style="margin:0;">Contracts have exchanged on ${escapeHtml(fullAddress)} and the sale is now safely over the line.</p>
    </td></tr>`,
    `<tr><td style="padding:22px 0 0;">
      <div style="background:#FDF0EA;background:linear-gradient(180deg,#FEF4EF 0%,#FBE6DC 100%);border:1px solid #FBE1D5;border-radius:16px;padding:18px 20px;box-shadow:0 2px 12px rgba(216,90,53,0.07);">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
          <td valign="middle" width="60"><img src="${EMAIL_ASSET}/icon-coins-white.png" width="52" height="52" alt="" style="display:block;border:0;"></td>
          <td valign="middle" style="padding-left:16px;">
            <div style="font-family:${FONT_STACK};font-size:21px;font-weight:800;color:#0F1B2D;">£0 to pay</div>
            <div style="font-family:${FONT_STACK};font-size:14px;color:#8a93a3;margin-top:3px;">Self-progressed sales are completely free.</div>
          </td>
        </tr></table>
      </div>
    </td></tr>`,
    `<tr><td style="padding:26px 0 0;">
      <div style="background:#FF6B4A;background:linear-gradient(180deg,#FF7E57 0%,#F0511A 100%);border-radius:16px;text-align:center;box-shadow:0 6px 16px rgba(240,81,26,0.34);">
        <a href="${vars.fileUrl}" style="display:block;padding:17px 20px;font-family:${FONT_STACK};font-size:16px;font-weight:700;color:#ffffff;text-decoration:none;">View the file  &rarr;</a>
      </div>
    </td></tr>`,
    `<tr><td style="padding:26px 0 0;">
      <div style="background:#F3F5F7;border-radius:16px;padding:20px 22px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
          <td valign="top" width="60"><img src="${EMAIL_ASSET}/icon-bars-white.png" width="52" height="52" alt="" style="display:block;border:0;"></td>
          <td valign="top" style="padding-left:16px;">
            <div style="font-family:${FONT_STACK};font-size:16px;font-weight:800;color:#1a1d29;">One down. Keep the rest moving.</div>
            <div style="font-family:${FONT_STACK};font-size:14px;color:#8a93a3;line-height:1.5;margin-top:5px;">Add your next sale whenever you’re ready.<br>Self-progress as many as you like, <strong style="color:#1a1d29;">completely free.</strong></div>
            <div style="margin-top:12px;"><a href="${vars.addSaleUrl}" style="font-family:${FONT_STACK};font-size:15px;font-weight:800;color:#FF6B4A;text-decoration:underline;">Add another sale  &rarr;</a></div>
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
        <tr><td style="padding:0;">${hero}</td></tr>
        <tr><td class="px" style="padding:6px 34px 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${body}</table>
        </td></tr>
      </table>
    </td></tr></table>
  </body></html>`;

  const text = [
    `Hi ${vars.firstName.trim()},`,
    ``,
    `That’s your first exchange through Sales Progressor.`,
    ``,
    `Contracts have exchanged on ${fullAddress} and the sale is now safely over the line.`,
    ``,
    `£0 to pay. Self-progressed sales are completely free.`,
    ``,
    `View the file: ${vars.fileUrl}`,
    ``,
    `One down. Keep the rest moving. Add your next sale whenever you’re ready, and self-progress as many as you like, completely free.`,
    `Add another sale: ${vars.addSaleUrl}`,
    ``,
    `TSP · Sales Progressor`,
    `A simpler, better way to progress property sales.`,
    vars.unsubscribeUrl ? `\nDon’t want these emails? ${vars.unsubscribeUrl}` : "",
  ].filter(Boolean).join("\n");

  return { subject, html, text };
}
