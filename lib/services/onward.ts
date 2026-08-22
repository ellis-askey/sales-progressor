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
import type { Tenure, PurchaseType, OnwardConfirmSource, OnwardTrackerStatus } from "@prisma/client";

// The purchaser-side exchange gate. Starts locked and unlocks only when every
// applicable purchaser blocksExchange step is reported complete — mirrors
// EXCHANGE_GATE_CODES / maybeUnlockExchangeGate in lib/services/milestones.ts.
const EXCHANGE_GATE_PURCHASER = "PM25";

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
};

type PurchaserDef = {
  code: string;
  name: string;
  orderIndex: number;
  blocksExchange: boolean;
  eventDateRequired: boolean;
};

// A prereq is satisfied for the onward tracker if: it's a confirmed onward step,
// it's auto-not-required for this onward's type facts, OR it's a vendor-side (VM)
// code — the tracker only holds the purchaser side, so the onward's own vendor
// steps (e.g. VM9 gating PM12) are outside our scope and treated as satisfied.
function makeIsSatisfied(confirmed: Set<string>, autoNr: Set<string>) {
  return (prereqCode: string): boolean => {
    if (!prereqCode.startsWith("PM")) return true;
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
): Map<string, boolean> {
  const applicable = defs.filter((d) => !autoNr.has(d.code));
  const isComplete = (code: string) => confirmed.has(code);
  const isSatisfied = makeIsSatisfied(confirmed, autoNr);
  const gateBlockers = applicable.filter(
    (d) => d.blocksExchange && d.code !== EXCHANGE_GATE_PURCHASER,
  );

  const out = new Map<string, boolean>();
  for (const d of applicable) {
    if (isComplete(d.code)) {
      out.set(d.code, true);
      continue;
    }
    if (d.code === EXCHANGE_GATE_PURCHASER) {
      out.set(d.code, gateBlockers.every((b) => isComplete(b.code)));
      continue;
    }
    const prereqs = DIRECT_PREREQUISITES[d.code] ?? [];
    out.set(d.code, prereqs.every(isSatisfied));
  }
  return out;
}

async function loadPurchaserDefs(): Promise<PurchaserDef[]> {
  const defs = await prisma.milestoneDefinition.findMany({
    where: { side: "purchaser" },
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
export async function getOnwardTrackerView(transactionId: string): Promise<OnwardTrackerView> {
  const tracker = await prisma.onwardTracker.findUnique({
    where: { transactionId },
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
    };
  }

  const typeFactsSet = tracker.tenure != null && tracker.purchaseType != null;

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
    };
  }

  const defs = await loadPurchaserDefs();
  const autoNr = computeAutoNrCodes(tracker.purchaseType, tracker.tenure);
  const confirmedByCode = new Map(tracker.steps.map((s) => [s.milestoneCode, s]));
  const confirmedSet = new Set(confirmedByCode.keys());
  const availability = computeOnwardStepAvailability(defs, autoNr, confirmedSet);

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
  };
}

/** Create an empty tracker (status active) if one doesn't already exist. */
export async function openOnwardTracker(transactionId: string): Promise<void> {
  await prisma.onwardTracker.upsert({
    where: { transactionId },
    create: { transactionId },
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
  facts: { tenure: Tenure; purchaseType: PurchaseType; isShareOfFreehold: boolean },
): Promise<void> {
  const tracker = await prisma.onwardTracker.upsert({
    where: { transactionId },
    create: { transactionId, ...facts },
    update: { ...facts },
    include: { steps: true },
  });

  const nowNr = computeAutoNrCodes(facts.purchaseType, facts.tenure);
  const strandedCodes = tracker.steps.filter((s) => nowNr.has(s.milestoneCode)).map((s) => s.milestoneCode);
  if (strandedCodes.length) {
    await prisma.onwardStepConfirmation.deleteMany({
      where: { trackerId: tracker.id, milestoneCode: { in: strandedCodes } },
    });
  }
}

export type ConfirmOnwardResult =
  | { ok: true }
  | { ok: false; reason: "no_tracker" | "type_facts_missing" | "not_applicable" | "locked" | "already_done" };

/**
 * Report an onward step complete. Enforces the same ordering the real engine
 * would: a step can only be reported once its prerequisites are satisfied.
 */
export async function confirmOnwardStep(
  transactionId: string,
  milestoneCode: string,
  eventDate: string | null,
  confirmer: { source: "agent"; userId: string } | { source: "seller"; contactId: string },
): Promise<ConfirmOnwardResult> {
  const tracker = await prisma.onwardTracker.findUnique({
    where: { transactionId },
    include: { steps: true },
  });
  if (!tracker) return { ok: false, reason: "no_tracker" };
  if (tracker.tenure == null || tracker.purchaseType == null) return { ok: false, reason: "type_facts_missing" };

  const defs = await loadPurchaserDefs();
  const autoNr = computeAutoNrCodes(tracker.purchaseType, tracker.tenure);
  if (autoNr.has(milestoneCode) || !defs.some((d) => d.code === milestoneCode)) {
    return { ok: false, reason: "not_applicable" };
  }
  const confirmedSet = new Set(tracker.steps.map((s) => s.milestoneCode));
  if (confirmedSet.has(milestoneCode)) return { ok: false, reason: "already_done" };

  const availability = computeOnwardStepAvailability(defs, autoNr, confirmedSet);
  if (!availability.get(milestoneCode)) return { ok: false, reason: "locked" };

  const eventDateObj = eventDate ? new Date(eventDate) : null;
  await prisma.onwardStepConfirmation.create({
    data: {
      trackerId: tracker.id,
      milestoneCode,
      eventDate: eventDateObj,
      source: confirmer.source,
      confirmedByUserId: confirmer.source === "agent" ? confirmer.userId : null,
      confirmedByContactId: confirmer.source === "seller" ? confirmer.contactId : null,
    },
  });

  // Reported exchange / completion move the tracker's own status along.
  if (milestoneCode === "PM26") {
    await prisma.onwardTracker.update({ where: { id: tracker.id }, data: { status: "exchanged" } });
  } else if (milestoneCode === "PM27") {
    await prisma.onwardTracker.update({ where: { id: tracker.id }, data: { status: "completed" } });
  }

  return { ok: true };
}

export type UndoOnwardResult =
  | { ok: true }
  | { ok: false; reason: "not_found" | "has_dependents"; blockingCode?: string };

/**
 * Undo a reported step. Blocked if a later reported step directly depends on it
 * (undo the dependent first) — keeps the reported chain internally consistent,
 * the same guard the real undo applies.
 */
export async function undoOnwardStep(transactionId: string, milestoneCode: string): Promise<UndoOnwardResult> {
  const tracker = await prisma.onwardTracker.findUnique({
    where: { transactionId },
    include: { steps: true },
  });
  if (!tracker) return { ok: false, reason: "not_found" };
  const row = tracker.steps.find((s) => s.milestoneCode === milestoneCode);
  if (!row) return { ok: false, reason: "not_found" };

  const confirmedSet = new Set(tracker.steps.map((s) => s.milestoneCode));
  const blocker = [...confirmedSet].find((c) => (DIRECT_PREREQUISITES[c] ?? []).includes(milestoneCode));
  if (blocker) return { ok: false, reason: "has_dependents", blockingCode: blocker };

  await prisma.onwardStepConfirmation.delete({ where: { id: row.id } });

  // Roll the tracker status back if we removed the exchange/completion marker.
  if (milestoneCode === "PM27" && tracker.status === "completed") {
    await prisma.onwardTracker.update({ where: { id: tracker.id }, data: { status: "exchanged" } });
  } else if (milestoneCode === "PM26" && tracker.status === "exchanged") {
    await prisma.onwardTracker.update({ where: { id: tracker.id }, data: { status: "active" } });
  }

  return { ok: true };
}
