// Lean inviting-progressor lookups. Deliberately SEPARATE from
// lib/services/progression-clients: that module statically imports the client-agent
// invite email sender (-> lib/email -> lib/integrations/smtp/imap, which are
// server-only and use node builtins net/tls/dns). These two helpers are reached by
// lib/agent-session (via lib/security/access-scope), which is itself pulled into the
// client bundle through a client component that imports lib/services/work-queue. If
// these lived in progression-clients, that email/SMTP chain would land in the
// browser graph and break the Turbopack build. Keeping them here (prisma +
// client-fees only) keeps agent-session's graph client-safe.

import { prisma } from "@/lib/prisma";
import { parseFeeModel, type ClientFeeModel } from "@/lib/progression/client-fees";

/**
 * The name of the progression business that invited this agency (its
 * ProgressionBusinessClient link), or null if the agency self-signed-up. Used to
 * tailor onboarding copy for a progressor-invited agent. One cheap lookup.
 */
export async function getInvitingProgressorName(agencyId: string | null | undefined): Promise<string | null> {
  if (!agencyId) return null;
  const link = await prisma.progressionBusinessClient.findFirst({
    where: { agencyId, removedAt: null }, // ignore archived client links (audit SP-polish)
    // An agency can now have several progressors; order so this "primary" name is
    // deterministic (the earliest-connected business) rather than arbitrary. Copy
    // that must list ALL progressors should use getProgressorsForAgency instead.
    orderBy: { createdAt: "asc" },
    select: { progressionBusiness: { select: { name: true } } },
  });
  return link?.progressionBusiness?.name ?? null;
}

export type InvitingProgressor = { businessId: string; name: string; feeModel: ClientFeeModel | null };

/**
 * The full inviting-progressor context for an agency: the business id (to tag a
 * sale's progressionBusinessId when the agent sends it to them), the name (for
 * copy) and the per-client rate card (to price the sale from the agent's side).
 * Null when the agency self-signed-up. Used by the New Sale flow.
 */
export async function getInvitingProgressor(agencyId: string | null | undefined): Promise<InvitingProgressor | null> {
  if (!agencyId) return null;
  const link = await prisma.progressionBusinessClient.findFirst({
    where: { agencyId, removedAt: null }, // ignore archived client links (audit SP-polish)
    orderBy: { createdAt: "asc" }, // deterministic "primary" when several exist
    select: { progressionBusinessId: true, feeModel: true, progressionBusiness: { select: { name: true } } },
  });
  if (!link) return null;
  return { businessId: link.progressionBusinessId, name: link.progressionBusiness.name, feeModel: parseFeeModel(link.feeModel) };
}

/**
 * ALL progression businesses an agency is a client of (non-removed links), earliest
 * first. The multi-progressor successor to getInvitingProgressor: used by the New
 * Sale "Progressed by" picker and Handover when an agency works with more than one
 * progressor. Returns [] when the agency self-signed-up / has no progressors.
 */
export async function getProgressorsForAgency(agencyId: string | null | undefined): Promise<InvitingProgressor[]> {
  if (!agencyId) return [];
  const links = await prisma.progressionBusinessClient.findMany({
    where: { agencyId, removedAt: null },
    orderBy: { createdAt: "asc" },
    select: { progressionBusinessId: true, feeModel: true, progressionBusiness: { select: { name: true } } },
  });
  return links.map((l) => ({ businessId: l.progressionBusinessId, name: l.progressionBusiness.name, feeModel: parseFeeModel(l.feeModel) }));
}

export type ProgressorCopy = { count: number; name: string | null };

/**
 * Count + primary name of an agency's progressors, for count-aware copy: name the
 * one when there's a single progressor, or say "your progressors" when there are
 * several (no single name fits a multi-progressor agency). `count === 0` (self-
 * signup / TSP-outsourced) leaves `name` null so callers keep their "our team"
 * fallback. One query.
 */
export async function getProgressorCopy(agencyId: string | null | undefined): Promise<ProgressorCopy> {
  const list = await getProgressorsForAgency(agencyId);
  return { count: list.length, name: list[0]?.name ?? null };
}
