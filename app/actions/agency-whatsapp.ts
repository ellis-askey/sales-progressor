"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/session";
import { hasAdminPowers } from "@/lib/agent-session";
import { prisma } from "@/lib/prisma";
import { recordAdminActionSafe } from "@/lib/command/audit/write";

export type WhatsAppStream = "whatsAppCaptureEnabled" | "whatsAppTasksEnabled";

const STREAMS: WhatsAppStream[] = ["whatsAppCaptureEnabled", "whatsAppTasksEnabled"];

export async function updateAgencyWhatsAppStreamAction(input: {
  agencyId: string;
  stream: WhatsAppStream;
  value: boolean;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await requireSession();
  if (!hasAdminPowers(session)) return { ok: false, error: "Forbidden" };
  if (!STREAMS.includes(input.stream)) return { ok: false, error: "Unknown setting." };

  const agency = await prisma.agency.findUnique({
    where: { id: input.agencyId },
    select: { id: true, whatsAppCaptureEnabled: true, whatsAppTasksEnabled: true },
  });
  if (!agency) return { ok: false, error: "Agency not found." };

  await prisma.agency.update({
    where: { id: input.agencyId },
    data: { [input.stream]: input.value },
  });
  await recordAdminActionSafe({
    adminUserId: session.user.id,
    action: "agency.whatsapp_stream.update",
    targetType: "agency",
    targetId: input.agencyId,
    beforeValue: { [input.stream]: agency[input.stream] },
    afterValue: { [input.stream]: input.value },
  });
  revalidatePath("/command/agencies");
  return { ok: true };
}

// Column master: set ONE WhatsApp switch for every non-internal agency at once
// (Controls matrix, CC rebuild PR2).
export async function setAllWhatsAppStreamAction(input: {
  stream: WhatsAppStream;
  value: boolean;
}): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  const session = await requireSession();
  if (!hasAdminPowers(session)) return { ok: false, error: "Forbidden" };
  if (!STREAMS.includes(input.stream)) return { ok: false, error: "Unknown setting." };

  const res = await prisma.agency.updateMany({
    where: { isInternal: false },
    data: { [input.stream]: input.value },
  });
  await recordAdminActionSafe({
    adminUserId: session.user.id,
    action: "agency.whatsapp_stream.set_all",
    targetType: "agency",
    afterValue: { stream: input.stream, value: input.value, count: res.count },
  });
  revalidatePath("/command/agencies");
  return { ok: true, count: res.count };
}
