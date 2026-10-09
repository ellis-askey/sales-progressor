"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { progressionBusinessesEnabled, progressionBillingCollectEnabled } from "@/lib/progression/flags";
import { syncBusinessSubscription } from "@/lib/progression/business-stripe";
import { resolveBusinessOwner, addClientAgency, assertOwnerOfClient } from "@/lib/services/progression-clients";
import { sendClientAgentSetupEmail, mintClientSetupLink } from "@/lib/emails/client-agent-invite";
import { sendTeammateSetupEmail } from "@/lib/emails/teammate-invite";
import { parseFeeModel, type ClientFeeModel } from "@/lib/progression/client-fees";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type AddClientResult = { ok: true } | { ok: false; error: string };
// `warning` lets an action succeed at its primary job but still tell the caller
// something non-fatal needs a heads-up (e.g. the team changed but the Stripe seat
// sync hiccuped and will self-heal on the next cron). ok stays true.
type ActionResult = { ok: true; warning?: string } | { ok: false; error: string };

/**
 * Save the business's chase preferences (from the welcome modal / settings).
 * Owner-only + flag-gated. Writes to the ProgressionBusiness, never a client
 * agency's own flags. Enforcement at the send paths lands with the chase engines.
 */
export async function saveProgressorChasePrefsAction(prefs: {
  client: boolean; solicitor: boolean; enquiries: boolean; weekly: boolean; chain: boolean;
}): Promise<ActionResult> {
  if (!progressionBusinessesEnabled()) {
    return { ok: false, error: "This feature isn't enabled yet." };
  }
  const session = await requireSession();
  const owner = await resolveBusinessOwner(session);
  if (!owner) {
    return { ok: false, error: "Only a progression-business owner can change these." };
  }
  await prisma.progressionBusiness.update({
    where: { id: owner.businessId },
    data: {
      chaseClientsEnabled: !!prefs.client,
      chaseSolicitorsEnabled: !!prefs.solicitor,
      chaseEnquiriesEnabled: !!prefs.enquiries,
      weeklyClientUpdatesEnabled: !!prefs.weekly,
      chainUpdatesEnabled: !!prefs.chain,
    },
  });
  return { ok: true };
}

/**
 * Save the full automation settings from the owner's settings page: the 5 chase prefs
 * plus the auto-chain-invites toggle (critiques #22, #23). Owner-only + flag-gated.
 * Writes to the ProgressionBusiness; enforced future-only by the chase engines + the
 * sale-creation invite path.
 */
export async function saveBusinessAutomationAction(input: {
  client: boolean; solicitor: boolean; enquiries: boolean; weekly: boolean; chain: boolean; autoChainInvites: boolean;
}): Promise<ActionResult> {
  if (!progressionBusinessesEnabled()) return { ok: false, error: "This feature isn't enabled yet." };
  const session = await requireSession();
  const owner = await resolveBusinessOwner(session);
  if (!owner) return { ok: false, error: "Only a progression-business owner can change these." };
  await prisma.progressionBusiness.update({
    where: { id: owner.businessId },
    data: {
      chaseClientsEnabled: !!input.client,
      chaseSolicitorsEnabled: !!input.solicitor,
      chaseEnquiriesEnabled: !!input.enquiries,
      weeklyClientUpdatesEnabled: !!input.weekly,
      chainUpdatesEnabled: !!input.chain,
      autoChainInvitesEnabled: !!input.autoChainInvites,
    },
  });
  revalidatePath("/agent/settings/chases");
  return { ok: true };
}

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

  // Optional flat fee captured in the add-client form. Empty = not set (the owner
  // sets it on the client page later; adding a sale is gated until they do).
  const feePenceRaw = (formData.get("feePence") as string | null)?.trim() ?? "";
  const feePence = feePenceRaw ? parseInt(feePenceRaw, 10) : null;
  const feeModel: ClientFeeModel | null =
    feePence != null && Number.isFinite(feePence) && feePence > 0 ? { type: "flat", pence: feePence } : null;

  const result = await addClientAgency({ owner, agentName, agentEmail, agencyName, feeModel });
  if (!result.ok) return result;

  revalidatePath("/agent/clients");
  return { ok: true };
}

/**
 * Rename a client agency. Owner-scoped. The client is a real Agency row — the SAME
 * one the agency edits once it logs in — so there's a single source of truth. The
 * progressor may only correct the name while the client is PENDING (its director
 * hasn't set a password). Once the agency activates, the name is theirs; the
 * progressor's edit control is hidden and this action refuses.
 */
export async function renameClientAgencyAction(agencyId: string, nameRaw: string): Promise<ActionResult> {
  if (!progressionBusinessesEnabled()) return { ok: false, error: "This feature isn't enabled yet." };
  const session = await requireSession();
  const owner = await assertOwnerOfClient(session, agencyId);
  if (!owner) return { ok: false, error: "That isn't one of your clients." };

  const name = nameRaw.trim();
  if (!name || name.length > 120) return { ok: false, error: "Please enter the agency name (120 characters or fewer)." };

  // Pending = the agency's director hasn't set a password yet. Once they have, the
  // name belongs to them and we don't overwrite it from the progressor's side.
  const director = await prisma.user.findFirst({
    where: { agencyId, role: "director" },
    orderBy: { createdAt: "asc" },
    select: { password: true },
  });
  if (director?.password) {
    return { ok: false, error: "They've set up their login, so they manage their agency name now." };
  }

  await prisma.agency.update({ where: { id: agencyId }, data: { name } });
  revalidatePath("/agent/clients");
  revalidatePath(`/agent/clients/${agencyId}`);
  return { ok: true };
}

/**
 * Remove (archive) a client agency from the business's book. Owner-scoped. BLOCKED
 * while the client still has active sales — we never orphan live files. This is a
 * SOFT remove: it sets removedAt, so the link row, the rate card and all history
 * survive. The client drops off the active Clients list and the new-sale picker,
 * renders greyed under "Removed", and can be reinstated at any time. Nothing of the
 * agency's own data is touched (file access is keyed on the transaction's
 * progressionBusinessId, not this link).
 */
export async function removeClientAgencyAction(agencyId: string): Promise<ActionResult> {
  if (!progressionBusinessesEnabled()) return { ok: false, error: "This feature isn't enabled yet." };
  const session = await requireSession();
  const owner = await assertOwnerOfClient(session, agencyId);
  if (!owner) return { ok: false, error: "That isn't one of your clients." };

  // Block while they still have a live sale — active OR on-hold (a paused sale is
  // still in progress; the old guard only counted active, audit SP-polish).
  const activeCount = await prisma.propertyTransaction.count({
    where: { progressionBusinessId: owner.businessId, agencyId, status: { in: ["active", "on_hold"] }, isDemo: false },
  });
  if (activeCount > 0) {
    return {
      ok: false,
      error: `You can't remove this client while they have ${activeCount} in-progress ${activeCount === 1 ? "sale" : "sales"}. Remove them once those have completed or been withdrawn.`,
    };
  }

  await prisma.progressionBusinessClient.update({
    where: { progressionBusinessId_agencyId: { progressionBusinessId: owner.businessId, agencyId } },
    data: { removedAt: new Date() },
  });
  console.log(`[AUDIT] progression_client_removed businessId=${owner.businessId} agencyId=${agencyId} by=${owner.userId}`);
  revalidatePath("/agent/clients");
  revalidatePath(`/agent/clients/${agencyId}`);
  return { ok: true };
}

/**
 * Reinstate a previously-removed client agency. Owner-scoped. Clears removedAt so
 * the client returns to the active book (and the new-sale picker) with its rate
 * card and history intact. No-op-safe if the client was already active.
 */
export async function reinstateClientAgencyAction(agencyId: string): Promise<ActionResult> {
  if (!progressionBusinessesEnabled()) return { ok: false, error: "This feature isn't enabled yet." };
  const session = await requireSession();
  const owner = await assertOwnerOfClient(session, agencyId);
  if (!owner) return { ok: false, error: "That isn't one of your clients." };

  await prisma.progressionBusinessClient.update({
    where: { progressionBusinessId_agencyId: { progressionBusinessId: owner.businessId, agencyId } },
    data: { removedAt: null },
  });
  console.log(`[AUDIT] progression_client_reinstated businessId=${owner.businessId} agencyId=${agencyId} by=${owner.userId}`);
  revalidatePath("/agent/clients");
  revalidatePath(`/agent/clients/${agencyId}`);
  return { ok: true };
}

/**
 * Set or clear the business's short display label — the tight-UI name used on the
 * agent file's "Managed by …" badge (where the full business name can be long).
 * Owner-gated. An empty value clears the override so the full name is used again.
 */
export async function updateBusinessShortNameAction(shortNameRaw: string): Promise<ActionResult> {
  if (!progressionBusinessesEnabled()) return { ok: false, error: "This feature isn't enabled yet." };
  const session = await requireSession();
  const owner = await resolveBusinessOwner(session);
  if (!owner) return { ok: false, error: "Only a progression-business owner can change this." };

  const trimmed = shortNameRaw.trim();
  if (trimmed.length > 40) return { ok: false, error: "Keep the short name to 40 characters or fewer." };

  await prisma.progressionBusiness.update({
    where: { id: owner.businessId },
    data: { shortName: trimmed.length > 0 ? trimmed : null },
  });
  revalidatePath("/agent/clients");
  return { ok: true };
}

/**
 * Save the business's own identity (name + short display label) from the Business
 * settings area. Owner-gated. The name is the business's full name (used in
 * client-facing copy, invite emails, the "Managed by …" badge fallback); the
 * short name is the tight-UI label used where the full name is too long. An empty
 * short name clears the override so the full name is used again.
 */
export async function updateBusinessIdentityAction(nameRaw: string, shortNameRaw: string): Promise<ActionResult> {
  if (!progressionBusinessesEnabled()) return { ok: false, error: "This feature isn't enabled yet." };
  const session = await requireSession();
  const owner = await resolveBusinessOwner(session);
  if (!owner) return { ok: false, error: "Only a progression-business owner can change this." };

  const name = nameRaw.trim();
  if (!name || name.length > 120) return { ok: false, error: "Please enter your business name (120 characters or fewer)." };
  const shortName = shortNameRaw.trim();
  if (shortName.length > 40) return { ok: false, error: "Keep the short name to 40 characters or fewer." };

  await prisma.progressionBusiness.update({
    where: { id: owner.businessId },
    data: { name, shortName: shortName.length > 0 ? shortName : null },
  });
  revalidatePath("/agent/settings/business");
  revalidatePath("/agent/clients");
  return { ok: true };
}

/**
 * Set the business's VAT registration for the invoices it sends its CLIENTS (audit
 * C2b). Owner-only. Registered = VAT added on top of the rate-card fee at vatRateBps,
 * with the VAT number printed on the client invoice. Unregistered = no VAT line
 * (today's behaviour). Independent of what the business pays TSP.
 */
export async function updateBusinessVatAction(
  registered: boolean,
  vatNumberRaw: string,
  ratePercentRaw: string,
): Promise<ActionResult> {
  if (!progressionBusinessesEnabled()) return { ok: false, error: "This feature isn't enabled yet." };
  const session = await requireSession();
  const owner = await resolveBusinessOwner(session);
  if (!owner) return { ok: false, error: "Only a progression-business owner can change this." };

  if (!registered) {
    await prisma.progressionBusiness.update({
      where: { id: owner.businessId },
      data: { vatRegisteredAt: null, vatRateBps: null, vatNumber: null },
    });
    revalidatePath("/agent/settings/business");
    return { ok: true };
  }

  const vatNumber = vatNumberRaw.trim();
  if (!vatNumber || vatNumber.length > 30) return { ok: false, error: "Please enter your VAT number." };
  const rate = parseFloat(ratePercentRaw);
  if (!Number.isFinite(rate) || rate < 0 || rate > 100) return { ok: false, error: "Enter a VAT rate between 0 and 100." };

  // Preserve the original registration date once set (it's a point-in-time fact).
  const existing = await prisma.progressionBusiness.findUnique({
    where: { id: owner.businessId },
    select: { vatRegisteredAt: true },
  });
  await prisma.progressionBusiness.update({
    where: { id: owner.businessId },
    data: {
      vatRegisteredAt: existing?.vatRegisteredAt ?? new Date(),
      vatRateBps: Math.round(rate * 100),
      vatNumber,
    },
  });
  revalidatePath("/agent/settings/business");
  return { ok: true };
}

/**
 * Set the business's billing point for the invoices it sends its CLIENTS (D1).
 * false = a sale is billed in the month it EXCHANGED (default); true = the month
 * it COMPLETED. Only changes WHEN a sale appears on the invoice, not the fee.
 * Owner-only.
 */
export async function updateBusinessBillingPointAction(billAtCompletion: boolean): Promise<ActionResult> {
  if (!progressionBusinessesEnabled()) return { ok: false, error: "This feature isn't enabled yet." };
  const session = await requireSession();
  const owner = await resolveBusinessOwner(session);
  if (!owner) return { ok: false, error: "Only a progression-business owner can change this." };

  await prisma.progressionBusiness.update({
    where: { id: owner.businessId },
    data: { billAtCompletion },
  });
  revalidatePath("/agent/settings/business");
  return { ok: true };
}

/**
 * Create/reconcile the business's Stripe subscription after a card is captured
 * (C1). Owner-only, and only when the collection switch is on. No-ops safely if
 * Stripe or the subscription prices aren't configured (the helper handles that).
 */
export async function syncBusinessSubscriptionAction(): Promise<ActionResult> {
  if (!progressionBusinessesEnabled() || !progressionBillingCollectEnabled()) {
    return { ok: false, error: "Billing isn't live yet." };
  }
  const session = await requireSession();
  const owner = await resolveBusinessOwner(session);
  if (!owner) return { ok: false, error: "Only a progression-business owner can do this." };
  try {
    await syncBusinessSubscription(owner.businessId);
    revalidatePath("/agent/settings/billing");
    return { ok: true };
  } catch (err) {
    console.error("[business-billing] syncBusinessSubscription failed:", err);
    // Surface the real Stripe error during setup/testing so a failure is
    // diagnosable on screen. (Owner-only surface.)
    const msg = err instanceof Error && err.message ? err.message : "Couldn't set up your subscription.";
    return { ok: false, error: msg };
  }
}

/** Cancel the business plan (owner-only). Collects any accrued £5s now and cancels
 *  the base at period-end. */
export async function cancelBusinessPlanAction(): Promise<ActionResult> {
  if (!progressionBusinessesEnabled() || !progressionBillingCollectEnabled()) {
    return { ok: false, error: "Billing isn't live yet." };
  }
  const session = await requireSession();
  const owner = await resolveBusinessOwner(session);
  if (!owner) return { ok: false, error: "Only a progression-business owner can cancel the plan." };
  const { cancelBusinessSubscription } = await import("@/lib/progression/business-stripe");
  const result = await cancelBusinessSubscription(owner.businessId);
  if (result.ok) revalidatePath("/agent/settings/billing");
  return result;
}

/**
 * Set whether a team member sees the whole business book (see-all) or only their
 * own assigned files (see-own). Owner-only. The member must be in the owner's own
 * business; the owner's own row can't be changed (they always see all). Takes
 * effect on the member's next page load — the session re-reads canViewAllFiles, so
 * no re-login and no sessionVersion bump (which would log them out).
 */
export async function setBusinessMemberViewAllAction(memberId: string, canViewAll: boolean): Promise<ActionResult> {
  if (!progressionBusinessesEnabled()) return { ok: false, error: "This feature isn't enabled yet." };
  const session = await requireSession();
  const owner = await resolveBusinessOwner(session);
  if (!owner) return { ok: false, error: "Only a progression-business owner can change this." };

  const member = await prisma.user.findUnique({
    where: { id: memberId },
    select: { progressionBusinessId: true, progressionBusinessRole: true },
  });
  if (!member || member.progressionBusinessId !== owner.businessId) {
    return { ok: false, error: "That isn't one of your team members." };
  }
  if (member.progressionBusinessRole === "owner") {
    return { ok: false, error: "The owner always sees all sales." };
  }

  await prisma.user.update({ where: { id: memberId }, data: { canViewAllFiles: canViewAll } });
  revalidatePath("/agent/team");
  return { ok: true };
}

/**
 * Invite a progressor onto the OWN business team (distinct from inviteClient
 * colleague, which adds a negotiator to a CLIENT agency). Owner-gated. Creates a
 * pending `sales_progressor` in the owner's business, see-own by default (the owner
 * grants see-all on the team screen), and emails them a set-up link.
 */
export async function inviteTeamMemberAction(formData: FormData): Promise<ActionResult> {
  if (!progressionBusinessesEnabled()) return { ok: false, error: "This feature isn't enabled yet." };
  const session = await requireSession();
  const owner = await resolveBusinessOwner(session);
  if (!owner) return { ok: false, error: "Only a business owner can invite team members." };

  const name = (formData.get("name") as string | null)?.trim() ?? "";
  const email = ((formData.get("email") as string | null)?.trim() ?? "").toLowerCase();
  if (!name || name.length > 100) return { ok: false, error: "Please enter their name." };
  if (!email || email.length > 255 || !EMAIL_RE.test(email)) return { ok: false, error: "Please enter a valid email address." };

  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) return { ok: false, error: "An account already exists for that email." };

  const user = await prisma.user.create({
    data: {
      name,
      email,
      password: null, // pending until they set one via the invite link
      role: "sales_progressor",
      agencyId: null,
      progressionBusinessId: owner.businessId,
      progressionBusinessRole: "progressor",
      canViewAllFiles: false, // see-own by default; owner grants see-all on /agent/team
    },
    select: { id: true },
  });

  try {
    await sendTeammateSetupEmail({ userId: user.id, email, name, businessName: await businessName(owner.businessId) });
  } catch (err) {
    console.error(`[progression] teammate setup email failed for ${email}`, err);
  }
  console.log(`[AUDIT] progression_teammate_invited businessId=${owner.businessId} userId=${user.id} by=${owner.userId}`);
  // Reflect the extra seat on the business's Stripe subscription straight away
  // (the daily cron also reconciles). Only when collection is live — this must not
  // touch Stripe before go-live, even if the prices are set for testing. A failure
  // here isn't fatal (the cron self-heals) but we tell the owner rather than swallow
  // it, so a seat that silently didn't bill isn't invisible.
  let warning: string | undefined;
  if (progressionBillingCollectEnabled()) {
    try {
      await syncBusinessSubscription(owner.businessId);
    } catch (err) {
      console.error("[progression] seat sync after invite failed:", err);
      warning = "Invite sent, but we couldn't update your billing seat just now. We'll sort it automatically within a day.";
    }
  }
  revalidatePath("/agent/team");
  return { ok: true, warning };
}

/**
 * Remove a progressor from the OWN business team. Owner-gated; can't remove the
 * owner. Deactivates them (the jwt callback kills the session on deactivatedAt /
 * a sessionVersion bump, so they're locked out immediately) AND unassigns their
 * files in the business — so nothing is orphaned to a user who can no longer log
 * in; those files return to the owner's "needs assigning" queue.
 */
export async function removeTeamMemberAction(memberId: string): Promise<ActionResult> {
  if (!progressionBusinessesEnabled()) return { ok: false, error: "This feature isn't enabled yet." };
  const session = await requireSession();
  const owner = await resolveBusinessOwner(session);
  if (!owner) return { ok: false, error: "Only a business owner can remove team members." };

  const member = await prisma.user.findUnique({
    where: { id: memberId },
    select: { progressionBusinessId: true, progressionBusinessRole: true },
  });
  if (!member || member.progressionBusinessId !== owner.businessId) {
    return { ok: false, error: "That isn't one of your team members." };
  }
  if (member.progressionBusinessRole === "owner") {
    return { ok: false, error: "You can't remove the business owner." };
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: memberId },
      data: { deactivatedAt: new Date(), sessionVersion: { increment: 1 } },
    }),
    prisma.propertyTransaction.updateMany({
      where: { progressionBusinessId: owner.businessId, assignedUserId: memberId },
      data: { assignedUserId: null },
    }),
  ]);
  console.log(`[AUDIT] progression_teammate_removed businessId=${owner.businessId} userId=${memberId} by=${owner.userId}`);
  // Drop the seat on the business's Stripe subscription straight away (the daily
  // cron also reconciles). Only when collection is live. Surface a failure rather
  // than swallow it (the cron self-heals).
  let warning: string | undefined;
  if (progressionBillingCollectEnabled()) {
    try {
      await syncBusinessSubscription(owner.businessId);
    } catch (err) {
      console.error("[progression] seat sync after remove failed:", err);
      warning = "Removed, but we couldn't update your billing seat just now. We'll sort it automatically within a day.";
    }
  }
  revalidatePath("/agent/team");
  return { ok: true, warning };
}

/**
 * Cancel a PENDING team invite — one that was sent but never accepted (the user
 * has no password yet). Owner-gated. Unlike removing an active member (which
 * deactivates and keeps the row), this fully removes the invited user so their
 * email is free to invite again, and drops the £39 seat straight away so an
 * unaccepted invite doesn't keep billing. Refuses to touch an owner or a member
 * who has already set up their account (use removeTeamMemberAction for those).
 */
export async function cancelTeamInviteAction(memberId: string): Promise<ActionResult> {
  if (!progressionBusinessesEnabled()) return { ok: false, error: "This feature isn't enabled yet." };
  const session = await requireSession();
  const owner = await resolveBusinessOwner(session);
  if (!owner) return { ok: false, error: "Only a business owner can cancel invites." };

  const member = await prisma.user.findUnique({
    where: { id: memberId },
    select: { progressionBusinessId: true, progressionBusinessRole: true, password: true },
  });
  if (!member || member.progressionBusinessId !== owner.businessId) {
    return { ok: false, error: "That isn't one of your team members." };
  }
  if (member.progressionBusinessRole === "owner") {
    return { ok: false, error: "You can't cancel the business owner." };
  }
  if (member.password) {
    // They've already accepted and set a password — cancelling an invite no longer
    // applies; this is a remove.
    return { ok: false, error: "They've already set up their account. Remove them instead." };
  }

  // Unassign anything that somehow points at them (a pending invite shouldn't own
  // files, but never orphan), then delete the invite row so the email frees up. A
  // pending invite has no dependent rows, so the delete is safe — but if an
  // unexpected foreign key ever blocks it, fall back to deactivating (locks them
  // out, drops the seat) rather than dead-ending the owner with an unhandled error.
  try {
    await prisma.$transaction([
      prisma.propertyTransaction.updateMany({
        where: { progressionBusinessId: owner.businessId, assignedUserId: memberId },
        data: { assignedUserId: null },
      }),
      prisma.user.delete({ where: { id: memberId } }),
    ]);
  } catch (err) {
    console.error(`[progression] invite cancel hard-delete failed for ${memberId}, deactivating instead:`, err);
    await prisma.user.update({
      where: { id: memberId },
      data: { deactivatedAt: new Date(), sessionVersion: { increment: 1 } },
    });
  }
  console.log(`[AUDIT] progression_invite_cancelled businessId=${owner.businessId} userId=${memberId} by=${owner.userId}`);
  // Drop the seat straight away (the daily cron also reconciles).
  let warning: string | undefined;
  if (progressionBillingCollectEnabled()) {
    try {
      await syncBusinessSubscription(owner.businessId);
    } catch (err) {
      console.error("[progression] seat sync after invite cancel failed:", err);
      warning = "Invite cancelled, but we couldn't update your billing seat just now. We'll sort it automatically within a day.";
    }
  }
  revalidatePath("/agent/team");
  return { ok: true, warning };
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

/**
 * Mint + return the client director's set-up link so the owner can share it
 * directly (WhatsApp, text, on a call) instead of only emailing it. Owner-scoped.
 * Only for a pending agent — once they've set a password the link is pointless.
 */
export async function createClientSetupLinkAction(
  agencyId: string,
  userId?: string,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  if (!progressionBusinessesEnabled()) return { ok: false, error: "This feature isn't enabled yet." };
  const session = await requireSession();
  const owner = await assertOwnerOfClient(session, agencyId);
  if (!owner) return { ok: false, error: "That isn't one of your clients." };

  // A specific person (People tab), else the main contact (Access tab).
  const target = userId
    ? await prisma.user.findFirst({ where: { id: userId, agencyId }, select: { email: true, password: true } })
    : await prisma.user.findFirst({ where: { agencyId, role: "director" }, orderBy: { createdAt: "asc" }, select: { email: true, password: true } });
  if (!target) return { ok: false, error: "That person isn't on this agency." };
  if (target.password) return { ok: false, error: "They've already set up their login." };

  const url = await mintClientSetupLink(target.email);
  return { ok: true, url };
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

/** Toggle a colleague's file access: all the agency's sales vs only their own. Owner-scoped. */
export async function setClientPersonFileAccessAction(agencyId: string, userId: string, canViewAll: boolean): Promise<ActionResult> {
  if (!progressionBusinessesEnabled()) return { ok: false, error: "This feature isn't enabled yet." };
  const session = await requireSession();
  const owner = await assertOwnerOfClient(session, agencyId);
  if (!owner) return { ok: false, error: "That isn't one of your clients." };

  const user = await prisma.user.findFirst({ where: { id: userId, agencyId }, select: { role: true } });
  if (!user) return { ok: false, error: "That person isn't on this agency." };
  if (user.role !== "negotiator") return { ok: false, error: "Only a colleague's access can be changed." };

  await prisma.user.update({ where: { id: userId }, data: { canViewAllFiles: canViewAll } });
  revalidatePath(`/agent/clients/${agencyId}`);
  return { ok: true };
}

/** Make a colleague the main contact: promote them to director, demote the current one. Owner-scoped. */
export async function makeClientMainContactAction(agencyId: string, userId: string): Promise<ActionResult> {
  if (!progressionBusinessesEnabled()) return { ok: false, error: "This feature isn't enabled yet." };
  const session = await requireSession();
  const owner = await assertOwnerOfClient(session, agencyId);
  if (!owner) return { ok: false, error: "That isn't one of your clients." };

  const target = await prisma.user.findFirst({ where: { id: userId, agencyId }, select: { role: true } });
  if (!target) return { ok: false, error: "That person isn't on this agency." };
  if (target.role !== "negotiator") return { ok: false, error: "Only a colleague can be made the main contact." };

  const currentDirector = await prisma.user.findFirst({ where: { agencyId, role: "director" }, orderBy: { createdAt: "asc" }, select: { id: true } });
  await prisma.$transaction([
    // Demote the old contact to colleague, keeping full visibility (a director
    // saw all the agency's sales; a bare negotiator is scoped by canViewAllFiles).
    ...(currentDirector ? [prisma.user.update({ where: { id: currentDirector.id }, data: { role: "negotiator", canViewAllFiles: true } })] : []),
    prisma.user.update({ where: { id: userId }, data: { role: "director" } }),
  ]);
  revalidatePath(`/agent/clients/${agencyId}`);
  return { ok: true };
}

/** Edit a person's name (and, while their invite is pending, their email). Owner-scoped. */
export async function editClientPersonAction(agencyId: string, userId: string, name: string, email?: string): Promise<ActionResult> {
  if (!progressionBusinessesEnabled()) return { ok: false, error: "This feature isn't enabled yet." };
  const session = await requireSession();
  const owner = await assertOwnerOfClient(session, agencyId);
  if (!owner) return { ok: false, error: "That isn't one of your clients." };

  const clean = name.trim();
  if (!clean || clean.length > 100) return { ok: false, error: "Please enter their name." };

  const user = await prisma.user.findFirst({ where: { id: userId, agencyId }, select: { email: true, password: true } });
  if (!user) return { ok: false, error: "That person isn't on this agency." };

  const data: { name: string; email?: string } = { name: clean };
  const newEmail = email?.trim().toLowerCase();
  if (newEmail && newEmail !== user.email.toLowerCase()) {
    if (user.password) return { ok: false, error: "You can only change the email while their invite is pending." };
    if (newEmail.length > 255 || !EMAIL_RE.test(newEmail)) return { ok: false, error: "Please enter a valid email address." };
    const taken = await prisma.user.findUnique({ where: { email: newEmail }, select: { id: true } });
    if (taken) return { ok: false, error: "An account already exists for that email." };
    data.email = newEmail;
    // The old set-up token was keyed to the old email — clear it so a resend mints fresh.
    await prisma.verificationToken.deleteMany({ where: { identifier: user.email.toLowerCase() } });
  }

  await prisma.user.update({ where: { id: userId }, data });
  revalidatePath(`/agent/clients/${agencyId}`);
  return { ok: true };
}

/** Cancel a pending colleague's invite entirely (they never activated). Owner-scoped. */
export async function cancelClientInviteAction(agencyId: string, userId: string): Promise<ActionResult> {
  if (!progressionBusinessesEnabled()) return { ok: false, error: "This feature isn't enabled yet." };
  const session = await requireSession();
  const owner = await assertOwnerOfClient(session, agencyId);
  if (!owner) return { ok: false, error: "That isn't one of your clients." };

  const user = await prisma.user.findFirst({ where: { id: userId, agencyId }, select: { role: true, password: true, email: true } });
  if (!user) return { ok: false, error: "That person isn't on this agency." };
  if (user.role === "director") return { ok: false, error: "You can't cancel the main contact." };
  if (user.password) return { ok: false, error: "They've already set up their login. Remove them instead." };

  await prisma.verificationToken.deleteMany({ where: { identifier: user.email.toLowerCase() } });
  await prisma.user.delete({ where: { id: userId } });
  revalidatePath(`/agent/clients/${agencyId}`);
  return { ok: true };
}

/** Reinstate a removed colleague (role back to negotiator, access restored). Owner-scoped. */
export async function reinstateClientPersonAction(agencyId: string, userId: string): Promise<ActionResult> {
  if (!progressionBusinessesEnabled()) return { ok: false, error: "This feature isn't enabled yet." };
  const session = await requireSession();
  const owner = await assertOwnerOfClient(session, agencyId);
  if (!owner) return { ok: false, error: "That isn't one of your clients." };

  const user = await prisma.user.findFirst({ where: { id: userId, agencyId }, select: { role: true } });
  if (!user) return { ok: false, error: "That person isn't on this agency." };
  if (user.role !== "viewer") return { ok: false, error: "That person isn't removed." };

  await prisma.user.update({ where: { id: userId }, data: { role: "negotiator", deactivatedAt: null, sessionVersion: { increment: 1 } } });
  revalidatePath(`/agent/clients/${agencyId}`);
  return { ok: true };
}
