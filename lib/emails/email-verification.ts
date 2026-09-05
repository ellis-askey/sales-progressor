// Email verification — sent when an agent verifies a sending address so their
// agency can send client mail from it. Carries a 6-digit code (15-minute expiry)
// and a one-click verify link. Redesigned into the lifecycle email family;
// reuses the shared header / footer / button helpers. The hero bakes the generic
// "Verify your email address." headline, so the body goes straight into the code.
import { EMAIL_ASSET, FONT_STACK, emailHead, emailHeaderRow, pageFooter } from "./retention";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function buildEmailVerification(vars: {
  email: string;
  code: string;
  verifyUrl: string;
  unsubscribeUrl?: string;
}): { subject: string; html: string; text: string } {
  const email = escapeHtml(vars.email.trim());
  const code = escapeHtml(vars.code.trim());
  const subject = "Verify your email address";

  const body = [
    `<tr><td style="padding:20px 2px 0;">
      <p style="margin:0;font-family:${FONT_STACK};font-size:23px;font-weight:800;color:#0F1B2D;letter-spacing:-0.4px;line-height:1.25;word-break:break-all;">Verify <span style="color:#FF6B4A;">${email}</span></p>
      <p style="margin:10px 0 0;font-family:${FONT_STACK};font-size:15.5px;color:#8a93a3;line-height:1.55;">Confirm this address so Sales Progressor can send emails from it.</p>
    </td></tr>`,
    `<tr><td style="padding:22px 0 0;">
      <div style="background:#F3F5F7;border-radius:16px;padding:30px 20px;text-align:center;">
        <div style="font-family:${FONT_STACK};font-size:42px;font-weight:800;letter-spacing:16px;color:#0F1B2D;padding-left:16px;line-height:1;">${code}</div>
        <table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:16px auto 0;"><tr>
          <td valign="middle" width="28"><img src="${EMAIL_ASSET}/icon-clock-coral.png" width="22" height="22" alt="" style="display:block;border:0;"></td>
          <td valign="middle" style="padding-left:8px;font-family:${FONT_STACK};font-size:13.5px;color:#8a93a3;">Expires in 15 minutes.</td>
        </tr></table>
      </div>
    </td></tr>`,
    `<tr><td style="padding:24px 0 0;">
      <div style="background:#FF6B4A;background:linear-gradient(180deg,#FF7E57 0%,#F0511A 100%);border-radius:16px;text-align:center;box-shadow:0 6px 16px rgba(240,81,26,0.34);">
        <a href="${vars.verifyUrl}" style="display:block;padding:17px 20px;font-family:${FONT_STACK};font-size:16px;font-weight:700;color:#ffffff;text-decoration:none;">Verify email  &rarr;</a>
      </div>
    </td></tr>`,
    `<tr><td align="center" style="padding:14px 8px 0;"><p style="margin:0;font-family:${FONT_STACK};font-size:14px;color:#9aa2b1;">Or enter the code above in Sales Progressor.</p></td></tr>`,
    `<tr><td style="padding:24px 0 0;">
      <div style="background:#F3F5F7;border-radius:14px;padding:16px 18px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
          <td valign="middle" width="52"><img src="${EMAIL_ASSET}/icon-shield.png" width="44" height="44" alt="" style="display:block;border:0;"></td>
          <td valign="middle" style="padding-left:14px;">
            <div style="font-family:${FONT_STACK};font-size:15px;font-weight:700;color:#1a1d29;">Didn’t request this?</div>
            <div style="font-family:${FONT_STACK};font-size:13.5px;color:#7a8493;margin-top:2px;">You can safely ignore this email. Nothing will change.</div>
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
        <tr><td style="padding:0;"><img src="${EMAIL_ASSET}/hero-verify.png" alt="Verify your email address." style="display:block;width:100%;max-width:100%;border:0;"></td></tr>
        <tr><td class="px" style="padding:6px 34px 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${body}</table>
        </td></tr>
      </table>
    </td></tr></table>
  </body></html>`;

  const text = [
    `Verify ${vars.email.trim()}`,
    ``,
    `Confirm this address so Sales Progressor can send emails from it.`,
    ``,
    `Your verification code is: ${vars.code.trim()}`,
    `Expires in 15 minutes.`,
    ``,
    `Or verify instantly: ${vars.verifyUrl}`,
    ``,
    `Didn’t request this? You can safely ignore this email. Nothing will change.`,
    ``,
    `TSP · Sales Progressor`,
    `A simpler, better way to progress property sales.`,
    vars.unsubscribeUrl ? `\nDon’t want these emails? ${vars.unsubscribeUrl}` : "",
  ].filter(Boolean).join("\n");

  return { subject, html, text };
}
