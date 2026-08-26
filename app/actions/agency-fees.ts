"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/session";
import { hasAdminPowers } from "@/lib/agent-session";
import { prisma } from "@/lib/prisma";
import type { ClientType } from "@prisma/client";

export async function saveAgencyFeeAction(input: {
  agencyId: string;
  feeTier: ClientType;
  legacyOutsourcedFeePence: number | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await requireSession();
  if (!hasAdminPowers(session)) {
    return { ok: false, error: "Forbidden" };
  }

  if (input.feeTier === "legacy" && (input.legacyOutsourcedFeePence == null || input.legacyOutsourcedFeePence <= 0)) {
    return { ok: false, error: "Legacy fee must be a positive amount." };
  }

  const agency = await prisma.agency.findUnique({
    where: { id: input.agencyId },
    select: { id: true },
  });
  if (!agency) return { ok: false, error: "Agency not found." };

  await prisma.agency.update({
    where: { id: input.agencyId },
    data: {
      feeTier: input.feeTier,
      legacyOutsourcedFeePence: input.feeTier === "legacy" ? input.legacyOutsourcedFeePence : null,
    },
  });

  // Free tier is retroactive: every not-yet-billed file for this agency becomes
  // free-on-exchange so existing open files stop showing/charging the fee, not
  // just new ones. We never un-free an already-billed file, and moving OFF free
  // leaves existing stamps untouched (no surprise back-billing).
  if (input.feeTier === "free") {
    await prisma.propertyTransaction.updateMany({
      where: { agencyId: input.agencyId, billedAtExchange: null, freeOnExchange: false },
      data: { freeOnExchange: true },
    });
  }

  revalidatePath("/command/agencies", "page");
  return { ok: true };
}
