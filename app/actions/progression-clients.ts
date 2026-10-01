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

// ── People: manage a client agency's team on their behalf ─────────────────────
// Owner-scoped mirrors of the director-only team management. A colleague is a
// pending negotiator User on the client agency (password null = "invite sent"),
// invited with the SAME setup-email flow as the client director. Removal copies
// the canonical soft-delete semantics (role -> viewer + deactivatedAt +
// sessionVersion bump); the director (the main contact) can't be removed.

async function businessName(businessId: string): Promise<string> {
  const b = await prisma.progressionBusiness.findUnique({ where: { id: businessId }, select: { name: true } });
  return b?.name ?? "Your progressor";
}

/** Invite a colleague (negotiator) onto a client agency. Owner-scoped. */
export async function inviteClientColleagueAction(agencyId: string, formData: FormData): Promise<ActionResult> {
  if (!progressionBusinessesEnabled()) return { ok: false, error: "This feature isn't enabled yet." };
  const session = await requireSession();
  const owner = await assertOwnerOfClient(session, agencyId);
  if (!owner) return { ok: false, error: "That isn't one of your clients." };

  const name = (formData.get("name") as string | null)?.trim() ?? "";
  const email = ((formData.get("email") as string | null)?.trim() ?? "").toLowerCase();
  if (!name || name.length > 100) return { ok: false, error: "Please enter the colleague's name." };
  if (!email || email.length > 255 || !EMAIL_RE.test(email)) return { ok: false, error: "Please enter a valid email address." };

  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) return { ok: false, error: "An account already exists for that email." };

  // Inherit the client director's firmName so the colleague is visible in the
  // agency's OWN team view (which filters the roster by firmName).
  const director = await prisma.user.findFirst({
    where: { agencyId, role: "director" },
    orderBy: { createdAt: "asc" },
    select: { firmName: true },
  });

  const user = await prisma.user.create({
    data: {
      name,
      email,
      password: null, // pending until they set one via the invite link
      role: "negotiator",
      agencyId,
      firmName: director?.firmName ?? null,
      canViewAllFiles: true, // a colleague follows the sales you progress for the agency
    },
    select: { id: true },
  });

  // Best-effort onboarding email (reuses the client-agent setup flow). A send
  // failure is logged, not fatal — the account exists and they can use Forgot
  // password.
  try {
    await sendClientAgentSetupEmail({ userId: user.id, email, businessName: await businessName(owner.businessId) });
  } catch (err) {
    console.error(`[progression] colleague setup email failed for ${email}`, err);
  }
  console.log(`[AUDIT] progression_colleague_added businessId=${owner.businessId} agencyId=${agencyId} userId=${user.id} by=${owner.userId}`);
  revalidatePath(`/agent/clients/${agencyId}`);
  return { ok: true };
}

/** Re-send the setup link to any pending person on a client agency. Owner-scoped. */
export async function resendClientPersonInviteAction(agencyId: string, userId: string): Promise<ActionResult> {
  if (!progressionBusinessesEnabled()) return { ok: false, error: "This feature isn't enabled yet." };
  const session = await requireSession();
  const owner = await assertOwnerOfClient(session, agencyId);
  if (!owner) return { ok: false, error: "That isn't one of your clients." };

  const user = await prisma.user.findFirst({
    where: { id: userId, agencyId },
    select: { id: true, email: true, password: true },
  });
  if (!user) return { ok: false, error: "That person isn't on this agency." };
  if (user.password) return { ok: false, error: "They've already set up their login." };

  await sendClientAgentSetupEmail({ userId: user.id, email: user.email, businessName: await businessName(owner.businessId) });
  revalidatePath(`/agent/clients/${agencyId}`);
  return { ok: true };
}

/** Remove a colleague from a client agency (soft delete). Owner-scoped. */
export async function removeClientPersonAction(agencyId: string, userId: string): Promise<ActionResult> {
  if (!progressionBusinessesEnabled()) return { ok: false, error: "This feature isn't enabled yet." };
  const session = await requireSession();
  const owner = await assertOwnerOfClient(session, agencyId);
  if (!owner) return { ok: false, error: "That isn't one of your clients." };

  const user = await prisma.user.findFirst({
    where: { id: userId, agencyId },
    select: { id: true, role: true },
  });
  if (!user) return { ok: false, error: "That person isn't on this agency." };
  if (user.role === "director") return { ok: false, error: "You can't remove the main contact (the agency's director)." };

  // Soft-remove: deactivatedAt refuses future sign-ins, the sessionVersion bump
  // kills any live session, and the row stays so their name remains attributed
  // on every timeline entry. Mirrors the director-only team DELETE exactly.
  await prisma.user.update({
    where: { id: userId },
    data: { role: "viewer", deactivatedAt: new Date(), sessionVersion: { increment: 1 } },
  });
  revalidatePath(`/agent/clients/${agencyId}`);
  return { ok: true };
}
