const LEGAL_SUFFIX = /\s+(Ltd|Limited|LLP|PLC|plc)\.?$/i;
const SENDING_ADDRESS = "updates@thesalesprogressor.co.uk";

/** Strips UK legal entity suffixes (Ltd, Limited, LLP, PLC) from an agency name. */
export function stripAgencyLegalSuffix(agencyName: string): string {
  return agencyName.replace(LEGAL_SUFFIX, "").trim();
}

/**
 * Builds an RFC-safe `Display <address>` header. Quotes the display name when it
 * contains characters that would otherwise break the header. Defaults to the
 * Sales Progressor sending address; pass an agency's authenticated address to
 * send as that agency (see lib/email/agency-sender.ts).
 */
export function buildFrom(display: string, address: string = SENDING_ADDRESS): string {
  const safe = /[,;@<>()[\]\\"]/.test(display)
    ? `"${display.replace(/"/g, '\\"')}"`
    : display;
  return `${safe} <${address}>`;
}

/** Agency name only — strips UK legal entity suffixes (Ltd, Limited, LLP, PLC). */
export function agencyFrom(agencyName: string): string {
  return buildFrom(stripAgencyLegalSuffix(agencyName));
}

/**
 * Re-brands a resolved `Display <address>` sender: keeps the authenticated
 * ADDRESS, swaps in a new display name. Used by the manual-send resolver's
 * fallback (lib/email.ts) — when the person sending has no verified address of
 * their own, we borrow the agency's deliverable address but the display name
 * must stay the SENDER's own, never the file's agent/progressor, so we never
 * send from one identity's address under another person's name. Returns the
 * input unchanged when there's no parseable trailing `<address>`.
 */
export function rebrandSenderDisplay(resolvedFrom: string, display: string): string {
  const addr = resolvedFrom.match(/<([^>]+)>\s*$/)?.[1] ?? null;
  return addr ? buildFrom(display, addr) : resolvedFrom;
}

/** "First Name at Agency" — for client-facing emails where a personal name is available. */
export function personAgencyFrom(firstName: string, agencyName: string): string {
  return buildFrom(`${firstName} at ${stripAgencyLegalSuffix(agencyName)}`);
}
