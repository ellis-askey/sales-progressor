"use server";

import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function dismissDirectorJoined(): Promise<void> {
  const session = await requireSession();

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      directorJoinedNotificationName: null,
      directorJoinedNotificationAt: null,
    },
  });
}
