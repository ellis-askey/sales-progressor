import { commandDb } from "@/lib/command/prisma";
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
};

export async function getProspectDetail(id: string): Promise<ProspectDetail | null> {
  const p = await commandDb.prospect.findUnique({
    where: { id },
    include: {
      contacts: { orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] },
      activities: { orderBy: { occurredAt: "desc" }, take: 100 },
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
  };
}
