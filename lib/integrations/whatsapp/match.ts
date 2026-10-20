// WhatsApp group → property matching, pure functions only (no DB, no I/O).
//
// Split out from ingest.ts so the matching rules can be unit-tested in isolation
// (ingest.ts pulls in Prisma). ingest.ts re-exports parseGroupName + Side from
// here for backward compatibility.

export type Side = "BUYER" | "SELLER";

// "Sale of {address}" → SELLER; "Purchase of {address}" → BUYER. Strict prefix,
// case-insensitive. Anything else returns null (not a property group) — the
// caller drops it. The address remainder is matched against propertyAddress via
// firstLineAddress + chooseTransaction below.
export function parseGroupName(name: string): { side: Side; address: string } | null {
  const sale = name.match(/^sale of\s+(.+)$/i);
  if (sale) return { side: "SELLER", address: sale[1].trim() };
  const purchase = name.match(/^purchase of\s+(.+)$/i);
  if (purchase) return { side: "BUYER", address: purchase[1].trim() };
  return null;
}

// Reduce an address to its normalised first line: the text before the first
// comma, lowercased, whitespace-collapsed, trimmed. Lets a group named with the
// full address OR just the first line match a stored full propertyAddress, since
// both sides are reduced to the same first line.
//   "118 Hadley Grange, Sometown, AB1 2CD" → "118 hadley grange"
//   "118 Hadley Grange"                    → "118 hadley grange"
export function firstLineAddress(addr: string): string {
  return (addr.split(",")[0] ?? "").toLowerCase().replace(/\s+/g, " ").trim();
}

// Street-type equivalence (loosened matching, founder-approved 2026-10-19).
// Compared PER TOKEN, never rewritten into the line: "Dr" ≡ "Drive" only when
// the two sides disagree at that position, so "St James Drive" (Saint) still
// matches a literal "St James Drive" on the file untouched. Conservative UK
// street endings only — nothing that commonly means something else.
const STREET_TYPES: Record<string, string> = {
  rd: "road",
  st: "street",
  dr: "drive",
  ave: "avenue",
  av: "avenue",
  ln: "lane",
  cl: "close",
  ct: "court",
  gdns: "gardens",
  pl: "place",
  cres: "crescent",
  sq: "square",
  ter: "terrace",
  terr: "terrace",
  pk: "park",
};

// "Dr." → "drive"; anything unknown passes through bare (trailing dots stripped).
function canonicalToken(t: string): string {
  const bare = t.replace(/\.+$/, "");
  return STREET_TYPES[bare] ?? bare;
}

function addressTokens(firstLine: string): string[] {
  return firstLine.split(" ").filter(Boolean).map(canonicalToken);
}

// A cheap DB pre-filter needle: the first two RAW tokens of the group's address
// line ("5 James Drive Progression" → "5 james"). The DB `contains` only
// narrows; all precision lives in chooseTransaction.
export function narrowingNeedle(parsedFirstLine: string): string {
  return parsedFirstLine.split(" ").filter(Boolean).slice(0, 2).join(" ");
}

// Given the parsed group's first-line address and the candidate property rows
// (already narrowed in the DB), pick the one file.
//
// A file matches when its ENTIRE first line appears at the START of the group's
// first line, whole tokens only, with street-type abbreviations treated as
// equal ("Dr" ≡ "Drive"). So "Sale of 5 James Drive Progression" and
// "Sale of 5 James Dr" both land on "5 James Drive, …", while "18 High St" can
// still never match "118 High St" (first token differs). When several files
// match, the longest (most specific) first line wins — "5 James Drive East"
// beats "5 James Drive" for a group named after East. Ties prefer the single
// live (active/on_hold) file over a draft shadow twin; still-ambiguous → null,
// never a guess.
export function chooseTransaction(
  parsedFirstLine: string,
  rows: { id: string; status: string; propertyAddress: string }[],
): string | null {
  const groupTokens = addressTokens(parsedFirstLine);
  if (!groupTokens.length) return null;

  const matches = rows
    .map((r) => ({ r, tokens: addressTokens(firstLineAddress(r.propertyAddress)) }))
    .filter(
      ({ tokens }) =>
        tokens.length > 0 &&
        tokens.length <= groupTokens.length &&
        tokens.every((t, i) => t === groupTokens[i]),
    );
  if (!matches.length) return null;

  const maxLen = Math.max(...matches.map((m) => m.tokens.length));
  const best = matches.filter((m) => m.tokens.length === maxLen);
  if (best.length === 1) return best[0].r.id;

  const live = best.filter((m) => m.r.status === "active" || m.r.status === "on_hold");
  if (live.length === 1) return live[0].r.id;
  return null;
}
