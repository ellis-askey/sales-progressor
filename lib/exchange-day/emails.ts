// Exchange-day solicitor emails (Phase 3). Three plain, warm, professional
// emails to the buyer's + seller's solicitor individually. Founder-approved
// copy — see docs/active/exchange-day-SPEC.md. No buttons; bold sign-off name.

export type ExchangeDaySlot = "morning" | "midday" | "afternoon";

export type ExchangeDayEmailVars = {
  firstName: string;
  address: string;       // full property address
  addressShort: string;  // first line, for subjects
  completionDate: string; // long-form, e.g. "Thursday, 4 September 2026"
  senderName: string;    // the progressor/agent signing off
  agencyName: string;
};

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Paragraphs → simple, readable HTML. Sign-off name is bold, agency beneath.
function wrapHtml(paragraphs: string[], senderName: string, agencyName: string): string {
  const body = paragraphs
    .map((p) => `<p style="margin:0 0 16px;font-size:15px;line-height:1.55;color:#1a1d29">${esc(p)}</p>`)
    .join("\n");
  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;padding:8px 4px;color:#1a1d29">
${body}
<p style="margin:22px 0 0;font-size:15px;line-height:1.5;color:#1a1d29">Best regards,<br /><strong>${esc(senderName)}</strong><br /><span style="color:#5b6273">${esc(agencyName)}</span></p>
</div>`;
}

export function buildExchangeDaySolicitorEmail(
  slot: ExchangeDaySlot,
  v: ExchangeDayEmailVars,
): { subject: string; text: string; html: string } {
  let subject = "";
  let paras: string[] = [];

  if (slot === "morning") {
    subject = `Exchange today: ${v.addressShort}`;
    paras = [
      `Hi ${v.firstName},`,
      `I hope you are well.`,
      `We're aiming to exchange contracts on ${v.address} today, with completion agreed for ${v.completionDate}. As far as we're aware, all parties are set to exchange today, so hopefully we're in a good position to get things over the line.`,
      `If anything comes up that we can help with from our side, just let us know and we'll do what we can to keep things moving.`,
    ];
  } else if (slot === "midday") {
    subject = `${v.addressShort} — exchange update`;
    paras = [
      `Hi ${v.firstName},`,
      `Hope you're well. I just wanted to check in to see how things are progressing with exchange on ${v.address}, as we're still hoping to get everything over the line today.`,
      `If there's been any further movement towards exchange, we'd really appreciate an update when you have a moment. If there's anything we can chase or help with from our side, please let us know.`,
    ];
  } else {
    subject = `${v.addressShort} — end of day`;
    paras = [
      `Hi ${v.firstName},`,
      `We haven't had confirmation of exchange yet, so I just wanted to touch base one last time so that I can update the clients and manage expectations if things are going to drift into another day.`,
      `Please let us know the latest when you can, and if there's anything we can do to help get things across the line.`,
    ];
  }

  const text = `${paras.join("\n\n")}\n\nBest regards,\n${v.senderName}\n${v.agencyName}`;
  const html = wrapHtml(paras, v.senderName, v.agencyName);
  return { subject, text, html };
}

/* ─── Client emails (Phase 6 — added alongside the portal card, not replacing
   it). Two per exchange day: a 9am informational + authority ask (buyer/seller
   variant, no button — Ellis's approved copy), and a short 11am authority
   nudge with an "I've given authority" button that deep-links to the portal's
   existing confirm. Sign-off is "Kind regards" (clients) vs "Best regards"
   (solicitors above). Same clean single-column wrapper. ────────────────── */

export type ExchangeDayClientVars = {
  firstName: string;
  address: string;        // full property address
  addressShort: string;   // first line, for subjects
  completionDate: string; // long-form
  senderName: string;
  agencyName: string;
  saleWord: "sale" | "purchase"; // vendor -> "sale", purchaser -> "purchase"
};

function clientPara(p: string): string {
  return `<p style="margin:0 0 16px;font-size:15px;line-height:1.55;color:#1a1d29">${esc(p)}</p>`;
}

function clientSignOff(senderName: string, agencyName: string): string {
  return `<p style="margin:22px 0 0;font-size:15px;line-height:1.5;color:#1a1d29">Kind regards,<br /><strong>${esc(senderName)}</strong><br /><span style="color:#5b6273">${esc(agencyName)}</span></p>`;
}

// Bulletproof (td bgcolor) button so it renders in Outlook etc.
function clientButton(url: string, label: string): string {
  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:6px 0 20px"><tr><td align="center" bgcolor="#FF6B4A" style="border-radius:12px"><a href="${esc(url)}" style="display:inline-block;padding:14px 30px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:12px">${esc(label)}</a></td></tr></table>`;
}

function clientShell(inner: string): string {
  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;padding:8px 4px;color:#1a1d29">
${inner}
</div>`;
}

// 9am — informational + authority ask. No button.
export function buildExchangeDayClientMorningEmail(v: ExchangeDayClientVars): { subject: string; text: string; html: string } {
  const subject = `Exchange today: ${v.addressShort}`;
  const paras = [
    `Hi ${v.firstName},`,
    `I hope you are well.`,
    `We're aiming to exchange contracts on your ${v.saleWord} of ${v.address} today, with completion agreed for ${v.completionDate}.`,
    `We've already been in touch with the solicitors this morning and will check in again just before 1pm, and later this afternoon if needed. We'll keep you updated as the day progresses.`,
    `Your solicitor will need your authority before they can exchange contracts. If you haven't already given this verbally, please give them a quick call or send them an email confirming you're happy to exchange with completion on ${v.completionDate}. If you're emailing, please feel free to copy us in so we have visibility too.`,
    `If your solicitor tells you there's anything preventing them from exchanging today, please let us know as soon as you can so we can help chase anything needed.`,
    `Likewise, if you hear anything before we do, please keep us posted.`,
  ];
  const text = `${paras.join("\n\n")}\n\nKind regards,\n${v.senderName}\n${v.agencyName}`;
  const html = clientShell(paras.map(clientPara).join("\n") + "\n" + clientSignOff(v.senderName, v.agencyName));
  return { subject, text, html };
}

// 11am — short authority nudge with a button to the portal confirm. Only sent
// to contacts who haven't confirmed authority yet this activation.
export function buildExchangeDayClientAuthorityEmail(
  v: ExchangeDayClientVars & { authorityUrl: string },
): { subject: string; text: string; html: string } {
  const subject = `${v.addressShort}: have you given authority?`;
  const intro = [
    `Hi ${v.firstName},`,
    `Just following up on your ${v.saleWord} of ${v.address}.`,
    `If you've now given your solicitor authority to exchange, please tap below to let us know. It helps us keep track of everything as we work towards exchange today.`,
  ];
  const closing = `If you haven't yet, please give your solicitor a quick call or email confirming you're happy to exchange with completion on ${v.completionDate}.`;
  const text = `${intro.join("\n\n")}\n\nI've given authority: ${v.authorityUrl}\n\n${closing}\n\nKind regards,\n${v.senderName}\n${v.agencyName}`;
  const html = clientShell(
    intro.map(clientPara).join("\n") +
      "\n" +
      clientButton(v.authorityUrl, "I've given authority") +
      "\n" +
      clientPara(closing) +
      "\n" +
      clientSignOff(v.senderName, v.agencyName),
  );
  return { subject, text, html };
}
