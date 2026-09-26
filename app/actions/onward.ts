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
import { sendEmail } from "@/lib/email";
import { resolveAgencySenderForTransaction } from "@/lib/email/agency-sender";
import { resolveEmailTheme } from "@/lib/email/brand-theme";
import { buildGreeting } from "@/lib/portal-copy";
import { buildOnwardNudgeEmail, type OnwardNudgeDirection, type OnwardNudgeMode } from "@/lib/emails/onward-nudge";
import { resolveOnwardNudgeContent } from "@/lib/agency-email/templates";

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

// Nudge a client to set up, or update, the tracking of their OTHER move in their
// portal (critique h3xwf6). Agent-initiated (manual-only for now) — the agent
// picks the client, we render the branded email and deep-link them to the onward
// panel they already have. "onward" = the SELLER's onward purchase (contact is a
// vendor); "related" = the BUYER's own sale (contact is a purchaser). The send is
// logged to the file activity like every other client email.
export async function sendOnwardNudgeAction(input: {
  transactionId: string;
  contactId: string;
  direction: OnwardNudgeDirection;
  mode: OnwardNudgeMode;
}): Promise<{ ok: boolean; error?: string }> {
  const session = await requireSession();
  const scope = getAccessScope(session);
  const tx = await prisma.propertyTransaction.findFirst({
    where: scopeOwnershipWhere(scope, input.transactionId),
    select: { id: true, agencyId: true, agency: { select: { name: true } } },
  });
  if (!tx) return { ok: false, error: "File not found." };

  // The client must be on the correct side for the direction: an onward-purchase
  // nudge goes to the seller; a related-sale nudge goes to the buyer.
  const expectedRole = input.direction === "onward" ? "vendor" : "purchaser";
  const contact = await prisma.contact.findFirst({
    where: { id: input.contactId, propertyTransactionId: input.transactionId, roleType: expectedRole },
    select: { id: true, name: true, email: true, portalToken: true, unsubscribedAt: true },
  });
  if (!contact) return { ok: false, error: "We couldn't find that client on this file." };
  if (!contact.email) return { ok: false, error: "This client has no email on file." };
  if (contact.unsubscribedAt) return { ok: false, error: "This client has opted out of emails." };
  if (!contact.portalToken) return { ok: false, error: "This client has no portal access yet." };

  // The onward/related property's address, when the agent has recorded it.
  const kind: OnwardTrackerKind = input.direction === "onward" ? "onward_purchase" : "related_sale";
  const tracker = await prisma.onwardTracker.findUnique({
    where: { transactionId_kind: { transactionId: tx.id, kind } },
    select: { relatedPropertyAddress: true },
  });

  const base = process.env.NEXTAUTH_URL ?? "";
  const portalUrl = `${base}/portal/${contact.portalToken}`;
  const { from, replyTo, theme } = await resolveAgencySenderForTransaction(tx.id);
  const emailTheme = theme ?? resolveEmailTheme(null);
  // Agency-editable copy (onward_nudge family) → built-in default per field.
  const copy = await resolveOnwardNudgeContent(tx.agencyId, input.direction, input.mode);

  const { subject, text, html } = buildOnwardNudgeEmail({
    agencyName: tx.agency?.name ?? "your agent",
    greeting: buildGreeting(contact.name),
    direction: input.direction,
    mode: input.mode,
    propertyAddress: tracker?.relatedPropertyAddress ?? null,
    portalUrl,
    theme: { buttonBg: emailTheme.buttonBg, buttonText: emailTheme.buttonText },
    copy,
  });

  try {
    await sendEmail({ to: contact.email, subject, text, html, from, replyTo });
  } catch {
    return { ok: false, error: "We couldn't send that email just now. Please try again." };
  }

  // Log the send so it appears on the file's activity feed and in Outbound — a
  // client is never emailed without a record. Manual send, so it's attributed to
  // the agent (isAutomated: false) rather than a scheduled job.
  await prisma.outboundMessage.create({
    data: {
      transactionId: tx.id,
      agencyId: tx.agencyId,
      type: "outbound",
      method: "email",
      channel: "email",
      purpose: "notification",
      status: "sent",
      subject,
      content: text,
      contactIds: [contact.id],
      recipientEmail: contact.email,
      isAutomated: false,
      visibleToClient: true,
      sentAt: new Date(),
    },
  }).catch(() => {});

  revalidateTx(input.transactionId);
  return { ok: true };
}
