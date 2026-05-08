const LEGAL_SUFFIX = /\s+(Ltd|Limited|LLP|PLC|plc)\.?$/i;
const SENDING_ADDRESS = "updates@thesalesprogressor.co.uk";

function buildFrom(display: string): string {
  const safe = /[,;@<>()[\]\\"]/.test(display)
    ? `"${display.replace(/"/g, '\\"')}"`
    : display;
  return `${safe} <${SENDING_ADDRESS}>`;
}

/** Agency name only — strips UK legal entity suffixes (Ltd, Limited, LLP, PLC). */
export function agencyFrom(agencyName: string): string {
  return buildFrom(agencyName.replace(LEGAL_SUFFIX, "").trim());
}

/** "First Name at Agency" — for client-facing emails where a personal name is available. */
export function personAgencyFrom(firstName: string, agencyName: string): string {
  const stripped = agencyName.replace(LEGAL_SUFFIX, "").trim();
  return buildFrom(`${firstName} at ${stripped}`);
}
