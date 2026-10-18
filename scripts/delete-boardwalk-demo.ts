// One-shot TEARDOWN: completely remove the Boardwalk Property Co production demo
// (agency "Boardwalk Property Co", director millie@boardwalkpropertyco.com, its 6
// files and ALL their child rows, the fictional solicitor firms, and the uploaded
// logo + property photos). Run this after the demo to wipe everything.
//
// SAFE BY DEFAULT: dry-run (counts only). Pass --confirm to actually delete.
// PROD-only guard; connects via DIRECT_URL.
//
//   dry run : npx dotenv -e .env.production --override -- npx tsx scripts/delete-boardwalk-demo.ts
//   delete  : npx dotenv -e .env.production --override -- npx tsx scripts/delete-boardwalk-demo.ts --confirm
//
// Registered in docs/SCRIPTS_REGISTRY.md (shared Boardwalk-demo teardown).

import { PrismaClient } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";

const CONFIRM = process.argv.includes("--confirm");
const prisma = new PrismaClient({ datasources: { db: { url: process.env.DIRECT_URL } } });

const AGENCY_NAME = "Boardwalk Property Co";
const DIRECTOR_EMAIL = "millie@boardwalkpropertyco.com";
// The fictional firms this demo created (safe to remove — not real, Boardwalk-only).
const DEMO_FIRMS = ["Clifton & Vale Conveyancing", "Ashton Gate Legal LLP", "Redcliffe Property Law", "Harbourside Legal"];
const DEMO_BROKER_FIRMS = ["Brunel Mortgage Partners"];

// Every model that carries a transaction FK (from the schema). milestoneCompletion
// is first and buyerRound last so the buyerRoundId FK never blocks. A model that
// uses propertyTransactionId instead of transactionId is retried with that field.
// Any model with zero rows is a no-op; the two-pass loop mops up ordering edges.
const CHILD_MODELS = [
  "milestoneCompletion", "milestoneAvailabilityEvent", "milestoneProposal",
  "checkpoint", // cascades CheckpointConfirmation
  "manualTask", "outboundMessage", "transactionNote", "transactionDocument",
  "transactionFlag", "transactionHoldPeriod", "transactionRiskHistory",
  "reminderLog", "chaseTask", "chaseSend", "chaseEmailOverride",
  "clientChaseState", "solicitorChaseState", "advisorChaseState",
  "enquiryRaiseChase", "enquiryTracker",
  "fileTimeSession", "portalTimeSession", "portalMessage",
  "notification", "brokerNotification", "outsourcedAssignmentNotification",
  "exchangePredictionHistory", "priceHistory", "quoteRequest", "referral",
  "chainLink", "chainNeighbourUpdate", "whatsAppThread", "whatsAppGroupMapping",
  "followupTap", "hubCardDismissal", "featureEvent", "agentEmailLog", "agentRun",
  "clientMoveInfo", "onwardTracker", "invoiceLine", "creditNote",
  "contact", // uses propertyTransactionId
  "buyerRound",
];

async function clearChild(model: string, txIds: string[]): Promise<number> {
  const m = (prisma as any)[model];
  if (!m?.deleteMany) { console.log(`   ! unknown model accessor: ${model}`); return 0; }
  const tryDelete = async (field: string) => (await m.deleteMany({ where: { [field]: { in: txIds } } })).count as number;
  const tryCount = async (field: string) => (await m.count({ where: { [field]: { in: txIds } } })) as number;
  for (const field of ["transactionId", "propertyTransactionId"]) {
    try { return CONFIRM ? await tryDelete(field) : await tryCount(field); }
    catch { /* wrong field name for this model — try the next */ }
  }
  return 0;
}

async function main() {
  const dbUrl = process.env.DATABASE_URL ?? "";
  if (!dbUrl.includes("gmkfustgwipgihpmpjpr")) { console.error("REFUSING: not the PROD project."); process.exit(1); }
  console.log(`== Boardwalk demo teardown ${CONFIRM ? "(LIVE DELETE)" : "(DRY RUN — counts only)"} ==\n`);

  const agency = await prisma.agency.findFirst({ where: { name: AGENCY_NAME }, select: { id: true, logoPath: true } });
  if (!agency) { console.log("No Boardwalk agency found — nothing to do."); await prisma.$disconnect(); return; }
  const txs = await prisma.propertyTransaction.findMany({ where: { agencyId: agency.id }, select: { id: true } });
  const txIds = txs.map((t) => t.id);
  console.log(`Agency ${agency.id} | ${txIds.length} files`);

  // Storage: logo + property photos
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && key) {
    const supabase = createClient(url, key);
    const photoPaths = txIds.map((id) => `property-photos/${id}.jpg`);
    if (CONFIRM) {
      if (agency.logoPath) await supabase.storage.from("agency-logos").remove([agency.logoPath]).catch(() => {});
      await supabase.storage.from("transaction-documents").remove(photoPaths).catch(() => {});
      console.log(`Storage: removed logo + ${photoPaths.length} property photos`);
    } else {
      console.log(`Storage: would remove logo (${agency.logoPath ?? "none"}) + ${photoPaths.length} property photos`);
    }
  }

  // Child rows (two passes to absorb any FK ordering edge)
  const totals: Record<string, number> = {};
  for (let pass = 0; pass < 2; pass++) {
    for (const model of CHILD_MODELS) {
      const n = await clearChild(model, txIds);
      if (n) totals[model] = (totals[model] ?? 0) + n;
    }
    if (!CONFIRM) break; // dry run: one pass of counts is enough
  }
  const childLines = Object.entries(totals).filter(([, n]) => n > 0);
  console.log(`\nChild rows ${CONFIRM ? "deleted" : "found"}:`);
  for (const [m, n] of childLines) console.log(`   ${m}: ${n}`);
  if (!childLines.length) console.log("   (none)");

  // Transactions, user, agency, fictional solicitor firms
  if (CONFIRM) {
    const txDel = await prisma.propertyTransaction.deleteMany({ where: { agencyId: agency.id } });
    // All Boardwalk users (director + the demo negotiators), by agency.
    const userDel = await prisma.user.deleteMany({ where: { agencyId: agency.id } });
    // Chains: txId-based child deletion above only caught claimed links. Remove the
    // chains themselves (cascades remaining stub links + entries + step marks).
    const chainIds = (await prisma.propertyChain.findMany({ where: { agencyId: agency.id }, select: { id: true } })).map((c) => c.id);
    if (chainIds.length) {
      await prisma.chainNotificationQueue.deleteMany({ where: { chainId: { in: chainIds } } }).catch(() => {});
      await prisma.chainLink.deleteMany({ where: { chainId: { in: chainIds } } }).catch(() => {});
      await prisma.propertyChain.deleteMany({ where: { id: { in: chainIds } } }).catch(() => {});
      console.log(`Chains removed: ${chainIds.length}`);
    }
    // Agency-direct children that would otherwise block the agency delete.
    await prisma.agencyRecommendedSolicitor.deleteMany({ where: { agencyId: agency.id } }).catch(() => {});
    const agencyDel = await prisma.agency.deleteMany({ where: { id: agency.id } });
    console.log(`\nTransactions deleted: ${txDel.count} | user: ${userDel.count} | agency: ${agencyDel.count}`);
    for (const name of DEMO_FIRMS) {
      const firm = await prisma.solicitorFirm.findFirst({ where: { name }, select: { id: true } });
      if (!firm) continue;
      await prisma.solicitorContact.deleteMany({ where: { firmId: firm.id } }).catch(() => {});
      await prisma.solicitorFirm.delete({ where: { id: firm.id } }).catch((e) => console.log(`   ! kept firm "${name}" (still referenced): ${e.message?.slice(0, 60)}`));
    }
    for (const name of DEMO_BROKER_FIRMS) {
      const firm = await prisma.brokerFirm.findFirst({ where: { name }, select: { id: true } });
      if (!firm) continue;
      await prisma.brokerContact.deleteMany({ where: { firmId: firm.id } }).catch(() => {});
      await prisma.brokerFirm.delete({ where: { id: firm.id } }).catch((e) => console.log(`   ! kept broker "${name}" (still referenced): ${e.message?.slice(0, 60)}`));
    }
    console.log("Fictional solicitor firms, recommended panel + broker removed (where unreferenced).");
    console.log("\nTeardown complete. Boardwalk demo fully removed.");
  } else {
    const user = await prisma.user.count({ where: { email: DIRECTOR_EMAIL } });
    console.log(`\nWould delete: ${txIds.length} transactions, ${user} director, 1 agency, up to ${DEMO_FIRMS.length} solicitor firms.`);
    console.log("Re-run with --confirm to execute.");
  }
  await prisma.$disconnect();
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
