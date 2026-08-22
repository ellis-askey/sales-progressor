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
  type OnwardTrackerView,
  type ConfirmOnwardResult,
  type UndoOnwardResult,
} from "@/lib/services/onward";

// Resolve a portal token to its Contact and require it be the seller (vendor).
// Returns null when the token is invalid or not a vendor — callers translate
// that into a soft failure, never leaking which case it was.
async function resolveVendor(token: string): Promise<{ contactId: string; transactionId: string } | null> {
  const contact = await prisma.contact.findUnique({
    where: { portalToken: token },
    select: { id: true, roleType: true, propertyTransactionId: true },
  });
  if (!contact || contact.roleType !== "vendor") return null;
  return { contactId: contact.id, transactionId: contact.propertyTransactionId };
}

function revalidatePortal(token: string) {
  revalidatePath(`/portal/${token}`, "page");
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

export async function portalAbandonOnwardAction(token: string): Promise<OnwardTrackerView | null> {
  const v = await resolveVendor(token);
  if (!v) return null;
  await abandonOnwardTracker(v.transactionId);
  revalidatePortal(token);
  return getOnwardTrackerView(v.transactionId);
}

export async function portalReactivateOnwardAction(token: string): Promise<OnwardTrackerView | null> {
  const v = await resolveVendor(token);
  if (!v) return null;
  await reactivateOnwardTracker(v.transactionId);
  revalidatePortal(token);
  return getOnwardTrackerView(v.transactionId);
}

export async function portalResetOnwardAction(token: string): Promise<OnwardTrackerView | null> {
  const v = await resolveVendor(token);
  if (!v) return null;
  await resetOnwardTracker(v.transactionId);
  revalidatePortal(token);
  return getOnwardTrackerView(v.transactionId);
}
