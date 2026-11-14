// The CRM catalogue — single source of truth for the "Connect your CRM" settings
// page (critique #289) AND the Command Centre demand view. One list so names and
// logos never drift between what agents see and what we see.
//
// Only CRMs with a real logo appear here (founder decision 2026-11-14): a tile
// without a logo is hidden from the page. To add one, drop its logo into
// public/crm-logos/<key>.<ext> and add an entry below with the matching filename.
//
// A free-text request (an agency's CRM we don't list) is stored with a key of
// "other:<slug>"; crmDisplayName() resolves those to the typed name. The
// Command Centre reads the name off the stored request row, so hiding a CRM here
// never breaks the display of an existing request for it.

export type CrmEntry = {
  /** stable key — used as the request key and the logo filename */
  key: string;
  name: string;
  /** 2-char monogram fallback shown only if the logo file fails to load */
  mono: string;
  /** brand-ish colour for the monogram fallback tile */
  color: string;
  /** public path to the real logo */
  logo: string;
  /** display-only starting count on the agent page (a nudge so a popular CRM
   *  doesn't read "Be the first to ask" on day one). The Command Centre ignores
   *  this and only ever shows real requests. */
  seed: number;
  /** the logo is a light/white mark made for dark backgrounds → sit it on a dark
   *  plate so it stays visible (the default plate is white). */
  onDark: boolean;
  /** some logos ship with a solid-colour background baked in → set the plate to
   *  that same colour (sampled from the logo) so the logo fills the container
   *  seamlessly. Empty = the default white plate. */
  plateBg: string;
};

function entry(key: string, name: string, mono: string, color: string, logoFile: string, opts: { seed?: number; onDark?: boolean; plateBg?: string } = {}): CrmEntry {
  return { key, name, mono, color, logo: `/crm-logos/${logoFile}`, seed: opts.seed ?? 0, onDark: opts.onDark ?? false, plateBg: opts.plateBg ?? "" };
}

// Ordered by our current best guess at UK prevalence; the live page re-sorts by
// real demand, so this order only seeds ties. Every entry here has a logo file.
export const CRM_CATALOGUE: CrmEntry[] = [
  entry("reapit", "Reapit", "Re", "#16305c", "reapit.png", { seed: 2, plateBg: "#fde5e5" }),
  entry("alto", "Alto", "Al", "#5a2ea6", "alto.png", { seed: 6, plateBg: "#fce6df" }),
  entry("jupix", "Jupix", "Ju", "#1f9d55", "jupix.png", { plateBg: "#ececec" }),
  entry("street", "Street.co.uk", "St", "#0ea5a0", "street.png"),
  entry("expertagent", "Expert Agent", "EA", "#2563c9", "expertagent.png", { plateBg: "#34aade" }),
  entry("rex", "Rex", "Rx", "#0f9b8e", "rex.png", { onDark: true }),
  entry("apex27", "Apex27", "A2", "#5b5bf5", "apex27.png", { plateBg: "#3cdcd2" }),
  entry("loop", "Loop", "Lo", "#6b5cff", "loop.png", { seed: 4, plateBg: "#dde1e9" }),
  entry("gnb", "GNB Property Software", "gnb", "#2f9e4e", "gnb.png", { plateBg: "#e5efe4" }),
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
// typed name on the request row, so pass it in when you have it) and CRMs that
// have since been hidden from the catalogue.
export function crmDisplayName(key: string, storedName?: string | null): string {
  if (CRM_BY_KEY[key]) return CRM_BY_KEY[key].name;
  if (storedName) return storedName;
  if (isOtherKey(key)) return key.slice(OTHER_PREFIX.length).replace(/-/g, " ");
  return key;
}
