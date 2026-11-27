// Progressor Network connect-handshake emails. Three events, three emails:
//   - request   → the progression business owner (an agency wants to connect)
//   - accepted  → the requesting agency director (you're connected)
//   - declined  → the requesting agency director (not taken up)
//
// Same lifecycle family as team-joined / retention: shared header + footer +
// coral button helpers from ./retention, no baked hero (these are transactional
// nudges, not celebrations). Voice-passed: no em-dashes, no exclamations.

import { FONT_STACK, emailHead, emailHeaderRow, pageFooter } from "./retention";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

type Built = { subject: string; html: string; text: string };

// Shared shell: header row + body rows + footer (no hero), identical frame to
// the rest of the lifecycle family.
function shell(bodyRows: string): string {
  return `<!DOCTYPE html><html lang="en">${emailHead()}<body style="margin:0;padding:0;background:#ffffff;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;"><tr><td align="center" style="padding:24px 14px 22px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;background:#ffffff;border-radius:22px;overflow:hidden;border:1px solid #EAE6E1;box-shadow:0 6px 26px rgba(17,24,39,0.07);">
        <tr><td class="px" style="padding:30px 32px 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${emailHeaderRow("A simpler, better way<br>to progress property sales.")}</table>
        </td></tr>
        <tr><td class="px" style="padding:26px 34px 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${bodyRows}</table>
        </td></tr>
      </table>
    </td></tr></table>
  </body></html>`;
}

function heading(text: string): string {
  return `<tr><td style="padding:0 2px 2px;font-family:${FONT_STACK};font-size:22px;font-weight:750;letter-spacing:-0.02em;color:#1a1d29;">${text}</td></tr>`;
}

function paras(html: string): string {
  return `<tr><td style="padding:14px 2px 0;font-family:${FONT_STACK};font-size:16px;line-height:1.6;color:#374151;">${html}</td></tr>`;
}

function button(label: string, url: string): string {
  return `<tr><td style="padding:28px 0 4px;">
    <div style="background:#FF6B4A;background:linear-gradient(180deg,#FF7E57 0%,#F0511A 100%);border-radius:16px;text-align:center;box-shadow:0 6px 16px rgba(240,81,26,0.34);">
      <a href="${url}" style="display:block;padding:17px 20px;font-family:${FONT_STACK};font-size:16px;font-weight:700;color:#ffffff;text-decoration:none;">${label}  &rarr;</a>
    </div>
  </td></tr>`;
}

function quote(text: string): string {
  return `<tr><td style="padding:16px 2px 0;">
    <div style="padding:14px 17px;background:#F7F5F2;border:1px solid #ECE7E1;border-radius:12px;font-family:${FONT_STACK};font-size:15px;line-height:1.55;color:#4b5563;font-style:italic;">&ldquo;${text}&rdquo;</div>
  </td></tr>`;
}

/** Event 1 — to the progression-business owner: an agency wants to connect. */
export function buildNetworkConnectRequest(vars: {
  recipientFirstName: string;
  agencyName: string;
  note?: string | null;
  reviewUrl: string;
  unsubscribeUrl?: string;
}): Built {
  const first = escapeHtml(vars.recipientFirstName.trim());
  const agency = escapeHtml(vars.agencyName.trim());
  const note = vars.note?.trim() ? escapeHtml(vars.note.trim()) : null;
  const subject = `${vars.agencyName.trim()} would like to connect with you`;

  const body = [
    heading("A new connection request"),
    paras(
      `<p style="margin:0 0 14px;">Hi ${first},</p>
       <p style="margin:0;"><strong style="color:#1a1d29;">${agency}</strong> has found you on the Progressor Network and would like to connect. Once you accept, they&rsquo;ll be able to hand sales to you to progress.</p>`,
    ),
    note ? quote(note) : "",
    paras(`<p style="margin:0;">You can accept or decline from your Clients page. We&rsquo;ll let ${agency} know either way.</p>`),
    button("Review the request", vars.reviewUrl),
    pageFooter(vars.unsubscribeUrl),
  ].join("");

  const text = [
    `Hi ${vars.recipientFirstName.trim()},`,
    ``,
    `${vars.agencyName.trim()} has found you on the Progressor Network and would like to connect. Once you accept, they'll be able to hand sales to you to progress.`,
    note ? `\n"${vars.note!.trim()}"\n` : ``,
    `You can accept or decline from your Clients page. We'll let ${vars.agencyName.trim()} know either way.`,
    ``,
    `Review the request: ${vars.reviewUrl}`,
    ``,
    `TSP · Sales Progressor`,
    vars.unsubscribeUrl ? `\nDon't want these emails? ${vars.unsubscribeUrl}` : ``,
  ].filter(Boolean).join("\n");

  return { subject, html: shell(body), text };
}

/** Event 2 — to the requesting agency director: the business accepted. */
export function buildNetworkConnectAccepted(vars: {
  recipientFirstName: string;
  businessName: string;
  assignUrl: string;
  unsubscribeUrl?: string;
}): Built {
  const first = escapeHtml(vars.recipientFirstName.trim());
  const business = escapeHtml(vars.businessName.trim());
  const subject = `You're connected with ${vars.businessName.trim()}`;

  const body = [
    heading("Connection accepted"),
    paras(
      `<p style="margin:0 0 14px;">Hi ${first},</p>
       <p style="margin:0 0 14px;"><strong style="color:#1a1d29;">${business}</strong> has accepted your request. They&rsquo;re now in your progressors list, and you can hand a sale over to them whenever you&rsquo;re ready.</p>
       <p style="margin:0;">Connecting on its own shares nothing. A sale only moves across when you choose to hand one over.</p>`,
    ),
    button("Assign a sale", vars.assignUrl),
    pageFooter(vars.unsubscribeUrl),
  ].join("");

  const text = [
    `Hi ${vars.recipientFirstName.trim()},`,
    ``,
    `${vars.businessName.trim()} has accepted your request. They're now in your progressors list, and you can hand a sale over to them whenever you're ready.`,
    ``,
    `Connecting on its own shares nothing. A sale only moves across when you choose to hand one over.`,
    ``,
    `Assign a sale: ${vars.assignUrl}`,
    ``,
    `TSP · Sales Progressor`,
    vars.unsubscribeUrl ? `\nDon't want these emails? ${vars.unsubscribeUrl}` : ``,
  ].filter(Boolean).join("\n");

  return { subject, html: shell(body), text };
}

/** Event 3 — to the requesting agency director: the request was declined. */
export function buildNetworkConnectDeclined(vars: {
  recipientFirstName: string;
  businessName: string;
  browseUrl: string;
  unsubscribeUrl?: string;
}): Built {
  const first = escapeHtml(vars.recipientFirstName.trim());
  const business = escapeHtml(vars.businessName.trim());
  const subject = `Update on your connection request`;

  const body = [
    heading("Your request wasn&rsquo;t taken up"),
    paras(
      `<p style="margin:0 0 14px;">Hi ${first},</p>
       <p style="margin:0;"><strong style="color:#1a1d29;">${business}</strong> isn&rsquo;t able to take on new connections right now, so your request wasn&rsquo;t taken up. Nothing has been shared, and you&rsquo;re free to connect with other progressors on the network.</p>`,
    ),
    button("Browse the network", vars.browseUrl),
    pageFooter(vars.unsubscribeUrl),
  ].join("");

  const text = [
    `Hi ${vars.recipientFirstName.trim()},`,
    ``,
    `${vars.businessName.trim()} isn't able to take on new connections right now, so your request wasn't taken up. Nothing has been shared, and you're free to connect with other progressors on the network.`,
    ``,
    `Browse the network: ${vars.browseUrl}`,
    ``,
    `TSP · Sales Progressor`,
    vars.unsubscribeUrl ? `\nDon't want these emails? ${vars.unsubscribeUrl}` : ``,
  ].filter(Boolean).join("\n");

  return { subject, html: shell(body), text };
}
