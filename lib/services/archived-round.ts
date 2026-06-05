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
import { getSignedUrl } from "@/lib/supabase-storage";

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
    // Enriched server-side with name + orderIndex so the drawer can sort
    // and render full step names. Raw JSON still lives on the row.
    vendorMilestoneSnapshot: VmSnapshotRowEnriched[] | null;
    // Closed-loop chain arc (2026-06-05). Snapshot captured at withdrawal
    // time; null when the file wasn't in a chain. Shape documented in
    // schema.prisma BuyerRound.chainSnapshot doc comment.
    chainSnapshot: unknown;
    // Notifications the cascade fired from this file's link, joined for
    // the drawer's "Chain at withdrawal" section so the responses table
    // doesn't need an extra round-trip.
    chainNotifications: Array<{
      id: string;
      type: string;
      direction: string;
      recipientLinkId: string;
      recipientEmail: string;
      response: string | null;
      respondedAt: Date | null;
      emailSentAt: Date | null;
      createdAt: Date;
    }>;
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
    name: string;             // MilestoneDefinition.name — added for the drawer rebuild
    orderIndex: number;        // sort key — fixes VM17-after-VM20 in the snapshot
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
    isAutomated: boolean;
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

// Snapshot rows enriched server-side with the live MilestoneDefinition's
// name + orderIndex so the drawer can show "Buyer has instructed their
// solicitor" rather than "VM1", and so the snapshot list can be sorted
// reliably (the raw JSON doesn't carry orderIndex).
export type VmSnapshotRowEnriched = VmSnapshotRow & {
  name: string;
  orderIndex: number;
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
      // Closed-loop chain arc (2026-06-05) — chain shape at the moment
      // of withdrawal + the split metadata if a detachment fired. Drives
      // the drawer's "Chain at withdrawal" section.
      chainSnapshot: true,
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
      // Pull MilestoneDefinition.name + orderIndex so the drawer can
      // render full step names (instead of raw codes) and sort the
      // resulting list reliably. orderBy below stays for the DB sort
      // path; orderIndex on the row keeps the snapshot section sortable
      // on the client.
      milestoneDefinition: { select: { code: true, name: true, orderIndex: true } },
      completedBy: { select: { name: true } },
    },
    orderBy: { milestoneDefinition: { orderIndex: "asc" } },
  });
  const pmCompletions = pmRows.map((r) => ({
    code: r.milestoneDefinition.code,
    name: r.milestoneDefinition.name,
    orderIndex: r.milestoneDefinition.orderIndex,
    state: r.state,
    completedAt: r.completedAt,
    completedByName: r.completedBy?.name ?? null,
    eventDate: r.eventDate,
    summaryText: r.summaryText,
    confirmedByPortal: r.confirmedByPortal,
  }));

  // Comms scoped to this round. Two sources merged into a single
  // chronological list for the drawer's Communications section:
  //
  //   - OutboundMessage rows stamped buyerRoundId = roundId (chases,
  //     internal_notes, manual logged sends).
  //   - PortalMessage rows stamped buyerRoundId = roundId (portal
  //     chat threads — added 2026-06-05 by Phase-2 PR 4).
  //
  // Phase-2 PR 4 (PortalMessage integration): pre-PR-4 portal messages
  // were not surfaced in the drawer ("side channel the existing comms
  // surfaces already cover"). After PR 4 the LIVE timeline no longer
  // shows fall-through buyer portal messages, so the archived drawer
  // is the only place they remain visible — folded into this Comms
  // section with a synthetic "portal" channel value so the
  // getCommBadge helper can render them with a distinct "Portal" pill.
  const [outboundRows, portalRows] = await Promise.all([
    prisma.outboundMessage.findMany({
      where: { transactionId, buyerRoundId: roundId },
      select: {
        id: true,
        type: true,
        method: true,
        content: true,
        createdAt: true,
        visibleToClient: true,
        isAutomated: true,
        createdBy: { select: { name: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.portalMessage.findMany({
      where: { transactionId, buyerRoundId: roundId },
      select: {
        id: true,
        content: true,
        createdAt: true,
        fromClient: true,
        sentBy: { select: { name: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);
  const comms = [
    ...outboundRows.map((r) => ({
      id: r.id,
      type: r.type,
      method: r.method,
      content: r.content,
      createdAt: r.createdAt,
      createdByName: r.createdBy?.name ?? null,
      visibleToClient: r.visibleToClient,
      isAutomated: r.isAutomated,
    })),
    // Map PortalMessage onto the shared comm row shape. type=outbound or
    // inbound by direction (fromClient flips); method="portal" so the
    // getCommBadge helper picks the new "Portal" channel mapping.
    // visibleToClient is always true for portal messages — they're a
    // direct buyer ↔ progressor chat. isAutomated is always false —
    // these are human-typed messages.
    ...portalRows.map((r) => ({
      id: r.id,
      type: r.fromClient ? "inbound" : "outbound",
      method: "portal" as string,
      content: r.content,
      createdAt: r.createdAt,
      createdByName: r.fromClient ? null : r.sentBy?.name ?? null,
      visibleToClient: true,
      isAutomated: false,
    })),
  ].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  // Enrich the snapshot rows server-side with name + orderIndex from
  // the live MilestoneDefinition so the drawer can render full step
  // names ("Buyer has instructed their solicitor") rather than codes,
  // and sort the snapshot list by orderIndex (the JSON itself was
  // written in code-enumeration order which puts VM17 after VM20).
  const rawSnapshot = (round.vendorMilestoneSnapshot ?? null) as VmSnapshotRow[] | null;
  let snapshotEnriched: VmSnapshotRowEnriched[] | null = null;
  if (rawSnapshot && rawSnapshot.length > 0) {
    const codes = rawSnapshot.map((r) => r.code);
    const defs = await prisma.milestoneDefinition.findMany({
      where: { code: { in: codes } },
      select: { code: true, name: true, orderIndex: true },
    });
    const defByCode = new Map(defs.map((d) => [d.code, d]));
    snapshotEnriched = rawSnapshot
      .map((r) => {
        const d = defByCode.get(r.code);
        return {
          ...r,
          name: d?.name ?? r.code,
          orderIndex: d?.orderIndex ?? Number.MAX_SAFE_INTEGER,
        };
      })
      .sort((a, b) => a.orderIndex - b.orderIndex);
  }

  // Closed-loop chain arc (2026-06-05): also load any cascade notifications
  // that fired from THIS file's link, so the drawer can render their
  // response state alongside the chain snapshot. Filter by the
  // chainSnapshot's recorded ourLinkId so re-uses of the same chain over
  // multiple rounds stay scoped to this round's withdraw event.
  let chainNotifications: Array<{
    id: string;
    type: string;
    direction: string;
    recipientLinkId: string;
    recipientEmail: string;
    response: string | null;
    respondedAt: Date | null;
    emailSentAt: Date | null;
    createdAt: Date;
  }> = [];
  const chainSnapRaw = round.chainSnapshot as { ourLinkId?: string } | null;
  if (chainSnapRaw?.ourLinkId) {
    const rows = await prisma.chainNotificationQueue.findMany({
      where: { triggeringLinkId: chainSnapRaw.ourLinkId },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        type: true,
        direction: true,
        recipientLinkId: true,
        recipientEmail: true,
        response: true,
        respondedAt: true,
        emailSentAt: true,
        createdAt: true,
      },
    });
    chainNotifications = rows.map((r) => ({
      id: r.id,
      type: r.type as string,
      direction: r.direction as string,
      recipientLinkId: r.recipientLinkId,
      recipientEmail: r.recipientEmail,
      response: r.response as string | null,
      respondedAt: r.respondedAt,
      emailSentAt: r.emailSentAt,
      createdAt: r.createdAt,
    }));
  }

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
      vendorMilestoneSnapshot: snapshotEnriched,
      chainSnapshot: round.chainSnapshot,
      chainNotifications,
    },
    buyerContacts,
    pmCompletions,
    comms,
  };
}

// Document-pane data for the archived-round drawer.
//
// Phase-2 PR 2 (TransactionDocument scoping): combine file-level docs
// (MoS, admin uploads, vendor/solicitor/broker portal uploads — all
// NULL buyerRoundId by design) with THIS specific round's purchaser
// uploads. Previously this returned every doc on the file regardless of
// round, which the caveat string ("Documents on this file are not tied
// to a specific sale...") then explained away. Now that the live-tx
// reads scope out fall-through buyer uploads, the drawer is the only
// surface that should show them — and the right scope is "this round
// only" so opening Sale 1's drawer doesn't surface Sale 2's docs and
// vice versa.
//
// Returns rows enriched with a Supabase signed URL so the drawer can
// render each filename as a Download link — same pattern as
// components/transaction/DocumentsSection.tsx.
export async function getFileLevelDocumentsForArchive(
  transactionId: string,
  roundId: string,
) {
  const docs = await prisma.transactionDocument.findMany({
    where: {
      transactionId,
      OR: [
        { buyerRoundId: null },     // file-level shared (MoS, admin, etc.)
        { buyerRoundId: roundId },  // this round's purchaser uploads
      ],
    },
    select: {
      id: true,
      filename: true,
      mimeType: true,
      fileSize: true,
      source: true,
      createdAt: true,
      buyerRoundId: true,
      storagePath: true,
    },
    orderBy: { createdAt: "desc" },
  });
  return Promise.all(
    docs.map(async (d) => ({
      ...d,
      signedUrl: await getSignedUrl(d.storagePath).catch(() => null),
    })),
  );
}

// Suppress the unused milestone-scope import warning in case the round-PM
// filter ever needs to switch back to forRound; the import is kept for
// the maintenance path so a future contributor doesn't need to re-derive
// the scope semantics from scratch.
void allRoundsForAudit;
void milestoneScopeWhere;
