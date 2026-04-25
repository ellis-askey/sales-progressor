"use server";

import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function updateSolicitorRecommendationAction(
  firmId: string,
  isRecommended: boolean,
  defaultReferralFeePence: number | null,
) {
  const session = await requireSession();
  if (session.user.role !== "director" && session.user.role !== "admin") {
    throw new Error("Unauthorised");
  }

  await prisma.solicitorFirm.update({
    where: { id: firmId, agencyId: session.user.agencyId },
    data: { isRecommended, defaultReferralFeePence },
  });

  revalidatePath("/agent/settings");
}

export async function createRecommendedSolicitorAction(name: string) {
  const session = await requireSession();
  if (session.user.role !== "director" && session.user.role !== "admin") {
    throw new Error("Unauthorised");
  }

  await prisma.solicitorFirm.create({
    data: {
      agencyId: session.user.agencyId,
      name: name.trim(),
      isRecommended: true,
    },
  });

  revalidatePath("/agent/settings");
}
