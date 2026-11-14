"use server";

// "Connect your CRM" request action (critique #289). An agency registers interest
// in connecting a CRM — a real, honest action (it records the request), never a
// fake "Connected". Agents only: gated to director / negotiator with an agencyId.
// One row per agency per CRM (idempotent upsert), so the demand counts are true
// and nobody double-votes. agencyName / requestedByName are denormalised onto the
// row so the Command Centre list needs no joins.

import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { CRM_BY_KEY, otherKey } from "@/lib/crm/catalogue";
import { revalidatePath } from "next/cache";

export async function requestCrmConnectionAction(input: { crmKey?: string; other?: string }): Promise<{ ok: boolean; crmKey?: string }> {
  const session = await requireSession();
  const role = session.user.role;
  const agencyId = session.user.agencyId;
  // Agents only (an estate agency). Internal staff / progression businesses have
  // no agencyId here and can't register agency demand.
  if ((role !== "director" && role !== "negotiator") || !agencyId) return { ok: false };

  // Resolve the CRM: a listed catalogue key, or a free-text "other" CRM we don't
  // list (stored as "other:<slug>" with the typed name kept for the Command Centre).
  let crmKey: string;
  let crmName: string;
  const other = input.other?.trim();
  if (other) {
    crmName = other.slice(0, 80);
    crmKey = otherKey(crmName);
  } else if (input.crmKey && CRM_BY_KEY[input.crmKey]) {
    crmKey = input.crmKey;
    crmName = CRM_BY_KEY[input.crmKey].name;
  } else {
    return { ok: false };
  }

  const [agency, user] = await Promise.all([
    prisma.agency.findUnique({ where: { id: agencyId }, select: { name: true } }),
    session.user.id ? prisma.user.findUnique({ where: { id: session.user.id }, select: { name: true } }) : Promise.resolve(null),
  ]);

  await prisma.crmConnectionRequest.upsert({
    where: { agencyId_crmKey: { agencyId, crmKey } },
    // Already asked → leave the original request untouched (keeps its date + who).
    update: {},
    create: {
      agencyId,
      agencyName: agency?.name ?? null,
      crmKey,
      crmName,
      requestedById: session.user.id ?? null,
      requestedByName: user?.name ?? null,
    },
  });

  revalidatePath("/agent/account/connect-crm");
  return { ok: true, crmKey };
}
