"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/session";
import { hasSuperAdminPowers } from "@/lib/agent-session";
import { prisma } from "@/lib/prisma";
import type { ClientType } from "@prisma/client";

// Admin config is founder-facing internal setup. Allow the admin role (its home
// surface) OR superadmin (who reaches it via the Command Centre → Settings).
function assertAdminAccess(session: Awaited<ReturnType<typeof requireSession>>) {
  if (session.user.role !== "admin" && !hasSuperAdminPowers(session)) {
    throw new Error("Admin only");
  }
}

export async function assignProgressorAction(agentId: string, progressorId: string | null) {
  const session = await requireSession();
  assertAdminAccess(session);

  await prisma.user.update({
    where: { id: agentId },
    data: { progressorId: progressorId || null },
  });
  revalidatePath("/admin", "page");
}

export async function saveAgentFeeSettingsAction(input: {
  userId: string;
  clientType: ClientType;
  legacyFee: string;
}) {
  const session = await requireSession();
  assertAdminAccess(session);

  const user = await prisma.user.findFirst({
    where: { id: input.userId, agencyId: session.user.agencyId },
    select: { id: true },
  });
  if (!user) throw new Error("User not found");

  await prisma.user.update({
    where: { id: input.userId },
    data: {
      clientType: input.clientType,
      legacyFee: input.clientType === "legacy" ? Math.round(parseFloat(input.legacyFee) * 100) : null,
    },
  });
  revalidatePath("/admin", "page");
}
