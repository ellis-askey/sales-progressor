// Chain overview ("See the whole chain") — the richer chain invite showing an
// invited agent the shape of the chain their sale sits in. TSP-branded. Redesigned
// into the lifecycle email family. The title is overlaid at the top-left of the
// image on desktop and baked into the image on mobile; the sub-line sits in its
// own little band directly below the hero.
import { EMAIL_ASSET, FONT_STACK, emailHead, emailHeaderRow, pageFooter } from "./retention";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function buildChainOverview(vars: {
  saleAddress: string; // the recipient's own sale, e.g. "8 Birchwood Close"
  originatingAddress: string; // the file the chain is linked to, e.g. "22 Willow Road, Richmond"
  chainSize: number; // total sales in the chain, e.g. 4
  connectedCount: number; // agents already connected — shows the count once it's 2+
  chainUrl: string;
  declineUrl: string;
  unsubscribeUrl?: string;
}): { subject: string; html: string; text: string } {
  const saleAddress = escapeHtml(vars.saleAddress.trim());
  const originatingAddress = escapeHtml(vars.originatingAddress.trim());
  const n = vars.chainSize;
  const connected = vars.connectedCount;
  const subject = "See the whole chain";

  // Single baked hero ("See the whole chain.") for all breakpoints.
  const hero = `<img src="${EMAIL_ASSET}/hero-seechain-full.png" alt="See the whole chain." style="display:block;width:100%;max-width:100%;border:0;">`;

  // Sub-line in its own little band directly below the hero.
  const subLine = `<tr><td style="padding:0;">
    <div style="background:#FBF4F0;border-top:1px solid #F6E7DF;padding:15px 34px;">
      <p style="margin:0;font-family:${FONT_STACK};font-size:15.5px;color:#54617d;line-height:1.5;">The sale of <strong style="color:#1a1d29;">${saleAddress}</strong> is part of a <strong style="color:#1a1d29;">${n}-sale</strong> chain.</p>
    </div>
  </td></tr>`;

  // One feature cell (icon top, title, sub). Rendered as a fixed two-column table
  // so the pair stays side by side at every breakpoint, with a central divider.
  // Inline image centred by the parent's text-align:center (reliable in the Gmail
  // app — a block image with margin:auto drifts left on tablet), text divs centred.
  const col = (icon: string, title: string, sub: string) =>
    `<img src="${EMAIL_ASSET}/${icon}" width="54" height="54" alt="" style="border:0;"><div style="text-align:center;font-family:${FONT_STACK};font-size:15px;font-weight:800;color:#1a1d29;line-height:1.25;margin-top:10px;">${title}</div><div style="text-align:center;font-family:${FONT_STACK};font-size:12.5px;color:#8a93a3;line-height:1.4;margin-top:4px;">${sub}</div>`;

  // The eye stat stays throughout. Once 2+ agents are connected, show the live
  // count; before that (the sender is always the only one connected) show the
  // static "chain visibility" line rather than an underwhelming "1 agent".
  const eyeStat = connected >= 2
    ? col("icon-eye-line.png", `${connected} agents`, "connected so far")
    : col("icon-eye-line.png", "Chain visibility", "beyond your own sale");
  const features = `<div style="background:#FDF0EA;background:linear-gradient(180deg,#FEF4EF 0%,#FBE6DC 100%);border:1px solid #FBE1D5;border-radius:16px;padding:26px 8px;box-shadow:0 2px 12px rgba(216,90,53,0.07);">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="table-layout:fixed;width:100%;"><tr>
      <td width="50%" valign="top" style="text-align:center;padding:0 12px;">${eyeStat}</td>
      <td width="50%" valign="top" style="text-align:center;padding:0 12px;border-left:1px solid #F3DACE;">${col("icon-bars-line.png", "Live updates", "as the chain moves")}</td>
    </tr></table>
  </div>`;

  const body = [
    `<tr><td style="padding:20px 2px 0;">
      <h2 style="margin:0 0 12px;font-family:${FONT_STACK};font-size:22px;font-weight:800;color:#0F1B2D;letter-spacing:-0.4px;">See the chain as it moves.</h2>
      <p style="margin:0 0 14px;font-family:${FONT_STACK};font-size:16px;line-height:1.6;color:#374151;">Your sale has been connected to the live chain linked to <strong style="color:#1a1d29;">${originatingAddress}</strong>.</p>
      <p style="margin:0;font-family:${FONT_STACK};font-size:16px;line-height:1.6;color:#374151;">Join the other agents in the chain to see where the connected sales have reached and keep sight of how the chain is progressing towards exchange.</p>
    </td></tr>`,
    `<tr><td style="padding:24px 0 0;">${features}</td></tr>`,
    `<tr><td style="padding:28px 0 0;">
      <div style="background:#FF6B4A;background:linear-gradient(180deg,#FF7E57 0%,#F0511A 100%);border-radius:16px;text-align:center;box-shadow:0 6px 16px rgba(240,81,26,0.34);">
        <a href="${vars.chainUrl}" style="display:block;padding:17px 20px;font-family:${FONT_STACK};font-size:16px;font-weight:700;color:#ffffff;text-decoration:none;">Join the chain  &rarr;</a>
      </div>
    </td></tr>`,
    `<tr><td style="padding:26px 2px 0;">
      <div style="border-top:1px solid #ECECEC;padding-top:16px;">
        <table role="presentation" cellpadding="0" cellspacing="0"><tr>
          <td valign="top" width="30"><img src="${EMAIL_ASSET}/icon-info-grey.png" width="20" height="20" alt="" style="display:block;border:0;margin-top:1px;"></td>
          <td valign="top" style="font-family:${FONT_STACK};font-size:13.5px;color:#8a93a3;line-height:1.5;">Not the right agent for this sale? <a href="${vars.declineUrl}" style="color:#3b82f6;text-decoration:underline;">Let us know</a> and we won’t send you any more invites.</td>
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
        ${subLine}
        <tr><td class="px" style="padding:6px 34px 18px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${body}</table>
        </td></tr>
      </table>
    </td></tr></table>
  </body></html>`;

  const text = [
    `The sale of ${vars.saleAddress.trim()} is part of a ${n}-sale chain.`,
    ``,
    `See the chain as it moves.`,
    ``,
    `Your sale has been connected to the live chain linked to ${vars.originatingAddress.trim()}. Join the other agents in the chain to see where the connected sales have reached and keep sight of how the chain is progressing towards exchange.`,
    ``,
    connected >= 2
      ? `${connected} agents connected so far. Live updates as the chain moves.`
      : `Chain visibility beyond your own sale. Live updates as the chain moves.`,
    ``,
    `Join the chain: ${vars.chainUrl}`,
    ``,
    `Not the right agent for this sale? Let us know and we won’t send you any more invites: ${vars.declineUrl}`,
    ``,
    `TSP · Sales Progressor`,
    `A simpler, better way to progress property sales.`,
    vars.unsubscribeUrl ? `\nDon’t want these emails? ${vars.unsubscribeUrl}` : "",
  ].filter(Boolean).join("\n");

  return { subject, html, text };
}
