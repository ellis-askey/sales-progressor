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

export type AgencyEmailReadiness = {
  id: string;
  name: string;
  senderEmail: string | null;
  senderSet: boolean;
  domain: ReadinessDomain | null;
  level: ReadinessLevel;
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

  const domains = await commandDb.verifiedDomain.findMany({
    where: { agencyId: { in: agencies.map((a) => a.id) } },
    orderBy: { createdAt: "desc" },
  });

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
    return {
      id: a.id,
      name: a.name,
      senderEmail: a.quoteSenderEmail,
      senderSet,
      domain,
      level: levelFor(senderSet, domain),
    };
  });

  const readyCount = rows.filter((r) => r.level === "ready").length;
  return { rows, readyCount, total: rows.length };
}
