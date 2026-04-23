"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import type { ClientType } from "@prisma/client";

export async function assignProgressorAction(agentId: string, progressorId: string | null) {
  const session = await requireSession();
  if (session.user.role !== "admin") throw new Error("Admin only");

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
  if (session.user.role !== "admin") throw new Error("Admin only");

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
