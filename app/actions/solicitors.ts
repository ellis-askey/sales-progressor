"use server";

import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

function requireDirector(role: string) {
  if (role !== "director" && role !== "admin") throw new Error("Unauthorised");
}

export async function upsertRecommendedSolicitorAction(
  solicitorFirmId: string,
  defaultReferralFeePence: number | null,
) {
  const session = await requireSession();
  requireDirector(session.user.role);

  await db.agencyRecommendedSolicitor.upsert({
    where: { agencyId_solicitorFirmId: { agencyId: session.user.agencyId, solicitorFirmId } },
    create: { agencyId: session.user.agencyId, solicitorFirmId, defaultReferralFeePence },
    update: { defaultReferralFeePence },
  });

  revalidatePath("/agent/settings");
}

export async function removeRecommendedSolicitorAction(solicitorFirmId: string) {
  const session = await requireSession();
  requireDirector(session.user.role);

  await db.agencyRecommendedSolicitor.deleteMany({
    where: { agencyId: session.user.agencyId, solicitorFirmId },
  });

  revalidatePath("/agent/settings");
}

export async function createAndRecommendSolicitorAction(name: string) {
  const session = await requireSession();
  requireDirector(session.user.role);

  // Find or create the global firm (name is globally unique after schema change)
  let firm = await prisma.solicitorFirm.findFirst({ where: { name: name.trim() } });
  if (!firm) {
    firm = await prisma.solicitorFirm.create({
      data: { name: name.trim(), agencyId: session.user.agencyId },
    });
  }

  await db.agencyRecommendedSolicitor.upsert({
    where: { agencyId_solicitorFirmId: { agencyId: session.user.agencyId, solicitorFirmId: firm.id } },
    create: { agencyId: session.user.agencyId, solicitorFirmId: firm.id },
    update: {},
  });

  revalidatePath("/agent/settings");
}
