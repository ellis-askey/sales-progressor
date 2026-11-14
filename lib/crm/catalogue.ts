// The CRM catalogue — single source of truth for the "Connect your CRM" settings
// page (critique #289) AND the Command Centre demand view. One list so names,
// colours and logos never drift between what agents see and what we see.
//
// Logos: drop files into public/crm-logos/<key>.svg (or .png and change `logo`).
// Until a file exists the UI falls back to the monogram tile automatically, so
// the page works today and the real logos light up the moment they land.
//
// A free-text request (an agency's CRM we don't list) is stored with a key of
// "other:<slug>"; crmDisplayName() resolves those to the typed name.

export type CrmEntry = {
  /** stable key — used as the request key and the logo filename */
  key: string;
  name: string;
  /** 2-char monogram fallback shown until a logo file is added */
  mono: string;
  /** brand-ish colour for the monogram fallback tile */
  color: string;
  /** public path to the logo; falls back to the monogram if the file is absent */
  logo: string;
};

function entry(key: string, name: string, mono: string, color: string): CrmEntry {
  return { key, name, mono, color, logo: `/crm-logos/${key}.svg` };
}

// Ordered by our current best guess at UK prevalence; the live page re-sorts by
// real demand, so this order only seeds ties.
export const CRM_CATALOGUE: CrmEntry[] = [
  entry("reapit", "Reapit", "Re", "#16305c"),
  entry("alto", "Alto", "Al", "#5a2ea6"),
  entry("jupix", "Jupix", "Ju", "#1f9d55"),
  entry("street", "Street.co.uk", "St", "#0ea5a0"),
  entry("dezrez", "Dezrez", "Dz", "#e4572e"),
  entry("expertagent", "Expert Agent", "EA", "#2563c9"),
  entry("agentpro", "AgentPro", "AP", "#3b4255"),
  entry("gnomen", "Gnomen", "Gn", "#e08a1e"),
  entry("rex", "Rex", "Rx", "#0f9b8e"),
  entry("openview", "Openview", "Ov", "#3a9d4e"),
  entry("vault", "Vault EA", "Va", "#4338ca"),
  entry("apex27", "Apex27", "A2", "#5b5bf5"),
  entry("acquaint", "Acquaint", "Ac", "#2b7fb0"),
  entry("tenninety", "10ninety", "10", "#7c5cff"),
  entry("loop", "Loop", "Lo", "#6b5cff"),
  entry("mri", "MRI Sales & Lettings", "MR", "#c73a4a"),
];

export const CRM_BY_KEY: Record<string, CrmEntry> = Object.fromEntries(CRM_CATALOGUE.map((c) => [c.key, c]));

export const OTHER_PREFIX = "other:";
export function isOtherKey(key: string): boolean {
  return key.startsWith(OTHER_PREFIX);
}
export function otherKey(name: string): string {
  return OTHER_PREFIX + name.trim().toLowerCase().replace(/\s+/g, "-").slice(0, 60);
}

// Display name for any key, including free-text "other:" requests (we keep the
// typed name on the request row, so pass it in when you have it).
export function crmDisplayName(key: string, storedName?: string | null): string {
  if (CRM_BY_KEY[key]) return CRM_BY_KEY[key].name;
  if (storedName) return storedName;
  if (isOtherKey(key)) return key.slice(OTHER_PREFIX.length).replace(/-/g, " ");
  return key;
}
