// Command Centre → Agencies: per-agency EMAIL readiness (outbound).
//
// Composes signals that already exist elsewhere into one per-agency view so the
// founder can see who is set up to send from their own domain and chase the
// gaps. No new state is stored: sender comes from Agency.quoteSenderEmail and
// domain auth from the VerifiedDomain rows the /command/email-senders screen and
// the agency's own self-serve screen both read (refreshed nightly by the
// check-domains cron). Serialisation mirrors the email-senders page so the same
// AgencyDomainAuth cell can render the domain row.

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

// ready       = domain authenticated (DKIM + SPF verified); mail sends as the agency
// setting_up  = a sender address or a pending domain exists, but not yet verified
// broken      = the domain was set up but its latest check failed (records missing)
// not_started = no sender address and no domain at all
export type ReadinessLevel = "ready" | "setting_up" | "broken" | "not_started";

// Inbound readiness: whether replies from clients and solicitors land back on
// the agency's files. Needs a connected mailbox (an Outlook connection on any
// user in the agency) and, ideally, recent inbound email actually captured.
export type InboundLevel = "ready" | "connected_quiet" | "none";

export type AgencyInboundReadiness = {
  connected: boolean;
  recentMessages: number;
  level: InboundLevel;
};

export type AgencyEmailReadiness = {
  id: string;
  name: string;
  senderEmail: string | null;
  senderSet: boolean;
  domain: ReadinessDomain | null;
  level: ReadinessLevel;
  inbound: AgencyInboundReadiness;
};

function levelFor(senderSet: boolean, domain: ReadinessDomain | null): ReadinessLevel {
  if (domain?.status === "verified") return "ready";
  if (domain?.status === "failed") return "broken";
  if (domain || senderSet) return "setting_up";
  return "not_started";
}

export async function getAgencyEmailReadiness(): Promise<{
  rows: AgencyEmailReadiness[];
  readyCount: number;
  total: number;
}> {
  const agencies = await commandDb.agency.findMany({
    where: { isInternal: false },
    select: { id: true, name: true, quoteSenderEmail: true },
    orderBy: { name: "asc" },
  });

  const agencyIds = agencies.map((a) => a.id);

  const domains = await commandDb.verifiedDomain.findMany({
    where: { agencyId: { in: agencyIds } },
    orderBy: { createdAt: "desc" },
  });

  // Which agencies have a connected mailbox: one query over every Outlook
  // connection whose owning user belongs to one of these agencies, collapsed
  // to a Set of agencyIds so the per-agency lookup below is O(1).
  const connections = await commandDb.outlookConnection.findMany({
    where: { user: { agencyId: { in: agencyIds } } },
    select: { user: { select: { agencyId: true } } },
  });
  const connectedAgencyIds = new Set(
    connections.map((c) => c.user?.agencyId).filter((id): id is string => !!id),
  );

  // Recent inbound email captured on each agency's files (last 30 days). One
  // count per agency, run in parallel rather than N+1 sequential awaits.
  const inboundSince = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const recentInboundCounts = await Promise.all(
    agencyIds.map((id) =>
      commandDb.outboundMessage.count({
        where: {
          agencyId: id,
          type: "inbound",
          method: "email",
          createdAt: { gte: inboundSince },
        },
      }),
    ),
  );
  const recentInboundByAgency = new Map(agencyIds.map((id, i) => [id, recentInboundCounts[i]]));

  const senderDomainOf = (email: string | null) => email?.split("@")[1]?.toLowerCase() ?? "";

  const rows: AgencyEmailReadiness[] = agencies.map((a) => {
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
    const connected = connectedAgencyIds.has(a.id);
    const recentMessages = recentInboundByAgency.get(a.id) ?? 0;
    const inboundLevel: InboundLevel = connected
      ? recentMessages > 0
        ? "ready"
        : "connected_quiet"
      : "none";
    return {
      id: a.id,
      name: a.name,
      senderEmail: a.quoteSenderEmail,
      senderSet,
      domain,
      level: levelFor(senderSet, domain),
      inbound: { connected, recentMessages, level: inboundLevel },
    };
  });

  const readyCount = rows.filter((r) => r.level === "ready").length;
  return { rows, readyCount, total: rows.length };
}
