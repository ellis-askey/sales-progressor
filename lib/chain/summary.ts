// Chain summary metrics for the wide chain drawer's right-hand card.
//
// Pure + client-safe: no prisma, no fs. Derives every headline figure from the
// already-fetched ChainV2 shape (which now carries per-link purchasePrice +
// photoUrl from getChainV2). Value-imported by ChainDrawer, so it must only
// pull from other client-safe modules.
//
// Every metric here is a REAL derivation from live chain state — no estimates,
// no placeholder numbers. The one prediction-derived figure (predicted
// completion) is gated behind MEDIANS_READY exactly like LinkCard's exchange
// band, so it stays null (row hidden) until the medians in fees.ts are real.

import type { ChainV2 } from "@/lib/services/chains";
import { displayChainPosition } from "@/lib/chain/positions";
import { MEDIANS_READY } from "@/lib/services/milestone-staleness";

// purchasePrice is stored in PENCE across the schema (seed: "52500000 //
// £525,000 in pence"). Every formatter here divides by 100 before rendering.
export function formatChainPriceFull(pence: number): string {
  return `£${Math.round(pence / 100).toLocaleString("en-GB")}`;
}

// Short form for the aggregate chain value: £1.41m / £820k / £950.
export function formatChainValueShort(pence: number): string {
  const pounds = pence / 100;
  if (pounds >= 1_000_000) {
    // Trim a trailing zero so 1.40m reads as 1.4m, but keep 1.41m.
    const m = (pounds / 1_000_000).toFixed(2).replace(/\.?0+$/, "");
    return `£${m}m`;
  }
  if (pounds >= 1_000) return `£${Math.round(pounds / 1_000)}k`;
  return `£${Math.round(pounds).toLocaleString("en-GB")}`;
}

export type ChainRisk = "low" | "medium" | "high";

export type ChainSummary = {
  // Sum of purchasePrice (pence) across every link that has a price. Null when
  // no link is priced yet — the value card renders "Not priced yet".
  totalValuePence: number | null;
  pricedCount: number;
  // Claimed = link has a real transaction attached (transactionId != null).
  claimedCount: number;
  totalCount: number;
  // The link most threatening the chain, by display position, or null when the
  // chain is healthy. tone drives the colour (danger for broken/declined,
  // warn for a lagging-but-live file).
  weakest: { position: number; tone: "danger" | "warn" } | null;
  // Longest time a claimed file has been in the chain, in whole days. Null when
  // no claimed link carries a join timestamp.
  oldestSaleDays: number | null;
  // Latest predicted exchange across claimed links (the chain completes when
  // its slowest link exchanges). Null unless MEDIANS_READY — we never surface a
  // guessed date. Row is hidden while null.
  predictedCompletion: Date | null;
  risk: ChainRisk;
};

export function computeChainSummary(chain: ChainV2): ChainSummary {
  const links = chain.links;
  const totalCount = links.length;

  const priced = links.filter((l) => l.transaction?.purchasePrice != null);
  const pricedCount = priced.length;
  const totalValuePence = pricedCount
    ? priced.reduce((sum, l) => sum + (l.transaction!.purchasePrice ?? 0), 0)
    : null;

  const claimedLinks = links.filter((l) => l.transactionId !== null);
  const claimedCount = claimedLinks.length;

  const hasWithdrawn = links.some((l) => l.transaction?.status === "withdrawn");
  const hasDeadInvite = links.some(
    (l) => l.inviteStatus === "DECLINED" || l.inviteStatus === "BOUNCED",
  );

  // Weakest link — first match by threat priority:
  //   1. a withdrawn (broken) link, 2. a declined/bounced invite,
  //   3. the lowest-progress claimed file (only flagged when it trails).
  let weakest: ChainSummary["weakest"] = null;
  const withdrawn = links.find((l) => l.transaction?.status === "withdrawn");
  const deadInvite = links.find(
    (l) => l.inviteStatus === "DECLINED" || l.inviteStatus === "BOUNCED",
  );
  if (withdrawn) {
    weakest = { position: displayChainPosition(withdrawn.position, totalCount), tone: "danger" };
  } else if (deadInvite) {
    weakest = { position: displayChainPosition(deadInvite.position, totalCount), tone: "danger" };
  } else {
    // Lowest-progress claimed file, flagged only when it meaningfully trails
    // the chain (>= 20 points behind the next-slowest) so we don't cry wolf.
    const withProgress = claimedLinks
      .filter((l) => l.progressPercent != null)
      .sort((a, b) => (a.progressPercent ?? 0) - (b.progressPercent ?? 0));
    if (withProgress.length >= 2) {
      const slowest = withProgress[0];
      const next = withProgress[1];
      if ((next.progressPercent ?? 0) - (slowest.progressPercent ?? 0) >= 20) {
        weakest = { position: displayChainPosition(slowest.position, totalCount), tone: "warn" };
      }
    }
  }

  // Oldest sale — longest-standing claimed file by claimedAt.
  let oldestSaleDays: number | null = null;
  const now = Date.now();
  for (const l of claimedLinks) {
    if (!l.claimedAt) continue;
    const days = Math.floor((now - new Date(l.claimedAt).getTime()) / 86_400_000);
    if (oldestSaleDays === null || days > oldestSaleDays) oldestSaleDays = days;
  }

  // Predicted completion — latest predicted exchange across claimed links.
  // Gated on MEDIANS_READY: null (row hidden) until the medians are real.
  let predictedCompletion: Date | null = null;
  if (MEDIANS_READY) {
    for (const l of claimedLinks) {
      if (l.isEarlyEstimate || !l.predictedExchangeDate) continue;
      const d = new Date(l.predictedExchangeDate);
      if (predictedCompletion === null || d > predictedCompletion) predictedCompletion = d;
    }
  }

  // Risk — from real signals only.
  //   high   : a sale has withdrawn (the chain is broken)
  //   medium : a dead invite, under half the links claimed, or a 90-day-old file
  //   low    : otherwise
  let risk: ChainRisk = "low";
  if (hasWithdrawn) {
    risk = "high";
  } else if (
    hasDeadInvite ||
    (totalCount > 0 && claimedCount / totalCount < 0.5) ||
    (oldestSaleDays != null && oldestSaleDays > 90)
  ) {
    risk = "medium";
  }

  return {
    totalValuePence,
    pricedCount,
    claimedCount,
    totalCount,
    weakest,
    oldestSaleDays,
    predictedCompletion,
    risk,
  };
}
