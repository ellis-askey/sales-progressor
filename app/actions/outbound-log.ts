"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { commandDb } from "@/lib/command/prisma";
import { recordAdminAction } from "@/lib/command/audit/write";

async function requireSuperAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "superadmin") redirect("/dashboard");
  return session;
}

export async function logOutboundMessageViewAction(messageId: string) {
  const session = await requireSuperAdmin();
  await recordAdminAction({
    adminUserId: session.user.id,
    action: "outbound_message.viewed",
    targetType: "OutboundMessage",
    targetId: messageId,
  }).catch(() => {});
}

export async function getOutboundMessageBodyAction(messageId: string): Promise<{
  content: string;
  bodyFormat: string;
} | null> {
  await requireSuperAdmin();
  const msg = await commandDb.outboundMessage.findUnique({
    where: { id: messageId },
    select: { content: true, bodyFormat: true },
  });
  if (!msg) return null;
  return { content: msg.content, bodyFormat: msg.bodyFormat };
}
