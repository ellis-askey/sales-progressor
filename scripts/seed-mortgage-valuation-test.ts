// DISPOSABLE. STAGING ONLY. Seeds a buyer portal file with the lender-valuation
// step (PM6) available, so the mortgage-confirm flow can be tested as the buyer
// on a local link across all three surfaces: the overview "next step" card, the
// progress step list, and the /respond chase-email route (a ClientChaseState row
// is seeded so PM6 appears there). Delete after testing.
//
// Run: npx dotenv -e .env -- npx ts-node --project tsconfig.scripts.json scripts/seed-mortgage-valuation-test.ts

import { randomBytes } from "node:crypto";
import { prisma } from "../lib/prisma";
import { computeAutoNrCodes } from "../lib/milestone-auto-nr";
import { DIRECT_PREREQUISITES } from "../lib/milestone-prerequisites";

function transitivePrereqs(code: string): Set<string> {
  const seen = new Set<string>();
  const stack = [...(DIRECT_PREREQUISITES[code] ?? [])];
  while (stack.length) {
    const c = stack.pop()!;
    if (seen.has(c)) continue;
    seen.add(c);
    for (const p of DIRECT_PREREQUISITES[c] ?? []) stack.push(p);
  }
  return seen;
}

async function main() {
  if (process.env.DATABASE_URL?.includes("gmkfustgwipgihpmpjpr")) throw new Error("Refusing to run on PRODUCTION");

  const agent = await prisma.user.findFirst({
    where: { agencyId: { not: null }, role: { in: ["director", "negotiator"] } },
    select: { id: true, agencyId: true, email: true },
  });
  if (!agent?.agencyId) throw new Error("No agency agent found on this DB");

  const buyerToken = randomBytes(20).toString("base64url");
  const sellerToken = randomBytes(20).toString("base64url");

  const tx = await prisma.propertyTransaction.create({
    data: {
      propertyAddress: "9 Valuation Test Rise, Testfield, TF3 1LV",
      agencyId: agent.agencyId, agentUserId: agent.id, progressedBy: "agent",
      serviceType: "self_managed", status: "active", tenure: "freehold", purchaseType: "mortgage",
      purchasePrice: 42500000, lastActivityAt: new Date(),
    },
    select: { id: true },
  });

  const buyer = await prisma.contact.create({
    data: { propertyTransactionId: tx.id, name: "Test Buyer", email: "ellisaskey+valtest@googlemail.com", roleType: "purchaser", portalToken: buyerToken, portalEligible: true },
    select: { id: true },
  });
  await prisma.contact.create({
    data: { propertyTransactionId: tx.id, name: "Test Seller", email: "ellisaskey+valseller@googlemail.com", roleType: "vendor", portalToken: sellerToken, portalEligible: true },
  });

  const defs = await prisma.milestoneDefinition.findMany({ orderBy: [{ side: "asc" }, { orderIndex: "asc" }] });
  const autoNr = computeAutoNrCodes("mortgage", "freehold");
  const pre6 = transitivePrereqs("PM6");

  await prisma.milestoneCompletion.createMany({
    data: defs.map((d) => {
      const nr = autoNr.has(d.code);
      const state: "not_required" | "available" | "locked" | "complete" =
        nr ? "not_required" : d.code === "PM6" ? "available" : pre6.has(d.code) ? "complete" : "locked";
      return {
        transactionId: tx.id,
        milestoneDefinitionId: d.id,
        state,
        notRequiredReason: nr ? "Auto" : null,
        completedAt: state === "complete" ? new Date() : null,
        completedById: state === "complete" ? agent.id : null,
      };
    }),
  });

  // Chase-state row so PM6 surfaces on the /respond chase-email route.
  await prisma.clientChaseState.create({
    data: {
      transactionId: tx.id,
      contactId: buyer.id,
      milestoneCode: "PM6",
      status: "active",
      chaseCount: 1,
      firstChasedAt: new Date(),
      lastChasedAt: new Date(),
    },
  });

  console.log("\n=== Seeded mortgage-valuation test file (staging) ===");
  console.log("Agent:", agent.email);
  console.log("Tx:", tx.id, "— 9 Valuation Test Rise, Testfield, TF3 1LV");
  console.log("PM6 prereqs completed:", [...pre6].join(", ") || "(none)");
  console.log("\nBUYER PORTAL (overview):      http://localhost:3001/portal/" + buyerToken);
  console.log("BUYER STEPS (progress list):  http://localhost:3001/portal/" + buyerToken + "/progress");
  console.log("BUYER RESPOND (email route):  http://localhost:3001/portal/" + buyerToken + "/respond?items=PM6&src=chase");
  console.log("\n(To remove later: delete tx " + tx.id + ")");
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
