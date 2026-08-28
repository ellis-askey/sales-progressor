"use server";

// Command Centre → Agencies → Weekly client update control. Superadmin/admin
// only. Toggles the Saturday "quick check-in" client email per agency, plus a
// master that flips every agency at once. Gated by Agency.weeklyClientUpdatesEnabled,
// which the client-weekly-update cron reads.

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/session";
import { hasAdminPowers } from "@/lib/agent-session";
import { prisma } from "@/lib/prisma";

export async function updateAgencyWeeklyUpdateAction(input: {
  agencyId: string;
  value: boolean;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await requireSession();
  if (!hasAdminPowers(session)) return { ok: false, error: "Forbidden" };

  const agency = await prisma.agency.findUnique({ where: { id: input.agencyId }, select: { id: true } });
  if (!agency) return { ok: false, error: "Agency not found." };

  await prisma.agency.update({
    where: { id: input.agencyId },
    data: { weeklyClientUpdatesEnabled: input.value },
  });
  revalidatePath("/command/agencies");
  return { ok: true };
}

// Master switch: set every non-internal agency at once.
export async function setAllWeeklyUpdatesAction(input: {
  value: boolean;
}): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  const session = await requireSession();
  if (!hasAdminPowers(session)) return { ok: false, error: "Forbidden" };

  const res = await prisma.agency.updateMany({
    where: { isInternal: false },
    data: { weeklyClientUpdatesEnabled: input.value },
  });
  revalidatePath("/command/agencies");
  return { ok: true, count: res.count };
}
