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

// Given the parsed group's first-line address and the candidate property rows
// (already narrowed in the DB by a first-line substring), pick the one file.
//
// Matching is exact first-line equality — NOT a substring — so "18 High St" can
// never match a file at "118 High St". If several files share the first line, a
// property commonly has a `draft` shadow twin alongside the live record, so
// prefer a single active/on_hold match over draft before giving up.
// Returns the chosen transaction id, or null when there is no unambiguous match.
export function chooseTransaction(
  parsedFirstLine: string,
  rows: { id: string; status: string; propertyAddress: string }[],
): string | null {
  const exact = rows.filter((r) => firstLineAddress(r.propertyAddress) === parsedFirstLine);
  if (exact.length === 1) return exact[0].id;
  if (exact.length > 1) {
    const live = exact.filter((r) => r.status === "active" || r.status === "on_hold");
    if (live.length === 1) return live[0].id;
  }
  return null;
}
