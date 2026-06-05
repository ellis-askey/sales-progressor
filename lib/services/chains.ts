// lib/services/chains.ts

import { prisma } from "@/lib/prisma";
import { shiftPositionsUp, repackPositions } from "@/lib/chain/positions";
import {
  calculatePhaseAwarePrediction,
  computeEffectiveStartDate,
  detectPhase,
  type PhaseAwareInput,
} from "@/lib/services/fees";
import { DIRECT_PREREQUISITES } from "@/lib/milestone-prerequisites";
import { getMilestoneShortLabel } from "@/lib/chase/milestone-glossary";

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 1 commit 4d — chains.ts disposition.
//
// Per the user's pre-4d instruction: "chains.ts and problem-detection.ts
// deserve particular suspicion since 'detection' logic tends to drive
// actions, not just dashboards." Audited each site.
//
// Both reads in this file (LINK_V2_SELECT at the bottom, and the
// chain-fetcher's nested milestoneCompletions take:1) feed chain UI
// state — display only. Chain progression milestones drive the
// LATEST-completion-per-link `daysStuck` and `phase` derivations; the
// chain UI renders these but does not fire emails or chases from this
// service.
//
// Chain NOTIFICATION firing (the action surface for chains) lives at
// lib/email/chainNotifications.ts and is triggered from per-tx
// milestone.complete via enqueueChainMilestoneNotifications. That site
// is converted separately as a (b)-class fetcher (see below).
//
// So chains.ts is (a)-class — cross-tx Prisma include limitation, no
// action surface, exchangedAt-canonical principle covers the
// "exchanged-marker" filters in the file.
//
// Specific distortion: a relisted chain link could display
// "exchanged N days ago" reflecting the OLD buyer's PM26 rather than
// the new round's still-pending state. UI shows wrong status; no
// notification fires.
// ─────────────────────────────────────────────────────────────────────────────

// ─── Legacy types (used by legacy widget in components/chain/_legacy/) ────────

export type ChainLinkData = {
  id: string;
  position: number;
  transactionId: string | null;
  externalAddress: string | null;
  externalStatus: string | null;
  transaction?: {
    id: string;
    propertyAddress: string;
    status: string;
    expectedExchangeDate: Date | null;
    vendorSolicitorFirm: { name: string } | null;
    purchaserSolicitorFirm: { name: string } | null;
    milestoneCompletions: { completedAt: Date | null }[];
  } | null;
};

export type ChainData = {
  id: string;
  name: string | null;
  links: ChainLinkData[];
};

// ─── v2 types (new drawer, API routes) ───────────────────────────────────────

export type ChainLinkV2 = {
  id: string;
  position: number;
  createdByUserId: string | null;
  claimedByUserId: string | null;
  transactionId: string | null;
  claimedAt: Date | null;
  stubPropertyAddress: string | null;
  stubAgencyName: string | null;
  // Private fields — callers must gate on canViewStubDetails before exposing
  stubAgentEmail: string | null;
  stubAgentName: string | null;
  stubAgentPhone: string | null;
  stubNotes: string | null;
  inviteStatus: string;
  inviteSentAt: Date | null;
  inviteBouncedAt: Date | null;
  inviteDeclinedAt: Date | null;
  inviteResendCount: number;
  withdrawalStatus: string | null;
  withdrawalRespondedAt: Date | null;
  transaction: {
    id: string;
    propertyAddress: string;
    status: string;
    agencyId: string;
  } | null;
  // Weighted progress 0–100 computed at query time from the claimed transaction's
  // milestone weights + completion states. Pooled across vendor + purchaser,
  // matching the per-file ProgressRing math in calculateProgress(). Null when
  // the link has no claimed transaction.
  progressPercent: number | null;
  // Predicted exchange date for the link's claimed transaction, via the same
  // phase-aware critical-path model used on the file detail page
  // (calculatePhaseAwarePrediction in lib/services/fees.ts). Null when there's
  // no claimed transaction OR the file is in early-estimate phase A.
  // isEarlyEstimate true means "too soon to forecast" — caller should soften
  // the rendering to "we'll show an estimate as the file progresses".
  predictedExchangeDate: Date | null;
  isEarlyEstimate: boolean;
  // Short label for the milestone currently blocking this link's progress —
  // populated ONLY for the link belonging to the viewer (i.e. when
  // claimedByUserId === viewerUserId at fetch time). Null for every other
  // link, enforcing the chain feature's privacy boundary: a viewer sees
  // full operational detail on their OWN file, summary signal only on
  // others'. Surfaced by the chain bottleneck banner in ChainDrawer when
  // the viewer is the slow link. Sourced from MILESTONE_GLOSSARY's
  // "Also called" field via getMilestoneShortLabel().
  stuckMilestoneLabel: string | null;
  claimedBy: {
    id: string;
    name: string;
    firmName: string | null;
  } | null;
  createdBy: {
    id: string;
    name: string;
  } | null;
};

export type ChainV2 = {
  id: string;
  agencyId: string;
  name: string | null;
  createdByUserId: string | null;
  status: string;
  createdAt: Date;
  links: ChainLinkV2[];
  // Closed-loop chain arc (2026-06-05). Set when this chain has had one or
  // more links split off (typically because a withdraw in the cascade tore
  // the chain in two). Drives the "Chain split — N sales detached" banner
  // in the ChainDrawer header so the agent has a visible signal that the
  // chain used to be longer and where the detached segment went.
  detachedSegment: {
    count: number;
    // Most recent split timestamp across all detached links — drives the
    // banner copy ("split on {date}").
    splitAt: Date | null;
    // Direction from the agent's perspective. Inferred from whether the
    // orphan links were above (UPWARD) or below (DOWNWARD) the surviving
    // segment by comparing position numbers. Null when the survivor side
    // has no claimed link to anchor the comparison.
    direction: "UPWARD" | "DOWNWARD" | null;
  } | null;
};

// isChainBroken moved to lib/chain/is-broken.ts so client components can
// value-import it without pulling this whole module (which now imports
// the milestone glossary, which uses Node's fs).
export { isChainBroken } from "@/lib/chain/is-broken";

// ─── Legacy service functions ─────────────────────────────────────────────────

export async function getChainForTransaction(transactionId: string): Promise<ChainData | null> {
  const link = await prisma.chainLink.findFirst({
    where: { transactionId },
    include: {
      chain: {
        include: {
          links: {
            orderBy: { position: "asc" },
            include: {
              transaction: {
                select: {
                  id: true,
                  propertyAddress: true,
                  status: true,
                  expectedExchangeDate: true,
                  vendorSolicitorFirm: { select: { name: true } },
                  purchaserSolicitorFirm: { select: { name: true } },
                  milestoneCompletions: {
                    where: { state: "complete" },
                    orderBy: { completedAt: "desc" },
                    take: 1,
                    select: { completedAt: true },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  return link?.chain ?? null;
}

export async function createChain(agencyId: string, name: string | null) {
  return prisma.propertyChain.create({
    data: { agencyId, name },
  });
}

export async function upsertChainLink(chainId: string, position: number, data: {
  transactionId?: string | null;
  externalAddress?: string | null;
  externalStatus?: string | null;
}) {
  const existing = await prisma.chainLink.findFirst({ where: { chainId, position } });
  if (existing) {
    return prisma.chainLink.update({ where: { id: existing.id }, data });
  }
  return prisma.chainLink.create({ data: { chainId, position, ...data } });
}

// ─── v2 service functions ─────────────────────────────────────────────────────

const LINK_V2_SELECT = {
  id: true,
  position: true,
  createdByUserId: true,
  claimedByUserId: true,
  transactionId: true,
  claimedAt: true,
  stubPropertyAddress: true,
  stubAgencyName: true,
  stubAgentEmail: true,
  stubAgentName: true,
  stubAgentPhone: true,
  stubNotes: true,
  inviteStatus: true,
  inviteSentAt: true,
  inviteBouncedAt: true,
  inviteDeclinedAt: true,
  inviteResendCount: true,
  withdrawalStatus: true,
  withdrawalRespondedAt: true,
  transaction: {
    select: {
      id: true,
      propertyAddress: true,
      status: true,
      agencyId: true,
      createdAt: true,
      purchaseType: true,
      tenure: true,
      isShareOfFreehold: true,
      overridePredictedDate: true,
      milestoneCompletions: {
        select: {
          state: true,
          eventDate: true,
          completedAt: true,
          reconciledAtClaim: true,
          milestoneDefinition: { select: { code: true, weight: true } },
        },
      },
    },
  },
  claimedBy: {
    select: { id: true, name: true, firmName: true },
  },
  createdBy: {
    select: { id: true, name: true },
  },
} as const;

// Pooled weighted progress matching calculateProgress() in lib/services/fees.ts.
// Single ratio across applicable (non-NR) milestones on both sides.
type CompletionForChain = {
  state: string;
  eventDate: Date | null;
  completedAt: Date | null;
  reconciledAtClaim: boolean;
  milestoneDefinition: { code: string; weight: { toNumber(): number } | number } | null;
};

function weightOf(c: CompletionForChain): number {
  if (!c.milestoneDefinition) return 0;
  const w = c.milestoneDefinition.weight;
  return typeof w === "number" ? w : w.toNumber();
}

function computeWeightedProgress(completions: CompletionForChain[]): number | null {
  if (!completions || completions.length === 0) return null;
  let applicableWeight = 0;
  let completedWeight = 0;
  for (const c of completions) {
    if (c.state === "not_required") continue;
    applicableWeight += weightOf(c);
    if (c.state === "complete") completedWeight += weightOf(c);
  }
  if (applicableWeight === 0) return 100;
  return Math.round((completedWeight / applicableWeight) * 100);
}

// Phase-aware predicted exchange date for a chain link, matching the same
// model used on the file detail page (calculatePhaseAwarePrediction). Returns
// null when no completions are available. isEarlyEstimate true means the file
// is in Phase A (onboarding) and the prediction is just the 12-week floor —
// callers should render "too early" copy rather than the band.
function computeChainLinkPrediction(
  completions: CompletionForChain[],
  txn: {
    createdAt: Date;
    purchaseType: string | null;
    tenure: string | null;
    isShareOfFreehold: boolean;
    overridePredictedDate: Date | null;
  },
): { predictedExchangeDate: Date | null; isEarlyEstimate: boolean } {
  if (!completions) return { predictedExchangeDate: null, isEarlyEstimate: false };

  const completedMilestoneCodes = completions
    .filter((c) => c.state === "complete" && c.milestoneDefinition)
    .map((c) => c.milestoneDefinition!.code);

  const effectiveStartDate = computeEffectiveStartDate(
    txn.createdAt,
    completions.map((c) => ({ eventDate: c.eventDate, reconciledAtClaim: c.reconciledAtClaim })),
  );

  const phaseAware: PhaseAwareInput = {
    completedMilestoneCodes,
    purchaseType: txn.purchaseType as PhaseAwareInput["purchaseType"],
    tenure: txn.tenure as PhaseAwareInput["tenure"],
    isShareOfFreehold: txn.isShareOfFreehold,
    effectiveStartDate,
  };

  const predictedExchangeDate = calculatePhaseAwarePrediction(
    phaseAware,
    txn.createdAt,
    txn.overridePredictedDate ?? null,
  );

  const isEarlyEstimate =
    !txn.overridePredictedDate &&
    detectPhase(new Set(completedMilestoneCodes)).fileLevelPhase === "onboarding";

  return { predictedExchangeDate, isEarlyEstimate };
}

// Among the milestones currently in state "available" on a transaction,
// identify the one that has been waiting the longest — i.e. the practical
// "hold-up". Uses the same becameAvailableAt proxy as milestone-staleness:
// latest completedAt across the milestone's direct prerequisites. Returns
// the milestone code (e.g. "PM8"), or null when:
//   - no completions are in state "available"
//   - none of the available milestones have all prereqs known + complete
//     (e.g. early-estimate phase where prereqs haven't been seeded)
// Only ever called for the viewer's own link, gated by claimedByUserId.
function computeStuckMilestoneCode(completions: CompletionForChain[]): string | null {
  if (!completions || completions.length === 0) return null;

  // Build a map of completed milestone codes → completedAt for prereq lookup.
  const completedByCode = new Map<string, Date>();
  for (const c of completions) {
    if (c.state === "complete" && c.completedAt && c.milestoneDefinition) {
      completedByCode.set(c.milestoneDefinition.code, c.completedAt);
    }
  }

  let stuckCode: string | null = null;
  let stuckSince: number = Number.POSITIVE_INFINITY;

  for (const c of completions) {
    if (c.state !== "available" || !c.milestoneDefinition) continue;
    const code = c.milestoneDefinition.code;
    const prereqs = DIRECT_PREREQUISITES[code];
    if (!prereqs || prereqs.length === 0) continue; // can't compute proxy

    let latest: number | null = null;
    let allKnown = true;
    for (const p of prereqs) {
      const pAt = completedByCode.get(p);
      if (!pAt) { allKnown = false; break; }
      const t = pAt.getTime();
      if (latest === null || t > latest) latest = t;
    }
    if (!allKnown || latest === null) continue;
    if (latest < stuckSince) {
      stuckSince = latest;
      stuckCode = code;
    }
  }

  return stuckCode;
}

export async function getChainV2(chainId: string, viewerUserId?: string): Promise<ChainV2 | null> {
  const chain = await prisma.propertyChain.findUnique({
    where: { id: chainId },
    select: {
      id: true,
      agencyId: true,
      name: true,
      createdByUserId: true,
      status: true,
      createdAt: true,
      links: {
        orderBy: { position: "asc" },
        select: LINK_V2_SELECT,
      },
    },
  });
  if (!chain) return null;

  // Closed-loop chain arc (2026-06-05): detect "this chain used to be
  // bigger" by looking for ChainLink rows stamped with detachedFromChainId
  // = our id. If found, build the detachedSegment summary so the drawer
  // can render a banner. Direction is inferred from positions: orphan
  // positions outside the surviving range mean above/below accordingly.
  const detached = await prisma.chainLink.findMany({
    where: { detachedFromChainId: chain.id },
    select: { position: true, detachedAt: true },
    orderBy: { detachedAt: "desc" },
  });
  let detachedSegment: ChainV2["detachedSegment"] = null;
  if (detached.length > 0) {
    const survivorPositions = chain.links.map((l) => l.position);
    const minSurvivor = survivorPositions.length > 0 ? Math.min(...survivorPositions) : null;
    const maxSurvivor = survivorPositions.length > 0 ? Math.max(...survivorPositions) : null;
    const orphanPositions = detached.map((d) => d.position);
    const orphanMax = Math.max(...orphanPositions);
    const orphanMin = Math.min(...orphanPositions);
    let direction: "UPWARD" | "DOWNWARD" | null = null;
    if (maxSurvivor !== null && minSurvivor !== null) {
      if (orphanMax < minSurvivor) direction = "DOWNWARD"; // orphans were below
      else if (orphanMin > maxSurvivor) direction = "UPWARD"; // orphans were above
    }
    detachedSegment = {
      count: detached.length,
      splitAt: detached[0].detachedAt ?? null,
      direction,
    };
  }

  // Attach progressPercent + predictedExchangeDate + isEarlyEstimate per link.
  // Strip the raw completions array AND the prediction inputs (createdAt /
  // purchaseType / tenure / isShareOfFreehold / overridePredictedDate) from the
  // returned shape — only the derived fields are exposed publicly. The link's
  // transaction shape on the wire stays { id, propertyAddress, status, agencyId }
  // for backward-compat with existing consumers (LinkCard, ChainDrawer, etc.).
  return {
    ...chain,
    detachedSegment,
    links: chain.links.map((l) => {
      if (!l.transaction) {
        return {
          ...l,
          transaction: null,
          progressPercent: null,
          predictedExchangeDate: null,
          isEarlyEstimate: false,
          stuckMilestoneLabel: null,
        };
      }
      const {
        milestoneCompletions,
        createdAt,
        purchaseType,
        tenure,
        isShareOfFreehold,
        overridePredictedDate,
        ...txnPublic
      } = l.transaction;
      const prediction = computeChainLinkPrediction(milestoneCompletions, {
        createdAt,
        purchaseType,
        tenure,
        isShareOfFreehold,
        overridePredictedDate,
      });
      // Privacy: stuck-milestone detail is the link owner's private
      // operational state. Only surface it for the viewer's own link.
      // Every other link gets null at the trust boundary.
      const isViewer = viewerUserId != null && l.claimedByUserId === viewerUserId;
      const stuckCode = isViewer ? computeStuckMilestoneCode(milestoneCompletions) : null;
      const stuckMilestoneLabel = stuckCode ? getMilestoneShortLabel(stuckCode) : null;
      return {
        ...l,
        transaction: txnPublic,
        progressPercent: computeWeightedProgress(milestoneCompletions),
        predictedExchangeDate: prediction.predictedExchangeDate,
        isEarlyEstimate: prediction.isEarlyEstimate,
        stuckMilestoneLabel,
      };
    }),
  };
}

// Gets the chain for a given transaction via the canonical chainLinkId field.
// viewerUserId is forwarded to getChainV2 so the stuckMilestoneLabel field is
// populated only on the viewer's own link (privacy boundary). Pass session
// user id from the API route.
export async function getChainForTransactionV2(
  transactionId: string,
  viewerUserId?: string,
): Promise<ChainV2 | null> {
  const txn = await prisma.propertyTransaction.findUnique({
    where: { id: transactionId },
    select: {
      chainLink: {
        select: {
          chainId: true,
        },
      },
    },
  });
  if (!txn?.chainLink) return null;
  return getChainV2(txn.chainLink.chainId, viewerUserId);
}

export type CreateChainInput = {
  transactionId: string;
  agencyId: string;
  userId: string;
  stubs?: Array<{
    direction: "above" | "below";
    stubPropertyAddress: string;
    stubAgencyName: string;
    stubAgentEmail?: string | null;
    stubAgentName?: string | null;
    stubAgentPhone?: string | null;
    stubNotes?: string | null;
  }>;
};

// Creates a new chain, sets the originating transaction as the first claimed link,
// and optionally creates stub links above/below.
export async function createChainV2(input: CreateChainInput): Promise<ChainV2> {
  const { transactionId, agencyId, userId, stubs = [] } = input;

  // Stubs above are at positions 0..n-1; originator at n; stubs below at n+1..
  const aboveStubs = stubs.filter((s) => s.direction === "above");
  const belowStubs = stubs.filter((s) => s.direction === "below");
  const originatorPosition = aboveStubs.length;

  const chain = await prisma.$transaction(async (tx) => {
    const newChain = await tx.propertyChain.create({
      data: { agencyId, createdByUserId: userId, status: "ACTIVE" },
    });

    // Create above stubs (positions 0 to aboveStubs.length - 1)
    for (let i = 0; i < aboveStubs.length; i++) {
      await tx.chainLink.create({
        data: {
          chainId: newChain.id,
          position: i,
          createdByUserId: userId,
          ...stubFields(aboveStubs[i]),
        },
      });
    }

    // Create the originating transaction link
    const originLink = await tx.chainLink.create({
      data: {
        chainId: newChain.id,
        position: originatorPosition,
        createdByUserId: userId,
        transactionId,
        claimedByUserId: userId,
        claimedAt: new Date(),
        inviteStatus: "CLAIMED",
      },
    });

    // Point the transaction at its chain link
    await tx.propertyTransaction.update({
      where: { id: transactionId },
      data: { chainLinkId: originLink.id },
    });

    // Create below stubs
    for (let i = 0; i < belowStubs.length; i++) {
      await tx.chainLink.create({
        data: {
          chainId: newChain.id,
          position: originatorPosition + 1 + i,
          createdByUserId: userId,
          ...stubFields(belowStubs[i]),
        },
      });
    }

    return newChain.id;
  });

  return (await getChainV2(chain))!;
}

function stubFields(stub: {
  stubPropertyAddress: string;
  stubAgencyName: string;
  stubAgentEmail?: string | null;
  stubAgentName?: string | null;
  stubAgentPhone?: string | null;
  stubNotes?: string | null;
}) {
  return {
    stubPropertyAddress: titleCase(stub.stubPropertyAddress),
    stubAgencyName: titleCase(stub.stubAgencyName),
    stubAgentEmail: stub.stubAgentEmail?.toLowerCase().trim() ?? null,
    stubAgentName: stub.stubAgentName?.trim() ?? null,
    stubAgentPhone: stub.stubAgentPhone?.trim() ?? null,
    stubNotes: stub.stubNotes?.trim() ?? null,
    inviteStatus: stub.stubAgentEmail ? "NOT_SENT" : "NOT_SENT",
  } as const;
}

export type AddLinkInput = {
  chainId: string;
  userId: string;
  direction: "above" | "below";
  stubPropertyAddress: string;
  stubAgencyName: string;
  stubAgentEmail?: string | null;
  stubAgentName?: string | null;
  stubAgentPhone?: string | null;
  stubNotes?: string | null;
};

export async function addChainLink(input: AddLinkInput): Promise<ChainV2> {
  const { chainId, userId, direction, ...stub } = input;

  await prisma.$transaction(async (tx) => {
    const links = await tx.chainLink.findMany({
      where: { chainId },
      orderBy: { position: "asc" },
    });

    let newPosition: number;
    if (direction === "above") {
      // Shift all existing links down, new link gets position 0
      for (const link of [...links].reverse()) {
        await tx.chainLink.update({
          where: { id: link.id },
          data: { position: link.position + 1 },
        });
      }
      newPosition = 0;
    } else {
      newPosition = links.length > 0
        ? Math.max(...links.map((l) => l.position)) + 1
        : 0;
    }

    await tx.chainLink.create({
      data: {
        chainId,
        position: newPosition,
        createdByUserId: userId,
        ...stubFields(stub),
      },
    });
  });

  return (await getChainV2(chainId))!;
}

export async function updateChainLinkStub(
  linkId: string,
  data: {
    stubPropertyAddress?: string;
    stubAgencyName?: string;
    stubAgentEmail?: string | null;
    stubAgentName?: string | null;
    stubAgentPhone?: string | null;
    stubNotes?: string | null;
  },
) {
  return prisma.chainLink.update({
    where: { id: linkId },
    data: {
      stubPropertyAddress: data.stubPropertyAddress
        ? titleCase(data.stubPropertyAddress)
        : undefined,
      stubAgencyName: data.stubAgencyName
        ? titleCase(data.stubAgencyName)
        : undefined,
      stubAgentEmail: data.stubAgentEmail !== undefined
        ? data.stubAgentEmail?.toLowerCase().trim() ?? null
        : undefined,
      stubAgentName: data.stubAgentName !== undefined
        ? data.stubAgentName?.trim() ?? null
        : undefined,
      stubAgentPhone: data.stubAgentPhone !== undefined
        ? data.stubAgentPhone?.trim() ?? null
        : undefined,
      stubNotes: data.stubNotes !== undefined
        ? data.stubNotes?.trim() ?? null
        : undefined,
    },
  });
}

export async function removeChainLink(linkId: string, chainId: string): Promise<void> {
  await prisma.chainLink.delete({ where: { id: linkId } });
  await repackPositions(chainId);
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

function titleCase(str: string): string {
  return str.trim().replace(/\S+/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

// Legacy (kept for backward compat — used by legacy widget routes)
export async function deleteChainLink(linkId: string) {
  return prisma.chainLink.delete({ where: { id: linkId } });
}

export async function deleteChain(chainId: string) {
  return prisma.propertyChain.delete({ where: { id: chainId } });
}
