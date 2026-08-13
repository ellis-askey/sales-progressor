// Command Centre → Files. Founder-facing operational view of any property:
// team time, client portal engagement, and the "no photo" upkeep queue.
// Superadmin-only (Law 8) — uses commandDb, no agency scoping.

import { commandDb } from "@/lib/command/prisma";

const INTERNAL_ROLES = new Set(["superadmin", "admin", "sales_progressor"]);

// Files that could still get a photo: live statuses only (a completed or
// withdrawn sale never needs one).
const LIVE_STATUSES = ["draft", "active", "on_hold"] as const;

export type NoPhotoFile = {
  id: string;
  address: string;
  agencyName: string;
  createdAt: Date;
};

// The "photos to add" upkeep queue: live files with no photo the founder
// hasn't dismissed. Oldest first (most likely to be worked or dismissed).
export async function getFilesNeedingPhoto(limit = 40): Promise<NoPhotoFile[]> {
  const rows = await commandDb.propertyTransaction.findMany({
    where: {
      photoStoragePath: null,
      photoReminderDismissedAt: null,
      status: { in: [...LIVE_STATUSES] },
    },
    select: {
      id: true,
      propertyAddress: true,
      createdAt: true,
      agency: { select: { name: true } },
    },
    orderBy: { createdAt: "asc" },
    take: limit,
  });
  return rows.map((r) => ({
    id: r.id,
    address: r.propertyAddress,
    agencyName: r.agency?.name ?? "—",
    createdAt: r.createdAt,
  }));
}

export async function countFilesNeedingPhoto(): Promise<number> {
  return commandDb.propertyTransaction.count({
    where: {
      photoStoragePath: null,
      photoReminderDismissedAt: null,
      status: { in: [...LIVE_STATUSES] },
    },
  });
}

export type FileSearchResult = {
  id: string;
  address: string;
  agencyName: string;
  status: string;
  hasPhoto: boolean;
};

export async function searchFiles(q: string, limit = 12): Promise<FileSearchResult[]> {
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
    hasPhoto: !!r.photoStoragePath,
  }));
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
  team: { totalSeconds: number; lastActiveAt: Date | null; members: TeamMember[] };
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
  const totalSeconds = members.reduce((a, m) => a + m.seconds, 0);

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
    team: { totalSeconds, lastActiveAt, members },
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
