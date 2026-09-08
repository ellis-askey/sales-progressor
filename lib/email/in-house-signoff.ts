// The standardised in-house sign-off for OUTSOURCED / internal sends.
//
// On an outsourced file WE run it, so a manual email from an internal Sales
// Progressor person must NOT carry that person's customised per-user signature,
// their uploaded image signature, or the agency logo. It signs off with a plain,
// consistent block: name (bold), the agency it's sent on behalf of, and a
// contact number. This mirrors the in-house block the automated solicitor /
// enquiry chases already use on outsourced files, so every outsourced email
// closes the same way. Renders only the lines that are present.

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function buildInHouseSignoff(opts: {
  name: string;
  agency: string;
  phone?: string | null;
}): { html: string; text: string } {
  const name = opts.name.trim();
  const agency = opts.agency.trim();
  const phone = opts.phone?.trim() || null;

  const agencyLineHtml = agency
    ? `\n  <div style="font-size:13px;font-weight:600;color:#374151;line-height:1.4;margin-top:2px;">${esc(agency)}</div>`
    : "";
  const phoneLineHtml = phone
    ? `\n  <div style="font-size:13px;color:#6b7280;line-height:1.4;margin-top:2px;">${esc(phone)}</div>`
    : "";

  const html = `<div style="margin-top:22px;border-top:1px solid #e5e7eb;padding-top:16px;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="font-size:14px;font-weight:700;color:#111827;line-height:1.4;">${esc(name)}</div>${agencyLineHtml}${phoneLineHtml}
</div>`;

  const textLines = [name];
  if (agency) textLines.push(agency);
  if (phone) textLines.push(phone);
  const text = `\n\n${textLines.join("\n")}`;

  return { html, text };
}
