"use server";

// Command Centre → Agencies → per-agency chase control. Superadmin/admin only.
// Toggles one of the three solicitor/enquiries chase streams for a single
// agency. The chase engines read these flags per file; the global
// SolicitorChaseSettings.enabledByDefault stays as the top-level kill switch.

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/session";
import { hasAdminPowers } from "@/lib/agent-session";
import { prisma } from "@/lib/prisma";

export type ChaseStream =
  | "solicitorChaseEnabled"
  | "enquiryReplyChaseEnabled"
  | "enquiryRaiseChaseEnabled";

const STREAMS: ChaseStream[] = ["solicitorChaseEnabled", "enquiryReplyChaseEnabled", "enquiryRaiseChaseEnabled"];

export async function updateAgencyChaseStreamAction(input: {
  agencyId: string;
  stream: ChaseStream;
  value: boolean;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await requireSession();
  if (!hasAdminPowers(session)) return { ok: false, error: "Forbidden" };
  if (!STREAMS.includes(input.stream)) return { ok: false, error: "Unknown stream." };

  const agency = await prisma.agency.findUnique({ where: { id: input.agencyId }, select: { id: true } });
  if (!agency) return { ok: false, error: "Agency not found." };

  await prisma.agency.update({
    where: { id: input.agencyId },
    data: { [input.stream]: input.value },
  });

  revalidatePath("/command/agencies");
  return { ok: true };
}
