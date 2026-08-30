"use server";

import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { titleCaseKeepAcronyms } from "@/lib/utils";

function requireDirector(role: string) {
  if (role !== "director" && role !== "admin") throw new Error("Unauthorised");
}

// Add a broker from the New Sale form (no cross-agency search there — you either
// use your saved broker or add one here). Creates a fresh firm + contact scoped
// to the caller, and — for a first-time add (saveToPartners) — sets it as the
// agency's saved broker so it shows in Partners and pre-fills next time. Any
// agency user can call this (they're adding their own sale).
export async function addBrokerForSaleAction(input: {
  firmName: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  saveToPartners: boolean;
  // When saving to Partners, the referral fee to store as the agency default.
  referralFeePence?: number | null;
}): Promise<{
  firmId: string; firmName: string;
  contactId: string | null; contactName: string | null;
  phone: string | null; email: string | null;
}> {
  const session = await requireSession();
  const agencyId = session.user.agencyId;
  if (!agencyId) throw new Error("Only agency users can add a broker");

  const firmName = titleCaseKeepAcronyms(input.firmName.trim());
  if (!firmName) throw new Error("Brokerage name is required");

  // Fresh firm per agency — brokers aren't shared across agencies.
  const firm = await prisma.brokerFirm.create({ data: { name: firmName } });

  let contact: { id: string; name: string; phone: string | null; email: string | null } | null = null;
  if (input.contactName?.trim()) {
    contact = await prisma.brokerContact.create({
      data: {
        firmId: firm.id,
        name: titleCaseKeepAcronyms(input.contactName.trim()),
        phone: input.contactPhone?.trim() || null,
        email: input.contactEmail?.trim().toLowerCase() || null,
      },
      select: { id: true, name: true, phone: true, email: true },
    });
  }

  if (input.saveToPartners) {
    const feePence = input.referralFeePence ?? null;
    await prisma.agencyPreferredBroker.upsert({
      where: { agencyId },
      create: { agencyId, brokerFirmId: firm.id, defaultReferralFeePence: feePence },
      update: { brokerFirmId: firm.id, defaultReferralFeePence: feePence },
    });
    revalidatePath("/agent/partners");
  }

  return {
    firmId: firm.id,
    firmName: firm.name,
    contactId: contact?.id ?? null,
    contactName: contact?.name ?? null,
    phone: contact?.phone ?? null,
    email: contact?.email ?? null,
  };
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
