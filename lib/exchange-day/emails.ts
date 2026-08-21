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
