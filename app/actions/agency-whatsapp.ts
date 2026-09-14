"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/session";
import { hasAdminPowers } from "@/lib/agent-session";
import { prisma } from "@/lib/prisma";

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

  const agency = await prisma.agency.findUnique({ where: { id: input.agencyId }, select: { id: true } });
  if (!agency) return { ok: false, error: "Agency not found." };

  await prisma.agency.update({
    where: { id: input.agencyId },
    data: { [input.stream]: input.value },
  });
  revalidatePath("/command/agencies");
  return { ok: true };
}
