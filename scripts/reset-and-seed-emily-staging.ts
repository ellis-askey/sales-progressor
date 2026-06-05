// Wipe every transaction tied to emily@hartwellpartners.co.uk on STAGING
// and re-seed 34 lived-in files for a marketing screenshot of the hub.
//
// Distribution is tuned for an impressive hub strip:
//   - 34 active files total
//   - ~5 exchanging within 7 days  → drives "Coming up: exchanging this week"
//   - ~13 within 30 days           → "Exchanging soon" stat
//   - mix of prices £350k–£1.5M    → pipeline value north of £20m
//   - 6 reminders due today        → "Needs your attention" + "Need attention" stat
//   - 3 reminders overdue (2–3d)
//   - 1 escalated chase task       → "Need attention" stat goes red
//   - Backdated createdAt + staggered milestone completions so the activity
//     feed and "since last activity" badges look genuinely lived-in.
//
// STAGING ONLY. Aborts if DATABASE_URL points at production.
//
// Run:
//   DATABASE_URL="$(grep '^DATABASE_URL' .env.preview | cut -d'=' -f2- | tr -d '"')" \
//   DIRECT_URL="$(grep '^DIRECT_URL' .env.preview | cut -d'=' -f2- | tr -d '"')" \
//   npx ts-node --compiler-options '{"module":"CommonJS","esModuleInterop":true}' \
//     scripts/reset-and-seed-emily-staging.ts

import { randomBytes } from "node:crypto";
import { prisma } from "../lib/prisma";
import { computeAutoNrCodes } from "../lib/milestone-auto-nr";
import { DIRECT_PREREQUISITES } from "../lib/milestone-prerequisites";

const EMILY_EMAIL = "emily@hartwellpartners.co.uk";
const BURNER_EMAIL = "ellisaskey+marketing@googlemail.com";
const EXCHANGE_GATE_CODES = new Set(["VM18", "PM25"]);

// ── Inlined initializeMilestoneCompletions ─────────────────────────────────
// (the canonical version in lib/services/milestones.ts transitively pulls
// server-only code, so we re-implement the same logic locally)
async function initMilestones(
  transactionId: string,
  tenure: "freehold" | "leasehold",
  purchaseType: "mortgage" | "cash_buyer" | "cash_from_proceeds",
  createdById: string,
) {
  const defs = await prisma.milestoneDefinition.findMany({
    orderBy: [{ side: "asc" }, { orderIndex: "asc" }],
  });
  const autoNrCodes = computeAutoNrCodes(purchaseType, tenure);
  const availableCodes = new Set<string>();
  for (const def of defs) {
    if (autoNrCodes.has(def.code)) continue;
    if (EXCHANGE_GATE_CODES.has(def.code)) continue;
    const prereqs = DIRECT_PREREQUISITES[def.code] ?? [];
    if (prereqs.length === 0 || prereqs.every((p) => autoNrCodes.has(p))) {
      availableCodes.add(def.code);
    }
  }
  const now = new Date();
  await Promise.all(
    defs.map((def) => {
      const isNr = autoNrCodes.has(def.code);
      const isAvail = availableCodes.has(def.code);
      const state = isNr ? "not_required" : isAvail ? "available" : "locked";
      return prisma.milestoneCompletion.upsert({
        where: {
          transactionId_milestoneDefinitionId: { transactionId, milestoneDefinitionId: def.id },
        },
        create: {
          transactionId,
          milestoneDefinitionId: def.id,
          state,
          notRequiredReason: isNr ? "Auto-set at file creation" : null,
          completedById: createdById,
          createdAt: now,
        },
        update: {},
      });
    }),
  );
}

// ── Address book ───────────────────────────────────────────────────────────
// Real Bristol street names across affluent neighbourhoods (Clifton, Cotham,
// Redland, Henleaze, Westbury, Stoke Bishop, Sneyd Park). Postcodes are
// rough-correct for the area so they don't scream "fake" in a screenshot.
const ADDRESSES: Array<{ address: string }> = [
  { address: "12 Whiteladies Road, Clifton, Bristol, BS8 1PD" },
  { address: "47 Apsley Road, Clifton, Bristol, BS8 2SP" },
  { address: "33 Berkeley Square, Clifton, Bristol, BS8 1HP" },
  { address: "8 Henleaze Gardens, Henleaze, Bristol, BS9 4HG" },
  { address: "Flat 4, 19 Cotham Hill, Cotham, Bristol, BS6 6LD" },
  { address: "21 Redland Road, Redland, Bristol, BS6 6AQ" },
  { address: "5 Sneyd Park Lane, Sneyd Park, Bristol, BS9 1QF" },
  { address: "82 Pembroke Road, Clifton, Bristol, BS8 3EB" },
  { address: "14 Westbury Park, Westbury, Bristol, BS9 3AA" },
  { address: "27 Cotham Brow, Cotham, Bristol, BS6 6AR" },
  { address: "Flat 2, 9 Royal York Crescent, Clifton, Bristol, BS8 4JZ" },
  { address: "63 Coldharbour Road, Westbury Park, Bristol, BS6 7JT" },
  { address: "11 Beaufort Road, Clifton, Bristol, BS8 2JZ" },
  { address: "38 Hampton Road, Redland, Bristol, BS6 6JA" },
  { address: "4 Stoke Hill, Stoke Bishop, Bristol, BS9 1JN" },
  { address: "19 Canynge Square, Clifton, Bristol, BS8 3LA" },
  { address: "72 Chesterfield Road, St Andrews, Bristol, BS6 5DS" },
  { address: "Flat 1, 6 Vyvyan Terrace, Clifton, Bristol, BS8 3DF" },
  { address: "55 Northumberland Road, Redland, Bristol, BS6 7BA" },
  { address: "23 Belgrave Road, Clifton, Bristol, BS8 2AB" },
  { address: "9 Saville Place, Clifton, Bristol, BS8 4EJ" },
  { address: "44 Cranbrook Road, Redland, Bristol, BS6 7BS" },
  { address: "16 Sefton Park Road, Bishopston, Bristol, BS7 9AJ" },
  { address: "30 The Avenue, Sneyd Park, Bristol, BS9 1PA" },
  { address: "68 Alma Road, Clifton, Bristol, BS8 2DJ" },
  { address: "Flat 3, 24 Lansdown Road, Clifton, Bristol, BS8 3PT" },
  { address: "7 Burlington Road, Redland, Bristol, BS6 7JE" },
  { address: "41 Eastfield Road, Westbury Park, Bristol, BS6 7DJ" },
  { address: "12 Hurle Crescent, Clifton, Bristol, BS8 2TA" },
  { address: "85 Falcondale Road, Westbury, Bristol, BS9 3JG" },
  { address: "3 The Promenade, Clifton, Bristol, BS8 3NE" },
  { address: "29 Devonshire Road, Westbury Park, Bristol, BS6 7NL" },
  { address: "56 Aberdeen Road, Cotham, Bristol, BS6 6JP" },
  { address: "10 Buckingham Place, Clifton, Bristol, BS8 1LJ" },
];

// Plausible UK vendor / purchaser names for contacts.
const VENDOR_NAMES = [
  "Jonathan Pike", "Catherine & Mark Holloway", "Priya Kapoor", "Margaret Doyle",
  "Richard & Susan Hartley", "Daniel Whitcombe", "Alice Reardon", "Imran Siddiqui",
  "Helen Fairbrother", "Edward Lockhart", "Sarah Pemberton", "Robert & Diane Lacey",
  "Naomi Adeyemi", "Stephen Lawrence", "Felicity Brookes", "James Thirsk",
  "Caroline Dunlop", "Mihir Patel", "Eleanor Ashworth", "Patrick & Nuala Conroy",
  "Vanessa Quigley", "Hugh Wentworth", "Anita Kaur", "Charles Goodwin",
  "Joanna Rivers", "Mark Lindfield", "Beth Calloway", "Tomasz Bielicki",
  "Yvonne Saxby", "Geoffrey Marston", "Lydia Hennessey", "Owen Carmichael",
  "Maria Espinoza", "Brendan Coltrane",
];
const PURCHASER_NAMES = [
  "Olivia Bennett", "Daniel Reyes", "Tom & Sarah Whitfield", "Andrew Lim",
  "Maya Patel", "Chloe Hartley", "Liam Boucher", "Anna Petrov",
  "Joel Aitken", "Sophie Vance", "Mohamed Errami", "Hannah & Dan Greaves",
  "Ben Caldecott", "Tara Mehrotra", "Jacob Lindstrom", "Mei Tanaka",
  "Lucy Whittaker", "Ravi Singh", "Henry & Clara Aldridge", "Phoebe Drake",
  "Marcus Egwu", "Isabel Cortes", "Toby Hargreaves", "Niamh O'Sullivan",
  "Conor Halpenny", "Aisha Mahmood", "Reuben Slater", "Saskia Vermeulen",
  "Adam Crooks", "Greta Lindberg", "Cameron Pollard", "Priya Anand",
  "Jared Thomason", "Charlotte Vidler",
];

// ── Per-file stage profile ─────────────────────────────────────────────────
//
// We build 34 files in 4 cohorts:
//   - "imminent"  ×  5   exchanging in 3–7 days  (drives "exchanging this week")
//   - "soon"      ×  8   exchanging in 8–30 days (rounds out "Exchanging soon")
//   - "mid"       × 12   31–90 days out          (the bulk of the pipeline)
//   - "fresh"     ×  9   just listed, 90+ days   (early stages)
//
// Total: 34.

type Cohort = "imminent" | "soon" | "mid" | "fresh";

type FileSpec = {
  index: number;
  address: string;
  tenure: "freehold" | "leasehold";
  purchaseType: "mortgage" | "cash_buyer";
  priceGBP: number;
  weeksOld: number;
  daysToExchange: number;     // expectedExchangeDate offset from today
  completeCodes: string[];
  cohort: Cohort;
};

// Pre-canned milestone progression sets, named by maturity.
const PROGRESS = {
  veryEarly: ["VM1", "VM2", "PM1", "PM2"],
  earlyMid: ["VM1", "VM2", "VM3", "VM4", "PM1", "PM2", "PM3"],
  mid: ["VM1", "VM2", "VM3", "VM4", "VM5", "PM1", "PM2", "PM3", "PM4"],
  lateMid: [
    "VM1", "VM2", "VM3", "VM4", "VM5", "VM6", "VM7",
    "PM1", "PM2", "PM3", "PM4", "PM7",
  ],
  almostThere: [
    "VM1", "VM2", "VM3", "VM4", "VM5", "VM6", "VM7", "VM10", "VM11", "VM12",
    "PM1", "PM2", "PM3", "PM4", "PM7", "PM8", "PM9", "PM13", "PM14",
  ],
  exchangeReady: [
    "VM1","VM2","VM3","VM4","VM5","VM6","VM7","VM10","VM11","VM12","VM13","VM14","VM15","VM16","VM17",
    "PM1","PM2","PM3","PM4","PM7","PM8","PM9","PM13","PM14","PM15","PM16","PM17","PM18",
  ],
};

const PRICE_BAND = {
  // Pencs lower / higher, used to pick a price within a band.
  budget: [325_000, 475_000],
  mid:    [475_000, 725_000],
  upper:  [725_000, 1_100_000],
  prime:  [1_100_000, 1_550_000],
};

function pickPrice(band: keyof typeof PRICE_BAND, salt: number): number {
  const [lo, hi] = PRICE_BAND[band];
  // Deterministic: don't want re-runs to bounce the pipeline value around.
  const t = ((salt * 9301 + 49297) % 1000) / 1000;
  const raw = Math.floor(lo + t * (hi - lo));
  // Round to nearest 5k for that "agent typed it" feel.
  return Math.round(raw / 5_000) * 5_000;
}

function buildFileSpec(i: number, addr: string): FileSpec {
  // i is 0-based across the full 34-file list. Cohort assignment:
  let cohort: Cohort;
  if (i < 5)       cohort = "imminent";
  else if (i < 13) cohort = "soon";
  else if (i < 25) cohort = "mid";
  else             cohort = "fresh";

  // Defaults; specialised per cohort below.
  let tenure: FileSpec["tenure"] = "freehold";
  let purchaseType: FileSpec["purchaseType"] = "mortgage";
  let priceGBP = 0;
  let weeksOld = 0;
  let daysToExchange = 0;
  let completeCodes: string[] = [];

  // Every 4th file is leasehold to keep the icons varied.
  if (i % 4 === 2) tenure = "leasehold";
  // Cash buyers sprinkled through.
  if (i % 7 === 3) purchaseType = "cash_buyer";

  switch (cohort) {
    case "imminent":
      priceGBP       = pickPrice(i % 2 ? "upper" : "prime", i);
      weeksOld       = 6 + (i % 3);                 // 6–8 weeks old
      daysToExchange = 3 + i;                       // 3, 4, 5, 6, 7 days
      completeCodes  = PROGRESS.exchangeReady;
      break;
    case "soon":
      priceGBP       = pickPrice(i % 2 ? "upper" : "mid", i);
      weeksOld       = 4 + (i % 3);                 // 4–6 weeks old
      daysToExchange = 8 + (i - 5) * 3;             // 8, 11, 14, 17, 20, 23, 26, 29
      completeCodes  = i % 2 === 0 ? PROGRESS.almostThere : PROGRESS.lateMid;
      break;
    case "mid":
      priceGBP       = pickPrice(i % 3 === 0 ? "budget" : "mid", i);
      weeksOld       = 2 + (i % 4);                 // 2–5 weeks old
      daysToExchange = 35 + (i - 13) * 4;           // 35..79
      completeCodes  = i % 2 === 0 ? PROGRESS.mid : PROGRESS.earlyMid;
      break;
    case "fresh":
      priceGBP       = pickPrice(i % 3 === 0 ? "mid" : "budget", i);
      weeksOld       = (i % 2) === 0 ? 1 : 2;       // 1–2 weeks old
      daysToExchange = 95 + (i - 25) * 5;           // far horizon, doesn't count as "soon"
      completeCodes  = PROGRESS.veryEarly;
      break;
  }

  return {
    index: i,
    address: addr,
    tenure,
    purchaseType,
    priceGBP,
    weeksOld,
    daysToExchange,
    completeCodes,
    cohort,
  };
}

function newPortalToken(): string {
  return randomBytes(24).toString("base64url");
}

function daysAgo(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

function daysAhead(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

async function main() {
  if (process.env.DATABASE_URL?.includes("gmkfustgwipgihpmpjpr")) {
    throw new Error("ABORT: DATABASE_URL points at production. Staging only.");
  }

  console.log("\n=== Reset + seed Emily (staging) ===");
  console.log("Target DB:", process.env.DATABASE_URL?.replace(/:[^:@]+@/, ":***@"));

  const emily = await prisma.user.findUnique({
    where: { email: EMILY_EMAIL },
    select: { id: true, name: true, role: true, agencyId: true, firmName: true },
  });
  if (!emily) throw new Error(`No user ${EMILY_EMAIL} on staging`);
  if (!emily.agencyId) throw new Error(`User ${EMILY_EMAIL} has no agencyId`);
  console.log(`\nEmily: ${emily.name} [${emily.id}]`);

  // ── 1. Wipe ──────────────────────────────────────────────────────────────
  const owned = await prisma.propertyTransaction.findMany({
    where: { agentUserId: emily.id },
    select: { id: true },
  });
  const txIds = owned.map((t) => t.id);
  console.log(`\nFound ${txIds.length} files to delete.`);
  if (txIds.length) {
    await prisma.chainLink.updateMany({
      where: { transactionId: { in: txIds } },
      data: { transactionId: null },
    });
    await prisma.propertyTransaction.updateMany({
      where: { id: { in: txIds } },
      data: { chainLinkId: null },
    });
    const result = await prisma.propertyTransaction.deleteMany({
      where: { id: { in: txIds } },
    });
    console.log(`✓ Deleted ${result.count} transactions (cascades cleared children).`);
  }

  // ── 2. Pick a reminder rule to hang ReminderLogs off ────────────────────
  const reminderRule = await prisma.reminderRule.findFirst({
    where: { isActive: true },
    select: { id: true, name: true },
  });
  if (!reminderRule) throw new Error("No active ReminderRule on staging — cannot seed reminders.");
  console.log(`Using reminder rule: ${reminderRule.name} [${reminderRule.id}]`);

  // ── 3. Load milestone defs ───────────────────────────────────────────────
  const defs = await prisma.milestoneDefinition.findMany({
    select: { id: true, code: true },
  });
  const idByCode = new Map(defs.map((d) => [d.code, d.id]));

  // ── 4. Build specs + seed ────────────────────────────────────────────────
  if (ADDRESSES.length < 34) throw new Error("Need at least 34 addresses");
  const specs = ADDRESSES.slice(0, 34).map((a, i) => buildFileSpec(i, a.address));

  console.log(`\nSeeding ${specs.length} files...`);
  let totalPipelineGBP = 0;
  const seededTxIds: string[] = [];

  for (const f of specs) {
    const createdAt = daysAgo(f.weeksOld * 7);
    const expectedExchangeDate = daysAhead(f.daysToExchange);

    const tx = await prisma.propertyTransaction.create({
      data: {
        propertyAddress:      f.address,
        agencyId:             emily.agencyId!,
        agentUserId:          emily.id,
        progressedBy:         "agent",
        serviceType:          "self_managed",
        status:               "active",
        tenure:               f.tenure,
        purchaseType:         f.purchaseType,
        purchasePrice:        f.priceGBP * 100,
        expectedExchangeDate,
        createdAt,
        lastActivityAt:       daysAgo(Math.max(0, f.index % 4)),
      },
      select: { id: true },
    });
    seededTxIds.push(tx.id);
    totalPipelineGBP += f.priceGBP;

    await prisma.contact.createMany({
      data: [
        {
          propertyTransactionId: tx.id,
          name:                  VENDOR_NAMES[f.index % VENDOR_NAMES.length],
          email:                 BURNER_EMAIL,
          roleType:              "vendor",
          portalToken:           newPortalToken(),
        },
        {
          propertyTransactionId: tx.id,
          name:                  PURCHASER_NAMES[f.index % PURCHASER_NAMES.length],
          email:                 BURNER_EMAIL,
          roleType:              "purchaser",
          portalToken:           newPortalToken(),
        },
      ],
    });

    await initMilestones(tx.id, f.tenure, f.purchaseType, emily.id);

    const N = f.completeCodes.length;
    const totalSpanDays = Math.max(1, f.weeksOld * 7 - 2);
    for (let i = 0; i < N; i++) {
      const code = f.completeCodes[i];
      const defId = idByCode.get(code);
      if (!defId) continue;
      const offsetDays = 1 + Math.floor((i / Math.max(1, N - 1)) * totalSpanDays);
      const completedAt = new Date(createdAt);
      completedAt.setDate(completedAt.getDate() + offsetDays);
      await prisma.milestoneCompletion.updateMany({
        where: { transactionId: tx.id, milestoneDefinitionId: defId },
        data: { state: "complete", completedAt, completedById: emily.id },
      });
    }
  }
  console.log(`✓ ${specs.length} files seeded — pipeline value £${(totalPipelineGBP / 1_000_000).toFixed(2)}m`);

  // ── 5. Seed ReminderLog rows for "Needs your attention" ─────────────────
  // 6 due today + 3 overdue (2–4 days) + 1 escalated.
  // Pick files from the mid / soon cohorts so the marketing screenshot
  // shows realistic addresses next to each reminder.
  const reminderTargets = [
    { offset: -3, escalated: false }, // overdue 3d
    { offset: -2, escalated: false }, // overdue 2d
    { offset: -1, escalated: false }, // overdue 1d
    { offset:  0, escalated: false }, // due today
    { offset:  0, escalated: false },
    { offset:  0, escalated: false },
    { offset:  0, escalated: false },
    { offset:  0, escalated: false },
    { offset:  0, escalated: false },
    { offset: -4, escalated: true  }, // escalated → red "Need attention" stat
  ];

  console.log(`\nSeeding ${reminderTargets.length} reminders (today/overdue + 1 escalated)...`);
  for (let i = 0; i < reminderTargets.length; i++) {
    const t = reminderTargets[i];
    const txId = seededTxIds[(i + 6) % seededTxIds.length]; // distribute across files
    const nextDueDate = daysAgo(-t.offset); // negative offset = future, positive = past

    const log = await prisma.reminderLog.create({
      data: {
        transactionId:  txId,
        reminderRuleId: reminderRule.id,
        status:         "active",
        nextDueDate,
      },
      select: { id: true },
    });

    if (t.escalated) {
      await prisma.chaseTask.create({
        data: {
          transactionId: txId,
          reminderLogId: log.id,
          dueDate:       nextDueDate,
          status:        "pending",
          priority:      "escalated",
          chaseCount:    3,
        },
      });
    }
  }
  console.log(`✓ Reminders seeded.`);

  console.log("\n=== Done ===");
  console.log(`Login: ${EMILY_EMAIL} / password`);
  console.log(`Total active files: ${specs.length}`);
  console.log(`Pipeline value:     £${(totalPipelineGBP / 1_000_000).toFixed(2)}m`);
  console.log(`Exchanging ≤7d:     ${specs.filter((f) => f.daysToExchange <= 7).length}`);
  console.log(`Exchanging ≤30d:    ${specs.filter((f) => f.daysToExchange <= 30).length}`);
  console.log(`Reminders due/overdue: ${reminderTargets.length}`);
  console.log(`Escalated chase tasks: ${reminderTargets.filter((t) => t.escalated).length}\n`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
