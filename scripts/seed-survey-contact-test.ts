// DISPOSABLE. STAGING ONLY. Seeds a buyer portal file with the survey step (PM9)
// available, so the #295 surveyor-contact flow can be tested as the buyer on a
// local link. No quotes seeded, so the buyer hits the "who did you book + how to
// reach them" required capture directly. Delete after testing.
//
// Run: npx dotenv -e .env -- npx ts-node --project tsconfig.scripts.json scripts/seed-survey-contact-test.ts

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
      propertyAddress: "7 Survey Test Close, Testfield, TF2 9SV",
      agencyId: agent.agencyId, agentUserId: agent.id, progressedBy: "agent",
      serviceType: "self_managed", status: "active", tenure: "freehold", purchaseType: "mortgage",
      purchasePrice: 38500000, lastActivityAt: new Date(),
    },
    select: { id: true },
  });

  await prisma.contact.create({
    data: { propertyTransactionId: tx.id, name: "Test Buyer", email: "ellisaskey+surveytest@googlemail.com", roleType: "purchaser", portalToken: buyerToken, portalEligible: true },
  });
  await prisma.contact.create({
    data: { propertyTransactionId: tx.id, name: "Test Seller", email: "ellisaskey+surveyseller@googlemail.com", roleType: "vendor", portalToken: sellerToken, portalEligible: true },
  });

  const defs = await prisma.milestoneDefinition.findMany({ orderBy: [{ side: "asc" }, { orderIndex: "asc" }] });
  const autoNr = computeAutoNrCodes("mortgage", "freehold");
  const pre9 = transitivePrereqs("PM9");

  await prisma.milestoneCompletion.createMany({
    data: defs.map((d) => {
      const nr = autoNr.has(d.code);
      const state: "not_required" | "available" | "locked" | "complete" =
        nr ? "not_required" : d.code === "PM9" ? "available" : pre9.has(d.code) ? "complete" : "locked";
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

  console.log("\n=== Seeded survey-contact test file (staging) ===");
  console.log("Agent:", agent.email);
  console.log("Tx:", tx.id, "— 7 Survey Test Close, Testfield, TF2 9SV");
  console.log("PM9 prereqs completed:", [...pre9].join(", ") || "(none)");
  console.log("\nBUYER PORTAL LINK (local):");
  console.log("  http://localhost:3001/portal/" + buyerToken);
  console.log("\n(To remove later: delete tx " + tx.id + ")");
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
