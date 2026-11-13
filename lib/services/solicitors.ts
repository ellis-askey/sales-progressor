import { prisma } from "@/lib/prisma";
import type { AgentVisibility } from "./agent";
import type { Prisma, TransactionStatus } from "@prisma/client";
import { scopeTransactionWhere, type AccessScope } from "@/lib/security/access-scope";
import { getSignedUrlMap } from "@/lib/supabase-storage";
import { getMilestonesForTransaction } from "@/lib/services/milestones";
import { resolveDisplayStages, type ResolvedStage } from "@/lib/milestones/display-stages";

const STAGE_RESOLVE_CAP = 30; // active files we resolve a live stage for per firm

// The stage the file is in right now, read exactly as the file-page timeline
// strip reads it (resolveDisplayStages) — not invented status logic.
function currentStageLabel(stages: ResolvedStage[]): string {
  const inProgress = stages.filter((s) => s.status === "in_progress");
  if (inProgress.length > 0) return inProgress[inProgress.length - 1].name;
  const upNext = stages.find((s) => s.status === "up_next");
  if (upNext) return upNext.name;
  if (stages.length > 0 && stages.every((s) => s.status === "complete")) return "Completing";
  const complete = stages.filter((s) => s.status === "complete");
  if (complete.length > 0) return complete[complete.length - 1].name;
  return "Getting started";
}

export type SolicitorContactWithFiles = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  activeFiles: { id: string; propertyAddress: string; role: "vendor" | "purchaser"; isReferral: boolean }[];
};

export type SolicitorFirmWithStats = {
  id: string;
  name: string;
  totalActiveFiles: number;
  referralActiveFiles: number;
  contacts: SolicitorContactWithFiles[];
};

/** Returns solicitor firms scoped to the agent's visible transactions. */
export async function getSolicitorDirectoryForAgent(vis: AgentVisibility): Promise<SolicitorFirmWithStats[]> {
  const activeStatuses = ["active", "on_hold"] as TransactionStatus[];
  const txFilter = vis.seeAll
    ? vis.firmName
      ? { agencyId: vis.agencyId, agentUser: { firmName: vis.firmName }, status: { in: activeStatuses } }
      : { agencyId: vis.agencyId, status: { in: activeStatuses } }
    : { OR: [{ agentUserId: vis.userId }, { assignedUserId: vis.userId }], status: { in: activeStatuses } };
  return solicitorDirectoryFromWhere(txFilter);
}

/** Returns solicitor firms scoped for internal staff (access-scope aware). */
export async function getSolicitorDirectoryForScope(scope: AccessScope): Promise<SolicitorFirmWithStats[]> {
  const activeStatuses = ["active", "on_hold"] as TransactionStatus[];
  return solicitorDirectoryFromWhere({ ...scopeTransactionWhere(scope), status: { in: activeStatuses } });
}

async function solicitorDirectoryFromWhere(
  txFilter: Prisma.PropertyTransactionWhereInput,
): Promise<SolicitorFirmWithStats[]> {
  const transactions = await prisma.propertyTransaction.findMany({
    where: txFilter,
    select: {
      id: true,
      propertyAddress: true,
      vendorSolicitorFirmId: true,
      purchaserSolicitorFirmId: true,
      vendorSolicitorContactId: true,
      purchaserSolicitorContactId: true,
      referredFirmId: true,
    },
  });

  const firmIds = new Set<string>();
  for (const tx of transactions) {
    if (tx.vendorSolicitorFirmId) firmIds.add(tx.vendorSolicitorFirmId);
    if (tx.purchaserSolicitorFirmId) firmIds.add(tx.purchaserSolicitorFirmId);
  }

  if (firmIds.size === 0) return [];

  const vendorByFirm = new Map<string, Set<string>>();
  const purchaserByFirm = new Map<string, Set<string>>();
  const referralByFirm = new Map<string, Set<string>>();
  const filesByContact = new Map<string, { id: string; propertyAddress: string; role: "vendor" | "purchaser"; referredFirmId: string | null }[]>();

  for (const tx of transactions) {
    if (tx.vendorSolicitorFirmId) {
      if (!vendorByFirm.has(tx.vendorSolicitorFirmId)) vendorByFirm.set(tx.vendorSolicitorFirmId, new Set());
      vendorByFirm.get(tx.vendorSolicitorFirmId)!.add(tx.id);
    }
    if (tx.purchaserSolicitorFirmId) {
      if (!purchaserByFirm.has(tx.purchaserSolicitorFirmId)) purchaserByFirm.set(tx.purchaserSolicitorFirmId, new Set());
      purchaserByFirm.get(tx.purchaserSolicitorFirmId)!.add(tx.id);
    }
    if (tx.referredFirmId) {
      if (!referralByFirm.has(tx.referredFirmId)) referralByFirm.set(tx.referredFirmId, new Set());
      referralByFirm.get(tx.referredFirmId)!.add(tx.id);
    }
    if (tx.vendorSolicitorContactId) {
      if (!filesByContact.has(tx.vendorSolicitorContactId)) filesByContact.set(tx.vendorSolicitorContactId, []);
      filesByContact.get(tx.vendorSolicitorContactId)!.push({ id: tx.id, propertyAddress: tx.propertyAddress, role: "vendor", referredFirmId: tx.referredFirmId ?? null });
    }
    if (tx.purchaserSolicitorContactId) {
      if (!filesByContact.has(tx.purchaserSolicitorContactId)) filesByContact.set(tx.purchaserSolicitorContactId, []);
      filesByContact.get(tx.purchaserSolicitorContactId)!.push({ id: tx.id, propertyAddress: tx.propertyAddress, role: "purchaser", referredFirmId: tx.referredFirmId ?? null });
    }
  }

  const firms = await prisma.solicitorFirm.findMany({
    // isDemo:false so a demo/preview firm referenced by a demo file never shows
    // in an agency's real solicitor list.
    where: { id: { in: [...firmIds] }, isDemo: false },
    orderBy: { name: "asc" },
    include: { handlers: { orderBy: { name: "asc" } } },
  });

  return firms.map((firm) => ({
    id: firm.id,
    name: firm.name,
    totalActiveFiles: new Set([
      ...(vendorByFirm.get(firm.id) ?? []),
      ...(purchaserByFirm.get(firm.id) ?? []),
    ]).size,
    referralActiveFiles: referralByFirm.get(firm.id)?.size ?? 0,
    contacts: firm.handlers.map((h) => ({
      id: h.id,
      name: h.name,
      phone: h.phone,
      email: h.email,
      activeFiles: (filesByContact.get(h.id) ?? []).map((f) => ({
        id: f.id,
        propertyAddress: f.propertyAddress,
        role: f.role,
        isReferral: f.referredFirmId === firm.id,
      })),
    })),
  }));
}

export type FirmFileRow = {
  id: string;
  propertyAddress: string;
  status: string;
  role: "vendor" | "purchaser" | "both";
  isReferral: boolean;
  createdAt: Date;
  // The handler at THIS firm working the file (vendor- or purchaser-side), for
  // the "conveyancer" line on each associated-sale row. Null when the file
  // points at the firm but not a specific handler.
  conveyancerName: string | null;
  // Signed thumbnail URL (null when the agent hasn't uploaded a property photo).
  photoUrl: string | null;
  // The live stage the file is in, read exactly as the file-page timeline strip
  // reads it (resolveDisplayStages). Null for completed/withdrawn files (their
  // status pill already says it) and for active files beyond the resolve cap.
  stageLabel: string | null;
};

export type FirmContactRow = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  secondaryEmail: string | null;
  image: string | null;
  role: string | null; // job title, e.g. "Conveyancer" / "Assistant"
  // Active (active + on_hold) files this handler is working at this firm.
  activeFileCount: number;
};

export type SolicitorFirmDetail = {
  id: string;
  name: string;
  contacts: FirmContactRow[];
  files: FirmFileRow[];
};

/**
 * Full detail for one solicitor firm, scoped to the agent's visible files
 * (all statuses except draft, so completed files show too). Returns null when
 * the firm has no file the agent can see — which doubles as the access guard.
 */
export async function getSolicitorFirmDetail(vis: AgentVisibility, firmId: string): Promise<SolicitorFirmDetail | null> {
  const baseWhere = vis.seeAll
    ? vis.firmName
      ? { agencyId: vis.agencyId, agentUser: { firmName: vis.firmName } }
      : { agencyId: vis.agencyId }
    : { OR: [{ agentUserId: vis.userId }, { assignedUserId: vis.userId }] };
  return solicitorFirmDetailFromWhere(baseWhere, firmId, vis.agencyId ?? null);
}

/** Solicitor firm detail scoped for internal staff (access-scope aware). */
export async function getSolicitorFirmDetailForScope(scope: AccessScope, firmId: string): Promise<SolicitorFirmDetail | null> {
  return solicitorFirmDetailFromWhere(scopeTransactionWhere(scope), firmId, null);
}

async function solicitorFirmDetailFromWhere(
  baseWhere: Prisma.PropertyTransactionWhereInput,
  firmId: string,
  agencyId: string | null,
): Promise<SolicitorFirmDetail | null> {
  const [firm, transactions] = await Promise.all([
    prisma.solicitorFirm.findUnique({
      where: { id: firmId },
      select: {
        id: true,
        name: true,
        handlers: {
          orderBy: { name: "asc" },
          select: { id: true, name: true, phone: true, email: true, secondaryEmail: true, image: true, role: true },
        },
      },
    }),
    prisma.propertyTransaction.findMany({
      where: {
        ...baseWhere,
        status: { not: "draft" as TransactionStatus },
        OR: [{ vendorSolicitorFirmId: firmId }, { purchaserSolicitorFirmId: firmId }],
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        propertyAddress: true,
        status: true,
        createdAt: true,
        referredFirmId: true,
        vendorSolicitorFirmId: true,
        purchaserSolicitorFirmId: true,
        vendorSolicitorContactId: true,
        purchaserSolicitorContactId: true,
        photoStoragePath: true,
        // Forecast inputs for the live-stage read (resolveDisplayStages).
        expectedExchangeDate: true,
        overridePredictedDate: true,
        completionDate: true,
        purchaseType: true,
      },
    }),
  ]);

  if (!firm || transactions.length === 0) return null;

  // Sign property thumbnails in one batch (null paths pass through as null).
  const photoMap = await getSignedUrlMap(transactions.map((t) => t.photoStoragePath));
  const handlerName = new Map(firm.handlers.map((h) => [h.id, h.name] as const));
  const activeByContact = new Map<string, number>();

  const files: FirmFileRow[] = transactions.map((tx) => {
    const isVendor = tx.vendorSolicitorFirmId === firmId;
    const isPurchaser = tx.purchaserSolicitorFirmId === firmId;
    // The handler working this file at THIS firm — vendor-side id when we're the
    // vendor solicitor, else the purchaser-side id.
    const contactId = isVendor ? tx.vendorSolicitorContactId : tx.purchaserSolicitorContactId;
    if (contactId && (tx.status === "active" || tx.status === "on_hold")) {
      activeByContact.set(contactId, (activeByContact.get(contactId) ?? 0) + 1);
    }
    return {
      id: tx.id,
      propertyAddress: tx.propertyAddress,
      status: tx.status,
      role: isVendor && isPurchaser ? "both" : isVendor ? "vendor" : "purchaser",
      isReferral: tx.referredFirmId === firmId,
      createdAt: tx.createdAt,
      conveyancerName: contactId ? handlerName.get(contactId) ?? null : null,
      photoUrl: tx.photoStoragePath ? photoMap.get(tx.photoStoragePath) ?? null : null,
      stageLabel: null,
    };
  });

  // Live stage per active/on-hold file, read the same way the file page reads it
  // (round-scoped milestone rows → display stages). Bounded to STAGE_RESOLVE_CAP
  // files and resolved in parallel; completed/withdrawn files keep their status
  // pill and no stage. Each resolution degrades to null on failure — the row
  // still shows, just without a stage.
  const txById = new Map(transactions.map((t) => [t.id, t] as const));
  const resolvable = files.filter((f) => f.status === "active" || f.status === "on_hold").slice(0, STAGE_RESOLVE_CAP);
  await Promise.all(
    resolvable.map(async (f) => {
      try {
        const tx = txById.get(f.id);
        if (!tx) return;
        const { vendor, purchaser } = await getMilestonesForTransaction(f.id, agencyId);
        const rows = [...vendor, ...purchaser];
        if (rows.length === 0) return;
        f.stageLabel = currentStageLabel(
          resolveDisplayStages(
            rows,
            {
              expectedExchangeDate: tx.expectedExchangeDate ?? null,
              overridePredictedDate: tx.overridePredictedDate ?? null,
              targetCompletionDate: tx.completionDate ?? null,
            },
            tx.purchaseType ?? null,
          ),
        );
      } catch {
        // leave stageLabel null — the row still renders with its status pill
      }
    }),
  );

  const contacts: FirmContactRow[] = firm.handlers.map((h) => ({
    id: h.id,
    name: h.name,
    phone: h.phone,
    email: h.email,
    secondaryEmail: h.secondaryEmail,
    image: h.image,
    role: h.role,
    activeFileCount: activeByContact.get(h.id) ?? 0,
  }));

  return { id: firm.id, name: firm.name, contacts, files };
}

// ── Firm-wide recent activity ────────────────────────────────────────────────
export type FirmActivityItem = {
  id: string;
  at: Date;
  type: "email" | "call" | "note" | "message";
  title: string;
  detail: string | null;
  propertyAddress: string;
  transactionId: string;
};

function firmActivityBaseWhere(vis: AgentVisibility): Prisma.PropertyTransactionWhereInput {
  return vis.seeAll
    ? vis.firmName
      ? { agencyId: vis.agencyId, agentUser: { firmName: vis.firmName } }
      : { agencyId: vis.agencyId }
    : { OR: [{ agentUserId: vis.userId }, { assignedUserId: vis.userId }] };
}

export async function getSolicitorFirmActivity(vis: AgentVisibility, firmId: string): Promise<FirmActivityItem[]> {
  return firmActivityFromWhere(firmActivityBaseWhere(vis), vis.agencyId ?? null, firmId);
}
export async function getSolicitorFirmActivityForScope(scope: AccessScope, firmId: string): Promise<FirmActivityItem[]> {
  return firmActivityFromWhere(scopeTransactionWhere(scope), null, firmId);
}

async function firmActivityFromWhere(
  baseWhere: Prisma.PropertyTransactionWhereInput,
  agencyId: string | null,
  firmId: string,
): Promise<FirmActivityItem[]> {
  // The firm's visible files (scoped — so never another agency's files for this
  // shared firm). Addresses are joined back onto each activity row.
  const txs = await prisma.propertyTransaction.findMany({
    where: {
      ...baseWhere,
      status: { not: "draft" as TransactionStatus },
      OR: [{ vendorSolicitorFirmId: firmId }, { purchaserSolicitorFirmId: firmId }],
    },
    select: { id: true, propertyAddress: true },
  });
  if (txs.length === 0) return [];
  const addr = new Map(txs.map((t) => [t.id, t.propertyAddress] as const));

  const rows = await prisma.outboundMessage.findMany({
    where: {
      transactionId: { in: [...addr.keys()] },
      type: { in: ["outbound", "inbound", "internal_note"] },
      // Progression-business private notes stay hidden from the owning agency.
      ...(agencyId !== null ? { businessOnly: false } : {}),
      method: { not: "whatsapp" },
      // Drop automated chase-bookkeeping notes (shown only in the Chase timeline).
      NOT: { AND: [{ isAutomated: true }, { chaseTaskId: null }] },
    },
    orderBy: { createdAt: "desc" },
    take: 8,
    select: { id: true, type: true, method: true, content: true, createdAt: true, transactionId: true, subject: true },
  });

  return rows
    .filter((r): r is typeof r & { transactionId: string } => r.transactionId !== null)
    .map((r) => {
      const firstLine = (r.content ?? "").split("\n")[0].trim();
      const detail = firstLine ? (firstLine.length > 90 ? firstLine.slice(0, 90).trimEnd() + "…" : firstLine) : null;
      let type: FirmActivityItem["type"] = "note";
      let title = r.subject?.trim() || "Note added";
      if (r.method === "email") { type = "email"; title = r.type === "inbound" ? "Email received" : "Email sent"; }
      else if (r.method === "phone") { type = "call"; title = "Call logged"; }
      else if (r.method === "sms") { type = "message"; title = "Text logged"; }
      else if (r.method === "voicemail") { type = "call"; title = "Voicemail logged"; }
      return { id: r.id, at: r.createdAt, type, title, detail, propertyAddress: addr.get(r.transactionId) ?? "", transactionId: r.transactionId };
    });
}

/** An agency's private internal note about a shared solicitor firm (or null). */
export async function getAgencyFirmNote(agencyId: string, firmId: string): Promise<string | null> {
  const row = await prisma.agencyFirmNote.findUnique({
    where: { agencyId_solicitorFirmId: { agencyId, solicitorFirmId: firmId } },
    select: { note: true },
  });
  return row?.note ?? null;
}

// Removed getSolicitorDirectory (2026-10-09): dead, with no callers. It listed
// EVERY solicitor firm and ALL their handlers' name/phone/email platform-wide
// (scoping only the file counts to agencyId), so if ever rendered it would have
// exposed every solicitor contact on the platform to one agency. The live
// partners page uses getSolicitorDirectoryForScope / ...ForAgent, which start
// from the viewer's own visible files. Re-add scoped if a directory is needed.
