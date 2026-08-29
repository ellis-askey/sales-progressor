import { commandDb } from "@/lib/command/prisma";
import { PROSPECT_STATUSES as STATUS_ORDER } from "@/lib/command/prospect-labels";
import type { ProspectStatus, ProspectSource } from "@prisma/client";

// Command Centre → Prospects. Read helpers for the acquisition-CRM list, detail
// drawer, and summary counts. Superadmin-gated at the action layer; all reads
// go through commandDb. See docs/active/prospects/00-implementation-plan.md.

export { PROSPECT_STATUSES, PROSPECT_SOURCES, STATUS_LABEL, SOURCE_LABEL, STATUS_TONE } from "@/lib/command/prospect-labels";

export type ProspectSummary = { total: number; followUpsDue: number; interested: number; trial: number; active: number };

export async function getProspectSummary(): Promise<ProspectSummary> {
  const now = new Date();
  const [total, followUpsDue, interested, trial, active] = await Promise.all([
    commandDb.prospect.count({ where: { archivedAt: null } }),
    commandDb.prospect.count({ where: { archivedAt: null, nextFollowUpAt: { lte: now }, status: { notIn: ["active", "lost"] } } }),
    commandDb.prospect.count({ where: { archivedAt: null, status: "interested" } }),
    commandDb.prospect.count({ where: { archivedAt: null, status: "trial" } }),
    commandDb.prospect.count({ where: { archivedAt: null, status: "active" } }),
  ]);
  return { total, followUpsDue, interested, trial, active };
}

export type ProspectFilter = { q?: string; status?: ProspectStatus | null; source?: ProspectSource | null };

export type ProspectListRow = {
  id: string;
  agencyName: string;
  branch: string | null;
  location: string | null;
  status: ProspectStatus;
  source: ProspectSource;
  primaryContactName: string | null;
  primaryContactRole: string | null;
  lastContactedAt: Date | null;
  nextFollowUpAt: Date | null;
  latestNote: string | null;
};

export async function getProspects(filter: ProspectFilter): Promise<ProspectListRow[]> {
  const q = filter.q?.trim();
  const rows = await commandDb.prospect.findMany({
    where: {
      archivedAt: null,
      ...(filter.status ? { status: filter.status } : {}),
      ...(filter.source ? { source: filter.source } : {}),
      ...(q
        ? {
            OR: [
              { agencyName: { contains: q, mode: "insensitive" } },
              { location: { contains: q, mode: "insensitive" } },
              { contacts: { some: { name: { contains: q, mode: "insensitive" } } } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 500,
    include: { contacts: { orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }], take: 1 } },
  });

  return rows.map((p) => {
    const c = p.contacts[0] ?? null;
    return {
      id: p.id,
      agencyName: p.agencyName,
      branch: p.branch,
      location: p.location,
      status: p.status,
      source: p.source,
      primaryContactName: c?.name ?? null,
      primaryContactRole: c?.jobTitle ?? null,
      lastContactedAt: p.lastContactedAt,
      nextFollowUpAt: p.nextFollowUpAt,
      latestNote: p.notes ? p.notes.slice(0, 140) : null,
    };
  });
}

export type ProspectDetail = {
  id: string;
  agencyName: string;
  branch: string | null;
  website: string | null;
  location: string | null;
  postcode: string | null;
  phone: string | null;
  generalEmail: string | null;
  branchCount: number | null;
  sizeNote: string | null;
  status: ProspectStatus;
  source: ProspectSource;
  notes: string | null;
  lastContactedAt: Date | null;
  nextFollowUpAt: Date | null;
  followUpCount: number;
  convertedAt: Date | null;
  convertedAgency: { id: string; name: string } | null;
  lostAt: Date | null;
  lostReason: string | null;
  optedOutAt: Date | null;
  bouncedAt: Date | null;
  contacts: Array<{
    id: string; name: string; jobTitle: string | null; email: string | null;
    phone: string | null; linkedinUrl: string | null; isDecisionMaker: boolean;
    isPrimary: boolean; preferredContact: string | null;
  }>;
  activities: Array<{ id: string; type: string; occurredAt: Date; summary: string | null; body: string | null; metadata: unknown }>;
  emails: Array<{
    id: string; subject: string; toEmail: string; sentAt: Date; deliveredAt: Date | null;
    openedAt: Date | null; clickedAt: Date | null; bouncedAt: Date | null; repliedAt: Date | null; aiGenerated: boolean;
  }>;
};

export async function getProspectDetail(id: string): Promise<ProspectDetail | null> {
  const p = await commandDb.prospect.findUnique({
    where: { id },
    include: {
      contacts: { orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] },
      activities: { orderBy: { occurredAt: "desc" }, take: 100 },
      emails: { orderBy: { sentAt: "desc" }, take: 50 },
      convertedAgency: { select: { id: true, name: true } },
    },
  });
  if (!p) return null;
  return {
    id: p.id,
    agencyName: p.agencyName,
    branch: p.branch,
    website: p.website,
    location: p.location,
    postcode: p.postcode,
    phone: p.phone,
    generalEmail: p.generalEmail,
    branchCount: p.branchCount,
    sizeNote: p.sizeNote,
    status: p.status,
    source: p.source,
    notes: p.notes,
    lastContactedAt: p.lastContactedAt,
    nextFollowUpAt: p.nextFollowUpAt,
    followUpCount: p.followUpCount,
    convertedAt: p.convertedAt,
    convertedAgency: p.convertedAgency,
    lostAt: p.lostAt,
    lostReason: p.lostReason,
    optedOutAt: p.optedOutAt,
    bouncedAt: p.bouncedAt,
    contacts: p.contacts.map((c) => ({
      id: c.id, name: c.name, jobTitle: c.jobTitle, email: c.email, phone: c.phone,
      linkedinUrl: c.linkedinUrl, isDecisionMaker: c.isDecisionMaker, isPrimary: c.isPrimary,
      preferredContact: c.preferredContact,
    })),
    activities: p.activities.map((a) => ({ id: a.id, type: a.type, occurredAt: a.occurredAt, summary: a.summary, body: a.body, metadata: a.metadata })),
    emails: p.emails.map((e) => ({
      id: e.id, subject: e.subject, toEmail: e.toEmail, sentAt: e.sentAt, deliveredAt: e.deliveredAt,
      openedAt: e.openedAt, clickedAt: e.clickedAt, bouncedAt: e.bouncedAt, repliedAt: e.repliedAt, aiGenerated: e.aiGenerated,
    })),
  };
}

// ─── Phase 2: follow-up queue + pipeline ─────────────────────────────────────

export type FollowUpBucket = "today" | "overdue" | "upcoming" | "all";

export type FollowUpRow = {
  id: string;
  agencyName: string;
  location: string | null;
  primaryContactName: string | null;
  status: ProspectStatus;
  source: ProspectSource;
  dueDate: Date;
  isRevisit: boolean;
  lastContactedAt: Date | null;
  daysSinceContact: number | null;
  lastActivity: string | null;
};

const dayFloor = (from: number, to: number) => Math.floor((from - to) / 86_400_000);

export async function getFollowUpQueue(bucket: FollowUpBucket): Promise<FollowUpRow[]> {
  const now = new Date();
  const startOfToday = new Date(now); startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(startOfToday); endOfToday.setDate(endOfToday.getDate() + 1);

  const rows = await commandDb.prospect.findMany({
    where: {
      archivedAt: null,
      status: { not: "active" },
      OR: [{ nextFollowUpAt: { not: null } }, { revisitAt: { not: null } }],
    },
    include: {
      contacts: { orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }], take: 1 },
      activities: { orderBy: { occurredAt: "desc" }, take: 1 },
    },
    take: 500,
  });

  const all: FollowUpRow[] = [];
  for (const p of rows) {
    const due = p.nextFollowUpAt ?? p.revisitAt;
    if (!due) continue;
    all.push({
      id: p.id,
      agencyName: p.agencyName,
      location: p.location,
      primaryContactName: p.contacts[0]?.name ?? null,
      status: p.status,
      source: p.source,
      dueDate: due,
      isRevisit: !p.nextFollowUpAt && !!p.revisitAt,
      lastContactedAt: p.lastContactedAt,
      daysSinceContact: p.lastContactedAt ? dayFloor(now.getTime(), p.lastContactedAt.getTime()) : null,
      lastActivity: p.activities[0]?.summary ?? null,
    });
  }

  return all
    .filter((r) => {
      const t = r.dueDate.getTime();
      if (bucket === "overdue") return t < startOfToday.getTime();
      if (bucket === "today") return t >= startOfToday.getTime() && t < endOfToday.getTime();
      if (bucket === "upcoming") return t >= endOfToday.getTime();
      return true;
    })
    .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
}

export type PipelineCard = {
  id: string;
  agencyName: string;
  location: string | null;
  primaryContactName: string | null;
  nextFollowUpAt: Date | null;
  source: ProspectSource;
};
export type PipelineColumn = { status: ProspectStatus; cards: PipelineCard[] };

export async function getPipeline(): Promise<PipelineColumn[]> {
  const rows = await commandDb.prospect.findMany({
    where: { archivedAt: null },
    include: { contacts: { orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }], take: 1 } },
    orderBy: { updatedAt: "desc" },
    take: 1000,
  });
  const byStatus = new Map<ProspectStatus, PipelineCard[]>();
  for (const s of STATUS_ORDER) byStatus.set(s, []);
  for (const p of rows) {
    (byStatus.get(p.status) ?? []).push({
      id: p.id,
      agencyName: p.agencyName,
      location: p.location,
      primaryContactName: p.contacts[0]?.name ?? null,
      nextFollowUpAt: p.nextFollowUpAt,
      source: p.source,
    });
  }
  return STATUS_ORDER.map((status) => ({ status, cards: byStatus.get(status) ?? [] }));
}

export async function getFollowUpCounts(): Promise<{ today: number; overdue: number; upcoming: number }> {
  const [today, overdue, upcoming] = await Promise.all([
    getFollowUpQueue("today"), getFollowUpQueue("overdue"), getFollowUpQueue("upcoming"),
  ]);
  return { today: today.length, overdue: overdue.length, upcoming: upcoming.length };
}
