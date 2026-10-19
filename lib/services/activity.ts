import { prisma } from "@/lib/prisma";
import { isGhostActor, recordGodAction } from "@/lib/security/god-mode";

export async function touchLastActivity(transactionId: string): Promise<void> {
  await prisma.propertyTransaction.update({
    where: { id: transactionId },
    data: { lastActivityAt: new Date() },
  });
}

export async function logActivity(
  transactionId: string,
  content: string,
  actorId: string
): Promise<void> {
  // Founder god mode: when the actor is a platform operator (superadmin), the
  // agency must see NOTHING. Skip the agency-visible note AND the last-activity
  // bump (both would be traces), and record the action to the private god-log
  // instead. The underlying effect of whatever called logActivity still stands.
  if (await isGhostActor(actorId)) {
    await recordGodAction({
      actorId,
      action: "file_activity",
      targetType: "transaction",
      targetId: transactionId,
      detail: content,
    });
    return;
  }

  await Promise.all([
    prisma.outboundMessage.create({
      data: {
        transactionId,
        type: "internal_note",
        contactIds: [],
        content,
        createdById: actorId,
      },
    }),
    touchLastActivity(transactionId),
  ]);
}
