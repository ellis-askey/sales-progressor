"use server";

import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

function requireDirector(role: string) {
  if (role !== "director" && role !== "admin") throw new Error("Unauthorised");
}

export async function upsertPreferredBrokerAction(
  brokerFirmId: string,
  defaultReferralFeePence: number | null,
) {
  const session = await requireSession();
  requireDirector(session.user.role);

  await prisma.agencyPreferredBroker.upsert({
    where: { agencyId: session.user.agencyId },
    create: { agencyId: session.user.agencyId, brokerFirmId, defaultReferralFeePence },
    update: { brokerFirmId, defaultReferralFeePence },
  });

  revalidatePath("/agent/partners");
}

export async function removePreferredBrokerAction() {
  const session = await requireSession();
  requireDirector(session.user.role);

  await prisma.agencyPreferredBroker.deleteMany({
    where: { agencyId: session.user.agencyId },
  });

  revalidatePath("/agent/partners");
}

export async function addBrokerWithContactAction(input: {
  firmId?: string;
  firmName?: string;
  firmWebsite?: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  referralFeePence: number | null;
}): Promise<{ firmId: string; firmName: string; contactId: string }> {
  const session = await requireSession();
  requireDirector(session.user.role);

  const firmName = input.firmName?.trim() ?? "";
  const website = input.firmWebsite?.trim() || null;

  // Always create a fresh firm record — brokers are per-agency, not shared
  const firm = await prisma.brokerFirm.create({ data: { name: firmName } });
  const firmId = firm.id;

  // Save website separately; silently skip if the column doesn't exist yet (migration 002 pending)
  if (website) {
    try {
      await prisma.brokerFirm.update({ where: { id: firmId }, data: { website } });
    } catch { /* website column not yet in DB — will save after migration 002 is applied */ }
  }

  const contact = await prisma.brokerContact.create({
    data: {
      firmId,
      name: input.contactName.trim(),
      phone: input.contactPhone.trim() || null,
      email: input.contactEmail.trim() || null,
    },
  });

  await prisma.agencyPreferredBroker.upsert({
    where: { agencyId: session.user.agencyId },
    create: { agencyId: session.user.agencyId, brokerFirmId: firmId, defaultReferralFeePence: input.referralFeePence },
    update: { brokerFirmId: firmId, defaultReferralFeePence: input.referralFeePence },
  });

  revalidatePath("/agent/partners");
  return { firmId, firmName, contactId: contact.id };
}
