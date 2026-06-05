// scripts/seed-demo.ts
//
// Idempotent demo agency seed for client demos. Tears down the existing
// "Fairview Estates" agency tree (if any), then rebuilds the full fixture.
//
// Safety rails (see DEMO_FEATURE_INVENTORY.md §E):
//   - DATABASE_URL must NOT contain the production Supabase project id
//   - DATABASE_URL MUST contain the staging Supabase project id
//   - DEMO_SEED_ALLOWED=true must be set (acknowledges destructiveness)
//
// All seeded email addresses use the `.test` TLD (RFC 6761 reserved —
// never deliverable) so no SendGrid call can reach a real inbox even if
// the asymmetric `sendEmail()` / `sendChainEmail()` sandbox-mode gap fires.
//
// Run via the `demo:seed` npm script. The same `runSeedDemo()` export
// powers the Reset Demo button in /command/admin/demo.

// ─── React.cache shim ────────────────────────────────────────────────────────
// completeMilestone() pulls in lib/services/reminders → lib/security/access-scope
// → lib/agent-session, which calls `cache(...)` from "react" at module load
// time. In a Next request context that's fine; in a Node CLI context it
// throws because the React build resolved here doesn't export `cache`. The
// seed never CALLS the cached function — it goes straight to completeMilestone —
// so a passthrough is safe. Done as a require() (not import) so ts-node
// doesn't hoist later imports above it.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const __react = require("react") as { cache?: <T>(fn: T) => T };
if (typeof __react.cache !== "function") {
  __react.cache = ((fn: unknown) => fn) as <T>(fn: T) => T;
}

import { PrismaClient } from "@prisma/client";
import { hashSync } from "bcryptjs";
import { randomUUID } from "node:crypto";
import { completeMilestone } from "../lib/services/milestones";

// ─── Constants ───────────────────────────────────────────────────────────────

const PROD_PROJECT_ID    = "gmkfustgwipgihpmpjpr";
const STAGING_PROJECT_ID = "etidawkbqctarmsdjoxp";

export const DEMO_AGENCY_NAME = "Fairview Estates";
export const DEMO_DIRECTOR_EMAIL   = "demo-director@fairview.test";
export const DEMO_NEGOTIATOR_EMAIL = "demo-negotiator@fairview.test";
export const DEMO_DIRECTOR_PASSWORD   = "FairviewDemo1!";
export const DEMO_NEGOTIATOR_PASSWORD = "FairviewDemo2!";

// ─── Safety rails ────────────────────────────────────────────────────────────

export function assertDemoSafe(): void {
  const url = process.env.DATABASE_URL ?? "";
  if (!url) {
    throw new Error("ABORT: DATABASE_URL is not set.");
  }
  if (url.includes(PROD_PROJECT_ID)) {
    throw new Error(
      "ABORT: DATABASE_URL points to PRODUCTION. Demo seed is staging-only.",
    );
  }
  if (!url.includes(STAGING_PROJECT_ID)) {
    throw new Error(
      `ABORT: DATABASE_URL must contain the staging Supabase project id (${STAGING_PROJECT_ID}). ` +
      "Point DATABASE_URL at your staging connection string before running the demo seed.",
    );
  }
  if (process.env.DEMO_SEED_ALLOWED !== "true") {
    throw new Error(
      "ABORT: set DEMO_SEED_ALLOWED=true to acknowledge this is a destructive operation.\n" +
      "  bash : DEMO_SEED_ALLOWED=true npm run demo:seed\n" +
      "  pwsh : $env:DEMO_SEED_ALLOWED='true'; npm run demo:seed",
    );
  }
}

// ─── Teardown (used by both seed and the Reset Demo command surface) ─────────

export async function tearDownDemoAgency(prisma: PrismaClient): Promise<void> {
  const agency = await prisma.agency.findFirst({
    where: { name: DEMO_AGENCY_NAME },
    select: { id: true },
  });
  if (!agency) return;
  const agencyId = agency.id;

  // Reverse-dependency sequence — see DEMO_FEATURE_INVENTORY.md §F. Wrapped
  // in $transaction so a partial teardown can never leave the agency tree
  // in a half-deleted state.
  await prisma.$transaction([
    // 1. Leaf / nullable-FK rows that don't cascade from agency or transaction
    prisma.clientChaseState.deleteMany({ where: { transaction: { agencyId } } }),
    prisma.priceHistory.deleteMany({ where: { transaction: { agencyId } } }),
    prisma.outboundEmailQueue.deleteMany({
      where: {
        OR: [
          { recipientUser: { agencyId } },
          { recipientContact: { transaction: { agencyId } } },
        ],
      },
    }),
    prisma.notification.deleteMany({ where: { user: { agencyId } } }),
    prisma.fileTimeSession.deleteMany({ where: { agencyId } }),
    prisma.manualTask.deleteMany({ where: { agencyId } }),

    // 2. Chain plumbing (PropertyChain has no cascade from Agency)
    prisma.chainNotificationQueue.deleteMany({ where: { chain: { agencyId } } }),
    prisma.chainLink.deleteMany({ where: { chain: { agencyId } } }),
    prisma.propertyChain.deleteMany({ where: { agencyId } }),

    // 3. Transactions — cascades to MilestoneCompletion, ReminderLog, ChaseTask,
    //    OutboundMessage, TransactionNote, TransactionDocument, TransactionFlag,
    //    OutsourcedAssignmentNotification, BuyerRound, TransactionHoldPeriod, Contact
    prisma.propertyTransaction.deleteMany({ where: { agencyId } }),

    // 4. Invoicing
    prisma.invoiceLine.deleteMany({ where: { invoice: { agencyId } } }),
    prisma.creditNote.deleteMany({ where: { agencyId } }),
    prisma.invoice.deleteMany({ where: { agencyId } }),

    // 5. Agency-scoped settings
    prisma.agencyPreferredBroker.deleteMany({ where: { agencyId } }),
    prisma.agencyRecommendedSolicitor.deleteMany({ where: { agencyId } }),
    prisma.pricingAcknowledgement.deleteMany({ where: { agencyId } }),
    prisma.feedbackSubmission.deleteMany({ where: { agencyId } }),
    prisma.verifiedDomain.deleteMany({ where: { agencyId } }),

    // 6. Users (cascades to AgentPushSubscription, UserVerifiedEmail,
    //    RetentionEmailLog, Account, Session, Notification (already), etc.)
    prisma.user.deleteMany({ where: { agencyId } }),

    // 7. Final: DirectorInvitation, NegotiatorInvitation, Invoice (already),
    //    CreditNote (already), PricingAcknowledgement (already) cascade from Agency.
    prisma.agency.delete({ where: { id: agencyId } }),
  ]);
}

// ─── Date helpers ────────────────────────────────────────────────────────────

const ONE_DAY_MS = 86_400_000;
const daysAgo  = (n: number, base: Date = new Date()) => new Date(base.getTime() - n * ONE_DAY_MS);
const daysAhead = (n: number, base: Date = new Date()) => new Date(base.getTime() + n * ONE_DAY_MS);

function addBusinessDays(from: Date, days: number): Date {
  const result = new Date(from);
  let added = 0;
  while (added < days) {
    result.setDate(result.getDate() + 1);
    if (result.getDay() !== 0) added++; // skip Sundays (matches lib/work-queue convention)
  }
  return result;
}

// ─── Fixture catalogue ───────────────────────────────────────────────────────

type TxBucket =
  | "hero"
  | "exchange_ready"
  | "active_exch_today"
  | "active_compl_today"
  | "active_stalled"
  | "active_no_fee"
  | "exchanged_overdue"
  | "exchanged_this_week"
  | "exchanged_next_week"
  | "exchanged_later"
  | "exchanged_no_date"
  | "completed_recent"
  | "completed_last_month"
  | "on_hold"
  | "withdrawn_relist";

type TxFixture = {
  key: TxBucket;
  address: string;
  tenure: "freehold" | "leasehold";
  purchaseType: "mortgage" | "cash_buyer" | "cash_from_proceeds";
  purchasePricePence: number;
  ownedBy: "director" | "negotiator";
  agentFeeAmountPence: number | null;
  vendorSolicitorFirmKey: "hartwell" | "greenwood" | "maple" | "riverside" | null;
  purchaserSolicitorFirmKey: "hartwell" | "greenwood" | "maple" | "riverside" | null;
  brokerFirmKey: "pinnacle" | null;
  referredFirmKey: "hartwell" | "greenwood" | "maple" | "riverside" | null;
  referralFeePence: number | null;
  brokerReferralFeePence: number | null;
  purchaserBrokerReferral: boolean;
  vendorContacts: { name: string; first: string }[];
  purchaserContacts: { name: string; first: string }[];
  createdDaysAgo: number;
  expectedExchangeDaysAhead: number;
};

const FIXTURES: TxFixture[] = [
  // ── (a) HERO ────────────────────────────────────────────────────────────
  {
    key: "hero",
    address: "42 Hawthorn Road, Bristol, BS6 7NR",
    tenure: "freehold",
    purchaseType: "mortgage",
    purchasePricePence: 525_000_00,
    ownedBy: "director",
    agentFeeAmountPence: 9_500_00,
    vendorSolicitorFirmKey: "hartwell",
    purchaserSolicitorFirmKey: "greenwood",
    brokerFirmKey: "pinnacle",
    referredFirmKey: "hartwell",
    referralFeePence: 250_00,
    brokerReferralFeePence: 400_00,
    purchaserBrokerReferral: false,
    vendorContacts: [
      { name: "David Mitchell", first: "David" },
      { name: "Sarah Mitchell", first: "Sarah" },
    ],
    purchaserContacts: [
      { name: "Tom Clarke", first: "Tom" },
      { name: "Emma Clarke", first: "Emma" },
    ],
    createdDaysAgo: 32,
    expectedExchangeDaysAhead: 28,
  },

  // ── (b) EXCHANGE-READY ───────────────────────────────────────────────────
  {
    key: "exchange_ready",
    address: "8 Elmwood Crescent, Bath, BA1 5DT",
    tenure: "freehold",
    purchaseType: "mortgage",
    purchasePricePence: 695_000_00,
    ownedBy: "negotiator",
    agentFeeAmountPence: 12_000_00,
    vendorSolicitorFirmKey: "hartwell",
    purchaserSolicitorFirmKey: "maple",
    brokerFirmKey: "pinnacle",
    referredFirmKey: null,
    referralFeePence: null,
    brokerReferralFeePence: null,
    purchaserBrokerReferral: true,
    vendorContacts: [{ name: "Margaret Hollis", first: "Margaret" }],
    purchaserContacts: [
      { name: "Raj Patel", first: "Raj" },
      { name: "Anya Patel", first: "Anya" },
    ],
    createdDaysAgo: 78,
    expectedExchangeDaysAhead: 5,
  },

  // ── (c1) ACTIVE — exchange today ─────────────────────────────────────────
  {
    key: "active_exch_today",
    address: "17 Cedar Lane, Clifton, BS8 2RJ",
    tenure: "leasehold",
    purchaseType: "mortgage",
    purchasePricePence: 410_000_00,
    ownedBy: "director",
    agentFeeAmountPence: 7_500_00,
    vendorSolicitorFirmKey: "greenwood",
    purchaserSolicitorFirmKey: "hartwell",
    brokerFirmKey: null,
    referredFirmKey: null,
    referralFeePence: null,
    brokerReferralFeePence: null,
    purchaserBrokerReferral: false,
    vendorContacts: [{ name: "Helen Whitaker", first: "Helen" }],
    purchaserContacts: [{ name: "Marcus Reid", first: "Marcus" }],
    createdDaysAgo: 70,
    expectedExchangeDaysAhead: 0,
  },

  // ── (c2) ACTIVE — completion today ───────────────────────────────────────
  // exchangedAt set so completionDate field is meaningful for the diary.
  {
    key: "active_compl_today",
    address: "33 Oakfield Avenue, Wells, BA5 2QH",
    tenure: "freehold",
    purchaseType: "cash_buyer",
    purchasePricePence: 365_000_00,
    ownedBy: "negotiator",
    agentFeeAmountPence: 6_500_00,
    vendorSolicitorFirmKey: "greenwood",
    purchaserSolicitorFirmKey: "riverside",
    brokerFirmKey: null,
    referredFirmKey: "greenwood",
    referralFeePence: 200_00,
    brokerReferralFeePence: null,
    purchaserBrokerReferral: false,
    vendorContacts: [{ name: "Andrew Lloyd", first: "Andrew" }],
    purchaserContacts: [{ name: "Joanne Bishop", first: "Joanne" }],
    createdDaysAgo: 56,
    expectedExchangeDaysAhead: -14,
  },

  // ── (c3) ACTIVE — stalled (no activity 14+ days, file alerts strip) ──────
  {
    key: "active_stalled",
    address: "5 Birch Mews, Frome, BA11 1AB",
    tenure: "freehold",
    purchaseType: "mortgage",
    purchasePricePence: 480_000_00,
    ownedBy: "director",
    agentFeeAmountPence: 8_750_00,
    vendorSolicitorFirmKey: "hartwell",
    purchaserSolicitorFirmKey: "greenwood",
    brokerFirmKey: "pinnacle",
    referredFirmKey: null,
    referralFeePence: null,
    brokerReferralFeePence: 350_00,
    purchaserBrokerReferral: false,
    vendorContacts: [{ name: "Peter Hayes", first: "Peter" }],
    purchaserContacts: [{ name: "Diane Walker", first: "Diane" }],
    createdDaysAgo: 30,
    expectedExchangeDaysAhead: 49,
  },

  // ── (c4) ACTIVE — no fee set (no-fee widget) ─────────────────────────────
  {
    key: "active_no_fee",
    address: "21 Willow Court, Bristol, BS4 3LE",
    tenure: "leasehold",
    purchaseType: "cash_from_proceeds",
    purchasePricePence: 555_000_00,
    ownedBy: "negotiator",
    agentFeeAmountPence: null,
    vendorSolicitorFirmKey: "maple",
    purchaserSolicitorFirmKey: "hartwell",
    brokerFirmKey: null,
    referredFirmKey: null,
    referralFeePence: null,
    brokerReferralFeePence: null,
    purchaserBrokerReferral: false,
    vendorContacts: [{ name: "Lucy Greenfield", first: "Lucy" }],
    purchaserContacts: [{ name: "Owen Davies", first: "Owen" }],
    createdDaysAgo: 12,
    expectedExchangeDaysAhead: 56,
  },

  // ── (d1) EXCHANGED — completion overdue ──────────────────────────────────
  {
    key: "exchanged_overdue",
    address: "9 Maple Drive, Bath, BA2 4PG",
    tenure: "freehold",
    purchaseType: "mortgage",
    purchasePricePence: 740_000_00,
    ownedBy: "director",
    agentFeeAmountPence: 13_500_00,
    vendorSolicitorFirmKey: "hartwell",
    purchaserSolicitorFirmKey: "greenwood",
    brokerFirmKey: "pinnacle",
    referredFirmKey: "hartwell",
    referralFeePence: 300_00,
    brokerReferralFeePence: null,
    purchaserBrokerReferral: false,
    vendorContacts: [{ name: "Charles Bramley", first: "Charles" }],
    purchaserContacts: [{ name: "Ruby Allen", first: "Ruby" }],
    createdDaysAgo: 95,
    expectedExchangeDaysAhead: -10,
  },

  // ── (d2) EXCHANGED — completion this week ────────────────────────────────
  {
    key: "exchanged_this_week",
    address: "14 Acacia Close, Bristol, BS7 9TF",
    tenure: "freehold",
    purchaseType: "mortgage",
    purchasePricePence: 615_000_00,
    ownedBy: "negotiator",
    agentFeeAmountPence: 11_250_00,
    vendorSolicitorFirmKey: "greenwood",
    purchaserSolicitorFirmKey: "hartwell",
    brokerFirmKey: null,
    referredFirmKey: null,
    referralFeePence: null,
    brokerReferralFeePence: null,
    purchaserBrokerReferral: false,
    vendorContacts: [{ name: "Eleanor Voss", first: "Eleanor" }],
    purchaserContacts: [{ name: "Sebastien Court", first: "Sebastien" }],
    createdDaysAgo: 82,
    expectedExchangeDaysAhead: -5,
  },

  // ── (d3) EXCHANGED — completion next week ────────────────────────────────
  {
    key: "exchanged_next_week",
    address: "27 Ivy Terrace, Clifton, BS8 3HX",
    tenure: "leasehold",
    purchaseType: "mortgage",
    purchasePricePence: 895_000_00,
    ownedBy: "director",
    agentFeeAmountPence: 16_000_00,
    vendorSolicitorFirmKey: "hartwell",
    purchaserSolicitorFirmKey: "maple",
    brokerFirmKey: "pinnacle",
    referredFirmKey: null,
    referralFeePence: null,
    brokerReferralFeePence: 500_00,
    purchaserBrokerReferral: false,
    vendorContacts: [{ name: "Jonathan Pearce", first: "Jonathan" }],
    purchaserContacts: [{ name: "Mia Aldridge", first: "Mia" }],
    createdDaysAgo: 88,
    expectedExchangeDaysAhead: -3,
  },

  // ── (d4) EXCHANGED — completion later (~3 weeks) ─────────────────────────
  {
    key: "exchanged_later",
    address: "11 Rowan Gardens, Wells, BA5 3DR",
    tenure: "freehold",
    purchaseType: "cash_buyer",
    purchasePricePence: 425_000_00,
    ownedBy: "negotiator",
    agentFeeAmountPence: 7_800_00,
    vendorSolicitorFirmKey: "greenwood",
    purchaserSolicitorFirmKey: "riverside",
    brokerFirmKey: null,
    referredFirmKey: null,
    referralFeePence: null,
    brokerReferralFeePence: null,
    purchaserBrokerReferral: false,
    vendorContacts: [{ name: "Patricia Lockhart", first: "Patricia" }],
    purchaserContacts: [{ name: "Henry Ashford", first: "Henry" }],
    createdDaysAgo: 70,
    expectedExchangeDaysAhead: -2,
  },

  // ── (d5) EXCHANGED — completion date null ────────────────────────────────
  {
    key: "exchanged_no_date",
    address: "6 Beech Court, Frome, BA11 4SY",
    tenure: "leasehold",
    purchaseType: "mortgage",
    purchasePricePence: 380_000_00,
    ownedBy: "director",
    agentFeeAmountPence: 6_900_00,
    vendorSolicitorFirmKey: "maple",
    purchaserSolicitorFirmKey: "hartwell",
    brokerFirmKey: "pinnacle",
    referredFirmKey: null,
    referralFeePence: null,
    brokerReferralFeePence: 280_00,
    purchaserBrokerReferral: false,
    vendorContacts: [{ name: "Ian Whitcombe", first: "Ian" }],
    purchaserContacts: [{ name: "Naomi Frost", first: "Naomi" }],
    createdDaysAgo: 105,
    expectedExchangeDaysAhead: -1,
  },

  // ── (e1) COMPLETED — 3 weeks ago ─────────────────────────────────────────
  {
    key: "completed_recent",
    address: "19 Sycamore Avenue, Bristol, BS5 6BJ",
    tenure: "freehold",
    purchaseType: "mortgage",
    purchasePricePence: 570_000_00,
    ownedBy: "director",
    agentFeeAmountPence: 10_400_00,
    vendorSolicitorFirmKey: "hartwell",
    purchaserSolicitorFirmKey: "greenwood",
    brokerFirmKey: null,
    referredFirmKey: "hartwell",
    referralFeePence: 250_00,
    brokerReferralFeePence: null,
    purchaserBrokerReferral: false,
    vendorContacts: [{ name: "Diana Ellsworth", first: "Diana" }],
    purchaserContacts: [{ name: "Luke Beaumont", first: "Luke" }],
    createdDaysAgo: 120,
    expectedExchangeDaysAhead: -28,
  },

  // ── (e2) COMPLETED — last month ──────────────────────────────────────────
  {
    key: "completed_last_month",
    address: "44 Larch Way, Bath, BA1 8QK",
    tenure: "freehold",
    purchaseType: "mortgage",
    purchasePricePence: 1_180_000_00,
    ownedBy: "negotiator",
    agentFeeAmountPence: 21_500_00,
    vendorSolicitorFirmKey: "greenwood",
    purchaserSolicitorFirmKey: "hartwell",
    brokerFirmKey: "pinnacle",
    referredFirmKey: null,
    referralFeePence: null,
    brokerReferralFeePence: 750_00,
    purchaserBrokerReferral: true,
    vendorContacts: [{ name: "Geoffrey Westwood", first: "Geoffrey" }],
    purchaserContacts: [{ name: "Camille Foster", first: "Camille" }],
    createdDaysAgo: 160,
    expectedExchangeDaysAhead: -50,
  },

  // ── (f1) ON HOLD ─────────────────────────────────────────────────────────
  {
    key: "on_hold",
    address: "38 Poplar Road, Wells, BA5 1MN",
    tenure: "freehold",
    purchaseType: "mortgage",
    purchasePricePence: 445_000_00,
    ownedBy: "director",
    agentFeeAmountPence: 8_200_00,
    vendorSolicitorFirmKey: "hartwell",
    purchaserSolicitorFirmKey: "greenwood",
    brokerFirmKey: null,
    referredFirmKey: null,
    referralFeePence: null,
    brokerReferralFeePence: null,
    purchaserBrokerReferral: false,
    vendorContacts: [{ name: "Robert Travers", first: "Robert" }],
    purchaserContacts: [{ name: "Imogen Hall", first: "Imogen" }],
    createdDaysAgo: 50,
    expectedExchangeDaysAhead: 42,
  },

  // ── (f2) WITHDRAWN pre-exchange (relist banner) ──────────────────────────
  {
    key: "withdrawn_relist",
    address: "55 Hazel Crescent, Frome, BA11 2WP",
    tenure: "freehold",
    purchaseType: "mortgage",
    purchasePricePence: 395_000_00,
    ownedBy: "negotiator",
    agentFeeAmountPence: 7_100_00,
    vendorSolicitorFirmKey: "riverside",
    purchaserSolicitorFirmKey: "maple",
    brokerFirmKey: null,
    referredFirmKey: null,
    referralFeePence: null,
    brokerReferralFeePence: null,
    purchaserBrokerReferral: false,
    vendorContacts: [{ name: "Karen Sturridge", first: "Karen" }],
    purchaserContacts: [{ name: "Daniel Hope", first: "Daniel" }],
    createdDaysAgo: 40,
    expectedExchangeDaysAhead: 21,
  },
];

// ─── Solicitor + broker firm catalogue ───────────────────────────────────────

const SOLICITOR_FIRMS: { key: "hartwell" | "greenwood" | "maple" | "riverside"; name: string; contacts: { name: string; email: string; phone: string }[] }[] = [
  {
    key: "hartwell",
    name: "Hartwell Conveyancing",
    contacts: [
      { name: "Olivia Hartwell", email: "olivia@hartwell-conveyancing.test", phone: "0117 555 0101" },
      { name: "Marcus Yeo",      email: "marcus@hartwell-conveyancing.test", phone: "0117 555 0102" },
    ],
  },
  {
    key: "greenwood",
    name: "Greenwood Legal",
    contacts: [
      { name: "Priya Khatri",  email: "priya@greenwood-legal.test", phone: "0117 555 0201" },
      { name: "Daniel Ellis",  email: "daniel@greenwood-legal.test", phone: "0117 555 0202" },
    ],
  },
  {
    key: "maple",
    name: "Maple & Cross LLP",
    contacts: [
      { name: "Helena Maple",  email: "helena@maple-cross.test",   phone: "01225 555 301" },
      { name: "Toby Cross",    email: "toby@maple-cross.test",     phone: "01225 555 302" },
    ],
  },
  {
    key: "riverside",
    name: "Riverside Solicitors",
    contacts: [
      { name: "Naomi Tate",    email: "naomi@riverside-solicitors.test", phone: "01749 555 401" },
      { name: "James Rourke",  email: "james@riverside-solicitors.test", phone: "01749 555 402" },
    ],
  },
];

const BROKER_FIRM = {
  key: "pinnacle" as const,
  name: "Pinnacle Mortgages",
  website: "https://pinnacle-mortgages.test",
  contacts: [
    { name: "Robert Pinnacle", email: "robert@pinnacle-mortgages.test", phone: "0207 555 0501" },
    { name: "Sienna Marsh",    email: "sienna@pinnacle-mortgages.test", phone: "0207 555 0502" },
  ],
};

// ─── Milestone progression presets (per bucket) ──────────────────────────────
// Codes the demo wants visibly complete on each file. For VM19/PM26/VM20/PM27
// we always go through completeMilestone() so exchangedAt/billedAt are stamped
// (even though we backdate them afterwards for the "last month" effect).

const PROGRESSION: Record<TxBucket, string[]> = {
  hero:                ["VM1", "VM2", "VM3", "VM4", "VM5", "PM1", "PM2", "PM3", "PM4"],

  // Exchange-ready: every blocksExchange milestone complete or NR.
  // Auto-NR on freehold × mortgage handles VM8 + VM9. We complete the rest.
  exchange_ready:      [
    "VM1","VM2","VM3","VM4","VM5","VM6","VM7","VM10","VM11","VM12","VM13","VM14","VM15","VM16","VM17",
    "PM1","PM2","PM3","PM4","PM5","PM6","PM7","PM8","PM9","PM10","PM11","PM13","PM14","PM15","PM16","PM17","PM18","PM19","PM20","PM21","PM22","PM23","PM24",
  ],
  active_exch_today:   ["VM1","VM2","VM3","VM4","VM5","VM6","VM7","VM10","PM1","PM2","PM3","PM4","PM5","PM6","PM7"],
  active_compl_today:  [
    "VM1","VM2","VM3","VM4","VM5","VM6","VM7","VM10","VM11","VM12","VM13","VM14","VM15","VM16","VM17","VM18","VM19",
    "PM1","PM2","PM3","PM4","PM7","PM8","PM9","PM10","PM13","PM14","PM15","PM16","PM17","PM18","PM19","PM20","PM21","PM22","PM23","PM25","PM26",
  ],
  active_stalled:      ["VM1","VM2","VM3","PM1","PM2","PM3"],
  active_no_fee:       ["VM1","VM2","VM3","VM4","PM1","PM2","PM3"],

  exchanged_overdue:   [
    "VM1","VM2","VM3","VM4","VM5","VM6","VM7","VM10","VM11","VM12","VM13","VM14","VM15","VM16","VM17","VM18","VM19",
    "PM1","PM2","PM3","PM4","PM5","PM6","PM7","PM8","PM9","PM10","PM13","PM14","PM15","PM16","PM17","PM18","PM19","PM20","PM21","PM22","PM23","PM24","PM25","PM26",
  ],
  exchanged_this_week: [
    "VM1","VM2","VM3","VM4","VM5","VM6","VM7","VM10","VM11","VM12","VM13","VM14","VM15","VM16","VM17","VM18","VM19",
    "PM1","PM2","PM3","PM4","PM5","PM6","PM7","PM8","PM9","PM10","PM13","PM14","PM15","PM16","PM17","PM18","PM19","PM20","PM21","PM22","PM23","PM24","PM25","PM26",
  ],
  exchanged_next_week: [
    "VM1","VM2","VM3","VM4","VM5","VM6","VM7","VM8","VM9","VM10","VM11","VM12","VM13","VM14","VM15","VM16","VM17","VM18","VM19",
    "PM1","PM2","PM3","PM4","PM5","PM6","PM7","PM8","PM9","PM10","PM11","PM12","PM13","PM14","PM15","PM16","PM17","PM18","PM19","PM20","PM21","PM22","PM23","PM24","PM25","PM26",
  ],
  exchanged_later:     [
    "VM1","VM2","VM3","VM4","VM5","VM6","VM7","VM10","VM11","VM12","VM13","VM14","VM15","VM16","VM17","VM18","VM19",
    "PM1","PM2","PM3","PM4","PM7","PM8","PM9","PM10","PM13","PM14","PM15","PM16","PM17","PM18","PM19","PM20","PM21","PM22","PM23","PM25","PM26",
  ],
  exchanged_no_date:   [
    "VM1","VM2","VM3","VM4","VM5","VM6","VM7","VM8","VM9","VM10","VM11","VM12","VM13","VM14","VM15","VM16","VM17","VM18","VM19",
    "PM1","PM2","PM3","PM4","PM5","PM6","PM7","PM8","PM9","PM10","PM11","PM12","PM13","PM14","PM15","PM16","PM17","PM18","PM19","PM20","PM21","PM22","PM23","PM24","PM25","PM26",
  ],

  // Completed = exchanged + completion confirmations
  completed_recent:    [
    "VM1","VM2","VM3","VM4","VM5","VM6","VM7","VM10","VM11","VM12","VM13","VM14","VM15","VM16","VM17","VM18","VM19","VM20",
    "PM1","PM2","PM3","PM4","PM5","PM6","PM7","PM8","PM9","PM10","PM13","PM14","PM15","PM16","PM17","PM18","PM19","PM20","PM21","PM22","PM23","PM24","PM25","PM26","PM27",
  ],
  completed_last_month: [
    "VM1","VM2","VM3","VM4","VM5","VM6","VM7","VM10","VM11","VM12","VM13","VM14","VM15","VM16","VM17","VM18","VM19","VM20",
    "PM1","PM2","PM3","PM4","PM5","PM6","PM7","PM8","PM9","PM10","PM13","PM14","PM15","PM16","PM17","PM18","PM19","PM20","PM21","PM22","PM23","PM24","PM25","PM26","PM27",
  ],

  on_hold:             ["VM1","VM2","VM3","VM4","PM1","PM2","PM3"],
  withdrawn_relist:    ["VM1","VM2","VM3","PM1","PM2"],
};

// ─── Manifest type (returned for reporting) ──────────────────────────────────

export type SeedManifest = {
  agencyId: string;
  directorUserId: string;
  negotiatorUserId: string;
  fixtures: { key: TxBucket; transactionId: string; address: string; ownedBy: "director" | "negotiator"; purchaserPortalToken: string | null; vendorPortalToken: string | null }[];
};

// ─── Seed orchestrator ───────────────────────────────────────────────────────

export async function runSeedDemo(prisma: PrismaClient): Promise<SeedManifest> {
  await tearDownDemoAgency(prisma);

  const now = new Date();

  // ── Agency (billing noise suppressed) ──────────────────────────────────
  const agency = await prisma.agency.create({
    data: {
      name: DEMO_AGENCY_NAME,
      // firstSubmissionAt = now → 14-day trial window stays open, blocking
      // the trial-expired modal on /agent/transactions/new-v2.
      firstSubmissionAt: now,
      // stripeCustomerId presence is what PaymentMethodNudge / PaymentBlockBanner
      // gate on — a stub value silences both.
      stripeCustomerId: "demo-stub-not-a-real-stripe-id",
      signupAt: now,
    },
  });

  // ── Users ───────────────────────────────────────────────────────────────
  const directorPassword   = hashSync(DEMO_DIRECTOR_PASSWORD, 12);
  const negotiatorPassword = hashSync(DEMO_NEGOTIATOR_PASSWORD, 12);

  const director = await prisma.user.create({
    data: {
      name: "Sarah Whitcomb",
      email: DEMO_DIRECTOR_EMAIL,
      password: directorPassword,
      role: "director",
      agencyId: agency.id,
      firmName: agency.name,
      isInternal: false,
      welcomeEmailSentAt: now,
    },
  });
  const negotiator = await prisma.user.create({
    data: {
      name: "James Patel",
      email: DEMO_NEGOTIATOR_EMAIL,
      password: negotiatorPassword,
      role: "negotiator",
      agencyId: agency.id,
      firmName: agency.name,
      isInternal: false,
      welcomeEmailSentAt: now,
    },
  });

  // ── Solicitor firms (shared across files for analytics repeat-firm stats) ─
  // Lookup-then-create so re-running the seed against a partially-cleaned DB
  // (or sharing solicitor firms across multiple demo agencies in future) is
  // safe. SolicitorFirm.name is @unique.
  const solicitorFirmIds: Record<"hartwell" | "greenwood" | "maple" | "riverside", string> = {} as never;
  const solicitorContactIds: Record<string, string> = {}; // key = "<firmKey>:<contactName>"
  for (const firm of SOLICITOR_FIRMS) {
    const existing = await prisma.solicitorFirm.findUnique({ where: { name: firm.name }, select: { id: true } });
    const firmRow = existing
      ? await prisma.solicitorFirm.update({ where: { id: existing.id }, data: {} })
      : await prisma.solicitorFirm.create({ data: { name: firm.name } });
    solicitorFirmIds[firm.key] = firmRow.id;
    for (const contact of firm.contacts) {
      // SolicitorContact has no unique on (firmId, name) — to stay idempotent
      // we delete-then-create scoped to this firm + name. Cascades from
      // SolicitorFirm leave us clean if a firm was re-created above.
      await prisma.solicitorContact.deleteMany({ where: { firmId: firmRow.id, name: contact.name } });
      const c = await prisma.solicitorContact.create({
        data: { firmId: firmRow.id, name: contact.name, email: contact.email, phone: contact.phone },
      });
      solicitorContactIds[`${firm.key}:${contact.name}`] = c.id;
    }
  }

  // ── Broker firm ─────────────────────────────────────────────────────────
  // BrokerFirm.name is NOT @unique — use the same delete-then-create pattern
  // scoped to the firm name so the demo doesn't accumulate Pinnacle rows.
  await prisma.brokerFirm.deleteMany({ where: { name: BROKER_FIRM.name } });
  const broker = await prisma.brokerFirm.create({
    data: {
      name: BROKER_FIRM.name,
      website: BROKER_FIRM.website,
      handlers: { create: BROKER_FIRM.contacts.map((c) => ({ name: c.name, email: c.email, phone: c.phone })) },
    },
    include: { handlers: true },
  });
  const brokerFirmId    = broker.id;
  const brokerContactId = broker.handlers[0].id;

  // ── Agency-scoped settings (preferred broker + recommended solicitors) ──
  await prisma.agencyPreferredBroker.create({
    data: { agencyId: agency.id, brokerFirmId, defaultReferralFeePence: 400_00 },
  });
  for (const key of ["hartwell", "greenwood"] as const) {
    await prisma.agencyRecommendedSolicitor.create({
      data: {
        agencyId: agency.id,
        solicitorFirmId: solicitorFirmIds[key],
        defaultReferralFeePence: 250_00,
      },
    });
  }

  // ── Milestone definition lookup ─────────────────────────────────────────
  const defs = await prisma.milestoneDefinition.findMany({
    select: { id: true, code: true, side: true, weight: true },
  });
  const defByCode = new Map(defs.map((d) => [d.code, d]));

  // ── Per-fixture seed ────────────────────────────────────────────────────
  const out: SeedManifest = {
    agencyId: agency.id,
    directorUserId: director.id,
    negotiatorUserId: negotiator.id,
    fixtures: [],
  };

  // Hold one reference to the hero transaction so we can attach a chain
  // after every fixture exists.
  let heroTransactionId: string | null = null;
  let heroPurchaserContactId: string | null = null;

  for (const fx of FIXTURES) {
    const ownerUserId = fx.ownedBy === "director" ? director.id : negotiator.id;
    const createdAt = daysAgo(fx.createdDaysAgo);
    const expectedExchangeDate = daysAhead(fx.expectedExchangeDaysAhead);

    const vendorFirmId    = fx.vendorSolicitorFirmKey    ? solicitorFirmIds[fx.vendorSolicitorFirmKey]    : null;
    const purchaserFirmId = fx.purchaserSolicitorFirmKey ? solicitorFirmIds[fx.purchaserSolicitorFirmKey] : null;
    const vendorContactRowId    = fx.vendorSolicitorFirmKey    ? solicitorContactIds[`${fx.vendorSolicitorFirmKey}:${SOLICITOR_FIRMS.find((f) => f.key === fx.vendorSolicitorFirmKey)!.contacts[0].name}`] : null;
    const purchaserContactRowId = fx.purchaserSolicitorFirmKey ? solicitorContactIds[`${fx.purchaserSolicitorFirmKey}:${SOLICITOR_FIRMS.find((f) => f.key === fx.purchaserSolicitorFirmKey)!.contacts[0].name}`] : null;

    // Phase 1 of file create — PropertyTransaction + BuyerRound in one $tx.
    const tx = await prisma.$transaction(async (ptx) => {
      const created = await ptx.propertyTransaction.create({
        data: {
          propertyAddress: fx.address,
          agencyId: agency.id,
          assignedUserId: ownerUserId,
          assignedAt: createdAt,
          agentUserId: ownerUserId,
          progressedBy: "agent",
          serviceType: "self_managed",
          status: "active",
          tenure: fx.tenure,
          purchaseType: fx.purchaseType,
          purchasePrice: fx.purchasePricePence,
          expectedExchangeDate,
          twelveWeekTarget: daysAhead(84, createdAt),
          createdAt,
          freeOnExchange: true, // demo agency is inside its 14-day window
          agentFeeAmount: fx.agentFeeAmountPence,
          vendorSolicitorFirmId: vendorFirmId,
          vendorSolicitorContactId: vendorContactRowId,
          purchaserSolicitorFirmId: purchaserFirmId,
          purchaserSolicitorContactId: purchaserContactRowId,
          referredFirmId: fx.referredFirmKey ? solicitorFirmIds[fx.referredFirmKey] : null,
          referralFee: fx.referralFeePence,
          brokerFirmId: fx.brokerFirmKey ? brokerFirmId : null,
          brokerContactId: fx.brokerFirmKey ? brokerContactId : null,
          brokerReferralFee: fx.brokerReferralFeePence,
          purchaserBrokerReferral: fx.purchaserBrokerReferral,
          lastActivityAt: createdAt,
        },
      });
      const round = await ptx.buyerRound.create({
        data: {
          transactionId: created.id,
          roundNumber: 1,
          status: "active",
          purchasePrice: created.purchasePrice,
          purchaserSolicitorFirmId: created.purchaserSolicitorFirmId,
          purchaserSolicitorContactId: created.purchaserSolicitorContactId,
          brokerFirmId: created.brokerFirmId,
          brokerContactId: created.brokerContactId,
        },
      });
      return ptx.propertyTransaction.update({
        where: { id: created.id },
        data: { activeBuyerRoundId: round.id },
      });
    });

    // ── Contacts ────────────────────────────────────────────────────────
    const slug = fx.key.replace(/_/g, "-");
    const purchaserContactRowIds: string[] = [];
    let firstPurchaserContactId: string | null = null;
    let firstPurchaserPortalToken: string | null = null;
    let firstVendorPortalToken: string | null = null;
    for (let i = 0; i < fx.vendorContacts.length; i++) {
      const v = fx.vendorContacts[i];
      const portalToken = randomUUID();
      if (i === 0) firstVendorPortalToken = portalToken;
      await prisma.contact.create({
        data: {
          propertyTransactionId: tx.id,
          name: v.name,
          email: `${v.first.toLowerCase()}-${slug}@fairview-clients.test`,
          phone: `07700 900${100 + FIXTURES.indexOf(fx) * 10 + i}`,
          roleType: "vendor",
          portalToken,
          buyerRoundId: null,
        },
      });
    }
    for (let i = 0; i < fx.purchaserContacts.length; i++) {
      const p = fx.purchaserContacts[i];
      const portalToken = randomUUID();
      if (i === 0) firstPurchaserPortalToken = portalToken;
      const row = await prisma.contact.create({
        data: {
          propertyTransactionId: tx.id,
          name: p.name,
          email: `${p.first.toLowerCase()}-${slug}@fairview-clients.test`,
          phone: `07700 901${100 + FIXTURES.indexOf(fx) * 10 + i}`,
          roleType: "purchaser",
          portalToken,
          buyerRoundId: tx.activeBuyerRoundId,
        },
      });
      purchaserContactRowIds.push(row.id);
      if (i === 0) firstPurchaserContactId = row.id;
    }

    // ── Initialise milestone rows + run completions ─────────────────────
    // initializeMilestoneCompletions runs the auto-NR logic, then we route
    // every "render as complete" code through completeMilestone() so all
    // side-effects (dependents unlocking, exchange-gate unlocking, exchange
    // stamps for VM19/PM26, last-activity touch) fire correctly.
    const { initializeMilestoneCompletions } = await import("../lib/services/milestones");
    await initializeMilestoneCompletions(tx.id, fx.tenure, fx.purchaseType, ownerUserId, tx.activeBuyerRoundId);

    const codes = PROGRESSION[fx.key];
    // Spread completedAt across the file's lifetime so the Updates feed
    // and the activity ribbon read as ongoing work, not a single big bang.
    const lifespan = Math.max(fx.createdDaysAgo - 1, 1);
    for (let i = 0; i < codes.length; i++) {
      const code = codes[i];
      const def = defByCode.get(code);
      if (!def) continue;
      const offset = Math.round(lifespan - (i / Math.max(codes.length - 1, 1)) * (lifespan - 0.5));
      const completedAt = daysAgo(offset);
      // Bilateral exchange codes (VM19 / PM26) trigger maybeStampExchange —
      // we always route them through completeMilestone so exchangedAt and
      // billedAtExchange get written, then backdate them below.
      // Confirmer: alternate director / negotiator so the comms feed shows
      // multiple authors; 1 in every 5 sets confirmedByPortal via a
      // contact-kind confirmer (covers the ≥2 portal confirmations requirement).
      const useContactConfirmer = i % 5 === 0 && firstPurchaserContactId != null && def.side === "purchaser";
      try {
        await completeMilestone({
          transactionId: tx.id,
          milestoneDefinitionId: def.id,
          confirmer: useContactConfirmer
            ? { kind: "contact", id: firstPurchaserContactId!, name: fx.purchaserContacts[0].name }
            : { kind: "user", id: ownerUserId, name: fx.ownedBy === "director" ? "Sarah Whitcomb" : "James Patel" },
          completedAt,
        });
      } catch (e) {
        // Prerequisite errors are non-fatal in seed (e.g. fixture cherry-picks
        // codes whose chain may not be fully resolved). Log + continue.
        console.warn(`  ! skipped ${code} on ${fx.address}: ${(e as Error).message}`);
      }
    }

    // ── Status + completion date + exchange backdating ──────────────────
    const isExchanged = codes.includes("VM19") || codes.includes("PM26");
    const isCompletedStatus = fx.key === "completed_recent" || fx.key === "completed_last_month";
    const isOnHold = fx.key === "on_hold";
    const isWithdrawn = fx.key === "withdrawn_relist";

    // exchangedAt for momentum: 3 in current month (≤25 days ago) + 2 in last month (35d, 40d ago)
    // distribute across the exchanged buckets.
    const EXCHANGED_AT_OFFSETS: Partial<Record<TxBucket, number>> = {
      // d-series — completion buckets after exchange
      exchanged_overdue:    8,
      exchanged_this_week:  18,
      exchanged_next_week:  4,
      exchanged_later:     35,
      exchanged_no_date:   42,
      // also stamp exchangedAt for active_compl_today (exchanged, completing today)
      active_compl_today:  21,
      // exchange-ready is NOT exchanged yet
      // completed buckets
      completed_recent:    25,
      completed_last_month: 38,
    };

    // completionDate for the "awaiting completion" group (overdue, this/next/later, no-date)
    const COMPLETION_DATE_DAYS: Partial<Record<TxBucket, number | null>> = {
      exchanged_overdue:   -4,                // 4 days overdue
      exchanged_this_week: addBusinessDaysOffset(2),
      exchanged_next_week: 9,
      exchanged_later:    21,
      exchanged_no_date:  null,
      completed_recent:  -22,
      completed_last_month: -34,
      active_compl_today: 0, // today
    };

    const dataPatch: Record<string, unknown> = {};
    if (isExchanged && EXCHANGED_AT_OFFSETS[fx.key] !== undefined) {
      const ex = daysAgo(EXCHANGED_AT_OFFSETS[fx.key]!);
      dataPatch.exchangedAt = ex;
      dataPatch.billedAtExchange = null; // demo agency = trial = freeOnExchange = true → no bill
      dataPatch.priceAtExchange = fx.purchasePricePence;
    }
    const cdOffset = COMPLETION_DATE_DAYS[fx.key];
    if (cdOffset !== undefined) {
      dataPatch.completionDate = cdOffset === null ? null : (cdOffset === 0 ? new Date() : daysAgo(-cdOffset));
    }
    if (isCompletedStatus) {
      dataPatch.status = "completed";
    } else if (isOnHold) {
      dataPatch.status = "on_hold";
    } else if (isWithdrawn) {
      dataPatch.status = "withdrawn";
      dataPatch.fallThroughReason = "Buyer pulled out — relisting";
      dataPatch.exchangedAt = null;
    }

    // Stalled file — backdate lastActivityAt 18 days
    if (fx.key === "active_stalled") {
      dataPatch.lastActivityAt = daysAgo(18);
    } else {
      // Otherwise let the touchLastActivity() calls inside completeMilestone
      // win, but make sure it's at least the most-recent completedAt.
      dataPatch.lastActivityAt = daysAgo(2);
    }

    if (Object.keys(dataPatch).length > 0) {
      await prisma.propertyTransaction.update({ where: { id: tx.id }, data: dataPatch });
    }

    // Hold period for on_hold file
    if (isOnHold) {
      await prisma.transactionHoldPeriod.create({
        data: {
          transactionId: tx.id,
          startedAt: daysAgo(6),
          startedById: ownerUserId,
          plannedEndAt: daysAhead(8),
        },
      });
    }

    // ── Hero file: rich engagement layer ─────────────────────────────────
    if (fx.key === "hero") {
      heroTransactionId = tx.id;
      heroPurchaserContactId = firstPurchaserContactId;

      // ≥6 OutboundMessage rows across multiple days + varied methods
      const COMM_MIX: { days: number; method: "email" | "phone" | "sms" | "voicemail" | "whatsapp" | "post"; type: "outbound" | "internal_note"; content: string; subject?: string }[] = [
        { days: 22, method: "email",     type: "outbound",      subject: "Confirming we've received your money laundering documents", content: "Hi David and Sarah — just confirming receipt of the AML pack. We'll move to enquiries next week." },
        { days: 15, method: "phone",     type: "outbound",      content: "Spoke to Greenwood Legal — searches ordered today, expecting return 3–4 weeks." },
        { days: 11, method: "sms",       type: "outbound",      content: "Quick text to confirm survey is booked for Friday 10am." },
        { days: 9,  method: "voicemail", type: "outbound",      content: "Left a voicemail with Tom asking him to call back re lender appointment." },
        { days: 6,  method: "email",     type: "outbound",      subject: "Mortgage offer received — well done", content: "Tom, great news — your mortgage offer arrived this morning. Forwarded to your solicitor." },
        { days: 3,  method: "whatsapp",  type: "outbound",      content: "Quick update via WhatsApp — vendor solicitor confirmed enquiries replies sent this morning." },
        { days: 1,  method: "phone",     type: "internal_note", content: "Internal — chased Hartwell for management pack, said Friday at the latest." },
      ];
      for (const c of COMM_MIX) {
        await prisma.outboundMessage.create({
          data: {
            transactionId: tx.id,
            agencyId: agency.id,
            type: c.type,
            method: c.method,
            channel: c.method === "email" ? "email" : c.method === "sms" || c.method === "whatsapp" ? "sms" : "other",
            purpose: "chase",
            status: "sent",
            content: c.content,
            subject: c.subject,
            contactIds: c.type === "outbound" && firstPurchaserContactId ? [firstPurchaserContactId] : [],
            createdById: ownerUserId,
            createdByRole: "director",
            createdAt: daysAgo(c.days),
            updatedAt: daysAgo(c.days),
            sentAt: daysAgo(c.days),
          },
        });
      }

      // ≥2 active ClientChaseState rows on the lead purchaser
      // (so /portal/[token]/respond has content to show).
      const CHASE_MILESTONES = ["PM5", "PM7"]; // mortgage app + contract pack
      for (const code of CHASE_MILESTONES) {
        if (!firstPurchaserContactId) break;
        await prisma.clientChaseState.create({
          data: {
            transactionId: tx.id,
            contactId: firstPurchaserContactId,
            milestoneCode: code,
            chaseCount: 2,
            firstChasedAt: daysAgo(7),
            lastChasedAt: daysAgo(2),
            lastEngagedAt: daysAgo(4),
            status: "active",
            buyerRoundId: tx.activeBuyerRoundId,
          },
        });
      }
    }

    out.fixtures.push({
      key: fx.key,
      transactionId: tx.id,
      address: fx.address,
      ownedBy: fx.ownedBy,
      purchaserPortalToken: firstPurchaserPortalToken,
      vendorPortalToken: firstVendorPortalToken,
    });
  }

  // ── Chain: 3-link chain spanning the hero file + two stubs ──────────────
  if (heroTransactionId) {
    const chain = await prisma.propertyChain.create({
      data: {
        agencyId: agency.id,
        name: "Hawthorn Road chain",
        createdByUserId: out.directorUserId,
        status: "ACTIVE",
      },
    });
    // Position 1 (below hero) — the buyer's purchase, stub for now
    await prisma.chainLink.create({
      data: {
        chainId: chain.id,
        position: 1,
        createdByUserId: out.directorUserId,
        stubPropertyAddress: "104 Riverview Heights, Bristol, BS1 5QQ",
        stubAgencyName: "Pemberton & Co",
        stubAgentName: "Olive Pemberton",
        stubAgentEmail: "olive@pemberton-co.test",
        inviteStatus: "NOT_SENT",
      },
    });
    // Position 2 (hero) — the agency's file
    const heroLink = await prisma.chainLink.create({
      data: {
        chainId: chain.id,
        position: 2,
        createdByUserId: out.directorUserId,
        transactionId: heroTransactionId,
        claimedByUserId: out.directorUserId,
        claimedAt: daysAgo(30),
        inviteStatus: "CLAIMED",
      },
    });
    // Position 3 (above hero) — vendor's onward purchase, stub
    await prisma.chainLink.create({
      data: {
        chainId: chain.id,
        position: 3,
        createdByUserId: out.directorUserId,
        stubPropertyAddress: "8 Highfield Gardens, Bath, BA2 7NX",
        stubAgencyName: "Wilton Bridge Estates",
        stubAgentName: "Marcus Wilton",
        stubAgentEmail: "marcus@wilton-bridge.test",
        inviteStatus: "SENT",
        inviteSentAt: daysAgo(28),
      },
    });
    // Attach the active link to the hero transaction.
    await prisma.propertyTransaction.update({
      where: { id: heroTransactionId },
      data: { chainLinkId: heroLink.id },
    });
  }
  // Suppress no-op lint about unused var
  void heroPurchaserContactId;

  // ── ReminderLogs + ChaseTasks across the active files ───────────────────
  // We want: ≥2 overdue, ≥1 due today, ≥2 coming up (next 3 business days),
  // ≥2 escalated (chaseCount ≥ rule threshold).
  //
  // Strategy: pick a real ReminderRule per (file, target-milestone-code) and
  // create one ReminderLog + matching ChaseTask. The work-queue page reads
  // from ReminderLog.nextDueDate; the chaseTask.chaseCount drives the
  // escalation pill via classifyReminder.
  const activeForReminders = out.fixtures.filter(
    (f) => ["hero", "active_exch_today", "active_stalled", "active_no_fee", "exchange_ready", "exchanged_overdue"].includes(f.key),
  );
  const rules = await prisma.reminderRule.findMany({
    where: { isActive: true, targetMilestoneCode: { not: null } },
    select: { id: true, targetMilestoneCode: true, escalateAfterChases: true },
    take: 12,
  });
  const upcomingCutoff = addBusinessDays(now, 3);

  type ReminderRecipe = { fxKey: TxBucket; ruleIndex: number; nextDueDate: Date; chaseCount: number; priority: "normal" | "escalated" };
  const recipes: ReminderRecipe[] = [
    // 2 overdue
    { fxKey: "active_stalled",      ruleIndex: 0, nextDueDate: daysAgo(6),  chaseCount: 1, priority: "normal" },
    { fxKey: "exchanged_overdue",   ruleIndex: 1, nextDueDate: daysAgo(3),  chaseCount: 2, priority: "normal" },
    // 1 due today
    { fxKey: "active_exch_today",   ruleIndex: 2, nextDueDate: now,          chaseCount: 1, priority: "normal" },
    // 2 coming up
    { fxKey: "hero",                ruleIndex: 3, nextDueDate: addBusinessDays(now, 1), chaseCount: 0, priority: "normal" },
    { fxKey: "active_no_fee",       ruleIndex: 4, nextDueDate: addBusinessDays(now, 2), chaseCount: 0, priority: "normal" },
    // 2 escalated (chaseCount ≥ threshold)
    { fxKey: "active_stalled",      ruleIndex: 5, nextDueDate: daysAgo(10), chaseCount: 5, priority: "escalated" },
    { fxKey: "hero",                ruleIndex: 6, nextDueDate: daysAgo(4),  chaseCount: 4, priority: "escalated" },
  ];

  for (const recipe of recipes) {
    const fixture = activeForReminders.find((f) => f.key === recipe.fxKey);
    if (!fixture) continue;
    const rule = rules[recipe.ruleIndex % rules.length];
    if (!rule) continue;
    const isPurchaserRule = rule.targetMilestoneCode?.startsWith("PM") ?? false;
    const txRow = await prisma.propertyTransaction.findUnique({
      where: { id: fixture.transactionId },
      select: { activeBuyerRoundId: true, assignedUserId: true },
    });
    const log = await prisma.reminderLog.create({
      data: {
        transactionId: fixture.transactionId,
        reminderRuleId: rule.id,
        status: "active",
        nextDueDate: recipe.nextDueDate,
        buyerRoundId: isPurchaserRule ? txRow?.activeBuyerRoundId ?? null : null,
      },
    });
    await prisma.chaseTask.create({
      data: {
        transactionId: fixture.transactionId,
        reminderLogId: log.id,
        assignedToId: txRow?.assignedUserId ?? null,
        dueDate: recipe.nextDueDate,
        status: recipe.nextDueDate < now ? "pending" : "pending",
        priority: recipe.priority,
        chaseCount: recipe.chaseCount,
        lastChasedAt: recipe.chaseCount > 0 ? daysAgo(Math.max(1, Math.round(rule.escalateAfterChases / 2))) : null,
        buyerRoundId: isPurchaserRule ? txRow?.activeBuyerRoundId ?? null : null,
      },
    });
  }
  // Reference unused upcomingCutoff (kept for future cutoff fine-tuning)
  void upcomingCutoff;

  // ── ManualTasks ─────────────────────────────────────────────────────────
  // ≥3 own + 1 agent-request + ≥1 overdue
  const TASKS: { title: string; assigneeIs: "director" | "negotiator"; daysOverdue: number | null; isAgentRequest: boolean; txKey?: TxBucket }[] = [
    { title: "Call Hartwell to chase enquiries reply",     assigneeIs: "director",   daysOverdue: -2, isAgentRequest: false, txKey: "hero" },
    { title: "Update vendor on lender progress",           assigneeIs: "director",   daysOverdue: null, isAgentRequest: false, txKey: "exchanged_next_week" },
    { title: "Order memorandum of sale for Birch Mews",    assigneeIs: "director",   daysOverdue: 5, isAgentRequest: false, txKey: "active_stalled" },
    { title: "Confirm broker handover for Pinnacle file",  assigneeIs: "negotiator", daysOverdue: 1,  isAgentRequest: false, txKey: "active_compl_today" },
    { title: "Vendor asked us to chase searches",          assigneeIs: "negotiator", daysOverdue: -1, isAgentRequest: true,  txKey: "exchange_ready" },
  ];
  for (const t of TASKS) {
    const assigneeId = t.assigneeIs === "director" ? director.id : negotiator.id;
    const dueDate = t.daysOverdue === null ? null : t.daysOverdue >= 0 ? daysAgo(t.daysOverdue) : daysAhead(-t.daysOverdue);
    const txId = t.txKey ? out.fixtures.find((f) => f.key === t.txKey)!.transactionId : null;
    await prisma.manualTask.create({
      data: {
        agencyId: agency.id,
        transactionId: txId,
        title: t.title,
        status: "open",
        assignedToId: assigneeId,
        createdById: assigneeId,
        dueDate,
        isAgentRequest: t.isAgentRequest,
      },
    });
  }

  // ── OutboundEmailQueue ──────────────────────────────────────────────────
  // ≥10 rows mixed across pending / sent(30d) / errored / upcoming(14d).
  const queueFixtures = [
    { tab: "pending" as const,  emailType: "MILESTONE_CONFIRMATION" as const, hours: -1,  fxKey: "hero" as TxBucket,             milestone: "VM5"  },
    { tab: "pending" as const,  emailType: "CLIENT_CHASE" as const,           hours: -3,  fxKey: "hero" as TxBucket,             milestone: "PM5"  },
    { tab: "pending" as const,  emailType: "MILESTONE_CONFIRMATION" as const, hours: -6,  fxKey: "active_exch_today" as TxBucket, milestone: "PM7" },
    { tab: "sent" as const,     emailType: "MILESTONE_CONFIRMATION" as const, days:  3,   fxKey: "hero" as TxBucket,             milestone: "VM3"  },
    { tab: "sent" as const,     emailType: "CLIENT_CHASE" as const,           days:  7,   fxKey: "active_stalled" as TxBucket,   milestone: "PM3" },
    { tab: "sent" as const,     emailType: "MILESTONE_CONFIRMATION" as const, days: 15,   fxKey: "exchanged_this_week" as TxBucket, milestone: "VM19" },
    { tab: "errored" as const,  emailType: "CLIENT_CHASE" as const,           days:  2,   fxKey: "active_no_fee" as TxBucket,    milestone: "PM3", errorMessage: "SendGrid rejected: invalid recipient address" },
    { tab: "errored" as const,  emailType: "MILESTONE_CONFIRMATION" as const, days:  1,   fxKey: "exchanged_overdue" as TxBucket, milestone: "PM26", errorMessage: "Bounced: mailbox does not exist" },
    { tab: "upcoming" as const, emailType: "CLIENT_CHASE" as const,           days:  4,   fxKey: "hero" as TxBucket,             milestone: "PM5"  },
    { tab: "upcoming" as const, emailType: "CLIENT_CHASE" as const,           days:  8,   fxKey: "active_no_fee" as TxBucket,    milestone: "PM3"  },
    { tab: "upcoming" as const, emailType: "MILESTONE_CONFIRMATION" as const, days: 11,   fxKey: "exchange_ready" as TxBucket,   milestone: "PM25" },
  ];

  for (let qi = 0; qi < queueFixtures.length; qi++) {
    const q = queueFixtures[qi];
    const fixture = out.fixtures.find((f) => f.key === q.fxKey);
    if (!fixture) continue;
    const contact = await prisma.contact.findFirst({
      where: { propertyTransactionId: fixture.transactionId, roleType: "purchaser" },
      select: { id: true, email: true },
    });
    if (!contact?.email) continue;
    const scheduledFor = "days" in q
      ? (q.tab === "sent" || q.tab === "errored" ? daysAgo(q.days as number) : daysAhead(q.days as number))
      : new Date(now.getTime() + (q.hours as number) * 3600_000);
    await prisma.outboundEmailQueue.create({
      data: {
        emailType: q.emailType,
        // Per-row index keeps the (emailType, sourceId, recipientContactId)
        // unique-index from blowing up when two demo rows share the same
        // fixture × milestone (e.g. two CLIENT_CHASE entries for hero:PM5).
        sourceId: `${fixture.transactionId}:${q.milestone}:demo${qi}`,
        recipientEmail: contact.email,
        recipientContactId: contact.id,
        payload: {
          subject: q.emailType === "CLIENT_CHASE" ? "Quick update on your sale" : "We've moved your sale forward",
          text: "Demo body — content suppressed in the seed.",
          html: "<p>Demo body — content suppressed in the seed.</p>",
        },
        scheduledFor,
        sentAt: q.tab === "sent" ? scheduledFor : null,
        deliveredAt: q.tab === "sent" ? new Date(scheduledFor.getTime() + 10 * 60_000) : null,
        errorAt: q.tab === "errored" ? scheduledFor : null,
        errorMessage: q.tab === "errored" ? (q as { errorMessage: string }).errorMessage : null,
      },
    });
  }

  return out;
}

// Helper kept here for clarity in the COMPLETION_DATE_DAYS table — converts
// "N business days from today" into a calendar-day offset accepted by
// daysAhead. Returns a calendar-day count.
function addBusinessDaysOffset(n: number): number {
  const target = addBusinessDays(new Date(), n);
  return Math.round((target.getTime() - new Date().getTime()) / ONE_DAY_MS);
}

// ─── Entry point ─────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  assertDemoSafe();
  const prisma = new PrismaClient();
  try {
    console.log("=== DEMO SEED ===");
    console.log("Target DB:", (process.env.DATABASE_URL ?? "").replace(/:[^:@]+@/, ":***@"));
    const manifest = await runSeedDemo(prisma);
    console.log("\nSeed complete.");
    console.log(`  Agency:     ${DEMO_AGENCY_NAME} (${manifest.agencyId})`);
    console.log(`  Director:   ${DEMO_DIRECTOR_EMAIL} / ${DEMO_DIRECTOR_PASSWORD}`);
    console.log(`  Negotiator: ${DEMO_NEGOTIATOR_EMAIL} / ${DEMO_NEGOTIATOR_PASSWORD}`);
    console.log(`  Fixtures:   ${manifest.fixtures.length}`);
    for (const f of manifest.fixtures) {
      console.log(`    - ${f.key.padEnd(22)} ${f.address}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

// Only run when invoked directly (not when imported by reset-demo.ts or by
// the Reset Demo server action).
if (require.main === module) {
  main().catch((err) => {
    console.error("\nSeed failed:", err);
    process.exit(1);
  });
}
