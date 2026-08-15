// lib/integrations/outlook/roster.ts
//
// The "expected mailboxes" a person can connect — the addresses we actually
// send from. Derived from each agency's stored sending address
// (Agency.quoteSenderEmail) plus the Sales Progressor mailbox, so the list
// stays correct as agencies come and go (nothing hard-coded).
//
// Scoped by caller (Law 7): internal staff (no agencyId) see every agency's
// address; an agency user sees only their own. Never leak one agency's
// sending address to another.

import "server-only";
import { prisma } from "@/lib/prisma";

// The Sales Progressor mailbox — also the fallback quote sender. Mirrors
// SP_FALLBACK_EMAIL in app/quote/[token]/actions.ts.
const SP_MAILBOX: RosterEntry = {
  label: "Sales Progressor",
  email: "ellis@thesalesprogressor.co.uk",
};

export type RosterEntry = { label: string; email: string };

export async function getOutlookRoster(opts: {
  agencyId: string | null;
  internal: boolean;
}): Promise<RosterEntry[]> {
  const agencies = await prisma.agency.findMany({
    where: opts.internal
      ? { quoteSenderEmail: { not: null } }
      : { id: opts.agencyId ?? "__none__", quoteSenderEmail: { not: null } },
    select: { name: true, quoteSenderEmail: true },
    orderBy: { name: "asc" },
  });

  // Internal staff also get the shared Sales Progressor mailbox at the top.
  const entries: RosterEntry[] = opts.internal ? [SP_MAILBOX] : [];
  for (const a of agencies) {
    if (a.quoteSenderEmail) entries.push({ label: a.name, email: a.quoteSenderEmail });
  }

  // Dedupe by lowercased email (an agency may share the SP fallback address).
  const seen = new Set<string>();
  const deduped: RosterEntry[] = [];
  for (const e of entries) {
    const key = e.email.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(e);
  }
  return deduped;
}
