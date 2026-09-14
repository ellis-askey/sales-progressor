// Command Centre → Agencies: per-agency SETUP readiness.
//
// One per-agency view of everything an agency should set up for the best client
// experience, so the founder can see the gaps at a glance and chase (or set
// things on the agency's behalf via the agent drill-down). Composes signals
// that already exist elsewhere; no new state is stored.
//
// Signals, and where each comes from:
//   Email     sender    Agency.quoteSenderEmail
//             DNS       VerifiedDomain rows (refreshed nightly by check-domains)
//             inbound   Outlook connection on any agency user + recent inbound
//   Experience signature per-user User.emailSignatureMode / image / html
//             photo     per-user User.image
//             logo      Agency.logoPath
//             branding  Agency.emailTheme
//   Team      brought on  agency user count + open director/negotiator invites
//
// Serialisation of the domain row mirrors the email-senders page so the same
// AgencyDomainAuth cell can render it.

import { commandDb } from "@/lib/command/prisma";

export type ReadinessDomain = {
  id: string;
  domain: string;
  status: string;
  dkimValid: boolean;
  spfValid: boolean;
  cnameRecords: { host: string; data: string; type: string }[];
  verifiedAt: string | null;
  lastCheckedAt: string | null;
};

// ready       = every scored signal done (sender, DNS, signature, photo, logo, branding)
// setting_up  = some but not all scored signals done
// broken      = the sending domain was set up but its latest check failed
// not_started = no scored signal done at all
export type ReadinessLevel = "ready" | "setting_up" | "broken" | "not_started";

// Inbound readiness: whether replies from clients and solicitors land back on
// the agency's files. Shown as a tick but NOT scored into the pill (it needs a
// connected mailbox, which is a separate, rarer step).
export type InboundLevel = "ready" | "connected_quiet" | "none";

export type AgencyInboundReadiness = {
  connected: boolean;
  recentMessages: number;
  level: InboundLevel;
};

// One person in the agency, for the per-user breakdown on the expanded row.
export type ReadinessMember = {
  id: string;
  name: string;
  role: string;
  hasPhoto: boolean;
  hasSignature: boolean;
};

export type AgencySetupReadiness = {
  id: string;
  name: string;
  // Email
  senderEmail: string | null;
  senderSet: boolean;
  domain: ReadinessDomain | null;
  inbound: AgencyInboundReadiness;
  // Experience
  signature: { done: boolean; total: number; withSignature: number };
  photo: { done: boolean; total: number; withPhoto: number };
  logoSet: boolean;
  emailThemeSet: boolean;
  // Team (informational, not scored)
  team: { done: boolean; userCount: number; invitationCount: number };
  members: ReadinessMember[];
  // First director (else first member) — deep-link target for agency-level edits
  // (logo / branding are edited from the agent drill-down at /command/agencies/[userId]).
  primaryUserId: string | null;
  // Rollup
  level: ReadinessLevel;
  doneCount: number; // of the scored signals
  totalSignals: number; // scored signals only (6)
};

// The 6 scored signals that determine the pill and the doneCount.
const SCORED_SIGNAL_COUNT = 6;

// A signature counts as done only once personalised. BASIC is the auto-generated
// default that every user starts with, so it reads as "not yet done".
function signaturePersonalised(u: {
  emailSignatureMode: string;
  emailSignatureImagePath: string | null;
  emailSignatureHtml: string | null;
}): boolean {
  return (
    u.emailSignatureMode === "IMAGE" ||
    u.emailSignatureMode === "CUSTOM" ||
    !!u.emailSignatureImagePath ||
    !!u.emailSignatureHtml
  );
}

export async function getAgencySetupReadiness(): Promise<{
  rows: AgencySetupReadiness[];
  readyCount: number;
  total: number;
}> {
  const agencies = await commandDb.agency.findMany({
    where: { isInternal: false },
    select: {
      id: true,
      name: true,
      quoteSenderEmail: true,
      logoPath: true,
      emailTheme: true,
    },
    orderBy: { name: "asc" },
  });

  const agencyIds = agencies.map((a) => a.id);

  const domains = await commandDb.verifiedDomain.findMany({
    where: { agencyId: { in: agencyIds } },
    orderBy: { createdAt: "desc" },
  });

  // Every director/negotiator across these agencies, for the experience + team
  // signals. One query, bucketed by agency below.
  const users = await commandDb.user.findMany({
    where: { agencyId: { in: agencyIds }, role: { in: ["director", "negotiator"] } },
    select: {
      id: true,
      name: true,
      role: true,
      agencyId: true,
      image: true,
      emailSignatureMode: true,
      emailSignatureImagePath: true,
      emailSignatureHtml: true,
    },
    orderBy: { name: "asc" },
  });
  const usersByAgency = new Map<string, typeof users>();
  for (const u of users) {
    if (!u.agencyId) continue;
    const list = usersByAgency.get(u.agencyId) ?? [];
    list.push(u);
    usersByAgency.set(u.agencyId, list);
  }

  // Open (non-cancelled) team invitations, counted per agency across both types.
  const [dirInvites, negInvites] = await Promise.all([
    commandDb.directorInvitation.groupBy({
      by: ["agencyId"],
      where: { agencyId: { in: agencyIds }, cancelledAt: null },
      _count: { _all: true },
    }),
    commandDb.negotiatorInvitation.groupBy({
      by: ["agencyId"],
      where: { agencyId: { in: agencyIds }, cancelledAt: null },
      _count: { _all: true },
    }),
  ]);
  const invitesByAgency = new Map<string, number>();
  for (const g of [...dirInvites, ...negInvites]) {
    invitesByAgency.set(g.agencyId, (invitesByAgency.get(g.agencyId) ?? 0) + g._count._all);
  }

  // Which agencies have a connected mailbox, collapsed to a Set for O(1) lookup.
  const connections = await commandDb.outlookConnection.findMany({
    where: { user: { agencyId: { in: agencyIds } } },
    select: { user: { select: { agencyId: true } } },
  });
  const connectedAgencyIds = new Set(
    connections.map((c) => c.user?.agencyId).filter((id): id is string => !!id),
  );

  // Recent inbound email captured on each agency's files (last 30 days).
  const inboundSince = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const recentInboundCounts = await Promise.all(
    agencyIds.map((id) =>
      commandDb.outboundMessage.count({
        where: { agencyId: id, type: "inbound", method: "email", createdAt: { gte: inboundSince } },
      }),
    ),
  );
  const recentInboundByAgency = new Map(agencyIds.map((id, i) => [id, recentInboundCounts[i]]));

  const senderDomainOf = (email: string | null) => email?.split("@")[1]?.toLowerCase() ?? "";

  const rows: AgencySetupReadiness[] = agencies.map((a) => {
    const mine = domains.filter((d) => d.agencyId === a.id);
    // Prefer the domain matching the sender email; else the most recent.
    const chosen = mine.find((d) => d.domain === senderDomainOf(a.quoteSenderEmail)) ?? mine[0] ?? null;
    const domain: ReadinessDomain | null = chosen
      ? {
          id: chosen.id,
          domain: chosen.domain,
          status: chosen.status,
          dkimValid: chosen.dkimValid,
          spfValid: chosen.spfValid,
          cnameRecords: (chosen.cnameRecords as { host: string; data: string; type: string }[]) ?? [],
          verifiedAt: chosen.verifiedAt ? chosen.verifiedAt.toISOString() : null,
          lastCheckedAt: chosen.lastCheckedAt ? chosen.lastCheckedAt.toISOString() : null,
        }
      : null;

    const senderSet = !!a.quoteSenderEmail;
    const dnsDone = domain?.status === "verified";

    // Inbound (informational)
    const connected = connectedAgencyIds.has(a.id);
    const recentMessages = recentInboundByAgency.get(a.id) ?? 0;
    const inboundLevel: InboundLevel = connected
      ? recentMessages > 0
        ? "ready"
        : "connected_quiet"
      : "none";

    // Experience — per-user signals, director-anchored (Decision 1).
    const members = usersByAgency.get(a.id) ?? [];
    const directors = members.filter((m) => m.role === "director");
    const anchor = directors.length > 0 ? directors : members;

    const withPhoto = members.filter((m) => !!m.image).length;
    const photoDone = anchor.length > 0 && anchor.every((m) => !!m.image);

    const withSignature = members.filter((m) => signaturePersonalised(m)).length;
    const signatureDone = anchor.length > 0 && anchor.every((m) => signaturePersonalised(m));

    const logoSet = !!a.logoPath;
    const emailThemeSet = a.emailTheme != null;

    // Team (informational, not scored) — Decision 3.
    const invitationCount = invitesByAgency.get(a.id) ?? 0;
    const teamDone = members.length > 1 || invitationCount > 0;

    // Rollup over the 6 scored signals.
    const scored = [senderSet, !!dnsDone, signatureDone, photoDone, logoSet, emailThemeSet];
    const doneCount = scored.filter(Boolean).length;
    let level: ReadinessLevel;
    if (domain?.status === "failed") level = "broken";
    else if (doneCount === SCORED_SIGNAL_COUNT) level = "ready";
    else if (doneCount === 0) level = "not_started";
    else level = "setting_up";

    return {
      id: a.id,
      name: a.name,
      senderEmail: a.quoteSenderEmail,
      senderSet,
      domain,
      inbound: { connected, recentMessages, level: inboundLevel },
      signature: { done: signatureDone, total: members.length, withSignature },
      photo: { done: photoDone, total: members.length, withPhoto },
      logoSet,
      emailThemeSet,
      team: { done: teamDone, userCount: members.length, invitationCount },
      members: members.map((m) => ({
        id: m.id,
        name: m.name,
        role: m.role,
        hasPhoto: !!m.image,
        hasSignature: signaturePersonalised(m),
      })),
      primaryUserId: (directors[0] ?? members[0])?.id ?? null,
      level,
      doneCount,
      totalSignals: SCORED_SIGNAL_COUNT,
    };
  });

  const readyCount = rows.filter((r) => r.level === "ready").length;
  return { rows, readyCount, total: rows.length };
}
