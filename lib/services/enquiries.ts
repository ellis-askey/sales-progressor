// Enquiries triage — the cross-file read behind the "Enquiries" page.
//
// Lists every open enquiry loop (EnquiryTracker.closedAt == null) so the team
// can blitz-confirm whose court each is in, all in one place, instead of opening
// each file. Scoped through the Law-7 access helper: internal staff (all /
// assigned) see the OUTSOURCED files they progress; agency users (when this
// graduates to them) see their own self-managed files — the serviceType split
// mirrors the hub / work-queue.
//
// Spec: docs/active/enquiries-triage/00-spec.md.

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import type { AccessScope } from "@/lib/security/access-scope";
import { scopeTransactionWhere } from "@/lib/security/access-scope";
import type { EnquiryCourt, EnquiryTrackerStatus } from "@/lib/enquiries/tracker";

export type OpenEnquiryRow = {
  transactionId: string;
  address: string;
  photoStoragePath: string | null;
  currentlyWith: EnquiryCourt;
  status: EnquiryTrackerStatus; // "chasing" | "snoozed" | "stalled" (never "closed")
  quietSince: Date; // lastMovementAt ?? openedAt — where the silence is measured from
  quietDays: number;
  chaseCount: number;
  outstandingNote: string | null;
  snoozedUntil: Date | null;
};

// Where-clause for the transactions in scope: active, non-demo, and on the
// service tier this viewer progresses. Internal (all/assigned) → outsourced;
// agency → self-managed (for when the page graduates to agents).
function enquiryTxWhere(scope: AccessScope): Prisma.PropertyTransactionWhereInput {
  const serviceType: Prisma.PropertyTransactionWhereInput =
    scope.kind === "agency" ? { serviceType: { not: "outsourced" } } : { serviceType: "outsourced" };
  return { ...scopeTransactionWhere(scope), status: "active", isDemo: false, ...serviceType };
}

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
      snoozedUntil: true,
      escalatedAt: true,
      chaseCount: true,
      transaction: { select: { id: true, propertyAddress: true, photoStoragePath: true } },
    },
  });

  const now = new Date();
  const rows: OpenEnquiryRow[] = trackers.map((t) => {
    const quietSince = t.lastMovementAt ?? t.openedAt;
    const snoozed = !!(t.snoozedUntil && t.snoozedUntil > now);
    const status: EnquiryTrackerStatus = snoozed ? "snoozed" : t.escalatedAt ? "stalled" : "chasing";
    return {
      transactionId: t.transaction.id,
      address: t.transaction.propertyAddress,
      photoStoragePath: t.transaction.photoStoragePath,
      currentlyWith: t.currentlyWith as EnquiryCourt,
      status,
      quietSince,
      quietDays: Math.max(0, Math.floor((now.getTime() - quietSince.getTime()) / 86400000)),
      chaseCount: t.chaseCount,
      outstandingNote: t.outstandingNote,
      snoozedUntil: t.snoozedUntil,
    };
  });

  // Worst-first: active loops before snoozed ones, then longest-quiet first —
  // the ones going cold rise to the top.
  const rank = (s: EnquiryTrackerStatus) => (s === "snoozed" ? 1 : 0);
  rows.sort((a, b) => rank(a.status) - rank(b.status) || b.quietDays - a.quietDays);
  return rows;
}
