/** Strip non-phone characters and truncate to 20 chars */
export function cleanPhone(raw: string): string {
  return raw.replace(/[^\d+\s\-()]/g, "").slice(0, 20);
}

/** Format a postcode to "XX## #XX" spacing — only if it looks like a valid UK postcode length */
export function formatPostcode(raw: string): string {
  const clean = raw.toUpperCase().replace(/\s+/g, "");
  if (clean.length >= 5 && clean.length <= 7) {
    return clean.slice(0, -3) + " " + clean.slice(-3);
  }
  return raw.toUpperCase();
}

/** Validate a formatted UK postcode (must already be in "XX## #XX" form) */
export function isValidUKPostcode(pc: string): boolean {
  return /^[A-Z]{1,2}[0-9][0-9A-Z]?\s[0-9][A-Z]{2}$/.test(pc.trim());
}
