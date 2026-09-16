// File setup completeness — how much of a property file's INFORMATION has been
// filled in, so an agent can get a new file fully set up. This is deliberately
// distinct from sale progress (the milestone %); it never reflects how far the
// transaction has moved, only how complete the file's own details are.
//
// Every item maps to a real signal already on the file (no new fields). Items
// with `inline: true` are completed in place on the File setup tab; the rest
// carry a tab/anchor to jump the agent to where they set it up.
//
// Reachability bar for contacts matches the app's existing rule
// (lib/services/handover-readiness.ts): a name plus a phone OR email.

import { prisma } from "@/lib/prisma";
import { validateHandlerContact } from "@/lib/utils";
import type { PurchaseType, Tenure } from "@prisma/client";

const PEOPLE_ANCHOR = '[data-glass-id="overview-people"]';

export type FileSetupItem = {
  key: string;
  label: string;
  description: string;
  why: string; // one line on why it helps the sale — the motivational pull
  done: boolean;
  valueSummary: string | null; // shown on a done row (e.g. "Freehold · Mortgage")
  inline: boolean; // editable in place on the setup tab
  tab: string | null; // jump target for non-inline items
  anchor: string | null; // CSS selector to scroll to (non-inline)
};

// Raw values the inline editors need, resolved server-side (incl. signed photo).
export type FileSetupValues = {
  transactionId: string;
  purchasePrice: number | null;
  purchaseType: PurchaseType | null;
  tenure: Tenure | null;
  isShareOfFreehold: boolean;
  exchanged: boolean;
  predictedDate: Date | null;
  overrideDate: Date | null;
  photoUrl: string | null;
};

export type FileSetupSummary = {
  items: FileSetupItem[];
  values: FileSetupValues | null;
  doneCount: number;
  totalCount: number;
  remaining: number;
  pct: number;
};

const EMPTY: FileSetupSummary = {
  items: [], values: null, doneCount: 0, totalCount: 0, remaining: 0, pct: 0,
};

function tenureLabel(tenure: Tenure | null, isShareOfFreehold: boolean): string | null {
  if (!tenure) return null;
  if (tenure === "leasehold") return "Leasehold";
  return isShareOfFreehold ? "Share of freehold" : "Freehold";
}
function methodLabel(pt: PurchaseType | null): string | null {
  if (!pt) return null;
  return pt === "mortgage" ? "Mortgage" : "Cash";
}
function fmtDate(d: Date | null): string | null {
  return d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : null;
}

export async function getFileSetup(transactionId: string): Promise<FileSetupSummary> {
  const tx = await prisma.propertyTransaction.findUnique({
    where: { id: transactionId },
    select: {
      photoStoragePath: true,
      chainLinkId: true,
      noChainNeededAt: true,
      chainSetupPending: true,
      tenure: true,
      purchaseType: true,
      purchasePrice: true,
      isShareOfFreehold: true,
      exchangedAt: true,
      expectedExchangeDate: true,
      predictedExchangeDate: true,
      overridePredictedDate: true,
      completionDate: true,
      brokerFirmId: true,
      brokerFirm: { select: { name: true } },
      vendorSolicitorContact: { select: { phone: true, email: true } },
      purchaserSolicitorContact: { select: { phone: true, email: true } },
      contacts: {
        select: { roleType: true, name: true, phone: true, email: true, portalEligible: true, portalToken: true },
      },
    },
  });
  if (!tx) return EMPTY;

  const firstReachable = (role: string) =>
    tx.contacts.find(
      (c) =>
        c.roleType === role &&
        (c.name ?? "").trim().length > 0 &&
        (((c.phone ?? "").trim().length > 0) || ((c.email ?? "").trim().length > 0)),
    ) ?? null;
  const seller = firstReachable("vendor");
  const buyer = firstReachable("purchaser");

  // Chain is "set up" once it's linked OR the file's been marked as needing no
  // chain — and there's no outstanding setup prompt hanging over it.
  const chainDone = (tx.chainLinkId !== null || tx.noChainNeededAt !== null) && !tx.chainSetupPending;

  const handlerOk = (c: { phone: string | null; email: string | null } | null) =>
    !!c && validateHandlerContact(c.phone, c.email) === null;
  const solicitorsDone = handlerOk(tx.vendorSolicitorContact) && handlerOk(tx.purchaserSolicitorContact);

  const detailsDone = tx.tenure !== null && tx.purchaseType !== null;
  const dateDone =
    tx.expectedExchangeDate !== null || tx.overridePredictedDate !== null || tx.completionDate !== null;

  // Portal: every eligible principal (buyer/seller) has been issued access.
  const eligiblePrincipals = tx.contacts.filter(
    (c) => (c.roleType === "vendor" || c.roleType === "purchaser") && c.portalEligible,
  );
  const portalDone =
    eligiblePrincipals.length > 0 && eligiblePrincipals.every((c) => c.portalToken !== null);

  const isMortgage = tx.purchaseType === "mortgage";

  // Sign the photo URL so the inline camera card can show the current photo.
  let photoUrl: string | null = null;
  if (tx.photoStoragePath) {
    photoUrl = await import("@/lib/supabase-storage")
      .then(({ getSignedUrl }) => getSignedUrl(tx.photoStoragePath!, 3600))
      .catch(() => null);
  }

  const detailBits = [tenureLabel(tx.tenure, tx.isShareOfFreehold), methodLabel(tx.purchaseType)].filter(Boolean);

  const items: FileSetupItem[] = [
    {
      key: "details",
      label: "Confirm the sale details",
      description: "Tenure, purchase method and agreed price.",
      why: "Getting the basics right now keeps the rest of the file accurate.",
      done: detailsDone,
      valueSummary: detailBits.length ? detailBits.join(" · ") : null,
      inline: true,
      tab: null,
      anchor: null,
    },
    {
      key: "seller",
      label: "Add the seller's details",
      description: "Name and contact details for the seller.",
      why: "So the seller can be contacted quickly when something needs their attention.",
      done: !!seller,
      valueSummary: seller?.name ?? null,
      inline: false,
      tab: "overview",
      anchor: PEOPLE_ANCHOR,
    },
    {
      key: "buyer",
      label: "Add the buyer's details",
      description: "Name and contact details for the buyer.",
      why: "So the buyer can be contacted quickly when something needs their attention.",
      done: !!buyer,
      valueSummary: buyer?.name ?? null,
      inline: false,
      tab: "overview",
      anchor: PEOPLE_ANCHOR,
    },
    {
      key: "chain",
      label: "Set up the chain",
      description: "Link the related sales for tracking, or confirm there is no chain.",
      why: "Seeing the wider chain helps spot delays and problems before they reach this sale.",
      done: chainDone,
      valueSummary: tx.chainLinkId ? "Chain linked" : tx.noChainNeededAt ? "No chain" : null,
      inline: false,
      tab: "chain",
      anchor: null,
    },
    {
      key: "solicitors",
      label: "Add both solicitors",
      description: "Contact details for the buyer's and seller's solicitors.",
      why: "Having both sides on file means they can be chased as soon as something needs moving.",
      done: solicitorsDone,
      valueSummary: solicitorsDone ? "Both solicitors added" : null,
      inline: false,
      tab: "overview",
      anchor: PEOPLE_ANCHOR,
    },
    ...(isMortgage
      ? [
          {
            key: "broker",
            label: "Add the buyer's broker",
            description: "The mortgage broker acting for the buyer.",
            why: "Keep sight of the mortgage and know when the offer is issued.",
            done: tx.brokerFirmId !== null,
            valueSummary: tx.brokerFirm?.name ?? (tx.brokerFirmId ? "Broker added" : null),
            inline: false,
            tab: "overview",
            anchor: PEOPLE_ANCHOR,
          } as FileSetupItem,
        ]
      : []),
    {
      key: "date",
      label: "Set a target date",
      description: "An expected exchange or completion date.",
      why: "A target gives everyone something to work towards and helps flag when the sale is drifting.",
      done: dateDone,
      valueSummary: fmtDate(tx.overridePredictedDate ?? tx.expectedExchangeDate ?? tx.completionDate ?? null),
      inline: true,
      tab: null,
      anchor: null,
    },
    {
      key: "photo",
      label: "Add a property photo",
      description: "Add a photo to make this file easy to recognise.",
      why: "A familiar photo makes the right sale easier to spot at a glance.",
      done: !!tx.photoStoragePath,
      valueSummary: tx.photoStoragePath ? "Photo added" : null,
      inline: true,
      tab: null,
      anchor: null,
    },
    {
      key: "portal",
      label: "Invite the buyer and seller",
      description: "Give both sides access to their sale through the portal.",
      why: "Clients can follow progress themselves and see what's happening without having to ask.",
      done: portalDone,
      valueSummary: portalDone ? "Clients invited" : null,
      inline: false,
      tab: "overview",
      anchor: PEOPLE_ANCHOR,
    },
  ];

  const values: FileSetupValues = {
    transactionId,
    purchasePrice: tx.purchasePrice,
    purchaseType: tx.purchaseType,
    tenure: tx.tenure,
    isShareOfFreehold: tx.isShareOfFreehold,
    exchanged: tx.exchangedAt !== null,
    predictedDate: tx.predictedExchangeDate,
    overrideDate: tx.overridePredictedDate,
    photoUrl,
  };

  const totalCount = items.length;
  const doneCount = items.filter((i) => i.done).length;
  const remaining = totalCount - doneCount;
  const pct = totalCount === 0 ? 0 : Math.round((doneCount / totalCount) * 100);

  return { items, values, doneCount, totalCount, remaining, pct };
}
