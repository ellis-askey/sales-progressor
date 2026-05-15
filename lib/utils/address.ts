/** Strip non-phone characters and truncate to 20 chars */
export function cleanPhone(raw: string): string {
  return raw.replace(/[^\d+\s\-()]/g, "").slice(0, 20);
}

/** Format a UK phone number on blur. Returns the original string if unrecognised. */
export function formatUKPhone(raw: string): string {
  const stripped = raw.replace(/[^\d]/g, "");
  if (!stripped) return raw;

  let national: string;
  if (raw.trimStart().startsWith("+44")) {
    national = "0" + stripped.slice(2);
  } else if (stripped.startsWith("44") && stripped.length === 12) {
    national = "0" + stripped.slice(2);
  } else {
    national = stripped;
  }

  if (!national.startsWith("0") || national.length < 10 || national.length > 11) {
    return raw;
  }

  // Mobile: 07XXX XXXXXX → +44 7XXX XXXXXX
  if (/^07\d{9}$/.test(national)) {
    return `+44 ${national.slice(1, 5)} ${national.slice(5)}`;
  }
  // London 020: 020 XXXX XXXX
  if (/^020\d{8}$/.test(national)) {
    return `020 ${national.slice(3, 7)} ${national.slice(7)}`;
  }
  // Other 02X (e.g. 023 Southampton): 0XX XXXX XXXX
  if (/^02\d{9}$/.test(national)) {
    return `${national.slice(0, 3)} ${national.slice(3, 7)} ${national.slice(7)}`;
  }
  // 03XX / 08XX / 09XX national rate: XXXX XXX XXXX
  if (/^0[389]\d{9}$/.test(national)) {
    return `${national.slice(0, 4)} ${national.slice(4, 7)} ${national.slice(7)}`;
  }
  // 01 landlines (11 digits): 5+6 split covers most STD codes
  if (national.length === 11 && national.startsWith("01")) {
    return `${national.slice(0, 5)} ${national.slice(5)}`;
  }
  // 10-digit 01 (rare short-number areas): 4+6
  if (national.length === 10 && national.startsWith("01")) {
    return `${national.slice(0, 4)} ${national.slice(4)}`;
  }

  return raw;
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
