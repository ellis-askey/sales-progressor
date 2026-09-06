// Chain update — sent to a connected neighbour agent when a buyer on a linked
// sale confirms progress on their onward purchase. Redesigned into the lifecycle
// email family: standard TSP header, the sending agency named in the sign-off.
// The hero title + address are overlaid on desktop and the baked image is used on
// tablet/mobile (no overlaid text there).
import { EMAIL_ASSET, FONT_STACK, emailHead, emailHeaderRow, pageFooter } from "./retention";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
function capitalise(s: string): string {
  return s.length ? s[0].toUpperCase() + s.slice(1) : s;
}

export function buildChainUpdate(vars: {
  recipientName: string; // the connected neighbour agent/agency, e.g. "Bridgewater Estates"
  agencyName: string; // the sending agency, e.g. "Chen & Partners Estate Agents"
  agencyLogoUrl?: string; // optional — the sending agency's uploaded logo
  sellerName: string; // the client who confirmed, e.g. "Marcus Fielding"
  actorRelation?: string; // how the client relates to the address. Default "the buyer
  // of" (onward: they're buying it). "the seller of" for the related-sale mirror.
  onwardAddress: string; // full address, for the body, e.g. "22 Willow Road, Richmond, TW9 1PL"
  onwardAddressShort?: string; // shorter form for the hero, e.g. "22 Willow Road, Richmond"
  labels: string[]; // the confirmed steps, e.g. ["contracts exchanged on their sale", ...]
  chainUrl: string;
  unsubscribeUrl?: string;
}): { subject: string; html: string; text: string } {
  const actorRelation = (vars.actorRelation ?? "the buyer of").trim();
  const recipientName = escapeHtml(vars.recipientName.trim());
  const agencyName = escapeHtml(vars.agencyName.trim());
  const sellerName = escapeHtml(vars.sellerName.trim());
  const onwardFull = escapeHtml(vars.onwardAddress.trim());
  const onwardShort = escapeHtml((vars.onwardAddressShort ?? vars.onwardAddress).trim());
  const subject = `An update in your chain at ${vars.onwardAddress.trim()}`;

  // Title + address, shared by the desktop overlay.
  const heroCopy = `<h1 class="hl" style="margin:0;font-family:${FONT_STACK};font-size:32px;line-height:1.08;font-weight:800;color:#0F1B2D;letter-spacing:-0.6px;">Something’s moved<br><span style="color:#FF6B4A;">in your chain.</span></h1>
    <p style="margin:16px 0 0;font-family:${FONT_STACK};font-size:15px;color:#54617d;line-height:1.4;">An update on<br>${onwardShort}</p>`;

  const heroDesktop = `<div class="hero-desk" style="background-color:#FDF1EA;background-image:url('${EMAIL_ASSET}/hero-chain-desktop.png');background-repeat:no-repeat;background-size:cover;background-position:right center;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      <td class="hero-text" width="50%" height="296" valign="middle" style="padding:20px 8px 20px 34px;">${heroCopy}</td>
      <td width="50%" height="296">&nbsp;</td>
    </tr></table>
  </div>`;

  const heroMobile = `<div class="hero-mob" style="display:none;background-color:#ffffff;">
    <img src="${EMAIL_ASSET}/hero-chain-mobile.png" alt="Something’s moved in your chain." style="display:block;width:100%;max-width:100%;border:0;">
  </div>`;

  const checkRows = vars.labels
    .map(
      (l, i) => `${i > 0 ? `<tr><td colspan="2" style="padding:0 2px;"><div style="border-top:1px solid #F3DACE;"></div></td></tr>` : ""}
      <tr>
        <td valign="middle" width="56" style="padding:16px 0;"><img src="${EMAIL_ASSET}/icon-check-coral.png" width="38" height="38" alt="" style="display:block;border:0;"></td>
        <td valign="middle" style="padding:16px 0 16px 14px;font-family:${FONT_STACK};font-size:16px;font-weight:600;color:#1a1d29;line-height:1.4;">${escapeHtml(capitalise(l))}</td>
      </tr>`,
    )
    .join("");
  const checklist = `<div style="background:#FDF0EA;background:linear-gradient(180deg,#FEF4EF 0%,#FBEEE7 100%);border:1px solid #FBE1D5;border-radius:16px;padding:2px 22px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${checkRows}</table></div>`;

  const body = [
    `<tr><td style="padding:6px 2px 0;font-family:${FONT_STACK};font-size:16px;line-height:1.6;color:#374151;">
      <p style="margin:0 0 16px;">Hi ${recipientName},</p>
      <p style="margin:0;"><strong style="color:#1a1d29;">${sellerName}</strong>, ${actorRelation} <strong style="color:#1a1d29;">${onwardFull}</strong>, has confirmed:</p>
    </td></tr>`,
    `<tr><td style="padding:18px 0 0;">${checklist}</td></tr>`,
    `<tr><td style="padding:18px 2px 0;font-family:${FONT_STACK};font-size:16px;line-height:1.6;color:#374151;">
      <p style="margin:0;">The chain has been updated with their progress, so you can see the latest position across the rest of the chain too.</p>
    </td></tr>`,
    `<tr><td style="padding:26px 0 0;">
      <div style="background:#FF6B4A;background:linear-gradient(180deg,#FF7E57 0%,#F0511A 100%);border-radius:16px;text-align:center;box-shadow:0 6px 16px rgba(240,81,26,0.34);">
        <a href="${vars.chainUrl}" style="display:block;padding:17px 20px;font-family:${FONT_STACK};font-size:16px;font-weight:700;color:#ffffff;text-decoration:none;">See the full chain  &rarr;</a>
      </div>
    </td></tr>`,
    `<tr><td style="padding:26px 2px 0;font-family:${FONT_STACK};font-size:16px;line-height:1.5;color:#374151;">
      <p style="margin:0 0 2px;">Kind regards,</p>
      <p style="margin:0;font-weight:800;color:#1a1d29;">${agencyName}</p>
    </td></tr>`,
    pageFooter(vars.unsubscribeUrl),
  ].join("");

  const html = `<!DOCTYPE html><html lang="en">${emailHead()}<body style="margin:0;padding:0;background:#ffffff;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;"><tr><td align="center" style="padding:24px 14px 22px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;background:#ffffff;border-radius:22px;overflow:hidden;border:1px solid #EAE6E1;box-shadow:0 6px 26px rgba(17,24,39,0.07);">
        <tr><td class="px" style="padding:30px 32px 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${emailHeaderRow("A simpler, better way<br>to progress property sales.")}</table>
        </td></tr>
        <tr><td style="padding:0;">${heroDesktop}${heroMobile}</td></tr>
        <tr><td class="px" style="padding:6px 34px 18px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${body}</table>
        </td></tr>
      </table>
    </td></tr></table>
  </body></html>`;

  const text = [
    `Hi ${vars.recipientName.trim()},`,
    ``,
    `${vars.sellerName.trim()}, ${actorRelation} ${vars.onwardAddress.trim()}, has confirmed:`,
    ...vars.labels.map((l) => `  - ${capitalise(l)}`),
    ``,
    `The chain has been updated with their progress, so you can see the latest position across the rest of the chain too.`,
    ``,
    `See the full chain: ${vars.chainUrl}`,
    ``,
    `Kind regards,`,
    vars.agencyName.trim(),
    ``,
    `TSP · Sales Progressor`,
    `A simpler, better way to progress property sales.`,
    vars.unsubscribeUrl ? `\nDon’t want these emails? ${vars.unsubscribeUrl}` : "",
  ].filter(Boolean).join("\n");

  return { subject, html, text };
}
