// Renders the agency logo for an email header. Wrapped in a fixed white chip so
// any logo (a transparent PNG or a dark square) sits cleanly on the coral header
// and looks intentional. Returns "" when the agency has no logo, so the header
// simply falls back to its text branding.

export function agencyLogoEmailHtml(logoUrl: string | null | undefined): string {
  if (!logoUrl) return "";
  return (
    `<div style="display:inline-block;background:#ffffff;border-radius:10px;padding:7px 12px;margin:0 0 14px">` +
    `<img src="${logoUrl}" alt="" height="26" style="height:26px;max-width:150px;display:block;object-fit:contain" />` +
    `</div>`
  );
}
