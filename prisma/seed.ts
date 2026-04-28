// prisma/seed.ts

import {
  PrismaClient,
  UserRole,
  MilestoneSide,
  CanBeMarkedNr,
} from "@prisma/client";
import { hashSync } from "bcryptjs";

const TEST_PASSWORD = hashSync("Hartwell2024!", 12);

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // ── Cleanup ───────────────────────────────────────────────────────────────
  await prisma.feedbackSubmission.deleteMany();
  await prisma.portalPushSubscription.deleteMany();
  await prisma.portalMessage.deleteMany();
  await prisma.transactionDocument.deleteMany();
  await prisma.transactionFlag.deleteMany();
  await prisma.communicationRecord.deleteMany();
  await prisma.chaseTask.deleteMany();
  await prisma.reminderLog.deleteMany();
  await prisma.reminderRule.deleteMany();
  await prisma.milestoneCompletion.deleteMany();
  await prisma.milestoneDefinition.deleteMany();
  await prisma.transactionNote.deleteMany();
  await prisma.contact.deleteMany();
  await prisma.priceHistory.deleteMany();
  await prisma.manualTask.deleteMany();
  await prisma.propertyChain.deleteMany();
  await prisma.propertyTransaction.deleteMany();
  await prisma.agencyRecommendedSolicitor.deleteMany();
  await prisma.solicitorContact.deleteMany();
  await prisma.solicitorFirm.deleteMany();
  await prisma.userVerifiedEmail.deleteMany();
  await prisma.verifiedDomain.deleteMany();
  await prisma.session.deleteMany();
  await prisma.account.deleteMany();
  await prisma.user.deleteMany();
  await prisma.agency.deleteMany();

  // ── Agency & Users ────────────────────────────────────────────────────────
  const agency = await prisma.agency.create({ data: { name: "Hartwell & Partners" } });

  await prisma.user.create({
    data: { name: "Sarah Hartwell", email: "sarah@hartwellpartners.co.uk", role: UserRole.admin, agencyId: agency.id, password: TEST_PASSWORD },
  });
  await prisma.user.create({
    data: { name: "Ellis Askey", email: "ellisaskey@googlemail.com", role: UserRole.admin, agencyId: agency.id, password: TEST_PASSWORD },
  });
  await prisma.user.create({
    data: { name: "Ellis Askey", email: "ellis@thesalesprogressor.co.uk", role: UserRole.admin, agencyId: agency.id, password: TEST_PASSWORD },
  });
  await prisma.user.create({
    data: { name: "James Okafor", email: "james@hartwellpartners.co.uk", role: UserRole.sales_progressor, agencyId: agency.id, password: TEST_PASSWORD },
  });
  await prisma.user.create({
    data: { name: "Emily Chen", email: "emily@hartwellpartners.co.uk", role: UserRole.negotiator, agencyId: agency.id, password: TEST_PASSWORD, firmName: "Hartwell & Partners" },
  });
  await prisma.user.create({
    data: { name: "Alex Morgan", email: "alex@hartwellpartners.co.uk", role: UserRole.director, agencyId: agency.id, password: TEST_PASSWORD, firmName: "Hartwell & Partners" },
  });
  console.log("✓ Agency and users");

  // ── Milestone Definitions ─────────────────────────────────────────────────
  // Vendor side — weights sum to 100.00
  const vendorDefs = [
    {
      code: "VM1",  orderIndex: 1,  blocksExchange: true,  predecessorCode: null,   canBeMarkedNr: CanBeMarkedNr.never,
      weight: 6.00, name: "Seller has instructed their solicitor",
      summaryTemplate: "{agent} confirmed that {vendors} have instructed their solicitor",
    },
    {
      code: "VM2",  orderIndex: 2,  blocksExchange: true,  predecessorCode: null,   canBeMarkedNr: CanBeMarkedNr.never,
      weight: 3.00, name: "Seller has received the memorandum of sale",
      summaryTemplate: "{agent} confirmed that {vendors} have received the memorandum of sale",
    },
    {
      code: "VM3",  orderIndex: 3,  blocksExchange: true,  predecessorCode: "VM1",  canBeMarkedNr: CanBeMarkedNr.never,
      weight: 4.00, name: "Seller has received the welcome pack from their solicitor",
      summaryTemplate: "{agent} confirmed that {vendors} have received their welcome pack from their solicitor",
    },
    {
      code: "VM4",  orderIndex: 4,  blocksExchange: true,  predecessorCode: "VM3",  canBeMarkedNr: CanBeMarkedNr.never,
      weight: 3.00, name: "Seller has completed ID and AML checks with their solicitor",
      summaryTemplate: "{agent} confirmed that {vendors} have completed their ID and AML checks",
    },
    {
      code: "VM5",  orderIndex: 5,  blocksExchange: true,  predecessorCode: "VM4",  canBeMarkedNr: CanBeMarkedNr.never,
      weight: 4.00, name: "Seller has received the property information forms from their solicitor",
      summaryTemplate: "{agent} confirmed that {vendors} have received the property information forms from their solicitor",
    },
    {
      code: "VM6",  orderIndex: 6,  blocksExchange: true,  predecessorCode: "VM5",  canBeMarkedNr: CanBeMarkedNr.never,
      weight: 8.00, name: "Seller has returned completed property information forms to their solicitor",
      summaryTemplate: "{agent} confirmed that {vendors} have returned their completed property information forms",
    },
    {
      code: "VM7",  orderIndex: 7,  blocksExchange: true,  predecessorCode: "VM6",  canBeMarkedNr: CanBeMarkedNr.never,
      weight: 8.00, name: "Seller's solicitor has issued the draft contract pack",
      summaryTemplate: "{agent} received confirmation from {solicitor} that the draft contract pack has been issued",
    },
    {
      code: "VM8",  orderIndex: 8,  blocksExchange: true,  predecessorCode: null,   canBeMarkedNr: CanBeMarkedNr.auto_only,
      weight: 3.00, name: "Seller's solicitor has requested the management pack",
      summaryTemplate: "{agent} received confirmation from {solicitor} that the management pack has been requested",
    },
    {
      code: "VM9",  orderIndex: 9,  blocksExchange: true,  predecessorCode: "VM8",  canBeMarkedNr: CanBeMarkedNr.auto_only,
      weight: 3.00, name: "Seller's solicitor has received the management pack",
      summaryTemplate: "{agent} received confirmation from {solicitor} that the management pack has been received",
    },
    {
      code: "VM10", orderIndex: 10, blocksExchange: true,  predecessorCode: "VM7",  canBeMarkedNr: CanBeMarkedNr.never,
      weight: 5.00, name: "Seller's solicitor has received initial enquiries",
      summaryTemplate: "{agent} received confirmation from {solicitor} that initial enquiries have been received from the buyer's solicitor",
    },
    {
      code: "VM11", orderIndex: 11, blocksExchange: true,  predecessorCode: "VM10", canBeMarkedNr: CanBeMarkedNr.never,
      weight: 5.00, name: "Seller has provided initial replies to their solicitor",
      summaryTemplate: "{agent} confirmed that {vendors} have provided their initial replies to their solicitor",
    },
    {
      code: "VM12", orderIndex: 12, blocksExchange: true,  predecessorCode: "VM11", canBeMarkedNr: CanBeMarkedNr.never,
      weight: 5.00, name: "Seller's solicitor has issued initial responses to the buyer's solicitor",
      summaryTemplate: "{agent} received confirmation from {solicitor} that initial replies have been issued to the buyer's solicitor",
    },
    {
      code: "VM13", orderIndex: 13, blocksExchange: true,  predecessorCode: "VM10", canBeMarkedNr: CanBeMarkedNr.never,
      weight: 3.00, name: "Seller's solicitor has received additional enquiries",
      summaryTemplate: "{agent} received confirmation from {solicitor} that further enquiries have been received",
    },
    {
      code: "VM14", orderIndex: 14, blocksExchange: true,  predecessorCode: "VM13", canBeMarkedNr: CanBeMarkedNr.never,
      weight: 3.00, name: "Seller has provided additional replies to their solicitor",
      summaryTemplate: "{agent} confirmed that {vendors} have provided their further replies to their solicitor",
    },
    {
      code: "VM15", orderIndex: 15, blocksExchange: true,  predecessorCode: "VM14", canBeMarkedNr: CanBeMarkedNr.never,
      weight: 3.00, name: "Seller's solicitor has issued additional responses to the buyer's solicitor",
      summaryTemplate: "{agent} received confirmation from {solicitor} that further replies have been issued to the buyer's solicitor",
    },
    {
      code: "VM16", orderIndex: 16, blocksExchange: true,  predecessorCode: "VM7",  canBeMarkedNr: CanBeMarkedNr.never,
      weight: 4.00, name: "Seller's solicitor has issued contract documents to the seller",
      summaryTemplate: "{agent} received confirmation from {solicitor} that contract documents have been issued to {vendors}",
    },
    {
      code: "VM17", orderIndex: 17, blocksExchange: true,  predecessorCode: "VM16", canBeMarkedNr: CanBeMarkedNr.never,
      weight: 8.00, name: "Seller's solicitor has received signed contract documents back from the seller",
      summaryTemplate: "{agent} confirmed that {vendors} have returned their signed contract documents to their solicitor",
    },
    {
      code: "VM18", orderIndex: 18, blocksExchange: false, predecessorCode: null,   canBeMarkedNr: CanBeMarkedNr.never,
      weight: 8.00, name: "Seller's solicitor has confirmed readiness to exchange",
      summaryTemplate: "{agent} received confirmation from {solicitor} that they are ready to exchange",
    },
    {
      code: "VM19", orderIndex: 19, blocksExchange: false, predecessorCode: "VM18", canBeMarkedNr: CanBeMarkedNr.never,
      weight: 9.00, name: "Seller has received confirmation that contracts have exchanged",
      summaryTemplate: "{agent} confirmed that contracts have successfully exchanged",
    },
    {
      code: "VM20", orderIndex: 20, blocksExchange: false, predecessorCode: "VM19", canBeMarkedNr: CanBeMarkedNr.never,
      weight: 5.00, name: "Seller has received confirmation that the sale has completed",
      summaryTemplate: "{agent} confirmed that the sale of {vendors}'s property has completed",
    },
  ];

  // Purchaser side — weights sum to 100.00
  const purchaserDefs = [
    {
      code: "PM1",  orderIndex: 1,  blocksExchange: true,  predecessorCode: null,   canBeMarkedNr: CanBeMarkedNr.never,
      weight: 5.00, name: "Buyer has instructed their solicitor",
      summaryTemplate: "{agent} confirmed that {purchasers} have instructed their solicitor",
    },
    {
      code: "PM2",  orderIndex: 2,  blocksExchange: true,  predecessorCode: null,   canBeMarkedNr: CanBeMarkedNr.never,
      weight: 3.00, name: "Buyer has received the memorandum of sale",
      summaryTemplate: "{agent} confirmed that {purchasers} have received the memorandum of sale",
    },
    {
      code: "PM3",  orderIndex: 3,  blocksExchange: true,  predecessorCode: "PM1",  canBeMarkedNr: CanBeMarkedNr.never,
      weight: 2.00, name: "Buyer has completed ID and AML checks with their solicitor",
      summaryTemplate: "{agent} confirmed that {purchasers} have completed their ID and AML checks with their solicitor",
    },
    {
      code: "PM4",  orderIndex: 4,  blocksExchange: true,  predecessorCode: "PM1",  canBeMarkedNr: CanBeMarkedNr.never,
      weight: 6.00, name: "Buyer has paid money on account to their solicitor",
      summaryTemplate: "{agent} confirmed that {purchasers} have paid money on account to their solicitor",
    },
    {
      code: "PM5",  orderIndex: 5,  blocksExchange: true,  predecessorCode: null,   canBeMarkedNr: CanBeMarkedNr.auto_only,
      weight: 4.00, name: "Buyer has submitted their mortgage application",
      summaryTemplate: "{agent} confirmed that {purchasers} have submitted their mortgage application",
    },
    {
      code: "PM6",  orderIndex: 6,  blocksExchange: true,  predecessorCode: "PM5",  canBeMarkedNr: CanBeMarkedNr.auto_only,
      weight: 2.00, name: "Lender valuation has been booked",
      summaryTemplate: "{agent} confirmed that the lender valuation has been booked for {purchasers}",
    },
    {
      code: "PM7",  orderIndex: 7,  blocksExchange: true,  predecessorCode: "PM4",  canBeMarkedNr: CanBeMarkedNr.never,
      weight: 3.00, name: "Buyer's solicitor has received the draft contract pack",
      summaryTemplate: "{agent} confirmed that {purchasers}'s solicitor has received the draft contract pack",
    },
    {
      code: "PM8",  orderIndex: 8,  blocksExchange: true,  predecessorCode: "PM7",  canBeMarkedNr: CanBeMarkedNr.never,
      weight: 3.00, name: "Buyer's solicitor has ordered searches",
      summaryTemplate: "{agent} confirmed that {purchasers}'s solicitor has ordered the searches",
    },
    {
      code: "PM9",  orderIndex: 9,  blocksExchange: true,  predecessorCode: null,   canBeMarkedNr: CanBeMarkedNr.manual_allowed,
      weight: 4.00, name: "Buyer has booked a Level 2 or Level 3 survey",
      summaryTemplate: "{agent} confirmed that {purchasers} have booked their survey",
    },
    {
      code: "PM10", orderIndex: 10, blocksExchange: true,  predecessorCode: "PM9",  canBeMarkedNr: CanBeMarkedNr.auto_only,
      weight: 3.00, name: "Buyer has received the survey report",
      summaryTemplate: "{agent} confirmed that {purchasers} have received their survey report",
    },
    {
      code: "PM11", orderIndex: 11, blocksExchange: true,  predecessorCode: "PM6",  canBeMarkedNr: CanBeMarkedNr.auto_only,
      weight: 6.00, name: "Buyer's solicitor has received the mortgage offer",
      summaryTemplate: "{agent} confirmed that {purchasers}'s solicitor has received the mortgage offer",
    },
    {
      code: "PM12", orderIndex: 12, blocksExchange: true,  predecessorCode: "VM9",  canBeMarkedNr: CanBeMarkedNr.auto_only,
      weight: 2.00, name: "Buyer's solicitor has received the management pack from the vendor's solicitor",
      summaryTemplate: "{agent} confirmed that {purchasers}'s solicitor has received the management pack",
    },
    {
      code: "PM13", orderIndex: 13, blocksExchange: true,  predecessorCode: "PM8",  canBeMarkedNr: CanBeMarkedNr.never,
      weight: 3.00, name: "Buyer's solicitor has received the search results",
      summaryTemplate: "{agent} confirmed that {purchasers}'s solicitor has received the search results",
    },
    {
      code: "PM14", orderIndex: 14, blocksExchange: true,  predecessorCode: "PM7",  canBeMarkedNr: CanBeMarkedNr.never,
      weight: 3.00, name: "Buyer's solicitor has raised initial enquiries to the seller's solicitor",
      summaryTemplate: "{agent} confirmed that {purchasers}'s solicitor has raised their initial enquiries",
    },
    {
      code: "PM15", orderIndex: 15, blocksExchange: true,  predecessorCode: "PM14", canBeMarkedNr: CanBeMarkedNr.never,
      weight: 3.00, name: "Buyer's solicitor has received initial replies from the seller's solicitor",
      summaryTemplate: "{agent} confirmed that {purchasers}'s solicitor has received the initial replies from {solicitor}",
    },
    {
      code: "PM16", orderIndex: 16, blocksExchange: true,  predecessorCode: "PM15", canBeMarkedNr: CanBeMarkedNr.never,
      weight: 2.00, name: "Buyer's solicitor has reviewed the initial replies",
      summaryTemplate: "{agent} confirmed that {purchasers}'s solicitor has reviewed the initial replies",
    },
    {
      code: "PM17", orderIndex: 17, blocksExchange: true,  predecessorCode: "PM14", canBeMarkedNr: CanBeMarkedNr.never,
      weight: 2.00, name: "Buyer's solicitor has raised additional enquiries",
      summaryTemplate: "{agent} confirmed that {purchasers}'s solicitor has raised further enquiries",
    },
    {
      code: "PM18", orderIndex: 18, blocksExchange: true,  predecessorCode: "PM17", canBeMarkedNr: CanBeMarkedNr.never,
      weight: 2.00, name: "Buyer's solicitor has received additional replies",
      summaryTemplate: "{agent} confirmed that {purchasers}'s solicitor has received the further replies from {solicitor}",
    },
    {
      code: "PM19", orderIndex: 19, blocksExchange: true,  predecessorCode: "PM18", canBeMarkedNr: CanBeMarkedNr.never,
      weight: 2.00, name: "Buyer's solicitor has reviewed the additional replies",
      summaryTemplate: "{agent} confirmed that {purchasers}'s solicitor has reviewed the further replies",
    },
    {
      code: "PM20", orderIndex: 20, blocksExchange: true,  predecessorCode: "PM19", canBeMarkedNr: CanBeMarkedNr.never,
      weight: 6.00, name: "Buyer's solicitor has confirmed all enquiries are now satisfied",
      summaryTemplate: "{agent} confirmed that all enquiries are now satisfied and {purchasers}'s solicitor is happy to proceed",
    },
    {
      code: "PM21", orderIndex: 21, blocksExchange: true,  predecessorCode: "PM20", canBeMarkedNr: CanBeMarkedNr.never,
      weight: 3.00, name: "Buyer has received the final report from their solicitor",
      summaryTemplate: "{agent} confirmed that {purchasers} have received their final report from their solicitor",
    },
    {
      code: "PM22", orderIndex: 22, blocksExchange: true,  predecessorCode: "PM21", canBeMarkedNr: CanBeMarkedNr.never,
      weight: 3.00, name: "Buyer's solicitor has issued contract documents to the buyer",
      summaryTemplate: "{agent} confirmed that {purchasers}'s solicitor has issued contract documents for signing",
    },
    {
      code: "PM23", orderIndex: 23, blocksExchange: true,  predecessorCode: "PM22", canBeMarkedNr: CanBeMarkedNr.never,
      weight: 6.00, name: "Buyer's solicitor has received the signed contract documents back from the buyer",
      summaryTemplate: "{agent} confirmed that {purchasers} have returned their signed contract documents",
    },
    {
      code: "PM24", orderIndex: 24, blocksExchange: true,  predecessorCode: "PM23", canBeMarkedNr: CanBeMarkedNr.never,
      weight: 3.00, name: "Buyer has transferred the deposit",
      summaryTemplate: "{agent} confirmed that {purchasers} have transferred the deposit to their solicitor",
    },
    {
      code: "PM25", orderIndex: 25, blocksExchange: false, predecessorCode: null,   canBeMarkedNr: CanBeMarkedNr.never,
      weight: 6.00, name: "Buyer's solicitor has confirmed readiness to exchange",
      summaryTemplate: "{agent} confirmed that {purchasers}'s solicitor is ready to exchange",
    },
    {
      code: "PM26", orderIndex: 26, blocksExchange: false, predecessorCode: "PM25", canBeMarkedNr: CanBeMarkedNr.never,
      weight: 8.00, name: "Buyer has received confirmation that contracts have exchanged",
      summaryTemplate: "{agent} confirmed that contracts have exchanged — congratulations to {purchasers}",
    },
    {
      code: "PM27", orderIndex: 27, blocksExchange: false, predecessorCode: "PM26", canBeMarkedNr: CanBeMarkedNr.never,
      weight: 5.00, name: "Buyer has received confirmation that the sale has completed",
      summaryTemplate: "{agent} confirmed that the purchase has completed — {purchasers} are now the proud owners",
    },
  ];

  const defIdMap = new Map<string, string>();
  for (const m of vendorDefs) {
    const d = await prisma.milestoneDefinition.create({
      data: { ...m, side: MilestoneSide.vendor },
    });
    defIdMap.set(m.code, d.id);
  }
  for (const m of purchaserDefs) {
    const d = await prisma.milestoneDefinition.create({
      data: { ...m, side: MilestoneSide.purchaser },
    });
    defIdMap.set(m.code, d.id);
  }
  console.log(`✓ Milestone definitions: ${vendorDefs.length} vendor, ${purchaserDefs.length} purchaser`);

  // ── Reminder Rules ────────────────────────────────────────────────────────
  // Codes are the new spec codes (already remapped from old seed)
  const rules = [
    { name: "Chase: Seller instructed solicitor",                              targetMilestoneCode: "VM1",  anchorCode: null,    graceDays: 2,  repeatEveryDays: 3,  escalateAfterChases: 3, requiresExchangeReady: false, useEventDate: false },
    { name: "Chase: Seller MOS received",                                      targetMilestoneCode: "VM2",  anchorCode: null,    graceDays: 1,  repeatEveryDays: 2,  escalateAfterChases: 2, requiresExchangeReady: false, useEventDate: false },
    { name: "Chase: Seller welcome pack received",                             targetMilestoneCode: "VM3",  anchorCode: "VM1",   graceDays: 3,  repeatEveryDays: 5,  escalateAfterChases: 3, requiresExchangeReady: false, useEventDate: false },
    { name: "Chase: Seller ID & AML completed",                               targetMilestoneCode: "VM4",  anchorCode: "VM1",   graceDays: 3,  repeatEveryDays: 5,  escalateAfterChases: 3, requiresExchangeReady: false, useEventDate: false },
    { name: "Chase: Seller property information forms received",               targetMilestoneCode: "VM5",  anchorCode: "VM3",   graceDays: 5,  repeatEveryDays: 3,  escalateAfterChases: 3, requiresExchangeReady: false, useEventDate: false },
    { name: "Chase: Seller property information forms returned",               targetMilestoneCode: "VM6",  anchorCode: "VM5",   graceDays: 5,  repeatEveryDays: 3,  escalateAfterChases: 3, requiresExchangeReady: false, useEventDate: false },
    { name: "Chase: Draft contract pack issued",                               targetMilestoneCode: "VM7",  anchorCode: "VM6",   graceDays: 5,  repeatEveryDays: 3,  escalateAfterChases: 3, requiresExchangeReady: false, useEventDate: false },
    { name: "Chase: Management pack requested",                                targetMilestoneCode: "VM8",  anchorCode: null,    graceDays: 3,  repeatEveryDays: 5,  escalateAfterChases: 3, requiresExchangeReady: false, useEventDate: false },
    { name: "Chase: Management pack received (seller)",                        targetMilestoneCode: "VM9",  anchorCode: "VM8",   graceDays: 21, repeatEveryDays: 7,  escalateAfterChases: 2, requiresExchangeReady: false, useEventDate: false },
    { name: "Chase: Initial enquiries received by seller's solicitor",         targetMilestoneCode: "VM10", anchorCode: "PM14",  graceDays: 3,  repeatEveryDays: 5,  escalateAfterChases: 3, requiresExchangeReady: false, useEventDate: false },
    { name: "Chase: Seller initial replies provided to solicitor",             targetMilestoneCode: "VM11", anchorCode: "VM10",  graceDays: 5,  repeatEveryDays: 5,  escalateAfterChases: 3, requiresExchangeReady: false, useEventDate: false },
    { name: "Chase: Initial replies issued by seller's solicitor",             targetMilestoneCode: "VM12", anchorCode: "VM11",  graceDays: 2,  repeatEveryDays: 3,  escalateAfterChases: 3, requiresExchangeReady: false, useEventDate: false },
    { name: "Chase: Further enquiries received by seller's solicitor",         targetMilestoneCode: "VM13", anchorCode: "PM17",  graceDays: 3,  repeatEveryDays: 5,  escalateAfterChases: 3, requiresExchangeReady: false, useEventDate: false },
    { name: "Chase: Seller further replies provided to solicitor",             targetMilestoneCode: "VM14", anchorCode: "VM13",  graceDays: 5,  repeatEveryDays: 5,  escalateAfterChases: 3, requiresExchangeReady: false, useEventDate: false },
    { name: "Chase: Further replies issued by seller's solicitor",             targetMilestoneCode: "VM15", anchorCode: "VM14",  graceDays: 2,  repeatEveryDays: 2,  escalateAfterChases: 3, requiresExchangeReady: false, useEventDate: false },
    { name: "Chase: Contract documents issued to seller",                      targetMilestoneCode: "VM16", anchorCode: "VM7",   graceDays: 3,  repeatEveryDays: 5,  escalateAfterChases: 3, requiresExchangeReady: false, useEventDate: false },
    { name: "Chase: Signed contracts returned by seller",                      targetMilestoneCode: "VM17", anchorCode: "VM16",  graceDays: 5,  repeatEveryDays: 5,  escalateAfterChases: 3, requiresExchangeReady: false, useEventDate: false },
    { name: "Chase: Seller's solicitor ready to exchange",                     targetMilestoneCode: "VM18", anchorCode: "VM17",  graceDays: 2,  repeatEveryDays: 2,  escalateAfterChases: 2, requiresExchangeReady: true,  useEventDate: false },
    { name: "Chase: Contracts exchanged (seller)",                             targetMilestoneCode: "VM19", anchorCode: "VM18",  graceDays: 1,  repeatEveryDays: 2,  escalateAfterChases: 1, requiresExchangeReady: false, useEventDate: false },
    { name: "Chase: Sale completed (seller)",                                  targetMilestoneCode: "VM20", anchorCode: "VM19",  graceDays: 1,  repeatEveryDays: 1,  escalateAfterChases: 2, requiresExchangeReady: false, useEventDate: false },
    { name: "Chase: Buyer instructed solicitor",                               targetMilestoneCode: "PM1",  anchorCode: null,    graceDays: 2,  repeatEveryDays: 3,  escalateAfterChases: 3, requiresExchangeReady: false, useEventDate: false },
    { name: "Chase: Buyer MOS received",                                       targetMilestoneCode: "PM2",  anchorCode: null,    graceDays: 1,  repeatEveryDays: 2,  escalateAfterChases: 2, requiresExchangeReady: false, useEventDate: false },
    { name: "Chase: Buyer ID & AML completed",                                 targetMilestoneCode: "PM3",  anchorCode: "PM1",   graceDays: 3,  repeatEveryDays: 5,  escalateAfterChases: 3, requiresExchangeReady: false, useEventDate: false },
    { name: "Chase: Buyer money paid on account",                              targetMilestoneCode: "PM4",  anchorCode: "PM1",   graceDays: 5,  repeatEveryDays: 5,  escalateAfterChases: 3, requiresExchangeReady: false, useEventDate: false },
    { name: "Chase: Buyer mortgage application submitted",                     targetMilestoneCode: "PM5",  anchorCode: null,    graceDays: 3,  repeatEveryDays: 5,  escalateAfterChases: 3, requiresExchangeReady: false, useEventDate: false },
    { name: "Chase: Lender valuation booked",                                  targetMilestoneCode: "PM6",  anchorCode: "PM5",   graceDays: 7,  repeatEveryDays: 7,  escalateAfterChases: 2, requiresExchangeReady: false, useEventDate: false },
    { name: "Chase: Draft contract pack received by buyer's solicitor",        targetMilestoneCode: "PM7",  anchorCode: "VM7",   graceDays: 2,  repeatEveryDays: 3,  escalateAfterChases: 3, requiresExchangeReady: false, useEventDate: false },
    { name: "Chase: Searches ordered",                                         targetMilestoneCode: "PM8",  anchorCode: "PM7",   graceDays: 3,  repeatEveryDays: 3,  escalateAfterChases: 3, requiresExchangeReady: false, useEventDate: false },
    { name: "Chase: Survey booked",                                            targetMilestoneCode: "PM9",  anchorCode: null,    graceDays: 7,  repeatEveryDays: 5,  escalateAfterChases: 3, requiresExchangeReady: false, useEventDate: false },
    { name: "Chase: Survey report received",                                   targetMilestoneCode: "PM10", anchorCode: "PM9",   graceDays: 7,  repeatEveryDays: 5,  escalateAfterChases: 3, requiresExchangeReady: false, useEventDate: true  },
    { name: "Chase: Mortgage offer received",                                  targetMilestoneCode: "PM11", anchorCode: "PM6",   graceDays: 14, repeatEveryDays: 5,  escalateAfterChases: 3, requiresExchangeReady: false, useEventDate: true  },
    { name: "Chase: Management pack received (buyer)",                         targetMilestoneCode: "PM12", anchorCode: "VM9",   graceDays: 3,  repeatEveryDays: 10, escalateAfterChases: 3, requiresExchangeReady: false, useEventDate: false },
    { name: "Chase: Search results received",                                  targetMilestoneCode: "PM13", anchorCode: "PM8",   graceDays: 21, repeatEveryDays: 7,  escalateAfterChases: 3, requiresExchangeReady: false, useEventDate: false },
    { name: "Chase: Initial enquiries raised by buyer's solicitor",            targetMilestoneCode: "PM14", anchorCode: "PM7",   graceDays: 5,  repeatEveryDays: 5,  escalateAfterChases: 3, requiresExchangeReady: false, useEventDate: false },
    { name: "Chase: Initial replies received by buyer's solicitor",            targetMilestoneCode: "PM15", anchorCode: "VM12",  graceDays: 14, repeatEveryDays: 3,  escalateAfterChases: 3, requiresExchangeReady: false, useEventDate: false },
    { name: "Chase: Initial replies reviewed by buyer's solicitor",            targetMilestoneCode: "PM16", anchorCode: "PM15",  graceDays: 3,  repeatEveryDays: 3,  escalateAfterChases: 3, requiresExchangeReady: false, useEventDate: false },
    { name: "Chase: Further enquiries raised by buyer's solicitor",            targetMilestoneCode: "PM17", anchorCode: "PM16",  graceDays: 3,  repeatEveryDays: 3,  escalateAfterChases: 3, requiresExchangeReady: false, useEventDate: false },
    { name: "Chase: Further replies received by buyer's solicitor",            targetMilestoneCode: "PM18", anchorCode: "VM15",  graceDays: 14, repeatEveryDays: 7,  escalateAfterChases: 3, requiresExchangeReady: false, useEventDate: false },
    { name: "Chase: Further replies reviewed by buyer's solicitor",            targetMilestoneCode: "PM19", anchorCode: "PM18",  graceDays: 3,  repeatEveryDays: 3,  escalateAfterChases: 3, requiresExchangeReady: false, useEventDate: false },
    { name: "Chase: All enquiries satisfied",                                  targetMilestoneCode: "PM20", anchorCode: "PM19",  graceDays: 3,  repeatEveryDays: 3,  escalateAfterChases: 3, requiresExchangeReady: false, useEventDate: false },
    { name: "Chase: Final report received by buyer",                           targetMilestoneCode: "PM21", anchorCode: "PM20",  graceDays: 3,  repeatEveryDays: 3,  escalateAfterChases: 3, requiresExchangeReady: false, useEventDate: false },
    { name: "Chase: Contract documents received by buyer",                     targetMilestoneCode: "PM22", anchorCode: "PM21",  graceDays: 3,  repeatEveryDays: 3,  escalateAfterChases: 3, requiresExchangeReady: false, useEventDate: false },
    { name: "Chase: Signed contracts returned by buyer",                       targetMilestoneCode: "PM23", anchorCode: "PM22",  graceDays: 5,  repeatEveryDays: 5,  escalateAfterChases: 3, requiresExchangeReady: false, useEventDate: false },
    { name: "Chase: Deposit transferred by buyer",                             targetMilestoneCode: "PM24", anchorCode: "PM23",  graceDays: 3,  repeatEveryDays: 3,  escalateAfterChases: 3, requiresExchangeReady: false, useEventDate: false },
    { name: "Chase: Buyer's solicitor ready to exchange",                      targetMilestoneCode: "PM25", anchorCode: "PM24",  graceDays: 2,  repeatEveryDays: 2,  escalateAfterChases: 3, requiresExchangeReady: true,  useEventDate: false },
    { name: "Chase: Contracts exchanged (buyer)",                              targetMilestoneCode: "PM26", anchorCode: "PM25",  graceDays: 1,  repeatEveryDays: 2,  escalateAfterChases: 1, requiresExchangeReady: false, useEventDate: false },
    { name: "Chase: Purchase completed",                                       targetMilestoneCode: "PM27", anchorCode: "PM26",  graceDays: 1,  repeatEveryDays: 1,  escalateAfterChases: 2, requiresExchangeReady: false, useEventDate: false },
  ];

  for (const rule of rules) {
    const { anchorCode, ...rest } = rule;
    const anchorMilestoneId = anchorCode ? (defIdMap.get(anchorCode) ?? null) : null;
    await prisma.reminderRule.create({ data: { ...rest, anchorMilestoneId } });
  }
  console.log(`✓ Reminder rules: ${rules.length}`);

  // ── Solicitor Firms ───────────────────────────────────────────────────────
  const firmThornton = await prisma.solicitorFirm.create({ data: { agencyId: agency.id, name: "Thornton & Co Solicitors" } });
  await prisma.solicitorContact.create({ data: { firmId: firmThornton.id, name: "Henry Thornton", email: "henry@thorntonco.co.uk", phone: "0117 922 3400" } });
  await prisma.solicitorContact.create({ data: { firmId: firmThornton.id, name: "Sarah Marsh", email: "s.marsh@thorntonco.co.uk", phone: "0117 922 3401" } });

  const firmDevlin = await prisma.solicitorFirm.create({ data: { agencyId: agency.id, name: "Devlin Law LLP" } });
  await prisma.solicitorContact.create({ data: { firmId: firmDevlin.id, name: "Mark Devlin", email: "mark@devlinlaw.co.uk", phone: "0117 900 1234" } });
  await prisma.solicitorContact.create({ data: { firmId: firmDevlin.id, name: "Priya Anand", email: "p.anand@devlinlaw.co.uk", phone: "0117 900 1235" } });

  const firmAndersons = await prisma.solicitorFirm.create({ data: { agencyId: agency.id, name: "Andersons Property Law" } });
  await prisma.solicitorContact.create({ data: { firmId: firmAndersons.id, name: "Lucy Anderson", email: "l.anderson@aplaw.co.uk", phone: "0117 435 8800" } });

  const firmWright = await prisma.solicitorFirm.create({ data: { agencyId: agency.id, name: "Wright & Hughes LLP" } });
  await prisma.solicitorContact.create({ data: { firmId: firmWright.id, name: "Tom Wright", email: "t.wright@whlegal.co.uk", phone: "0117 332 9900" } });

  console.log("✓ Solicitor firms and contacts");
  console.log("🎉 Seeding complete. Create test transactions via the UI.");
}

main()
  .catch((err) => { console.error(err); process.exit(1); })
  .finally(() => prisma.$disconnect());
