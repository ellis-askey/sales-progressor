"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { progressionBusinessesEnabled } from "@/lib/progression/flags";
import { resolveBusinessOwner, addClientAgency, assertOwnerOfClient } from "@/lib/services/progression-clients";
import { sendClientAgentSetupEmail } from "@/lib/emails/client-agent-invite";
import { parseFeeModel } from "@/lib/progression/client-fees";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type AddClientResult = { ok: true } | { ok: false; error: string };
type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * Add an estate agent as a client of the acting user's progression business.
 * Flag-gated (this is a new external-facing entry point) and owner-gated. The
 * client link grants NO transaction access — see lib/services/progression-clients.
 */
export async function addClientAgencyAction(formData: FormData): Promise<AddClientResult> {
  if (!progressionBusinessesEnabled()) {
    return { ok: false, error: "This feature isn't enabled yet." };
  }

  const session = await requireSession();
  const owner = await resolveBusinessOwner(session);
  if (!owner) {
    return { ok: false, error: "Only a progression-business owner can add clients." };
  }

  const agentName = (formData.get("agentName") as string | null)?.trim() ?? "";
  const agentEmail = (formData.get("agentEmail") as string | null)?.trim() ?? "";
  const agencyName = (formData.get("agencyName") as string | null)?.trim() ?? "";

  if (!agentName || agentName.length > 100) {
    return { ok: false, error: "Please enter the agent's name." };
  }
  if (!agentEmail || agentEmail.length > 255 || !EMAIL_RE.test(agentEmail)) {
    return { ok: false, error: "Please enter a valid email address." };
  }
  if (!agencyName || agencyName.length > 120) {
    return { ok: false, error: "Please enter the agency name." };
  }

  const result = await addClientAgency({ owner, agentName, agentEmail, agencyName });
  if (!result.ok) return result;

  revalidatePath("/agent/clients");
  return { ok: true };
}

/** Re-send the set-password invite to a client agency's agent. Owner-scoped. */
export async function resendClientInviteAction(agencyId: string): Promise<ActionResult> {
  if (!progressionBusinessesEnabled()) return { ok: false, error: "This feature isn't enabled yet." };
  const session = await requireSession();
  const owner = await assertOwnerOfClient(session, agencyId);
  if (!owner) return { ok: false, error: "That isn't one of your clients." };

  const director = await prisma.user.findFirst({
    where: { agencyId, role: "director" },
    orderBy: { createdAt: "asc" },
    select: { id: true, email: true },
  });
  if (!director) return { ok: false, error: "There's no agent on this agency to invite." };

  const business = await prisma.progressionBusiness.findUnique({ where: { id: owner.businessId }, select: { name: true } });
  await sendClientAgentSetupEmail({ userId: director.id, email: director.email, businessName: business?.name ?? "Your progressor" });
  return { ok: true };
}

// Overview toggles -> the real Agency columns. Allowlisted so only these six
// flags can be flipped through this action.
const FLAG_FIELDS: Record<string, string> = {
  solicitorChase: "solicitorChaseEnabled",
  enquiryChase: "enquiryReplyChaseEnabled",
  weeklyUpdate: "weeklyClientUpdatesEnabled",
  portalKeyDates: "showPortalKeyDates",
  portalCosts: "showPortalCosts",
  portalProgress: "showPortalProgressPercent",
};

/** Flip one of a client agency's service / portal settings. Owner-scoped. */
export async function setClientAgencyFlagAction(agencyId: string, key: string, value: boolean): Promise<ActionResult> {
  if (!progressionBusinessesEnabled()) return { ok: false, error: "This feature isn't enabled yet." };
  const field = FLAG_FIELDS[key];
  if (!field) return { ok: false, error: "Unknown setting." };
  const session = await requireSession();
  const owner = await assertOwnerOfClient(session, agencyId);
  if (!owner) return { ok: false, error: "That isn't one of your clients." };

  await prisma.agency.update({ where: { id: agencyId }, data: { [field]: value } as Prisma.AgencyUpdateInput });
  revalidatePath(`/agent/clients/${agencyId}`);
  return { ok: true };
}

/** Save the progressor's rate card for a client (how they charge). Owner-scoped. */
export async function setClientFeeModelAction(agencyId: string, model: unknown): Promise<ActionResult> {
  if (!progressionBusinessesEnabled()) return { ok: false, error: "This feature isn't enabled yet." };
  const session = await requireSession();
  const owner = await assertOwnerOfClient(session, agencyId);
  if (!owner) return { ok: false, error: "That isn't one of your clients." };

  const parsed = parseFeeModel(model);
  if (!parsed) return { ok: false, error: "That fee model isn't valid." };

  await prisma.progressionBusinessClient.update({
    where: { progressionBusinessId_agencyId: { progressionBusinessId: owner.businessId, agencyId } },
    data: { feeModel: parsed as unknown as Prisma.InputJsonValue },
  });
  revalidatePath(`/agent/clients/${agencyId}`);
  return { ok: true };
}

// Brand colour + full email theme + logo are now managed by the Branding tab's
// studio via the owner-scoped /api/agent/clients/[agencyId]/logo route (same
// normalise + storage + Agency columns as the agency's own branding studio).
