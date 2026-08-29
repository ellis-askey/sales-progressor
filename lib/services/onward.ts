// lib/services/onward.ts
//
// Onward-Purchase Visibility arc — Stage 1 service layer.
//
// A seller's REPORTED onward-purchase progress, held on their own sale file (the
// OnwardTracker "shadow tracker"). The seller acts as the BUYER on their onward,
// so we track the purchaser-side (PM) steps only. Availability/ordering is
// computed here on read from the real DIRECT_PREREQUISITES chain + the exchange
// gate — we do NOT store per-step state, only the confirmed rows (presence of a
// row = reported complete).
//
// Everything here is second-hand ("reported"); it is never exposed across the
// agency boundary (Q6) and never treated as authoritative chain data (Q7).
// Full spec + decisions: docs/active/onward-visibility/00-discovery.md.
//
// Callers (server actions) MUST perform the multi-tenant scope check (Law 7)
// before invoking any function here — this module is scope-agnostic.

import { prisma } from "@/lib/prisma";
import { DIRECT_PREREQUISITES, RETIRED_ENQUIRY_CODES } from "@/lib/milestone-prerequisites";
import { computeAutoNrCodes } from "@/lib/milestone-auto-nr";
import type { Tenure, PurchaseType, OnwardConfirmSource, OnwardTrackerStatus, OnwardTrackerKind, MilestoneSide } from "@prisma/client";

// Direction config — the ONE tracker runs in two directions (Law 4, reuse not
// duplicate): a seller's onward PURCHASE (the link ABOVE, purchaser/PM steps)
// and a buyer's related SALE (the link BELOW, vendor/VM steps). Everything that
// differs between the two directions lives here; the rest of the module reads
// `dir`. Defaulting every function to `onward_purchase` keeps the seller flow
// byte-for-byte unchanged.
type Direction = {
  side: MilestoneSide;              // which milestone side's steps we track
  prefix: "PM" | "VM";             // in-scope prereq prefix (others = out of scope)
  gateCode: string;                 // the exchange gate step (starts locked)
  exchangeCode: string;             // the "exchanged" step
  completionCode: string;           // the "completed" step
  surveyCodes: readonly string[];   // opt-out survey pair (purchaser only)
  mortgageCodes: readonly string[]; // mortgage back-fill trio (purchaser only)
  requiresPurchaseType: boolean;    // onward has a buying axis; a related SALE has only tenure
  // Our own milestone that must complete before the tracked sale's completion
  // can be reported. Onward: our own completion (VM20) funds the chain upward, so
  // the onward can't complete before us. Related sale: none — Option A, it
  // completes before/with our purchase and we don't gate it.
  completionGateOurCode: string | null;
};

const DIRECTION: Record<OnwardTrackerKind, Direction> = {
  onward_purchase: {
    side: "purchaser", prefix: "PM",
    gateCode: "PM25", exchangeCode: "PM26", completionCode: "PM27",
    surveyCodes: ["PM9", "PM10"], mortgageCodes: ["PM5", "PM6", "PM11"],
    completionGateOurCode: "VM20", requiresPurchaseType: true,
  },
  related_sale: {
    side: "vendor", prefix: "VM",
    gateCode: "VM18", exchangeCode: "VM19", completionCode: "VM20",
    surveyCodes: [], mortgageCodes: [],
    completionGateOurCode: null, requiresPurchaseType: false,
  },
};

export type OnwardStepView = {
  code: string;
  name: string;
  eventDateRequired: boolean;
  isComplete: boolean;
  isAvailable: boolean; // prereqs satisfied → can be reported now. false = locked.
  eventDate: string | null; // ISO (yyyy-mm-dd) if a real date was reported
  source: OnwardConfirmSource | null;
  confirmedByName: string | null;
  confirmedAt: string | null; // ISO
};

export type OnwardTrackerView = {
  exists: boolean;
  status: OnwardTrackerStatus | null;
  tenure: Tenure | null;
  purchaseType: PurchaseType | null;
  isShareOfFreehold: boolean;
  typeFactsSet: boolean; // both tenure + purchaseType present
  steps: OnwardStepView[]; // empty until typeFactsSet
  completeCount: number;
  applicableCount: number;
  surveySkipped: boolean; // seller opted out of the survey (mirrors the buyer skip)
};

// The survey pair a seller can opt out of, mirroring the buyer's manual skip
// (PM9 book survey cascades to PM10 survey report).
export const ONWARD_SURVEY_CODES = ["PM9", "PM10"] as const;

type PurchaserDef = {
  code: string;
  name: string;
  orderIndex: number;
  blocksExchange: boolean;
  eventDateRequired: boolean;
};

// A prereq is satisfied for the tracker if: it's a confirmed in-scope step, it's
// auto-not-required for this tracker's type facts, OR it's an out-of-scope code
// (the other milestone side). The tracker only holds ONE side, so the tracked
// sale's other-side steps (e.g. onward VM9 gating PM12, or a related sale's PM
// steps) are outside our scope and treated as satisfied.
function makeIsSatisfied(confirmed: Set<string>, autoNr: Set<string>, prefix: string) {
  return (prereqCode: string): boolean => {
    if (!prereqCode.startsWith(prefix)) return true;
    if (autoNr.has(prereqCode)) return true;
    return confirmed.has(prereqCode);
  };
}

// Pure availability computation over the reported-complete set. Exported for
// unit-testing and for Stage 3's claim-time pre-fill mapping.
export function computeOnwardStepAvailability(
  defs: PurchaserDef[],
  autoNr: Set<string>,
  confirmed: Set<string>,
  dir: Direction = DIRECTION.onward_purchase,
): Map<string, boolean> {
  const applicable = defs.filter((d) => !autoNr.has(d.code));
  const isComplete = (code: string) => confirmed.has(code);
  const isSatisfied = makeIsSatisfied(confirmed, autoNr, dir.prefix);
  const gateBlockers = applicable.filter(
    (d) => d.blocksExchange && d.code !== dir.gateCode,
  );

  const out = new Map<string, boolean>();
  for (const d of applicable) {
    if (isComplete(d.code)) {
      out.set(d.code, true);
      continue;
    }
    if (d.code === dir.gateCode) {
      out.set(d.code, gateBlockers.every((b) => isComplete(b.code)));
      continue;
    }
    const prereqs = DIRECT_PREREQUISITES[d.code] ?? [];
    out.set(d.code, prereqs.every(isSatisfied));
  }
  return out;
}

async function loadDefs(side: MilestoneSide): Promise<PurchaserDef[]> {
  const defs = await prisma.milestoneDefinition.findMany({
    where: { side },
    orderBy: { orderIndex: "asc" },
    select: { code: true, name: true, orderIndex: true, blocksExchange: true, eventDateRequired: true },
  });
  return defs.filter((d) => !RETIRED_ENQUIRY_CODES.has(d.code));
}

const toISODate = (d: Date | null): string | null =>
  d ? d.toISOString().slice(0, 10) : null;

/**
 * Build the full onward-tracker view for a transaction. Returns `exists: false`
 * when no tracker has been opened. Caller must have already scope-checked the tx.
 */
export async function getOnwardTrackerView(
  transactionId: string,
  kind: OnwardTrackerKind = "onward_purchase",
): Promise<OnwardTrackerView> {
  const dir = DIRECTION[kind];
  const surveyOptOut = (codes: string[]) =>
    dir.surveyCodes.length > 0 && codes.includes(dir.surveyCodes[0]);
  const tracker = await prisma.onwardTracker.findUnique({
    where: { transactionId_kind: { transactionId, kind } },
    include: { steps: true },
  });

  if (!tracker) {
    return {
      exists: false,
      status: null,
      tenure: null,
      purchaseType: null,
      isShareOfFreehold: false,
      typeFactsSet: false,
      steps: [],
      completeCount: 0,
      applicableCount: 0,
      surveySkipped: false,
    };
  }

  const typeFactsSet =
    tracker.tenure != null && (!dir.requiresPurchaseType || tracker.purchaseType != null);

  if (!typeFactsSet) {
    return {
      exists: true,
      status: tracker.status,
      tenure: tracker.tenure,
      purchaseType: tracker.purchaseType,
      isShareOfFreehold: tracker.isShareOfFreehold,
      typeFactsSet: false,
      steps: [],
      completeCount: 0,
      applicableCount: 0,
      surveySkipped: surveyOptOut(tracker.manualNrCodes),
    };
  }

  const defs = await loadDefs(dir.side);
  // Auto-not-required (from tenure + how they're buying) plus anything the
  // seller manually opted out of (e.g. the survey).
  const autoNr = new Set<string>([
    ...computeAutoNrCodes(tracker.purchaseType, tracker.tenure),
    ...tracker.manualNrCodes,
  ]);
  const confirmedByCode = new Map(tracker.steps.map((s) => [s.milestoneCode, s]));
  const confirmedSet = new Set(confirmedByCode.keys());
  const availability = computeOnwardStepAvailability(defs, autoNr, confirmedSet, dir);

  // Resolve confirmer display names (agent = User.name, seller = Contact.name).
  const userIds = [...new Set(tracker.steps.map((s) => s.confirmedByUserId).filter(Boolean) as string[])];
  const contactIds = [...new Set(tracker.steps.map((s) => s.confirmedByContactId).filter(Boolean) as string[])];
  const [users, contacts] = await Promise.all([
    userIds.length ? prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } }) : Promise.resolve([]),
    contactIds.length ? prisma.contact.findMany({ where: { id: { in: contactIds } }, select: { id: true, name: true } }) : Promise.resolve([]),
  ]);
  const userName = new Map(users.map((u) => [u.id, u.name]));
  const contactName = new Map(contacts.map((c) => [c.id, c.name]));

  const applicable = defs.filter((d) => !autoNr.has(d.code));
  const steps: OnwardStepView[] = applicable.map((d) => {
    const row = confirmedByCode.get(d.code) ?? null;
    return {
      code: d.code,
      name: d.name,
      eventDateRequired: d.eventDateRequired,
      isComplete: row != null,
      isAvailable: availability.get(d.code) ?? false,
      eventDate: row ? toISODate(row.eventDate) : null,
      source: row?.source ?? null,
      confirmedByName: row
        ? row.source === "agent"
          ? userName.get(row.confirmedByUserId ?? "") ?? null
          : contactName.get(row.confirmedByContactId ?? "") ?? null
        : null,
      confirmedAt: row ? row.confirmedAt.toISOString() : null,
    };
  });

  return {
    exists: true,
    status: tracker.status,
    tenure: tracker.tenure,
    purchaseType: tracker.purchaseType,
    isShareOfFreehold: tracker.isShareOfFreehold,
    typeFactsSet: true,
    steps,
    completeCount: steps.filter((s) => s.isComplete).length,
    applicableCount: steps.length,
    surveySkipped: surveyOptOut(tracker.manualNrCodes),
  };
}

/**
 * Toggle the seller's survey opt-out on their onward tracker. Mirrors the
 * buyer's manual survey skip: marks the survey pair (PM9 + PM10) not-required
 * and clears any confirmations for them; passing skipped=false restores them.
 */
export async function setOnwardSurveySkipped(
  transactionId: string,
  skipped: boolean,
  kind: OnwardTrackerKind = "onward_purchase",
): Promise<void> {
  const dir = DIRECTION[kind];
  if (dir.surveyCodes.length === 0) return; // a related sale has no survey step
  const tracker = await prisma.onwardTracker.findUnique({
    where: { transactionId_kind: { transactionId, kind } },
    select: { id: true, status: true, manualNrCodes: true },
  });
  if (!tracker || tracker.status === "superseded") return;
  const set = new Set(tracker.manualNrCodes);
  for (const c of dir.surveyCodes) { if (skipped) set.add(c); else set.delete(c); }
  await prisma.onwardTracker.update({ where: { id: tracker.id }, data: { manualNrCodes: [...set] } });
  if (skipped) {
    await prisma.onwardStepConfirmation.deleteMany({
      where: { trackerId: tracker.id, milestoneCode: { in: [...dir.surveyCodes] } },
    });
  }
}

// ── Stage 4: lifecycle (manual) ──────────────────────────────────────────────

/**
 * "I'm no longer buying onward." Retire the tracker but keep its data, so an
 * accidental tap can be undone with reactivate. Never touches a superseded
 * tracker (the agent above already claimed).
 */
export async function abandonOnwardTracker(
  transactionId: string,
  kind: OnwardTrackerKind = "onward_purchase",
): Promise<void> {
  await prisma.onwardTracker.updateMany({
    where: { transactionId, kind, status: { notIn: ["superseded"] } },
    data: { status: "abandoned" },
  });
}

/** Undo an abandon — back to where they were, data intact. */
export async function reactivateOnwardTracker(
  transactionId: string,
  kind: OnwardTrackerKind = "onward_purchase",
): Promise<void> {
  await prisma.onwardTracker.updateMany({
    where: { transactionId, kind, status: "abandoned" },
    data: { status: "active" },
  });
}

/**
 * "My onward has changed to a different place." Wipe the reported steps AND the
 * two type facts, so the seller re-confirms from scratch against the new
 * property. Keeps the tracker (active) so the panel drops back to setup.
 */
export async function resetOnwardTracker(
  transactionId: string,
  kind: OnwardTrackerKind = "onward_purchase",
): Promise<void> {
  const tracker = await prisma.onwardTracker.findUnique({
    where: { transactionId_kind: { transactionId, kind } },
    select: { id: true, status: true },
  });
  if (!tracker || tracker.status === "superseded") return;
  await prisma.onwardStepConfirmation.deleteMany({ where: { trackerId: tracker.id } });
  await prisma.onwardTracker.update({
    where: { id: tracker.id },
    data: { tenure: null, purchaseType: null, isShareOfFreehold: false, status: "active" },
  });
}

/**
 * Nudge signal (Stage 4 follow-up): is this file's seller buying onward, and if
 * so what's the property? True when a chain link exists above them (we know the
 * property) OR they've answered "yes, buying onward" in their portal. Used to
 * turn the agent-side onward card from a passive "if they're buying onward" into
 * a definitive "this seller is buying onward, set it up" prompt.
 */
export async function getOnwardSignalForFile(
  transactionId: string,
): Promise<{ buyingOnward: boolean; onwardAddress: string | null }> {
  const tx = await prisma.propertyTransaction.findUnique({
    where: { id: transactionId },
    select: { chainLinkId: true },
  });

  let hasChainAbove = false;
  let onwardAddress: string | null = null;
  if (tx?.chainLinkId) {
    const link = await prisma.chainLink.findUnique({
      where: { id: tx.chainLinkId },
      select: { position: true, chainId: true },
    });
    if (link) {
      const above = await prisma.chainLink.findFirst({
        where: { chainId: link.chainId, position: link.position - 1 },
        select: { stubPropertyAddress: true, transaction: { select: { propertyAddress: true } } },
      });
      if (above) {
        hasChainAbove = true;
        onwardAddress = above.transaction?.propertyAddress ?? above.stubPropertyAddress ?? null;
      }
    }
  }

  const info = await prisma.clientMoveInfo.findUnique({
    where: { transactionId_side: { transactionId, side: "vendor" } },
    select: { buyingOnward: true },
  });

  return { buyingOnward: hasChainAbove || info?.buyingOnward === true, onwardAddress };
}

/** Create an empty tracker (status active) if one doesn't already exist. */
export async function openOnwardTracker(
  transactionId: string,
  kind: OnwardTrackerKind = "onward_purchase",
): Promise<void> {
  await prisma.onwardTracker.upsert({
    where: { transactionId_kind: { transactionId, kind } },
    create: { transactionId, kind },
    update: {},
  });
}

/**
 * Set/replace the two type facts. Creates the tracker if needed. When the facts
 * change so that a previously-applicable step is now auto-not-required (e.g.
 * mortgage → cash drops PM5/PM6/PM11), prune those confirmations so the reported
 * progress stays consistent with the new shape (mirrors the real edit-sale
 * cascade).
 */
export async function setOnwardTypeFacts(
  transactionId: string,
  // A related SALE has no buying axis, so purchaseType is optional (stored null).
  facts: { tenure: Tenure; purchaseType?: PurchaseType | null; isShareOfFreehold: boolean },
  kind: OnwardTrackerKind = "onward_purchase",
): Promise<void> {
  const data = {
    tenure: facts.tenure,
    purchaseType: facts.purchaseType ?? null,
    isShareOfFreehold: facts.isShareOfFreehold,
  };
  const tracker = await prisma.onwardTracker.upsert({
    where: { transactionId_kind: { transactionId, kind } },
    create: { transactionId, kind, ...data },
    update: { ...data },
    include: { steps: true },
  });

  const nowNr = computeAutoNrCodes(data.purchaseType, data.tenure);
  const strandedCodes = tracker.steps.filter((s) => nowNr.has(s.milestoneCode)).map((s) => s.milestoneCode);
  if (strandedCodes.length) {
    await prisma.onwardStepConfirmation.deleteMany({
      where: { trackerId: tracker.id, milestoneCode: { in: strandedCodes } },
    });
  }
}

export type ConfirmOnwardResult =
  | { ok: true }
  | {
      ok: false;
      reason:
        | "no_tracker"
        | "type_facts_missing"
        | "not_applicable"
        | "locked"
        | "already_done"
        | "awaiting_our_completion" // onward can't complete before OUR sale completes (3a)
        | "retired"; // tracker superseded (agent above now owns it) or abandoned
    };

/**
 * Report an onward step complete. Enforces the same ordering the real engine
 * would: a step can only be reported once its prerequisites are satisfied.
 */
export async function confirmOnwardStep(
  transactionId: string,
  milestoneCode: string,
  eventDate: string | null,
  confirmer: { source: "agent"; userId: string } | { source: "seller" | "buyer"; contactId: string },
  kind: OnwardTrackerKind = "onward_purchase",
): Promise<ConfirmOnwardResult> {
  const dir = DIRECTION[kind];
  const tracker = await prisma.onwardTracker.findUnique({
    where: { transactionId_kind: { transactionId, kind } },
    include: { steps: true },
  });
  if (!tracker) return { ok: false, reason: "no_tracker" };
  // A superseded tracker (the agent above now owns the onward) or an abandoned
  // one (the client said they're no longer buying/selling) accepts no more
  // updates — and must never have its status overwritten by a reported step.
  if (tracker.status === "superseded" || tracker.status === "abandoned") return { ok: false, reason: "retired" };
  if (tracker.tenure == null || (dir.requiresPurchaseType && tracker.purchaseType == null)) {
    return { ok: false, reason: "type_facts_missing" };
  }

  const defs = await loadDefs(dir.side);
  const autoNr = new Set<string>([
    ...computeAutoNrCodes(tracker.purchaseType, tracker.tenure),
    ...tracker.manualNrCodes,
  ]);
  if (autoNr.has(milestoneCode) || !defs.some((d) => d.code === milestoneCode)) {
    return { ok: false, reason: "not_applicable" };
  }
  const confirmedSet = new Set(tracker.steps.map((s) => s.milestoneCode));
  if (confirmedSet.has(milestoneCode)) return { ok: false, reason: "already_done" };

  const availability = computeOnwardStepAvailability(defs, autoNr, confirmedSet, dir);
  if (!availability.get(milestoneCode)) return { ok: false, reason: "locked" };

  // Completion gate (3a): only the onward purchase is gated — it can't complete
  // before OUR sale completes, because completion funds flow up the chain. A
  // related sale (Option A) has no gate: it completes before/with our purchase.
  if (dir.completionGateOurCode && milestoneCode === dir.completionCode) {
    const ourCompletion = await prisma.milestoneCompletion.findFirst({
      where: { transactionId, state: "complete", milestoneDefinition: { code: dir.completionGateOurCode } },
      select: { id: true },
    });
    if (!ourCompletion) return { ok: false, reason: "awaiting_our_completion" };
  }

  const eventDateObj = eventDate ? new Date(eventDate) : null;
  await prisma.onwardStepConfirmation.create({
    data: {
      trackerId: tracker.id,
      milestoneCode,
      eventDate: eventDateObj,
      source: confirmer.source,
      confirmedByUserId: confirmer.source === "agent" ? confirmer.userId : null,
      confirmedByContactId: confirmer.source === "agent" ? null : confirmer.contactId,
    },
  });

  // Reported exchange / completion move the tracker's own status along.
  if (milestoneCode === dir.exchangeCode) {
    await prisma.onwardTracker.update({ where: { id: tracker.id }, data: { status: "exchanged" } });
  } else if (milestoneCode === dir.completionCode) {
    await prisma.onwardTracker.update({ where: { id: tracker.id }, data: { status: "completed" } });
  }

  return { ok: true };
}

export type UndoOnwardResult =
  | { ok: true }
  | { ok: false; reason: "not_found" | "has_dependents" | "retired"; blockingCode?: string };

/**
 * Undo a reported step. Blocked if a later reported step directly depends on it
 * (undo the dependent first) — keeps the reported chain internally consistent,
 * the same guard the real undo applies.
 */
export async function undoOnwardStep(
  transactionId: string,
  milestoneCode: string,
  kind: OnwardTrackerKind = "onward_purchase",
): Promise<UndoOnwardResult> {
  const dir = DIRECTION[kind];
  const tracker = await prisma.onwardTracker.findUnique({
    where: { transactionId_kind: { transactionId, kind } },
    include: { steps: true },
  });
  if (!tracker) return { ok: false, reason: "not_found" };
  if (tracker.status === "superseded" || tracker.status === "abandoned") return { ok: false, reason: "retired" };
  const row = tracker.steps.find((s) => s.milestoneCode === milestoneCode);
  if (!row) return { ok: false, reason: "not_found" };

  const confirmedSet = new Set(tracker.steps.map((s) => s.milestoneCode));
  const blocker = [...confirmedSet].find((c) => (DIRECT_PREREQUISITES[c] ?? []).includes(milestoneCode));
  if (blocker) return { ok: false, reason: "has_dependents", blockingCode: blocker };

  await prisma.onwardStepConfirmation.delete({ where: { id: row.id } });

  // Roll the tracker status back if we removed the exchange/completion marker.
  if (milestoneCode === dir.completionCode && tracker.status === "completed") {
    await prisma.onwardTracker.update({ where: { id: tracker.id }, data: { status: "exchanged" } });
  } else if (milestoneCode === dir.exchangeCode && tracker.status === "exchanged") {
    await prisma.onwardTracker.update({ where: { id: tracker.id }, data: { status: "active" } });
  }

  return { ok: true };
}

// ── Stage 3: inheritance on claim ────────────────────────────────────────────
//
// When the agent handling a seller's onward purchase claims the chain link
// ABOVE that seller, the seller's reported onward tracker becomes the head-start
// for the claiming agent's reconciliation-on-claim wizard. The seller-below a
// claimed link at position X sits at position X+1 (higher position = down the
// chain); their file's onwardTracker describes the very property being claimed.
// The tracker holds PURCHASER-side steps (the seller acting as buyer), which map
// onto the claiming agent's PURCHASER side (their buyer IS our seller).

export type OnwardInheritance = {
  tenure: Tenure | null;
  purchaseType: PurchaseType | null;
  isShareOfFreehold: boolean;
  stepCodes: string[]; // purchaser-side MilestoneDefinition codes reported complete
};

async function sellerBelowTransactionId(claimedLinkId: string): Promise<string | null> {
  const link = await prisma.chainLink.findUnique({
    where: { id: claimedLinkId },
    select: { position: true, chainId: true },
  });
  if (!link) return null;
  const below = await prisma.chainLink.findFirst({
    where: { chainId: link.chainId, position: link.position + 1 },
    select: { transactionId: true },
  });
  return below?.transactionId ?? null;
}

/**
 * Pre-fill data for the reconciliation wizard when claiming `claimedLinkId`:
 * the seller-below's reported onward progress. Null when there's no seller
 * below, no tracker, or the tracker is already retired.
 */
export async function getOnwardInheritanceForLink(claimedLinkId: string): Promise<OnwardInheritance | null> {
  const txId = await sellerBelowTransactionId(claimedLinkId);
  if (!txId) return null;
  const tracker = await prisma.onwardTracker.findUnique({
    where: { transactionId_kind: { transactionId: txId, kind: "onward_purchase" } },
    include: { steps: true },
  });
  if (!tracker) return null;
  if (tracker.status === "superseded" || tracker.status === "abandoned") return null;
  return {
    tenure: tracker.tenure,
    purchaseType: tracker.purchaseType,
    isShareOfFreehold: tracker.isShareOfFreehold,
    stepCodes: tracker.steps.map((s) => s.milestoneCode),
  };
}

/**
 * Auto-retire (Stage 4 follow-up): when a chain link is withdrawn, the seller
 * directly below it was buying that property as their onward, so their onward
 * tracker is retired (abandoned) automatically. Called from the chain
 * withdrawal cascade. Reuses the manual-abandon path, so the seller sees the
 * same retired state (with "Start again"). No-op when there's no seller below
 * or no tracker.
 */
export async function retireOnwardTrackerForWithdrawnLink(withdrawnLinkId: string): Promise<void> {
  const txId = await sellerBelowTransactionId(withdrawnLinkId);
  if (!txId) return;
  await abandonOnwardTracker(txId);
}

/**
 * Retire the seller-below's onward tracker once the agent above has claimed:
 * their real file now owns the truth, so the reported stand-in is superseded.
 */
export async function supersedeOnwardTrackerForLink(claimedLinkId: string): Promise<void> {
  const txId = await sellerBelowTransactionId(claimedLinkId);
  if (!txId) return;
  await prisma.onwardTracker.updateMany({
    where: { transactionId: txId, kind: "onward_purchase", status: { notIn: ["superseded", "abandoned"] } },
    data: { status: "superseded" },
  });
}

/**
 * Cascade (3a): our own sale exchanging (VM19) means the whole chain exchanged
 * on the same day, so the seller's onward purchase has exchanged too. If a
 * tracker exists (and isn't retired), mark the onward "exchanged" step (PM26)
 * reported and move the tracker to `exchanged`. Called fire-and-forget from
 * completeMilestone when VM19 completes.
 *
 * This bypasses the normal prereq gate on purpose: exchange is authoritative
 * regardless of which intermediate steps happened to be individually reported.
 * Source is `agent` — it's derived from our own agent-confirmed exchange, not a
 * seller report. Never fabricates a tracker; a no-op when none exists.
 */
/**
 * Mortgage-offer shortcut (Stage 2 v2): true when the onward is a mortgage
 * purchase and the "solicitor has your mortgage offer" step (PM11) isn't yet
 * reported. Used to prompt the seller after they enter their onward mortgage
 * offer expiry date, since entering an expiry effectively tells us the offer
 * exists.
 */
export async function onwardMortgageNeedsConfirm(transactionId: string): Promise<boolean> {
  const tracker = await prisma.onwardTracker.findUnique({
    where: { transactionId_kind: { transactionId, kind: "onward_purchase" } },
    select: { purchaseType: true, steps: { where: { milestoneCode: "PM11" }, select: { id: true } } },
  });
  if (!tracker || tracker.purchaseType !== "mortgage") return false;
  return tracker.steps.length === 0;
}

/**
 * Confirm the onward mortgage offer is in place: back-fills the three mortgage
 * steps (applied PM5 → valuation PM6 → offer received PM11) that any of aren't
 * already reported. Bypasses the per-step gate — "offer in place" implies all
 * three — mirroring the exchange cascade's authoritative back-fill.
 */
export async function backfillOnwardMortgageOffer(
  transactionId: string,
  confirmer: { source: "agent"; userId: string } | { source: "seller"; contactId: string },
): Promise<void> {
  const tracker = await prisma.onwardTracker.findUnique({
    where: { transactionId_kind: { transactionId, kind: "onward_purchase" } },
    select: { id: true, purchaseType: true, steps: { select: { milestoneCode: true } } },
  });
  if (!tracker || tracker.purchaseType !== "mortgage") return;
  const done = new Set(tracker.steps.map((s) => s.milestoneCode));
  const codes = ["PM5", "PM6", "PM11"].filter((c) => !done.has(c));
  for (const code of codes) {
    await prisma.onwardStepConfirmation.create({
      data: {
        trackerId: tracker.id,
        milestoneCode: code,
        source: confirmer.source,
        confirmedByUserId: confirmer.source === "agent" ? confirmer.userId : null,
        confirmedByContactId: confirmer.source === "seller" ? confirmer.contactId : null,
      },
    });
  }
}

export async function cascadeOnwardExchange(
  transactionId: string,
  kind: OnwardTrackerKind = "onward_purchase",
): Promise<void> {
  const dir = DIRECTION[kind];
  const tracker = await prisma.onwardTracker.findUnique({
    where: { transactionId_kind: { transactionId, kind } },
    select: {
      id: true,
      status: true,
      steps: { where: { milestoneCode: dir.exchangeCode }, select: { id: true } },
    },
  });
  if (!tracker) return;
  if (tracker.status === "superseded" || tracker.status === "abandoned") return;

  if (tracker.steps.length === 0) {
    await prisma.onwardStepConfirmation.create({
      data: { trackerId: tracker.id, milestoneCode: dir.exchangeCode, source: "agent" },
    });
  }
  if (tracker.status !== "completed") {
    await prisma.onwardTracker.update({ where: { id: tracker.id }, data: { status: "exchanged" } });
  }
}
