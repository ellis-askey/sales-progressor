"use server";

// Onward-Purchase Visibility arc — Stage 1 server actions.
//
// Thin auth + multi-tenant guard (Law 7) around lib/services/onward.ts. Every
// action re-checks that the caller can access the seller's transaction via the
// access-scope helper before touching the tracker — the service layer is
// scope-agnostic and trusts these guards.
//
// Stage 1 confirms are AGENT-sourced (an internal user filling in what they
// know). The seller-portal path (source: "seller") lands in Stage 2.

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/session";
import { getAccessScope, scopeOwnershipWhere } from "@/lib/security/access-scope";
import { prisma } from "@/lib/prisma";
import type { Tenure, PurchaseType, OnwardTrackerKind } from "@prisma/client";
import {
  getOnwardTrackerView,
  openOnwardTracker,
  setOnwardTypeFacts,
  setOnwardRelatedAddress,
  confirmOnwardStep,
  undoOnwardStep,
  type OnwardTrackerView,
  type ConfirmOnwardResult,
  type UndoOnwardResult,
} from "@/lib/services/onward";

function revalidateTx(id: string) {
  revalidatePath(`/transactions/${id}`, "page");
  revalidatePath(`/agent/transactions/${id}`, "page");
}

// Setting up an onward PURCHASE means the seller IS buying another property, so
// this sale is no longer "chain-free". Clear any No-chain confirmation from the
// Chains page (noChainNeededAt) so the two surfaces can't contradict each other.
// Guarded updateMany → a no-op write when the flag isn't set. Only the onward
// actions call this; the related-sale actions concern the buyer's own sale.
async function clearNoChainFlag(transactionId: string) {
  const { count } = await prisma.propertyTransaction.updateMany({
    where: { id: transactionId, noChainNeededAt: { not: null } },
    data: { noChainNeededAt: null, noChainNeededById: null },
  });
  if (count > 0) revalidatePath("/agent/chains");
}

// Ownership gate. Throws if the transaction is out of the caller's scope.
async function requireTxInScope(transactionId: string) {
  const session = await requireSession();
  const scope = getAccessScope(session);
  const tx = await prisma.propertyTransaction.findFirst({
    where: scopeOwnershipWhere(scope, transactionId),
    select: { id: true },
  });
  if (!tx) throw new Error("Transaction not found");
  return { session };
}

export async function getOnwardTrackerViewAction(transactionId: string): Promise<OnwardTrackerView> {
  await requireTxInScope(transactionId);
  return getOnwardTrackerView(transactionId);
}

export async function openOnwardTrackerAction(transactionId: string): Promise<OnwardTrackerView> {
  await requireTxInScope(transactionId);
  await openOnwardTracker(transactionId);
  await clearNoChainFlag(transactionId);
  revalidateTx(transactionId);
  return getOnwardTrackerView(transactionId);
}

export async function setOnwardTypeFactsAction(input: {
  transactionId: string;
  tenure: Tenure;
  purchaseType: PurchaseType;
  isShareOfFreehold: boolean;
}): Promise<OnwardTrackerView> {
  await requireTxInScope(input.transactionId);
  await setOnwardTypeFacts(input.transactionId, {
    tenure: input.tenure,
    purchaseType: input.purchaseType,
    isShareOfFreehold: input.isShareOfFreehold,
  });
  await clearNoChainFlag(input.transactionId);
  revalidateTx(input.transactionId);
  return getOnwardTrackerView(input.transactionId);
}

// A+B (2026-09): capture the related/onward property's address so inbound mail
// naming it auto-files onto this file (mail matcher reads it like a chain stub).
export async function setOnwardRelatedAddressAction(input: {
  transactionId: string;
  kind: OnwardTrackerKind;
  address: string | null;
}): Promise<OnwardTrackerView> {
  await requireTxInScope(input.transactionId);
  await setOnwardRelatedAddress(input.transactionId, input.kind, input.address);
  revalidateTx(input.transactionId);
  return getOnwardTrackerView(input.transactionId, input.kind);
}

export async function confirmOnwardStepAction(input: {
  transactionId: string;
  milestoneCode: string;
  eventDate?: string | null;
  keyCollectionRequired?: boolean | null;
  bookedSurveyorName?: string | null;
}): Promise<{ result: ConfirmOnwardResult; view: OnwardTrackerView }> {
  const { session } = await requireTxInScope(input.transactionId);
  const result = await confirmOnwardStep(
    input.transactionId,
    input.milestoneCode,
    input.eventDate ?? null,
    { source: "agent", userId: session.user.id },
    "onward_purchase",
    { keyCollectionRequired: input.keyCollectionRequired ?? null, bookedSurveyorName: input.bookedSurveyorName ?? null },
  );
  revalidateTx(input.transactionId);
  const view = await getOnwardTrackerView(input.transactionId);
  return { result, view };
}

export async function undoOnwardStepAction(input: {
  transactionId: string;
  milestoneCode: string;
}): Promise<{ result: UndoOnwardResult; view: OnwardTrackerView }> {
  await requireTxInScope(input.transactionId);
  const result = await undoOnwardStep(input.transactionId, input.milestoneCode);
  revalidateTx(input.transactionId);
  const view = await getOnwardTrackerView(input.transactionId);
  return { result, view };
}

// ── Related sale (buyer side, the link below) ────────────────────────────────
// Same guards as the onward actions; kind="related_sale" tracks the SELLING (VM)
// steps of the property this file's buyer is selling. A related sale has only
// tenure (no buying axis), so setTypeFacts takes no purchaseType.

export async function getRelatedSaleViewAction(transactionId: string): Promise<OnwardTrackerView> {
  await requireTxInScope(transactionId);
  return getOnwardTrackerView(transactionId, "related_sale");
}

export async function openRelatedSaleAction(transactionId: string): Promise<OnwardTrackerView> {
  await requireTxInScope(transactionId);
  await openOnwardTracker(transactionId, "related_sale");
  revalidateTx(transactionId);
  return getOnwardTrackerView(transactionId, "related_sale");
}

export async function setRelatedSaleTypeFactsAction(input: {
  transactionId: string;
  tenure: Tenure;
  isShareOfFreehold: boolean;
}): Promise<OnwardTrackerView> {
  await requireTxInScope(input.transactionId);
  await setOnwardTypeFacts(
    input.transactionId,
    { tenure: input.tenure, isShareOfFreehold: input.isShareOfFreehold },
    "related_sale",
  );
  revalidateTx(input.transactionId);
  return getOnwardTrackerView(input.transactionId, "related_sale");
}

export async function confirmRelatedSaleStepAction(input: {
  transactionId: string;
  milestoneCode: string;
  eventDate?: string | null;
  keyCollectionRequired?: boolean | null;
  bookedSurveyorName?: string | null;
}): Promise<{ result: ConfirmOnwardResult; view: OnwardTrackerView }> {
  const { session } = await requireTxInScope(input.transactionId);
  const result = await confirmOnwardStep(
    input.transactionId,
    input.milestoneCode,
    input.eventDate ?? null,
    { source: "agent", userId: session.user.id },
    "related_sale",
    { keyCollectionRequired: input.keyCollectionRequired ?? null, bookedSurveyorName: input.bookedSurveyorName ?? null },
  );
  revalidateTx(input.transactionId);
  const view = await getOnwardTrackerView(input.transactionId, "related_sale");
  return { result, view };
}

export async function undoRelatedSaleStepAction(input: {
  transactionId: string;
  milestoneCode: string;
}): Promise<{ result: UndoOnwardResult; view: OnwardTrackerView }> {
  await requireTxInScope(input.transactionId);
  const result = await undoOnwardStep(input.transactionId, input.milestoneCode, "related_sale");
  revalidateTx(input.transactionId);
  const view = await getOnwardTrackerView(input.transactionId, "related_sale");
  return { result, view };
}

// ── FAR sides (agent-only) ───────────────────────────────────────────────────
// The other party in each neighbour deal: the onward purchase's SELLER (vendor
// steps) and the related sale's BUYER (purchaser steps). Confirmable only from
// the agent surface (these guards + source "agent") — never the client portal.
// Tenure is the same property as the near sibling; the UI pre-fills it.

export async function getOnwardSellerViewAction(transactionId: string): Promise<OnwardTrackerView> {
  await requireTxInScope(transactionId);
  return getOnwardTrackerView(transactionId, "onward_purchase_seller");
}

export async function openOnwardSellerAction(transactionId: string): Promise<OnwardTrackerView> {
  await requireTxInScope(transactionId);
  await openOnwardTracker(transactionId, "onward_purchase_seller");
  revalidateTx(transactionId);
  return getOnwardTrackerView(transactionId, "onward_purchase_seller");
}

export async function setOnwardSellerTypeFactsAction(input: {
  transactionId: string;
  tenure: Tenure;
  isShareOfFreehold: boolean;
}): Promise<OnwardTrackerView> {
  await requireTxInScope(input.transactionId);
  await setOnwardTypeFacts(
    input.transactionId,
    { tenure: input.tenure, isShareOfFreehold: input.isShareOfFreehold },
    "onward_purchase_seller",
  );
  revalidateTx(input.transactionId);
  return getOnwardTrackerView(input.transactionId, "onward_purchase_seller");
}

export async function confirmOnwardSellerStepAction(input: {
  transactionId: string;
  milestoneCode: string;
  eventDate?: string | null;
  keyCollectionRequired?: boolean | null;
  bookedSurveyorName?: string | null;
}): Promise<{ result: ConfirmOnwardResult; view: OnwardTrackerView }> {
  const { session } = await requireTxInScope(input.transactionId);
  const result = await confirmOnwardStep(
    input.transactionId,
    input.milestoneCode,
    input.eventDate ?? null,
    { source: "agent", userId: session.user.id },
    "onward_purchase_seller",
    { keyCollectionRequired: input.keyCollectionRequired ?? null, bookedSurveyorName: input.bookedSurveyorName ?? null },
  );
  revalidateTx(input.transactionId);
  const view = await getOnwardTrackerView(input.transactionId, "onward_purchase_seller");
  return { result, view };
}

export async function undoOnwardSellerStepAction(input: {
  transactionId: string;
  milestoneCode: string;
}): Promise<{ result: UndoOnwardResult; view: OnwardTrackerView }> {
  await requireTxInScope(input.transactionId);
  const result = await undoOnwardStep(input.transactionId, input.milestoneCode, "onward_purchase_seller");
  revalidateTx(input.transactionId);
  const view = await getOnwardTrackerView(input.transactionId, "onward_purchase_seller");
  return { result, view };
}

export async function getRelatedBuyerViewAction(transactionId: string): Promise<OnwardTrackerView> {
  await requireTxInScope(transactionId);
  return getOnwardTrackerView(transactionId, "related_sale_buyer");
}

export async function openRelatedBuyerAction(transactionId: string): Promise<OnwardTrackerView> {
  await requireTxInScope(transactionId);
  await openOnwardTracker(transactionId, "related_sale_buyer");
  revalidateTx(transactionId);
  return getOnwardTrackerView(transactionId, "related_sale_buyer");
}

export async function setRelatedBuyerTypeFactsAction(input: {
  transactionId: string;
  tenure: Tenure;
  purchaseType: PurchaseType;
  isShareOfFreehold: boolean;
}): Promise<OnwardTrackerView> {
  await requireTxInScope(input.transactionId);
  await setOnwardTypeFacts(
    input.transactionId,
    { tenure: input.tenure, purchaseType: input.purchaseType, isShareOfFreehold: input.isShareOfFreehold },
    "related_sale_buyer",
  );
  revalidateTx(input.transactionId);
  return getOnwardTrackerView(input.transactionId, "related_sale_buyer");
}

export async function confirmRelatedBuyerStepAction(input: {
  transactionId: string;
  milestoneCode: string;
  eventDate?: string | null;
  keyCollectionRequired?: boolean | null;
  bookedSurveyorName?: string | null;
}): Promise<{ result: ConfirmOnwardResult; view: OnwardTrackerView }> {
  const { session } = await requireTxInScope(input.transactionId);
  const result = await confirmOnwardStep(
    input.transactionId,
    input.milestoneCode,
    input.eventDate ?? null,
    { source: "agent", userId: session.user.id },
    "related_sale_buyer",
    { keyCollectionRequired: input.keyCollectionRequired ?? null, bookedSurveyorName: input.bookedSurveyorName ?? null },
  );
  revalidateTx(input.transactionId);
  const view = await getOnwardTrackerView(input.transactionId, "related_sale_buyer");
  return { result, view };
}

export async function undoRelatedBuyerStepAction(input: {
  transactionId: string;
  milestoneCode: string;
}): Promise<{ result: UndoOnwardResult; view: OnwardTrackerView }> {
  await requireTxInScope(input.transactionId);
  const result = await undoOnwardStep(input.transactionId, input.milestoneCode, "related_sale_buyer");
  revalidateTx(input.transactionId);
  const view = await getOnwardTrackerView(input.transactionId, "related_sale_buyer");
  return { result, view };
}
