// White-label signature for agent chase emails.
//
// Chase emails used to send as plain text with no branding. This assembles a
// signature block from identity we already store: the sending agent's photo,
// name, job title and mobile, plus the agency's logo and name. It renders ONLY
// the fields that are present, so it looks intentional whether the agent has
// filled everything in or just has a name on file. Used by both the real send
// (/api/chase/send-email) and the drawer preview (/api/chase/signature-preview)
// so what the agent previews is exactly what goes out.
//
// Table + inline styles for email-client compatibility (no external CSS).

export interface ChaseSignatureInput {
  agentName: string;
  agentImageUrl?: string | null;
  jobTitle?: string | null;
  directMobile?: string | null;
  phone?: string | null;
  agencyName: string;
  // Pre-rendered agency logo band from agencyLogoHeaderHtml (the same single-
  // source renderer the branding-studio preview uses), so the logo presents
  // identically here no matter what shape the agency uploaded. Empty/undefined
  // when no logo is set, in which case the agency name renders as text.
  agencyLogoBandHtml?: string | null;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// The optional pieces that aren't filled in yet, in plain words for the
// "finish your signature" nudge in the drawer. Name + agency always exist.
export function chaseSignatureMissing(input: ChaseSignatureInput): string[] {
  const missing: string[] = [];
  if (!input.agentImageUrl) missing.push("photo");
  if (!input.jobTitle) missing.push("job title");
  if (!input.directMobile && !input.phone) missing.push("mobile");
  if (!input.agencyLogoBandHtml) missing.push("agency logo");
  return missing;
}

// HTML signature block. Renders only present fields.
export function buildChaseSignatureHtml(input: ChaseSignatureInput): string {
  const mobile = input.directMobile || input.phone || null;

  const photoCell = input.agentImageUrl
    ? `<td style="padding-right:14px;vertical-align:top;"><img src="${escapeHtml(input.agentImageUrl)}" width="48" height="48" alt="" style="width:48px;height:48px;border-radius:24px;object-fit:cover;display:block;" /></td>`
    : "";

  const titleLine = input.jobTitle
    ? `<div style="font-size:13px;color:#6b7280;line-height:1.4;">${escapeHtml(input.jobTitle)}</div>`
    : "";

  const mobileLine = mobile
    ? `<div style="font-size:13px;line-height:1.4;"><a href="tel:${escapeHtml(mobile.replace(/\s/g, ""))}" style="color:#6b7280;text-decoration:none;">${escapeHtml(mobile)}</a></div>`
    : "";

  // Agency line: the proper logo band (renders any uploaded shape correctly) or,
  // if there's no logo, the agency name as text.
  const agencyBlock = input.agencyLogoBandHtml
    ? `<div style="margin-top:12px;">${input.agencyLogoBandHtml}</div>`
    : `<div style="font-size:13px;font-weight:600;color:#374151;margin-top:10px;">${escapeHtml(input.agencyName)}</div>`;

  const agentTable = `<table cellpadding="0" cellspacing="0" border="0" style="font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;"><tr>${photoCell}<td style="vertical-align:top;"><div style="font-size:14px;font-weight:700;color:#111827;line-height:1.4;">${escapeHtml(input.agentName)}</div>${titleLine}${mobileLine}</td></tr></table>`;

  return `<div style="margin-top:22px;border-top:1px solid #e5e7eb;padding-top:16px;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">${agentTable}${agencyBlock}</div>`;
}

// Plain-text signature for the text/2 part of the email (non-HTML clients).
export function buildChaseSignatureText(input: ChaseSignatureInput): string {
  const mobile = input.directMobile || input.phone || null;
  const lines = [input.agentName];
  if (input.jobTitle) lines.push(input.jobTitle);
  if (mobile) lines.push(mobile);
  lines.push(input.agencyName);
  return `\n\n${lines.join("\n")}`;
}
