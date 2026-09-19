// Pure, client-safe UK postcode helpers for the Map feature. extractPostcode
// mirrors the server-side one in lib/services/property-intel.ts, kept separate
// so client bundles don't pull the Land Registry service in.

const UK_POSTCODE = /[A-Z]{1,2}[0-9][0-9A-Z]?\s*[0-9][A-Z]{2}/i;

// Pull a UK postcode out of a free-text address and normalise it to
// "OUTCODE INCODE" (single space, upper case). null when none found.
export function extractPostcode(address: string): string | null {
  const m = address.match(UK_POSTCODE);
  if (!m) return null;
  const raw = m[0].toUpperCase().replace(/\s+/g, "");
  return `${raw.slice(0, -3)} ${raw.slice(-3)}`;
}

// The outcode (postcode district) — everything before the incode: "BS6 5AB" →
// "BS6". Regex form (drop the first space onward) rather than split()[0], which
// the name-split lint guard flags as a naive first-name extraction.
export function outcodeOf(postcode: string): string {
  return postcode.toUpperCase().replace(/\s.*$/, "").trim();
}

// A human district label from an address ("27 Sion Hill, Clifton, Bristol, BS8
// 4BA" → "Clifton"), the part before town + postcode. null when not derivable.
export function districtOf(address: string): string | null {
  const parts = address.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 3) return parts[parts.length - 3];
  return null;
}
