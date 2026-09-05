// Password reset — transactional security email, redesigned into the lifecycle
// email family. Full-bleed hero with the headline overlaid on desktop and baked
// into the mobile image (the Gmail app can't overlay text on an image). Reuses
// the shared header / footer / button helpers so it matches the first five.
import { EMAIL_ASSET, FONT_STACK, emailHead, emailHeaderRow, pageFooter } from "./retention";

export function buildPasswordReset(vars: { resetUrl: string; unsubscribeUrl?: string }): { subject: string; html: string; text: string } {
  const subject = "Reset your Sales Progressor password";

  // Single baked hero (title in the art) for all breakpoints.
  const hero = `<img src="${EMAIL_ASSET}/hero-reset-full.png" alt="Reset your password." style="display:block;width:100%;max-width:100%;border:0;">`;

  const body = [
    `<tr><td style="padding:16px 2px 0;font-family:${FONT_STACK};font-size:16px;line-height:1.6;color:#374151;">
      <p style="margin:0;">We received a request to reset the password for your Sales Progressor account. Use the button below to choose a new one. The link expires in 1 hour.</p>
    </td></tr>`,
    `<tr><td style="padding:26px 0 0;">
      <div style="background:#FF6B4A;background:linear-gradient(180deg,#FF7E57 0%,#F0511A 100%);border-radius:16px;text-align:center;box-shadow:0 6px 16px rgba(240,81,26,0.34);">
        <a href="${vars.resetUrl}" style="display:block;padding:17px 20px;font-family:${FONT_STACK};font-size:16px;font-weight:700;color:#ffffff;text-decoration:none;">Reset password  &rarr;</a>
      </div>
    </td></tr>`,
    `<tr><td style="padding:22px 0 0;">
      <div style="background:#F3F5F7;border-radius:14px;padding:16px 18px;">
        <table role="presentation" cellpadding="0" cellspacing="0"><tr>
          <td valign="middle" width="48"><img src="${EMAIL_ASSET}/icon-shield.png" width="44" height="44" alt="" style="display:block;border:0;"></td>
          <td valign="middle" style="padding-left:14px;">
            <div style="font-family:${FONT_STACK};font-size:15px;font-weight:700;color:#1a1d29;">Didn’t request this?</div>
            <div style="font-family:${FONT_STACK};font-size:13.5px;color:#7a8493;margin-top:2px;">You can safely ignore this email. Your password won’t change.</div>
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
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${emailHeaderRow("A simpler, better way<br>to progress property sales.", 4)}</table>
        </td></tr>
        <tr><td style="padding:0;">${hero}</td></tr>
        <tr><td class="px" style="padding:2px 34px 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${body}</table>
        </td></tr>
      </table>
    </td></tr></table>
  </body></html>`;

  const text = [
    `Reset your password`,
    ``,
    `We received a request to reset the password for your Sales Progressor account. Use the link below to choose a new one. The link expires in 1 hour.`,
    ``,
    `Reset password: ${vars.resetUrl}`,
    ``,
    `Didn’t request this? You can safely ignore this email. Your password won’t change.`,
    ``,
    `Sales Progressor`,
    vars.unsubscribeUrl ? `\nDon’t want these emails? ${vars.unsubscribeUrl}` : "",
  ].filter(Boolean).join("\n");

  return { subject, html, text };
}
