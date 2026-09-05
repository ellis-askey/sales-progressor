// Domain auth broken — sent (by the nightly check-domains cron) to an agency
// director when a previously-working sending domain fails re-validation, so mail
// from their agency addresses can't send until it's reconnected. Redesigned into
// the lifecycle email family. Title overlaid on the image on desktop, baked into
// the image on mobile.
import { EMAIL_ASSET, FONT_STACK, emailHead, emailHeaderRow, pageFooter } from "./retention";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function buildDomainAuth(vars: {
  firstName: string;
  domain: string; // bare domain, e.g. "chenpartners.co.uk"
  fixUrl: string; // sending-settings page
  unsubscribeUrl?: string;
}): { subject: string; html: string; text: string } {
  const firstName = escapeHtml(vars.firstName.trim());
  const domain = escapeHtml(vars.domain.trim().replace(/^@/, ""));
  const at = `@${domain}`;
  const subject = "Your sending address needs attention";

  // Single baked hero ("Your sending address needs attention.") for all breakpoints.
  const hero = `<img src="${EMAIL_ASSET}/hero-domainauth.png" alt="Your sending address needs attention." style="display:block;width:100%;max-width:100%;border:0;">`;

  // Full-width bulletproof button that sits inside the peach callout.
  const fixButton = `<div style="background:#FF6B4A;background:linear-gradient(180deg,#FF7E57 0%,#F0511A 100%);border-radius:16px;text-align:center;box-shadow:0 6px 16px rgba(240,81,26,0.30);">
    <a href="${vars.fixUrl}" style="display:block;padding:16px 20px;font-family:${FONT_STACK};font-size:16px;font-weight:700;color:#ffffff;text-decoration:none;text-align:center;">Fix sending address  &rarr;</a>
  </div>`;

  const body = [
    `<tr><td style="padding:6px 2px 0;font-family:${FONT_STACK};font-size:16px;line-height:1.6;color:#374151;">
      <p style="margin:0 0 16px;">Hi ${firstName},</p>
      <p style="margin:0 0 16px;">We’ve lost the connection that allows Sales Progressor to send emails from <strong style="color:#1a1d29;">${at}</strong>.</p>
      <p style="margin:0;">Until it’s reconnected, emails using your agency address won’t send through Sales Progressor.</p>
    </td></tr>`,
    `<tr><td style="padding:24px 0 0;">
      <div style="background:#FDF0EA;background:linear-gradient(180deg,#FEF4EF 0%,#FBE6DC 100%);border:1px solid #FBE1D5;border-radius:16px;padding:20px 22px;box-shadow:0 2px 12px rgba(216,90,53,0.07);">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
          <td valign="top" width="60"><img src="${EMAIL_ASSET}/icon-gear-line.png" width="50" height="50" alt="" style="display:block;border:0;"></td>
          <td valign="top" style="padding-left:16px;">
            <div style="font-family:${FONT_STACK};font-size:17px;font-weight:800;color:#0F1B2D;">Reconnect your sending address</div>
            <div style="font-family:${FONT_STACK};font-size:14px;color:#8a93a3;line-height:1.5;margin-top:4px;">Open your sending settings and we’ll show you what needs updating.</div>
          </td>
        </tr></table>
        <div style="padding-top:18px;">${fixButton}</div>
      </div>
    </td></tr>`,
    `<tr><td style="padding:16px 0 0;">
      <div style="background:#F3F5F7;border-radius:16px;padding:18px 20px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
          <td valign="top" width="56"><img src="${EMAIL_ASSET}/icon-question-line.png" width="46" height="46" alt="" style="display:block;border:0;"></td>
          <td valign="top" style="padding-left:14px;">
            <div style="font-family:${FONT_STACK};font-size:15px;font-weight:800;color:#1a1d29;">Why has this happened?</div>
            <div style="font-family:${FONT_STACK};font-size:13.5px;color:#7a8493;line-height:1.5;margin-top:4px;">This normally means one of the records used to connect your domain has been changed or removed. Reconnecting it will restore sending from your agency addresses.</div>
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
        <tr><td class="px" style="padding:6px 34px 18px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${body}</table>
        </td></tr>
      </table>
    </td></tr></table>
  </body></html>`;

  const text = [
    `Hi ${vars.firstName.trim()},`,
    ``,
    `We’ve lost the connection that allows Sales Progressor to send emails from ${at}.`,
    ``,
    `Until it’s reconnected, emails using your agency address won’t send through Sales Progressor.`,
    ``,
    `Reconnect your sending address: ${vars.fixUrl}`,
    ``,
    `Why has this happened? This normally means one of the records used to connect your domain has been changed or removed. Reconnecting it will restore sending from your agency addresses.`,
    ``,
    `TSP · Sales Progressor`,
    `A simpler, better way to progress property sales.`,
    vars.unsubscribeUrl ? `\nDon’t want these emails? ${vars.unsubscribeUrl}` : "",
  ].filter(Boolean).join("\n");

  return { subject, html, text };
}
