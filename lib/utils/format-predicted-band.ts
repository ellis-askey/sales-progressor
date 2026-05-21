// Soft date band for median-based forecasts.
// Forecast precision is wide; rendering a single specific date encourages
// readers to treat it as a promise. The band ("Around early/mid/late June")
// signals appropriate imprecision while still being directionally useful.
//
// Used by:
//   - components/transaction/TransactionSidebar.tsx (agent file detail)
//   - app/portal/[token]/page.tsx (portal home for buyer/seller)
//   - components/chain/LinkCard.tsx (chain drawer per link)

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// Day-of-month → band slot.
// 1–10 = early, 11–20 = mid, 21+ = late
export function formatPredictedBand(date: Date): string {
  const day = date.getDate();
  const month = MONTH_NAMES[date.getMonth()];
  const year = date.getFullYear();
  const currentYear = new Date().getFullYear();

  const slot = day <= 10 ? "early" : day <= 20 ? "mid" : "late";
  const yearSuffix = year !== currentYear ? ` ${year}` : "";

  return `Around ${slot} ${month}${yearSuffix}`;
}

// Short variant for space-constrained surfaces (chain LinkCard).
// Drops the "Around" prefix.
export function formatPredictedBandShort(date: Date): string {
  const day = date.getDate();
  const month = MONTH_NAMES[date.getMonth()];
  const year = date.getFullYear();
  const currentYear = new Date().getFullYear();

  const slot = day <= 10 ? "early" : day <= 20 ? "mid" : "late";
  const yearSuffix = year !== currentYear ? ` ${year}` : "";

  return `~${slot} ${month.slice(0, 3)}${yearSuffix}`;
}
