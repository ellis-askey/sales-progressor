// Shared name display helpers for Contact and User records.
// Both models store name as a single String field. These helpers parse that
// string to handle title prefixes gracefully, fixing the "Miss" bug where
// `name.split(" ")[0]` returns a title prefix instead of a real first name.

const TITLE_PREFIXES = new Set([
  "mr", "mrs", "ms", "miss", "mx",
  "dr", "prof", "sir", "dame", "lord", "lady", "rev",
]);

const PROFESSIONAL_TITLES = new Set(["dr", "prof", "rev"]);

type NameLike = { name: string };

/**
 * Splits a name string into its title prefix (if any) and remaining name words.
 * "Miss Adele Maxwell-Harrison" → { prefix: "Miss", rest: ["Adele", "Maxwell-Harrison"] }
 * "Rachel Whitfield"           → { prefix: null,   rest: ["Rachel", "Whitfield"] }
 */
function parseName(name: string): { prefix: string | null; rest: string[] } {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return { prefix: null, rest: [] };
  const candidate = words[0].replace(/\.$/, "").toLowerCase();
  if (TITLE_PREFIXES.has(candidate) && words.length > 1) {
    return { prefix: words[0], rest: words.slice(1) };
  }
  return { prefix: null, rest: words };
}

/**
 * Full display name — returns the stored name as-is (already a full string).
 * e.g. "Miss Adele Maxwell-Harrison", "Dr Mildred Aduamoah", "Rachel Whitfield"
 */
export function getDisplayName(contact: NameLike): string {
  return contact.name.trim() || "Unknown";
}

/**
 * Short reference for use in inline sentences.
 * Skips honorific prefixes; keeps professional titles (Dr, Prof, Rev) + last name.
 * e.g. "Miss Adele Maxwell-Harrison" → "Adele"
 *      "Dr Mildred Aduamoah"       → "Dr Aduamoah"
 *      "Rachel Whitfield"          → "Rachel"
 * CRITICAL: never returns just a prefix.
 */
export function getShortName(contact: NameLike): string {
  const { prefix, rest } = parseName(contact.name);
  if (rest.length === 0) return prefix ?? "the contact";
  if (prefix) {
    const lp = prefix.replace(/\.$/, "").toLowerCase();
    if (PROFESSIONAL_TITLES.has(lp)) {
      return `${prefix} ${rest[rest.length - 1]}`;
    }
    return rest[0]; // honorific: use first name
  }
  return rest[0]; // no prefix: first name
}

/**
 * Initials for avatar circles — skips the prefix entirely.
 * e.g. "Miss Adele Maxwell-Harrison" → "AM"
 *      "Dr Mildred Aduamoah"       → "MA"
 *      "Rachel Whitfield"          → "RW"
 *      "Rachel"                    → "R"
 * CRITICAL: never returns an initial derived from a title prefix.
 */
export function getInitials(contact: NameLike): string {
  const { rest } = parseName(contact.name);
  const initials = rest.slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
  return initials || "?";
}

/**
 * Extracts the first meaningful name word for use in templates and sentence
 * fragments where only a first name is needed.
 * e.g. "Miss Smith"     → "Smith"   (not "Miss")
 *      "Dr John Brown"  → "John"
 *      "Rachel"         → "Rachel"
 * Falls back to "the contact" if nothing usable is found.
 */
export function extractFirstName(name: string): string {
  const { prefix, rest } = parseName(name);
  if (rest.length === 0) return prefix ?? "the contact";
  return rest[0];
}
