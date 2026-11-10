"use server";

// Command Centre → Agency File → Lifecycle emails. Superadmin/admin only.
// Pauses every automated lifecycle/retention email for one agency (welcome,
// day-1/3/14/21/30/60 nudges, exchange celebrations) — for trial/managed
// customers who shouldn't be re-engaged. Gated by Agency.retentionEmailsPaused,
// read by lib/services/retention.ts + the welcome senders.

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/session";
import { hasAdminPowers } from "@/lib/agent-session";
import { prisma } from "@/lib/prisma";

export async function updateAgencyRetentionPausedAction(input: {
  agencyId: string;
  paused: boolean;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await requireSession();
  if (!hasAdminPowers(session)) return { ok: false, error: "Forbidden" };

  const agency = await prisma.agency.findUnique({ where: { id: input.agencyId }, select: { id: true } });
  if (!agency) return { ok: false, error: "Agency not found." };

  await prisma.agency.update({
    where: { id: input.agencyId },
    data: { retentionEmailsPaused: input.paused },
  });
  revalidatePath(`/command/agency/${input.agencyId}`);
  return { ok: true };
}
