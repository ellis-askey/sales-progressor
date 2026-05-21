// Chain bottleneck detection — pure function, client-safe.
//
// Surfaces the slowest claimed link in a chain when it's meaningfully
// behind the others. "Meaningfully" = >7 days behind the median predicted
// exchange date of the other claimed links. Below 7 days, links are
// close enough that calling out a "holdup" would be noise.
//
// Unlike Change 2/3 (which compare files to a hardcoded median and so
// stay gated until real data exists), this comparison is RELATIVE — link
// A vs link B in the same chain. If every link uses the same biased
// median, the slowest is still the slowest. So this signal is safe to
// surface without waiting for MEDIANS_READY.
//
// Returns null when:
//   - fewer than 2 claimed links (not enough to compare)
//   - any claimed link missing predictedExchangeDate (e.g. all early-estimate)
//   - the gap between slowest and the rest is <= 7 days

import type { ChainV2 } from "@/lib/services/chains";

const BOTTLENECK_THRESHOLD_DAYS = 7;
const DAY_MS = 86_400_000;

export type ChainBottleneck = {
  linkPosition: number;            // 0-indexed DB position (caller can flip-display)
  address: string;                 // property address (never agency name)
  daysBehind: number;              // gap vs median of the other links
  claimedByUserId: string | null;  // for "is this the viewer's own file?" check
  transactionId: string;
};

export function computeChainBottleneck(chain: ChainV2): ChainBottleneck | null {
  // Only claimed links with a real prediction can be compared.
  const claimed = chain.links.filter(
    (l) => l.transactionId !== null && l.predictedExchangeDate !== null,
  );
  if (claimed.length < 2) return null;

  // Sort by predicted date ascending; the last is the slowest.
  const sorted = [...claimed].sort(
    (a, b) => a.predictedExchangeDate!.getTime() - b.predictedExchangeDate!.getTime(),
  );
  const slowest = sorted[sorted.length - 1];
  const others = sorted.slice(0, -1);

  // Median predicted-date among the other links. For 1 other, that IS its date;
  // for 2+, the middle value. Avoids over-weighting an outlier on either side.
  const otherTimes = others.map((l) => l.predictedExchangeDate!.getTime()).sort((a, b) => a - b);
  const medianOtherTime = otherTimes[Math.floor(otherTimes.length / 2)];

  const daysBehind = Math.floor(
    (slowest.predictedExchangeDate!.getTime() - medianOtherTime) / DAY_MS,
  );

  if (daysBehind < BOTTLENECK_THRESHOLD_DAYS) return null;

  return {
    linkPosition: slowest.position,
    address: slowest.transaction?.propertyAddress ?? "a sale",
    daysBehind,
    claimedByUserId: slowest.claimedByUserId,
    transactionId: slowest.transactionId!,
  };
}
