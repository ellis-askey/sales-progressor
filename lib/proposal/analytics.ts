import "server-only";
import { prisma } from "@/lib/prisma";
import { hash } from "bcryptjs";
import { PROPOSAL_SLUG, PROPOSAL_SECTIONS } from "./config";

// Founder-only aggregation + administration for the proposal microsite. Reads
// the isolated Proposal* tables (no tenant scoping involved — these tables hold
// no customer data). Every read is wrapped so the admin page still renders
// before the migration is applied; it simply shows zeroes.

const SECTION_LABEL = new Map(PROPOSAL_SECTIONS.map((s) => [s.id, s.nav]));
const BCRYPT_COST = 12;

export interface InvitationStat {
  id: string;
  label: string;
  isOwner: boolean;
  revoked: boolean;
  sessions: number;
  authVisits: number;
  firstSeen: string | null;
  lastSeen: string | null;
  reachedClose: boolean;
  downloadedPdf: boolean;
}

export interface SectionStat {
  id: string;
  label: string;
  views: number;
  expands: number;
}

export interface TimelineEntry {
  at: string;
  kind: string;
  invitation: string;
  section: string | null;
  detail: string | null;
}

export interface ProposalOverview {
  migrated: boolean;
  revoked: boolean;
  epoch: number;
  totals: {
    authVisits: number;
    distinctSessions: number;
    reachedClose: number;
    pdfDownloads: number;
    returnVisits: number;
    failedAttempts7d: number;
  };
  invitations: InvitationStat[];
  sections: SectionStat[];
  calculators: { detail: string; opens: number }[];
  devices: { device: string; count: number }[];
  countries: { country: string; count: number }[];
  avgSessionSeconds: number | null;
  timeline: TimelineEntry[];
}

const EMPTY: ProposalOverview = {
  migrated: false,
  revoked: false,
  epoch: 1,
  totals: { authVisits: 0, distinctSessions: 0, reachedClose: 0, pdfDownloads: 0, returnVisits: 0, failedAttempts7d: 0 },
  invitations: [],
  sections: PROPOSAL_SECTIONS.filter((s) => s.inNav).map((s) => ({ id: s.id, label: s.nav, views: 0, expands: 0 })),
  calculators: [],
  devices: [],
  countries: [],
  avgSessionSeconds: null,
  timeline: [],
};

export async function getProposalOverview(slug = PROPOSAL_SLUG): Promise<ProposalOverview> {
  try {
    const [access, invitations, sessions, events, failedAttempts7d] = await Promise.all([
      prisma.proposalAccess.findUnique({ where: { slug } }),
      prisma.proposalInvitation.findMany({ where: { slug }, orderBy: { createdAt: "asc" } }),
      prisma.proposalSession.findMany({ where: { slug }, orderBy: { startedAt: "desc" } }),
      prisma.proposalEvent.findMany({ where: { slug }, orderBy: { occurredAt: "desc" }, take: 2000 }),
      prisma.proposalAuthAttempt.count({
        where: { slug, success: false, createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
      }),
    ]);

    const ownerInviteIds = new Set(invitations.filter((i) => i.isOwner).map((i) => i.id));
    const isHeadline = (invitationId: string | null) => !invitationId || !ownerInviteIds.has(invitationId);

    // Headline sessions exclude the owner's own review visits.
    const headlineSessions = sessions.filter((s) => isHeadline(s.invitationId));
    const headlineEvents = events.filter((e) => isHeadline(e.invitationId));

    // Per-invitation rollup.
    const invitationStats: InvitationStat[] = invitations.map((inv) => {
      const invSessions = sessions.filter((s) => s.invitationId === inv.id);
      const authVisits = events.filter((e) => e.invitationId === inv.id && e.kind === "auth_success").length;
      const times = invSessions.map((s) => s.startedAt.getTime());
      return {
        id: inv.id,
        label: inv.label,
        isOwner: inv.isOwner,
        revoked: !!inv.revokedAt,
        sessions: invSessions.length,
        authVisits,
        firstSeen: times.length ? new Date(Math.min(...times)).toISOString() : null,
        lastSeen: invSessions.length
          ? new Date(Math.max(...invSessions.map((s) => s.lastSeenAt.getTime()))).toISOString()
          : null,
        reachedClose: invSessions.some((s) => s.reachedClose),
        downloadedPdf: invSessions.some((s) => s.downloadedPdf),
      };
    });

    // Section views / expands (headline only).
    const sectionMap = new Map<string, { views: number; expands: number }>();
    for (const s of PROPOSAL_SECTIONS.filter((x) => x.inNav)) sectionMap.set(s.id, { views: 0, expands: 0 });
    for (const e of headlineEvents) {
      if (!e.sectionId) continue;
      const bucket = sectionMap.get(e.sectionId) ?? { views: 0, expands: 0 };
      if (e.kind === "section_view") bucket.views += 1;
      if (e.kind === "section_expand") bucket.expands += 1;
      sectionMap.set(e.sectionId, bucket);
    }
    const sectionStats: SectionStat[] = [...sectionMap.entries()].map(([id, v]) => ({
      id,
      label: SECTION_LABEL.get(id) ?? id,
      views: v.views,
      expands: v.expands,
    }));

    // Calculator opens by detail.
    const calcMap = new Map<string, number>();
    for (const e of headlineEvents.filter((e) => e.kind === "calculator_open" && e.detail)) {
      calcMap.set(e.detail!, (calcMap.get(e.detail!) ?? 0) + 1);
    }
    const calculators = [...calcMap.entries()]
      .map(([detail, opens]) => ({ detail, opens }))
      .sort((a, b) => b.opens - a.opens);

    // Device + country breakdown (headline sessions).
    const deviceMap = new Map<string, number>();
    const countryMap = new Map<string, number>();
    const durations: number[] = [];
    for (const s of headlineSessions) {
      deviceMap.set(s.device ?? "unknown", (deviceMap.get(s.device ?? "unknown") ?? 0) + 1);
      const c = s.country ?? "Unknown";
      countryMap.set(c, (countryMap.get(c) ?? 0) + 1);
      const dur = (s.lastSeenAt.getTime() - s.startedAt.getTime()) / 1000;
      if (dur > 0) durations.push(dur);
    }

    const timeline: TimelineEntry[] = headlineEvents.slice(0, 40).map((e) => ({
      at: e.occurredAt.toISOString(),
      kind: e.kind,
      invitation: invitations.find((i) => i.id === e.invitationId)?.label ?? "Unattributed",
      section: e.sectionId ? SECTION_LABEL.get(e.sectionId) ?? e.sectionId : null,
      detail: e.detail,
    }));

    return {
      migrated: true,
      revoked: !!access?.revokedAt,
      epoch: access?.sessionEpoch ?? 1,
      totals: {
        authVisits: headlineEvents.filter((e) => e.kind === "auth_success").length,
        distinctSessions: headlineSessions.length,
        reachedClose: headlineSessions.filter((s) => s.reachedClose).length,
        pdfDownloads: headlineSessions.filter((s) => s.downloadedPdf).length,
        returnVisits: headlineEvents.filter((e) => e.kind === "return_visit").length,
        failedAttempts7d,
      },
      invitations: invitationStats,
      sections: sectionStats,
      calculators,
      devices: [...deviceMap.entries()].map(([device, count]) => ({ device, count })).sort((a, b) => b.count - a.count),
      countries: [...countryMap.entries()].map(([country, count]) => ({ country, count })).sort((a, b) => b.count - a.count),
      avgSessionSeconds: durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : null,
      timeline,
    };
  } catch {
    return EMPTY;
  }
}

// ─── Administration mutations (called only from superadmin-gated routes) ─────

async function ensureAccessRow(slug = PROPOSAL_SLUG) {
  let row = await prisma.proposalAccess.findUnique({ where: { slug } });
  if (!row) {
    row = await prisma.proposalAccess.create({
      data: { slug, passwordHash: await hash(process.env.PROPOSAL_DEFAULT_PASSWORD || "2027", BCRYPT_COST) },
    });
  }
  return row;
}

/** Rotates the access password and invalidates every live session (epoch bump). */
export async function rotatePassword(newPassword: string, slug = PROPOSAL_SLUG): Promise<void> {
  await ensureAccessRow(slug);
  await prisma.proposalAccess.update({
    where: { slug },
    data: { passwordHash: await hash(newPassword, BCRYPT_COST), sessionEpoch: { increment: 1 } },
  });
}

/** Revokes every live session without changing the password. */
export async function revokeAllSessions(slug = PROPOSAL_SLUG): Promise<void> {
  await ensureAccessRow(slug);
  await prisma.proposalAccess.update({ where: { slug }, data: { sessionEpoch: { increment: 1 } } });
}

/** Turns the whole proposal off (or back on). */
export async function setProposalRevoked(revoked: boolean, slug = PROPOSAL_SLUG): Promise<void> {
  await ensureAccessRow(slug);
  await prisma.proposalAccess.update({
    where: { slug },
    data: { revokedAt: revoked ? new Date() : null },
  });
}

export async function setInvitationRevoked(invitationId: string, revoked: boolean): Promise<void> {
  await prisma.proposalInvitation.update({
    where: { id: invitationId },
    data: { revokedAt: revoked ? new Date() : null },
  });
}

export interface InvitationLink {
  id: string;
  label: string;
  isOwner: boolean;
  revoked: boolean;
  token: string;
}

export async function listInvitationLinks(slug = PROPOSAL_SLUG): Promise<InvitationLink[]> {
  try {
    const invs = await prisma.proposalInvitation.findMany({ where: { slug }, orderBy: { createdAt: "asc" } });
    return invs.map((i) => ({ id: i.id, label: i.label, isOwner: i.isOwner, revoked: !!i.revokedAt, token: i.token }));
  } catch {
    return [];
  }
}
