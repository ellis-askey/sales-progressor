// Client-set timed pause on chase emails (audit #11 email link + #15 portal
// control). One shared path so both doors behave identically: set the
// paused-until date, log a note on the file, and notify the managing agent
// (surfaces in the bell as a "Paused" item). Pausing affects ONLY chases —
// milestone / chain / exchange emails keep sending.

import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/services/notifications";

export async function pauseContactChases(
  contactId: string,
  until: Date,
  source: "email" | "portal",
): Promise<{ until: Date; contactName: string } | null> {
  const contact = await prisma.contact.findUnique({
    where: { id: contactId },
    select: {
      name: true,
      roleType: true,
      propertyTransactionId: true,
      transaction: { select: { serviceType: true, assignedUserId: true, agentUserId: true } },
    },
  });
  if (!contact) return null;

  await prisma.contact.update({ where: { id: contactId }, data: { chasesPausedUntil: until } });

  const untilLabel = until.toLocaleDateString("en-GB", { day: "numeric", month: "long" });
  const via = source === "email" ? "a chase email" : "the portal";
  await prisma.outboundMessage.create({
    data: {
      transactionId: contact.propertyTransactionId,
      type: "internal_note",
      contactIds: [],
      content: `${contact.name} paused their chase reminders until ${untilLabel} via ${via}.`,
    },
  }).catch(() => {});

  const managingUserId =
    contact.transaction.serviceType !== "self_managed"
      ? contact.transaction.assignedUserId
      : contact.transaction.agentUserId;
  if (managingUserId) {
    await createNotification({
      userId: managingUserId,
      type: "portal_chases_paused",
      transactionId: contact.propertyTransactionId,
      payload: {
        contactName: contact.name,
        contactRole: contact.roleType,
        pausedUntil: until.toISOString(),
      },
    }).catch(() => {});
  }

  return { until, contactName: contact.name };
}

export async function resumeContactChases(contactId: string): Promise<void> {
  await prisma.contact.update({
    where: { id: contactId },
    data: { chasesPausedUntil: null },
  }).catch(() => {});
}
