"use server";

// Saved chain-agent pool (critique #248). Agents typed onto chain links become
// reusable: the add/edit-link form ghost-completes the agency and agent name
// and autofills email + phone from the LATEST entry for that agent, so a repeat
// neighbour agent is a Tab-press, not re-typing. Like the saved-surveyors pick
// (app/actions/file-surveyors.ts), the pool is DERIVED from history at read
// time — no new table, no admin surface. The newest link row per agent wins, so
// correcting a number on the next entry quietly updates what gets suggested.
//
// Scoping mirrors the surveyor rule: you only see agents from chains YOUR
// organisation participates in (a chain counts when it contains one of your
// transactions). TSP internal staff share one TSP-wide pool; an external
// progression business gets its business's chains; an agency gets its own.

import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getAccessScope, scopeTransactionWhere } from "@/lib/security/access-scope";
import type { Prisma } from "@prisma/client";

export type SavedChainAgent = {
  agencyName: string;
  agentName: string | null;
  agentEmail: string | null;
  agentPhone: string | null;
};

export async function getSavedChainAgents(): Promise<SavedChainAgent[]> {
  const session = await requireSession();
  const scope = getAccessScope(session);

  // Internal TSP progressors share the whole TSP pool (not just their assigned
  // files) — the pool is team memory, like the surveyor directory.
  const businessId = session.user.progressionBusinessId ?? null;
  const isTspInternal =
    scope.kind === "all" || (scope.kind === "assigned" && !businessId);
  const txWhere: Prisma.PropertyTransactionWhereInput = isTspInternal
    ? scopeTransactionWhere({ kind: "all" })
    : businessId
      ? { progressionBusinessId: businessId, isDemo: false }
      : scopeTransactionWhere(scope);

  // Newest first, so the first row per agent is their latest details.
  const links = await prisma.chainLink.findMany({
    where: {
      stubAgencyName: { not: null },
      chain: { links: { some: { transaction: txWhere } } },
    },
    select: {
      stubAgencyName: true,
      stubAgentName: true,
      stubAgentEmail: true,
      stubAgentPhone: true,
    },
    orderBy: { updatedAt: "desc" },
    take: 500,
  });

  const seen = new Set<string>();
  const out: SavedChainAgent[] = [];
  for (const l of links) {
    const agency = l.stubAgencyName?.trim();
    if (!agency) continue;
    const name = l.stubAgentName?.trim() || null;
    const email = l.stubAgentEmail?.trim().toLowerCase() || null;
    // One entry per agent: keyed by email when we have one, else name + agency.
    // Agency-only rows still earn one entry so the agency name ghost-completes.
    const key = email ?? `${(name ?? "").toLowerCase()}|${agency.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      agencyName: agency,
      agentName: name,
      agentEmail: email,
      agentPhone: l.stubAgentPhone?.trim() || null,
    });
  }
  return out;
}
