// Agency invitation — a prospecting email sent (from the Command Centre) to a
// prospect agency, inviting them onto Sales Progressor. Same visual family as
// the redesigned lifecycle emails; reuses their shared helpers.
import { EMAIL_ASSET, FONT_STACK, emailHead, emailHeaderRow, bigButton } from "./retention";

const WEBSITE = "https://www.thesalesprogressor.co.uk";

export function buildAgencyInvitation(vars: {
  firstName?: string;
  acceptUrl: string;
}): { subject: string; html: string; text: string } {
  const greeting = vars.firstName && vars.firstName.trim() ? `Hi ${vars.firstName.trim()},` : "Hi there,";
  const subject = "Sales progression, without the spreadsheets";

  // One feature cell (icon + title + sub). The wrapping divs carry the responsive
  // widths: on desktop 3-across (33.33% each); on mobile the first two go 50/50
  // and the third spans full width underneath (.inv2 / .inv1 rules in emailHead).
  const col = (icon: string, title: string, sub: string) =>
    `<img src="${EMAIL_ASSET}/${icon}" width="52" height="52" alt="" style="border:0;display:block;margin:0 auto 12px;"><div style="font-family:${FONT_STACK};font-size:14px;font-weight:700;color:#1a1d29;line-height:1.35;">${title}</div><div style="font-family:${FONT_STACK};font-size:12.5px;color:#8a93a3;line-height:1.45;margin-top:5px;">${sub}</div>`;

  const featureGrid = `<div style="background:#FDF0EA;background:linear-gradient(180deg,#FEF4EF 0%,#FBE6DC 100%);border:1px solid #FBE1D5;border-radius:16px;padding:26px 8px;box-shadow:0 2px 12px rgba(216,90,53,0.07);"><div style="text-align:center;font-size:0;"><div class="inv2" style="display:inline-block;box-sizing:border-box;width:33.33%;max-width:33.33%;vertical-align:top;text-align:center;padding:0 8px;">${col("icon-eye-peach.png", "Keep every sale visible", "Know exactly where every file is up to.")}</div><div class="inv2" style="display:inline-block;box-sizing:border-box;width:33.33%;max-width:33.33%;vertical-align:top;text-align:center;padding:0 8px;border-left:1px solid #F3DACE;">${col("icon-bell.png", "Know what needs attention", "See overdue chases, reminders and stalled sales.")}</div><div class="inv1" style="display:inline-block;box-sizing:border-box;width:33.33%;max-width:33.33%;vertical-align:top;text-align:center;padding:0 8px;border-left:1px solid #F3DACE;">${col("icon-team.png", "Keep everyone updated", "Automate the repetitive chasing and client updates.")}</div></div></div>`;

  const body = [
    `<tr><td style="padding:8px 2px 0;">
      <p style="margin:0 0 8px;font-family:${FONT_STACK};font-size:12px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#9aa2b1;">Your invitation</p>
      <h1 class="hl" style="margin:0;font-family:${FONT_STACK};font-size:34px;line-height:1.08;font-weight:800;color:#0F1B2D;letter-spacing:-0.8px;">Sales progression, <span style="color:#FF6B4A;">without the spreadsheets.</span></h1>
    </td></tr>`,
    `<tr><td style="padding:18px 2px 0;font-family:${FONT_STACK};font-size:15.5px;line-height:1.6;color:#374151;">
      <p style="margin:0 0 16px;">${greeting}</p>
      <p style="margin:0 0 16px;">We wanted to give your agency access to Sales Progressor.</p>
      <p style="margin:0;">It’s built to make everything after sale agreed easier. Keep track of every file, see what needs your attention and keep buyers and sellers updated, all in one place.</p>
    </td></tr>`,
    `<tr><td style="padding:24px 0 0;">${featureGrid}</td></tr>`,
    `<tr><td align="center" style="padding:30px 8px 0;">
      <p style="margin:0;font-family:${FONT_STACK};font-size:21px;font-weight:800;color:#1a1d29;">And the software is completely free.</p>
      <p style="margin:8px 0 0;font-family:${FONT_STACK};font-size:15px;color:#8a93a3;">No subscription. No charge per sale. Add a sale and start using it.</p>
    </td></tr>`,
    `<tr><td align="center" style="padding:22px 0 0;">${bigButton("Accept your invitation  &rarr;", vars.acceptUrl)}</td></tr>`,
    `<tr><td align="center" style="padding:14px 8px 0;"><p style="margin:0;font-family:${FONT_STACK};font-size:14px;color:#9aa2b1;">You can have your first sale up and running in a couple of minutes.</p></td></tr>`,
    `<tr><td style="padding:26px 0 0;">
      <div style="background:#FDF0EA;background:linear-gradient(180deg,#FEF4EF 0%,#FBE6DC 100%);border:1px solid #FBE1D5;border-radius:16px;padding:18px 20px;box-shadow:0 2px 12px rgba(216,90,53,0.07);">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
          <td valign="middle" width="52"><img src="${EMAIL_ASSET}/icon-headset.png" width="48" height="48" alt="" style="display:block;border:0;"></td>
          <td valign="middle" style="padding-left:14px;">
            <div style="font-family:${FONT_STACK};font-size:15px;font-weight:700;color:#1a1d29;">Want us to handle a sale instead?</div>
            <div style="font-family:${FONT_STACK};font-size:13px;color:#7a8493;line-height:1.45;margin-top:2px;">We can take the progression off your hands too, and your first one is on us.</div>
          </td>
          <td class="cbtn" valign="middle" align="right" style="white-space:nowrap;padding-left:12px;">
            <a href="${WEBSITE}" style="display:inline-block;padding:11px 20px;border:1.5px solid #FF6B4A;border-radius:12px;color:#FF6B4A;font-family:${FONT_STACK};font-weight:700;font-size:14px;text-decoration:none;white-space:nowrap;">Learn more  &rarr;</a>
          </td>
        </tr></table>
      </div>
    </td></tr>`,
    `<tr><td style="padding:26px 2px 0;">
      <div style="border-top:1px solid #ECECEC;padding-top:18px;">
        <div style="font-family:${FONT_STACK};font-size:13px;color:#FF6B4A;font-weight:800;">TSP <span style="color:#c7ccd6;font-weight:400;">&middot;</span> <span style="font-weight:500;color:#8a93a3;">Sales Progressor</span></div>
        <div style="font-family:${FONT_STACK};font-size:12px;color:#9aa2b1;margin-top:3px;">Property sales. Progress made simpler.</div>
      </div>
    </td></tr>`,
  ].join("");

  const html = `<!DOCTYPE html><html lang="en">${emailHead()}<body style="margin:0;padding:0;background:#ffffff;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;"><tr><td align="center" style="padding:24px 14px 22px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;background:#ffffff;border-radius:22px;overflow:hidden;border:1px solid #EAE6E1;box-shadow:0 6px 26px rgba(17,24,39,0.07);">
        <tr><td class="px" style="padding:30px 32px 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${emailHeaderRow("A simpler, better way<br>to progress property sales.", 28, false)}</table>
        </td></tr>
        <tr><td style="padding:0;"><img src="${EMAIL_ASSET}/hero-invitation.png" alt="" style="display:block;width:100%;max-width:100%;border:0;"></td></tr>
        <tr><td class="px" style="padding:18px 34px 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${body}</table>
        </td></tr>
        <tr><td style="padding:14px 0 0;"><img src="${EMAIL_ASSET}/footer-flourish.png" alt="" style="display:block;width:100%;max-width:100%;border:0;"></td></tr>
      </table>
    </td></tr></table>
  </body></html>`;

  const text = [
    greeting,
    ``,
    `We wanted to give your agency access to Sales Progressor.`,
    ``,
    `It’s built to make everything after sale agreed easier. Keep track of every file, see what needs your attention and keep buyers and sellers updated, all in one place.`,
    ``,
    `And the software is completely free. No subscription. No charge per sale.`,
    ``,
    `Accept your invitation: ${vars.acceptUrl}`,
    ``,
    `Want us to handle a sale instead? Your first one is on us. Learn more: ${WEBSITE}`,
    ``,
    `TSP · Sales Progressor`,
    `Property sales. Progress made simpler.`,
  ].join("\n");

  return { subject, html, text };
}
