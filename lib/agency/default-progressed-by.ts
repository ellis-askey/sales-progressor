// Per-agency default for the new-sale form's "progressed by" toggle.
//
// Background: the four agencies in LEGACY_PROGRESSOR_AGENCIES pre-date the
// self-progress option and have always used our team to progress. New sales
// added on their accounts should default to "send to us" (progressor),
// matching their established workflow. Agents on these agencies can still
// flip the toggle to self-progress on a per-sale basis — only the default
// changes, not the option.
//
// We also honour Agency.modeProfile = "progressor_managed" as a forward
// gate so any future agency that's manually flagged gets the same default
// without needing a code change. Mixed-mode agencies in the legacy list
// (e.g. Akeman, Meldone, which have drifted into mixed because individual
// agents experimented with self-progress) still get the progressor default
// because the legacy-name match wins.

const LEGACY_PROGRESSOR_AGENCIES: ReadonlyArray<string> = [
  "Meldone Estates",
  "Oplah Ltd",
  "Akeman Residential",
  "Via Properties",
];

const LEGACY_LC = new Set(LEGACY_PROGRESSOR_AGENCIES.map((n) => n.toLowerCase()));

export function deriveDefaultProgressedBy(
  agencyName: string | null | undefined,
  modeProfile: string | null | undefined,
): "agent" | "progressor" {
  if (agencyName && LEGACY_LC.has(agencyName.trim().toLowerCase())) {
    return "progressor";
  }
  if (modeProfile === "progressor_managed") {
    return "progressor";
  }
  return "agent";
}
