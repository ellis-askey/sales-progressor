// STAGING ONLY. Seeds "9 Enquiry Court" (cmsz053vw006c3gwudijyxk86) with a rich
// mid-transaction chase history so the Chase Timeline tab shows every state:
// scheduled, auto-chasing, handed-to-team, you-chasing, escalated, snoozed,
// completed, cancelled — across the client, solicitor and enquiry lanes.
// Idempotent (wipes this file's chase rows first). Delete after the demo.
//
// Run: npx dotenv -e .env -- npx ts-node --project tsconfig.scripts.json scripts/seed-chase-timeline-demo.ts

import { prisma } from "../lib/prisma";

const TX = "cmsz053vw006c3gwudijyxk86";
const BUYER = "cmsz053xy006e3gwuem68anvm";
const SELLER = "cmsz053xx006d3gwu2lg6hx0t";
const AGENT = "cmpehuy7s00052ebfstgttv4m";

function ago(n: number): Date { const d = new Date(); d.setDate(d.getDate() - n); d.setHours(9, 0, 0, 0); return d; }
function fwd(n: number): Date { const d = new Date(); d.setDate(d.getDate() + n); d.setHours(6, 0, 0, 0); return d; }

type Spec = {
  code: string;
  side: "vendor" | "purchaser";
  logStatus: "active" | "completed" | "cancelled";
  nextDue: Date;
  cc: number; mc: number;                // chaseTask total + manual
  priority?: "escalated";
  fallbackKind?: string;
  escalatedAt?: Date;
  snoozedUntil?: Date;
  statusReason?: string;
  lastChasedAt?: Date;
  // client-chase state (auto lane)
  clientCc?: number; clientStatus?: string; clientFirst?: Date; clientLast?: Date;
  // manual chase emails (with delivery)
  manualSends?: { at: Date; delivered?: Date; opened?: Date; subject: string }[];
};

const SPECS: Spec[] = [
  // scheduled — reminder exists, nothing chased yet
  { code: "PM9",  side: "purchaser", logStatus: "active", nextDue: fwd(2), cc: 0, mc: 0 },
  // auto-chasing — client emailed once, autopilot still going
  { code: "PM13", side: "purchaser", logStatus: "active", nextDue: new Date(new Date().setHours(6,0,0,0)), cc: 1, mc: 0,
    clientCc: 1, clientStatus: "active", clientFirst: ago(3), clientLast: ago(3), lastChasedAt: ago(3) },
  // handed to team — client hit its 2-email cap, handed back
  { code: "PM11", side: "purchaser", logStatus: "active", nextDue: ago(1), cc: 2, mc: 0, fallbackKind: "max_chases_exhausted",
    clientCc: 2, clientStatus: "escalated", clientFirst: ago(11), clientLast: ago(4), lastChasedAt: ago(4) },
  // you're chasing — auto 2 + you 1, with a delivered+opened email
  { code: "PM10", side: "purchaser", logStatus: "active", nextDue: fwd(3), cc: 3, mc: 1, lastChasedAt: ago(1),
    clientCc: 2, clientStatus: "escalated", clientFirst: ago(14), clientLast: ago(8),
    manualSends: [{ at: ago(1), delivered: ago(1), opened: ago(1), subject: "Chasing your survey report" }] },
  // escalated — auto 2 + you 3, urgent, two emails (one opened, one not)
  { code: "VM16", side: "vendor", logStatus: "active", nextDue: ago(2), cc: 5, mc: 3, priority: "escalated", escalatedAt: ago(1), lastChasedAt: ago(3),
    clientCc: 2, clientStatus: "escalated", clientFirst: ago(20), clientLast: ago(14),
    manualSends: [
      { at: ago(9), delivered: ago(9), opened: ago(9), subject: "Signed contracts — chase 1" },
      { at: ago(3), delivered: ago(3), subject: "Signed contracts — chase 2 (no reply)" },
    ] },
  // snoozed — a date was given
  { code: "VM6",  side: "vendor", logStatus: "active", nextDue: ago(1), cc: 1, mc: 0, snoozedUntil: fwd(5), statusReason: "Seller gave a date",
    clientCc: 1, clientStatus: "active", clientFirst: ago(7), clientLast: ago(7), lastChasedAt: ago(7) },
  // completed — chased then confirmed
  { code: "PM7",  side: "purchaser", logStatus: "completed", nextDue: ago(10), cc: 1, mc: 0,
    clientCc: 1, clientStatus: "confirmed", clientFirst: ago(18), clientLast: ago(18) },
  // cancelled — stopped
  { code: "VM5",  side: "vendor", logStatus: "cancelled", nextDue: ago(12), cc: 0, mc: 0, statusReason: "No longer required on this file" },
];

// A solicitor-lane thread (adds SolicitorChaseState on VM7).
const SOLICITOR = { code: "VM7", side: "vendor" as const, cc: 1 };

async function main() {
  if (process.env.DATABASE_URL?.includes("gmkfustgwipgihpmpjpr")) throw new Error("Refusing to run on PRODUCTION");
  console.log("=== Seeding chase-timeline demo on", TX, "===");

  // Clean slate (FK-safe order).
  await prisma.outboundMessage.deleteMany({ where: { transactionId: TX, purpose: "chase" } });
  await prisma.chaseTask.deleteMany({ where: { transactionId: TX } });
  await prisma.reminderLog.deleteMany({ where: { transactionId: TX } });
  await prisma.clientChaseState.deleteMany({ where: { transactionId: TX } });
  await prisma.solicitorChaseState.deleteMany({ where: { transactionId: TX } });
  await prisma.enquiryRaiseChase.deleteMany({ where: { transactionId: TX } });

  const codes = [...SPECS.map((s) => s.code), SOLICITOR.code];
  const rules = await prisma.reminderRule.findMany({ where: { targetMilestoneCode: { in: codes } }, select: { id: true, targetMilestoneCode: true } });
  const ruleByCode = new Map(rules.map((r) => [r.targetMilestoneCode!, r.id]));

  for (const s of SPECS) {
    const ruleId = ruleByCode.get(s.code);
    if (!ruleId) { console.log(`  skip ${s.code} (no rule)`); continue; }
    const log = await prisma.reminderLog.create({
      data: {
        transactionId: TX, reminderRuleId: ruleId, status: s.logStatus,
        nextDueDate: s.nextDue, snoozedUntil: s.snoozedUntil ?? null,
        statusReason: s.statusReason ?? null, createdAt: ago(22),
      },
      select: { id: true },
    });
    const task = await prisma.chaseTask.create({
      data: {
        transactionId: TX, reminderLogId: log.id, assignedToId: AGENT, dueDate: s.nextDue,
        status: s.logStatus === "active" ? "pending" : s.logStatus === "completed" ? "done" : "cancelled",
        priority: s.priority ?? "normal", chaseCount: s.cc, manualChaseCount: s.mc,
        lastChasedAt: s.lastChasedAt ?? null, fallbackKind: s.fallbackKind ?? null,
        escalatedAt: s.escalatedAt ?? null, escalatedById: s.escalatedAt ? AGENT : null,
      },
      select: { id: true },
    });
    if (s.clientCc) {
      await prisma.clientChaseState.create({
        data: {
          transactionId: TX, contactId: s.side === "vendor" ? SELLER : BUYER, milestoneCode: s.code,
          chaseCount: s.clientCc, firstChasedAt: s.clientFirst ?? null, lastChasedAt: s.clientLast ?? null,
          status: s.clientStatus ?? "active",
        },
      });
    }
    for (const m of s.manualSends ?? []) {
      await prisma.outboundMessage.create({
        data: {
          transactionId: TX, chaseTaskId: task.id, type: "outbound", channel: "email", method: "email",
          purpose: "chase", status: "sent", isAutomated: false,
          recipientName: s.side === "vendor" ? "Morgan Reed" : "Jordan Blake",
          recipientEmail: "demo@example.com", subject: m.subject, content: m.subject,
          contactIds: [s.side === "vendor" ? SELLER : BUYER], createdById: AGENT, createdByRole: "director",
          createdAt: m.at, deliveredAt: m.delivered ?? null, openedAt: m.opened ?? null,
        },
      });
    }
    console.log(`  ${s.code.padEnd(5)} -> ${s.logStatus} cc=${s.cc} mc=${s.mc}${s.priority ? " escalated" : ""}${s.snoozedUntil ? " snoozed" : ""}`);
  }

  // Solicitor lane.
  const solRule = ruleByCode.get(SOLICITOR.code);
  if (solRule) {
    const log = await prisma.reminderLog.create({ data: { transactionId: TX, reminderRuleId: solRule, status: "active", nextDueDate: fwd(1), createdAt: ago(18) }, select: { id: true } });
    await prisma.chaseTask.create({ data: { transactionId: TX, reminderLogId: log.id, assignedToId: AGENT, dueDate: fwd(1), status: "pending", priority: "normal", chaseCount: 1, manualChaseCount: 0, lastChasedAt: ago(5) } });
    await prisma.solicitorChaseState.create({ data: { transactionId: TX, side: SOLICITOR.side, milestoneCode: SOLICITOR.code, chaseCount: 1, firstChasedAt: ago(5), lastChasedAt: ago(5), status: "active" } });
    console.log(`  ${SOLICITOR.code} -> solicitor lane, auto-chased 1x`);
  }

  // Enquiry lanes: raise-chase closed (enquiries raised), tracker escalated with real chase history.
  await prisma.enquiryRaiseChase.create({ data: { transactionId: TX, openedAt: ago(24), lastNudgedAt: ago(16), lastTarget: "buyer_solicitor", nudgeCount: 2, closedAt: ago(10) } });
  await prisma.enquiryTracker.update({
    where: { transactionId: TX },
    data: { currentlyWith: "buyer_solicitor", openedAt: ago(10), lastMovementAt: ago(9), lastChasedAt: ago(3), chaseCount: 2, escalatedAt: ago(1), outstandingNote: "management pack, FENSA cert" },
  });
  console.log("  enquiries -> raise-chase closed; tracker escalated, chased 2x");

  console.log("\nDone. Open http://localhost:3000/agent/transactions/" + TX + "?tab=chase");
}

main().then(() => prisma.$disconnect()).catch(async (e) => { console.error(e.message ?? e); await prisma.$disconnect(); process.exit(1); });
