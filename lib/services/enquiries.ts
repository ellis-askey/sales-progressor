// Enquiries triage — the cross-file reads behind the "Enquiries" page.
//
// Lists every open enquiry loop (EnquiryTracker.closedAt == null) so the team
// can blitz-confirm whose court each is in, all in one place. Scoped through the
// Law-7 access helper: internal staff (all / assigned) see the OUTSOURCED files
// they progress; agency users (when this graduates to them) see their own
// self-managed files — the serviceType split mirrors the hub / work-queue.
//
// Spec: docs/active/enquiries-triage/00-spec.md.

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import type { AccessScope } from "@/lib/security/access-scope";
import { scopeTransactionWhere, scopeOwnershipWhere } from "@/lib/security/access-scope";
import { addWorkingDays } from "@/lib/emails/working-hours";
import { ENQUIRY_CHASE_WORKING_DAYS as CHASE_WORKING_DAYS, ENQUIRY_ESCALATE_WORKING_DAYS as ESCALATE_WORKING_DAYS } from "@/lib/enquiries/cadence";
import type { EnquiryCourt, EnquiryTrackerStatus, EnquiryMovementKind } from "@/lib/enquiries/tracker";

export type OpenEnquiryRow = {
  transactionId: string;
  address: string;
  photoStoragePath: string | null;
  price: number | null; // purchasePrice in pence
  tenure: string | null; // "freehold" | "leasehold" | ... (qualifier)
  currentlyWith: EnquiryCourt;
  status: EnquiryTrackerStatus; // "chasing" | "snoozed" | "stalled" (never "closed")
  quietSince: Date; // lastMovementAt ?? openedAt — where the silence is measured from
  quietDays: number;
  chaseCount: number;
  outstandingNote: string | null;
  expectedDate: Date | null; // the "expect replies by" date (reuses snoozedUntil)
  nextChaseAt: Date | null; // when the auto-chase is next due
  // Two-stage silence countdown for the track fill (progress 0..1 within stage):
  //   chase     — coral, 0 → 7 working days since last movement (full = chase)
  //   escalate  — red,   7 → 13 working days (full = escalated)
  //   escalated — red, held full
  //   hold      — blue, counting toward an expected date (paused chase)
  chaseBar: { stage: "chase" | "escalate" | "escalated" | "hold"; progress: number };
  openedAt: Date; // when the loop was raised
  partial: boolean; // some (not all) replies are in; ball still with the seller's solicitor
  lastMovement: { note: string; kind: EnquiryMovementKind; occurredAt: Date; byName: string | null } | null;
  clientNames: string; // for search
  vendorSolicitor: string | null;
  purchaserSolicitor: string | null;
};

// Timeline entry for the expanded row's chase history.
export type EnquiryHistoryEntry = {
  id: string;
  at: Date;
  label: string;
  detail: string | null;
  by: string | null;
  tone: "raised" | "reply" | "chase" | "update";
  // Set on chase-email rows only → the outboundMessage id, so the timeline can
  // open a true-to-inbox preview of exactly what was sent. Null on phone chases
  // and movement rows (nothing to preview).
  messageId: string | null;
};

function enquiryTxWhere(scope: AccessScope): Prisma.PropertyTransactionWhereInput {
  const serviceType: Prisma.PropertyTransactionWhereInput =
    scope.kind === "agency" ? { serviceType: { not: "outsourced" } } : { serviceType: "outsourced" };
  return { ...scopeTransactionWhere(scope), status: "active", isDemo: false, ...serviceType };
}

const solicitorName = (
  firm: { name: string } | null,
  contact: { name: string | null } | null,
): string | null => firm?.name ?? contact?.name ?? null;

export async function countOpenEnquiries(scope: AccessScope): Promise<number> {
  return prisma.enquiryTracker.count({
    where: { closedAt: null, transaction: enquiryTxWhere(scope) },
  });
}

export async function getOpenEnquiries(scope: AccessScope): Promise<OpenEnquiryRow[]> {
  const trackers = await prisma.enquiryTracker.findMany({
    where: { closedAt: null, transaction: enquiryTxWhere(scope) },
    select: {
      currentlyWith: true,
      outstandingNote: true,
      openedAt: true,
      lastMovementAt: true,
      lastChasedAt: true,
      snoozedUntil: true,
      escalatedAt: true,
      chaseCount: true,
      partialRepliesAt: true,
      transaction: {
        select: {
          id: true,
          propertyAddress: true,
          photoStoragePath: true,
          purchasePrice: true,
          tenure: true,
          contacts: { select: { name: true, roleType: true } },
          vendorSolicitorFirm: { select: { name: true } },
          vendorSolicitorContact: { select: { name: true } },
          purchaserSolicitorFirm: { select: { name: true } },
          purchaserSolicitorContact: { select: { name: true } },
        },
      },
      movements: {
        where: { status: "accepted" },
        orderBy: { occurredAt: "desc" },
        take: 1,
        select: { note: true, kind: true, occurredAt: true, createdByUserId: true },
      },
    },
  });

  // Resolve the "last update" author names in one batch.
  const userIds = [...new Set(trackers.map((t) => t.movements[0]?.createdByUserId).filter((id): id is string => !!id))];
  const users = userIds.length
    ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } })
    : [];
  const nameById = new Map(users.map((u) => [u.id, u.name]));

  const now = new Date();
  const rows: OpenEnquiryRow[] = trackers.map((t) => {
    const quietSince = t.lastMovementAt ?? t.openedAt;
    const snoozed = !!(t.snoozedUntil && t.snoozedUntil > now);
    const status: EnquiryTrackerStatus = snoozed ? "snoozed" : t.escalatedAt ? "stalled" : "chasing";
    const nextChaseAt = snoozed
      ? null
      : t.lastChasedAt
        ? addWorkingDays(t.lastChasedAt, CHASE_WORKING_DAYS)
        : addWorkingDays(quietSince, CHASE_WORKING_DAYS);

    // Two-stage silence countdown, anchored on the last movement (the silence
    // clock the chase engine uses). Coral fills 0 → 7 working days (chase), then
    // red fills 7 → 13 (escalate). An expected date shows a blue "hold" fill
    // toward that date instead. See enquiryChaseDecision.
    const barFrac = (from: Date, to: Date): number => {
      const span = to.getTime() - from.getTime();
      return span > 0 ? Math.max(0, Math.min(1, (now.getTime() - from.getTime()) / span)) : 1;
    };
    const chaseDueAt = addWorkingDays(quietSince, CHASE_WORKING_DAYS);
    const escalateAt = addWorkingDays(quietSince, ESCALATE_WORKING_DAYS);
    const chaseBar: OpenEnquiryRow["chaseBar"] =
      t.escalatedAt
        ? { stage: "escalated", progress: 1 }
        : snoozed && t.snoozedUntil
          ? { stage: "hold", progress: barFrac(quietSince, t.snoozedUntil) }
          : now < chaseDueAt
            ? { stage: "chase", progress: barFrac(quietSince, chaseDueAt) }
            : now < escalateAt
              ? { stage: "escalate", progress: barFrac(chaseDueAt, escalateAt) }
              : { stage: "escalated", progress: 1 };
    const mv = t.movements[0] ?? null;
    const tx = t.transaction;
    return {
      transactionId: tx.id,
      address: tx.propertyAddress,
      photoStoragePath: tx.photoStoragePath,
      price: tx.purchasePrice ?? null,
      tenure: tx.tenure ?? null,
      currentlyWith: t.currentlyWith as EnquiryCourt,
      status,
      quietSince,
      quietDays: Math.max(0, Math.floor((now.getTime() - quietSince.getTime()) / 86400000)),
      chaseCount: t.chaseCount,
      outstandingNote: t.outstandingNote,
      expectedDate: t.snoozedUntil ?? null,
      nextChaseAt,
      chaseBar,
      openedAt: t.openedAt,
      partial: t.partialRepliesAt != null,
      lastMovement: mv
        ? { note: mv.note, kind: mv.kind as EnquiryMovementKind, occurredAt: mv.occurredAt, byName: mv.createdByUserId ? nameById.get(mv.createdByUserId) ?? null : null }
        : null,
      clientNames: tx.contacts
        .filter((c) => c.roleType === "vendor" || c.roleType === "purchaser")
        .map((c) => c.name)
        .filter((n): n is string => !!n)
        .join(", "),
      vendorSolicitor: solicitorName(tx.vendorSolicitorFirm, tx.vendorSolicitorContact),
      purchaserSolicitor: solicitorName(tx.purchaserSolicitorFirm, tx.purchaserSolicitorContact),
    };
  });

  // Worst-first: active loops before snoozed, then longest-quiet first.
  const rank = (s: EnquiryTrackerStatus) => (s === "snoozed" ? 1 : 0);
  rows.sort((a, b) => rank(a.status) - rank(b.status) || b.quietDays - a.quietDays);
  return rows;
}

// The chase-history timeline for one file's open loop — assembled from movements
// (with their kind), the chase emails already logged to the file, and the raise
// event. Scoped: verifies the file is in the caller's scope. Newest first.
export async function getEnquiryHistory(scope: AccessScope, transactionId: string): Promise<EnquiryHistoryEntry[]> {
  const tx = await prisma.propertyTransaction.findFirst({
    where: scopeOwnershipWhere(scope, transactionId),
    select: { id: true },
  });
  if (!tx) return [];

  const tracker = await prisma.enquiryTracker.findUnique({
    where: { transactionId },
    select: {
      openedAt: true,
      movements: {
        where: { status: "accepted" },
        orderBy: { occurredAt: "desc" },
        select: { id: true, note: true, kind: true, occurredAt: true, createdByUserId: true },
      },
    },
  });
  if (!tracker) return [];

  const chaseComms = await prisma.outboundMessage.findMany({
    where: { transactionId, purpose: "chase" },
    orderBy: { sentAt: "desc" },
    select: { id: true, sentAt: true, createdAt: true, recipientName: true, method: true },
    take: 30,
  });

  const userIds = [...new Set(tracker.movements.map((m) => m.createdByUserId).filter((id): id is string => !!id))];
  const users = userIds.length
    ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } })
    : [];
  const nameById = new Map(users.map((u) => [u.id, u.name]));

  const kindLabel: Record<EnquiryMovementKind, string> = {
    raised: "Enquiries raised",
    replies_sent: "Replies sent",
    replies_received: "Replies received",
    chased: "Chased",
    update: "Update",
    correction: "Whose-court corrected",
    partial_replies: "Some replies sent",
  };
  const kindTone = (k: EnquiryMovementKind): EnquiryHistoryEntry["tone"] =>
    k === "raised" ? "raised" : k === "chased" ? "chase" : k === "replies_sent" || k === "replies_received" || k === "partial_replies" ? "reply" : "update";

  const entries: EnquiryHistoryEntry[] = [];
  for (const m of tracker.movements) {
    const k = m.kind as EnquiryMovementKind;
    entries.push({
      id: `mv-${m.id}`,
      at: m.occurredAt,
      label: kindLabel[k],
      detail: m.note,
      by: m.createdByUserId ? nameById.get(m.createdByUserId) ?? null : null,
      tone: kindTone(k),
      messageId: null,
    });
  }
  for (const c of chaseComms) {
    const isEmail = c.method !== "phone";
    entries.push({
      id: `cm-${c.id}`,
      at: c.sentAt ?? c.createdAt,
      label: isEmail ? "Chase email sent" : "Chased by phone",
      detail: c.recipientName ? `To ${c.recipientName}` : null,
      by: null,
      tone: "chase",
      // Only email chases have a rendered message to open.
      messageId: isEmail ? c.id : null,
    });
  }
  // The raise event as the anchor at the bottom.
  entries.push({ id: "raised", at: tracker.openedAt, label: "Initial enquiries raised", detail: null, by: null, tone: "raised", messageId: null });

  entries.sort((a, b) => b.at.getTime() - a.at.getTime());
  return entries;
}
