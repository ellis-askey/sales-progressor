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

// ─── Phase 4: acquisition analytics, chain leads, conversion ─────────────────

// Stage order for the acquisition funnel. "lost" is terminal, not a stage, so
// it ranks -1 and never counts toward reached-stage totals.
const STAGE_RANK: Record<ProspectStatus, number> = {
  new: 0, contacted: 1, replied: 2, interested: 3, trial: 4, active: 5, lost: -1,
};

export type AcquisitionFunnel = {
  added: number;
  contacted: number;
  replied: number;
  interested: number;
  firstSale: number; // reached trial/active — an actual sale started
  active: number; // converted + still active TSP customer
  contactRate: number | null; // % of added we actually reached
  replyRate: number | null; // % of contacted who replied
  interestedRate: number | null; // % of replied who showed interest
  firstSaleRate: number | null; // % of interested who ran a sale
  activeRate: number | null; // % of first-sale who became active customers
  avgDaysToFirstSale: number | null;
  avgFollowUpsToConvert: number | null;
  bySource: Array<{ source: ProspectSource; added: number; converted: number }>;
  lostReasons: Array<{ reason: string; count: number }>;
};

// Funnel counts prospects by the FURTHEST stage they ever reached, derived from
// status_changed activities (not just current status) so a prospect who reached
// "interested" then went "lost" still counts at the interested stage.
export async function getAcquisitionFunnel(): Promise<AcquisitionFunnel> {
  const prospects = await commandDb.prospect.findMany({
    where: { archivedAt: null },
    select: {
      status: true, source: true, createdAt: true, convertedAt: true,
      lastContactedAt: true, followUpCount: true, lostReason: true,
      activities: { where: { type: "status_changed" }, select: { metadata: true } },
    },
  });

  let added = prospects.length, contacted = 0, replied = 0, interested = 0, firstSale = 0, active = 0;
  const daysToSale: number[] = [];
  const followUpsToConvert: number[] = [];
  const bySource = new Map<ProspectSource, { added: number; converted: number }>();
  const lost = new Map<string, number>();

  for (const p of prospects) {
    const reached = new Set<string>([p.status]);
    for (const a of p.activities) {
      const to = (a.metadata as { toStatus?: unknown } | null)?.toStatus;
      if (typeof to === "string") reached.add(to);
    }
    const maxRank = Math.max(-1, ...[...reached].map((s) => STAGE_RANK[s as ProspectStatus] ?? -1));

    if (p.lastContactedAt || maxRank >= 1) contacted++;
    if (maxRank >= 2) replied++;
    if (maxRank >= 3) interested++;
    if (maxRank >= 4) firstSale++;
    if (p.status === "active") active++;

    const b = bySource.get(p.source) ?? { added: 0, converted: 0 };
    b.added++;
    if (p.convertedAt) {
      b.converted++;
      daysToSale.push(Math.max(0, dayFloor(p.convertedAt.getTime(), p.createdAt.getTime())));
      followUpsToConvert.push(p.followUpCount);
    }
    bySource.set(p.source, b);

    if (p.status === "lost" && p.lostReason) lost.set(p.lostReason, (lost.get(p.lostReason) ?? 0) + 1);
  }

  const rate = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : null);
  const avg = (arr: number[]) => (arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null);

  return {
    added, contacted, replied, interested, firstSale, active,
    contactRate: rate(contacted, added),
    replyRate: rate(replied, contacted),
    interestedRate: rate(interested, replied),
    firstSaleRate: rate(firstSale, interested),
    activeRate: rate(active, firstSale),
    avgDaysToFirstSale: avg(daysToSale),
    avgFollowUpsToConvert: avg(followUpsToConvert),
    bySource: [...bySource.entries()].map(([source, v]) => ({ source, added: v.added, converted: v.converted })).sort((a, b) => b.added - a.added),
    lostReasons: [...lost.entries()].map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count),
  };
}

// Warm leads: agents invited into a chain who never claimed. These are people
// who already touched the product, so they're the highest-intent prospects. We
// exclude any chain link already pulled in as a prospect (by sourceChainLinkId).
export type ChainLead = {
  chainLinkId: string;
  agencyName: string | null;
  agentName: string | null;
  agentEmail: string;
  inviteStatus: string;
  invitedAt: Date | null;
  propertyAddress: string | null;
};

export async function getChainLeads(): Promise<ChainLead[]> {
  const used = await commandDb.prospect.findMany({
    where: { sourceChainLinkId: { not: null } },
    select: { sourceChainLinkId: true },
  });
  const usedIds = new Set(used.map((u) => u.sourceChainLinkId));

  const links = await commandDb.chainLink.findMany({
    where: {
      transactionId: null,
      claimedByUserId: null,
      stubAgentEmail: { contains: "@" },
      inviteStatus: { in: ["NOT_SENT", "SENT", "BOUNCED"] },
    },
    select: {
      id: true, stubAgencyName: true, stubAgentName: true, stubAgentEmail: true,
      inviteStatus: true, inviteSentAt: true, createdAt: true, stubPropertyAddress: true,
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return links
    .filter((l) => !usedIds.has(l.id) && l.stubAgentEmail)
    .map((l) => ({
      chainLinkId: l.id,
      agencyName: l.stubAgencyName,
      agentName: l.stubAgentName,
      agentEmail: l.stubAgentEmail as string,
      inviteStatus: l.inviteStatus,
      invitedAt: l.inviteSentAt ?? l.createdAt,
      propertyAddress: l.stubPropertyAddress,
    }));
}

// Once a prospect converts, this is the "was it worth it" rollup for the agency
// they became: real files on the platform + revenue banked at exchange.
export type ConvertedAgencyStats = { transactions: number; billedSales: number; bankedPence: number };

export async function getConvertedAgencyStats(agencyId: string): Promise<ConvertedAgencyStats> {
  const [transactions, billedSales, banked] = await Promise.all([
    commandDb.propertyTransaction.count({ where: { agencyId, isDemo: false } }),
    commandDb.invoiceLine.count({ where: { invoice: { agencyId } } }),
    commandDb.invoiceLine.aggregate({ where: { invoice: { agencyId } }, _sum: { totalPence: true } }),
  ]);
  return { transactions, billedSales, bankedPence: banked._sum.totalPence ?? 0 };
}

// Agency search for the manual "convert to agency" picker. Only real (non-internal)
// agencies not already linked to another prospect are eligible.
export type AgencyMatch = { id: string; name: string; createdAt: Date; alreadyLinked: boolean };

export async function searchAgenciesForConversion(q: string): Promise<AgencyMatch[]> {
  const term = q.trim();
  const rows = await commandDb.agency.findMany({
    where: {
      isInternal: false,
      ...(term ? { name: { contains: term, mode: "insensitive" } } : {}),
    },
    select: { id: true, name: true, createdAt: true, prospect: { select: { id: true } } },
    orderBy: { createdAt: "desc" },
    take: 12,
  });
  return rows.map((a) => ({ id: a.id, name: a.name, createdAt: a.createdAt, alreadyLinked: !!a.prospect }));
}
