// STAGING ONLY. Seeds a fresh "Exchange Day Demo" file that's ready to exchange
// and actively in exchange day, so the whole feature can be seen: hero control +
// authority tracker, client portal card, and the solicitor emails. Sends the
// morning solicitor email to burner addresses. Guarded against prod. Delete after.
//
// Run: npx dotenv -e .env -- npx ts-node --project tsconfig.scripts.json scripts/seed-exchange-day-demo.ts

import { randomBytes } from "node:crypto";
import { prisma } from "../lib/prisma";
import { computeAutoNrCodes } from "../lib/milestone-auto-nr";
import { DIRECT_PREREQUISITES } from "../lib/milestone-prerequisites";
import { sendDueExchangeDayEmails } from "../lib/exchange-day/send";

const AGENT_EMAIL = "emily@hartwellpartners.co.uk";
const BURNER_SELLER_SOL = "ellisaskey+sellersol@googlemail.com";
const BURNER_BUYER_SOL = "ellisaskey+buyersol@googlemail.com";
const POST_EXCHANGE = new Set(["VM19", "VM20", "PM26", "PM27"]);

function daysAgo(n: number) { const d = new Date(); d.setDate(d.getDate() - n); d.setHours(10, 0, 0, 0); return d; }
function daysFromNow(n: number) { const d = new Date(); d.setDate(d.getDate() + n); d.setHours(12, 0, 0, 0); return d; }
// A Date at h:m UK today.
function ukToday(h: number, m: number): Date {
  const s = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(new Date());
  const [Y, M, D] = s.split("-").map(Number);
  let c = new Date(Date.UTC(Y, M - 1, D, h, m, 0));
  const ukH = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "2-digit", hour12: false }).format(c)) % 24;
  const off = ukH - h; if (off !== 0) c = new Date(c.getTime() - off * 3600000);
  return c;
}

async function main() {
  if (process.env.DATABASE_URL?.includes("gmkfustgwipgihpmpjpr")) throw new Error("Refusing to run on PRODUCTION");
  const emily = await prisma.user.findUnique({ where: { email: AGENT_EMAIL }, select: { id: true, agencyId: true } });
  if (!emily?.agencyId) throw new Error("no agent/agency");

  const buyerToken = randomBytes(20).toString("base64url");
  const sellerToken = randomBytes(20).toString("base64url");

  const tx = await prisma.propertyTransaction.create({
    data: {
      propertyAddress: "12 Exchange Day Demo, Testfield, TF3 3EX",
      agencyId: emily.agencyId, agentUserId: emily.id, progressedBy: "agent",
      serviceType: "self_managed", status: "active", tenure: "freehold", purchaseType: "mortgage",
      purchasePrice: 47500000, createdAt: daysAgo(70), lastActivityAt: daysAgo(1),
      completionDate: daysFromNow(14),
      // Active in exchange day, started early today so the morning email is sendable.
      exchangeDayStartedAt: ukToday(7, 0), exchangeDayCancelledAt: null,
    },
    select: { id: true },
  });

  // Client contacts (buyer already gave authority; seller has not).
  const buyer = await prisma.contact.create({ data: { propertyTransactionId: tx.id, name: "Jordan Blake", email: "ellisaskey+buyer@googlemail.com", roleType: "purchaser", portalToken: buyerToken, exchangeAuthorityGivenAt: ukToday(8, 30) }, select: { id: true } });
  const seller = await prisma.contact.create({ data: { propertyTransactionId: tx.id, name: "Morgan Reed", email: "ellisaskey+seller@googlemail.com", roleType: "vendor", portalToken: sellerToken }, select: { id: true } });

  // Solicitor firm + two solicitor contacts (burner emails so the emails are safe to send).
  const firm = await prisma.solicitorFirm.create({ data: { name: "Testfield Law LLP" }, select: { id: true } });
  const vendorSol = await prisma.solicitorContact.create({ data: { firmId: firm.id, name: "Sarah Vendor-Solicitor", email: BURNER_SELLER_SOL }, select: { id: true } });
  const buyerSol = await prisma.solicitorContact.create({ data: { firmId: firm.id, name: "David Buyer-Solicitor", email: BURNER_BUYER_SOL }, select: { id: true } });
  await prisma.propertyTransaction.update({ where: { id: tx.id }, data: { vendorSolicitorContactId: vendorSol.id, purchaserSolicitorContactId: buyerSol.id } });

  // Milestones: complete everything up to ready-to-exchange (VM18/PM25 done);
  // leave exchange (VM19/PM26) + completion (VM20/PM27) outstanding.
  const defs = await prisma.milestoneDefinition.findMany({ orderBy: [{ side: "asc" }, { orderIndex: "asc" }] });
  const autoNr = computeAutoNrCodes("mortgage", "freehold");
  const avail = new Set<string>();
  for (const d of defs) { if (autoNr.has(d.code)) continue; const p = DIRECT_PREREQUISITES[d.code] ?? []; if (p.length === 0 || p.every((x) => autoNr.has(x))) avail.add(d.code); }
  await prisma.milestoneCompletion.createMany({
    data: defs.map((d) => { const nr = autoNr.has(d.code); return { transactionId: tx.id, milestoneDefinitionId: d.id, state: (nr ? "not_required" : avail.has(d.code) ? "available" : "locked") as "not_required" | "available" | "locked", notRequiredReason: nr ? "Auto" : null, completedById: emily.id }; }),
  });
  for (const d of defs) {
    if (POST_EXCHANGE.has(d.code) || autoNr.has(d.code)) continue;
    await prisma.milestoneCompletion.updateMany({ where: { transactionId: tx.id, milestoneDefinitionId: d.id }, data: { state: "complete", completedAt: daysAgo(20), completedById: emily.id } });
  }

  // Start-of-day activity note (mirrors what startExchangeDay logs).
  await prisma.outboundMessage.create({ data: { transactionId: tx.id, type: "internal_note", contactIds: [], content: `Emily Chen started exchange day. Aiming to exchange today, with completion agreed for ${daysFromNow(14).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}.`, createdById: emily.id } });
  // The buyer's portal authority confirmation note.
  await prisma.outboundMessage.create({ data: { transactionId: tx.id, type: "internal_note", contactIds: [buyer.id], content: `Jordan Blake confirmed via their portal that they've given their solicitor authority to exchange.`, createdById: emily.id } });

  // Fire the morning (08:45) solicitor emails now (to the burners) so they show
  // in the activity log + land in the inbox. Uses a mocked "now" at 08:50.
  const res = await sendDueExchangeDayEmails(ukToday(8, 50));

  console.log("=== Exchange Day demo seeded ===");
  console.log(`Morning emails sent: ${res.emails} to ${res.files} file(s) (to burner solicitor inboxes)`);
  console.log(`\nAgent file (hero control + authority tracker + activity):\n  http://localhost:3000/agent/transactions/${tx.id}`);
  console.log(`\nBuyer portal (authority already given):\n  http://localhost:3000/portal/${buyerToken}`);
  console.log(`\nSeller portal (can click "I've given authority"):\n  http://localhost:3000/portal/${sellerToken}`);
}

main().then(() => prisma.$disconnect()).catch(async (e) => { console.error(e.message ?? e); await prisma.$disconnect(); process.exit(1); });
