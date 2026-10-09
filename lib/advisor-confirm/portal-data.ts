import { prisma } from "@/lib/prisma";
import { isActiveRoundContact } from "@/lib/contacts/round-scope";
import { forRound, milestoneScopeWhere } from "@/lib/services/milestone-scope";
import { resolveDisplayStages, type ResolvedStage } from "@/lib/milestones/display-stages";
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
  // Raw enum values for the shared client hero (which formats its own chips).
  status: "draft" | "active" | "on_hold" | "completed" | "withdrawn";
  tenureRaw: "freehold" | "leasehold" | null;
  purchaseTypeRaw: "mortgage" | "cash_buyer" | "cash_from_proceeds" | null;
  advisingNames: string;
  firmName: string | null;
  advisorFirstName: string;
  agencyName: string;
  pointOfContact: { name: string; phone: string | null; email: string | null; image: string | null } | null;
  readinessPercent: number;
  currentStageName: string | null;
  // The whole-sale 6-stage journey (same data the client/solicitor hero uses).
  displayStages: ResolvedStage[];
  steps: AdvisorStep[];
  offerExpiry: { date: string; approx: boolean } | null;
  // Raw dates for the hero's "expected exchange" card.
  targetDate: Date | null;
  plannedDate: Date | null;
  estimateDate: Date | null;
  completionDate: Date | null;
  lastUpdated: Date;
};

function formatPrice(pence: number | null): string | null {
  if (pence == null) return null;
  return `£${Math.round(pence / 100).toLocaleString("en-GB")}`;
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
      status: true,
      tenure: true,
      isShareOfFreehold: true,
      purchaseType: true,
      activeBuyerRoundId: true,
      expectedExchangeDate: true,
      overridePredictedDate: true,
      completionDate: true,
      twelveWeekTarget: true,
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
    status: tx.status as AdvisorPortalView["status"],
    tenureRaw: (tx.tenure as AdvisorPortalView["tenureRaw"]) ?? null,
    purchaseTypeRaw: (tx.purchaseType as AdvisorPortalView["purchaseTypeRaw"]) ?? null,
    advisingNames: buyerNames,
    firmName: tx.brokerFirm?.name ?? null,
    advisorFirstName: tx.brokerContact?.name ? extractFirstName(tx.brokerContact.name) : "",
    agencyName: tx.agency?.name ?? "Sales Progression",
    pointOfContact: person?.name
      ? { name: person.name, phone: person.phone ?? null, email: person.email ?? null, image: person.image ?? null }
      : null,
    readinessPercent,
    currentStageName,
    displayStages,
    steps,
    offerExpiry,
    targetDate: tx.twelveWeekTarget ?? null,
    plannedDate: tx.overridePredictedDate ?? null,
    estimateDate: tx.expectedExchangeDate ?? null,
    completionDate: tx.completionDate ?? null,
    lastUpdated: tx.updatedAt,
  };
}
