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
import { normaliseAddressString } from "@/lib/utils/address";
import { titleCaseKeepAcronyms } from "@/lib/utils";
import {
  canViewNodeIntel,
  canEditNodeIntel,
  type IntelViewer,
  type ChainNodeOwnership,
} from "@/lib/chain/intel";

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

// Private own-side chain-node intel, surfaced only to viewers allowed by
// lib/chain/intel.ts. Null on a link when the viewer may not see it (another
// agency's node, or no viewer context passed).
export type ChainNodeIntel = {
  breakChainStance: string | null;
  breakChainConditions: string | null;
  expectedTimescale: string | null;
  chainNotes: string | null;
  lastChainCheckAt: Date | null;
};

// Compact pointer to the (already-built) onward tracker, shown only on the
// viewer's OWN sale node and only while the onward is still ours to report
// (hidden once superseded = the agent above claimed, or abandoned). The full
// editable onward card lives on the file overview; this is a summary + link-in.
export type ChainOnwardSummary = {
  onwardAddress: string | null;
  status: string | null; // OnwardTrackerStatus or null when no tracker opened yet
  typeFactsSet: boolean;
  completeCount: number;
  applicableCount: number;
};

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
    // Agreed sale price (pence) for this link's file. Exposed ONLY on the
    // viewer's own link — stripped to null on every other link (an agent sees
    // just their own price; the shared figure is the chain-level valuePence
    // aggregate). Null also when the file has no price recorded yet.
    purchasePrice: number | null;
    // Signed URL (1h) for the link's property photo, minted at query time in
    // getChainV2 via a single batch round-trip. Null when the file has no
    // photo — the card falls back to the house illustration.
    photoUrl: string | null;
    // Short buyer-position label shared across the chain (cash buyer /
    // first-time buyer), derived from purchaseType + clientFirstTimeBuyer. Not
    // private — this is the one buyer signal we share with other agencies to help
    // them judge chain strength. Null when neither applies. Optional so hand-built
    // demo/dev link objects are unaffected.
    buyerPosition?: string | null;
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
  // Private own-side chain-node intel. Populated only for viewers allowed to see
  // it (lib/chain/intel.ts); null otherwise. Optional so demo/dev callers that
  // build links by hand and callers that pass no viewer are unaffected.
  intel?: ChainNodeIntel | null;
  // Whether the current viewer may edit this node's intel. False when no viewer
  // context is passed.
  canEditIntel?: boolean;
  // Whether the current viewer may edit this node's STUB details (address,
  // agency, agent contact, notes). Only ever true for an UNCLAIMED link, and
  // only for the same owner set as intel (internal team, the stub's creator, or
  // a director in the creating agency). Lets the internal team fix an
  // agent-added stub whose real-world details changed. False when no viewer.
  canEditStub?: boolean;
  // Compact onward summary — populated only on the viewer's own sale node, and
  // only while the onward is still a reported stand-in (not superseded/abandoned).
  // Null everywhere else. Optional so hand-built demo links are unaffected.
  onwardSummary?: ChainOnwardSummary | null;
};

export type ChainV2 = {
  id: string;
  agencyId: string;
  name: string | null;
  createdByUserId: string | null;
  status: string;
  createdAt: Date;
  links: ChainLinkV2[];
  // Combined chain value (pence) summed server-side across EVERY priced link,
  // and how many links carry a price. Computed here because individual
  // purchasePrice is stripped from every link except the viewer's own (privacy:
  // an agent sees only their own sale price, but the aggregate total is shared).
  // Null valuePence when no link is priced.
  valuePence: number | null;
  pricedCount: number;
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
  // Chain-node intel (own-side private) — gated per viewer in getChainV2.
  breakChainStance: true,
  breakChainConditions: true,
  expectedTimescale: true,
  chainNotes: true,
  lastChainCheckAt: true,
  transaction: {
    select: {
      id: true,
      propertyAddress: true,
      status: true,
      agencyId: true,
      // Ownership facts for the intel edit-permission check — stripped from the
      // wire in getChainV2 (never exposed to the client).
      assignedUserId: true,
      agentUserId: true,
      purchasePrice: true,
      photoStoragePath: true,
      createdAt: true,
      purchaseType: true,
      // Buyer-position signal shared across the chain (chain-free / cash / FTB).
      // Derived to a short label in the map; the raw fields are not exposed.
      clientFirstTimeBuyer: true,
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
    // agencyId scopes an unclaimed placeholder's intel to the agency that added
    // it (lib/chain/intel.ts). Stripped from the wire in getChainV2.
    select: { id: true, name: true, agencyId: true },
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

// The one buyer-position signal shared across the chain (Decision 5, 2026-08-28):
// cash buyers and first-time buyers are the positions we can state with certainty
// and that genuinely help other agents judge chain strength. Everything else
// (mortgage / selling-to-buy) is left to the chain structure itself. Cash wins
// over FTB when both are true.
function computeBuyerPosition(
  purchaseType: string | null,
  firstTimeBuyer: boolean | null,
): string | null {
  if (purchaseType === "cash_buyer") return "Cash buyer";
  if (firstTimeBuyer === true) return "First-time buyer";
  return null;
}

export async function getChainV2(
  chainId: string,
  viewerUserId?: string,
  viewer?: IntelViewer,
): Promise<ChainV2 | null> {
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

  // Batch-sign every claimed link's property photo in a single round trip so
  // the wide drawer can render real thumbnails (own file + others' claimed
  // links). Unsigned/absent paths simply fall back to the house illustration.
  const { getSignedUrlMap } = await import("@/lib/supabase-storage");
  const photoMap = await getSignedUrlMap(
    chain.links.map((l) => l.transaction?.photoStoragePath),
    3600,
  ).catch(() => new Map<string, string>());

  // Combined chain value computed from the RAW rows (before individual prices
  // are stripped below). pricedCount powers the "across N priced sales" line.
  const pricedCount = chain.links.filter((l) => l.transaction?.purchasePrice != null).length;
  const valuePence = pricedCount
    ? chain.links.reduce((sum, l) => sum + (l.transaction?.purchasePrice ?? 0), 0)
    : null;

  // Onward summary for the viewer's OWN sale node(s) only — a compact, own-side
  // pointer to the already-built onward tracker (lib/services/onward.ts). Hidden
  // once superseded (the agent above claimed) or abandoned. Fetched only for own
  // files, so usually a single extra read.
  // Own-side = the whole owning agency (+ internal staff), the SAME rule the node
  // intel uses (canViewNodeIntel). So a director / assigned neg / colleague sees
  // their agency's onward; another agency never does (a claimed node requires
  // txAgencyId === viewer.agencyId). Legacy callers without viewer context fall
  // back to the per-claimer check. Deliberately NOT createdByUserId — the
  // originator of a now-claimed stub must not get the neighbour's onward.
  const ownTxIds = (viewer || viewerUserId)
    ? chain.links
        .filter((l) => {
          if (l.transactionId == null) return false;
          if (viewer) {
            return canViewNodeIntel(viewer, {
              transactionId: l.transactionId,
              linkCreatedByUserId: l.createdByUserId,
              linkCreatedByAgencyId: l.createdBy?.agencyId ?? null,
              txAgencyId: l.transaction?.agencyId ?? null,
              txAssignedUserId: l.transaction?.assignedUserId ?? null,
              txAgentUserId: l.transaction?.agentUserId ?? null,
            });
          }
          return l.claimedByUserId === viewerUserId;
        })
        .map((l) => l.transactionId as string)
    : [];
  const onwardByTx = new Map<string, ChainOnwardSummary>();
  if (ownTxIds.length) {
    const { getOnwardTrackerView, getOnwardSignalForFile } = await import("@/lib/services/onward");
    await Promise.all(
      ownTxIds.map(async (txId) => {
        const [sig, view] = await Promise.all([
          getOnwardSignalForFile(txId).catch(() => ({ buyingOnward: false, onwardAddress: null })),
          getOnwardTrackerView(txId).catch(() => null),
        ]);
        if (!sig.buyingOnward) return;
        if (view && (view.status === "superseded" || view.status === "abandoned")) return;
        onwardByTx.set(txId, {
          onwardAddress: sig.onwardAddress,
          status: view?.status ?? null,
          typeFactsSet: view?.typeFactsSet ?? false,
          completeCount: view?.completeCount ?? 0,
          applicableCount: view?.applicableCount ?? 0,
        });
      }),
    );
  }

  // Attach progressPercent + predictedExchangeDate + isEarlyEstimate per link.
  // Strip the raw completions array AND the prediction inputs (createdAt /
  // purchaseType / tenure / isShareOfFreehold / overridePredictedDate) from the
  // returned shape — only the derived fields are exposed publicly. The link's
  // transaction shape on the wire is { id, propertyAddress, status, agencyId,
  // purchasePrice, photoUrl } for consumers (LinkCard, ChainDrawer, etc.).
  return {
    ...chain,
    detachedSegment,
    valuePence,
    pricedCount,
    links: chain.links.map((l) => {
      // Pull the raw intel fields + the raw transaction off the link so neither
      // leaks via the `...linkRest` spread below. Intel is re-added gated per
      // viewer; the transaction is rebuilt as an explicit public allowlist so
      // ownership fields (assignedUserId / agentUserId) never reach the wire.
      const {
        breakChainStance,
        breakChainConditions,
        expectedTimescale,
        chainNotes,
        lastChainCheckAt,
        transaction: rawTx,
        createdBy: rawCreatedBy,
        ...linkRest
      } = l;
      // Rebuild createdBy as {id, name} — the raw row also carries agencyId (for
      // the intel gate below), which must not reach the wire.
      const createdBy = rawCreatedBy ? { id: rawCreatedBy.id, name: rawCreatedBy.name } : null;

      // Intel trust boundary (own-side only) — see lib/chain/intel.ts.
      const ownership: ChainNodeOwnership = {
        transactionId: l.transactionId,
        linkCreatedByUserId: l.createdByUserId,
        linkCreatedByAgencyId: rawCreatedBy?.agencyId ?? null,
        txAgencyId: rawTx?.agencyId ?? null,
        txAssignedUserId: rawTx?.assignedUserId ?? null,
        txAgentUserId: rawTx?.agentUserId ?? null,
      };
      const canEditIntel = viewer ? canEditNodeIntel(viewer, ownership) : false;
      // Stub details are editable only on an UNCLAIMED link, by the same owner
      // set as intel. A claimed link is a real file — its details live there, not
      // on the stub. This is what lets the internal team edit an agent-added stub.
      const canEditStub = l.transactionId === null && canEditIntel;
      const intelVisible = viewer ? canViewNodeIntel(viewer, ownership) : false;
      const intel: ChainNodeIntel | null = intelVisible
        ? {
            breakChainStance: breakChainStance ?? null,
            breakChainConditions: breakChainConditions ?? null,
            expectedTimescale: expectedTimescale ?? null,
            chainNotes: chainNotes ?? null,
            lastChainCheckAt: lastChainCheckAt ?? null,
          }
        : null;
      // Own-side gate for price / onward / stuck-step: the SAME rule as intel, so
      // the whole owning agency (creator, assigned neg, director) + internal staff
      // see them; another agency never does. Legacy callers without viewer context
      // fall back to the per-claimer check.
      const canSeeOwn = viewer ? intelVisible : (viewerUserId != null && l.claimedByUserId === viewerUserId);

      if (!rawTx) {
        return {
          ...linkRest,
          createdBy,
          transaction: null,
          progressPercent: null,
          predictedExchangeDate: null,
          isEarlyEstimate: false,
          stuckMilestoneLabel: null,
          intel,
          canEditIntel,
          canEditStub,
          onwardSummary: null,
        };
      }
      const {
        milestoneCompletions,
        createdAt,
        purchaseType,
        tenure,
        isShareOfFreehold,
        overridePredictedDate,
        photoStoragePath,
        ...txnPublic
      } = rawTx;
      const photoUrl = photoStoragePath ? photoMap.get(photoStoragePath) ?? null : null;
      const prediction = computeChainLinkPrediction(milestoneCompletions, {
        createdAt,
        purchaseType,
        tenure,
        isShareOfFreehold,
        overridePredictedDate,
      });
      // Privacy: stuck-milestone detail is the owning side's private operational
      // state. Surfaced to the owning agency + internal staff (canSeeOwn), never
      // another agency.
      const stuckCode = canSeeOwn ? computeStuckMilestoneCode(milestoneCompletions) : null;
      const stuckMilestoneLabel = stuckCode ? getMilestoneShortLabel(stuckCode) : null;
      // Price privacy: shown to the owning agency + internal staff only (canSeeOwn),
      // stripped to null for every other agency. NOT createdByUserId — the
      // originator of a stub does not own the neighbour's file once another agency
      // claims it, and must not see that agency's price (cross-agency leak fixed
      // 2026-08-28: the claim flow never resets createdByUserId). The shared figure
      // is the valuePence aggregate above.
      return {
        ...linkRest,
        // Explicit public allowlist — id, address, status, agencyId, price, photo,
        // buyer-position label. assignedUserId / agentUserId / clientFirstTimeBuyer
        // stay in txnPublic and are intentionally dropped (only the derived label ships).
        transaction: {
          id: txnPublic.id,
          propertyAddress: txnPublic.propertyAddress,
          status: txnPublic.status,
          agencyId: txnPublic.agencyId,
          purchasePrice: canSeeOwn ? txnPublic.purchasePrice : null,
          photoUrl,
          buyerPosition: computeBuyerPosition(purchaseType, txnPublic.clientFirstTimeBuyer),
        },
        createdBy,
        progressPercent: computeWeightedProgress(milestoneCompletions),
        predictedExchangeDate: prediction.predictedExchangeDate,
        isEarlyEstimate: prediction.isEarlyEstimate,
        stuckMilestoneLabel,
        intel,
        canEditIntel,
        canEditStub,
        onwardSummary: l.transactionId ? onwardByTx.get(l.transactionId) ?? null : null,
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
  viewer?: IntelViewer,
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
  return getChainV2(txn.chainLink.chainId, viewerUserId, viewer);
}

// Count of neighbours in this file's chain that could be invited but haven't
// been: an unclaimed stub link with a usable email and inviteStatus NOT_SENT.
// Drives the "invite them" nudge on the file — an invite that never gets sent is
// lost pipeline. See docs/active/chain-invite-conversion — Phase 4.
export async function getUninvitedNeighbourCount(transactionId: string): Promise<number> {
  const txn = await prisma.propertyTransaction.findUnique({
    where: { id: transactionId },
    select: { chainLink: { select: { chainId: true } } },
  });
  if (!txn?.chainLink) return 0;
  return prisma.chainLink.count({
    where: {
      chainId: txn.chainLink.chainId,
      transactionId: null,
      inviteStatus: "NOT_SENT",
      stubAgentEmail: { contains: "@" },
    },
  });
}

// ─── Chain activity feed (#14) ────────────────────────────────────────────────
// Cross-chain "what's happened" feed for the wide drawer's opt-in activity card.
// Aggregates the real, already-happened events across every link:
//   • milestone confirmations on each claimed file
//   • an agent joining the chain (claim)
//   • a chain invite being declined
//   • a sale withdrawing
// Only the viewer's OWN milestone events name them as "You". Nothing here
// exposes a live "currently stuck on X" state — that stays private to the file
// owner (see stuckMilestoneLabel above).

export type ChainActivityTone = "success" | "danger" | "info";

export type ChainActivityEvent = {
  id: string;
  // Short property label (address line 1) for the uppercase link line.
  linkAddress: string;
  // Human sentence, e.g. "You confirmed searches received".
  message: string;
  at: string; // ISO timestamp
  tone: ChainActivityTone;
};

export async function getChainActivity(
  chainId: string,
  viewerUserId: string,
  limit = 12,
): Promise<ChainActivityEvent[]> {
  const chain = await prisma.propertyChain.findUnique({
    where: { id: chainId },
    select: {
      links: {
        select: {
          id: true,
          transactionId: true,
          claimedByUserId: true,
          claimedAt: true,
          inviteStatus: true,
          inviteDeclinedAt: true,
          stubPropertyAddress: true,
          withdrawalRespondedAt: true,
          claimedBy: { select: { name: true, firmName: true, chainActivityOptIn: true } },
          transaction: {
            select: {
              propertyAddress: true,
              status: true,
              milestoneCompletions: {
                where: { state: "complete", completedAt: { not: null } },
                select: {
                  id: true,
                  completedAt: true,
                  eventDate: true,
                  milestoneDefinition: { select: { code: true } },
                },
                orderBy: { completedAt: "desc" },
                take: 6,
              },
            },
          },
        },
      },
    },
  });
  if (!chain) return [];

  const events: ChainActivityEvent[] = [];
  for (const l of chain.links) {
    const addrFull = l.transaction?.propertyAddress ?? l.stubPropertyAddress ?? "";
    const addr = addrFull.split(",")[0].trim() || "A sale in the chain";
    const isViewer = l.claimedByUserId === viewerUserId;
    const who = l.claimedBy?.firmName?.trim() || l.claimedBy?.name?.trim() || "The agent";
    // Reciprocal sharing: another agent's confirmed steps only appear if THEY are
    // also sharing (chainActivityOptIn). Your own steps always show. Withdrew /
    // joined below are chain facts and are never gated this way.
    const sharesSteps = isViewer || l.claimedBy?.chainActivityOptIn === true;

    if (sharesSteps) {
      for (const c of l.transaction?.milestoneCompletions ?? []) {
        const at = c.completedAt ?? c.eventDate;
        if (!at) continue;
        const step = getMilestoneShortLabel(c.milestoneDefinition?.code ?? "") ?? "a step";
        events.push({
          id: `mc_${c.id}`,
          linkAddress: addr,
          message: isViewer ? `You confirmed ${step}` : `${who} confirmed ${step}`,
          at: at.toISOString(),
          tone: "success",
        });
      }
    }

    if (l.transaction?.status === "withdrawn") {
      const at = l.withdrawalRespondedAt ?? l.claimedAt;
      if (at) {
        events.push({
          id: `wd_${l.id}`,
          linkAddress: addr,
          message: `${addr} withdrew from the chain`,
          at: at.toISOString(),
          tone: "danger",
        });
      }
    }

    // A declined invite is deliberately NOT surfaced here — we never broadcast to
    // the whole chain that an agent turned an invite down. The originator still
    // gets their private decline banner (ChainDeclineBanner). "joined" + "withdrew"
    // below are fine to show; a decline is not.

    if (l.claimedAt && !isViewer && l.transactionId) {
      events.push({
        id: `join_${l.id}`,
        linkAddress: addr,
        message: `${who} joined the chain`,
        at: l.claimedAt.toISOString(),
        tone: "info",
      });
    }
  }

  events.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
  return events.slice(0, limit);
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
    // titleCase handles street + town casing; normaliseAddressString then
    // uppercases the postcode segment which titleCase leaves mixed-case
    // ("lu7 0rz" → "Lu7 0rz" via titleCase → "LU7 0RZ" via normaliser).
    stubPropertyAddress: normaliseAddressString(titleCase(stub.stubPropertyAddress)),
    stubAgencyName: titleCaseKeepAcronyms(stub.stubAgencyName),
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
    // addChainLink extends the MAIN SPINE (branchKey ""). Branch links are added
    // via the branch flow (step 2), so we scope positioning to the spine and
    // never renumber a branch when a spine node is inserted above.
    const links = await tx.chainLink.findMany({
      where: { chainId, branchKey: "" },
      orderBy: { position: "asc" },
    });

    let newPosition: number;
    if (direction === "above") {
      // Shift all existing spine links down, new link gets position 0
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
        ? normaliseAddressString(titleCase(data.stubPropertyAddress))
        : undefined,
      stubAgencyName: data.stubAgencyName
        ? titleCaseKeepAcronyms(data.stubAgencyName)
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
  // Repack only the branch the removed link belonged to (spine = ""), so removing
  // a branch stub never renumbers the spine or another branch.
  const link = await prisma.chainLink.findUnique({
    where: { id: linkId },
    select: { branchKey: true },
  });
  await prisma.chainLink.delete({ where: { id: linkId } });
  await repackPositions(chainId, link?.branchKey ?? "");
}

/**
 * Write a client's neighbour stub (the property + agent above or below them in
 * the chain), creating the chain / link as needed. Shared by the portal
 * "add / edit my agent" flow and the "my onward changed to a different place"
 * flow so the lock rules stay in one place:
 *   - if the neighbour has JOINED (a real transaction), the stub is theirs —
 *     the client can't overwrite it → { ok: false, reason: "joined" }
 *   - if an invite is still live, it's locked → reason: "invite_pending"
 *   - otherwise the stub is written, and `hadInvite` tells the caller a lapsed
 *     invite was overwritten (so they can flag a re-invite).
 */
export async function writeClientChainStub(opts: {
  transactionId: string;
  agencyId: string;
  managingUserId: string;
  direction: "above" | "below";
  stub: {
    stubPropertyAddress: string;
    stubAgencyName: string;
    stubAgentName: string | null;
    stubAgentEmail: string | null;
    stubAgentPhone: string | null;
  };
}): Promise<{ ok: true; hadInvite: boolean } | { ok: false; reason: "joined" | "invite_pending" }> {
  const { transactionId, agencyId, managingUserId, direction, stub } = opts;
  const chain = await getChainForTransactionV2(transactionId).catch(() => null);
  if (!chain) {
    await createChainV2({ transactionId, agencyId, userId: managingUserId, stubs: [{ direction, ...stub }] });
    return { ok: true, hadInvite: false };
  }
  const own = chain.links.find((l) => l.transactionId === transactionId);
  const targetPos = own ? (direction === "above" ? own.position - 1 : own.position + 1) : null;
  const neighbour = targetPos != null ? chain.links.find((l) => l.position === targetPos) : null;
  if (neighbour && neighbour.transactionId !== null) return { ok: false, reason: "joined" };
  if (neighbour) {
    const link = await prisma.chainLink.findUnique({
      where: { id: neighbour.id },
      select: { inviteStatus: true, inviteSentAt: true, inviteTokenExpiresAt: true },
    });
    const invitePending =
      link?.inviteStatus === "SENT" && link.inviteTokenExpiresAt != null && link.inviteTokenExpiresAt > new Date();
    if (invitePending) return { ok: false, reason: "invite_pending" };
    const hadInvite = link?.inviteSentAt != null;
    await updateChainLinkStub(neighbour.id, {
      stubPropertyAddress: stub.stubPropertyAddress || undefined,
      stubAgencyName: stub.stubAgencyName,
      stubAgentName: stub.stubAgentName,
      stubAgentEmail: stub.stubAgentEmail,
      stubAgentPhone: stub.stubAgentPhone,
    });
    return { ok: true, hadInvite };
  }
  await addChainLink({ chainId: chain.id, userId: managingUserId, direction, ...stub });
  return { ok: true, hadInvite: false };
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
