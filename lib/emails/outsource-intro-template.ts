// "Getting your sale moving" — white-labelled intro sent to buyer + seller
// when an agent adds an outsourced (managed-tier) sale. Reads as the agency,
// not Sales Progressor: from-name combines agent + agency, no SP wording in
// the copy, no mention of pricing or VAT.
//
// Copy refreshed 2026-08-12 — warmer, congratulatory opener (Ellis-approved;
// keeps the "agreed!" exclamation as a deliberate VOICE.md override for this
// milestone email). Variables interpolated below; fallbacks handle a missing
// client first name and a missing address cleanly so the message still
// reads naturally.

export type OutsourceIntroVars = {
  clientFirstName: string | null;
  address: string | null;
  agentFirstName: string;
  agentLastName: string;
  agencyName: string;
};

export type OutsourceIntroEmail = {
  subject: string;
  text: string;
  html: string;
  fromName: string;
};

const WHATSAPP_URL = "https://wa.me/447508862929";

// Greeting + opening line. Falls back to "Hi there," when first name is
// missing, and rewrites the opener (skipping "at {address}") when the
// address is unknown.
function buildOpener({
  clientFirstName,
  address,
}: { clientFirstName: string | null; address: string | null }): {
  greeting: string;
  opener: string;
} {
  const greeting = clientFirstName
    ? `Hi ${clientFirstName},`
    : "Hi there,";
  const opener = address
    ? `Congratulations, your sale at ${address} has been agreed! It's a big milestone and genuinely great news. From here, our job is to help get everything through to completion, and we've already made a start.`
    : "Congratulations, your sale has been agreed! It's a big milestone and genuinely great news. From here, our job is to help get everything through to completion, and we've already made a start.";
  return { greeting, opener };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildOutsourceIntroEmail(vars: OutsourceIntroVars): OutsourceIntroEmail {
  const { agentFirstName, agentLastName, agencyName } = vars;
  const { greeting, opener } = buildOpener({
    clientFirstName: vars.clientFirstName,
    address: vars.address,
  });

  const signOff = `${agentFirstName} ${agentLastName}`;
  const subject = "Getting your sale moving";

  // From-name is the agent + agency, comma separated. The sending address
  // (which determines whether the inbox shows a clean agency domain or
  // updates@thesalesprogressor.co.uk) is resolved by the orchestrator —
  // the template is concerned only with how the display name reads.
  const fromName = `${agentFirstName} ${agentLastName}, ${agencyName}`;

  const text =
    `${greeting}\n\n` +
    `${opener}\n\n` +
    `Someone from our team will give you a call within the next two working days to introduce themselves and talk you through what happens next. They'll be your point of contact throughout the sale, so you'll always know who to speak to and where things are up to.\n\n` +
    `In the meantime, if you haven't already, please complete your onboarding, including the quick ID and document checks. Getting these out of the way early helps us keep everything moving and avoids unnecessary delays later on.\n\n` +
    `If you need anything before that call, you can message us on WhatsApp at any time.\n\n` +
    `WhatsApp us: ${WHATSAPP_URL}\n\n` +
    `Talk soon,\n` +
    `${signOff}\n` +
    `${agencyName}\n`;

  // Plain, consumer-facing HTML. No SP logo, no branded header. WhatsApp
  // button mirrors the existing #25D366 pattern used elsewhere in the app.
  const html =
`<!DOCTYPE html>
<html>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#1a1d29;background:#fff">
  <p style="margin:0 0 16px;font-size:15px">${escapeHtml(greeting)}</p>

  <p style="margin:0 0 16px;font-size:14px;line-height:1.7;color:#1a1d29">
    ${escapeHtml(opener)}
  </p>

  <p style="margin:0 0 16px;font-size:14px;line-height:1.7;color:#1a1d29">
    Someone from our team will give you a call within the next two working days to introduce themselves and talk you through what happens next. They&apos;ll be your point of contact throughout the sale, so you&apos;ll always know who to speak to and where things are up to.
  </p>

  <p style="margin:0 0 16px;font-size:14px;line-height:1.7;color:#1a1d29">
    In the meantime, if you haven&apos;t already, please complete your onboarding, including the quick ID and document checks. Getting these out of the way early helps us keep everything moving and avoids unnecessary delays later on.
  </p>

  <p style="margin:0 0 20px;font-size:14px;line-height:1.7;color:#1a1d29">
    If you need anything before that call, you can message us on WhatsApp at any time.
  </p>

  <p style="margin:0 0 28px">
    <a href="${WHATSAPP_URL}" style="display:inline-flex;align-items:center;gap:8px;background:#25D366;color:#fff;padding:12px 22px;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="#fff" style="display:inline-block;vertical-align:middle"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
      WhatsApp us
    </a>
  </p>

  <p style="margin:0;font-size:14px;color:#1a1d29;line-height:1.5">
    Talk soon,<br>
    ${escapeHtml(signOff)}<br>
    ${escapeHtml(agencyName)}
  </p>
</body>
</html>`;

  return { subject, text, html, fromName };
}
