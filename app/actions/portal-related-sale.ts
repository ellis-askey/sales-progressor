"use server";

// Related-sale portal actions (mirror of app/actions/portal-onward.ts, buyer side).
//
// Token-authenticated actions letting a BUYER report their "related sale" (the
// property they're selling to fund their purchase, the chain link below them)
// from their own portal. Same shadow tracker as onward, but kind="related_sale"
// so it tracks the SELLING (VM) steps. Confirms are stamped source=buyer with the
// token's Contact. Hard purchaser gate: only a purchaser-role token may touch it
// (a seller reports their onward instead, via portal-onward.ts).
//
// Spec: docs/active/related-sale/00-spec.md.

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { Tenure } from "@prisma/client";
import {
  getOnwardTrackerView,
  openOnwardTracker,
  setOnwardTypeFacts,
  confirmOnwardStep,
  undoOnwardStep,
  abandonOnwardTracker,
  reactivateOnwardTracker,
  type OnwardTrackerView,
  type ConfirmOnwardResult,
  type UndoOnwardResult,
} from "@/lib/services/onward";
import { createNotification, addPortalClientSelfNote } from "@/lib/services/notifications";

const KIND = "related_sale" as const;

// Resolve a portal token to its Contact and require it be the buyer (purchaser).
// Returns null when the token is invalid or not a purchaser — callers translate
// that into a soft failure, never leaking which case it was.
async function resolvePurchaser(token: string): Promise<{ contactId: string; contactName: string; transactionId: string } | null> {
  const contact = await prisma.contact.findUnique({
    where: { portalToken: token },
    select: { id: true, name: true, roleType: true, propertyTransactionId: true },
  });
  if (!contact || contact.roleType !== "purchaser") return null;
  return { contactId: contact.id, contactName: contact.name, transactionId: contact.propertyTransactionId };
}

function revalidatePortal(token: string) {
  revalidatePath(`/portal/${token}`, "page");
}

export async function portalGetRelatedSaleAction(token: string): Promise<OnwardTrackerView | null> {
  const p = await resolvePurchaser(token);
  if (!p) return null;
  return getOnwardTrackerView(p.transactionId, KIND);
}

export async function portalOpenRelatedSaleAction(token: string): Promise<OnwardTrackerView | null> {
  const p = await resolvePurchaser(token);
  if (!p) return null;
  await openOnwardTracker(p.transactionId, KIND);
  revalidatePortal(token);
  return getOnwardTrackerView(p.transactionId, KIND);
}

// A related sale has only tenure (+ share of freehold): the buyer is the SELLER
// here, so there's no "how you're buying" axis.
export async function portalSetRelatedSaleTypeFactsAction(input: {
  token: string;
  tenure: Tenure;
  isShareOfFreehold: boolean;
}): Promise<OnwardTrackerView | null> {
  const p = await resolvePurchaser(input.token);
  if (!p) return null;
  await setOnwardTypeFacts(
    p.transactionId,
    { tenure: input.tenure, isShareOfFreehold: input.isShareOfFreehold },
    KIND,
  );
  revalidatePortal(input.token);
  return getOnwardTrackerView(p.transactionId, KIND);
}

export async function portalConfirmRelatedSaleStepAction(input: {
  token: string;
  milestoneCode: string;
  eventDate?: string | null;
}): Promise<{ result: ConfirmOnwardResult; view: OnwardTrackerView } | null> {
  const p = await resolvePurchaser(input.token);
  if (!p) return null;
  const result = await confirmOnwardStep(
    p.transactionId,
    input.milestoneCode,
    input.eventDate ?? null,
    { source: "buyer", contactId: p.contactId },
    KIND,
  );
  revalidatePortal(input.token);
  const view = await getOnwardTrackerView(p.transactionId, KIND);
  return { result, view };
}

export async function portalUndoRelatedSaleStepAction(input: {
  token: string;
  milestoneCode: string;
}): Promise<{ result: UndoOnwardResult; view: OnwardTrackerView } | null> {
  const p = await resolvePurchaser(input.token);
  if (!p) return null;
  const result = await undoOnwardStep(p.transactionId, input.milestoneCode, KIND);
  revalidatePortal(input.token);
  const view = await getOnwardTrackerView(p.transactionId, KIND);
  return { result, view };
}

// ── Lifecycle (manual) ───────────────────────────────────────────────────────
// Same pattern as portal-onward: no revalidatePath (keeps the button snappy; the
// panel updates from the returned view). Notifies the file + shows the client
// their own action, scoped to the purchaser side (never reaches the seller).

async function notifyRelatedSaleLifecycle(opts: {
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
    side: "purchaser",
    singular: opts.selfSingular,
    plural: opts.selfPlural,
  });
}

export async function portalAbandonRelatedSaleAction(token: string): Promise<OnwardTrackerView | null> {
  const p = await resolvePurchaser(token);
  if (!p) return null;
  await abandonOnwardTracker(p.transactionId, KIND);
  await notifyRelatedSaleLifecycle({
    transactionId: p.transactionId,
    contactId: p.contactId,
    contactName: p.contactName,
    internalBody: `${p.contactName} marked their related sale as no longer going ahead via the portal.`,
    bellTitle: "Related sale stopped",
    selfSingular: "You let us know your sale is no longer going ahead.",
    selfPlural: (n) => `${n} let us know your sale is no longer going ahead.`,
  });
  return getOnwardTrackerView(p.transactionId, KIND);
}

export async function portalReactivateRelatedSaleAction(token: string): Promise<OnwardTrackerView | null> {
  const p = await resolvePurchaser(token);
  if (!p) return null;
  await reactivateOnwardTracker(p.transactionId, KIND);
  return getOnwardTrackerView(p.transactionId, KIND);
}
