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
 * The honorific/professional title at the front of a name, if any — else null.
 * For when the caller genuinely wants the TITLE (e.g. to pick a pronoun), not
 * the first name. Returns the title as written ("Mrs", "Dr").
 * e.g. "Mrs Lauren Saunders" → "Mrs"
 *      "Dr Brown"            → "Dr"
 *      "Rachel Whitfield"    → null
 *      "Lauren"              → null
 */
export function getTitlePrefix(name: string): string | null {
  return parseName(name).prefix;
}

/**
 * Short reference for use in inline sentences.
 * Skips honorific prefixes when a first name is available; keeps any title
 * (honorific or professional) when only a surname follows it, so we never
 * reduce "Mr Stevens" to bare "Stevens".
 *
 * e.g. "Miss Adele Maxwell-Harrison" → "Adele"        (honorific + first name)
 *      "Mr Stevens"                  → "Mr Stevens"   (honorific + surname only — keep title)
 *      "Mrs Hartley"                 → "Mrs Hartley"  (honorific + surname only)
 *      "Dr Mildred Aduamoah"         → "Dr Aduamoah"  (professional title + first + last)
 *      "Dr Brown"                    → "Dr Brown"     (professional title + surname only)
 *      "Rachel Whitfield"            → "Rachel"       (no title)
 *      "Rachel"                      → "Rachel"
 *      "Bontoft Property Developments Ltd" → "Bontoft" (company — first word)
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
    // Honorific (Mr/Mrs/Ms/Miss/Mx/Sir/Dame/Lord/Lady): if no first name
    // available (single word remaining), keep the title so we don't reduce
    // "Mr Stevens" to "Stevens". Otherwise use the first name word.
    if (rest.length === 1) {
      return `${prefix} ${rest[0]}`;
    }
    return rest[0];
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
 * Extracts a name suitable for inline greetings like "Hi {name},".
 * Returns the first name word when available; falls back to "Title Surname"
 * when only a title + surname is provided (so "Hi Mr Stevens," reads
 * correctly rather than the too-informal "Hi Stevens,").
 *
 * e.g. "Miss Adele Maxwell-Harrison" → "Adele"        (has first name)
 *      "Dr John Brown"               → "John"
 *      "Mr Stevens"                  → "Mr Stevens"   (no first name — fall back to formal)
 *      "Mrs Hartley"                 → "Mrs Hartley"  (no first name)
 *      "Dr Brown"                    → "Dr Brown"     (no first name)
 *      "Rachel Whitfield"            → "Rachel"
 *      "Rachel"                      → "Rachel"
 *      ""                            → "the contact"  (fallback)
 *      "Miss"                        → "Miss"         (prefix-only fallback)
 */
export function extractFirstName(name: string): string {
  const { prefix, rest } = parseName(name);
  if (rest.length === 0) return prefix ?? "the contact";
  // No first name available (only title + surname): fall back to the
  // formal "Title Surname" form rather than the bare surname.
  if (prefix && rest.length === 1) {
    return `${prefix} ${rest[0]}`;
  }
  return rest[0];
}
