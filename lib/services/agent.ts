import { prisma } from "@/lib/prisma";
import type { TransactionStatus } from "@prisma/client";
import { roundScopedOR, loadActiveRoundIds } from "@/lib/services/round-scope";
import { detectPhase } from "@/lib/services/fees";
import { RETIRED_ENQUIRY_CODES } from "@/lib/milestone-prerequisites";
import { confirmationSentence, resolveConfirmer } from "@/lib/updates-copy";
import { DISPLAY_STAGES, type DisplayStageKey } from "@/lib/milestones/display-stages";

// "draft" is added to the TransactionStatus enum — type cast until Prisma client regenerates
const DRAFT = "draft" as TransactionStatus;

export type AgentVisibility = {
  userId: string;
  agencyId: string;
  seeAll: boolean;
  firmName: string | null;
  // Internal staff modes — undefined for all agent (director/negotiator) callers.
  // "admin_all": see every transaction on the platform (admin role).
  // "assigned": see only transactions where assignedUserId = userId (sales_progressor).
  internalMode?: "admin_all" | "assigned";
};

/** Resolve how much of the agency a user can see based on role + canViewAllFiles. */
export async function resolveAgentVisibility(
  userId: string,
  agencyId: string
): Promise<AgentVisibility> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, canViewAllFiles: true, firmName: true },
  });
  const seeAll = user?.role === "director" || user?.canViewAllFiles === true;
  return { userId, agencyId, seeAll, firmName: user?.firmName ?? null };
}

/**
 * Resolve visibility for internal staff (admin, sales_progressor, viewer).
 * Synchronous — reads only from the session, no DB query.
 * admin (or hybrid SP via hasAdminPowers) → "admin_all": sees every transaction across all agencies.
 * sales_progressor / viewer → "assigned": sees transactions where assignedUserId = userId.
 */
export function resolveInternalVisibility(
  userId: string,
  role: string,
  hasAdminPowers: boolean = false,
): AgentVisibility {
  return {
    userId,
    agencyId: "",
    seeAll: false,
    firmName: null,
    internalMode: (role === "admin" || hasAdminPowers) ? "admin_all" : "assigned",
  };
}

/** Build the Prisma `where` clause for PropertyTransaction based on visibility. */
function txWhere(vis: AgentVisibility) {
  // Internal staff paths — checked first; agent callers have internalMode undefined.
  if (vis.internalMode === "admin_all") return { serviceType: "outsourced" as const };
  if (vis.internalMode === "assigned")  return { assignedUserId: vis.userId };
  // Agent paths unchanged.
  if (vis.seeAll) {
    if (vis.firmName) {
      return { agencyId: vis.agencyId, agentUser: { firmName: vis.firmName } };
    }
    return { agencyId: vis.agencyId };
  }
  return { agentUserId: vis.userId };
}

export async function getAgentTransactions(vis: AgentVisibility) {
  const defs = await prisma.milestoneDefinition.findMany({
    where: { blocksExchange: true },
    select: { id: true },
  });
  const exchangeDefs = await prisma.milestoneDefinition.findMany({
    where: { code: { in: ["VM19", "PM26"] } },
    select: { id: true },
  });
  const completionDefs = await prisma.milestoneDefinition.findMany({
    where: { code: { in: ["VM20", "PM27"] } },
    select: { id: true },
  });

  const blockingDefIds = new Set(defs.map((d) => d.id));
  const exchangeIds = new Set(exchangeDefs.map((d) => d.id));
  const completionIds = new Set(completionDefs.map((d) => d.id));

  const transactions = await prisma.propertyTransaction.findMany({
    where: { ...txWhere(vis), status: { not: DRAFT } },
    orderBy: { createdAt: "desc" },
    include: {
      assignedUser: { select: { id: true, name: true, role: true } },
      agentUser: { select: { id: true, name: true, role: true } },
      contacts: { select: { name: true, roleType: true } },
      // PHASE 1 (a)-CLASS resolved — Phase-3 OR scope below. Archived-
      // round PMs no longer inflate milestonePercent or hasExchanged on
      // a relisted file.
      milestoneCompletions: {
        where: { state: "complete", OR: roundScopedOR(await loadActiveRoundIds({ ...txWhere(vis), status: { not: DRAFT } })) },
        select: { milestoneDefinitionId: true, completedAt: true },
      },
    },
  });

  return transactions.map((tx) => {
    const completedIds = new Set(tx.milestoneCompletions.map((c) => c.milestoneDefinitionId));
    const exchangeCompletion = tx.milestoneCompletions.find((c) => exchangeIds.has(c.milestoneDefinitionId));
    const blockingDone = [...blockingDefIds].filter((id) => completedIds.has(id)).length;
    const milestonePercent = blockingDefIds.size > 0
      ? Math.round((blockingDone / blockingDefIds.size) * 100)
      : 0;
    const hasExchanged = [...exchangeIds].some((id) => completedIds.has(id));
    const hasCompleted = [...completionIds].some((id) => completedIds.has(id));
    const vendors = tx.contacts.filter((c) => c.roleType === "vendor").map((c) => c.name);
    const purchasers = tx.contacts.filter((c) => c.roleType === "purchaser").map((c) => c.name);

    return {
      id: tx.id,
      propertyAddress: tx.propertyAddress,
      status: tx.status,
      serviceType: tx.serviceType,
      purchasePrice: tx.purchasePrice,
      expectedExchangeDate: tx.expectedExchangeDate,
      completionDate: tx.completionDate,
      assignedUser: tx.assignedUser,
      agentUser: tx.agentUser,
      milestonePercent,
      hasExchanged,
      hasCompleted,
      vendors,
      purchasers,
      createdAt: tx.createdAt,
      agentFeeAmount: tx.agentFeeAmount,
      agentFeePercent: tx.agentFeePercent,
      agentFeeIsVatInclusive: tx.agentFeeIsVatInclusive,
      referredFirmId: tx.referredFirmId,
      referralFee: tx.referralFee,
      referralFeeReceived: tx.referralFeeReceived,
      exchangedAt: exchangeCompletion?.completedAt ?? null,
    };
  });
}

export async function getAgentStats(vis: AgentVisibility) {
  const transactions = await getAgentTransactions(vis);

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfYear = new Date(now.getFullYear(), 0, 1);

  return {
    total: transactions.length,
    active: transactions.filter((t) => t.status === "active" && !t.hasExchanged).length,
    exchanged: transactions.filter((t) => t.hasExchanged && !t.hasCompleted).length,
    completed: transactions.filter((t) => t.hasCompleted || t.status === "completed").length,
    thisMonth: transactions.filter((t) => new Date(t.createdAt) >= startOfMonth).length,
    thisYear: transactions.filter((t) => new Date(t.createdAt) >= startOfYear).length,
    selfManaged: transactions.filter((t) => t.serviceType === "self_managed").length,
    outsourced: transactions.filter((t) => t.serviceType === "outsourced").length,
  };
}

export async function getAgentCompletions(vis: AgentVisibility) {
  const defs = await prisma.milestoneDefinition.findMany({
    where: { code: { in: ["VM19", "PM26", "VM20", "PM27"] } },
    select: { id: true, code: true },
  });

  const exchangeDefIds = defs.filter((d) => d.code === "VM19" || d.code === "PM26").map((d) => d.id);
  const completionDefIds = defs.filter((d) => d.code === "VM20" || d.code === "PM27").map((d) => d.id);

  const allPostExchangeDefIds = [...exchangeDefIds, ...completionDefIds];

  const candidates = await prisma.propertyTransaction.findMany({
    where: {
      ...txWhere(vis),
      status: "active",
      // PHASE 1 (a)-CLASS resolved — Phase-3 OR scope below.
      milestoneCompletions: {
        some: {
          state: "complete",
          milestoneDefinitionId: { in: exchangeDefIds },
          OR: roundScopedOR(await loadActiveRoundIds({ ...txWhere(vis), status: "active" as TransactionStatus })),
        },
      },
    },
    select: {
      id: true,
      propertyAddress: true,
      completionDate: true,
      purchasePrice: true,
      agentFeeAmount: true,
      photoStoragePath: true,
      agency:       { select: { name: true } },
      assignedUser: { select: { name: true } },
      contacts: { select: { name: true, roleType: true } },
      vendorSolicitorFirm:    { select: { name: true } },
      purchaserSolicitorFirm: { select: { name: true } },
      // PHASE 1 (a)-CLASS resolved — Phase-3 OR scope below.
      milestoneCompletions: {
        where: {
          state: "complete",
          milestoneDefinitionId: { in: allPostExchangeDefIds },
          OR: roundScopedOR(await loadActiveRoundIds({ ...txWhere(vis), status: "active" as TransactionStatus })),
        },
        select: { milestoneDefinitionId: true, completedAt: true },
      },
    },
  });

  return candidates
    .filter((tx) => !tx.milestoneCompletions.some((c) => completionDefIds.includes(c.milestoneDefinitionId)))
    .map((tx) => {
      const exchangeCompletion = tx.milestoneCompletions.find((c) => exchangeDefIds.includes(c.milestoneDefinitionId));
      return {
        id: tx.id,
        propertyAddress: tx.propertyAddress,
        completionDate: tx.completionDate,
        purchasePrice: tx.purchasePrice,
        agentFeeAmount: tx.agentFeeAmount,
        photoStoragePath: tx.photoStoragePath,
        agencyName:       tx.agency?.name ?? null,
        assignedUserName: tx.assignedUser?.name ?? null,
        purchasers: tx.contacts.filter((c) => c.roleType === "purchaser").map((c) => c.name),
        vendors:    tx.contacts.filter((c) => c.roleType === "vendor").map((c) => c.name),
        exchangedAt:           exchangeCompletion?.completedAt ?? null,
        vendorSolicitorName:    tx.vendorSolicitorFirm?.name ?? null,
        purchaserSolicitorName: tx.purchaserSolicitorFirm?.name ?? null,
      };
    })
    .sort((a, b) => {
      if (!a.completionDate) return 1;
      if (!b.completionDate) return -1;
      return new Date(a.completionDate).getTime() - new Date(b.completionDate).getTime();
    });
}

// Recently COMPLETED files (status flipped to "completed" when both VM20 + PM27
// were confirmed). Powers the collapsed "Completed" history on /agent/completions.
// Newest completion first, capped — the page shows the 3 most recent and lets
// the rest expand, so a busy agency never gets an endless page.
export async function getAgentCompletedFiles(vis: AgentVisibility, limit = 25) {
  const rows = await prisma.propertyTransaction.findMany({
    where: { ...txWhere(vis), status: "completed" },
    select: {
      id: true,
      propertyAddress: true,
      completionDate: true,
      purchasePrice: true,
      agentFeeAmount: true,
      photoStoragePath: true,
      agency:       { select: { name: true } },
      assignedUser: { select: { name: true } },
      contacts: { select: { name: true, roleType: true } },
    },
    orderBy: { completionDate: "desc" },
    take: limit,
  });
  return rows.map((tx) => ({
    id: tx.id,
    propertyAddress: tx.propertyAddress,
    completionDate: tx.completionDate,
    purchasePrice: tx.purchasePrice,
    agentFeeAmount: tx.agentFeeAmount,
    photoStoragePath: tx.photoStoragePath,
    agencyName:       tx.agency?.name ?? null,
    assignedUserName: tx.assignedUser?.name ?? null,
    purchasers: tx.contacts.filter((c) => c.roleType === "purchaser").map((c) => c.name),
  }));
}

// PHASE 1 (a)-CLASS resolved — Phase-3 OR scope below.
// Comms dashboard activity feed: a relisted file's archived-round PM
// no longer appears as recent activity. The two-step pattern (load
// active round ids first, then filter MC.buyerRoundId IN that set OR
// NULL) replaces the prior cross-tx under-scope.
export async function getAgentMilestoneActivity(
  vis: AgentVisibility,
  portalOnly = false,
) {
  const txFilter = { ...txWhere(vis), status: { not: DRAFT } };
  const activeRoundIds = await loadActiveRoundIds(txFilter);
  return prisma.milestoneCompletion.findMany({
    where: {
      transaction: txFilter,
      state: "complete",
      // Enquiries rework: keep the retired granular enquiry steps out of the
      // agent activity feed (migrated files still carry their completed rows).
      // Also hide VM21 ("all enquiries satisfied", seller side): it's a pure
      // auto-mirror of the buyer's PM20, which is already in the feed, so showing
      // both would double-count the one "enquiries satisfied" event.
      milestoneDefinition: { code: { notIn: [...RETIRED_ENQUIRY_CODES, "VM21"] } },
      OR: roundScopedOR(activeRoundIds),
      ...(portalOnly ? { confirmedByPortal: true } : {}),
    },
    orderBy: { completedAt: "desc" },
    take: 150,
    include: {
      transaction: {
        select: {
          id: true, propertyAddress: true, photoStoragePath: true, expectedExchangeDate: true, status: true,
          // id + image added for the client-confirmer avatar (audit #16 phase 2).
          contacts: { select: { id: true, name: true, roleType: true, image: true, isPrincipal: true } },
        },
      },
      milestoneDefinition: { select: { code: true, name: true, side: true } },
      completedBy: { select: { name: true, image: true } },
      confirmedBySolicitorFirm: { select: { name: true } },
    },
  });
}

// ─── Updates feed (multi-type activity stream) ────────────────────────────────
// The cross-file Updates page (/agent/comms) reads this. Where
// getAgentMilestoneActivity (still used by the bell/notifications route) returns
// milestone confirmations only, this merges the five kinds of thing we actually
// record into one typed, date-sorted stream: milestone confirmations, price
// changes, client-shared notes, replies in, and document uploads. Everything is
// scoped through txWhere(vis) + the active-round OR, so multi-tenant + relist
// rules match the rest of the feed. Signing of photos and document links happens
// in the page (batched); this returns raw storage paths.

export type UpdateWho = "agent" | "client" | "helper" | "solicitor";
export type UpdateSide = "vendor" | "purchaser" | null;

export type UpdateFeedTx = {
  id: string;
  propertyAddress: string;
  photoStoragePath: string | null;
  expectedExchangeDate: Date | null;
  status: string;
};

export type UpdateFeedEntry = {
  id: string;
  at: Date;
  who: UpdateWho;
  side: UpdateSide;
  transaction: UpdateFeedTx;
} & (
  | { kind: "milestone"; code: string; stageKey: DisplayStageKey | null; sentence: string; byName: string | null; byImage: string | null }
  | { kind: "price"; oldPrice: number | null; newPrice: number; reason: string | null; byName: string | null }
  | { kind: "note"; content: string; byName: string | null; byImage: string | null }
  | { kind: "reply"; content: string }
  | { kind: "document"; documentId: string; filename: string; mimeType: string; storagePath: string; byName: string | null }
);

const FEED_TX_SELECT = {
  id: true, propertyAddress: true, photoStoragePath: true, expectedExchangeDate: true, status: true,
} as const;

const sideFromRole = (roleType: string | null | undefined): UpdateSide =>
  roleType === "vendor" ? "vendor" : roleType === "purchaser" ? "purchaser" : null;

// Map every milestone code to one of the six journey stages shown on the file
// Overview strip, so the Updates filter can group step confirmations by stage.
// Partition by orderIndex: a code belongs to the latest stage whose entry code
// starts at or before it. Built once from the definitions table (~48 rows).
async function buildMilestoneStageMap(): Promise<Map<string, DisplayStageKey>> {
  const defs = await prisma.milestoneDefinition.findMany({
    select: { code: true, orderIndex: true },
    orderBy: { orderIndex: "asc" },
  });
  const orderOf = new Map(defs.map((d) => [d.code, d.orderIndex]));
  const starts = DISPLAY_STAGES
    .map((s) => ({ key: s.key, start: Math.min(...s.entryCodes.map((c) => orderOf.get(c) ?? Infinity)) }))
    .filter((s) => Number.isFinite(s.start))
    .sort((a, b) => a.start - b.start);
  const map = new Map<string, DisplayStageKey>();
  for (const d of defs) {
    let key: DisplayStageKey | null = starts[0]?.key ?? null;
    for (const s of starts) if (d.orderIndex >= s.start) key = s.key;
    if (key) map.set(d.code, key);
  }
  return map;
}

export async function getAgentUpdatesFeed(vis: AgentVisibility): Promise<UpdateFeedEntry[]> {
  const txFilter = { ...txWhere(vis), status: { not: DRAFT } };
  const activeRoundIds = await loadActiveRoundIds(txFilter);
  const roundOR = roundScopedOR(activeRoundIds);

  const [stageMap, completions, priceRows, noteRows, replyRows, docRows] = await Promise.all([
    buildMilestoneStageMap(),
    prisma.milestoneCompletion.findMany({
      where: {
        transaction: txFilter,
        state: "complete",
        milestoneDefinition: { code: { notIn: [...RETIRED_ENQUIRY_CODES, "VM21"] } },
        OR: roundOR,
      },
      orderBy: { completedAt: "desc" },
      take: 120,
      include: {
        transaction: {
          select: { ...FEED_TX_SELECT, contacts: { select: { id: true, name: true, roleType: true, image: true, isPrincipal: true } } },
        },
        milestoneDefinition: { select: { code: true, name: true, side: true } },
        completedBy: { select: { name: true, image: true } },
        confirmedBySolicitorFirm: { select: { name: true } },
      },
    }),
    prisma.priceHistory.findMany({
      where: { transaction: txFilter, OR: roundOR },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { transaction: { select: FEED_TX_SELECT } },
    }),
    // Notes: ONLY those the agent ticked "share with client" (visibleToClient).
    // Internal jots — a bare internal_note, or the separate TransactionNote table
    // (which has no share flag) — deliberately never reach this feed.
    prisma.outboundMessage.findMany({
      where: { transaction: txFilter, type: "internal_note", visibleToClient: true, OR: roundOR },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { transaction: { select: FEED_TX_SELECT }, createdBy: { select: { name: true, image: true } } },
    }),
    // Replies in: a solicitor responding to one of our automatic chases with an
    // expected date or a free-text update. Both are recorded as an EnquiryMovement
    // (source solicitor_reply) carrying the actual text. A confirm is NOT a reply
    // — it completes the step and shows as a "Step confirmed" entry instead. We
    // deliberately do NOT read inbound comms here (those are historical WhatsApp /
    // email imports, unrelated to chases).
    prisma.enquiryMovement.findMany({
      where: { source: "solicitor_reply", tracker: { transaction: txFilter } },
      orderBy: { occurredAt: "desc" },
      take: 50,
      include: { tracker: { select: { transaction: { select: FEED_TX_SELECT } } } },
    }),
    prisma.transactionDocument.findMany({
      where: { transaction: txFilter, OR: roundOR },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { transaction: { select: FEED_TX_SELECT }, contact: { select: { name: true, roleType: true } } },
    }),
  ]);

  // PriceHistory carries changedById but no User relation — resolve names once.
  const changerIds = [...new Set(priceRows.map((p) => p.changedById).filter((x): x is string => !!x))];
  const changerNames = new Map<string, string>();
  if (changerIds.length) {
    const users = await prisma.user.findMany({ where: { id: { in: changerIds } }, select: { id: true, name: true } });
    for (const u of users) changerNames.set(u.id, u.name ?? "");
  }

  const entries: UpdateFeedEntry[] = [];

  for (const m of completions) {
    const side = m.milestoneDefinition.side as "vendor" | "purchaser";
    const sideContacts = (m.transaction.contacts ?? []).filter((c) => c.roleType === side).map((c) => ({ id: c.id, name: c.name, isPrincipal: c.isPrincipal }));
    const resolved = resolveConfirmer(m, sideContacts);
    // Preserve the old behaviour of always attributing (system auto-confirms
    // fall back to the completing user, or "A colleague").
    const confirmer = resolved.confirmer ?? ({ kind: "agent", name: m.completedBy?.name ?? "A colleague" } as const);
    const principals = resolved.principals;
    // Avatar carries whoever actually confirmed — the helper if a helper did it,
    // the client if they did, else the completing user.
    const confirmingContact = confirmer.kind === "client" || confirmer.kind === "helper"
      ? (m.transaction.contacts ?? []).find((c) => c.id === m.confirmedByContactId)
        ?? (m.transaction.contacts ?? []).find((c) => c.roleType === side)
      : null;
    const { contacts: _contacts, ...txCore } = m.transaction;
    entries.push({
      kind: "milestone",
      id: m.id,
      at: m.completedAt ?? m.createdAt,
      who: confirmer.kind,
      side,
      transaction: txCore,
      code: m.milestoneDefinition.code,
      stageKey: stageMap.get(m.milestoneDefinition.code) ?? null,
      sentence: confirmationSentence({ code: m.milestoneDefinition.code, side, confirmer, sideContacts: principals, milestoneName: m.milestoneDefinition.name, isDesktopValuation: m.milestoneDefinition.code === "PM6" && !m.eventDate }),
      byName: confirmer.kind === "client" || confirmer.kind === "helper" ? (confirmingContact?.name ?? null) : (m.completedBy?.name ?? null),
      byImage: confirmer.kind === "client" || confirmer.kind === "helper" ? (confirmingContact?.image ?? null) : (m.completedBy?.image ?? null),
    });
  }

  for (const p of priceRows) {
    if (!p.transaction) continue;
    entries.push({
      kind: "price",
      id: p.id,
      at: p.createdAt,
      who: "agent",
      side: null,
      transaction: p.transaction,
      oldPrice: p.oldPrice,
      newPrice: p.newPrice,
      reason: p.reason,
      byName: p.changedById ? (changerNames.get(p.changedById) || null) : null,
    });
  }

  for (const n of noteRows) {
    if (!n.transaction) continue;
    entries.push({
      kind: "note",
      id: n.id,
      at: n.sentAt ?? n.createdAt,
      who: "agent",
      side: null,
      transaction: n.transaction,
      content: n.content,
      byName: n.createdBy?.name ?? null,
      byImage: n.createdBy?.image ?? null,
    });
  }

  for (const mv of replyRows) {
    const t = mv.tracker?.transaction;
    if (!t) continue;
    entries.push({
      kind: "reply",
      id: mv.id,
      at: mv.occurredAt,
      who: "solicitor",
      side: null,
      transaction: t,
      content: mv.note,
    });
  }

  for (const d of docRows) {
    if (!d.transaction) continue;
    entries.push({
      kind: "document",
      id: d.id,
      at: d.createdAt,
      // No uploader contact = an agent / file-level upload (our own paperwork).
      who: d.contact ? (d.contact.roleType === "solicitor" ? "solicitor" : "client") : "agent",
      side: sideFromRole(d.contact?.roleType),
      transaction: d.transaction,
      documentId: d.id,
      filename: d.filename,
      mimeType: d.mimeType,
      storagePath: d.storagePath,
      byName: d.contact?.name ?? null,
    });
  }

  entries.sort((a, b) => b.at.getTime() - a.at.getTime());
  return entries.slice(0, 150);
}

// Per-file snapshot for the Updates feed's right column: weight-based
// completion %, the human stage, and the next available step. Round-scoped to
// each file's active buyer round (mirrors the file page), computed for all
// feed files in a couple of batched queries.
export type FileSnapshot = { percent: number; stage: string; nextAction: string | null };

const SNAPSHOT_STAGE_LABEL: Record<string, string> = {
  onboarding: "Onboarding",
  conveyancing: "Conveyancing",
  pre_exchange: "Nearing exchange",
  post_exchange: "Post-exchange",
};

export async function getFileSnapshots(
  vis: AgentVisibility,
  txIds: string[],
): Promise<Map<string, FileSnapshot>> {
  const result = new Map<string, FileSnapshot>();
  const ids = [...new Set(txIds)];
  if (ids.length === 0) return result;

  const activeRoundIds = await loadActiveRoundIds({ ...txWhere(vis), id: { in: ids } });
  const defs = await prisma.milestoneDefinition.findMany({
    // Enquiries rework: exclude retired steps so a stale "available" retired row
    // on a migrated file can't be surfaced as the file's next action.
    where: { code: { notIn: [...RETIRED_ENQUIRY_CODES] } },
    select: { id: true, code: true, name: true, side: true, weight: true, orderIndex: true },
    orderBy: [{ orderIndex: "asc" }],
  });
  const defById = new Map(defs.map((d) => [d.id, d]));
  const completions = await prisma.milestoneCompletion.findMany({
    where: { transactionId: { in: ids }, OR: roundScopedOR(activeRoundIds) },
    select: { transactionId: true, milestoneDefinitionId: true, state: true },
  });

  type Row = { code: string; name: string; side: string; weight: number; orderIndex: number; state: string };
  const byTx = new Map<string, Row[]>();
  for (const c of completions) {
    const d = defById.get(c.milestoneDefinitionId);
    if (!d) continue;
    const arr = byTx.get(c.transactionId) ?? [];
    arr.push({ code: d.code, name: d.name, side: d.side, weight: Number(d.weight), orderIndex: d.orderIndex, state: c.state });
    byTx.set(c.transactionId, arr);
  }

  const sidePercent = (rows: Row[]): number => {
    const applicable = rows.filter((r) => r.state !== "not_required");
    const total = applicable.reduce((s, r) => s + r.weight, 0);
    if (total === 0) return 0;
    const done = applicable.filter((r) => r.state === "complete").reduce((s, r) => s + r.weight, 0);
    return (done / total) * 100;
  };

  for (const id of ids) {
    const rows = byTx.get(id) ?? [];
    const percent = Math.round((sidePercent(rows.filter((r) => r.side === "vendor")) + sidePercent(rows.filter((r) => r.side === "purchaser"))) / 2);
    const completedCodes = new Set(rows.filter((r) => r.state === "complete").map((r) => r.code));
    const stage = SNAPSHOT_STAGE_LABEL[detectPhase(completedCodes).fileLevelPhase] ?? "In progress";
    const next = rows.filter((r) => r.state === "available").sort((a, b) => a.orderIndex - b.orderIndex)[0];
    result.set(id, { percent, stage, nextAction: next?.name ?? null });
  }
  return result;
}

export async function getDraftTransactions(vis: AgentVisibility) {
  return prisma.propertyTransaction.findMany({
    where: { ...txWhere(vis), status: DRAFT },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      propertyAddress: true,
      tenure: true,
      purchaseType: true,
      purchasePrice: true,
      updatedAt: true,
      contacts: { select: { name: true, phone: true, roleType: true } },
    },
  });
}

/** List all negotiators + director in an agency, scoped to firmName if provided. */
export async function getAgencyTeam(agencyId: string, firmName?: string | null) {
  const where: Record<string, unknown> = { agencyId, role: { in: ["director", "negotiator"] } };
  if (firmName) where.firmName = firmName;
  return prisma.user.findMany({
    where,
    select: { id: true, name: true, email: true, role: true, canViewAllFiles: true, createdAt: true },
    orderBy: [{ role: "asc" }, { name: "asc" }],
  });
}
