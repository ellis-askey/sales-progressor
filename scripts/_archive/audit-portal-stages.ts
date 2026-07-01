// Audit: for every active prod file, compute what stage the portal-tips
// detectStage function returns AND what stage it *should* return based
// on canonical exchange/completion milestone codes. Surfaces the
// "claims exchanged but VM19 not done" lie.
import { PrismaClient } from "@prisma/client";
import { detectStage } from "@/lib/portal-tips";
const p = new PrismaClient();

(async () => {
  const txs = await p.propertyTransaction.findMany({
    where: { status: { in: ["active", "completed"] } },
    select: {
      id: true, propertyAddress: true, status: true,
      activeBuyerRoundId: true,
    },
    orderBy: { propertyAddress: "asc" },
  });

  const defs = await p.milestoneDefinition.findMany({ select: { id: true, code: true } });
  const codeById = new Map(defs.map((d) => [d.id, d.code]));

  type Row = {
    address: string;
    txStatus: string;
    vendorBuggedStage: string;
    purchaserBuggedStage: string;
    vmDone: string[];
    pmDone: string[];
    vm19: boolean;
    vm20: boolean;
    pm26: boolean;
    pm27: boolean;
    canonicalStageV: string;
    canonicalStageP: string;
  };

  const rows: Row[] = [];
  for (const tx of txs) {
    const comps = await p.milestoneCompletion.findMany({
      where: {
        transactionId: tx.id,
        state: "complete",
        OR: [{ buyerRoundId: null }, { buyerRoundId: tx.activeBuyerRoundId }],
      },
      select: { milestoneDefinitionId: true },
    });
    const doneCodes = comps.map((c) => codeById.get(c.milestoneDefinitionId)!).filter(Boolean).sort();
    const vmDone = doneCodes.filter((c) => c.startsWith("VM"));
    const pmDone = doneCodes.filter((c) => c.startsWith("PM"));
    const milestonesForDetect = doneCodes.map((c) => ({ code: c, isComplete: true }));

    const vm19 = doneCodes.includes("VM19");
    const vm20 = doneCodes.includes("VM20");
    const pm26 = doneCodes.includes("PM26");
    const pm27 = doneCodes.includes("PM27");

    const canonical = (side: "vendor" | "purchaser") => {
      const exch = side === "vendor" ? vm19 : pm26;
      const comp = side === "vendor" ? vm20 : pm27;
      if (comp) return "completed";
      if (exch) return "exchanged";
      return "pre-exchange-or-earlier";
    };

    rows.push({
      address: tx.propertyAddress,
      txStatus: tx.status,
      vendorBuggedStage: detectStage(milestonesForDetect, "vendor"),
      purchaserBuggedStage: detectStage(milestonesForDetect, "purchaser"),
      vmDone, pmDone, vm19, vm20, pm26, pm27,
      canonicalStageV: canonical("vendor"),
      canonicalStageP: canonical("purchaser"),
    });
  }

  // Group by bugged stage to show prevalence
  const groups = new Map<string, number>();
  for (const r of rows) {
    groups.set(r.vendorBuggedStage, (groups.get(r.vendorBuggedStage) ?? 0) + 1);
    groups.set("PURCH_" + r.purchaserBuggedStage, (groups.get("PURCH_" + r.purchaserBuggedStage) ?? 0) + 1);
  }

  // Identify lies: bugged says "exchanged" or "completed" while canonical says otherwise
  const liesExchanged = rows.filter((r) =>
    (r.vendorBuggedStage === "exchanged" && !r.vm19) ||
    (r.purchaserBuggedStage === "exchanged" && !r.pm26),
  );
  const liesCompleted = rows.filter((r) =>
    (r.vendorBuggedStage === "completed" && !r.vm20) ||
    (r.purchaserBuggedStage === "completed" && !r.pm27),
  );

  console.log(`Total active/completed files: ${rows.length}\n`);

  console.log("--- Lies: bugged stage says 'exchanged' but VM19/PM26 NOT done ---");
  console.log(`Count: ${liesExchanged.length}`);
  for (const r of liesExchanged.slice(0, 15)) {
    console.log(`  ${r.address}`);
    console.log(`    txStatus=${r.txStatus} vendorBugged=${r.vendorBuggedStage} purchaserBugged=${r.purchaserBuggedStage}`);
    console.log(`    vm19=${r.vm19} pm26=${r.pm26}  VM done: ${r.vmDone.join(",")}  PM done: ${r.pmDone.join(",")}`);
  }

  console.log("\n--- Lies: bugged stage says 'completed' but VM20/PM27 NOT done ---");
  console.log(`Count: ${liesCompleted.length}`);
  for (const r of liesCompleted.slice(0, 15)) {
    console.log(`  ${r.address}`);
    console.log(`    txStatus=${r.txStatus} vendorBugged=${r.vendorBuggedStage} purchaserBugged=${r.purchaserBuggedStage}`);
    console.log(`    vm20=${r.vm20} pm27=${r.pm27}`);
  }
})().catch(console.error).finally(() => p.$disconnect());
