// prisma/seed-help-library.ts
//
// Idempotent seeder for the help library screenshot infrastructure.
// Creates Hartwell Estates agency + canonical test data for Playwright captures.
//
// Run with:  npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seed-help-library.ts
// Or via:    npm run db:seed-help-library
//
// Safe to run multiple times — upserts/skips existing data; never touches
// the existing Hartwell & Partners agency or any other agency.

import "dotenv/config";
import { PrismaClient, UserRole, MilestoneState } from "@prisma/client";
import { hashSync } from "bcryptjs";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();

// ── Known constants (capture script reads these) ───────────────────────────────

const AGENCY_NAME          = "Hartwell Estates";
const TOM_EMAIL            = "tom@hartwellestates.co.uk";
const TOM_PASSWORD         = "HelpLibrary2026!";
const OLIVIA_EMAIL         = "olivia@hartwellestates.co.uk";
const MARCUS_EMAIL         = "marcus@hartwellestates.co.uk";
const EMMA_EMAIL           = "emma@hartwellestates.co.uk";

// Deterministic tokens so capture script can hardcode URLs
const SARAH_PORTAL_TOKEN   = "hlss-sarah-mitchell-buyer-portal";
const JAMES_PORTAL_TOKEN   = "hlss-james-patel-seller-portal";
const DIR_INVITE_TOKEN     = "hlss-director-invitation-token";
const MARCUS_NEG_TOKEN     = "hlss-marcus-webb-neg-invitation";

// ── Milestone predecessor graph (from MILESTONES_SPEC_v1.md) ──────────────────

const DIRECT_PREREQUISITES: Record<string, string[]> = {
  VM3:  ["VM1"],
  VM4:  ["VM3"],
  VM5:  ["VM4"],
  VM6:  ["VM5"],
  VM7:  ["VM6"],
  VM9:  ["VM8"],
  VM10: ["VM7"],
  VM11: ["VM10"],
  VM12: ["VM11"],
  VM13: ["VM10"],
  VM14: ["VM13"],
  VM15: ["VM14"],
  VM16: ["VM7"],
  VM17: ["VM16"],
  VM19: ["VM18"],
  VM20: ["VM19"],
  PM3:  ["PM1"],
  PM4:  ["PM1"],
  PM6:  ["PM5"],
  PM7:  ["PM4"],
  PM8:  ["PM7"],
  PM10: ["PM9"],
  PM11: ["PM6"],
  PM12: ["VM9"],  // cross-side
  PM13: ["PM8"],
  PM14: ["PM7"],
  PM15: ["PM14"],
  PM16: ["PM15"],
  PM17: ["PM14"],
  PM18: ["PM17"],
  PM19: ["PM18"],
  PM20: ["PM19"],
  PM21: ["PM20"],
  PM22: ["PM21"],
  PM23: ["PM22"],
  PM24: ["PM23"],
  PM26: ["PM25"],
  PM27: ["PM26"],
};

const EXCHANGE_GATES = new Set(["VM18", "PM25"]);

// ── State computation ──────────────────────────────────────────────────────────

function computeStates(
  allCodes: string[],
  completedSet: Set<string>,
  autoNrSet: Set<string>
): Map<string, MilestoneState> {
  const resolved = new Set([...completedSet, ...autoNrSet]);
  const result = new Map<string, MilestoneState>();

  for (const code of allCodes) {
    if (completedSet.has(code)) {
      result.set(code, MilestoneState.complete);
    } else if (autoNrSet.has(code)) {
      result.set(code, MilestoneState.not_required);
    } else if (EXCHANGE_GATES.has(code)) {
      result.set(code, MilestoneState.locked);
    } else {
      const prereqs = DIRECT_PREREQUISITES[code] ?? [];
      const available = prereqs.length === 0 || prereqs.every((p) => resolved.has(p));
      result.set(code, available ? MilestoneState.available : MilestoneState.locked);
    }
  }

  return result;
}

function getAutoNrCodes(tenure: string, purchaseType: string): Set<string> {
  const codes = new Set<string>();
  if (tenure === "freehold") {
    codes.add("VM8");
    codes.add("VM9");
    codes.add("PM12");
  }
  if (purchaseType === "cash_buyer" || purchaseType === "cash_from_proceeds") {
    codes.add("PM5");
    codes.add("PM6");
    codes.add("PM11");
  }
  return codes;
}

// ── Seed milestone completions for a transaction ───────────────────────────────

async function seedMilestones(
  txId: string,
  tenure: string,
  purchaseType: string,
  completedCodes: string[],
  completedAt: Date,
  completedById: string
): Promise<void> {
  const defs = await prisma.milestoneDefinition.findMany({
    orderBy: [{ side: "asc" }, { orderIndex: "asc" }],
  });

  if (defs.length === 0) {
    console.warn(
      "⚠️  No MilestoneDefinitions found. Run the main seed first: npm run db:seed"
    );
    return;
  }

  const allCodes = defs.map((d) => d.code);
  const autoNrSet = getAutoNrCodes(tenure, purchaseType);
  const completedSet = new Set(completedCodes);
  const states = computeStates(allCodes, completedSet, autoNrSet);

  await Promise.all(
    defs.map((def) => {
      const state = states.get(def.code) ?? MilestoneState.locked;
      const isComplete = state === MilestoneState.complete;
      const isNr = state === MilestoneState.not_required;

      return prisma.milestoneCompletion.upsert({
        where: {
          transactionId_milestoneDefinitionId: {
            transactionId: txId,
            milestoneDefinitionId: def.id,
          },
        },
        create: {
          transactionId: txId,
          milestoneDefinitionId: def.id,
          state,
          completedAt: isComplete ? completedAt : null,
          notRequiredReason: isNr ? "Auto-set at file creation" : null,
          completedById: isComplete ? completedById : null,
        },
        update: {},
      });
    })
  );
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  const now = new Date();
  const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000);
  const daysAhead = (n: number) => new Date(now.getTime() + n * 86_400_000);

  console.log("🌱 Seeding help library data for Hartwell Estates...\n");

  // ── Agency ─────────────────────────────────────────────────────────────────

  let agency = await prisma.agency.findFirst({ where: { name: AGENCY_NAME } });
  if (!agency) {
    agency = await prisma.agency.create({
      data: { name: AGENCY_NAME, signupAt: daysAgo(45) },
    });
    console.log(`✓ Created agency: ${AGENCY_NAME}`);
  } else {
    console.log(`→ Agency already exists: ${AGENCY_NAME}`);
  }

  const agencyId = agency.id;

  // ── Director: Tom Hartwell ─────────────────────────────────────────────────

  const hashedPw = hashSync(TOM_PASSWORD, 10);

  let tom = await prisma.user.findUnique({ where: { email: TOM_EMAIL } });
  if (!tom) {
    tom = await prisma.user.create({
      data: {
        name: "Tom Hartwell",
        email: TOM_EMAIL,
        password: hashedPw,
        role: UserRole.director,
        agencyId,
        firmName: AGENCY_NAME,
        hasSeenAgentWelcome: true,
      },
    });
    console.log("✓ Created director: Tom Hartwell");
  } else {
    // Ensure welcome modal is suppressed on re-runs
    tom = await prisma.user.update({
      where: { id: tom.id },
      data: { hasSeenAgentWelcome: true },
    });
    console.log("→ Tom Hartwell already exists");
  }

  // ── Negotiator: Olivia Chen (accepted) ─────────────────────────────────────

  let olivia = await prisma.user.findUnique({ where: { email: OLIVIA_EMAIL } });
  if (!olivia) {
    olivia = await prisma.user.create({
      data: {
        name: "Olivia Chen",
        email: OLIVIA_EMAIL,
        password: hashedPw,
        role: UserRole.negotiator,
        agencyId,
        firmName: AGENCY_NAME,
        canViewAllFiles: false,
      },
    });

    const existingInv = await prisma.negotiatorInvitation.findUnique({
      where: { token: MARCUS_NEG_TOKEN + "-olivia" },
    });
    if (!existingInv) {
      await prisma.negotiatorInvitation.create({
        data: {
          agencyId,
          invitedByUserId: tom.id,
          negotiatorName: "Olivia Chen",
          negotiatorEmail: OLIVIA_EMAIL,
          token: MARCUS_NEG_TOKEN + "-olivia",
          expiresAt: daysAhead(365),
          acceptedAt: daysAgo(30),
          acceptedByUserId: olivia.id,
        },
      });
    }
    console.log("✓ Created negotiator: Olivia Chen (accepted)");
  } else {
    console.log("→ Olivia Chen already exists");
  }

  // ── Negotiator: Marcus Webb (invitation pending) ───────────────────────────

  let marcus = await prisma.user.findUnique({ where: { email: MARCUS_EMAIL } });
  if (!marcus) {
    marcus = await prisma.user.create({
      data: {
        name: "Marcus Webb",
        email: MARCUS_EMAIL,
        password: null,
        role: UserRole.negotiator,
        agencyId,
        firmName: AGENCY_NAME,
      },
    });

    const existingInv = await prisma.negotiatorInvitation.findUnique({
      where: { token: MARCUS_NEG_TOKEN },
    });
    if (!existingInv) {
      await prisma.negotiatorInvitation.create({
        data: {
          agencyId,
          invitedByUserId: tom.id,
          negotiatorName: "Marcus Webb",
          negotiatorEmail: MARCUS_EMAIL,
          token: MARCUS_NEG_TOKEN,
          expiresAt: daysAhead(7),
        },
      });
    }
    console.log("✓ Created negotiator: Marcus Webb (pending invitation)");
  } else {
    console.log("→ Marcus Webb already exists");
  }

  // ── Negotiator: Emma Hayes (empty hub capture user — zero transactions) ──────

  let emma = await prisma.user.findUnique({ where: { email: EMMA_EMAIL } });
  if (!emma) {
    emma = await prisma.user.create({
      data: {
        name: "Emma Hayes",
        email: EMMA_EMAIL,
        password: hashedPw,
        role: UserRole.negotiator,
        agencyId,
        firmName: AGENCY_NAME,
        hasSeenAgentWelcome: true,
      },
    });
    console.log("✓ Created negotiator: Emma Hayes (empty hub user)");
  } else {
    emma = await prisma.user.update({
      where: { id: emma.id },
      data: { hasSeenAgentWelcome: true },
    });
    console.log("→ Emma Hayes already exists");
  }

  // ── DirectorInvitation (for director-invitation-banner screenshot) ─────────

  const existingDirInv = await prisma.directorInvitation.findUnique({
    where: { token: DIR_INVITE_TOKEN },
  });
  if (!existingDirInv) {
    await prisma.directorInvitation.create({
      data: {
        agencyId,
        invitedByUserId: olivia.id,
        directorName: "David Hartwell",
        directorEmail: "david@hartwellestates.co.uk",
        token: DIR_INVITE_TOKEN,
        expiresAt: daysAhead(7),
      },
    });
    console.log("✓ Created director invitation (for screenshot)");
  }

  // ── Solicitor firms ────────────────────────────────────────────────────────

  async function findOrCreateFirm(name: string) {
    const existing = await prisma.solicitorFirm.findFirst({ where: { name } });
    if (existing) return existing;
    return prisma.solicitorFirm.create({ data: { name } });
  }

  const firmThornton = await findOrCreateFirm("Thornton & Co Solicitors");
  const firmDevlin   = await findOrCreateFirm("Devlin Law LLP");
  const firmBramley  = await findOrCreateFirm("Bramley & Associates");
  const firmKingsley = await findOrCreateFirm("Kingsley Napley Property");

  console.log("✓ Solicitor firms ready");

  // ── Property files ─────────────────────────────────────────────────────────

  async function findOrCreateTx(
    address: string,
    data: Parameters<typeof prisma.propertyTransaction.create>[0]["data"]
  ) {
    const existing = await prisma.propertyTransaction.findFirst({
      where: { agencyId, propertyAddress: address },
    });
    if (existing) return { tx: existing, created: false };
    const tx = await prisma.propertyTransaction.create({ data });
    return { tx, created: true };
  }

  // ── 1. 22 Birchwood Lane — canonical featured file ─────────────────────────

  const { tx: birchwood, created: birchwoodNew } = await findOrCreateTx(
    "22 Birchwood Lane, Weybridge, Surrey KT13 8PQ",
    {
      propertyAddress: "22 Birchwood Lane, Weybridge, Surrey KT13 8PQ",
      agencyId,
      agentUserId: tom.id,
      progressedBy: "agent",
      serviceType: "self_managed",
      status: "active",
      tenure: "freehold",
      purchaseType: "mortgage",
      purchasePrice: 52500000, // £525,000 in pence
      expectedExchangeDate: daysAhead(42),
      lastActivityAt: daysAgo(2),
      vendorSolicitorFirmId: firmThornton.id,
      purchaserSolicitorFirmId: firmDevlin.id,
    }
  );

  if (birchwoodNew) {
    // Contacts
    await prisma.contact.createMany({
      data: [
        {
          propertyTransactionId: birchwood.id,
          name: "James Patel",
          email: "james.patel@email.co.uk",
          phone: "07700 900123",
          roleType: "vendor",
          portalToken: JAMES_PORTAL_TOKEN,
        },
        {
          propertyTransactionId: birchwood.id,
          name: "Sarah Mitchell",
          email: "sarah.mitchell@email.co.uk",
          phone: "07700 900456",
          roleType: "purchaser",
          portalToken: SARAH_PORTAL_TOKEN,
        },
      ],
    });

    await seedMilestones(
      birchwood.id,
      "freehold",
      "mortgage",
      ["VM1","VM2","VM3","VM4","VM5","VM6","VM7", "PM1","PM2","PM3","PM4","PM7"],
      daysAgo(2),
      tom.id
    );

    console.log("✓ 22 Birchwood Lane (canonical, ~38%)");
  } else {
    console.log("→ 22 Birchwood Lane already exists");
  }

  // ── 2. 7 Oak Avenue — stalled (no activity 20 days) ───────────────────────

  const { tx: oakAve, created: oakNew } = await findOrCreateTx(
    "7 Oak Avenue, Richmond, Surrey TW10 6QR",
    {
      propertyAddress: "7 Oak Avenue, Richmond, Surrey TW10 6QR",
      agencyId,
      agentUserId: olivia.id,
      progressedBy: "agent",
      serviceType: "self_managed",
      status: "active",
      tenure: "freehold",
      purchaseType: "mortgage",
      purchasePrice: 48000000,
      expectedExchangeDate: daysAhead(35),
      lastActivityAt: daysAgo(21),
      vendorSolicitorFirmId: firmBramley.id,
      purchaserSolicitorFirmId: firmThornton.id,
    }
  );

  if (oakNew) {
    await prisma.contact.createMany({
      data: [
        { propertyTransactionId: oakAve.id, name: "Helen Ross", email: "helen.ross@email.co.uk", roleType: "vendor" },
        { propertyTransactionId: oakAve.id, name: "Daniel Clarke", email: "d.clarke@email.co.uk", roleType: "purchaser" },
      ],
    });

    await seedMilestones(
      oakAve.id, "freehold", "mortgage",
      ["VM1","VM2","PM1","PM2"],
      daysAgo(21), // all completions older than 14 days → stalled
      olivia.id
    );
    console.log("✓ 7 Oak Avenue (stalled, 20 days inactive)");
  } else {
    console.log("→ 7 Oak Avenue already exists");
  }

  // ── 3. 14 Maple Grove — leasehold, mortgage, ~65% ─────────────────────────

  const { tx: mapleGrove, created: mapleNew } = await findOrCreateTx(
    "14 Maple Grove, Kingston upon Thames KT2 5LN",
    {
      propertyAddress: "14 Maple Grove, Kingston upon Thames KT2 5LN",
      agencyId,
      agentUserId: tom.id,
      progressedBy: "agent",
      serviceType: "self_managed",
      status: "active",
      tenure: "leasehold",
      purchaseType: "mortgage",
      purchasePrice: 38500000,
      expectedExchangeDate: daysAhead(28),
      lastActivityAt: daysAgo(4),
      vendorSolicitorFirmId: firmKingsley.id,
      purchaserSolicitorFirmId: firmDevlin.id,
    }
  );

  if (mapleNew) {
    await prisma.contact.createMany({
      data: [
        { propertyTransactionId: mapleGrove.id, name: "Patricia Wong", email: "p.wong@email.co.uk", roleType: "vendor" },
        { propertyTransactionId: mapleGrove.id, name: "Richard Osei", email: "r.osei@email.co.uk", roleType: "purchaser" },
      ],
    });

    await seedMilestones(
      mapleGrove.id, "leasehold", "mortgage",
      ["VM1","VM2","VM3","VM4","VM5","VM6","VM7","VM8","VM9",
       "PM1","PM2","PM3","PM4","PM5","PM6","PM7","PM8","PM9","PM10","PM11"],
      daysAgo(5), tom.id
    );
    console.log("✓ 14 Maple Grove (leasehold, ~65%)");
  } else {
    console.log("→ 14 Maple Grove already exists");
  }

  // ── 4. 3 Elm Street — freehold, cash, ~85% ────────────────────────────────

  const { tx: elmSt, created: elmNew } = await findOrCreateTx(
    "3 Elm Street, Surbiton, Surrey KT6 4NJ",
    {
      propertyAddress: "3 Elm Street, Surbiton, Surrey KT6 4NJ",
      agencyId,
      agentUserId: tom.id,
      progressedBy: "agent",
      serviceType: "self_managed",
      status: "active",
      tenure: "freehold",
      purchaseType: "cash_buyer",
      purchasePrice: 72000000,
      expectedExchangeDate: daysAhead(18),
      lastActivityAt: daysAgo(1),
      vendorSolicitorFirmId: firmThornton.id,
      purchaserSolicitorFirmId: firmBramley.id,
    }
  );

  if (elmNew) {
    await prisma.contact.createMany({
      data: [
        { propertyTransactionId: elmSt.id, name: "Gerald Whitmore", email: "g.whitmore@email.co.uk", roleType: "vendor" },
        { propertyTransactionId: elmSt.id, name: "Ananya Shah", email: "a.shah@email.co.uk", roleType: "purchaser" },
      ],
    });

    await seedMilestones(
      elmSt.id, "freehold", "cash_buyer",
      ["VM1","VM2","VM3","VM4","VM5","VM6","VM7","VM10","VM11","VM12","VM13","VM14","VM15","VM16","VM17",
       "PM1","PM2","PM3","PM4","PM7","PM8","PM9","PM10","PM13","PM14","PM15","PM16","PM17","PM18","PM19","PM20"],
      daysAgo(1), tom.id
    );
    console.log("✓ 3 Elm Street (cash, ~85%)");
  } else {
    console.log("→ 3 Elm Street already exists");
  }

  // ── 5. 9 Cedar Close — exchange in 15 days ────────────────────────────────

  const { tx: cedar, created: cedarNew } = await findOrCreateTx(
    "9 Cedar Close, New Malden, Surrey KT3 5QP",
    {
      propertyAddress: "9 Cedar Close, New Malden, Surrey KT3 5QP",
      agencyId,
      agentUserId: olivia.id,
      progressedBy: "agent",
      serviceType: "self_managed",
      status: "active",
      tenure: "freehold",
      purchaseType: "mortgage",
      purchasePrice: 56000000,
      expectedExchangeDate: daysAhead(15),
      lastActivityAt: daysAgo(1),
      vendorSolicitorFirmId: firmDevlin.id,
      purchaserSolicitorFirmId: firmKingsley.id,
    }
  );

  if (cedarNew) {
    await prisma.contact.createMany({
      data: [
        { propertyTransactionId: cedar.id, name: "Fiona Lawson", email: "f.lawson@email.co.uk", roleType: "vendor" },
        { propertyTransactionId: cedar.id, name: "Marcus Green", email: "m.green@email.co.uk", roleType: "purchaser" },
      ],
    });

    await seedMilestones(
      cedar.id, "freehold", "mortgage",
      ["VM1","VM2","VM3","VM4","VM5","VM6","VM7","VM10","VM11","VM12","VM13","VM14","VM15","VM16","VM17",
       "PM1","PM2","PM3","PM4","PM5","PM6","PM7","PM8","PM9","PM10","PM11","PM13","PM14","PM15","PM16","PM17","PM18","PM19","PM20","PM21","PM22","PM23","PM24"],
      daysAgo(2), olivia.id
    );
    console.log("✓ 9 Cedar Close (exchange in 15 days, ~93%)");
  } else {
    console.log("→ 9 Cedar Close already exists");
  }

  // ── 6. 28 Pine Road — exchange in 25 days ─────────────────────────────────

  const { tx: pine, created: pineNew } = await findOrCreateTx(
    "28 Pine Road, Wimbledon, London SW19 3AR",
    {
      propertyAddress: "28 Pine Road, Wimbledon, London SW19 3AR",
      agencyId,
      agentUserId: tom.id,
      progressedBy: "agent",
      serviceType: "self_managed",
      status: "active",
      tenure: "freehold",
      purchaseType: "mortgage",
      purchasePrice: 89000000,
      expectedExchangeDate: daysAhead(25),
      lastActivityAt: daysAgo(3),
      vendorSolicitorFirmId: firmBramley.id,
      purchaserSolicitorFirmId: firmThornton.id,
    }
  );

  if (pineNew) {
    await prisma.contact.createMany({
      data: [
        { propertyTransactionId: pine.id, name: "Oliver Sharma", email: "o.sharma@email.co.uk", roleType: "vendor" },
        { propertyTransactionId: pine.id, name: "Claire Nkosi", email: "c.nkosi@email.co.uk", roleType: "purchaser" },
      ],
    });

    await seedMilestones(
      pine.id, "freehold", "mortgage",
      ["VM1","VM2","VM3","VM4","VM5","VM6","VM7","VM10","VM11","VM12","VM13","VM14","VM15","VM16","VM17",
       "PM1","PM2","PM3","PM4","PM5","PM6","PM7","PM8","PM9","PM10","PM11","PM13","PM14","PM15","PM16","PM17","PM18","PM19","PM20","PM21","PM22"],
      daysAgo(3), tom.id
    );
    console.log("✓ 28 Pine Road (exchange in 25 days, ~88%)");
  } else {
    console.log("→ 28 Pine Road already exists");
  }

  // ── 7. 45 Beech Lane — leasehold, cash_from_proceeds, ~50% ───────────────

  const { tx: beech, created: beechNew } = await findOrCreateTx(
    "45 Beech Lane, Twickenham, Middlesex TW1 2GS",
    {
      propertyAddress: "45 Beech Lane, Twickenham, Middlesex TW1 2GS",
      agencyId,
      agentUserId: tom.id,
      progressedBy: "agent",
      serviceType: "self_managed",
      status: "active",
      tenure: "leasehold",
      purchaseType: "cash_from_proceeds",
      purchasePrice: 43500000,
      expectedExchangeDate: daysAhead(40),
      lastActivityAt: daysAgo(6),
      vendorSolicitorFirmId: firmKingsley.id,
      purchaserSolicitorFirmId: firmDevlin.id,
    }
  );

  if (beechNew) {
    await prisma.contact.createMany({
      data: [
        { propertyTransactionId: beech.id, name: "Evelyn Cross", email: "e.cross@email.co.uk", roleType: "vendor" },
        { propertyTransactionId: beech.id, name: "David Park", email: "d.park@email.co.uk", roleType: "purchaser" },
      ],
    });

    await seedMilestones(
      beech.id, "leasehold", "cash_from_proceeds",
      ["VM1","VM2","VM3","VM4","VM5","VM6","VM7","VM8","VM9",
       "PM1","PM2","PM3","PM4","PM7","PM8"],
      daysAgo(6), tom.id
    );
    console.log("✓ 45 Beech Lane (leasehold, cash-from-proceeds, ~50%)");
  } else {
    console.log("→ 45 Beech Lane already exists");
  }

  // ── 8. 12 Chestnut Way — completed ────────────────────────────────────────

  const { tx: chestnut, created: chestnutNew } = await findOrCreateTx(
    "12 Chestnut Way, Esher, Surrey KT10 9BW",
    {
      propertyAddress: "12 Chestnut Way, Esher, Surrey KT10 9BW",
      agencyId,
      agentUserId: tom.id,
      progressedBy: "agent",
      serviceType: "self_managed",
      status: "completed",
      tenure: "freehold",
      purchaseType: "mortgage",
      purchasePrice: 67500000,
      expectedExchangeDate: daysAgo(35),
      completionDate: daysAgo(21),
      lastActivityAt: daysAgo(21),
      vendorSolicitorFirmId: firmThornton.id,
      purchaserSolicitorFirmId: firmBramley.id,
    }
  );

  if (chestnutNew) {
    await prisma.contact.createMany({
      data: [
        { propertyTransactionId: chestnut.id, name: "Robert Hughes", email: "r.hughes@email.co.uk", roleType: "vendor" },
        { propertyTransactionId: chestnut.id, name: "Priya Mehta", email: "p.mehta@email.co.uk", roleType: "purchaser" },
      ],
    });

    // All milestones complete (exchange gates included for completed file)
    await seedMilestones(
      chestnut.id, "freehold", "mortgage",
      ["VM1","VM2","VM3","VM4","VM5","VM6","VM7","VM10","VM11","VM12","VM13","VM14","VM15","VM16","VM17","VM18","VM19","VM20",
       "PM1","PM2","PM3","PM4","PM5","PM6","PM7","PM8","PM9","PM10","PM11","PM13","PM14","PM15","PM16","PM17","PM18","PM19","PM20","PM21","PM22","PM23","PM24","PM25","PM26","PM27"],
      daysAgo(21), tom.id
    );
    console.log("✓ 12 Chestnut Way (completed, 3 weeks ago)");
  } else {
    console.log("→ 12 Chestnut Way already exists");
  }

  // ── 9. 6 Willow Drive — ~20%, freehold, mortgage ──────────────────────────

  const { tx: willow, created: willowNew } = await findOrCreateTx(
    "6 Willow Drive, Hampton, Middlesex TW12 3LQ",
    {
      propertyAddress: "6 Willow Drive, Hampton, Middlesex TW12 3LQ",
      agencyId,
      agentUserId: olivia.id,
      progressedBy: "agent",
      serviceType: "self_managed",
      status: "active",
      tenure: "freehold",
      purchaseType: "mortgage",
      purchasePrice: 32000000,
      expectedExchangeDate: daysAhead(70),
      lastActivityAt: daysAgo(8),
      vendorSolicitorFirmId: firmDevlin.id,
      purchaserSolicitorFirmId: firmKingsley.id,
    }
  );

  if (willowNew) {
    await prisma.contact.createMany({
      data: [
        { propertyTransactionId: willow.id, name: "Sandra Bell", email: "s.bell@email.co.uk", roleType: "vendor" },
        { propertyTransactionId: willow.id, name: "Jason Obi", email: "j.obi@email.co.uk", roleType: "purchaser" },
      ],
    });

    await seedMilestones(
      willow.id, "freehold", "mortgage",
      ["VM1","VM2","VM3","PM1","PM2","PM3"],
      daysAgo(8), olivia.id
    );
    console.log("✓ 6 Willow Drive (~20%)");
  } else {
    console.log("→ 6 Willow Drive already exists");
  }

  // ── 10. 33 Ash Close — ~70%, freehold, mortgage ───────────────────────────

  const { tx: ash, created: ashNew } = await findOrCreateTx(
    "33 Ash Close, Sunbury-on-Thames, Surrey TW16 7HN",
    {
      propertyAddress: "33 Ash Close, Sunbury-on-Thames, Surrey TW16 7HN",
      agencyId,
      agentUserId: tom.id,
      progressedBy: "agent",
      serviceType: "self_managed",
      status: "active",
      tenure: "freehold",
      purchaseType: "mortgage",
      purchasePrice: 59500000,
      expectedExchangeDate: daysAhead(22),
      lastActivityAt: daysAgo(3),
      vendorSolicitorFirmId: firmThornton.id,
      purchaserSolicitorFirmId: firmDevlin.id,
    }
  );

  if (ashNew) {
    await prisma.contact.createMany({
      data: [
        { propertyTransactionId: ash.id, name: "Miriam Taylor", email: "m.taylor@email.co.uk", roleType: "vendor" },
        { propertyTransactionId: ash.id, name: "Tom Nguyen", email: "t.nguyen@email.co.uk", roleType: "purchaser" },
      ],
    });

    await seedMilestones(
      ash.id, "freehold", "mortgage",
      ["VM1","VM2","VM3","VM4","VM5","VM6","VM7","VM10","VM11","VM12","VM13","VM14",
       "PM1","PM2","PM3","PM4","PM5","PM6","PM7","PM8","PM9","PM10","PM11","PM13","PM14","PM15"],
      daysAgo(3), tom.id
    );
    console.log("✓ 33 Ash Close (~70%)");
  } else {
    console.log("→ 33 Ash Close already exists");
  }

  // ── 11. 19 Poplar Street — ~45%, leasehold, mortgage ─────────────────────

  const { tx: poplar, created: poplarNew } = await findOrCreateTx(
    "19 Poplar Street, West Molesey, Surrey KT8 2QA",
    {
      propertyAddress: "19 Poplar Street, West Molesey, Surrey KT8 2QA",
      agencyId,
      agentUserId: olivia.id,
      progressedBy: "agent",
      serviceType: "self_managed",
      status: "active",
      tenure: "leasehold",
      purchaseType: "mortgage",
      purchasePrice: 29000000,
      expectedExchangeDate: daysAhead(55),
      lastActivityAt: daysAgo(5),
      vendorSolicitorFirmId: firmBramley.id,
      purchaserSolicitorFirmId: firmThornton.id,
    }
  );

  if (poplarNew) {
    await prisma.contact.createMany({
      data: [
        { propertyTransactionId: poplar.id, name: "Alicia Marsh", email: "a.marsh@email.co.uk", roleType: "vendor" },
        { propertyTransactionId: poplar.id, name: "Ben Kowalski", email: "b.kowalski@email.co.uk", roleType: "purchaser" },
      ],
    });

    await seedMilestones(
      poplar.id, "leasehold", "mortgage",
      ["VM1","VM2","VM3","VM4","VM5","VM6","VM7","VM8","VM9","PM1","PM2","PM3","PM4","PM7"],
      daysAgo(5), olivia.id
    );
    console.log("✓ 19 Poplar Street (leasehold, ~45%)");
  } else {
    console.log("→ 19 Poplar Street already exists");
  }

  // ── 12. 55 Sycamore Road — ~30%, freehold, cash ───────────────────────────

  const { tx: sycamore, created: sycamoreNew } = await findOrCreateTx(
    "55 Sycamore Road, Thames Ditton, Surrey KT7 0QW",
    {
      propertyAddress: "55 Sycamore Road, Thames Ditton, Surrey KT7 0QW",
      agencyId,
      agentUserId: tom.id,
      progressedBy: "agent",
      serviceType: "self_managed",
      status: "active",
      tenure: "freehold",
      purchaseType: "cash_buyer",
      purchasePrice: 41500000,
      expectedExchangeDate: daysAhead(50),
      lastActivityAt: daysAgo(7),
      vendorSolicitorFirmId: firmKingsley.id,
      purchaserSolicitorFirmId: firmBramley.id,
    }
  );

  if (sycamoreNew) {
    await prisma.contact.createMany({
      data: [
        { propertyTransactionId: sycamore.id, name: "Caroline Price", email: "c.price@email.co.uk", roleType: "vendor" },
        { propertyTransactionId: sycamore.id, name: "Ibrahim Al-Hassan", email: "i.alhassan@email.co.uk", roleType: "purchaser" },
      ],
    });

    await seedMilestones(
      sycamore.id, "freehold", "cash_buyer",
      ["VM1","VM2","VM3","VM4","VM5","PM1","PM2","PM3","PM4"],
      daysAgo(7), tom.id
    );
    console.log("✓ 55 Sycamore Road (cash, ~30%)");
  } else {
    console.log("→ 55 Sycamore Road already exists");
  }

  // ── Reminder logs (for Reminders page population) ─────────────────────────

  const rules = await prisma.reminderRule.findMany({ take: 5 });
  if (rules.length > 0) {
    const reminderTargets = [
      { txId: birchwood.id, rule: rules[0] },
      { txId: mapleGrove.id, rule: rules[1] ?? rules[0] },
      { txId: willow.id, rule: rules[2] ?? rules[0] },
    ];

    for (const { txId, rule } of reminderTargets) {
      const existing = await prisma.reminderLog.findFirst({
        where: { transactionId: txId, reminderRuleId: rule.id },
      });

      if (!existing) {
        const log = await prisma.reminderLog.create({
          data: {
            transactionId: txId,
            reminderRuleId: rule.id,
            status: "active",
            nextDueDate: daysAgo(2),
          },
        });

        await prisma.chaseTask.create({
          data: {
            transactionId: txId,
            reminderLogId: log.id,
            dueDate: daysAgo(2),
            status: "pending",
            priority: "normal",
            chaseCount: 0,
          },
        });
      }
    }
    console.log("✓ Reminder logs and chase tasks");
  } else {
    console.warn("⚠️  No ReminderRules found — run main seed first for reminders to populate");
  }

  // ── Write seed artifacts for capture script ────────────────────────────────

  const artifacts = {
    agencyId,
    tomId: tom.id,
    oliviaId: olivia.id,
    marcusId: marcus.id,
    emmaId: emma.id,
    emmaEmail: EMMA_EMAIL,
    birchwoodLaneId: birchwood.id,
    sarahPortalToken: SARAH_PORTAL_TOKEN,
    jamesPortalToken: JAMES_PORTAL_TOKEN,
    directorInviteToken: DIR_INVITE_TOKEN,
  };

  const artifactsPath = path.join(
    process.cwd(),
    "scripts",
    "help-screenshots",
    "seed-artifacts.json"
  );
  fs.writeFileSync(artifactsPath, JSON.stringify(artifacts, null, 2));
  console.log(`\n✓ Seed artifacts written to ${artifactsPath}`);

  console.log("\n🎉 Help library seed complete.\n");
  console.log(`   Director login:  ${TOM_EMAIL} / ${TOM_PASSWORD}`);
  console.log(`   Negotiator:      ${EMMA_EMAIL} / ${TOM_PASSWORD}  (empty hub)`);
  console.log(`   Portal (buyer):  http://localhost:3000/portal/${SARAH_PORTAL_TOKEN}`);
  console.log(`   Director invite: http://localhost:3000/invite/${DIR_INVITE_TOKEN}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
