"use server";

// Onward-Purchase Visibility arc — Stage 2 portal actions.
//
// Token-authenticated (no session) actions letting a SELLER report their onward
// purchase from their own portal. Same shadow tracker as the agent-side card;
// confirms are stamped source=seller with the token's Contact. Hard vendor gate:
// only a vendor-role portal token may touch the onward tracker (a buyer has no
// onward in this model). Mirrors the vendor/purchaser guards in app/actions/portal.ts.
//
// Spec: docs/active/onward-visibility/00-discovery.md.

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { Tenure, PurchaseType } from "@prisma/client";
import {
  getOnwardTrackerView,
  openOnwardTracker,
  setOnwardTypeFacts,
  confirmOnwardStep,
  undoOnwardStep,
  onwardMortgageNeedsConfirm,
  backfillOnwardMortgageOffer,
  abandonOnwardTracker,
  reactivateOnwardTracker,
  resetOnwardTracker,
  setOnwardSurveySkipped,
  type OnwardTrackerView,
  type ConfirmOnwardResult,
  type UndoOnwardResult,
} from "@/lib/services/onward";
import { writeClientChainStub } from "@/lib/services/chains";
import { createNotification, addPortalClientSelfNote } from "@/lib/services/notifications";

// Resolve a portal token to its Contact and require it be the seller (vendor).
// Returns null when the token is invalid or not a vendor — callers translate
// that into a soft failure, never leaking which case it was.
async function resolveVendor(token: string): Promise<{ contactId: string; contactName: string; transactionId: string } | null> {
  const contact = await prisma.contact.findUnique({
    where: { portalToken: token },
    select: { id: true, name: true, roleType: true, propertyTransactionId: true },
  });
  if (!contact || contact.roleType !== "vendor") return null;
  return { contactId: contact.id, contactName: contact.name, transactionId: contact.propertyTransactionId };
}

function revalidatePortal(token: string) {
  revalidatePath(`/portal/${token}`, "page");
}

// Notify the file (staff/agent activity note + bell to the managing user) and
// show the client their own action back in their portal. Shared by the onward
// lifecycle actions (changed place / no longer buying). Never reaches the other
// side — the internal note is staff-only and the self-note is vendor-scoped.
async function notifyOnwardLifecycle(opts: {
  transactionId: string;
  contactId: string;
  contactName: string;
  internalBody: string;
  bellTitle: string;
  selfSingular: string;
  selfPlural: (firstName: string) => string;
}) {
  const tx = await prisma.propertyTransaction.findUnique({
    where: { id: opts.transactionId },
    select: { serviceType: true, assignedUserId: true, agentUserId: true },
  });
  const managingUserId = tx ? (tx.serviceType !== "self_managed" ? tx.assignedUserId : tx.agentUserId) : null;
  await prisma.outboundMessage.create({
    data: { transactionId: opts.transactionId, type: "internal_note", contactIds: [], content: opts.internalBody },
  });
  if (managingUserId) {
    await createNotification({
      userId: managingUserId,
      type: "portal_onward_lifecycle",
      transactionId: opts.transactionId,
      payload: { title: opts.bellTitle, body: opts.internalBody, contactName: opts.contactName },
    });
  }
  await addPortalClientSelfNote({
    transactionId: opts.transactionId,
    actorContactId: opts.contactId,
    actorName: opts.contactName,
    side: "vendor",
    singular: opts.selfSingular,
    plural: opts.selfPlural,
  });
}

export async function portalGetOnwardTrackerAction(token: string): Promise<OnwardTrackerView | null> {
  const v = await resolveVendor(token);
  if (!v) return null;
  return getOnwardTrackerView(v.transactionId);
}

export async function portalOpenOnwardTrackerAction(token: string): Promise<OnwardTrackerView | null> {
  const v = await resolveVendor(token);
  if (!v) return null;
  await openOnwardTracker(v.transactionId);
  revalidatePortal(token);
  return getOnwardTrackerView(v.transactionId);
}

export async function portalSetOnwardTypeFactsAction(input: {
  token: string;
  tenure: Tenure;
  purchaseType: PurchaseType;
  isShareOfFreehold: boolean;
}): Promise<OnwardTrackerView | null> {
  const v = await resolveVendor(input.token);
  if (!v) return null;
  await setOnwardTypeFacts(v.transactionId, {
    tenure: input.tenure,
    purchaseType: input.purchaseType,
    isShareOfFreehold: input.isShareOfFreehold,
  });
  revalidatePortal(input.token);
  return getOnwardTrackerView(v.transactionId);
}

export async function portalConfirmOnwardStepAction(input: {
  token: string;
  milestoneCode: string;
  eventDate?: string | null;
}): Promise<{ result: ConfirmOnwardResult; view: OnwardTrackerView } | null> {
  const v = await resolveVendor(input.token);
  if (!v) return null;
  const result = await confirmOnwardStep(v.transactionId, input.milestoneCode, input.eventDate ?? null, {
    source: "seller",
    contactId: v.contactId,
  });
  revalidatePortal(input.token);
  const view = await getOnwardTrackerView(v.transactionId);
  return { result, view };
}

export async function portalUndoOnwardStepAction(input: {
  token: string;
  milestoneCode: string;
}): Promise<{ result: UndoOnwardResult; view: OnwardTrackerView } | null> {
  const v = await resolveVendor(input.token);
  if (!v) return null;
  const result = await undoOnwardStep(v.transactionId, input.milestoneCode);
  revalidatePortal(input.token);
  const view = await getOnwardTrackerView(v.transactionId);
  return { result, view };
}

// After the seller enters their onward mortgage offer expiry: does the tracker
// still need the offer confirmed (mortgage onward, PM11 not reported)?
export async function portalOnwardMortgageStatusAction(token: string): Promise<{ needsConfirm: boolean } | null> {
  const v = await resolveVendor(token);
  if (!v) return null;
  return { needsConfirm: await onwardMortgageNeedsConfirm(v.transactionId) };
}

// The seller confirms their onward mortgage offer is in place → back-fills the
// three mortgage steps on the tracker.
export async function portalConfirmOnwardMortgageOfferAction(token: string): Promise<OnwardTrackerView | null> {
  const v = await resolveVendor(token);
  if (!v) return null;
  await backfillOnwardMortgageOffer(v.transactionId, { source: "seller", contactId: v.contactId });
  revalidatePortal(token);
  return getOnwardTrackerView(v.transactionId);
}

// ── Lifecycle (manual) ───────────────────────────────────────────────────────
//
// These deliberately DON'T call revalidatePath: doing so inside the client's
// transition forced a full re-render of the heavy portal page and left the
// button spinning for many seconds. The panel updates instantly from the
// returned view instead; other surfaces refresh on their next load.

export async function portalAbandonOnwardAction(token: string): Promise<OnwardTrackerView | null> {
  const v = await resolveVendor(token);
  if (!v) return null;
  await abandonOnwardTracker(v.transactionId);
  await notifyOnwardLifecycle({
    transactionId: v.transactionId,
    contactId: v.contactId,
    contactName: v.contactName,
    internalBody: `${v.contactName} marked their onward purchase as no longer going ahead via the portal.`,
    bellTitle: "Onward purchase stopped",
    selfSingular: "You let us know you're no longer buying onward.",
    selfPlural: (n) => `${n} let us know you're no longer buying onward.`,
  });
  return getOnwardTrackerView(v.transactionId);
}

export async function portalReactivateOnwardAction(token: string): Promise<OnwardTrackerView | null> {
  const v = await resolveVendor(token);
  if (!v) return null;
  await reactivateOnwardTracker(v.transactionId);
  return getOnwardTrackerView(v.transactionId);
}

export async function portalResetOnwardAction(token: string): Promise<OnwardTrackerView | null> {
  const v = await resolveVendor(token);
  if (!v) return null;
  await resetOnwardTracker(v.transactionId);
  return getOnwardTrackerView(v.transactionId);
}

// Seller opts out of (or back into) the survey on their onward, mirroring the
// buyer's manual survey skip.
export async function portalSkipOnwardSurveyAction(token: string, skipped: boolean): Promise<OnwardTrackerView | null> {
  const v = await resolveVendor(token);
  if (!v) return null;
  await setOnwardSurveySkipped(v.transactionId, skipped);
  return getOnwardTrackerView(v.transactionId);
}

// "My onward changed to a different place." The seller gives us the new
// property + its agent + how they're buying it; we write the new place to the
// chain link above them (agent-owned but seller-editable until they join),
// reset the reported steps, and set the new type facts. Notifies the file and
// shows the client their own action back.
export async function portalChangeOnwardPlaceAction(input: {
  token: string;
  newAddress: string;
  agencyName: string | null;
  agentName: string | null;
  agentEmail: string | null;
  agentPhone: string | null;
  tenure: Tenure;
  purchaseType: PurchaseType;
  isShareOfFreehold: boolean;
}): Promise<{ ok: true; view: OnwardTrackerView } | { ok: false; error: string } | null> {
  const v = await resolveVendor(input.token);
  if (!v) return null;

  const newAddress = input.newAddress.trim();
  const agencyName = input.agencyName?.trim() || null;
  const agentName  = input.agentName?.trim() || null;
  const agentEmail = input.agentEmail?.trim() || null;
  const agentPhone = input.agentPhone?.trim() || null;
  if (!newAddress) return { ok: false, error: "Add the address of the place you're buying." };

  const tx = await prisma.propertyTransaction.findUnique({
    where: { id: v.transactionId },
    select: { serviceType: true, assignedUserId: true, agentUserId: true, agencyId: true },
  });
  const managingUserId = tx ? (tx.serviceType !== "self_managed" ? tx.assignedUserId : tx.agentUserId) : null;
  if (!tx || !managingUserId || !tx.agencyId) {
    return { ok: false, error: "We can't update the chain on this file yet. Let us know and we'll sort it." };
  }

  const written = await writeClientChainStub({
    transactionId: v.transactionId,
    agencyId: tx.agencyId,
    managingUserId,
    direction: "above",
    stub: {
      stubPropertyAddress: newAddress,
      stubAgencyName: agencyName ?? "",
      stubAgentName: agentName,
      stubAgentEmail: agentEmail,
      stubAgentPhone: agentPhone,
    },
  });
  if (!written.ok) {
    return {
      ok: false,
      error: written.reason === "joined"
        ? "The agent for that place has already joined the chain, so we can't change it here. Let us know and we'll sort it."
        : "We've invited the agent for that place, so it's locked for now. Let us know and we'll sort it.",
    };
  }

  // Fresh steps against the new place, then the new type facts.
  await resetOnwardTracker(v.transactionId);
  await setOnwardTypeFacts(v.transactionId, {
    tenure: input.tenure,
    purchaseType: input.purchaseType,
    isShareOfFreehold: input.isShareOfFreehold,
  });

  await notifyOnwardLifecycle({
    transactionId: v.transactionId,
    contactId: v.contactId,
    contactName: v.contactName,
    internalBody: `${v.contactName} changed their onward purchase to a different place via the portal: ${newAddress}. Steps were reset; review and reconcile the chain link.`,
    bellTitle: "Onward purchase changed",
    selfSingular: `You told us your onward purchase changed to ${newAddress}.`,
    selfPlural: (n) => `${n} told us your onward purchase changed to ${newAddress}.`,
  });

  return { ok: true, view: await getOnwardTrackerView(v.transactionId) };
}
