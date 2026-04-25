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

export async function addRecommendedSolicitorWithContactAction(input: {
  firmId?: string;
  firmName?: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  referralFeePence: number | null;
}): Promise<{ firmId: string; firmName: string }> {
  const session = await requireSession();
  requireDirector(session.user.role);

  let firmId = input.firmId;
  let firmName = input.firmName ?? "";

  if (!firmId) {
    // Find or create the firm
    let firm = await prisma.solicitorFirm.findFirst({ where: { name: firmName.trim() } });
    if (!firm) {
      firm = await prisma.solicitorFirm.create({
        data: { name: firmName.trim(), agencyId: session.user.agencyId },
      });
    }
    firmId = firm.id;
    firmName = firm.name;
  } else {
    const firm = await prisma.solicitorFirm.findUnique({ where: { id: firmId }, select: { name: true } });
    firmName = firm?.name ?? firmName;
  }

  // Always create the contact on the firm
  await prisma.solicitorContact.create({
    data: {
      firmId,
      name: input.contactName.trim(),
      phone: input.contactPhone.trim() || null,
      email: input.contactEmail.trim() || null,
    },
  });

  // Add to recommended list with the given fee
  await db.agencyRecommendedSolicitor.upsert({
    where: { agencyId_solicitorFirmId: { agencyId: session.user.agencyId, solicitorFirmId: firmId } },
    create: { agencyId: session.user.agencyId, solicitorFirmId: firmId, defaultReferralFeePence: input.referralFeePence },
    update: { defaultReferralFeePence: input.referralFeePence },
  });

  revalidatePath("/agent/solicitors");
  revalidatePath("/agent/settings");
  return { firmId, firmName };
}
