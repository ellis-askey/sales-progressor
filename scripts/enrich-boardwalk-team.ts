// One-shot: give the Boardwalk prod demo a TEAM so the analytics leaderboard
// compares agents, and put a couple of files on the enquiries tracker.
//
//   - 2 extra negotiators (Tom Hartley, Sophie Clarke), silenced like Millie.
//   - A per-agent book of business across 2026 (completed+exchanged files with
//     varied timeframes + a few withdrawn) for Millie / Tom / Sophie, so the
//     leaderboard (needs team > 1) shows Submitted / Exchanged / Conversion /
//     Pipeline / Avg fee, and the per-agent avg-days-to-exchange differs.
//       NB the leaderboard defaults to "This month"; the rich comparison is in
//       the "This year" view (exchanges have createdAt months before exchange).
//     Historical files are completed/withdrawn only, so they never clutter the
//     active pipeline, the hub, or the chains board.
//   - 2 EnquiryTracker rows (Cotham = awaiting pack, Ashton = partial replies).
//
// Exchanged = VM19 milestone complete (hasExchanged). All files isDemo:false.
// PROD-only guard; DIRECT_URL; idempotent (skips a file/user that already exists).
// No emails. Teardown removes everything (users by agencyId + files by agencyId).
//
//   npx dotenv -e .env.production --override -- npx tsx scripts/enrich-boardwalk-team.ts

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient({ datasources: { db: { url: process.env.DIRECT_URL } } });
const now = new Date();
const daysAgo = (n: number) => new Date(now.getTime() - Math.max(0, n) * 86400000);

const SILENT = {
  welcomeEmailSentAt: now, retentionEmailOptOut: true, hasSeenAgentWelcome: true, demoTourSkippedAt: now,
  agentPreferences: { brandColor: "#404648", notifications: { morningDigest: false, weeklyBrief: false, clientConfirmationEmails: false, chainEmails: false, appointmentReminders: false } },
};

const NEGOTIATORS = [
  { name: "Tom Hartley", email: "tom@boardwalkpropertyco.com" },
  { name: "Sophie Clarke", email: "sophie@boardwalkpropertyco.com" },
];

// Per-agent book: exchanged (completed) + withdrawn (fell-through) counts, avg
// days-to-exchange, commission %, and a price base (£k). Tuned to compare.
const BOOK = [
  { who: "millie@boardwalkpropertyco.com", exchanged: 6, withdrawn: 2, avgGap: 76, feePct: 1.25, priceK: 48 },
  { who: "tom@boardwalkpropertyco.com",    exchanged: 9, withdrawn: 3, avgGap: 96, feePct: 1.1,  priceK: 42 },
  { who: "sophie@boardwalkpropertyco.com", exchanged: 6, withdrawn: 1, avgGap: 69, feePct: 1.4,  priceK: 55 },
];

// 40 fictional Bristol addresses (seed-file whitelisted; fake numbers on real streets).
const STREETS: [string, string, string][] = [
  ["Gloucester Road", "Bishopston", "BS7 8BN"], ["Whiteladies Road", "Clifton", "BS8 2LR"],
  ["Church Road", "Redfield", "BS5 9JJ"], ["North Road", "St Andrews", "BS6 5AD"],
  ["Coldharbour Road", "Westbury Park", "BS6 7JX"], ["Henleaze Road", "Henleaze", "BS9 4EX"],
  ["Wells Road", "Totterdown", "BS4 2AG"], ["Air Balloon Road", "St George", "BS5 8LB"],
  ["Filton Avenue", "Horfield", "BS7 0AB"], ["Sandy Park Road", "Brislington", "BS4 3PE"],
  ["West Street", "Bedminster", "BS3 3NR"], ["Stackpool Road", "Southville", "BS3 1NW"],
  ["Berkeley Road", "Bishopston", "BS7 8HF"], ["Hampton Road", "Redland", "BS6 6JA"],
  ["Chandos Road", "Redland", "BS6 6PE"], ["Kellaway Avenue", "Golden Hill", "BS6 7XR"],
  ["Downend Road", "Fishponds", "BS16 5AS"], ["Soundwell Road", "Staple Hill", "BS16 4RA"],
  ["High Street", "Westbury on Trym", "BS9 3DU"], ["Canford Lane", "Westbury on Trym", "BS9 3DH"],
  ["Nympsfield Close", "Bradley Stoke", "BS32 8AX"], ["Park Street", "Bristol", "BS1 5NG"],
  ["Cotham Hill", "Cotham", "BS6 6LF"], ["Zetland Road", "Redland", "BS6 7AH"],
  ["Gwilliam Street", "Windmill Hill", "BS3 4BU"], ["British Road", "Bedminster", "BS3 3BW"],
  ["Mivart Street", "Easton", "BS5 6JF"], ["Beaufort Road", "St George", "BS5 8EU"],
  ["Overndale Road", "Downend", "BS16 2RT"], ["Station Road", "Shirehampton", "BS11 9TU"],
  ["Falcondale Road", "Westbury on Trym", "BS9 3JN"], ["Grove Park Road", "Fishponds", "BS16 2BL"],
  ["Lodge Causeway", "Fishponds", "BS16 3JB"], ["Raleigh Road", "Southville", "BS3 1QN"],
  ["Alma Road", "Clifton", "BS8 2DJ"], ["Pembroke Road", "Clifton", "BS8 3ED"],
  ["Sommerville Road", "St Andrews", "BS7 9AA"], ["Egerton Road", "Bishopston", "BS7 8HL"],
  ["Nevil Road", "Bishopston", "BS7 9EG"], ["Monk Road", "Bishopston", "BS7 8LF"],
];
let addrIdx = 0;
function nextAddress(): string {
  const [st, area, pc] = STREETS[addrIdx % STREETS.length];
  const num = 2 + (addrIdx * 7) % 180; // deterministic fake house number
  addrIdx++;
  return `${num} ${st}, ${area}, Bristol, ${pc}`;
}

async function ensureUser(name: string, email: string, agencyId: string, password: string): Promise<string> {
  const data = { name, role: "negotiator" as const, agencyId, firmName: "Boardwalk Property Co", password, ...SILENT };
  const u = await prisma.user.upsert({ where: { email }, update: data, create: { email, ...data }, select: { id: true } });
  return u.id;
}

async function main() {
  const dbUrl = process.env.DATABASE_URL ?? "";
  if (!dbUrl.includes("gmkfustgwipgihpmpjpr")) { console.error("REFUSING: not the PROD project."); process.exit(1); }
  if (dbUrl.includes("etidawkbqctarmsdjoxp")) { console.error("REFUSING: staging."); process.exit(1); }
  console.log("== Enrich Boardwalk team + leaderboard + enquiries (LIVE PROD) ==\n");

  const agency = await prisma.agency.findFirst({ where: { name: "Boardwalk Property Co" }, select: { id: true } });
  if (!agency) { console.error("agency missing"); process.exit(1); }
  const password = await bcrypt.hash("password", 12);

  // ── Negotiators ──────────────────────────────────────────────────────
  for (const n of NEGOTIATORS) { await ensureUser(n.name, n.email, agency.id, password); console.log(`user: ${n.name} <${n.email}>`); }

  // ── Exchange milestone defs ──────────────────────────────────────────
  const defs = await prisma.milestoneDefinition.findMany({ where: { code: { in: ["VM19", "VM20"] } }, select: { id: true, code: true } });
  const vm19 = defs.find((d) => d.code === "VM19")!.id;
  const vm20 = defs.find((d) => d.code === "VM20")!.id;

  // ── Per-agent book of business ───────────────────────────────────────
  console.log("\nSeeding per-agent history:");
  for (const b of BOOK) {
    const user = await prisma.user.findUnique({ where: { email: b.who }, select: { id: true } });
    if (!user) { console.log(`  ! no user ${b.who}`); continue; }
    let madeExch = 0, madeWd = 0;
    // exchanged (completed) files, spread across 2026 with varied timeframes
    for (let j = 0; j < b.exchanged; j++) {
      const gap = b.avgGap + ((j % 5) - 2) * 4; // vary ±8 around avg
      const createdDaysAgo = (gap + 12) + Math.round((j * (255 - gap)) / Math.max(b.exchanged - 1, 1));
      const address = nextAddress();
      if (await prisma.propertyTransaction.findFirst({ where: { propertyAddress: address, agencyId: agency.id }, select: { id: true } })) continue;
      const tx = await prisma.propertyTransaction.create({
        data: {
          propertyAddress: address, agencyId: agency.id, agentUserId: user.id, status: "completed",
          serviceType: "self_managed", purchasePrice: (b.priceK + (j % 6) * 3) * 1000 * 100,
          agentFeePercent: b.feePct, agentFeeIsVatInclusive: false,
          tenure: "freehold", purchaseType: "mortgage",
          createdAt: daysAgo(createdDaysAgo), completionDate: daysAgo(Math.max(1, createdDaysAgo - gap - 28)),
          lastActivityAt: daysAgo(Math.max(1, createdDaysAgo - gap - 20)),
        },
        select: { id: true },
      });
      await prisma.milestoneCompletion.createMany({ data: [
        { transactionId: tx.id, milestoneDefinitionId: vm19, state: "complete", completedAt: daysAgo(createdDaysAgo - gap), completedById: user.id },
        { transactionId: tx.id, milestoneDefinitionId: vm20, state: "complete", completedAt: daysAgo(Math.max(1, createdDaysAgo - gap - 14)), completedById: user.id },
      ]});
      madeExch++;
    }
    // withdrawn (fell-through) files — count in "submitted" to vary conversion,
    // but never active, so they stay off the pipeline + chains boards.
    for (let k = 0; k < b.withdrawn; k++) {
      const address = nextAddress();
      if (await prisma.propertyTransaction.findFirst({ where: { propertyAddress: address, agencyId: agency.id }, select: { id: true } })) continue;
      await prisma.propertyTransaction.create({
        data: {
          propertyAddress: address, agencyId: agency.id, agentUserId: user.id, status: "withdrawn",
          serviceType: "self_managed", purchasePrice: (b.priceK + 4) * 1000 * 100,
          agentFeePercent: b.feePct, agentFeeIsVatInclusive: false, tenure: "freehold", purchaseType: "mortgage",
          createdAt: daysAgo(40 + k * 45), lastActivityAt: daysAgo(30 + k * 45),
        },
      });
      madeWd++;
    }
    console.log(`  ${b.who.split("@")[0].padEnd(8)} +${madeExch} exchanged, +${madeWd} withdrawn (avg ~${b.avgGap}d, ${b.feePct}%)`);
  }

  // ── Enquiries tracker (Cotham = awaiting pack, Ashton = partial replies) ──
  console.log("\nEnquiries tracker:");
  const trackers = [
    { match: "Cotham Brow", data: { currentlyWith: "seller_solicitor" as const, openedAt: daysAgo(16), lastMovementAt: daysAgo(5), lastChasedAt: daysAgo(3), chaseCount: 2, outstandingNote: "Waiting on: management pack from the freeholder, and the FENSA certificate for the rear windows." } },
    { match: "Ashton Road", data: { currentlyWith: "seller_solicitor" as const, openedAt: daysAgo(12), lastMovementAt: daysAgo(2), lastChasedAt: daysAgo(2), chaseCount: 1, partialRepliesAt: daysAgo(4), outstandingNote: "Replies in on most points. Still waiting on the boundary responsibility and the boiler service history." } },
  ];
  for (const t of trackers) {
    const tx = await prisma.propertyTransaction.findFirst({ where: { agencyId: agency.id, propertyAddress: { contains: t.match } }, select: { id: true, propertyAddress: true } });
    if (!tx) { console.log(`  ! no file "${t.match}"`); continue; }
    const existing = await prisma.enquiryTracker.findUnique({ where: { transactionId: tx.id }, select: { id: true } });
    if (existing) await prisma.enquiryTracker.update({ where: { id: existing.id }, data: t.data });
    else await prisma.enquiryTracker.create({ data: { transactionId: tx.id, ...t.data } });
    console.log(`  ${tx.propertyAddress.split(",")[0]} — on the enquiries tracker`);
  }

  console.log("\nDone. (Leaderboard: open Analytics → 'This year' to compare the team.)");
}

main().then(() => prisma.$disconnect()).catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
