import { prisma } from "@/lib/prisma";
import { isActiveRoundContact } from "@/lib/contacts/round-scope";
import { forRound, milestoneScopeWhere } from "@/lib/services/milestone-scope";
import { resolveDisplayStages } from "@/lib/milestones/display-stages";
import { extractFirstName } from "@/lib/contacts/displayName";
import { ADVISOR_CODES, advisorStepLabel } from "./codes";
import type { AdvisorSide } from "./token";

// Read-only data for the mortgage advisor portal overview (Phase 1).
//
// Scoped to the BUYER (purchaser) side only for now: it reads the sale's own
// mortgage milestones (PM5/PM6/PM11). The seller's onward-purchase advisor
// (side "vendor") reads a different source (OnwardTracker) and lands in its own
// phase — getAdvisorPortalView returns null for it so the page shows the
// invalid-link notice rather than a half-built view.

export type AdvisorStep = {
  code: string;
  label: string;
  status: "complete" | "current" | "upcoming";
  date: string | null; // ISO yyyy-mm-dd — completion or booked/expected date
};

export type AdvisorPortalView = {
  transactionId: string;
  side: AdvisorSide;
  addressLine1: string;
  addressLine2: string;
  fullAddress: string;
  price: string | null;
  tenure: string | null;
  purchaseType: string | null;
  advisingNames: string;
  firmName: string | null;
  advisorFirstName: string;
  agencyName: string;
  pointOfContact: { name: string; phone: string | null; email: string | null; image: string | null } | null;
  readinessPercent: number;
  currentStageName: string | null;
  steps: AdvisorStep[];
  offerExpiry: { date: string; approx: boolean } | null;
  keyDates: { expectedExchange: string | null; completion: string | null };
  lastUpdated: Date;
};

function formatPrice(pence: number | null): string | null {
  if (pence == null) return null;
  return `£${Math.round(pence / 100).toLocaleString("en-GB")}`;
}
function tenureLabel(tenure: string | null, isShareOfFreehold: boolean): string | null {
  if (isShareOfFreehold) return "Share of freehold";
  if (tenure === "freehold") return "Freehold";
  if (tenure === "leasehold") return "Leasehold";
  return null;
}
function purchaseTypeLabel(t: string | null): string | null {
  if (t === "mortgage") return "Mortgage";
  if (t === "cash_buyer") return "Cash buyer";
  if (t === "cash_from_proceeds") return "Cash (from sale)";
  return null;
}
function joinNames(names: string[]): string {
  if (names.length === 0) return "";
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(", ")} & ${names[names.length - 1]}`;
}
function isoDay(d: Date | null): string | null {
  return d ? d.toISOString().slice(0, 10) : null;
}

export async function getAdvisorPortalView(
  transactionId: string,
  side: AdvisorSide,
): Promise<AdvisorPortalView | null> {
  // Phase 1: buyer side only. The onward (vendor) advisor view lands later.
  if (side !== "purchaser") return null;

  const tx = await prisma.propertyTransaction.findUnique({
    where: { id: transactionId },
    select: {
      id: true,
      propertyAddress: true,
      purchasePrice: true,
      tenure: true,
      isShareOfFreehold: true,
      purchaseType: true,
      activeBuyerRoundId: true,
      expectedExchangeDate: true,
      overridePredictedDate: true,
      completionDate: true,
      updatedAt: true,
      agency: { select: { name: true } },
      assignedUser: { select: { name: true, phone: true, email: true, image: true } },
      agentUser: { select: { name: true, phone: true, email: true, image: true } },
      brokerFirm: { select: { name: true } },
      brokerContact: { select: { name: true } },
      contacts: { select: { name: true, roleType: true, buyerRoundId: true } },
    },
  });
  if (!tx) return null;

  const scope = forRound(tx.activeBuyerRoundId, tx.id);

  // The mortgage steps (PM5/PM6/PM11), round-scoped to the active buyer.
  const stepRows = await prisma.milestoneCompletion.findMany({
    where: {
      transactionId: tx.id,
      milestoneDefinition: { code: { in: [...ADVISOR_CODES] } },
      ...milestoneScopeWhere(scope),
    },
    select: {
      state: true,
      completedAt: true,
      eventDate: true,
      expectedDate: true,
      milestoneDefinition: { select: { code: true, name: true, orderIndex: true } },
    },
    orderBy: { milestoneDefinition: { orderIndex: "asc" } },
  });
  const steps: AdvisorStep[] = stepRows.map((r) => {
    const status: AdvisorStep["status"] =
      r.state === "complete" ? "complete" : r.state === "available" ? "current" : "upcoming";
    const date = r.state === "complete" ? isoDay(r.completedAt) : isoDay(r.eventDate ?? r.expectedDate);
    return { code: r.milestoneDefinition.code, label: advisorStepLabel(r.milestoneDefinition.code, r.milestoneDefinition.name), status, date };
  });

  // Whole-sale progress — same display stages the solicitor/client portals use.
  const allRows = await prisma.milestoneCompletion.findMany({
    where: { transactionId: tx.id, ...milestoneScopeWhere(scope) },
    select: { state: true, completedAt: true, milestoneDefinition: { select: { code: true } } },
  });
  const displayStages = resolveDisplayStages(
    allRows.map((r) => ({
      code: r.milestoneDefinition.code,
      isComplete: r.state === "complete",
      isNotRequired: r.state === "not_required",
      completion: { completedAt: r.completedAt },
    })),
    {
      expectedExchangeDate: tx.expectedExchangeDate ?? null,
      overridePredictedDate: tx.overridePredictedDate ?? null,
      targetCompletionDate: tx.completionDate ?? null,
    },
  );
  const completedCount = displayStages.filter((s) => s.status === "complete" || s.status === "skipped").length;
  const inProgCount = displayStages.filter((s) => s.status === "in_progress").length;
  const readinessPercent = displayStages.length
    ? Math.round(((completedCount + inProgCount * 0.5) / displayStages.length) * 100)
    : 0;
  const firstActiveIdx = displayStages.findIndex((s) => s.status === "in_progress" || s.status === "up_next");
  const currentStageName =
    (firstActiveIdx >= 0 ? displayStages[firstActiveIdx] : displayStages[displayStages.length - 1])?.name ?? null;

  // Mortgage offer expiry (auto-set on PM11; a real date entered later clears approx).
  const moveInfo = await prisma.clientMoveInfo
    .findUnique({
      where: { transactionId_side: { transactionId: tx.id, side: "purchaser" } },
      select: { mortgageOfferExpiry: true, mortgageOfferExpiryApprox: true },
    })
    .catch(() => null);
  const offerExpiry = moveInfo?.mortgageOfferExpiry
    ? { date: moveInfo.mortgageOfferExpiry.toISOString().slice(0, 10), approx: !!moveInfo.mortgageOfferExpiryApprox }
    : null;

  const buyerNames = joinNames(
    tx.contacts.filter((c) => c.roleType === "purchaser" && isActiveRoundContact(c, tx.activeBuyerRoundId)).map((c) => c.name),
  );
  const person = tx.assignedUser ?? tx.agentUser;
  const [line1, ...rest] = tx.propertyAddress.split(",");

  return {
    transactionId: tx.id,
    side,
    addressLine1: line1.trim(),
    addressLine2: rest.join(",").trim(),
    fullAddress: tx.propertyAddress,
    price: formatPrice(tx.purchasePrice),
    tenure: tenureLabel(tx.tenure, tx.isShareOfFreehold),
    purchaseType: purchaseTypeLabel(tx.purchaseType),
    advisingNames: buyerNames,
    firmName: tx.brokerFirm?.name ?? null,
    advisorFirstName: tx.brokerContact?.name ? extractFirstName(tx.brokerContact.name) : "",
    agencyName: tx.agency?.name ?? "Sales Progression",
    pointOfContact: person?.name
      ? { name: person.name, phone: person.phone ?? null, email: person.email ?? null, image: person.image ?? null }
      : null,
    readinessPercent,
    currentStageName,
    steps,
    offerExpiry,
    keyDates: {
      expectedExchange: isoDay(tx.overridePredictedDate ?? tx.expectedExchangeDate ?? null),
      completion: isoDay(tx.completionDate ?? null),
    },
    lastUpdated: tx.updatedAt,
  };
}
