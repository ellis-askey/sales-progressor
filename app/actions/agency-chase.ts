"use server";

// Command Centre → Agencies → per-agency chase control. Superadmin/admin only.
// Toggles one of the three solicitor/enquiries chase streams for a single
// agency. The chase engines read these flags per file; the global
// SolicitorChaseSettings.enabledByDefault stays as the top-level kill switch.

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/session";
import { hasAdminPowers } from "@/lib/agent-session";
import { prisma } from "@/lib/prisma";
import { recordAdminActionSafe } from "@/lib/command/audit/write";

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

  const agency = await prisma.agency.findUnique({
    where: { id: input.agencyId },
    select: { id: true, solicitorChaseEnabled: true, enquiryReplyChaseEnabled: true, enquiryRaiseChaseEnabled: true },
  });
  if (!agency) return { ok: false, error: "Agency not found." };

  await prisma.agency.update({
    where: { id: input.agencyId },
    data: { [input.stream]: input.value },
  });

  await recordAdminActionSafe({
    adminUserId: session.user.id,
    action: "agency.chase_stream.update",
    targetType: "agency",
    targetId: input.agencyId,
    beforeValue: { [input.stream]: agency[input.stream] },
    afterValue: { [input.stream]: input.value },
  });

  revalidatePath("/command/agencies");
  return { ok: true };
}

// Column master: set ONE chase stream for every non-internal agency at once.
// Added with the Controls matrix (CC rebuild PR2) so a whole stream can be
// flipped without opening each agency.
export async function setAllAgencyChaseStreamAction(input: {
  stream: ChaseStream;
  value: boolean;
}): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  const session = await requireSession();
  if (!hasAdminPowers(session)) return { ok: false, error: "Forbidden" };
  if (!STREAMS.includes(input.stream)) return { ok: false, error: "Unknown stream." };

  const res = await prisma.agency.updateMany({
    where: { isInternal: false },
    data: { [input.stream]: input.value },
  });
  await recordAdminActionSafe({
    adminUserId: session.user.id,
    action: "agency.chase_stream.set_all",
    targetType: "agency",
    afterValue: { stream: input.stream, value: input.value, count: res.count },
  });
  revalidatePath("/command/agencies");
  return { ok: true, count: res.count };
}
