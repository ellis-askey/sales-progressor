"use server";

// Director-only: set or clear this agency's monthly fees target (pence). Drives
// the "ahead / short" line on the All Files → Forecast tab, where each month's
// forecast fees are compared against it. Mirrors the automation settings'
// director guard (role + agencyId). null clears the target.

import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

type Result = { ok: true } | { ok: false; error: string };

export async function setAgencyMonthlyFeeTarget(pence: number | null): Promise<Result> {
  const session = await requireSession();
  if (session.user.role !== "director") {
    return { ok: false, error: "Only directors can set the forecast target." };
  }
  const agencyId = session.user.agencyId;
  if (!agencyId) return { ok: false, error: "Missing agency context." };
  if (pence != null && (!Number.isFinite(pence) || pence < 0)) {
    return { ok: false, error: "Enter a valid amount." };
  }
  await prisma.agency.update({
    where: { id: agencyId },
    data: { monthlyFeeTargetPence: pence != null ? Math.round(pence) : null },
  });
  revalidatePath("/agent/transactions");
  return { ok: true };
}
