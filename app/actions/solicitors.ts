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
  revalidatePath("/agent/solicitors");
}

export async function removeRecommendedSolicitorAction(solicitorFirmId: string) {
  const session = await requireSession();
  requireDirector(session.user.role);

  await db.agencyRecommendedSolicitor.deleteMany({
    where: { agencyId: session.user.agencyId, solicitorFirmId },
  });
  revalidatePath("/agent/solicitors");
}

export async function createAndRecommendSolicitorAction(name: string) {
  const session = await requireSession();
  requireDirector(session.user.role);

  // Find or create the global firm (name is globally unique after schema change)
  let firm = await prisma.solicitorFirm.findFirst({ where: { name: name.trim() } });
  if (!firm) {
    firm = await prisma.solicitorFirm.create({
      data: { name: name.trim() },
    });
  }

  await db.agencyRecommendedSolicitor.upsert({
    where: { agencyId_solicitorFirmId: { agencyId: session.user.agencyId, solicitorFirmId: firm.id } },
    create: { agencyId: session.user.agencyId, solicitorFirmId: firm.id },
    update: {},
  });
  revalidatePath("/agent/solicitors");
}

/** Case handlers already recorded on a (shared) solicitor firm, so the agent can
 *  pick an existing one instead of creating a duplicate. Director-only. */
export async function getSolicitorFirmHandlersAction(
  firmId: string,
): Promise<{ id: string; name: string; phone: string | null; email: string | null }[]> {
  const session = await requireSession();
  requireDirector(session.user.role);
  return prisma.solicitorContact.findMany({
    where: { firmId },
    orderBy: { name: "asc" },
    select: { id: true, name: true, phone: true, email: true },
  });
}

export async function addRecommendedSolicitorWithContactAction(input: {
  firmId?: string;
  firmName?: string;
  // Contact fields are only used when adding a NEW handler. Omit them (or leave
  // blank) when the agent picked an existing handler on a shared firm, so we
  // don't create a duplicate contact.
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
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
        data: { name: firmName.trim() },
      });
    }
    firmId = firm.id;
    firmName = firm.name;
  } else {
    const firm = await prisma.solicitorFirm.findUnique({ where: { id: firmId }, select: { name: true } });
    firmName = firm?.name ?? firmName;
  }

  // Only create a contact when a new handler was entered (not when an existing
  // handler was picked from the shared firm).
  if (input.contactName && input.contactName.trim()) {
    await prisma.solicitorContact.create({
      data: {
        firmId,
        name: input.contactName.trim(),
        phone: input.contactPhone?.trim() || null,
        email: input.contactEmail?.trim() || null,
      },
    });
  }

  // Add to recommended list with the given fee
  await db.agencyRecommendedSolicitor.upsert({
    where: { agencyId_solicitorFirmId: { agencyId: session.user.agencyId, solicitorFirmId: firmId } },
    create: { agencyId: session.user.agencyId, solicitorFirmId: firmId, defaultReferralFeePence: input.referralFeePence },
    update: { defaultReferralFeePence: input.referralFeePence },
  });

  revalidatePath("/agent/solicitors");
  // Stale /agent/settings revalidation removed in the Account-area cutover.
  return { firmId, firmName };
}
