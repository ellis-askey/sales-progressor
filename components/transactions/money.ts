// Shared pounds formatting for the All Files surfaces (board columns, cards,
// portfolio strip). Pence in, sterling out. Compact rolls up to k / m for
// headline figures; full is the exact pounds figure for per-file reads.

export function gbpCompact(pence: number): string {
  const pounds = pence / 100;
  if (pounds >= 1_000_000) {
    const m = pounds / 1_000_000;
    return `£${(m >= 10 ? Math.round(m) : Number(m.toFixed(2))).toLocaleString("en-GB")}m`;
  }
  if (pounds >= 1000) return `£${Math.round(pounds / 1000)}k`;
  return `£${Math.round(pounds)}`;
}

export function gbpFull(pence: number): string {
  return `£${Math.round(pence / 100).toLocaleString("en-GB")}`;
}
