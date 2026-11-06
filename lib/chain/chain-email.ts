// Helpers for the "Email the chain" composer: build the subject from every
// sale's street line, bottom of the chain to the top, abbreviating common
// street types and joining with " / " so a long chain stays readable.
//
//   ["206 Butlers Walk", "25 Repton Road", "50 Hill Street"]
//     -> "Update on 206 Butlers Walk / 25 Repton Rd / 50 Hill St"

const STREET_ABBREVIATIONS: [RegExp, string][] = [
  [/\bStreet\b/gi, "St"],
  [/\bRoad\b/gi, "Rd"],
  [/\bAvenue\b/gi, "Ave"],
  [/\bLane\b/gi, "Ln"],
  [/\bClose\b/gi, "Cl"],
  [/\bDrive\b/gi, "Dr"],
  [/\bCourt\b/gi, "Ct"],
  [/\bCrescent\b/gi, "Cres"],
  [/\bGardens\b/gi, "Gdns"],
  [/\bTerrace\b/gi, "Ter"],
  [/\bSquare\b/gi, "Sq"],
  [/\bPlace\b/gi, "Pl"],
  [/\bParade\b/gi, "Par"],
  [/\bBuildings\b/gi, "Bldgs"],
  [/\bMaisonette\b/gi, "Mais"],
];

/** Abbreviate the street types in a single address line. Leaves everything else
 *  (house numbers, flat labels, names like "Walk") untouched. */
export function abbreviateAddressLine(line1: string): string {
  let s = (line1 ?? "").trim();
  for (const [re, to] of STREET_ABBREVIATIONS) s = s.replace(re, to);
  return s.replace(/\s+/g, " ").trim();
}

/** Build the chain-email subject from the chain's street lines (already ordered
 *  bottom -> top by the caller). Empty list falls back to a plain prompt. */
export function chainEmailSubject(firstLines: string[]): string {
  const parts = firstLines.map(abbreviateAddressLine).filter(Boolean);
  if (parts.length === 0) return "Update on your chain";
  return `Update on ${parts.join(" / ")}`;
}
