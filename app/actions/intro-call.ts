"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/session";
import { getAccessScope, scopeOwnershipWhere } from "@/lib/security/access-scope";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/services/activity";
import { getOnwardTrackerView } from "@/lib/services/onward";
import type { MoveInfo } from "@/lib/services/portal-info";
import type { PurchaseType, Tenure } from "@prisma/client";

// The intro-call drawer is an internal-team onboarding tool. It writes into the
// SAME stores the client portal uses (ClientMoveInfo, the buyer cost fields, the
// onward tracker, the chain-node intel) — just through agent-authed actions
// instead of the token-authed portal ones. Everything stays own-side private.

type Side = "vendor" | "purchaser";

export type IntroCallContact = { id: string; name: string; phone: string | null; email: string | null };

// Matches the SolicitorInfo shape components/solicitors/SolicitorSection expects.
export type IntroCallSolicitor = {
  firm: { id: string; name: string } | null;
  contact: { id: string; name: string; phone: string | null; email: string | null; secondaryEmail: string | null } | null;
};

export type IntroCallData = {
  transactionId: string;
  introDone: boolean;
  hasVendor: boolean;
  hasPurchaser: boolean;
  vendor: IntroCallContact | null;
  purchaser: IntroCallContact | null;
  purchaseType: PurchaseType | null;
  tenure: Tenure | null;
  isShareOfFreehold: boolean;
  // Buyer cost figures in whole pounds (stored in pence).
  costs: {
    depositGBP: number | null;
    mortgageGBP: number | null;
    otherFundsGBP: number | null;
    firstTimeBuyer: boolean | null;
    additionalProperty: boolean | null;
  };
  moveVendor: MoveInfo;
  movePurchaser: MoveInfo;
  chainLinkId: string | null;
  chainId: string | null;
  chainIntel: {
    breakChainStance: string | null;
    breakChainConditions: string | null;
    expectedTimescale: string | null;
    chainNotes: string | null;
    lastChainCheckAt: string | null;
  } | null;
  onward: { trackerExists: boolean; typeFactsSet: boolean };
  // Solicitor management (embedded SolicitorSection at the foot of the drawer).
  address: string;
  solVendor: IntroCallSolicitor;
  solPurchaser: IntroCallSolicitor;
  referredFirmId: string | null;
  referralFee: number | null;
  contactRoles: { name: string; roleType: string }[];
};

const isoDate = (d: Date | null): string | null => (d ? d.toISOString().slice(0, 10) : null);

function rowToMoveInfo(row: {
  preferredCompletionDate: Date | null; noCompletionPreference: boolean; flexibility: string | null;
  mortgageOfferExpiry: Date | null; fundsInPlace: string | null; fundsSource: string | null;
  needsNotice: boolean | null; noticePeriod: string | null; noticeGiven: boolean | null; noticeEndDate: Date | null;
  buyingOnward: boolean | null; onwardReadyToExchange: string | null; onwardMortgageOfferExpiry: Date | null;
  removalStatus: string | null; removalCompany: string | null; vacantBeforeCompletion: string | null;
  unavailableDates: unknown; progressorNote: string | null;
} | null | undefined): MoveInfo {
  return {
    preferredCompletionDate: isoDate(row?.preferredCompletionDate ?? null),
    noCompletionPreference: row?.noCompletionPreference ?? false,
    flexibility: row?.flexibility ?? null,
    mortgageOfferExpiry: isoDate(row?.mortgageOfferExpiry ?? null),
    fundsInPlace: row?.fundsInPlace ?? null,
    fundsSource: row?.fundsSource ?? null,
    needsNotice: row?.needsNotice ?? null,
    noticePeriod: row?.noticePeriod ?? null,
    noticeGiven: row?.noticeGiven ?? null,
    noticeEndDate: isoDate(row?.noticeEndDate ?? null),
    buyingOnward: row?.buyingOnward ?? null,
    onwardReadyToExchange: row?.onwardReadyToExchange ?? null,
    onwardMortgageOfferExpiry: isoDate(row?.onwardMortgageOfferExpiry ?? null),
    removalStatus: row?.removalStatus ?? null,
    removalCompany: row?.removalCompany ?? null,
    vacantBeforeCompletion: row?.vacantBeforeCompletion ?? null,
    unavailableDates: Array.isArray(row?.unavailableDates) ? (row?.unavailableDates as MoveInfo["unavailableDates"]) : [],
    progressorNote: row?.progressorNote ?? null,
  };
}

// Load everything the drawer prefills from + decides its adaptive question set on.
export async function getIntroCallDataAction(transactionId: string): Promise<IntroCallData> {
  const session = await requireSession();
  const scope = getAccessScope(session);
  const solFirmSelect = { select: { id: true, name: true } };
  const solContactSelect = { select: { id: true, name: true, phone: true, email: true, secondaryEmail: true } };
  const tx = await prisma.propertyTransaction.findFirst({
    where: scopeOwnershipWhere(scope, transactionId),
    select: {
      id: true,
      propertyAddress: true,
      purchaseType: true,
      tenure: true,
      isShareOfFreehold: true,
      introCallCompletedAt: true,
      clientDepositGBP: true,
      clientMortgageGBP: true,
      clientOtherFundsSentGBP: true,
      clientFirstTimeBuyer: true,
      clientAdditionalProperty: true,
      chainLinkId: true,
      chainLink: { select: { chainId: true } },
      referredFirmId: true,
      referralFee: true,
      vendorSolicitorFirm: solFirmSelect,
      vendorSolicitorContact: solContactSelect,
      purchaserSolicitorFirm: solFirmSelect,
      purchaserSolicitorContact: solContactSelect,
      contacts: { select: { id: true, name: true, phone: true, email: true, roleType: true, isPrincipal: true } },
    },
  });
  if (!tx) throw new Error("Transaction not found");

  const moveRows = await prisma.clientMoveInfo.findMany({ where: { transactionId } });
  const toPounds = (p: number | null) => (p != null ? Math.round(p / 100) : null);

  const vendor = tx.contacts.find((c) => c.roleType === "vendor" && c.isPrincipal)
    ?? tx.contacts.find((c) => c.roleType === "vendor") ?? null;
  const purchaser = tx.contacts.find((c) => c.roleType === "purchaser" && c.isPrincipal)
    ?? tx.contacts.find((c) => c.roleType === "purchaser") ?? null;

  let chainIntel: IntroCallData["chainIntel"] = null;
  if (tx.chainLinkId) {
    const link = await prisma.chainLink.findUnique({
      where: { id: tx.chainLinkId },
      select: { breakChainStance: true, breakChainConditions: true, expectedTimescale: true, chainNotes: true, lastChainCheckAt: true },
    });
    if (link) {
      chainIntel = {
        breakChainStance: link.breakChainStance ?? null,
        breakChainConditions: link.breakChainConditions ?? null,
        expectedTimescale: link.expectedTimescale ?? null,
        chainNotes: link.chainNotes ?? null,
        lastChainCheckAt: isoDate(link.lastChainCheckAt ?? null),
      };
    }
  }

  const tracker = await getOnwardTrackerView(transactionId).catch(() => null);

  return {
    transactionId: tx.id,
    introDone: tx.introCallCompletedAt != null,
    hasVendor: !!vendor,
    hasPurchaser: !!purchaser,
    vendor: vendor ? { id: vendor.id, name: vendor.name, phone: vendor.phone, email: vendor.email } : null,
    purchaser: purchaser ? { id: purchaser.id, name: purchaser.name, phone: purchaser.phone, email: purchaser.email } : null,
    purchaseType: tx.purchaseType,
    tenure: tx.tenure,
    isShareOfFreehold: tx.isShareOfFreehold,
    costs: {
      depositGBP: toPounds(tx.clientDepositGBP),
      mortgageGBP: toPounds(tx.clientMortgageGBP),
      otherFundsGBP: toPounds(tx.clientOtherFundsSentGBP),
      firstTimeBuyer: tx.clientFirstTimeBuyer,
      additionalProperty: tx.clientAdditionalProperty,
    },
    moveVendor: rowToMoveInfo(moveRows.find((r) => r.side === "vendor")),
    movePurchaser: rowToMoveInfo(moveRows.find((r) => r.side === "purchaser")),
    chainLinkId: tx.chainLinkId,
    chainId: tx.chainLink?.chainId ?? null,
    chainIntel,
    onward: { trackerExists: tracker?.exists ?? false, typeFactsSet: tracker?.typeFactsSet ?? false },
    address: tx.propertyAddress,
    solVendor: { firm: tx.vendorSolicitorFirm ?? null, contact: tx.vendorSolicitorContact ?? null },
    solPurchaser: { firm: tx.purchaserSolicitorFirm ?? null, contact: tx.purchaserSolicitorContact ?? null },
    referredFirmId: tx.referredFirmId,
    referralFee: tx.referralFee,
    contactRoles: tx.contacts.map((c) => ({ name: c.name, roleType: c.roleType })),
  };
}

// Agent-side buyer costs save (mirrors portalSaveCostsAction, agent auth). Pounds in.
export async function saveClientCostsAgentAction(
  transactionId: string,
  input: {
    depositGBP?: number | null;
    mortgageGBP?: number | null;
    otherFundsGBP?: number | null;
    firstTimeBuyer?: boolean | null;
    additionalProperty?: boolean | null;
  },
): Promise<void> {
  const session = await requireSession();
  const scope = getAccessScope(session);
  const tx = await prisma.propertyTransaction.findFirst({
    where: scopeOwnershipWhere(scope, transactionId),
    select: { id: true },
  });
  if (!tx) throw new Error("Transaction not found");

  const toPence = (v: number | null | undefined) =>
    v != null && Number.isFinite(v) && v >= 0 ? Math.round(v * 100) : null;

  const data: Record<string, unknown> = {};
  if (input.depositGBP !== undefined) data.clientDepositGBP = toPence(input.depositGBP);
  if (input.mortgageGBP !== undefined) data.clientMortgageGBP = toPence(input.mortgageGBP);
  if (input.otherFundsGBP !== undefined) data.clientOtherFundsSentGBP = toPence(input.otherFundsGBP);
  if (input.firstTimeBuyer !== undefined) data.clientFirstTimeBuyer = input.firstTimeBuyer;
  if (input.additionalProperty !== undefined) data.clientAdditionalProperty = input.additionalProperty;

  await prisma.propertyTransaction.update({ where: { id: transactionId }, data });
  revalidatePath(`/agent/transactions/${transactionId}`);
}

// Agent-side move-info save (mirrors portalSaveMoveInfoAction, agent auth, explicit side).
export async function saveMoveInfoAgentAction(
  transactionId: string,
  side: Side,
  patch: Partial<MoveInfo>,
): Promise<void> {
  const session = await requireSession();
  const scope = getAccessScope(session);
  const tx = await prisma.propertyTransaction.findFirst({
    where: scopeOwnershipWhere(scope, transactionId),
    select: { id: true },
  });
  if (!tx) throw new Error("Transaction not found");

  const d = (v: string | null | undefined) => (v === undefined ? undefined : v ? new Date(v) : null);
  const p = patch;
  const data: Record<string, unknown> = {};
  if (p.preferredCompletionDate !== undefined) data.preferredCompletionDate = d(p.preferredCompletionDate);
  if (p.noCompletionPreference !== undefined) data.noCompletionPreference = p.noCompletionPreference;
  if (p.flexibility !== undefined) data.flexibility = p.flexibility;
  if (p.mortgageOfferExpiry !== undefined) data.mortgageOfferExpiry = d(p.mortgageOfferExpiry);
  if (p.fundsInPlace !== undefined) data.fundsInPlace = p.fundsInPlace;
  if (p.fundsSource !== undefined) data.fundsSource = p.fundsSource;
  if (p.needsNotice !== undefined) data.needsNotice = p.needsNotice;
  if (p.noticePeriod !== undefined) data.noticePeriod = p.noticePeriod;
  if (p.noticeGiven !== undefined) data.noticeGiven = p.noticeGiven;
  if (p.noticeEndDate !== undefined) data.noticeEndDate = d(p.noticeEndDate);
  if (p.buyingOnward !== undefined) data.buyingOnward = p.buyingOnward;
  if (p.removalStatus !== undefined) data.removalStatus = p.removalStatus;
  if (p.removalCompany !== undefined) data.removalCompany = p.removalCompany;
  if (p.vacantBeforeCompletion !== undefined) data.vacantBeforeCompletion = p.vacantBeforeCompletion;
  if (p.progressorNote !== undefined) data.progressorNote = p.progressorNote;

  await prisma.clientMoveInfo.upsert({
    where: { transactionId_side: { transactionId, side } },
    create: { transactionId, side, ...data } as never,
    update: data as never,
  });
  revalidatePath(`/agent/transactions/${transactionId}`);
}

// Stamp the file's introduction as complete (once, either side) + timeline note.
export async function completeIntroCallAction(transactionId: string): Promise<void> {
  const session = await requireSession();
  const scope = getAccessScope(session);
  const tx = await prisma.propertyTransaction.findFirst({
    where: scopeOwnershipWhere(scope, transactionId),
    select: { id: true, introCallCompletedAt: true },
  });
  if (!tx) throw new Error("Transaction not found");
  if (tx.introCallCompletedAt) return; // already done — one-time

  await prisma.propertyTransaction.update({
    where: { id: transactionId },
    data: { introCallCompletedAt: new Date(), introCallCompletedById: session.user.id },
  });
  await logActivity(transactionId, `${session.user.name} completed the intro call.`, session.user.id);
  revalidatePath(`/agent/transactions/${transactionId}`);
}
