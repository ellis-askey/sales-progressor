// prisma/seed.ts — Rich demo dataset simulating 6 weeks of live operation

import {
  PrismaClient,
  UserRole,
  TransactionStatus,
  ContactRole,
  MilestoneSide,
  Tenure,
  PurchaseType,
  TaskPriority,
  CommType,
  CommMethod,
} from "@prisma/client";
import { randomUUID } from "crypto";
import { hashSync } from "bcryptjs";

// All test accounts share this password — documented in docs/test-accounts.md
const TEST_PASSWORD = hashSync("Hartwell2024!", 12);

const prisma = new PrismaClient();

// Dates relative to today (2026-04-19)
const TODAY = new Date("2026-04-19T10:00:00.000Z");
function D(offsetDays: number): Date {
  const d = new Date(TODAY);
  d.setDate(d.getDate() + offsetDays);
  return d;
}

function resolveTemplate(
  template: string,
  vars: { agent: string; vendors: string; purchasers: string; solicitor: string }
): string {
  return template
    .replace("{agent}", vars.agent)
    .replace("{vendors}", vars.vendors)
    .replace("{purchasers}", vars.purchasers)
    .replace("{solicitor}", vars.solicitor);
}

// Complete the first N milestones from a sorted list, spread across a date range
async function completeN(
  txId: string,
  defs: Array<{ id: string; summaryTemplate: string; orderIndex: number }>,
  n: number,
  userId: string,
  vars: { agent: string; vendors: string; purchasers: string; solicitor: string },
  oldestDaysAgo: number
) {
  const slice = defs.slice(0, n);
  for (let i = 0; i < slice.length; i++) {
    const progress = slice.length === 1 ? 1 : i / (slice.length - 1);
    const daysAgo = Math.round(oldestDaysAgo * (1 - progress));
    await prisma.milestoneCompletion.create({
      data: {
        transactionId: txId,
        milestoneDefinitionId: slice[i].id,
        isActive: true,
        completedAt: D(-(oldestDaysAgo - Math.round(progress * (oldestDaysAgo - 1)))),
        completedById: userId,
        summaryText: slice[i].summaryTemplate
          ? resolveTemplate(slice[i].summaryTemplate, vars)
          : null,
      },
    });
  }
}

// Mark milestones as not required (e.g. mortgage steps for cash purchases)
async function markNotRequired(
  txId: string,
  defs: Array<{ id: string }>,
  codes: string[],
  codeToId: Map<string, string>,
  userId: string,
  reason: string
) {
  for (const code of codes) {
    const id = codeToId.get(code);
    if (!id) continue;
    await prisma.milestoneCompletion.create({
      data: {
        transactionId: txId,
        milestoneDefinitionId: id,
        isActive: true,
        isNotRequired: true,
        notRequiredReason: reason,
        completedAt: D(-20),
        completedById: userId,
        summaryText: null,
      },
    });
  }
}

// Create an active reminder log + a chase task
async function addReminder(
  txId: string,
  ruleId: string,
  userId: string,
  dueDaysOffset: number, // negative = overdue
  priority: TaskPriority,
  chaseCount: number,
  notes?: string
) {
  const log = await prisma.reminderLog.create({
    data: {
      transactionId: txId,
      reminderRuleId: ruleId,
      status: "active",
      nextDueDate: D(dueDaysOffset),
    },
  });
  await prisma.chaseTask.create({
    data: {
      transactionId: txId,
      reminderLogId: log.id,
      assignedToId: userId,
      dueDate: D(dueDaysOffset),
      status: "pending",
      priority,
      chaseCount,
      notes: notes ?? null,
    },
  });
  return log;
}

// Create a completed chase task (historical)
async function addDoneReminder(
  txId: string,
  ruleId: string,
  userId: string,
  doneDaysAgo: number
) {
  const log = await prisma.reminderLog.create({
    data: {
      transactionId: txId,
      reminderRuleId: ruleId,
      status: "completed",
      nextDueDate: D(-doneDaysAgo),
    },
  });
  await prisma.chaseTask.create({
    data: {
      transactionId: txId,
      reminderLogId: log.id,
      assignedToId: userId,
      dueDate: D(-doneDaysAgo),
      status: "done",
      priority: "normal",
      chaseCount: 1,
    },
  });
}

async function addComm(
  txId: string,
  userId: string,
  type: CommType,
  method: CommMethod | null,
  content: string,
  contactIds: string[],
  daysAgo: number
) {
  await prisma.communicationRecord.create({
    data: {
      transactionId: txId,
      createdById: userId,
      type,
      method: method ?? undefined,
      contactIds,
      content,
      createdAt: D(-daysAgo),
    },
  });
}

async function addNote(txId: string, userId: string, content: string, daysAgo: number) {
  await prisma.transactionNote.create({
    data: {
      transactionId: txId,
      content,
      createdById: userId,
      createdAt: D(-daysAgo),
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log("🌱 Seeding database...");

  // ── Cleanup ───────────────────────────────────────────────────────────────
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
  await prisma.communicationRecord.deleteMany();
  await prisma.chaseTask.deleteMany();
  await prisma.propertyChain.deleteMany();
  await prisma.propertyTransaction.deleteMany();
  await prisma.solicitorContact.deleteMany();
  await prisma.solicitorFirm.deleteMany();
  await prisma.session.deleteMany();
  await prisma.account.deleteMany();
  await prisma.user.deleteMany();
  await prisma.agency.deleteMany();

  // ── Agency & Users ────────────────────────────────────────────────────────
  const agency = await prisma.agency.create({ data: { name: "Hartwell & Partners" } });

  const sarah = await prisma.user.create({
    data: { name: "Sarah Hartwell", email: "sarah@hartwellpartners.co.uk", role: UserRole.admin, agencyId: agency.id, password: TEST_PASSWORD },
  });
  await prisma.user.create({
    data: { name: "Ellis Askey", email: "ellisaskey@googlemail.com", role: UserRole.admin, agencyId: agency.id, password: TEST_PASSWORD },
  });
  await prisma.user.create({
    data: { name: "Ellis Askey", email: "ellis@thesalesprogressor.co.uk", role: UserRole.admin, agencyId: agency.id, password: TEST_PASSWORD },
  });
  const james = await prisma.user.create({
    data: { name: "James Okafor", email: "james@hartwellpartners.co.uk", role: UserRole.sales_progressor, agencyId: agency.id, password: TEST_PASSWORD },
  });
  const emily = await prisma.user.create({
    data: { name: "Emily Chen", email: "emily@hartwellpartners.co.uk", role: UserRole.negotiator, agencyId: agency.id, password: TEST_PASSWORD, firmName: "Hartwell & Partners" },
  });
  console.log("✓ Agency and users");

  // ── Milestone Definitions ─────────────────────────────────────────────────
  const vendorDefs = [
    { code: "VM1",  orderIndex: 1,  blocksExchange: true,  timeSensitive: false, isExchangeGate: false, isPostExchange: false, name: "Seller has instructed their solicitor", summaryTemplate: "{agent} confirmed that {vendors} have instructed their solicitor" },
    { code: "VM2",  orderIndex: 2,  blocksExchange: true,  timeSensitive: false, isExchangeGate: false, isPostExchange: false, name: "Seller has received the memorandum of sale", summaryTemplate: "{agent} confirmed that {vendors} have received the memorandum of sale" },
    { code: "VM3",  orderIndex: 3,  blocksExchange: true,  timeSensitive: false, isExchangeGate: false, isPostExchange: false, name: "Seller has received the welcome pack from their solicitor", summaryTemplate: "{agent} confirmed that {vendors} have received their welcome pack from their solicitor" },
    { code: "VM14", orderIndex: 4,  blocksExchange: true,  timeSensitive: false, isExchangeGate: false, isPostExchange: false, name: "Seller has completed ID and AML checks with their solicitor", summaryTemplate: "{agent} confirmed that {vendors} have completed their ID and AML checks" },
    { code: "VM15", orderIndex: 5,  blocksExchange: true,  timeSensitive: false, isExchangeGate: false, isPostExchange: false, name: "Seller has received the property information forms from their solicitor", summaryTemplate: "{agent} confirmed that {vendors} have received the property information forms from their solicitor" },
    { code: "VM4",  orderIndex: 6,  blocksExchange: true,  timeSensitive: false, isExchangeGate: false, isPostExchange: false, name: "Seller has returned completed property information forms to their solicitor", summaryTemplate: "{agent} confirmed that {vendors} have returned their completed property information forms" },
    { code: "VM5",  orderIndex: 7,  blocksExchange: true,  timeSensitive: false, isExchangeGate: false, isPostExchange: false, name: "Seller's solicitor has issued the draft contract pack", summaryTemplate: "{agent} received confirmation from {solicitor} that the draft contract pack has been issued" },
    { code: "VM6",  orderIndex: 8,  blocksExchange: true,  timeSensitive: false, isExchangeGate: false, isPostExchange: false, name: "Seller's solicitor has requested the management pack", summaryTemplate: "{agent} received confirmation from {solicitor} that the management pack has been requested" },
    { code: "VM7",  orderIndex: 9,  blocksExchange: true,  timeSensitive: false, isExchangeGate: false, isPostExchange: false, name: "Seller's solicitor has received the management pack", summaryTemplate: "{agent} received confirmation from {solicitor} that the management pack has been received" },
    { code: "VM16", orderIndex: 10, blocksExchange: true,  timeSensitive: false, isExchangeGate: false, isPostExchange: false, name: "Seller's solicitor has received initial enquiries", summaryTemplate: "{agent} received confirmation from {solicitor} that initial enquiries have been received from the buyer's solicitor" },
    { code: "VM17", orderIndex: 11, blocksExchange: true,  timeSensitive: false, isExchangeGate: false, isPostExchange: false, name: "Seller has provided initial replies to their solicitor", summaryTemplate: "{agent} confirmed that {vendors} have provided their initial replies to their solicitor" },
    { code: "VM8",  orderIndex: 12, blocksExchange: true,  timeSensitive: false, isExchangeGate: false, isPostExchange: false, name: "Seller's solicitor has issued initial responses to the buyer's solicitor", summaryTemplate: "{agent} received confirmation from {solicitor} that initial replies have been issued to the buyer's solicitor" },
    { code: "VM18", orderIndex: 13, blocksExchange: true,  timeSensitive: false, isExchangeGate: false, isPostExchange: false, name: "Seller's solicitor has received additional enquiries", summaryTemplate: "{agent} received confirmation from {solicitor} that further enquiries have been received" },
    { code: "VM19", orderIndex: 14, blocksExchange: true,  timeSensitive: false, isExchangeGate: false, isPostExchange: false, name: "Seller has provided additional replies to their solicitor", summaryTemplate: "{agent} confirmed that {vendors} have provided their further replies to their solicitor" },
    { code: "VM9",  orderIndex: 15, blocksExchange: true,  timeSensitive: false, isExchangeGate: false, isPostExchange: false, name: "Seller's solicitor has issued additional responses to the buyer's solicitor", summaryTemplate: "{agent} received confirmation from {solicitor} that further replies have been issued to the buyer's solicitor" },
    { code: "VM10", orderIndex: 16, blocksExchange: true,  timeSensitive: false, isExchangeGate: false, isPostExchange: false, name: "Seller's solicitor has issued contract documents to the seller", summaryTemplate: "{agent} received confirmation from {solicitor} that contract documents have been issued to {vendors}" },
    { code: "VM11", orderIndex: 17, blocksExchange: true,  timeSensitive: false, isExchangeGate: false, isPostExchange: false, name: "Seller's solicitor has received signed contract documents back from the seller", summaryTemplate: "{agent} confirmed that {vendors} have returned their signed contract documents to their solicitor" },
    { code: "VM20", orderIndex: 18, blocksExchange: false, timeSensitive: false, isExchangeGate: true,  isPostExchange: false, name: "Seller's solicitor has confirmed readiness to exchange", summaryTemplate: "{agent} received confirmation from {solicitor} that they are ready to exchange" },
    { code: "VM12", orderIndex: 19, blocksExchange: false, timeSensitive: false, isExchangeGate: false, isPostExchange: true,  name: "Seller has received confirmation that contracts have exchanged", summaryTemplate: "{agent} confirmed that contracts have successfully exchanged" },
    { code: "VM13", orderIndex: 20, blocksExchange: false, timeSensitive: false, isExchangeGate: false, isPostExchange: true,  name: "Seller has received confirmation that the sale has completed", summaryTemplate: "{agent} confirmed that the sale of {vendors}'s property has completed" },
  ];

  const purchaserDefs = [
    { code: "PM1",   orderIndex: 1,  blocksExchange: true,  timeSensitive: false, isExchangeGate: false, isPostExchange: false, name: "Buyer has instructed their solicitor", summaryTemplate: "{agent} confirmed that {purchasers} have instructed their solicitor" },
    { code: "PM2",   orderIndex: 2,  blocksExchange: true,  timeSensitive: false, isExchangeGate: false, isPostExchange: false, name: "Buyer has received the memorandum of sale", summaryTemplate: "{agent} confirmed that {purchasers} have received the memorandum of sale" },
    { code: "PM14a", orderIndex: 3,  blocksExchange: true,  timeSensitive: false, isExchangeGate: false, isPostExchange: false, name: "Buyer has completed ID and AML checks with their solicitor", summaryTemplate: "{agent} confirmed that {purchasers} have completed their ID and AML checks with their solicitor" },
    { code: "PM15a", orderIndex: 4,  blocksExchange: true,  timeSensitive: false, isExchangeGate: false, isPostExchange: false, name: "Buyer has paid money on account to their solicitor", summaryTemplate: "{agent} confirmed that {purchasers} have paid money on account to their solicitor" },
    { code: "PM4",   orderIndex: 5,  blocksExchange: true,  timeSensitive: false, isExchangeGate: false, isPostExchange: false, name: "Buyer has submitted their mortgage application", summaryTemplate: "{agent} confirmed that {purchasers} have submitted their mortgage application" },
    { code: "PM5",   orderIndex: 6,  blocksExchange: true,  timeSensitive: true,  isExchangeGate: false, isPostExchange: false, name: "Lender valuation has been booked", summaryTemplate: "{agent} confirmed that the lender valuation has been booked for {purchasers}" },
    { code: "PM3",   orderIndex: 7,  blocksExchange: true,  timeSensitive: false, isExchangeGate: false, isPostExchange: false, name: "Buyer's solicitor has received the draft contract pack", summaryTemplate: "{agent} confirmed that {purchasers}'s solicitor has received the draft contract pack" },
    { code: "PM9",   orderIndex: 8,  blocksExchange: true,  timeSensitive: false, isExchangeGate: false, isPostExchange: false, name: "Buyer's solicitor has ordered searches", summaryTemplate: "{agent} confirmed that {purchasers}'s solicitor has ordered the searches" },
    { code: "PM7",   orderIndex: 9,  blocksExchange: true,  timeSensitive: true,  isExchangeGate: false, isPostExchange: false, name: "Buyer has booked a Level 2 or Level 3 survey", summaryTemplate: "{agent} confirmed that {purchasers} have booked their survey" },
    { code: "PM20",  orderIndex: 10, blocksExchange: true,  timeSensitive: false, isExchangeGate: false, isPostExchange: false, name: "Buyer has received the survey report", summaryTemplate: "{agent} confirmed that {purchasers} have received their survey report" },
    { code: "PM6",   orderIndex: 11, blocksExchange: true,  timeSensitive: false, isExchangeGate: false, isPostExchange: false, name: "Buyer's solicitor has received the mortgage offer", summaryTemplate: "{agent} confirmed that {purchasers}'s solicitor has received the mortgage offer" },
    { code: "PM8",   orderIndex: 12, blocksExchange: true,  timeSensitive: false, isExchangeGate: false, isPostExchange: false, name: "Buyer's solicitor has received the management pack from the vendor's solicitor", summaryTemplate: "{agent} confirmed that {purchasers}'s solicitor has received the management pack" },
    { code: "PM10",  orderIndex: 13, blocksExchange: true,  timeSensitive: false, isExchangeGate: false, isPostExchange: false, name: "Buyer's solicitor has received the search results", summaryTemplate: "{agent} confirmed that {purchasers}'s solicitor has received the search results" },
    { code: "PM11",  orderIndex: 14, blocksExchange: true,  timeSensitive: false, isExchangeGate: false, isPostExchange: false, name: "Buyer's solicitor has raised initial enquiries to the seller's solicitor", summaryTemplate: "{agent} confirmed that {purchasers}'s solicitor has raised their initial enquiries" },
    { code: "PM21",  orderIndex: 15, blocksExchange: true,  timeSensitive: false, isExchangeGate: false, isPostExchange: false, name: "Buyer's solicitor has received initial replies from the seller's solicitor", summaryTemplate: "{agent} confirmed that {purchasers}'s solicitor has received the initial replies from {solicitor}" },
    { code: "PM22",  orderIndex: 16, blocksExchange: true,  timeSensitive: false, isExchangeGate: false, isPostExchange: false, name: "Buyer's solicitor has reviewed the initial replies", summaryTemplate: "{agent} confirmed that {purchasers}'s solicitor has reviewed the initial replies" },
    { code: "PM12",  orderIndex: 17, blocksExchange: true,  timeSensitive: false, isExchangeGate: false, isPostExchange: false, name: "Buyer's solicitor has raised additional enquiries", summaryTemplate: "{agent} confirmed that {purchasers}'s solicitor has raised further enquiries" },
    { code: "PM23",  orderIndex: 18, blocksExchange: true,  timeSensitive: false, isExchangeGate: false, isPostExchange: false, name: "Buyer's solicitor has received additional replies", summaryTemplate: "{agent} confirmed that {purchasers}'s solicitor has received the further replies from {solicitor}" },
    { code: "PM24",  orderIndex: 19, blocksExchange: true,  timeSensitive: false, isExchangeGate: false, isPostExchange: false, name: "Buyer's solicitor has reviewed the additional replies", summaryTemplate: "{agent} confirmed that {purchasers}'s solicitor has reviewed the further replies" },
    { code: "PM25",  orderIndex: 20, blocksExchange: true,  timeSensitive: false, isExchangeGate: false, isPostExchange: false, name: "Buyer's solicitor has confirmed all enquiries are now satisfied", summaryTemplate: "{agent} confirmed that all enquiries are now satisfied and {purchasers}'s solicitor is happy to proceed" },
    { code: "PM26",  orderIndex: 21, blocksExchange: true,  timeSensitive: false, isExchangeGate: false, isPostExchange: false, name: "Buyer has received the final report from their solicitor", summaryTemplate: "{agent} confirmed that {purchasers} have received their final report from their solicitor" },
    { code: "PM13",  orderIndex: 22, blocksExchange: true,  timeSensitive: false, isExchangeGate: false, isPostExchange: false, name: "Buyer's solicitor has issued contract documents to the buyer", summaryTemplate: "{agent} confirmed that {purchasers}'s solicitor has issued contract documents for signing" },
    { code: "PM14b", orderIndex: 23, blocksExchange: true,  timeSensitive: false, isExchangeGate: false, isPostExchange: false, name: "Buyer's solicitor has received the signed contract documents back from the buyer", summaryTemplate: "{agent} confirmed that {purchasers} have returned their signed contract documents" },
    { code: "PM15b", orderIndex: 24, blocksExchange: true,  timeSensitive: false, isExchangeGate: false, isPostExchange: false, name: "Buyer has transferred the deposit", summaryTemplate: "{agent} confirmed that {purchasers} have transferred the deposit to their solicitor" },
    { code: "PM27",  orderIndex: 25, blocksExchange: false, timeSensitive: false, isExchangeGate: true,  isPostExchange: false, name: "Buyer's solicitor has confirmed readiness to exchange", summaryTemplate: "{agent} confirmed that {purchasers}'s solicitor is ready to exchange" },
    { code: "PM16",  orderIndex: 26, blocksExchange: false, timeSensitive: false, isExchangeGate: false, isPostExchange: true,  name: "Buyer has received confirmation that contracts have exchanged", summaryTemplate: "{agent} confirmed that contracts have exchanged — congratulations to {purchasers}" },
    { code: "PM17",  orderIndex: 27, blocksExchange: false, timeSensitive: false, isExchangeGate: false, isPostExchange: true,  name: "Buyer has received confirmation that the sale has completed", summaryTemplate: "{agent} confirmed that the purchase has completed — {purchasers} are now the proud owners" },
  ];

  const defIdMap = new Map<string, string>();
  for (const m of vendorDefs) {
    const d = await prisma.milestoneDefinition.create({ data: { ...m, side: MilestoneSide.vendor } });
    defIdMap.set(m.code, d.id);
  }
  for (const m of purchaserDefs) {
    const d = await prisma.milestoneDefinition.create({ data: { ...m, side: MilestoneSide.purchaser } });
    defIdMap.set(m.code, d.id);
  }
  console.log(`✓ Milestone definitions: ${vendorDefs.length} vendor, ${purchaserDefs.length} purchaser`);

  // Get sorted def objects for slicing
  const vmDefs = (await prisma.milestoneDefinition.findMany({ where: { side: "vendor" }, orderBy: { orderIndex: "asc" } }));
  const pmDefs = (await prisma.milestoneDefinition.findMany({ where: { side: "purchaser" }, orderBy: { orderIndex: "asc" } }));

  // ── Reminder Rules ────────────────────────────────────────────────────────
  const rules = [
    { name: "Chase: Seller instructed solicitor",                              targetMilestoneCode: "VM1",   anchorCode: null,    graceDays: 2,  repeatEveryDays: 3,  escalateAfterChases: 3, requiresExchangeReady: false, useEventDate: false },
    { name: "Chase: Seller MOS received",                                      targetMilestoneCode: "VM2",   anchorCode: null,    graceDays: 1,  repeatEveryDays: 2,  escalateAfterChases: 2, requiresExchangeReady: false, useEventDate: false },
    { name: "Chase: Seller welcome pack received",                             targetMilestoneCode: "VM3",   anchorCode: "VM1",   graceDays: 3,  repeatEveryDays: 5,  escalateAfterChases: 3, requiresExchangeReady: false, useEventDate: false },
    { name: "Chase: Seller ID & AML completed",                               targetMilestoneCode: "VM14",  anchorCode: "VM1",   graceDays: 3,  repeatEveryDays: 5,  escalateAfterChases: 3, requiresExchangeReady: false, useEventDate: false },
    { name: "Chase: Seller property information forms received",               targetMilestoneCode: "VM15",  anchorCode: "VM3",   graceDays: 5,  repeatEveryDays: 3,  escalateAfterChases: 3, requiresExchangeReady: false, useEventDate: false },
    { name: "Chase: Seller property information forms returned",               targetMilestoneCode: "VM4",   anchorCode: "VM15",  graceDays: 5,  repeatEveryDays: 3,  escalateAfterChases: 3, requiresExchangeReady: false, useEventDate: false },
    { name: "Chase: Draft contract pack issued",                               targetMilestoneCode: "VM5",   anchorCode: "VM4",   graceDays: 5,  repeatEveryDays: 3,  escalateAfterChases: 3, requiresExchangeReady: false, useEventDate: false },
    { name: "Chase: Management pack requested",                                targetMilestoneCode: "VM6",   anchorCode: null,    graceDays: 3,  repeatEveryDays: 5,  escalateAfterChases: 3, requiresExchangeReady: false, useEventDate: false },
    { name: "Chase: Management pack received (seller)",                        targetMilestoneCode: "VM7",   anchorCode: "VM6",   graceDays: 21, repeatEveryDays: 7,  escalateAfterChases: 2, requiresExchangeReady: false, useEventDate: false },
    { name: "Chase: Initial enquiries received by seller's solicitor",         targetMilestoneCode: "VM16",  anchorCode: "PM11",  graceDays: 3,  repeatEveryDays: 5,  escalateAfterChases: 3, requiresExchangeReady: false, useEventDate: false },
    { name: "Chase: Seller initial replies provided to solicitor",             targetMilestoneCode: "VM17",  anchorCode: "VM16",  graceDays: 5,  repeatEveryDays: 5,  escalateAfterChases: 3, requiresExchangeReady: false, useEventDate: false },
    { name: "Chase: Initial replies issued by seller's solicitor",             targetMilestoneCode: "VM8",   anchorCode: "VM17",  graceDays: 2,  repeatEveryDays: 3,  escalateAfterChases: 3, requiresExchangeReady: false, useEventDate: false },
    { name: "Chase: Further enquiries received by seller's solicitor",         targetMilestoneCode: "VM18",  anchorCode: "PM12",  graceDays: 3,  repeatEveryDays: 5,  escalateAfterChases: 3, requiresExchangeReady: false, useEventDate: false },
    { name: "Chase: Seller further replies provided to solicitor",             targetMilestoneCode: "VM19",  anchorCode: "VM18",  graceDays: 5,  repeatEveryDays: 5,  escalateAfterChases: 3, requiresExchangeReady: false, useEventDate: false },
    { name: "Chase: Further replies issued by seller's solicitor",             targetMilestoneCode: "VM9",   anchorCode: "VM19",  graceDays: 2,  repeatEveryDays: 2,  escalateAfterChases: 3, requiresExchangeReady: false, useEventDate: false },
    { name: "Chase: Contract documents issued to seller",                      targetMilestoneCode: "VM10",  anchorCode: "VM5",   graceDays: 3,  repeatEveryDays: 5,  escalateAfterChases: 3, requiresExchangeReady: false, useEventDate: false },
    { name: "Chase: Signed contracts returned by seller",                      targetMilestoneCode: "VM11",  anchorCode: "VM10",  graceDays: 5,  repeatEveryDays: 5,  escalateAfterChases: 3, requiresExchangeReady: false, useEventDate: false },
    { name: "Chase: Seller's solicitor ready to exchange",                     targetMilestoneCode: "VM20",  anchorCode: "VM11",  graceDays: 2,  repeatEveryDays: 2,  escalateAfterChases: 2, requiresExchangeReady: true,  useEventDate: false },
    { name: "Chase: Contracts exchanged (seller)",                             targetMilestoneCode: "VM12",  anchorCode: "VM20",  graceDays: 1,  repeatEveryDays: 2,  escalateAfterChases: 1, requiresExchangeReady: false, useEventDate: false },
    { name: "Chase: Sale completed (seller)",                                  targetMilestoneCode: "VM13",  anchorCode: "VM12",  graceDays: 1,  repeatEveryDays: 1,  escalateAfterChases: 2, requiresExchangeReady: false, useEventDate: false },
    { name: "Chase: Buyer instructed solicitor",                               targetMilestoneCode: "PM1",   anchorCode: null,    graceDays: 2,  repeatEveryDays: 3,  escalateAfterChases: 3, requiresExchangeReady: false, useEventDate: false },
    { name: "Chase: Buyer MOS received",                                       targetMilestoneCode: "PM2",   anchorCode: null,    graceDays: 1,  repeatEveryDays: 2,  escalateAfterChases: 2, requiresExchangeReady: false, useEventDate: false },
    { name: "Chase: Buyer ID & AML completed",                                 targetMilestoneCode: "PM14a", anchorCode: "PM1",   graceDays: 3,  repeatEveryDays: 5,  escalateAfterChases: 3, requiresExchangeReady: false, useEventDate: false },
    { name: "Chase: Buyer money paid on account",                              targetMilestoneCode: "PM15a", anchorCode: "PM1",   graceDays: 5,  repeatEveryDays: 5,  escalateAfterChases: 3, requiresExchangeReady: false, useEventDate: false },
    { name: "Chase: Draft contract pack received by buyer's solicitor",        targetMilestoneCode: "PM3",   anchorCode: "VM5",   graceDays: 2,  repeatEveryDays: 3,  escalateAfterChases: 3, requiresExchangeReady: false, useEventDate: false },
    { name: "Chase: Buyer mortgage application submitted",                     targetMilestoneCode: "PM4",   anchorCode: null,    graceDays: 3,  repeatEveryDays: 5,  escalateAfterChases: 3, requiresExchangeReady: false, useEventDate: false },
    { name: "Chase: Lender valuation booked",                                  targetMilestoneCode: "PM5",   anchorCode: "PM4",   graceDays: 7,  repeatEveryDays: 7,  escalateAfterChases: 2, requiresExchangeReady: false, useEventDate: false },
    { name: "Chase: Mortgage offer received",                                  targetMilestoneCode: "PM6",   anchorCode: "PM5",   graceDays: 14, repeatEveryDays: 5,  escalateAfterChases: 3, requiresExchangeReady: false, useEventDate: true  },
    { name: "Chase: Survey booked",                                            targetMilestoneCode: "PM7",   anchorCode: null,    graceDays: 7,  repeatEveryDays: 5,  escalateAfterChases: 3, requiresExchangeReady: false, useEventDate: false },
    { name: "Chase: Survey report received",                                   targetMilestoneCode: "PM20",  anchorCode: "PM7",   graceDays: 7,  repeatEveryDays: 5,  escalateAfterChases: 3, requiresExchangeReady: false, useEventDate: true  },
    { name: "Chase: Management pack received (buyer)",                         targetMilestoneCode: "PM8",   anchorCode: "VM7",   graceDays: 3,  repeatEveryDays: 10, escalateAfterChases: 3, requiresExchangeReady: false, useEventDate: false },
    { name: "Chase: Searches ordered",                                         targetMilestoneCode: "PM9",   anchorCode: "PM3",   graceDays: 3,  repeatEveryDays: 3,  escalateAfterChases: 3, requiresExchangeReady: false, useEventDate: false },
    { name: "Chase: Search results received",                                  targetMilestoneCode: "PM10",  anchorCode: "PM9",   graceDays: 21, repeatEveryDays: 7,  escalateAfterChases: 3, requiresExchangeReady: false, useEventDate: false },
    { name: "Chase: Initial enquiries raised by buyer's solicitor",            targetMilestoneCode: "PM11",  anchorCode: "PM3",   graceDays: 5,  repeatEveryDays: 5,  escalateAfterChases: 3, requiresExchangeReady: false, useEventDate: false },
    { name: "Chase: Initial replies received by buyer's solicitor",            targetMilestoneCode: "PM21",  anchorCode: "VM8",   graceDays: 14, repeatEveryDays: 3,  escalateAfterChases: 3, requiresExchangeReady: false, useEventDate: false },
    { name: "Chase: Initial replies reviewed by buyer's solicitor",            targetMilestoneCode: "PM22",  anchorCode: "PM21",  graceDays: 3,  repeatEveryDays: 3,  escalateAfterChases: 3, requiresExchangeReady: false, useEventDate: false },
    { name: "Chase: Further enquiries raised by buyer's solicitor",            targetMilestoneCode: "PM12",  anchorCode: "PM22",  graceDays: 3,  repeatEveryDays: 3,  escalateAfterChases: 3, requiresExchangeReady: false, useEventDate: false },
    { name: "Chase: Further replies received by buyer's solicitor",            targetMilestoneCode: "PM23",  anchorCode: "VM9",   graceDays: 14, repeatEveryDays: 7,  escalateAfterChases: 3, requiresExchangeReady: false, useEventDate: false },
    { name: "Chase: Further replies reviewed by buyer's solicitor",            targetMilestoneCode: "PM24",  anchorCode: "PM23",  graceDays: 3,  repeatEveryDays: 3,  escalateAfterChases: 3, requiresExchangeReady: false, useEventDate: false },
    { name: "Chase: All enquiries satisfied",                                  targetMilestoneCode: "PM25",  anchorCode: "PM24",  graceDays: 3,  repeatEveryDays: 3,  escalateAfterChases: 3, requiresExchangeReady: false, useEventDate: false },
    { name: "Chase: Final report received by buyer",                           targetMilestoneCode: "PM26",  anchorCode: "PM25",  graceDays: 3,  repeatEveryDays: 3,  escalateAfterChases: 3, requiresExchangeReady: false, useEventDate: false },
    { name: "Chase: Contract documents received by buyer",                     targetMilestoneCode: "PM13",  anchorCode: "PM26",  graceDays: 3,  repeatEveryDays: 3,  escalateAfterChases: 3, requiresExchangeReady: false, useEventDate: false },
    { name: "Chase: Signed contracts returned by buyer",                       targetMilestoneCode: "PM14b", anchorCode: "PM13",  graceDays: 5,  repeatEveryDays: 5,  escalateAfterChases: 3, requiresExchangeReady: false, useEventDate: false },
    { name: "Chase: Deposit transferred by buyer",                             targetMilestoneCode: "PM15b", anchorCode: "PM14b", graceDays: 3,  repeatEveryDays: 3,  escalateAfterChases: 3, requiresExchangeReady: false, useEventDate: false },
    { name: "Chase: Buyer's solicitor ready to exchange",                      targetMilestoneCode: "PM27",  anchorCode: "PM15b", graceDays: 2,  repeatEveryDays: 2,  escalateAfterChases: 3, requiresExchangeReady: true,  useEventDate: false },
    { name: "Chase: Contracts exchanged (buyer)",                              targetMilestoneCode: "PM16",  anchorCode: "PM27",  graceDays: 1,  repeatEveryDays: 2,  escalateAfterChases: 1, requiresExchangeReady: false, useEventDate: false },
    { name: "Chase: Purchase completed",                                       targetMilestoneCode: "PM17",  anchorCode: "PM16",  graceDays: 1,  repeatEveryDays: 1,  escalateAfterChases: 2, requiresExchangeReady: false, useEventDate: false },
  ];

  const ruleByCode = new Map<string, string>(); // targetCode → ruleId
  for (const rule of rules) {
    const { anchorCode, ...rest } = rule;
    const anchorMilestoneId = anchorCode ? (defIdMap.get(anchorCode) ?? null) : null;
    const created = await prisma.reminderRule.create({ data: { ...rest, anchorMilestoneId } });
    if (rest.targetMilestoneCode && !ruleByCode.has(rest.targetMilestoneCode)) {
      ruleByCode.set(rest.targetMilestoneCode, created.id);
    }
  }
  console.log(`✓ Reminder rules: ${rules.length}`);

  // ── Solicitor Firms ───────────────────────────────────────────────────────
  const firmThornton = await prisma.solicitorFirm.create({ data: { agencyId: agency.id, name: "Thornton & Co Solicitors" } });
  const contactThorntonHenry = await prisma.solicitorContact.create({ data: { firmId: firmThornton.id, name: "Henry Thornton", email: "henry@thorntonco.co.uk", phone: "0117 922 3400" } });
  const contactThorntonSarah = await prisma.solicitorContact.create({ data: { firmId: firmThornton.id, name: "Sarah Marsh", email: "s.marsh@thorntonco.co.uk", phone: "0117 922 3401" } });

  const firmDevlin = await prisma.solicitorFirm.create({ data: { agencyId: agency.id, name: "Devlin Law LLP" } });
  const contactDevlinMark = await prisma.solicitorContact.create({ data: { firmId: firmDevlin.id, name: "Mark Devlin", email: "mark@devlinlaw.co.uk", phone: "0117 900 1234" } });
  const contactDevlinPriya = await prisma.solicitorContact.create({ data: { firmId: firmDevlin.id, name: "Priya Anand", email: "p.anand@devlinlaw.co.uk", phone: "0117 900 1235" } });

  const firmAndersons = await prisma.solicitorFirm.create({ data: { agencyId: agency.id, name: "Andersons Property Law" } });
  const contactAndersonLucy = await prisma.solicitorContact.create({ data: { firmId: firmAndersons.id, name: "Lucy Anderson", email: "l.anderson@aplaw.co.uk", phone: "0117 435 8800" } });

  const firmWright = await prisma.solicitorFirm.create({ data: { agencyId: agency.id, name: "Wright & Hughes LLP" } });
  const contactWrightTom = await prisma.solicitorContact.create({ data: { firmId: firmWright.id, name: "Tom Wright", email: "t.wright@whlegal.co.uk", phone: "0117 332 9900" } });

  console.log("✓ Solicitor firms and contacts");

  // ═══════════════════════════════════════════════════════════════════════════
  // TRANSACTION 1 — 14 Elmwood Avenue, Clifton
  // Near exchange. All pre-exchange milestones done, both solicitors nearly ready.
  // Exchange target: 14 days away. Active chases on exchange gate.
  // ═══════════════════════════════════════════════════════════════════════════
  const tx1 = await prisma.propertyTransaction.create({
    data: {
      propertyAddress: "14 Elmwood Avenue, Clifton, Bristol, BS8 2TH",
      status: TransactionStatus.active,
      agencyId: agency.id,
      assignedUserId: james.id,
      expectedExchangeDate: D(14),
      purchasePrice: 48500000, // £485,000 in pence
      tenure: Tenure.freehold,
      purchaseType: PurchaseType.mortgage,
      vendorSolicitorFirmId: firmThornton.id,
      vendorSolicitorContactId: contactThorntonHenry.id,
      purchaserSolicitorFirmId: firmDevlin.id,
      purchaserSolicitorContactId: contactDevlinMark.id,
      createdAt: D(-42),
    },
  });
  const tx1V = await prisma.contact.create({ data: { propertyTransactionId: tx1.id, name: "Robert Fielding", email: "r.fielding@email.com", phone: "07712 334 556", roleType: ContactRole.vendor, portalToken: randomUUID() } });
  const tx1V2 = await prisma.contact.create({ data: { propertyTransactionId: tx1.id, name: "Anna Fielding", email: "anna.fielding@email.com", phone: "07712 334 557", roleType: ContactRole.vendor, portalToken: randomUUID() } });
  const tx1P = await prisma.contact.create({ data: { propertyTransactionId: tx1.id, name: "Marcus Webb", email: "m.webb@email.com", phone: "07890 123 456", roleType: ContactRole.purchaser, portalToken: randomUUID() } });
  const tx1Vars = { agent: "James", vendors: "Robert and Anna", purchasers: "Marcus", solicitor: "Thornton & Co" };
  // All 17 pre-exchange vendor milestones complete
  await completeN(tx1.id, vmDefs, 17, james.id, tx1Vars, 40);
  // All 24 pre-exchange purchaser milestones complete
  await completeN(tx1.id, pmDefs, 24, james.id, tx1Vars, 40);
  // Active chase: VM20 (seller solicitor not yet confirmed ready), 2 days overdue
  await addReminder(tx1.id, ruleByCode.get("VM20")!, james.id, -2, "normal", 2, "Henry at Thornton & Co said confirmation expected by end of week");
  // Active chase: PM27 (buyer solicitor not yet confirmed ready), due tomorrow
  await addReminder(tx1.id, ruleByCode.get("PM27")!, james.id, 1, "normal", 1);
  // Historical done chases
  await addDoneReminder(tx1.id, ruleByCode.get("VM11")!, james.id, 7);
  await addDoneReminder(tx1.id, ruleByCode.get("PM15b")!, james.id, 5);
  // Communications
  await addComm(tx1.id, james.id, "outbound", "phone", "Called Henry Thornton (Thornton & Co) to chase exchange readiness. He confirmed he just needs client sign-off on one outstanding point and will revert by Friday.", [tx1V.id], 2);
  await addComm(tx1.id, james.id, "inbound", "email", "Marcus emailed to ask when exchange is expected. Replied to confirm we are targeting the 3rd May and everything is progressing well on both sides.", [tx1P.id], 3);
  await addComm(tx1.id, james.id, "outbound", "phone", "Spoke with Mark Devlin at Devlin Law. Buyer's solicitor is happy with all enquiries and just waiting for confirmed exchange date from seller's side.", [tx1P.id], 4);
  await addComm(tx1.id, james.id, "outbound", "email", "Chased Thornton & Co by email re: readiness to exchange. Attached copy of buyer's solicitor confirmation.", [], 2);
  await addComm(tx1.id, james.id, "inbound", "phone", "Robert called to check in. Very keen to exchange and complete before end of May. Reassured him we're on track.", [tx1V.id], 6);
  await addNote(tx1.id, james.id, "Henry Thornton at Thornton & Co flagged a minor title issue with the conservatory extension — no planning permission. Indemnity insurance being arranged, should not delay exchange.", 5);

  // ═══════════════════════════════════════════════════════════════════════════
  // TRANSACTION 2 — 83 Victoria Park Road, Clifton (URGENT)
  // Very close to exchange target (9 days). Both exchange gates overdue — escalated.
  // ═══════════════════════════════════════════════════════════════════════════
  const tx2 = await prisma.propertyTransaction.create({
    data: {
      propertyAddress: "83 Victoria Park Road, Clifton, Bristol, BS8 1BA",
      status: TransactionStatus.active,
      agencyId: agency.id,
      assignedUserId: james.id,
      expectedExchangeDate: D(9),
      purchasePrice: 37500000, // £375,000
      tenure: Tenure.freehold,
      purchaseType: PurchaseType.mortgage,
      vendorSolicitorFirmId: firmThornton.id,
      vendorSolicitorContactId: contactThorntonSarah.id,
      purchaserSolicitorFirmId: firmAndersons.id,
      purchaserSolicitorContactId: contactAndersonLucy.id,
      createdAt: D(-49),
    },
  });
  const tx2V = await prisma.contact.create({ data: { propertyTransactionId: tx2.id, name: "Diana Forsythe", email: "d.forsythe@email.com", phone: "07623 887 441", roleType: ContactRole.vendor, portalToken: randomUUID() } });
  const tx2P = await prisma.contact.create({ data: { propertyTransactionId: tx2.id, name: "Tom Ashworth", email: "t.ashworth@email.com", phone: "07811 223 345", roleType: ContactRole.purchaser, portalToken: randomUUID() } });
  const tx2P2 = await prisma.contact.create({ data: { propertyTransactionId: tx2.id, name: "Claire Ashworth", email: "c.ashworth@email.com", phone: "07811 223 346", roleType: ContactRole.purchaser, portalToken: randomUUID() } });
  const tx2Vars = { agent: "James", vendors: "Diana", purchasers: "Tom and Claire", solicitor: "Thornton & Co" };
  await completeN(tx2.id, vmDefs, 17, james.id, tx2Vars, 47);
  await completeN(tx2.id, pmDefs, 24, james.id, tx2Vars, 47);
  // Escalated VM20 — 3 days overdue
  await addReminder(tx2.id, ruleByCode.get("VM20")!, james.id, -3, "escalated", 4, "Sarah Marsh has not responded. Escalating — exchange target is 9 days away.");
  // Escalated PM27 — 2 days overdue
  await addReminder(tx2.id, ruleByCode.get("PM27")!, james.id, -2, "escalated", 3, "Lucy Anderson confirmed ready but hasn't sent formal confirmation. Chasing urgently.");
  await addDoneReminder(tx2.id, ruleByCode.get("VM11")!, james.id, 10);
  await addDoneReminder(tx2.id, ruleByCode.get("PM14b")!, james.id, 8);
  await addComm(tx2.id, james.id, "outbound", "phone", "Called Sarah Marsh at Thornton & Co — no answer. Left urgent voicemail regarding exchange gate confirmation. Exchange due in 9 days.", [tx2V.id], 1);
  await addComm(tx2.id, james.id, "outbound", "email", "Sent urgent email to Sarah Marsh and Lucy Anderson requesting formal exchange readiness confirmations by close of business today.", [], 1);
  await addComm(tx2.id, james.id, "inbound", "phone", "Tom called — very anxious about the exchange date. His removals are booked. Explained we're chasing solicitors and everything else is in order.", [tx2P.id], 2);
  await addComm(tx2.id, james.id, "outbound", "phone", "Called Diana to update her. She's keen to exchange and is putting pressure on her solicitor directly.", [tx2V.id], 3);
  await addNote(tx2.id, james.id, "Tom and Claire have booked removals for 5th May. This date is now confirmed completion target — exchange MUST happen by 28th April at the latest.", 3);
  await addNote(tx2.id, james.id, "Indemnity insurance arranged for missing building regs certificate on the rear extension. Both solicitors have copies.", 12);

  // ═══════════════════════════════════════════════════════════════════════════
  // TRANSACTION 3 — Flat 9, Victoria House, Redland Road (Enquiries stage)
  // Mid-progress, at the enquiries and mortgage stage. Exchange: ~8 weeks away.
  // ═══════════════════════════════════════════════════════════════════════════
  const tx3 = await prisma.propertyTransaction.create({
    data: {
      propertyAddress: "Flat 9, Victoria House, Redland Road, Bristol, BS6 6YS",
      status: TransactionStatus.active,
      agencyId: agency.id,
      assignedUserId: james.id,
      expectedExchangeDate: D(57),
      purchasePrice: 28000000, // £280,000
      tenure: Tenure.leasehold,
      purchaseType: PurchaseType.mortgage,
      vendorSolicitorFirmId: firmDevlin.id,
      vendorSolicitorContactId: contactDevlinPriya.id,
      createdAt: D(-35),
    },
  });
  const tx3V = await prisma.contact.create({ data: { propertyTransactionId: tx3.id, name: "David Park", email: "d.park@email.com", phone: "07554 112 334", roleType: ContactRole.vendor, portalToken: randomUUID() } });
  const tx3V2 = await prisma.contact.create({ data: { propertyTransactionId: tx3.id, name: "Susan Park", email: "s.park@email.com", phone: "07554 112 335", roleType: ContactRole.vendor, portalToken: randomUUID() } });
  const tx3P = await prisma.contact.create({ data: { propertyTransactionId: tx3.id, name: "Ellie Bradshaw", email: "e.bradshaw@email.com", phone: "07732 665 991", roleType: ContactRole.purchaser, portalToken: randomUUID() } });
  const tx3P2 = await prisma.contact.create({ data: { propertyTransactionId: tx3.id, name: "Tom Bradshaw", email: "t.bradshaw@email.com", phone: "07732 665 992", roleType: ContactRole.purchaser, portalToken: randomUUID() } });
  const tx3Vars = { agent: "James", vendors: "David and Susan", purchasers: "Ellie and Tom", solicitor: "Devlin Law" };
  await completeN(tx3.id, vmDefs, 12, james.id, tx3Vars, 33);
  await completeN(tx3.id, pmDefs, 14, james.id, tx3Vars, 33);
  // Chase: VM17 (seller initial replies to solicitor), due in 3 days
  await addReminder(tx3.id, ruleByCode.get("VM17")!, james.id, 3, "normal", 1);
  // Chase: PM21 (initial replies received by buyer's sol), overdue 1 day
  await addReminder(tx3.id, ruleByCode.get("PM21")!, james.id, -1, "normal", 2, "Devlin Law have issued initial enquiries but seller's replies still outstanding");
  // Chase: PM6 (mortgage offer), due in 5 days
  await addReminder(tx3.id, ruleByCode.get("PM6")!, james.id, 5, "normal", 1);
  await addDoneReminder(tx3.id, ruleByCode.get("VM5")!, james.id, 12);
  await addDoneReminder(tx3.id, ruleByCode.get("PM9")!, james.id, 10);
  await addComm(tx3.id, james.id, "outbound", "phone", "Called Devlin Law to chase initial enquiries replies from seller's solicitor. Priya confirmed they're expecting responses by end of this week.", [tx3V.id], 2);
  await addComm(tx3.id, james.id, "outbound", "phone", "Spoke with Ellie — mortgage application submitted 3 weeks ago, valuation was done last week. Expecting offer any day.", [tx3P.id], 4);
  await addComm(tx3.id, james.id, "inbound", "email", "David emailed asking for progress update. Replied to confirm enquiries are in progress and mortgage offer is imminent.", [tx3V.id], 5);
  await addComm(tx3.id, james.id, "outbound", "phone", "Called Devlin Law re: management pack for the flat. Priya confirmed it was received 2 weeks ago from the managing agent and has been reviewed.", [], 8);

  // ═══════════════════════════════════════════════════════════════════════════
  // TRANSACTION 4 — 19 Arley Hill, Cotham (Contract pack issued, searches stage)
  // ═══════════════════════════════════════════════════════════════════════════
  const tx4 = await prisma.propertyTransaction.create({
    data: {
      propertyAddress: "19 Arley Hill, Cotham, Bristol, BS6 5PX",
      status: TransactionStatus.active,
      agencyId: agency.id,
      assignedUserId: james.id,
      expectedExchangeDate: D(41),
      purchasePrice: 44500000, // £445,000
      tenure: Tenure.freehold,
      purchaseType: PurchaseType.cash_from_proceeds,
      vendorSolicitorFirmId: firmThornton.id,
      vendorSolicitorContactId: contactThorntonHenry.id,
      purchaserSolicitorFirmId: firmWright.id,
      purchaserSolicitorContactId: contactWrightTom.id,
      createdAt: D(-35),
    },
  });
  const tx4V = await prisma.contact.create({ data: { propertyTransactionId: tx4.id, name: "Patrick Mulligan", email: "p.mulligan@email.com", phone: "07811 556 778", roleType: ContactRole.vendor, portalToken: randomUUID() } });
  const tx4P = await prisma.contact.create({ data: { propertyTransactionId: tx4.id, name: "Fiona Mulligan", email: "f.mulligan@email.com", phone: "07811 556 779", roleType: ContactRole.purchaser, portalToken: randomUUID() } });
  const tx4Vars = { agent: "James", vendors: "Patrick", purchasers: "Fiona", solicitor: "Thornton & Co" };
  await completeN(tx4.id, vmDefs, 10, james.id, tx4Vars, 32);
  await completeN(tx4.id, pmDefs, 8, james.id, tx4Vars, 30);
  // Cash from proceeds — PM4, PM5, PM6 not required
  await markNotRequired(tx4.id, pmDefs, ["PM4", "PM5", "PM6"], defIdMap, james.id, "Cash from proceeds — no mortgage required");
  await addReminder(tx4.id, ruleByCode.get("VM16")!, james.id, 5, "normal", 1);
  await addReminder(tx4.id, ruleByCode.get("PM11")!, james.id, 2, "normal", 1, "Wright & Hughes have received contract pack and searches are ordered. Enquiries expected this week.");
  await addReminder(tx4.id, ruleByCode.get("PM10")!, james.id, 12, "normal", 0);
  await addDoneReminder(tx4.id, ruleByCode.get("VM7")!, james.id, 8);
  await addComm(tx4.id, james.id, "outbound", "phone", "Called Tom Wright at Wright & Hughes. Draft contract pack received and searches ordered. Expecting results in 2-3 weeks.", [tx4P.id], 3);
  await addComm(tx4.id, james.id, "inbound", "email", "Fiona emailed to confirm she has exchanged on her sale and funds are available. No chain issues.", [tx4P.id], 7);
  await addComm(tx4.id, james.id, "outbound", "phone", "Spoke with Henry Thornton — management pack not applicable (freehold). Contract pack issued to buyer's solicitor 10 days ago.", [], 6);
  await addNote(tx4.id, james.id, "Fiona is cash from proceeds — sale of her flat in Bath completed on 14th April. Funds held by her solicitor Wright & Hughes. No chain delays expected.", 7);

  // ═══════════════════════════════════════════════════════════════════════════
  // TRANSACTION 5 — 22 Pemberton Road, Redcliffe (Early stage, cash buyer)
  // ═══════════════════════════════════════════════════════════════════════════
  const tx5 = await prisma.propertyTransaction.create({
    data: {
      propertyAddress: "22 Pemberton Road, Redcliffe, Bristol, BS1 6SR",
      status: TransactionStatus.active,
      agencyId: agency.id,
      agentUserId: emily.id,
      progressedBy: "agent",
      expectedExchangeDate: D(70),
      purchasePrice: 62000000, // £620,000
      tenure: Tenure.freehold,
      purchaseType: PurchaseType.cash,
      createdAt: D(-28),
    },
  });
  const tx5V = await prisma.contact.create({ data: { propertyTransactionId: tx5.id, name: "George Whitmore", email: "g.whitmore@email.com", phone: "07811 445 667", roleType: ContactRole.vendor, portalToken: randomUUID() } });
  const tx5P = await prisma.contact.create({ data: { propertyTransactionId: tx5.id, name: "Claire Nguyen", email: "claire.n@email.com", phone: "07944 556 778", roleType: ContactRole.purchaser, portalToken: randomUUID() } });
  const tx5P2 = await prisma.contact.create({ data: { propertyTransactionId: tx5.id, name: "James Nguyen", email: "james.n@email.com", phone: "07944 556 779", roleType: ContactRole.purchaser, portalToken: randomUUID() } });
  const tx5Vars = { agent: "Emily", vendors: "George", purchasers: "Claire and James", solicitor: "their solicitor" };
  await completeN(tx5.id, vmDefs, 6, emily.id, tx5Vars, 26);
  await completeN(tx5.id, pmDefs, 4, emily.id, tx5Vars, 24);
  // Cash purchase — PM4, PM5, PM6, PM7, PM20 not required (no mortgage, no survey needed by lender)
  await markNotRequired(tx5.id, pmDefs, ["PM4", "PM5", "PM6"], defIdMap, emily.id, "Cash purchase — no mortgage required");
  await addReminder(tx5.id, ruleByCode.get("VM5")!, emily.id, 5, "normal", 1);
  await addReminder(tx5.id, ruleByCode.get("PM3")!, emily.id, 3, "normal", 1);
  await addDoneReminder(tx5.id, ruleByCode.get("VM1")!, emily.id, 25);
  await addComm(tx5.id, emily.id, "outbound", "phone", "Called George to chase on ID and AML checks. He confirmed he's sent everything to his solicitor this morning.", [tx5V.id], 3);
  await addComm(tx5.id, emily.id, "outbound", "phone", "Spoke with Claire Nguyen — she and James have instructed their solicitor and paid money on account. All ready to go.", [tx5P.id], 5);
  await addComm(tx5.id, emily.id, "inbound", "email", "George asked whether the sale would be affected by the neighbour dispute mentioned in the TA6. Confirmed that disclosure is made and buyer's solicitor is aware.", [tx5V.id], 8);

  // ═══════════════════════════════════════════════════════════════════════════
  // TRANSACTION 6 — Flat 3, Clarence Court, Harbourside (Just started)
  // ═══════════════════════════════════════════════════════════════════════════
  const tx6 = await prisma.propertyTransaction.create({
    data: {
      propertyAddress: "Flat 3, Clarence Court, Harbourside, Bristol, BS1 4RB",
      status: TransactionStatus.active,
      agencyId: agency.id,
      agentUserId: emily.id,
      progressedBy: "agent",
      purchasePrice: 19500000, // £195,000
      tenure: Tenure.leasehold,
      purchaseType: PurchaseType.mortgage,
      createdAt: D(-14),
    },
  });
  const tx6V = await prisma.contact.create({ data: { propertyTransactionId: tx6.id, name: "Helen Moss", email: "h.moss@email.com", phone: "07534 221 009", roleType: ContactRole.vendor, portalToken: randomUUID() } });
  const tx6P = await prisma.contact.create({ data: { propertyTransactionId: tx6.id, name: "Ryan Patel", email: "ryan.p@email.com", phone: "07612 334 456", roleType: ContactRole.purchaser, portalToken: randomUUID() } });
  const tx6Vars = { agent: "Emily", vendors: "Helen", purchasers: "Ryan", solicitor: "their solicitor" };
  await completeN(tx6.id, vmDefs, 2, emily.id, tx6Vars, 12);
  await completeN(tx6.id, pmDefs, 2, emily.id, tx6Vars, 12);
  await addReminder(tx6.id, ruleByCode.get("VM3")!, emily.id, 3, "normal", 0);
  await addReminder(tx6.id, ruleByCode.get("VM14")!, emily.id, 4, "normal", 0);
  await addReminder(tx6.id, ruleByCode.get("PM14a")!, emily.id, 5, "normal", 0);
  await addReminder(tx6.id, ruleByCode.get("PM4")!, emily.id, 7, "normal", 0);
  await addComm(tx6.id, emily.id, "outbound", "phone", "Called Helen — solicitor instructed (Anderson & Co). MOS received. She's chasing them for the welcome pack.", [tx6V.id], 3);
  await addComm(tx6.id, emily.id, "outbound", "phone", "Spoke with Ryan — he's instructed Devlin Law and submitted his mortgage application this week through his broker.", [tx6P.id], 5);
  await addNote(tx6.id, emily.id, "Ryan is a first-time buyer. May need extra hand-holding through the process. His broker is Martin Jacobs at County Mortgages — 07712 009 882.", 5);

  // ═══════════════════════════════════════════════════════════════════════════
  // TRANSACTION 7 — Flat 12, Caledonia Place, Clifton (Searches/mortgage stage)
  // ═══════════════════════════════════════════════════════════════════════════
  const tx7 = await prisma.propertyTransaction.create({
    data: {
      propertyAddress: "Flat 12, Caledonia Place, Clifton, Bristol, BS8 4DX",
      status: TransactionStatus.active,
      agencyId: agency.id,
      agentUserId: emily.id,
      progressedBy: "agent",
      expectedExchangeDate: D(72),
      purchasePrice: 32000000, // £320,000
      tenure: Tenure.leasehold,
      purchaseType: PurchaseType.mortgage,
      purchaserSolicitorFirmId: firmDevlin.id,
      purchaserSolicitorContactId: contactDevlinPriya.id,
      createdAt: D(-24),
    },
  });
  const tx7V = await prisma.contact.create({ data: { propertyTransactionId: tx7.id, name: "Nigel Cross", email: "n.cross@email.com", phone: "07456 887 221", roleType: ContactRole.vendor, portalToken: randomUUID() } });
  const tx7P = await prisma.contact.create({ data: { propertyTransactionId: tx7.id, name: "Sophie Laurent", email: "s.laurent@email.com", phone: "07733 119 882", roleType: ContactRole.purchaser, portalToken: randomUUID() } });
  const tx7Vars = { agent: "Emily", vendors: "Nigel", purchasers: "Sophie", solicitor: "their solicitor" };
  await completeN(tx7.id, vmDefs, 8, emily.id, tx7Vars, 22);
  await completeN(tx7.id, pmDefs, 9, emily.id, tx7Vars, 22);
  // Escalated: searches overdue by 5 days
  await addReminder(tx7.id, ruleByCode.get("PM10")!, emily.id, -5, "escalated", 3, "Search company quoting 6-week turnaround — well beyond normal. Chasing Bristol City Council directly.");
  // Mortgage offer pending
  await addReminder(tx7.id, ruleByCode.get("PM6")!, emily.id, 3, "normal", 1);
  await addDoneReminder(tx7.id, ruleByCode.get("PM9")!, emily.id, 14);
  await addComm(tx7.id, emily.id, "outbound", "phone", "Called Devlin Law — searches ordered 3 weeks ago via their search company but still outstanding. Priya chasing Bristol City Council directly.", [tx7V.id], 1);
  await addComm(tx7.id, emily.id, "inbound", "email", "Sophie emailed to ask about the management pack for the flat — confirmed Devlin Law have requested it from the managing agent (Clifton Property Management).", [tx7P.id], 3);
  await addComm(tx7.id, emily.id, "outbound", "phone", "Spoke with Sophie — mortgage application submitted. Valuation done last week. Expecting formal offer within 5 working days.", [tx7P.id], 5);
  await addNote(tx7.id, emily.id, "Search delay — Bristol City Council local authority search is running at 6 weeks. Devlin Law have flagged this as exceptional. May need to revisit exchange target.", 2);

  // ═══════════════════════════════════════════════════════════════════════════
  // TRANSACTION 8 — The Old Mill House, Keynsham (ON HOLD — bad survey)
  // ═══════════════════════════════════════════════════════════════════════════
  const tx8 = await prisma.propertyTransaction.create({
    data: {
      propertyAddress: "The Old Mill House, Church Road, Keynsham, BS31 2TA",
      status: TransactionStatus.on_hold,
      agencyId: agency.id,
      assignedUserId: james.id,
      purchasePrice: 55000000, // £550,000
      tenure: Tenure.freehold,
      purchaseType: PurchaseType.mortgage,
      vendorSolicitorFirmId: firmThornton.id,
      vendorSolicitorContactId: contactThorntonSarah.id,
      createdAt: D(-35),
    },
  });
  const tx8V = await prisma.contact.create({ data: { propertyTransactionId: tx8.id, name: "William Hargreaves", email: "w.hargreaves@email.com", phone: "07623 445 991", roleType: ContactRole.vendor, portalToken: randomUUID() } });
  const tx8V2 = await prisma.contact.create({ data: { propertyTransactionId: tx8.id, name: "Patricia Hargreaves", email: "p.hargreaves@email.com", phone: "07623 445 992", roleType: ContactRole.vendor, portalToken: randomUUID() } });
  const tx8P = await prisma.contact.create({ data: { propertyTransactionId: tx8.id, name: "Leon Cartwright", email: "l.cartwright@email.com", phone: "07988 334 112", roleType: ContactRole.purchaser, portalToken: randomUUID() } });
  const tx8Vars = { agent: "James", vendors: "William and Patricia", purchasers: "Leon", solicitor: "Thornton & Co" };
  await completeN(tx8.id, vmDefs, 11, james.id, tx8Vars, 33);
  await completeN(tx8.id, pmDefs, 10, james.id, tx8Vars, 33);
  await addDoneReminder(tx8.id, ruleByCode.get("VM7")!, james.id, 18);
  await addDoneReminder(tx8.id, ruleByCode.get("PM20")!, james.id, 12);
  await addComm(tx8.id, james.id, "inbound", "email", "Leon's surveyor report flagged significant damp in the cellar and evidence of subsidence in the rear outbuilding. Leon is requesting a £40,000 price reduction.", [tx8P.id], 14);
  await addComm(tx8.id, james.id, "outbound", "phone", "Called William and Patricia to relay Leon's survey findings and proposed price reduction. They are refusing to drop below £530,000. Asked them to consider.", [tx8V.id], 13);
  await addComm(tx8.id, james.id, "outbound", "phone", "Follow up call with Leon — he's getting a damp specialist quote before deciding whether to proceed. He says he won't go above £515,000.", [tx8P.id], 10);
  await addComm(tx8.id, james.id, "inbound", "phone", "William called — willing to go to £535,000 but no lower. This is some way off Leon's position. File put on hold pending both parties reconsidering.", [tx8V.id], 8);
  await addNote(tx8.id, james.id, "File on hold. Survey flagged damp in cellar and possible subsidence in rear outbuilding. Vendor at £535k, buyer at £515k. Gap of £20k. Damp specialist report due next week.", 8);
  await addNote(tx8.id, james.id, "Leon has obtained a damp specialist quote — £14,500 to treat and re-render cellar. This may help bridge the gap in negotiations.", 3);

  // ═══════════════════════════════════════════════════════════════════════════
  // TRANSACTION 9 — 47 Redland Road, Redland (ACTIVE — Exchanged, completing Fri)
  // All pre-completion milestones done. Completing in 5 days.
  // ═══════════════════════════════════════════════════════════════════════════
  const tx9 = await prisma.propertyTransaction.create({
    data: {
      propertyAddress: "47 Redland Road, Redland, Bristol, BS6 6TY",
      status: TransactionStatus.active,
      agencyId: agency.id,
      assignedUserId: james.id,
      purchasePrice: 48500000, // £485,000
      tenure: Tenure.freehold,
      purchaseType: PurchaseType.mortgage,
      completionDate: D(5),
      expectedExchangeDate: D(-7),
      vendorSolicitorFirmId: firmDevlin.id,
      vendorSolicitorContactId: contactDevlinMark.id,
      createdAt: D(-68),
    },
  });
  const tx9V = await prisma.contact.create({ data: { propertyTransactionId: tx9.id, name: "Richard Ashford", email: "r.ashford@email.com", phone: "07712 553 004", roleType: ContactRole.vendor, portalToken: randomUUID() } });
  const tx9P = await prisma.contact.create({ data: { propertyTransactionId: tx9.id, name: "Sophie Brennan", email: "s.brennan@email.com", phone: "07934 112 667", roleType: ContactRole.purchaser, portalToken: randomUUID() } });
  const tx9Vars = { agent: "James", vendors: "Richard", purchasers: "Sophie", solicitor: "Devlin Law" };
  // Complete all 19 vendor milestones up to and including VM12 (exchanged)
  await completeN(tx9.id, vmDefs, 19, james.id, tx9Vars, 65);
  // Complete all 26 purchaser milestones up to and including PM16 (exchanged)
  await completeN(tx9.id, pmDefs, 26, james.id, tx9Vars, 65);
  await addComm(tx9.id, james.id, "outbound", "phone", "Congratulations call to Richard and Sophie — contracts exchanged at 2pm today. Completion confirmed for Friday 25th April. Richard is delighted.", [tx9V.id, tx9P.id], 7);
  await addComm(tx9.id, james.id, "outbound", "email", "Sent completion reminders to both sides. Devlin Law confirmed funds will be in place by Thursday. Richard's removal van booked for Friday morning.", [], 6);
  await addNote(tx9.id, james.id, "Exchanged 12th April. Completing 25th April. Smooth transaction — no issues post-exchange. Sophie has arranged removals.", 6);

  // ═══════════════════════════════════════════════════════════════════════════
  // TRANSACTION 10 — 12 Clifton Vale, Clifton (ACTIVE — Exchanged, no completion date)
  // Exchanged but completion date not yet confirmed by solicitors.
  // ═══════════════════════════════════════════════════════════════════════════
  const tx10 = await prisma.propertyTransaction.create({
    data: {
      propertyAddress: "12 Clifton Vale, Clifton, Bristol, BS8 4PT",
      status: TransactionStatus.active,
      agencyId: agency.id,
      assignedUserId: sarah.id,
      purchasePrice: 72000000, // £720,000
      tenure: Tenure.freehold,
      purchaseType: PurchaseType.cash,
      completionDate: null,
      expectedExchangeDate: D(-3),
      vendorSolicitorFirmId: firmThornton.id,
      vendorSolicitorContactId: contactThorntonSarah.id,
      createdAt: D(-74),
    },
  });
  const tx10V = await prisma.contact.create({ data: { propertyTransactionId: tx10.id, name: "Margaret Okafor", email: "m.okafor@email.com", phone: "07801 334 998", roleType: ContactRole.vendor, portalToken: randomUUID() } });
  const tx10P = await prisma.contact.create({ data: { propertyTransactionId: tx10.id, name: "David Lim", email: "d.lim@email.com", phone: "07922 445 110", roleType: ContactRole.purchaser, portalToken: randomUUID() } });
  const tx10Vars = { agent: "Sarah", vendors: "Margaret", purchasers: "David", solicitor: "Thornton & Co" };
  await completeN(tx10.id, vmDefs, 19, sarah.id, tx10Vars, 71);
  await completeN(tx10.id, pmDefs, 26, sarah.id, tx10Vars, 71);
  await addComm(tx10.id, sarah.id, "outbound", "phone", "Spoke with Thornton & Co — exchanged this morning. David's solicitor is checking his calendar before confirming completion date. Expecting confirmation today.", [tx10V.id, tx10P.id], 3);
  await addNote(tx10.id, sarah.id, "Exchanged 16th April. Completion date TBC — David's solicitor needs to confirm. Chasing for date.", 3);

  // ═══════════════════════════════════════════════════════════════════════════
  // TRANSACTION 11 — 7 Oak Tree Lane, Bishopston (COMPLETED)
  // All milestones done, exchanged and completed.
  // ═══════════════════════════════════════════════════════════════════════════
  const tx11 = await prisma.propertyTransaction.create({
    data: {
      propertyAddress: "7 Oak Tree Lane, Bishopston, Bristol, BS7 8PQ",
      status: TransactionStatus.completed,
      agencyId: agency.id,
      assignedUserId: james.id,
      expectedExchangeDate: D(-28),
      completionDate: D(-16),
      purchasePrice: 35000000, // £350,000
      tenure: Tenure.freehold,
      purchaseType: PurchaseType.mortgage,
      vendorSolicitorFirmId: firmDevlin.id,
      vendorSolicitorContactId: contactDevlinMark.id,
      purchaserSolicitorFirmId: firmThornton.id,
      purchaserSolicitorContactId: contactThorntonHenry.id,
      createdAt: D(-56),
    },
  });
  const tx11V = await prisma.contact.create({ data: { propertyTransactionId: tx11.id, name: "Janet Morrison", email: "j.morrison@email.com", phone: "07712 009 334", roleType: ContactRole.vendor, portalToken: randomUUID() } });
  const tx11P = await prisma.contact.create({ data: { propertyTransactionId: tx11.id, name: "Chris Webb", email: "c.webb@email.com", phone: "07823 445 112", roleType: ContactRole.purchaser, portalToken: randomUUID() } });
  const tx11P2 = await prisma.contact.create({ data: { propertyTransactionId: tx11.id, name: "Rachel Webb", email: "r.webb@email.com", phone: "07823 445 113", roleType: ContactRole.purchaser, portalToken: randomUUID() } });
  const tx11Vars = { agent: "James", vendors: "Janet", purchasers: "Chris and Rachel", solicitor: "Devlin Law" };
  await completeN(tx11.id, vmDefs, 20, james.id, tx11Vars, 54);
  await completeN(tx11.id, pmDefs, 27, james.id, tx11Vars, 54);
  await addComm(tx11.id, james.id, "outbound", "phone", "Congratulations call to Janet on completion day. She was delighted and very pleased with the service.", [tx11V.id], 16);
  await addComm(tx11.id, james.id, "outbound", "phone", "Congratulations call to Chris and Rachel on completion day. Keys collected from office at 2pm. All smooth.", [tx11P.id], 16);
  await addNote(tx11.id, james.id, "Completed successfully on 3rd April 2026. Very smooth transaction — no issues from offer to completion. Janet has asked us to value two other properties she owns.", 16);

  // ═══════════════════════════════════════════════════════════════════════════
  // TRANSACTION 12 — 9 Harbour View, Portishead (Completed — chain transaction)
  // ═══════════════════════════════════════════════════════════════════════════
  const tx12 = await prisma.propertyTransaction.create({
    data: {
      propertyAddress: "9 Harbour View, Portishead, BS20 6AJ",
      status: TransactionStatus.completed,
      agencyId: agency.id,
      assignedUserId: sarah.id,
      expectedExchangeDate: D(-35),
      completionDate: D(-21),
      purchasePrice: 41000000, // £410,000
      tenure: Tenure.freehold,
      purchaseType: PurchaseType.mortgage,
      createdAt: D(-63),
    },
  });
  const tx12V = await prisma.contact.create({ data: { propertyTransactionId: tx12.id, name: "Graham Fletcher", email: "g.fletcher@email.com", phone: "07534 664 990", roleType: ContactRole.vendor, portalToken: randomUUID() } });
  const tx12P = await prisma.contact.create({ data: { propertyTransactionId: tx12.id, name: "Andrea Booth", email: "a.booth@email.com", phone: "07612 776 009", roleType: ContactRole.purchaser, portalToken: randomUUID() } });
  const tx12Vars = { agent: "Sarah", vendors: "Graham", purchasers: "Andrea", solicitor: "their solicitor" };
  await completeN(tx12.id, vmDefs, 20, sarah.id, tx12Vars, 61);
  await completeN(tx12.id, pmDefs, 27, sarah.id, tx12Vars, 61);

  // ═══════════════════════════════════════════════════════════════════════════
  // TRANSACTION 13 — 55 Coldharbour Road, Redland (WITHDRAWN)
  // ═══════════════════════════════════════════════════════════════════════════
  const tx13 = await prisma.propertyTransaction.create({
    data: {
      propertyAddress: "55 Coldharbour Road, Redland, Bristol, BS6 7JS",
      status: TransactionStatus.withdrawn,
      agencyId: agency.id,
      agentUserId: emily.id,
      progressedBy: "agent",
      purchasePrice: 29000000, // £290,000
      tenure: Tenure.freehold,
      purchaseType: PurchaseType.mortgage,
      createdAt: D(-28),
    },
  });
  const tx13V = await prisma.contact.create({ data: { propertyTransactionId: tx13.id, name: "Simon Draper", email: "s.draper@email.com", phone: "07812 334 991", roleType: ContactRole.vendor, portalToken: randomUUID() } });
  const tx13P = await prisma.contact.create({ data: { propertyTransactionId: tx13.id, name: "Emma Griffiths", email: "e.griffiths@email.com", phone: "07934 112 445", roleType: ContactRole.purchaser, portalToken: randomUUID() } });
  const tx13Vars = { agent: "Emily", vendors: "Simon", purchasers: "Emma", solicitor: "their solicitor" };
  await completeN(tx13.id, vmDefs, 2, emily.id, tx13Vars, 26);
  await completeN(tx13.id, pmDefs, 2, emily.id, tx13Vars, 26);
  await addComm(tx13.id, emily.id, "inbound", "phone", "Simon called to say he and his partner have decided not to sell at this time. They're going through a separation and need to seek legal advice first. Property withdrawn.", [tx13V.id], 14);
  await addNote(tx13.id, emily.id, "Vendor withdrawn. Simon and his partner are separating — sale cannot proceed without both parties' agreement. Emma Griffiths (buyer) has been notified and will look at other properties.", 14);

  console.log("✓ 13 transactions with contacts, milestones, reminders, tasks, comms, and notes");

  console.log("\n✅ Seed complete.");
  console.log("   Password for all accounts: Hartwell2024!");
  console.log("");
  console.log("   ellisaskey@googlemail.com    — Admin (you)          → /dashboard");
  console.log("   ellis@thesalesprogressor.co.uk — Admin              → /dashboard");
  console.log("   sarah@hartwellpartners.co.uk — Admin                → /dashboard");
  console.log("   james@hartwellpartners.co.uk — Sales Progressor     → /dashboard");
  console.log("   emily@hartwellpartners.co.uk — Negotiator (agent)   → /agent/dashboard");
  console.log("\n   Transactions:");
  console.log("   TX1  Active  Near exchange (14 days)      — 14 Elmwood Avenue");
  console.log("   TX2  Active  URGENT exchange (9 days)     — 83 Victoria Park Road");
  console.log("   TX3  Active  Enquiries stage              — Flat 9, Victoria House");
  console.log("   TX4  Active  Contract pack / searches     — 19 Arley Hill");
  console.log("   TX5  Active  Early stage, cash buyer      — 22 Pemberton Road");
  console.log("   TX6  Active  Just started                 — Flat 3, Clarence Court");
  console.log("   TX7  Active  Searches delayed (escalated) — Flat 12, Caledonia Place");
  console.log("   TX8  OnHold  Bad survey, renegotiating    — The Old Mill House");
  console.log("   TX9  Active  Exchanged, completing Fri    — 47 Redland Road");
  console.log("   TX10 Active  Exchanged, no date yet       — 12 Clifton Vale");
  console.log("   TX11 Done    Completed 3 Apr              — 7 Oak Tree Lane");
  console.log("   TX12 Done    Completed 29 Mar             — 9 Harbour View");
  console.log("   TX13 Wthdrn  Vendor withdrawing           — 55 Coldharbour Road");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
