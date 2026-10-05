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
    select: { progressionBusinessId: true, feeModel: true, progressionBusiness: { select: { name: true } } },
  });
  if (!link) return null;
  return { businessId: link.progressionBusinessId, name: link.progressionBusiness.name, feeModel: parseFeeModel(link.feeModel) };
}
