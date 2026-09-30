// Progression-business client management (Phase 4).
//
// A progression business owner adds an estate agent as a CLIENT: this creates
// the agent's own single-director agency + a pending director account, and a
// ProgressionBusinessClient link. The link is client management ONLY — it never
// grants the business access to any of that agency's transactions. Access is
// always decided by PropertyTransaction.progressionBusinessId
// (lib/security/access-scope.ts). See docs/active/progression-businesses/.

import { prisma } from "@/lib/prisma";
import { createDirectorWithAgency } from "@/lib/auth/create-director-with-agency";
import type { Session } from "next-auth";

export type BusinessOwner = { businessId: string; userId: string };

/**
 * Resolve the acting user to a progression-business OWNER, or null if they are
 * not an owner. Looked up from the DB (not the session) so business-role changes
 * take effect without a re-login; add-client is a rare action, not a hot path.
 */
export async function resolveBusinessOwner(session: Session): Promise<BusinessOwner | null> {
  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { progressionBusinessId: true, progressionBusinessRole: true },
  });
  if (!me?.progressionBusinessId || me.progressionBusinessRole !== "owner") return null;
  return { businessId: me.progressionBusinessId, userId: session.user.id };
}

export type AddClientAgencyInput = {
  owner: BusinessOwner;
  agentName: string;
  agentEmail: string;
  agencyName: string;
};

export type AddClientAgencyResult =
  | { ok: true; agencyId: string; userId: string }
  | { ok: false; error: string };

/**
 * Create a client agency + its pending director + the business↔agency link.
 * The director is created WITHOUT a password (pending) — they activate their
 * login separately. Creates NO transaction and grants NO transaction access.
 */
export async function addClientAgency(input: AddClientAgencyInput): Promise<AddClientAgencyResult> {
  const email = input.agentEmail.toLowerCase().trim();

  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) {
    return { ok: false, error: "An account already exists for that email." };
  }

  // Reuses the canonical agency+director creator (atomic). No password → the
  // director is pending until they set one.
  const { userId, agencyId } = await createDirectorWithAgency({
    name: input.agentName.trim(),
    email,
    role: "director",
    agencyName: input.agencyName.trim(),
  });

  await prisma.progressionBusinessClient.create({
    data: { progressionBusinessId: input.owner.businessId, agencyId },
  });

  console.log(
    `[AUDIT] progression_client_added businessId=${input.owner.businessId} agencyId=${agencyId} agentUserId=${userId} by=${input.owner.userId}`,
  );
  return { ok: true, agencyId, userId };
}

export type ProgressionClient = {
  linkId: string;
  agencyId: string;
  agencyName: string;
  agent: { id: string; name: string; email: string; pending: boolean } | null;
  // Files this business progresses for the client agency (NOT the agency's whole
  // book — the link grants no visibility of the agency's other files).
  fileCount: number;
};

/** List a business's client agencies with their director + progressed-file count. */
export async function listClientsForBusiness(businessId: string): Promise<ProgressionClient[]> {
  const links = await prisma.progressionBusinessClient.findMany({
    where: { progressionBusinessId: businessId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      agency: {
        select: {
          id: true,
          name: true,
          users: {
            where: { role: "director" },
            orderBy: { createdAt: "asc" },
            take: 1,
            select: { id: true, name: true, email: true, password: true },
          },
        },
      },
    },
  });

  // Count only files tagged to THIS business, grouped by agency.
  const counts = await prisma.propertyTransaction.groupBy({
    by: ["agencyId"],
    where: { progressionBusinessId: businessId },
    _count: true,
  });
  const countByAgency = new Map(counts.map((c) => [c.agencyId, c._count]));

  return links.map((l) => {
    const director = l.agency.users[0] ?? null;
    return {
      linkId: l.id,
      agencyId: l.agency.id,
      agencyName: l.agency.name,
      agent: director
        ? { id: director.id, name: director.name, email: director.email, pending: !director.password }
        : null,
      fileCount: countByAgency.get(l.agency.id) ?? 0,
    };
  });
}
