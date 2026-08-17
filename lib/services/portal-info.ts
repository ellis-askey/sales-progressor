// Client "Information" tab data (portal Information tab, Batch 3, 2026-08-17).
// Reads the client's own-side ClientMoveInfo plus the transaction context that
// decides which questions are relevant (role, cash/mortgage, tenure, exchange
// and completion state). For the progressor only — never the other side.

import { prisma } from "@/lib/prisma";

export type MoveInfoContext = {
  role: "buyer" | "seller";
  purchaseType: string | null;
  tenure: string | null;
  isMortgaged: boolean;
  isCash: boolean;
  hasExchanged: boolean;
  hasCompleted: boolean;
  completionDate: string | null;       // ISO date, once known
  expectedExchangeDate: string | null; // ISO date, pre-exchange target
};

export type UnavailableRange = { start: string; end?: string | null };

export type MoveInfo = {
  preferredCompletionDate: string | null;
  noCompletionPreference: boolean;
  flexibility: string | null;
  mortgageOfferExpiry: string | null;
  fundsInPlace: string | null;
  fundsSource: string | null;
  needsNotice: boolean | null;
  noticePeriod: string | null;
  noticeGiven: boolean | null;
  noticeEndDate: string | null;
  buyingOnward: boolean | null;
  onwardReadyToExchange: string | null;
  onwardMortgageOfferExpiry: string | null;
  removalStatus: string | null;
  removalCompany: string | null;
  vacantBeforeCompletion: string | null;
  unavailableDates: UnavailableRange[];
  progressorNote: string | null;
};

const EMPTY: MoveInfo = {
  preferredCompletionDate: null, noCompletionPreference: false, flexibility: null,
  mortgageOfferExpiry: null, fundsInPlace: null, fundsSource: null,
  needsNotice: null, noticePeriod: null, noticeGiven: null, noticeEndDate: null,
  buyingOnward: null, onwardReadyToExchange: null, onwardMortgageOfferExpiry: null,
  removalStatus: null, removalCompany: null, vacantBeforeCompletion: null,
  unavailableDates: [], progressorNote: null,
};

function isoDate(d: Date | null | undefined): string | null {
  return d ? d.toISOString().slice(0, 10) : null;
}

export async function getClientMoveInfo(
  token: string,
): Promise<{ context: MoveInfoContext; info: MoveInfo } | null> {
  const contact = await prisma.contact.findUnique({
    where: { portalToken: token },
    select: { roleType: true, propertyTransactionId: true },
  });
  if (!contact) return null;
  const side = contact.roleType === "vendor" ? "vendor" : "purchaser";
  const role: "buyer" | "seller" = side === "vendor" ? "seller" : "buyer";

  const tx = await prisma.propertyTransaction.findUnique({
    where: { id: contact.propertyTransactionId },
    select: { purchaseType: true, tenure: true, completionDate: true, expectedExchangeDate: true },
  });

  const completions = await prisma.milestoneCompletion.findMany({
    where: {
      transactionId: contact.propertyTransactionId,
      state: "complete",
      milestoneDefinition: { code: { in: ["VM19", "PM26", "VM20", "PM27"] } },
    },
    select: { milestoneDefinition: { select: { code: true } } },
  });
  const codes = new Set(completions.map((c) => c.milestoneDefinition.code));
  const hasExchanged = codes.has("VM19") || codes.has("PM26");
  const hasCompleted = codes.has("VM20") || codes.has("PM27");

  const purchaseType = tx?.purchaseType ?? null;
  const context: MoveInfoContext = {
    role,
    purchaseType,
    tenure: tx?.tenure ?? null,
    isMortgaged: purchaseType === "mortgage",
    isCash: purchaseType === "cash_buyer" || purchaseType === "cash_from_proceeds",
    hasExchanged,
    hasCompleted,
    completionDate: isoDate(tx?.completionDate ?? null),
    expectedExchangeDate: isoDate(tx?.expectedExchangeDate ?? null),
  };

  const row = await prisma.clientMoveInfo.findUnique({
    where: { transactionId_side: { transactionId: contact.propertyTransactionId, side } },
  });

  const info: MoveInfo = row
    ? {
        preferredCompletionDate: isoDate(row.preferredCompletionDate),
        noCompletionPreference: row.noCompletionPreference,
        flexibility: row.flexibility,
        mortgageOfferExpiry: isoDate(row.mortgageOfferExpiry),
        fundsInPlace: row.fundsInPlace,
        fundsSource: row.fundsSource,
        needsNotice: row.needsNotice,
        noticePeriod: row.noticePeriod,
        noticeGiven: row.noticeGiven,
        noticeEndDate: isoDate(row.noticeEndDate),
        buyingOnward: row.buyingOnward,
        onwardReadyToExchange: row.onwardReadyToExchange,
        onwardMortgageOfferExpiry: isoDate(row.onwardMortgageOfferExpiry),
        removalStatus: row.removalStatus,
        removalCompany: row.removalCompany,
        vacantBeforeCompletion: row.vacantBeforeCompletion,
        unavailableDates: Array.isArray(row.unavailableDates) ? (row.unavailableDates as unknown as UnavailableRange[]) : [],
        progressorNote: row.progressorNote,
      }
    : EMPTY;

  return { context, info };
}
