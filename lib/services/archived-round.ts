// Phase 1 commit 8 — read-only fetcher for an archived BuyerRound.
//
// Returns everything the archived-round drawer needs in one query
// budget: the round's metadata + its buyer-side details + its PM
// completions + the VM JSON snapshot + comms filtered to that round.
//
// Documents are deliberately NOT in the per-round shape. Per the
// locked spec + the MoS correction on record (2026-06-04): the
// archived-round view MUST NOT claim to show "that round's documents".
// MoS and admin uploads are unattributed by design (TransactionDocument
// buyerRoundId is NULL on every site except the portal upload).
// The drawer renders a file-level documents pane with the
// "shared across rounds" caveat instead.

import { prisma } from "@/lib/prisma";
import { allRoundsForAudit, milestoneScopeWhere } from "@/lib/services/milestone-scope";

export type ArchivedRoundData = {
  round: {
    id: string;
    roundNumber: number;
    status: string;
    archivedAt: Date | null;
    fallThroughReason: string | null;
    createdAt: Date;
    purchasePrice: number | null;
    purchaserSolicitorFirm: { id: string; name: string } | null;
    purchaserSolicitorContact: { id: string; name: string; phone: string | null; email: string | null } | null;
    brokerFirm: { id: string; name: string } | null;
    brokerContact: { id: string; name: string; phone: string | null; email: string | null } | null;
    vendorMilestoneSnapshot: VmSnapshotRow[] | null;
  };
  buyerContacts: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    roleType: string;
  }[];
  pmCompletions: {
    code: string;
    state: string;
    completedAt: Date | null;
    completedByName: string | null;
    eventDate: Date | null;
    summaryText: string | null;
    confirmedByPortal: boolean;
  }[];
  comms: {
    id: string;
    type: string;
    method: string | null;
    content: string;
    createdAt: Date;
    createdByName: string | null;
    visibleToClient: boolean;
  }[];
};

// Snapshot row shape — written by the relist action onto outgoing
// round.vendorMilestoneSnapshot. Keep in sync with the JSON shape in
// app/actions/transactions.ts → relistTransactionImpl.
export type VmSnapshotRow = {
  code: string;
  state: string;
  completedAt: string | null;
  completedById: string | null;
  eventDate: string | null;
  summaryText: string | null;
  reconciledAtExchange: boolean;
};

// `transactionId` is taken in so the caller (an authenticated page
// route) can pre-check scope ownership before the fetch is wired in;
// this function does NOT enforce ownership itself.
export async function getArchivedRoundData(
  transactionId: string,
  roundId: string,
): Promise<ArchivedRoundData | null> {
  // BuyerRound only stores FK ids for its solicitor / broker; the
  // referenced rows are fetched separately. Two-step is needed because
  // BuyerRound has no direct Prisma relation to those tables.
  const round = await prisma.buyerRound.findFirst({
    where: { id: roundId, transactionId },
    select: {
      id: true,
      roundNumber: true,
      status: true,
      archivedAt: true,
      fallThroughReason: true,
      createdAt: true,
      purchasePrice: true,
      vendorMilestoneSnapshot: true,
      purchaserSolicitorFirmId: true,
      purchaserSolicitorContactId: true,
      brokerFirmId: true,
      brokerContactId: true,
    },
  });
  if (!round) return null;
  const [purchaserSolicitorFirm, purchaserSolicitorContact, brokerFirm, brokerContact] = await Promise.all([
    round.purchaserSolicitorFirmId
      ? prisma.solicitorFirm.findUnique({ where: { id: round.purchaserSolicitorFirmId }, select: { id: true, name: true } })
      : Promise.resolve(null),
    round.purchaserSolicitorContactId
      ? prisma.solicitorContact.findUnique({ where: { id: round.purchaserSolicitorContactId }, select: { id: true, name: true, phone: true, email: true } })
      : Promise.resolve(null),
    round.brokerFirmId
      ? prisma.brokerFirm.findUnique({ where: { id: round.brokerFirmId }, select: { id: true, name: true } })
      : Promise.resolve(null),
    round.brokerContactId
      ? prisma.brokerContact.findUnique({ where: { id: round.brokerContactId }, select: { id: true, name: true, phone: true, email: true } })
      : Promise.resolve(null),
  ]);

  // Buyer contacts stamped to this round. Vendor contacts are file-level
  // by design (no buyerRoundId) — they aren't shown here, the drawer's
  // header is the round, not the file.
  const buyerContacts = await prisma.contact.findMany({
    where: { propertyTransactionId: transactionId, buyerRoundId: roundId },
    select: { id: true, name: true, email: true, phone: true, roleType: true },
    orderBy: { createdAt: "asc" },
  });

  // PM completions stamped to this round. We do NOT use forRound(roundId)
  // — that would also pull vendor file-level rows. The archived-round
  // view shows the round's PMs only; the VM snapshot covers the vendor
  // side at the moment of relist.
  const pmRows = await prisma.milestoneCompletion.findMany({
    where: {
      transactionId,
      buyerRoundId: roundId,
    },
    select: {
      state: true,
      completedAt: true,
      eventDate: true,
      summaryText: true,
      confirmedByPortal: true,
      milestoneDefinition: { select: { code: true } },
      completedBy: { select: { name: true } },
    },
    orderBy: { milestoneDefinition: { orderIndex: "asc" } },
  });
  const pmCompletions = pmRows.map((r) => ({
    code: r.milestoneDefinition.code,
    state: r.state,
    completedAt: r.completedAt,
    completedByName: r.completedBy?.name ?? null,
    eventDate: r.eventDate,
    summaryText: r.summaryText,
    confirmedByPortal: r.confirmedByPortal,
  }));

  // Comms scoped to this round. Both OutboundMessage and PortalMessage
  // carry buyerRoundId (Phase 0 + 4d stamping). We include only
  // outbound here for the drawer — PortalMessage is a side channel the
  // existing comms surfaces already cover.
  const commRows = await prisma.outboundMessage.findMany({
    where: {
      transactionId,
      buyerRoundId: roundId,
    },
    select: {
      id: true,
      type: true,
      method: true,
      content: true,
      createdAt: true,
      visibleToClient: true,
      createdBy: { select: { name: true } },
    },
    orderBy: { createdAt: "asc" },
  });
  const comms = commRows.map((r) => ({
    id: r.id,
    type: r.type,
    method: r.method,
    content: r.content,
    createdAt: r.createdAt,
    createdByName: r.createdBy?.name ?? null,
    visibleToClient: r.visibleToClient,
  }));

  return {
    round: {
      id: round.id,
      roundNumber: round.roundNumber,
      status: round.status,
      archivedAt: round.archivedAt,
      fallThroughReason: round.fallThroughReason,
      createdAt: round.createdAt,
      purchasePrice: round.purchasePrice,
      purchaserSolicitorFirm,
      purchaserSolicitorContact,
      brokerFirm,
      brokerContact,
      vendorMilestoneSnapshot: round.vendorMilestoneSnapshot as VmSnapshotRow[] | null,
    },
    buyerContacts,
    pmCompletions,
    comms,
  };
}

// Document-pane data: file-level only by design. Caveat copy is applied
// in the component, not the fetcher. (No round filter on the query.)
export async function getFileLevelDocumentsForArchive(transactionId: string) {
  return prisma.transactionDocument.findMany({
    where: { transactionId },
    select: {
      id: true,
      filename: true,
      mimeType: true,
      fileSize: true,
      source: true,
      createdAt: true,
      buyerRoundId: true,
    },
    orderBy: { createdAt: "desc" },
  });
}

// Suppress the unused milestone-scope import warning in case the round-PM
// filter ever needs to switch back to forRound; the import is kept for
// the maintenance path so a future contributor doesn't need to re-derive
// the scope semantics from scratch.
void allRoundsForAudit;
void milestoneScopeWhere;
