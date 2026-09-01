// Command Centre → Files. Founder-facing operational view of any property:
// team time, client portal engagement, and the "no photo" upkeep queue.
// Superadmin-only (Law 8) — uses commandDb, no agency scoping.

import { commandDb } from "@/lib/command/prisma";
import { listStoredPhotoTxIds } from "@/lib/supabase-storage";
import { activitySecondsByFile } from "@/lib/command/activity-time";

const INTERNAL_ROLES = new Set(["superadmin", "admin", "sales_progressor"]);

// Files that are still "live" work: a draft isn't started, and a completed or
// withdrawn sale never needs upkeep. Both the photo queue and the browsable
// list use this set. Demo + internal-agency files are excluded separately.
const LIVE_STATUSES = ["active", "on_hold"] as const;

// Shared "real live customer file" filter — live status, not demo, not an
// internal/test agency. Matches the rest of the Command Centre.
const LIVE_FILE_WHERE = {
  status: { in: [...LIVE_STATUSES] as ("active" | "on_hold")[] },
  isDemo: false,
  agency: { isInternal: false },
};

export type NoPhotoFile = {
  id: string;
  address: string;
  agencyName: string;
  createdAt: Date;
};

// The "photos to add" upkeep queue: live customer files with genuinely no photo
// the founder hasn't dismissed. Storage-aware — a file whose image is already in
// the bucket (but whose DB field was never persisted by the agent two-step
// upload) is NOT flagged, so this stops showing false positives. Oldest first.
export async function getPhotoQueue(
  storedIds?: Set<string>,
  limit = 40,
): Promise<{ files: NoPhotoFile[]; count: number }> {
  const stored = storedIds ?? (await listStoredPhotoTxIds());
  const candidates = await commandDb.propertyTransaction.findMany({
    where: {
      ...LIVE_FILE_WHERE,
      photoStoragePath: null,
      photoReminderDismissedAt: null,
    },
    select: {
      id: true,
      propertyAddress: true,
      createdAt: true,
      agency: { select: { name: true } },
    },
    orderBy: { createdAt: "asc" },
  });
  const missing = candidates.filter((c) => !stored.has(c.id));
  return {
    count: missing.length,
    files: missing.slice(0, limit).map((r) => ({
      id: r.id,
      address: r.propertyAddress,
      agencyName: r.agency?.name ?? "—",
      createdAt: r.createdAt,
    })),
  };
}

export type FileSearchResult = {
  id: string;
  address: string;
  agencyName: string;
  status: string;
  hasPhoto: boolean;
};

export async function searchFiles(q: string, storedIds?: Set<string>, limit = 12): Promise<FileSearchResult[]> {
  const term = q.trim();
  if (!term) return [];
  const rows = await commandDb.propertyTransaction.findMany({
    where: { propertyAddress: { contains: term, mode: "insensitive" } },
    select: {
      id: true,
      propertyAddress: true,
      status: true,
      photoStoragePath: true,
      agency: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return rows.map((r) => ({
    id: r.id,
    address: r.propertyAddress,
    agencyName: r.agency?.name ?? "—",
    status: r.status,
    hasPhoto: !!r.photoStoragePath || (storedIds?.has(r.id) ?? false),
  }));
}

// ── Browsable live-files list ─────────────────────────────────────────────────
// The default view when not searching: real live customer files with at-a-glance
// operational health, each opening the operational panel. Distinct from Today
// (milestone-stuck) and Agencies (agent activity) — this is per-file operational
// state (who's touched it, photo, exchange proximity).
export type FileAttention = "no_photo" | "exchange_soon" | "idle";
export type FileListRow = {
  id: string;
  address: string;
  agencyName: string;
  status: string;
  hasPhoto: boolean;
  lastTeamActivityAt: Date | null;
  teamSeconds: number;
  exchangeDate: Date | null;
  daysToExchange: number | null;
  attention: FileAttention[];
};

const IDLE_DAYS = 14;
const EXCHANGE_SOON_DAYS = 14;

export async function getFilesList(opts: {
  storedIds?: Set<string>;
  status?: "active" | "on_hold";
  attention?: FileAttention;
  limit?: number;
}): Promise<{ rows: FileListRow[]; total: number }> {
  const stored = opts.storedIds ?? (await listStoredPhotoTxIds());
  const limit = opts.limit ?? 100;

  const files = await commandDb.propertyTransaction.findMany({
    where: {
      ...LIVE_FILE_WHERE,
      ...(opts.status ? { status: opts.status } : {}),
    },
    select: {
      id: true,
      propertyAddress: true,
      status: true,
      photoStoragePath: true,
      expectedExchangeDate: true,
      overridePredictedDate: true,
      agency: { select: { name: true } },
    },
    take: 400,
  });
  const ids = files.map((f) => f.id);

  // Team activity per file, batched: last touch (any session) + engaged seconds
  // (closed sessions only).
  const [lastAgg, secAgg] = ids.length
    ? await Promise.all([
        commandDb.fileTimeSession.groupBy({
          by: ["transactionId"],
          where: { transactionId: { in: ids } },
          _max: { lastActivityAt: true },
        }),
        commandDb.fileTimeSession.groupBy({
          by: ["transactionId"],
          where: { transactionId: { in: ids }, endedAt: { not: null } },
          _sum: { totalEngagedSeconds: true },
        }),
      ])
    : [[], []];
  const lastMap = new Map(lastAgg.map((g) => [g.transactionId, g._max.lastActivityAt ?? null]));
  const secMap = new Map(secAgg.map((g) => [g.transactionId, g._sum.totalEngagedSeconds ?? 0]));
  // Weighted comms effort (WhatsApp/email/calls/notes) added on top of measured time.
  const activityMap = await activitySecondsByFile(commandDb, ids);

  const now = Date.now();
  let rows: FileListRow[] = files.map((f) => {
    const hasPhoto = !!f.photoStoragePath || stored.has(f.id);
    const lastTeamActivityAt = lastMap.get(f.id) ?? null;
    // NB: PropertyTransaction.predictedExchangeDate is a dead column (never
    // written), so it was dropped from this fallback — it was always null.
    // overridePredictedDate (manual) wins over the persisted prediction.
    const exchangeDate = f.overridePredictedDate ?? f.expectedExchangeDate ?? null;
    const daysToExchange = exchangeDate
      ? Math.round((new Date(exchangeDate).getTime() - now) / 86_400_000)
      : null;
    const attention: FileAttention[] = [];
    if (!hasPhoto) attention.push("no_photo");
    if (daysToExchange != null && daysToExchange >= 0 && daysToExchange <= EXCHANGE_SOON_DAYS) attention.push("exchange_soon");
    if (!lastTeamActivityAt || now - lastTeamActivityAt.getTime() > IDLE_DAYS * 86_400_000) attention.push("idle");
    return {
      id: f.id,
      address: f.propertyAddress,
      agencyName: f.agency?.name ?? "—",
      status: f.status,
      hasPhoto,
      lastTeamActivityAt,
      teamSeconds: (secMap.get(f.id) ?? 0) + (activityMap.get(f.id) ?? 0),
      exchangeDate,
      daysToExchange,
      attention,
    };
  });

  if (opts.attention) rows = rows.filter((r) => r.attention.includes(opts.attention!));

  // Most recently worked first; never-touched sink to the bottom.
  rows.sort((a, b) => (b.lastTeamActivityAt?.getTime() ?? 0) - (a.lastTeamActivityAt?.getTime() ?? 0));

  return { rows: rows.slice(0, limit), total: rows.length };
}

export type TeamMember = { name: string; role: string; internal: boolean; seconds: number };
export type ClientEngagement = {
  name: string;
  role: string; // vendor | purchaser
  seconds: number;
  measuredSessions: number;
  visitDays: number;
  lastVisit: Date | null;
  quiet: boolean;
};
export type FileOperational = {
  id: string;
  address: string;
  agencyName: string;
  status: string;
  hasPhoto: boolean;
  photoUrl: string | null;
  // totalSeconds = measured focus-time + commsSeconds (weighted comms effort).
  team: { totalSeconds: number; commsSeconds: number; lastActiveAt: Date | null; members: TeamMember[] };
  clients: ClientEngagement[];
};

export async function getFileOperational(txId: string): Promise<FileOperational | null> {
  const tx = await commandDb.propertyTransaction.findUnique({
    where: { id: txId },
    select: {
      id: true,
      propertyAddress: true,
      status: true,
      photoStoragePath: true,
      activeBuyerRoundId: true,
      agency: { select: { name: true } },
    },
  });
  if (!tx) return null;

  // ── Team time — real engaged seconds, summed per user from closed sessions.
  const sessions = await commandDb.fileTimeSession.findMany({
    where: { transactionId: txId },
    select: { userId: true, totalEngagedSeconds: true, endedAt: true, lastActivityAt: true },
  });
  const byUser = new Map<string, number>();
  let lastActiveAt: Date | null = null;
  for (const s of sessions) {
    if (s.endedAt && s.totalEngagedSeconds) {
      byUser.set(s.userId, (byUser.get(s.userId) ?? 0) + s.totalEngagedSeconds);
    }
    if (!lastActiveAt || s.lastActivityAt > lastActiveAt) lastActiveAt = s.lastActivityAt;
  }
  const userIds = [...byUser.keys()];
  const users = userIds.length
    ? await commandDb.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, role: true } })
    : [];
  const userMap = new Map(users.map((u) => [u.id, u]));
  const members: TeamMember[] = userIds
    .map((id) => {
      const u = userMap.get(id);
      const role = u?.role ?? "";
      return { name: u?.name ?? "Unknown", role, internal: INTERNAL_ROLES.has(role), seconds: byUser.get(id)! };
    })
    .sort((a, b) => b.seconds - a.seconds);
  const measuredSeconds = members.reduce((a, m) => a + m.seconds, 0);
  // Weighted comms effort on the file (WhatsApp/email/calls/notes), added on top
  // of the measured focus-time. File-level: includes inbound, which has no author.
  const commsSeconds = (await activitySecondsByFile(commandDb, [txId])).get(txId) ?? 0;
  const totalSeconds = measuredSeconds + commsSeconds;

  // ── Client engagement — vendor + active-round purchaser contacts only.
  const contacts = await commandDb.contact.findMany({
    where: {
      propertyTransactionId: txId,
      portalToken: { not: null },
      roleType: { in: ["vendor", "purchaser"] },
    },
    select: {
      id: true,
      name: true,
      roleType: true,
      buyerRoundId: true,
      lastVisitedPortalAt: true,
      _count: { select: { portalVisits: true } },
    },
  });
  const activeContacts = contacts.filter(
    (c) => c.roleType === "vendor" || c.buyerRoundId == null || c.buyerRoundId === tx.activeBuyerRoundId,
  );

  const contactIds = activeContacts.map((c) => c.id);
  const ptSessions = contactIds.length
    ? await commandDb.portalTimeSession.findMany({
        where: { contactId: { in: contactIds }, endedAt: { not: null } },
        select: { contactId: true, totalEngagedSeconds: true },
      })
    : [];
  const ptByContact = new Map<string, { sec: number; n: number }>();
  for (const s of ptSessions) {
    const cur = ptByContact.get(s.contactId) ?? { sec: 0, n: 0 };
    cur.sec += s.totalEngagedSeconds ?? 0;
    cur.n += 1;
    ptByContact.set(s.contactId, cur);
  }

  const now = Date.now();
  const clients: ClientEngagement[] = activeContacts.map((c) => {
    const pt = ptByContact.get(c.id) ?? { sec: 0, n: 0 };
    const visitDays = c._count.portalVisits;
    const lastVisit = c.lastVisitedPortalAt;
    // "Gone quiet" — engaged before (2+ visit-days) then nothing for 14 days.
    const quiet = !!lastVisit && visitDays >= 2 && now - lastVisit.getTime() > 14 * 86_400_000;
    return {
      name: c.name,
      role: c.roleType,
      seconds: pt.sec,
      measuredSessions: pt.n,
      visitDays,
      lastVisit,
      quiet,
    };
  });

  // ── Photo thumbnail (signed on read; storage URLs expire hourly).
  let photoUrl: string | null = null;
  if (tx.photoStoragePath) {
    try {
      const { getSignedUrl } = await import("@/lib/supabase-storage");
      photoUrl = await getSignedUrl(tx.photoStoragePath, 3600);
    } catch {
      // fall back to the "has photo" badge without a thumbnail
    }
  }

  return {
    id: tx.id,
    address: tx.propertyAddress,
    agencyName: tx.agency?.name ?? "—",
    status: tx.status,
    hasPhoto: !!tx.photoStoragePath,
    photoUrl,
    team: { totalSeconds, commsSeconds, lastActiveAt, members },
    clients,
  };
}

// "Dismiss forever" — drop a file off the no-photo upkeep queue.
export async function dismissPhotoReminder(txId: string): Promise<void> {
  await commandDb.propertyTransaction.update({
    where: { id: txId },
    data: { photoReminderDismissedAt: new Date() },
  });
}
