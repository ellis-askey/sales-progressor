// lib/services/chains.ts

import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { scopeTransactionWhere, type AccessScope } from "@/lib/security/access-scope";
import { TransactionStatus } from "@prisma/client";
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
import { getChainLinkStatus, type ChainLinkStatusKind } from "@/lib/chain/status";

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
  // Branching: "" = the main spine. A non-empty key groups one onward branch's
  // links. forkFromLinkId (set on a branch's bottom link) is the spine node the
  // branch forks above. Optional so hand-built demo/dev links are unaffected;
  // getChainV2 always populates them. See docs/active/chain-branching/00-spec.md.
  branchKey?: string;
  forkFromLinkId?: string | null;
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
  branchKey: true,
  forkFromLinkId: true,
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

// Max onward purchases a single sale can fork into (Ellis, 2026-09-01).
export const MAX_ONWARD_BRANCHES = 3;

export type AddBranchInput = {
  chainId: string;
  forkFromLinkId: string; // the spine node this onward forks above
  userId: string;
  stubPropertyAddress: string;
  stubAgencyName: string;
  stubAgentEmail?: string | null;
  stubAgentName?: string | null;
  stubAgentPhone?: string | null;
  stubNotes?: string | null;
};

// How many onward purchases a fork node already has: the link directly above it
// in its OWN ladder (if any) counts as onward #1, plus every branch that forks
// from it. Ladder-aware so it's correct for a nested fork (a branch node forking
// again), not just the spine. Used to enforce MAX_ONWARD_BRANCHES.
async function countOnwardsForNode(
  tx: Pick<typeof prisma, "chainLink">,
  chainId: string,
  forkNode: { id: string; position: number; branchKey: string },
): Promise<number> {
  const ladderAbove = await tx.chainLink.count({
    where: { chainId, branchKey: forkNode.branchKey, position: forkNode.position - 1 },
  });
  const branches = await tx.chainLink.count({
    where: { forkFromLinkId: forkNode.id },
  });
  return ladderAbove + branches;
}

// Add a sale directly above a given link, within that link's OWN ladder (the
// spine when branchKey is "", or a branch otherwise). Generalises the spine
// "add above": every link in that ladder shifts down one and the new sale takes
// the top (position 0). A branch's fork link keeps its forkFromLinkId and simply
// moves to the new ladder bottom, so the fork anchor never changes. This is what
// lets each column in a split grow upward independently.
export async function addAboveLink(input: {
  chainId: string;
  userId: string;
  aboveLinkId: string;
  stubPropertyAddress: string;
  stubAgencyName: string;
  stubAgentEmail?: string | null;
  stubAgentName?: string | null;
  stubAgentPhone?: string | null;
  stubNotes?: string | null;
}): Promise<{ ok: true; chain: ChainV2 } | { ok: false; reason: "not_found" }> {
  const { chainId, userId, aboveLinkId, ...stub } = input;

  const result = await prisma.$transaction(async (tx) => {
    const anchor = await tx.chainLink.findFirst({
      where: { id: aboveLinkId, chainId },
      select: { id: true, branchKey: true },
    });
    if (!anchor) return { ok: false as const, reason: "not_found" as const };

    const ladderKey = anchor.branchKey ?? "";
    const ladder = await tx.chainLink.findMany({
      where: { chainId, branchKey: ladderKey },
      orderBy: { position: "asc" },
    });
    // Shift the whole ladder down (highest position first, so no unique-position
    // collision), then drop the new sale in at the top.
    for (const link of [...ladder].reverse()) {
      await tx.chainLink.update({
        where: { id: link.id },
        data: { position: link.position + 1 },
      });
    }
    await tx.chainLink.create({
      data: {
        chainId,
        branchKey: ladderKey,
        position: 0,
        createdByUserId: userId,
        ...stubFields(stub),
      },
    });
    return { ok: true as const };
  });

  if (!result.ok) return result;
  return { ok: true, chain: (await getChainV2(chainId))! };
}

// Add an extra onward purchase (a branch) above a sale. The first onward is a
// normal spine link ("add sale above"); the 2nd/3rd are branches that fork from
// the same node. Each branch is its own ladder (unique branchKey), starting at
// position 0. Enforces MAX_ONWARD_BRANCHES. Throws on a bad/duplicate request so
// the caller surfaces a clean error.
export async function addChainBranch(
  input: AddBranchInput,
): Promise<{ ok: true; chain: ChainV2 } | { ok: false; reason: "not_found" | "at_limit" }> {
  const { chainId, forkFromLinkId, userId, ...stub } = input;

  const result = await prisma.$transaction(async (tx) => {
    // A fork can now hang off ANY sale, not just the spine — that's what lets a
    // branch fork again (a nested onward). The new branch is still its own
    // ladder (fresh branchKey), anchored to this node via forkFromLinkId.
    const forkNode = await tx.chainLink.findFirst({
      where: { id: forkFromLinkId, chainId },
      select: { id: true, position: true, branchKey: true },
    });
    if (!forkNode) return { ok: false as const, reason: "not_found" as const };

    const onwards = await countOnwardsForNode(tx, chainId, forkNode);
    if (onwards >= MAX_ONWARD_BRANCHES) return { ok: false as const, reason: "at_limit" as const };

    await tx.chainLink.create({
      data: {
        chainId,
        branchKey: randomUUID(),
        position: 0,
        forkFromLinkId: forkNode.id,
        createdByUserId: userId,
        ...stubFields(stub),
      },
    });
    return { ok: true as const };
  });

  if (!result.ok) return result;
  return { ok: true, chain: (await getChainV2(chainId))! };
}

// Where in the chain a self-linked own sale should slot. Mirrors the three stub
// add shapes: a spine above/below, the top of a specific column, or a new branch
// forking off a sale.
export type SelfLinkContext =
  | { kind: "spine"; direction: "above" | "below" }
  | { kind: "column"; aboveOfLinkId: string }
  | { kind: "branch"; forkFromLinkId: string };

// Link one of the adder's OWN live files into the chain as a real, claimed node
// (instead of a hand-typed stub). This is a self-claim: the new link points at
// the transaction and is claimed by the adder, and the file's active chainLinkId
// is set so it can't be double-linked. Silent by design — no invite, no chain
// notifications (Ellis, 2026-09-01). Positioning reuses the same rules as the
// stub adds. The route is responsible for the agency-scope check (Law 7); the
// chainLinkId-null guard here is the final backstop against double-linking.
export async function selfLinkOwnSale(input: {
  chainId: string;
  userId: string;
  transactionId: string;
  context: SelfLinkContext;
}): Promise<
  { ok: true; chain: ChainV2 } | { ok: false; reason: "not_found" | "at_limit" | "ineligible" }
> {
  const { chainId, userId, transactionId, context } = input;

  const result = await prisma.$transaction(async (tx) => {
    // Final eligibility backstop: the file must not already be a link in any
    // chain (its active chainLinkId must be null).
    const txn = await tx.propertyTransaction.findFirst({
      where: { id: transactionId, chainLinkId: null },
      select: { id: true },
    });
    if (!txn) return { ok: false as const, reason: "ineligible" as const };

    let branchKey = "";
    let position = 0;
    let forkFromLinkId: string | null = null;

    if (context.kind === "spine") {
      const spine = await tx.chainLink.findMany({
        where: { chainId, branchKey: "" },
        orderBy: { position: "asc" },
      });
      if (context.direction === "above") {
        for (const l of [...spine].reverse()) {
          await tx.chainLink.update({ where: { id: l.id }, data: { position: l.position + 1 } });
        }
        position = 0;
      } else {
        position = spine.length > 0 ? Math.max(...spine.map((l) => l.position)) + 1 : 0;
      }
    } else if (context.kind === "column") {
      const anchor = await tx.chainLink.findFirst({
        where: { id: context.aboveOfLinkId, chainId },
        select: { branchKey: true },
      });
      if (!anchor) return { ok: false as const, reason: "not_found" as const };
      branchKey = anchor.branchKey ?? "";
      const ladder = await tx.chainLink.findMany({
        where: { chainId, branchKey },
        orderBy: { position: "asc" },
      });
      for (const l of [...ladder].reverse()) {
        await tx.chainLink.update({ where: { id: l.id }, data: { position: l.position + 1 } });
      }
      position = 0;
    } else {
      const forkNode = await tx.chainLink.findFirst({
        where: { id: context.forkFromLinkId, chainId },
        select: { id: true, position: true, branchKey: true },
      });
      if (!forkNode) return { ok: false as const, reason: "not_found" as const };
      const onwards = await countOnwardsForNode(tx, chainId, forkNode);
      if (onwards >= MAX_ONWARD_BRANCHES) return { ok: false as const, reason: "at_limit" as const };
      branchKey = randomUUID();
      position = 0;
      forkFromLinkId = forkNode.id;
    }

    const created = await tx.chainLink.create({
      data: {
        chainId,
        branchKey,
        position,
        forkFromLinkId,
        createdByUserId: userId,
        transactionId,
        claimedByUserId: userId,
        claimedAt: new Date(),
      },
      select: { id: true },
    });
    await tx.propertyTransaction.update({
      where: { id: transactionId },
      data: { chainLinkId: created.id },
    });
    return { ok: true as const };
  });

  if (!result.ok) return result;
  return { ok: true, chain: (await getChainV2(chainId))! };
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
 * Move a chain link one step up or down within its own ladder (branchKey),
 * swapping positions with the adjacent link. Only permitted while the whole
 * chain is still the creator's own work — every link created by this user and
 * none claimed by anyone else — so the initial agent can correct the order
 * before others join, and it locks the moment one other sale is claimed.
 * "up" = toward the top of the chain (a lower position). 2026-09-01.
 */
export async function moveChainLinkAdjacent(
  chainId: string,
  linkId: string,
  direction: "up" | "down",
  userId: string,
): Promise<{ ok: true } | { ok: false; reason: "not_found" | "locked" | "no_neighbour" }> {
  const links = await prisma.chainLink.findMany({
    where: { chainId },
    select: { id: true, position: true, branchKey: true, createdByUserId: true, claimedByUserId: true },
  });
  const moving = links.find((l) => l.id === linkId);
  if (!moving) return { ok: false, reason: "not_found" };

  // Locked once anyone else is involved: reorder only while every link is this
  // user's own stub and no one else has claimed a sale.
  const allMineUnclaimed = links.every(
    (l) => l.createdByUserId === userId && (l.claimedByUserId == null || l.claimedByUserId === userId),
  );
  if (!allMineUnclaimed) return { ok: false, reason: "locked" };

  const branchKey = moving.branchKey ?? "";
  const neighbour = links
    .filter((l) => (l.branchKey ?? "") === branchKey && l.id !== linkId)
    .filter((l) => (direction === "up" ? l.position < moving.position : l.position > moving.position))
    .sort((a, b) => (direction === "up" ? b.position - a.position : a.position - b.position))[0];
  if (!neighbour) return { ok: false, reason: "no_neighbour" };

  // Swap via a temporary position (-1) so the (chainId, branchKey, position)
  // unique index is never transiently violated.
  await prisma.$transaction([
    prisma.chainLink.update({ where: { id: moving.id }, data: { position: -1 } }),
    prisma.chainLink.update({ where: { id: neighbour.id }, data: { position: moving.position } }),
    prisma.chainLink.update({ where: { id: moving.id }, data: { position: neighbour.position } }),
  ]);
  return { ok: true };
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

// ─── Chains workspace (agent /agent/chains) ───────────────────────────────────
// Lightweight lists for the chains overview. Deliberately cheaper than
// getChainV2 (no photos / intel / predictions) — just enough to render the run
// of properties, our file's place in it, and the invite-needed flag, then hand
// off to the ChainDrawer for the full picture. Scoped via getAccessScope so it
// serves agency staff (their agency), sales_progressor (assigned) and admin /
// superadmin (all) — in-house and outsourced alike.

// Live sales only — a chain is a thing you actively manage; completed/withdrawn
// files drop out of both lists.
const CHAINS_LIVE_STATUSES: TransactionStatus[] = [TransactionStatus.active, TransactionStatus.on_hold];

export type ChainsWorkspaceLink = {
  label: string;                    // property address, stub address, or a generic onward label
  isOurs: boolean;                  // the single representative "your sale" anchor (one per chain)
  claimed: boolean;                 // connected agent — has a real transaction (vs a stub)
  statusKind: ChainLinkStatusKind;  // canonical status (drives mini-map colour + counts)
};

export type ChainsWorkspaceChain = {
  chainId: string;
  openTransactionId: string; // one of our files, so the ChainDrawer opens in context
  length: number;
  ourPosition: number | null; // 1-based index of our file within the run
  // Links above / below our sale. Codebase convention (see getChainV2's
  // detachedSegment inference): a LOWER position sits BELOW, a HIGHER position
  // ABOVE. So below = links before ours, above = links after ours.
  linksAbove: number;
  linksBelow: number;
  agentsConnected: number; // claimed links (connected agents) — matches the drawer's claim rate
  needsInviteCount: number; // "send now" invites: stub-with-email, not yet sent
  ourFileCount: number; // in-scope files that sit in this chain (drives the "In chains" tile)
  links: ChainsWorkspaceLink[];
  // Our primary file within this chain — powers the card header. Null only in
  // the (filtered-out) case where no claimed link resolves.
  ourAddress: string | null;
  ourPhotoUrl: string | null;
  ourAgencyName: string | null;
  saleAgreedAt: string | null; // ISO — our file's createdAt, our "sale agreed" proxy
  chainName: string | null;
  search: string; // lowercased address + agency + chain name + link labels + agent firms
};

export type NoChainSale = {
  transactionId: string;
  address: string;
  status: string;
  createdAt: string; // ISO — sale-agreed proxy, drives oldest-first ordering + age
  photoUrl: string | null;
  agencyName: string | null;
  // The one buyer-position signal we already hold (First-time buyer / Cash
  // buyer), derived from clientFirstTimeBuyer + purchaseType. Null otherwise.
  buyerPosition: string | null;
  // Genuinely needs no chain: the buyer is chain-free (FTB/cash) AND the seller
  // has told us they're not buying onward (ClientMoveInfo.buyingOnward === false).
  // Both are real fields — nothing invented. Conservative: only true when both
  // are known-positive.
  noChainRequired: boolean;
  search: string;
};

export async function listChainsForScope(scope: AccessScope): Promise<ChainsWorkspaceChain[]> {
  const ourTxns = await prisma.propertyTransaction.findMany({
    where: { AND: [scopeTransactionWhere(scope), { status: { in: CHAINS_LIVE_STATUSES }, chainLinkId: { not: null } }] },
    select: {
      id: true,
      propertyAddress: true,
      createdAt: true,
      photoStoragePath: true,
      agency: { select: { name: true } },
      chainLink: { select: { chainId: true } },
    },
  });
  const ourTxIds = new Set(ourTxns.map((t) => t.id));
  const ourTxById = new Map(ourTxns.map((t) => [t.id, t]));
  const chainIds = [...new Set(ourTxns.map((t) => t.chainLink?.chainId).filter((x): x is string => !!x))];
  if (chainIds.length === 0) return [];

  const chains = await prisma.propertyChain.findMany({
    where: { id: { in: chainIds } },
    select: {
      id: true,
      name: true,
      links: {
        orderBy: [{ branchKey: "asc" }, { position: "asc" }],
        select: {
          transactionId: true,
          inviteStatus: true,
          stubPropertyAddress: true,
          stubAgencyName: true,
          stubAgentEmail: true,
          claimedBy: { select: { name: true, firmName: true } },
          transaction: { select: { id: true, propertyAddress: true } },
        },
      },
    },
  });

  // Batch-sign our files' photos in one round trip; unsigned/absent paths fall
  // back to the house illustration in PropertyThumb.
  const { getSignedUrlMap } = await import("@/lib/supabase-storage");
  const photoMap = await getSignedUrlMap(
    ourTxns.map((t) => t.photoStoragePath),
    3600,
  ).catch(() => new Map<string, string>());

  return chains
    .map((chain) => {
      // The representative "your sale" anchor: the first claimed link in our
      // scope, else the first claimed link. Everything the card measures against
      // "you" (the You node, position, above/below) uses this single anchor, so
      // an internal viewer (whose scope is "all") never gets multiple You nodes.
      const openTransactionId =
        chain.links.find((l) => l.transactionId != null && ourTxIds.has(l.transactionId))?.transactionId
        ?? chain.links.find((l) => l.transactionId != null)?.transactionId
        ?? "";

      const links: ChainsWorkspaceLink[] = chain.links.map((l) => {
        // Canonical status — the SAME derivation getChainLinkStatus gives the
        // drawer, so "connected" and "to invite" counts always agree with it.
        // Viewer id is irrelevant here (we only branch on claimed vs the unclaimed
        // kinds), so pass a blank id.
        const status = getChainLinkStatus(
          {
            transactionId: l.transactionId,
            claimedByUserId: null,
            stubAgentEmail: l.stubAgentEmail,
            inviteStatus: l.inviteStatus,
          },
          "",
        );
        return {
          label: l.transaction?.propertyAddress ?? l.stubPropertyAddress ?? "Onward sale",
          isOurs: l.transactionId != null && l.transactionId === openTransactionId,
          claimed: l.transactionId != null,
          statusKind: status.kind,
        };
      });

      const length = links.length;
      const anchorIndex = links.findIndex((l) => l.isOurs);
      const claimedCount = links.filter((l) => l.claimed).length;
      // Send-now invites: the exact set the drawer offers "Send invite" on.
      const needsInviteCount = links.filter((l) => l.statusKind === "unclaimed_unsent").length;
      // In-scope files sitting in this chain (distinct from the single anchor).
      const ourFileCount = chain.links.filter(
        (l) => l.transactionId != null && ourTxIds.has(l.transactionId),
      ).length;

      const ours = openTransactionId ? ourTxById.get(openTransactionId) : undefined;
      const ourPhotoUrl = ours?.photoStoragePath ? photoMap.get(ours.photoStoragePath) ?? null : null;

      const searchParts: (string | null | undefined)[] = [
        ours?.propertyAddress,
        ours?.agency?.name,
        chain.name,
        ...chain.links.map((l) => l.transaction?.propertyAddress ?? l.stubPropertyAddress),
        ...chain.links.map((l) => l.claimedBy?.firmName ?? l.claimedBy?.name),
        ...chain.links.map((l) => l.stubAgencyName),
      ];

      return {
        chainId: chain.id,
        openTransactionId,
        length,
        ourPosition: anchorIndex >= 0 ? anchorIndex + 1 : null,
        // Convention (lib/chain/positions.ts): position 0 = TOP of chain = above.
        // Links before the anchor (lower position) are above it; links after
        // (higher position) are below it.
        linksAbove: anchorIndex >= 0 ? anchorIndex : 0,
        linksBelow: anchorIndex >= 0 ? length - 1 - anchorIndex : 0,
        agentsConnected: claimedCount,
        needsInviteCount,
        ourFileCount,
        links,
        ourAddress: ours?.propertyAddress ?? null,
        ourPhotoUrl,
        ourAgencyName: ours?.agency?.name ?? null,
        saleAgreedAt: ours?.createdAt.toISOString() ?? null,
        chainName: chain.name,
        search: searchParts.filter(Boolean).join(" ").toLowerCase(),
      };
    })
    .filter((c) => c.openTransactionId);
}

export async function listNoChainSalesForScope(scope: AccessScope): Promise<NoChainSale[]> {
  const rows = await prisma.propertyTransaction.findMany({
    where: { AND: [scopeTransactionWhere(scope), { status: { in: CHAINS_LIVE_STATUSES }, chainLinkId: null }] },
    select: {
      id: true,
      propertyAddress: true,
      status: true,
      createdAt: true,
      photoStoragePath: true,
      purchaseType: true,
      clientFirstTimeBuyer: true,
      agency: { select: { name: true } },
    },
    // Oldest first — a sale that's been sitting without a chain the longest is
    // the one most in need of setting up, so it surfaces at the top.
    orderBy: { createdAt: "asc" },
  });
  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.id);

  // Real "not buying onward" signal from the vendor's move info — the only
  // grounded way to say a sale needs no chain above. buyingOnward is nullable;
  // we treat only an explicit false as "not buying onward".
  const moveInfos = await prisma.clientMoveInfo.findMany({
    where: { transactionId: { in: ids }, side: "vendor" },
    select: { transactionId: true, buyingOnward: true },
  });
  const notBuyingOnward = new Set(
    moveInfos.filter((m) => m.buyingOnward === false).map((m) => m.transactionId),
  );

  const { getSignedUrlMap } = await import("@/lib/supabase-storage");
  const photoMap = await getSignedUrlMap(
    rows.map((r) => r.photoStoragePath),
    3600,
  ).catch(() => new Map<string, string>());

  const mapped = rows.map((r) => {
    const buyerPosition = computeBuyerPosition(r.purchaseType, r.clientFirstTimeBuyer);
    // Buyer is chain-free (nothing below) AND seller not buying onward (nothing
    // above) → genuinely no chain required. Grounded in existing fields only.
    const buyerChainFree = r.purchaseType === "cash_buyer" || r.clientFirstTimeBuyer === true;
    const noChainRequired = buyerChainFree && notBuyingOnward.has(r.id);
    const photoUrl = r.photoStoragePath ? photoMap.get(r.photoStoragePath) ?? null : null;
    return {
      transactionId: r.id,
      address: r.propertyAddress,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
      photoUrl,
      agencyName: r.agency?.name ?? null,
      buyerPosition,
      noChainRequired,
      search: [r.propertyAddress, r.agency?.name, buyerPosition].filter(Boolean).join(" ").toLowerCase(),
    };
  });

  // Keep oldest-first for the files that still need action; drop the
  // no-chain-required ones to the bottom (they need no work).
  return mapped.sort((a, b) => Number(a.noChainRequired) - Number(b.noChainRequired));
}
