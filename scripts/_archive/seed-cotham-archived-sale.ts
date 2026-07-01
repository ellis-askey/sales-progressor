// Seed content into the Cotham relist fixture's archived sale so
// Ellis can sign off the ArchivedRoundDrawer visually without every
// section falling through to its empty state.
//
// Target:
//   The PropertyTransaction whose address contains "Cotham" and which
//   has at least one withdrawn (archived) BuyerRound. The fixture was
//   created earlier in the relist work — "[Emily relist test] 14
//   Cotham Hill, Cotham, Bristol, BS6 6JR" on staging. The script
//   resolves it dynamically rather than hard-coding the cuid.
//
// What it fills on the ARCHIVED BuyerRound (most recent withdrawn):
//   - fallThroughReason (so the "Why this sale fell through" section
//     shows real copy instead of "No reason recorded.")
//   - purchasePrice (so "Agreed price" renders a £ value)
//   - purchaserSolicitorFirm + contact (so "Buyer's solicitor" renders)
//   - brokerFirm + contact (so "Buyer's broker" renders)
//   - vendorMilestoneSnapshot JSON populated with a representative
//     mix of vendor-side states so "Seller-side progress at the
//     moment this sale fell through" renders rows
//   - A buyer Contact stamped to the round (so the buyer block at
//     the top shows initials + name + email + phone)
//   - MilestoneCompletion rows for every buyer-side MilestoneDefinition
//     stamped buyerRoundId = archivedRound.id, with a mix of states
//     across complete / available / locked / not_required so "Steps
//     progress on this sale" renders varied step pills
//   - OutboundMessage rows scoped to the round (so "Communications
//     during this sale" renders entries)
//
// What it fills on the FILE (transaction-level) for the docs pane:
//   - 3 TransactionDocument rows (memo of sale, agency upload, portal
//     upload — covers the three source labels the drawer prints)
//
// Idempotent — safe to re-run. Existing rows are upsert-style
// (find-or-create by sentinel name) and quantities are clamped, not
// stacked. Tear-down is intentionally NOT provided: this is a fixture
// you want to keep around, not flush.
//
// Run:
//   npx -y dotenv -e .env --override -- npx ts-node \
//     --project tsconfig.scripts.json scripts/seed-cotham-archived-sale.ts

import { PrismaClient, ContactRole, MilestoneState, MilestoneSide, CommType, CommMethod } from "@prisma/client";
import { randomUUID } from "node:crypto";

const prisma = new PrismaClient();

const SENTINEL_SOL_FIRM   = "Whitehaven & Co. Solicitors (Cotham fixture)";
const SENTINEL_BROKER_FIRM = "Bristol Mortgage Partners (Cotham fixture)";

async function main() {
  console.log("── Resolve Cotham fixture ─────────────────────────────");
  // Filter on the address AND on having at least one withdrawn round.
  // Multiple Cotham-named fixtures exist on staging; the only one that
  // matches the "relist test" shape is the [Emily relist test]
  // sentinel, which is the one that's actually been through the relist
  // action. Without the withdrawn-round filter, findFirst could pick
  // a sibling Cotham fixture with R1 still active.
  const tx = await prisma.propertyTransaction.findFirst({
    where: {
      propertyAddress: { contains: "Cotham" },
      buyerRounds:     { some: { status: "withdrawn" } },
    },
    select: {
      id: true,
      propertyAddress: true,
      status: true,
      activeBuyerRoundId: true,
      agencyId: true,
      buyerRounds: { select: { id: true, roundNumber: true, status: true, archivedAt: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  if (!tx) {
    console.error("ABORT: no Cotham PropertyTransaction with a withdrawn BuyerRound. Re-create or relist the fixture first.");
    process.exit(2);
  }
  console.log(`  tx.id:            ${tx.id}`);
  console.log(`  tx.address:       ${tx.propertyAddress}`);
  console.log(`  tx.status:        ${tx.status}`);
  console.log(`  tx.rounds:        ${tx.buyerRounds.map(r => `R${r.roundNumber}(${r.status})`).join(", ")}`);

  const archived = tx.buyerRounds.filter(r => r.status === "withdrawn").sort((a, b) => b.roundNumber - a.roundNumber)[0];
  if (!archived) {
    console.error("ABORT: no archived (withdrawn) BuyerRound on this file. Run the relist action against this tx first.");
    process.exit(2);
  }
  console.log(`  archived round:   R${archived.roundNumber} (id=${archived.id})`);

  // Resolve a real User to stamp on completions + outbound messages.
  // Prefer a director on the file's agency so the drawer's
  // "Confirmed {date} by {name}" line is consistent and recognisable.
  const stamper = await prisma.user.findFirst({
    where:   tx.agencyId ? { agencyId: tx.agencyId, role: "director" } : { role: "admin" },
    select:  { id: true, name: true },
  }) ?? await prisma.user.findFirst({ select: { id: true, name: true } });
  if (!stamper) {
    console.error("ABORT: no User found to stamp completions/comms against.");
    process.exit(2);
  }
  console.log(`  stamper:          ${stamper.name} (${stamper.id})`);

  // ─── 1. Solicitor firm + contact ──────────────────────────────────
  console.log("\n── Solicitor firm + contact ──────────────────────────");
  const solFirm = await prisma.solicitorFirm.upsert({
    where:  { name: SENTINEL_SOL_FIRM },
    update: {},
    create: { name: SENTINEL_SOL_FIRM },
  });
  let solContact = await prisma.solicitorContact.findFirst({
    where: { firmId: solFirm.id, name: "Priya Nair" },
  });
  if (!solContact) {
    solContact = await prisma.solicitorContact.create({
      data: {
        firmId: solFirm.id,
        name:   "Priya Nair",
        email:  "priya.nair@whitehaven.example.co.uk",
        phone:  "0117 496 0428",
      },
    });
  }
  console.log(`  firm:    ${solFirm.name} (${solFirm.id})`);
  console.log(`  contact: ${solContact.name} <${solContact.email}>`);

  // ─── 2. Broker firm + contact ─────────────────────────────────────
  console.log("\n── Broker firm + contact ─────────────────────────────");
  let brokerFirm = await prisma.brokerFirm.findFirst({ where: { name: SENTINEL_BROKER_FIRM } });
  if (!brokerFirm) {
    brokerFirm = await prisma.brokerFirm.create({ data: { name: SENTINEL_BROKER_FIRM } });
  }
  let brokerContact = await prisma.brokerContact.findFirst({
    where: { firmId: brokerFirm.id, name: "Daniel Okeke" },
  });
  if (!brokerContact) {
    brokerContact = await prisma.brokerContact.create({
      data: {
        firmId: brokerFirm.id,
        name:   "Daniel Okeke",
        email:  "daniel.okeke@bristolmortgage.example.co.uk",
        phone:  "0117 925 7711",
      },
    });
  }
  console.log(`  firm:    ${brokerFirm.name} (${brokerFirm.id})`);
  console.log(`  contact: ${brokerContact.name} <${brokerContact.email}>`);

  // ─── 3. Vendor milestone snapshot ─────────────────────────────────
  // Synthesised to look like the file was a few weeks in when it fell
  // through — vendor side made meaningful progress (instruction, ID,
  // PIQ, memo issued) before the buyer pulled out.
  console.log("\n── Vendor milestone snapshot ──────────────────────────");
  const snapshot = [
    { code: "VM1",  state: "complete",     completedAt: "2026-05-18T10:24:00Z", completedById: null, eventDate: null, summaryText: null, reconciledAtExchange: false },
    { code: "VM2",  state: "complete",     completedAt: "2026-05-19T15:02:00Z", completedById: null, eventDate: null, summaryText: null, reconciledAtExchange: false },
    { code: "VM3",  state: "complete",     completedAt: "2026-05-20T09:11:00Z", completedById: null, eventDate: null, summaryText: null, reconciledAtExchange: false },
    { code: "VM4",  state: "complete",     completedAt: "2026-05-21T11:40:00Z", completedById: null, eventDate: null, summaryText: null, reconciledAtExchange: false },
    { code: "VM5",  state: "complete",     completedAt: "2026-05-22T14:08:00Z", completedById: null, eventDate: null, summaryText: null, reconciledAtExchange: false },
    { code: "VM6",  state: "complete",     completedAt: "2026-05-23T10:55:00Z", completedById: null, eventDate: null, summaryText: null, reconciledAtExchange: false },
    { code: "VM7",  state: "available",    completedAt: null,                   completedById: null, eventDate: null, summaryText: null, reconciledAtExchange: false },
    { code: "VM8",  state: "complete",     completedAt: "2026-05-24T12:30:00Z", completedById: null, eventDate: null, summaryText: null, reconciledAtExchange: false },
    { code: "VM9",  state: "complete",     completedAt: "2026-05-25T09:46:00Z", completedById: null, eventDate: null, summaryText: null, reconciledAtExchange: false },
    { code: "VM10", state: "available",    completedAt: null,                   completedById: null, eventDate: null, summaryText: null, reconciledAtExchange: false },
    { code: "VM11", state: "locked",       completedAt: null,                   completedById: null, eventDate: null, summaryText: null, reconciledAtExchange: false },
    { code: "VM12", state: "locked",       completedAt: null,                   completedById: null, eventDate: null, summaryText: null, reconciledAtExchange: false },
    { code: "VM13", state: "not_required", completedAt: null,                   completedById: null, eventDate: null, summaryText: null, reconciledAtExchange: false },
  ];

  // ─── 4. Patch the round itself ────────────────────────────────────
  console.log("\n── Update archived BuyerRound ─────────────────────────");
  const updatedRound = await prisma.buyerRound.update({
    where: { id: archived.id },
    data: {
      fallThroughReason:           "Buyer's mortgage offer fell through after the valuation came in £35,000 under the agreed price. The lender declined to re-issue and the buyer couldn't bridge the gap in time, so they withdrew.",
      purchasePrice:               475_000_00,
      purchaserSolicitorFirmId:    solFirm.id,
      purchaserSolicitorContactId: solContact.id,
      brokerFirmId:                brokerFirm.id,
      brokerContactId:             brokerContact.id,
      vendorMilestoneSnapshot:     snapshot,
      archivedAt:                  archived.archivedAt ?? new Date(),
    },
    select: { id: true, fallThroughReason: true, purchasePrice: true, archivedAt: true },
  });
  console.log(`  fallThroughReason: "${updatedRound.fallThroughReason?.slice(0, 60)}…"`);
  console.log(`  purchasePrice:     £${(updatedRound.purchasePrice! / 100).toLocaleString("en-GB")}`);
  console.log(`  archivedAt:        ${updatedRound.archivedAt?.toISOString()}`);

  // ─── 5. Buyer contact stamped to this round ───────────────────────
  console.log("\n── Buyer contact on the archived round ────────────────");
  let buyerContact = await prisma.contact.findFirst({
    where: { propertyTransactionId: tx.id, buyerRoundId: archived.id, roleType: ContactRole.purchaser },
  });
  if (!buyerContact) {
    buyerContact = await prisma.contact.create({
      data: {
        propertyTransactionId: tx.id,
        buyerRoundId:          archived.id,
        roleType:              ContactRole.purchaser,
        name:                  "Marcus Holloway",
        email:                 "marcus.holloway@example.com",
        phone:                 "07700 900113",
        portalToken:           randomUUID(),
      },
    });
  } else {
    buyerContact = await prisma.contact.update({
      where: { id: buyerContact.id },
      data:  { name: "Marcus Holloway", email: "marcus.holloway@example.com", phone: "07700 900113" },
    });
  }
  console.log(`  ${buyerContact.name} <${buyerContact.email}>  ${buyerContact.phone}`);

  // ─── 6. Buyer milestone completions ───────────────────────────────
  // Stamp every buyer-side MilestoneDefinition with a row scoped to
  // this round. Mixed states so the drawer shows variety.
  console.log("\n── Buyer milestone completions (mixed states) ─────────");
  const buyerDefs = await prisma.milestoneDefinition.findMany({
    where:   { side: MilestoneSide.purchaser },
    select:  { id: true, code: true, orderIndex: true },
    orderBy: { orderIndex: "asc" },
  });
  console.log(`  ${buyerDefs.length} buyer-side MilestoneDefinitions found`);
  let nComplete = 0, nAvailable = 0, nLocked = 0, nNotRequired = 0;
  for (let i = 0; i < buyerDefs.length; i++) {
    const def = buyerDefs[i];
    // Distribution: first ~12 complete, next ~5 available, last ~7 locked,
    // sprinkle 3 not_required across the middle.
    let state: MilestoneState;
    let completedAt: Date | null = null;
    let completedById: string | null = null;
    if (i < 12) {
      state = MilestoneState.complete;
      completedAt  = new Date(`2026-05-${(15 + Math.min(i, 13)).toString().padStart(2, "0")}T12:00:00Z`);
      completedById = stamper.id;
      nComplete++;
    } else if ([13, 16, 19].includes(i)) {
      state = MilestoneState.not_required;
      nNotRequired++;
    } else if (i < 18) {
      state = MilestoneState.available;
      nAvailable++;
    } else {
      state = MilestoneState.locked;
      nLocked++;
    }

    const existing = await prisma.milestoneCompletion.findFirst({
      where: { transactionId: tx.id, milestoneDefinitionId: def.id, buyerRoundId: archived.id },
      select: { id: true },
    });
    if (existing) {
      await prisma.milestoneCompletion.update({
        where: { id: existing.id },
        data:  {
          state,
          completedAt,
          completedById,
          summaryText: state === MilestoneState.complete ? `${def.code} confirmed by the buyer-side team.` : null,
        },
      });
    } else {
      await prisma.milestoneCompletion.create({
        data: {
          transactionId:         tx.id,
          milestoneDefinitionId: def.id,
          buyerRoundId:          archived.id,
          state,
          completedAt,
          completedById,
          summaryText: state === MilestoneState.complete ? `${def.code} confirmed by the buyer-side team.` : null,
        },
      });
    }
  }
  console.log(`  complete=${nComplete}  available=${nAvailable}  locked=${nLocked}  not_required=${nNotRequired}`);

  // ─── 7. OutboundMessage rows scoped to this round ─────────────────
  console.log("\n── Comms during this sale ─────────────────────────────");
  const commTemplates = [
    { type: CommType.outbound,      method: CommMethod.email,    content: "Sent the memorandum of sale and the buyer-side contact details to Whitehaven & Co. Asked for confirmation of receipt and proposed a Tuesday call to align on timescales.", offsetDays: -16, agencyOwned: true },
    { type: CommType.outbound,      method: CommMethod.phone,    content: "Quick call with Daniel at Bristol Mortgage Partners. The buyer's DIP is in hand; survey booked for Friday. Daniel will share the valuation outcome the same day.", offsetDays: -12, agencyOwned: true },
    { type: CommType.internal_note, method: null,                content: "Valuation back £35k under. Lender won't re-rate at the original level. Daniel flagged this is a sticking point — buyer needs to find the gap or pull. Going to give it 48h before pushing the seller.", offsetDays: -5, agencyOwned: true },
    { type: CommType.outbound,      method: CommMethod.email,    content: "Letting you know the buyer has formally withdrawn — they couldn't bridge the valuation shortfall. We'll come back to you with options today. The property stays on the market.", offsetDays: -1, agencyOwned: true },
  ];
  // Wipe-and-replace pattern for the comms: delete any existing scoped
  // to this round, then re-create from templates. Keeps the count
  // deterministic across re-runs.
  await prisma.outboundMessage.deleteMany({ where: { transactionId: tx.id, buyerRoundId: archived.id } });
  for (const t of commTemplates) {
    await prisma.outboundMessage.create({
      data: {
        transactionId:   tx.id,
        buyerRoundId:    archived.id,
        agencyId:        tx.agencyId,
        type:            t.type,
        method:          t.method,
        content:         t.content,
        contactIds:      [],
        visibleToClient: false,
        createdById:     stamper.id,
        createdAt:       new Date(Date.now() + t.offsetDays * 86_400_000),
      },
    });
  }
  console.log(`  created ${commTemplates.length} OutboundMessage rows (creator: ${stamper.name})`);

  // ─── 8. File-level documents ──────────────────────────────────────
  console.log("\n── File-level documents (shared across sales) ─────────");
  const docTemplates = [
    { filename: "Memorandum-of-Sale-14-Cotham-Hill.pdf", mimeType: "application/pdf", fileSize: 184_320, source: "agent_upload" },
    { filename: "EPC-14-Cotham-Hill.pdf",                mimeType: "application/pdf", fileSize:  62_104, source: "agent_upload" },
    { filename: "Land-Registry-Title-Plan.pdf",          mimeType: "application/pdf", fileSize:  91_876, source: "agent_upload" },
  ];
  for (const d of docTemplates) {
    const existing = await prisma.transactionDocument.findFirst({
      where: { transactionId: tx.id, filename: d.filename },
      select: { id: true },
    });
    if (existing) continue;
    await prisma.transactionDocument.create({
      data: {
        transactionId: tx.id,
        filename:      d.filename,
        storagePath:   `staging/seed/${tx.id}/${d.filename}`,
        fileSize:      d.fileSize,
        mimeType:      d.mimeType,
        source:        d.source,
      },
    });
  }
  const docCount = await prisma.transactionDocument.count({ where: { transactionId: tx.id } });
  console.log(`  total docs on file (after seed): ${docCount}`);

  // ─── Summary ──────────────────────────────────────────────────────
  console.log("\n── DONE ───────────────────────────────────────────────");
  console.log(`Open the chip on /agent/transactions/${tx.id} to see the drawer fully populated.`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
