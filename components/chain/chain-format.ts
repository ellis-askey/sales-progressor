// Small formatting helpers used only by the /agent/chains workspace cards.
// Kept local to the chains page so nothing else depends on them.

// "Sale agreed 12 days ago" — exact days up to a month, then months. Deliberately
// more precise than lib/utils' relativeDate (which buckets to "Last week") because
// the chains cards read better with an exact day count for recent sales.
export function saleAgreedAgo(iso: string | null): string | null {
  if (!iso) return null;
  const then = new Date(iso);
  const now = new Date();
  then.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);
  const d = Math.max(0, Math.round((now.getTime() - then.getTime()) / 86400000));
  if (d === 0) return "Sale agreed today";
  if (d === 1) return "Sale agreed yesterday";
  if (d < 31) return `Sale agreed ${d} days ago`;
  const m = Math.floor(d / 30);
  return `Sale agreed ${m} month${m === 1 ? "" : "s"} ago`;
}

// The dot "·" separator used between meta items on the cards.
export const META_DOT = "·";
