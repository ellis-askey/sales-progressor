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
import { getPortalLinkSentByContact } from "@/lib/services/comms";
import type { PeopleOpenForm } from "@/lib/transaction/people-open-intent";
import type { PurchaseType, Tenure } from "@prisma/client";

const PEOPLE_ANCHOR = '[data-glass-id="overview-people"]';

// Tone + glyph for a status line (resolved UI-side to colour + icon). "primary"
// is the brand coral — the normal/positive statuses — while amber/red surface
// the two problem states (opted out / bounced).
export type PersonTone = "primary" | "muted" | "amber" | "green" | "red";
export type PersonStatusIcon =
  | "check" | "ready" | "invited" | "active" | "optedout" | "bounced" | "missing";

export type FileSetupCardStatus = {
  statusLabel: string;
  statusTone: PersonTone;
  statusIcon: PersonStatusIcon;
  lastSeen: string | null;
};

// One person shown inside a relational item's card — a client, a solicitor (one
// per side) or a broker. Carries everything the card needs to render the avatar
// (photo or side-tinted art) to the left of the name, with no lookups UI-side.
// The label/value cards (seller, buyer, solicitors, broker) use `label` + the
// item's `cardStatus`; the portal roster uses `label` as an eyebrow + each
// person's own status fields.
export type FileSetupPerson = {
  label: string; // left-column role label ("Seller", "Buyer's solicitor", "Vendor")
  name: string;
  image: string | null;
  roleType: string; // drives the avatar art kind + initials
  // Side to tint the avatar to (seller blue / buyer green). Null for a broker,
  // which keeps its own role colour.
  side: "vendor" | "purchaser" | null;
  missing: boolean; // a not-yet-added slot (a solicitor side with nothing on file)
  statusLabel: string;
  statusTone: PersonTone;
  statusIcon: PersonStatusIcon;
  lastSeen: string | null; // "Last seen 3 Nov 2026" for the active state
};

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
  // Which side of the People panel to open on jump. Professionals (not Clients)
  // for solicitors + broker, so the agent lands exactly where that record lives
  // (critique #300). Undefined = leave the panel on its default (Clients).
  peopleTab?: "clients" | "professionals";
  // When the CTA jumps to the People panel, the exact add-form to auto-open on
  // arrival (so the agent can type straight away). Undefined = just navigate
  // (e.g. a done item's "View on file", or chain/portal which land as-is).
  openForm?: PeopleOpenForm;
  // People shown in the expanded card (clients / solicitors / broker). Empty for
  // inline items and for the chain item (which shows a single status line).
  people: FileSetupPerson[];
  // The single "Status" row at the foot of a label/value card (seller, buyer,
  // solicitors, broker). Null for the chain (single line) and the portal (its
  // roster carries a status per person instead).
  cardStatus: FileSetupCardStatus | null;
  // Single status line for a relational item with no people (the chain).
  statusLabel: string | null;
  // Short hint shown on the collapsed row for a part-done item (solicitors:
  // "1 of 2 added"). Undefined falls back to the generic Set up / Open hint.
  hint?: string;
};

// Raw values the inline editors need, resolved server-side (incl. signed photo).
export type FileSetupValues = {
  transactionId: string;
  purchasePrice: number | null;
  purchaseType: PurchaseType | null;
  tenure: Tenure | null;
  isShareOfFreehold: boolean;
  hasManagementPack: boolean;
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
  // Share of freehold is stored as leasehold + the flag, so the flag must be
  // checked FIRST (matches the quote-flow / solicitor-portal helpers). Before
  // this, a share-of-freehold file showed as plain "Leasehold" here.
  if (isShareOfFreehold) return "Share of freehold";
  if (tenure === "freehold") return "Freehold";
  if (tenure === "leasehold") return "Leasehold";
  return null;
}
function methodLabel(pt: PurchaseType | null): string | null {
  if (!pt) return null;
  return pt === "mortgage" ? "Mortgage" : "Cash";
}
function fmtDate(d: Date | null): string | null {
  return d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : null;
}

// The furthest-along status we can read for a principal (seller / buyer / portal
// row). Problems (opted out, bounced) surface first — an agent setting up a file
// wants those visible — then progress (active, invited), then the base state.
// The base label differs by context: a contact-details card reads "Details
// added"; the portal card reads "Ready to invite" / "Link ready".
type PersonSignals = {
  unsubscribedAt: Date | null;
  emailBouncedAt: Date | null;
  lastVisitedPortalAt: Date | null;
  email: string | null;
};
function personStatus(
  s: PersonSignals,
  linkSent: boolean,
  ctx: "details" | "portal",
): FileSetupCardStatus {
  if (s.unsubscribedAt) return { statusLabel: "Opted out", statusTone: "amber", statusIcon: "optedout", lastSeen: null };
  if (s.emailBouncedAt) return { statusLabel: "Email bounced", statusTone: "red", statusIcon: "bounced", lastSeen: null };
  if (s.lastVisitedPortalAt) return { statusLabel: "Active", statusTone: "primary", statusIcon: "active", lastSeen: `Last seen ${fmtDate(s.lastVisitedPortalAt)}` };
  if (linkSent) return { statusLabel: "Invited", statusTone: "primary", statusIcon: "invited", lastSeen: null };
  if (ctx === "portal") {
    return s.email
      ? { statusLabel: "Ready to invite", statusTone: "primary", statusIcon: "ready", lastSeen: null }
      : { statusLabel: "Link ready", statusTone: "muted", statusIcon: "ready", lastSeen: null };
  }
  return { statusLabel: "Details added", statusTone: "primary", statusIcon: "check", lastSeen: null };
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
      hasManagementPack: true,
      exchangedAt: true,
      expectedExchangeDate: true,
      predictedExchangeDate: true,
      overridePredictedDate: true,
      completionDate: true,
      brokerFirmId: true,
      brokerFirm: { select: { name: true } },
      vendorSolicitorContact: { select: { name: true, image: true, phone: true, email: true } },
      purchaserSolicitorContact: { select: { name: true, image: true, phone: true, email: true } },
      vendorSolicitorFirm: { select: { name: true } },
      purchaserSolicitorFirm: { select: { name: true } },
      contacts: {
        select: {
          id: true,
          roleType: true,
          name: true,
          image: true,
          phone: true,
          email: true,
          portalEligible: true,
          portalToken: true,
          isPrincipal: true,
          lastVisitedPortalAt: true,
          unsubscribedAt: true,
          emailBouncedAt: true,
        },
      },
    },
  });
  if (!tx) return EMPTY;

  // Which contacts have genuinely been sent their portal link (an automated
  // client email or the manual invite) — powers the truthful "Invited" state.
  const linkSent = await getPortalLinkSentByContact(transactionId);

  const firstReachable = (role: string) =>
    tx.contacts.find(
      (c) =>
        c.roleType === role &&
        (c.name ?? "").trim().length > 0 &&
        (((c.phone ?? "").trim().length > 0) || ((c.email ?? "").trim().length > 0)),
    ) ?? null;
  const seller = firstReachable("vendor");
  const buyer = firstReachable("purchaser");

  const clientPerson = (
    c: NonNullable<ReturnType<typeof firstReachable>>,
    side: "vendor" | "purchaser",
    label: string,
    ctx: "details" | "portal",
  ): FileSetupPerson => ({
    label,
    name: c.name ?? "On file",
    image: c.image ?? null,
    roleType: side,
    side,
    missing: false,
    ...personStatus(c, !!linkSent[c.id], ctx),
  });

  const sellerStatus = seller ? personStatus(seller, !!linkSent[seller.id], "details") : null;
  const buyerStatus = buyer ? personStatus(buyer, !!linkSent[buyer.id], "details") : null;
  const sellerPeople = seller ? [clientPerson(seller, "vendor", "Seller", "details")] : [];
  const buyerPeople = buyer ? [clientPerson(buyer, "purchaser", "Buyer", "details")] : [];

  // Chain is "set up" once it's linked OR the file's been marked as needing no
  // chain — and there's no outstanding setup prompt hanging over it.
  const chainDone = (tx.chainLinkId !== null || tx.noChainNeededAt !== null) && !tx.chainSetupPending;

  // Solicitors are evaluated per side so one added side shows while the other is
  // flagged as still missing (previously the card went all-or-nothing).
  const handlerOk = (c: { phone: string | null; email: string | null } | null) =>
    !!c && validateHandlerContact(c.phone, c.email) === null;
  const vendorSolOk = handlerOk(tx.vendorSolicitorContact);
  const purchaserSolOk = handlerOk(tx.purchaserSolicitorContact);
  const solicitorsDone = vendorSolOk && purchaserSolOk;
  const anySolicitor = vendorSolOk || purchaserSolOk;
  const solPerson = (
    ok: boolean,
    contact: { name: string | null; image: string | null } | null,
    firm: { name: string } | null,
    side: "vendor" | "purchaser",
    label: string,
  ): FileSetupPerson =>
    ok
      ? {
          label,
          name: firm?.name ?? contact?.name ?? "On file",
          image: contact?.image ?? null,
          roleType: "solicitor",
          side,
          missing: false,
          statusLabel: "Added",
          statusTone: "primary",
          statusIcon: "check",
          lastSeen: null,
        }
      : {
          label,
          name: "Not added yet",
          image: null,
          roleType: "solicitor",
          side,
          missing: true,
          statusLabel: "Not added yet",
          statusTone: "muted",
          statusIcon: "missing",
          lastSeen: null,
        };
  const solicitorPeople: FileSetupPerson[] = anySolicitor
    ? [
        solPerson(purchaserSolOk, tx.purchaserSolicitorContact, tx.purchaserSolicitorFirm, "purchaser", "Buyer's solicitor"),
        solPerson(vendorSolOk, tx.vendorSolicitorContact, tx.vendorSolicitorFirm, "vendor", "Seller's solicitor"),
      ]
    : [];
  const solicitorCount = (vendorSolOk ? 1 : 0) + (purchaserSolOk ? 1 : 0);
  const solicitorStatus: FileSetupCardStatus | null = anySolicitor
    ? {
        statusLabel: solicitorsDone ? "Both added" : `${solicitorCount} of 2 added`,
        statusTone: solicitorsDone ? "primary" : "muted",
        statusIcon: "check",
        lastSeen: null,
      }
    : null;
  const solicitorHint = anySolicitor && !solicitorsDone ? `${solicitorCount} of 2 added` : undefined;
  // Auto-open the side that still needs adding (buyer's first) — nothing to open
  // once both are in.
  const solicitorOpenForm: PeopleOpenForm | undefined = !purchaserSolOk
    ? "solicitor:purchaser"
    : !vendorSolOk
    ? "solicitor:vendor"
    : undefined;

  const brokerPeople: FileSetupPerson[] = tx.brokerFirmId
    ? [
        {
          label: "Broker",
          name: tx.brokerFirm?.name ?? "On file",
          image: null,
          roleType: "broker",
          side: null,
          missing: false,
          statusLabel: "Added",
          statusTone: "primary",
          statusIcon: "check",
          lastSeen: null,
        },
      ]
    : [];
  const brokerStatus: FileSetupCardStatus | null = tx.brokerFirmId
    ? { statusLabel: "Added", statusTone: "primary", statusIcon: "check", lastSeen: null }
    : null;

  const detailsDone = tx.tenure !== null && tx.purchaseType !== null;
  const dateDone =
    tx.expectedExchangeDate !== null || tx.overridePredictedDate !== null || tx.completionDate !== null;

  // Portal: every eligible principal (buyer/seller) has been issued access.
  const eligiblePrincipals = tx.contacts.filter(
    (c) => (c.roleType === "vendor" || c.roleType === "purchaser") && c.portalEligible,
  );
  const portalDone =
    eligiblePrincipals.length > 0 && eligiblePrincipals.every((c) => c.portalToken !== null);
  const portalPeople: FileSetupPerson[] = eligiblePrincipals
    .slice()
    .sort((a, b) => (a.roleType === "vendor" ? 0 : 1) - (b.roleType === "vendor" ? 0 : 1))
    .map((c) =>
      c.roleType === "vendor"
        ? clientPerson(c, "vendor", "Vendor", "portal")
        : clientPerson(c, "purchaser", "Purchaser", "portal"),
    );

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
      people: [],
      cardStatus: null,
      statusLabel: null,
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
      openForm: seller ? undefined : "contact:vendor",
      people: sellerPeople,
      cardStatus: sellerStatus,
      statusLabel: null,
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
      openForm: buyer ? undefined : "contact:purchaser",
      people: buyerPeople,
      cardStatus: buyerStatus,
      statusLabel: null,
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
      people: [],
      cardStatus: null,
      statusLabel: tx.chainLinkId ? "Chain linked" : tx.noChainNeededAt ? "No chain needed" : null,
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
      peopleTab: "professionals",
      openForm: solicitorOpenForm,
      people: solicitorPeople,
      cardStatus: solicitorStatus,
      statusLabel: null,
      hint: solicitorHint,
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
            peopleTab: "professionals",
            openForm: tx.brokerFirmId ? undefined : "broker:purchaser",
            people: brokerPeople,
            cardStatus: brokerStatus,
            statusLabel: null,
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
      people: [],
      cardStatus: null,
      statusLabel: null,
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
      people: [],
      cardStatus: null,
      statusLabel: null,
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
      people: portalPeople,
      cardStatus: null,
      statusLabel: null,
    },
  ];

  const values: FileSetupValues = {
    transactionId,
    purchasePrice: tx.purchasePrice,
    purchaseType: tx.purchaseType,
    tenure: tx.tenure,
    isShareOfFreehold: tx.isShareOfFreehold,
    hasManagementPack: tx.hasManagementPack,
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
