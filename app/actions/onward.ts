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
import type { Tenure, PurchaseType } from "@prisma/client";
import {
  getOnwardTrackerView,
  openOnwardTracker,
  setOnwardTypeFacts,
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
  revalidateTx(input.transactionId);
  return getOnwardTrackerView(input.transactionId);
}

export async function confirmOnwardStepAction(input: {
  transactionId: string;
  milestoneCode: string;
  eventDate?: string | null;
}): Promise<{ result: ConfirmOnwardResult; view: OnwardTrackerView }> {
  const { session } = await requireTxInScope(input.transactionId);
  const result = await confirmOnwardStep(
    input.transactionId,
    input.milestoneCode,
    input.eventDate ?? null,
    { source: "agent", userId: session.user.id },
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
}): Promise<{ result: ConfirmOnwardResult; view: OnwardTrackerView }> {
  const { session } = await requireTxInScope(input.transactionId);
  const result = await confirmOnwardStep(
    input.transactionId,
    input.milestoneCode,
    input.eventDate ?? null,
    { source: "agent", userId: session.user.id },
    "related_sale",
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
