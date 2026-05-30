"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { titleCase } from "@/lib/utils";

/**
 * Director-only: rename the agency the calling director belongs to.
 *
 * Scope is taken strictly from session.user.agencyId — clients never pass an
 * agency id. Server-side titleCase + trim are the safety net for callers that
 * skip the on-blur client normaliser.
 */
export async function updateAgencyNameAction(input: { name: string }):
  Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await requireSession();

  if (session.user.role !== "director") {
    return { ok: false, error: "Only directors can rename the agency." };
  }
  const agencyId = session.user.agencyId;
  if (!agencyId) {
    return { ok: false, error: "Missing agency context." };
  }

  const normalised = titleCase(input.name ?? "");
  if (!normalised) {
    return { ok: false, error: "Agency name is required." };
  }

  await prisma.agency.update({
    where: { id: agencyId },
    data: { name: normalised },
  });

  revalidatePath("/agent/account/team", "page");
  return { ok: true };
}
