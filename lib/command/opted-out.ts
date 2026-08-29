// Opted-out clients (Command Centre → Chasing hub tab).
//
// Clients who can't be auto-chased and so need a human nudge. Three states, all
// on Contact (see the chase cron, which reads the same three fields):
//   - unsubscribedAt    → opted out of ALL automated emails (client-set)
//   - emailsPausedAt     → chases paused indefinitely (agent-set)
//   - chasesPausedUntil  → chases paused until a date (client-set, auto-resumes)
//
// One row per client, strongest (most-silencing) reason wins. Active files only.

import { commandDb } from "@/lib/command/prisma";

export type OptedOutReason = "unsubscribed" | "agent_paused" | "chases_paused";

export type OptedOutRow = {
  clientName: string;
  role: "vendor" | "purchaser";
  transactionId: string;
  address: string;
  agencyName: string;
  reason: OptedOutReason;
  detail: string; // plain-English label for the "Why" column
  since: Date | null; // when the opt-out started (for sorting)
};

export async function getOptedOutClients(): Promise<OptedOutRow[]> {
  const now = new Date();
  const contacts = await commandDb.contact.findMany({
    where: {
      roleType: { in: ["vendor", "purchaser"] },
      transaction: { status: "active" },
      OR: [
        { unsubscribedAt: { not: null } },
        { chasesPausedUntil: { gt: now } },
        { emailsPausedAt: { not: null } },
      ],
    },
    select: {
      name: true,
      roleType: true,
      unsubscribedAt: true,
      chasesPausedUntil: true,
      emailsPausedAt: true,
      transaction: { select: { id: true, propertyAddress: true, agency: { select: { name: true } } } },
    },
  });

  const fmtDate = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  const rows: OptedOutRow[] = contacts.map((c) => {
    let reason: OptedOutReason;
    let detail: string;
    let since: Date | null;
    // Strongest reason first: a full unsubscribe silences the most, then an
    // indefinite agent pause, then a timed client pause.
    if (c.unsubscribedAt) {
      reason = "unsubscribed"; detail = "Opted out of all emails"; since = c.unsubscribedAt;
    } else if (c.emailsPausedAt) {
      reason = "agent_paused"; detail = "Chases paused by the team"; since = c.emailsPausedAt;
    } else {
      reason = "chases_paused"; detail = `Chases paused until ${fmtDate(c.chasesPausedUntil!)}`; since = c.chasesPausedUntil;
    }
    return {
      clientName: c.name,
      role: c.roleType as "vendor" | "purchaser",
      transactionId: c.transaction.id,
      address: c.transaction.propertyAddress,
      agencyName: c.transaction.agency?.name ?? "Unknown agency",
      reason,
      detail,
      since,
    };
  });

  rows.sort((a, b) => (b.since?.getTime() ?? 0) - (a.since?.getTime() ?? 0));
  return rows;
}

export async function getOptedOutCount(): Promise<number> {
  const now = new Date();
  return commandDb.contact.count({
    where: {
      roleType: { in: ["vendor", "purchaser"] },
      transaction: { status: "active" },
      OR: [
        { unsubscribedAt: { not: null } },
        { chasesPausedUntil: { gt: now } },
        { emailsPausedAt: { not: null } },
      ],
    },
  });
}
