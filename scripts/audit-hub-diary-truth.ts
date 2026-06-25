// Audit every active file whose expectedExchangeDate is within the
// next 14 days, and flag the ones where the file is clearly nowhere
// near actual exchange (no VM18/PM25 ready-to-exchange done). These
// are the files the Hub diary will falsely surface as "exchanging
// soon" based on the 12-week-from-creation default placeholder.
import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();

(async () => {
  const now = new Date();
  // Same window the actual getHubDiary uses: now ± 26h, then JS-filter
  // by UK date string. We use ± 14d for the audit so we see upcoming
  // false-positives as well as today's.
  const windowStart = new Date(now.getTime() - 26 * 60 * 60 * 1000);
  const windowEnd = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

  const candidates = await p.propertyTransaction.findMany({
    where: {
      status: "active",
      expectedExchangeDate: { gte: windowStart, lte: windowEnd },
    },
    select: {
      id: true, propertyAddress: true,
      expectedExchangeDate: true, overridePredictedDate: true,
      twelveWeekTarget: true, createdAt: true,
      activeBuyerRoundId: true,
    },
    orderBy: { expectedExchangeDate: "asc" },
  });

  const defs = await p.milestoneDefinition.findMany({
    where: { code: { in: ["VM18", "PM25", "VM19", "PM26"] } },
    select: { id: true, code: true },
  });

  type Row = {
    address: string;
    expectedExchangeDate: Date;
    overrideSet: boolean;
    isPlaceholderDefault: boolean; // expectedExchangeDate === twelveWeekTarget
    vm18: boolean; pm25: boolean; vm19: boolean; pm26: boolean;
    readyToExchange: boolean;
    isFalseDiarySignal: boolean;
  };

  const rows: Row[] = [];
  for (const tx of candidates) {
    const comps = await p.milestoneCompletion.findMany({
      where: {
        transactionId: tx.id,
        state: "complete",
        milestoneDefinitionId: { in: defs.map((d) => d.id) },
        OR: [{ buyerRoundId: null }, { buyerRoundId: tx.activeBuyerRoundId }],
      },
      select: { milestoneDefinitionId: true },
    });
    const done = new Set(
      comps.map((c) => defs.find((d) => d.id === c.milestoneDefinitionId)?.code).filter((x): x is string => !!x),
    );
    const vm18 = done.has("VM18"), pm25 = done.has("PM25");
    const vm19 = done.has("VM19"), pm26 = done.has("PM26");
    const readyToExchange = vm18 || pm25;
    const overrideSet = tx.overridePredictedDate !== null;
    const isPlaceholderDefault = !!(tx.twelveWeekTarget && tx.expectedExchangeDate &&
      Math.abs(tx.twelveWeekTarget.getTime() - tx.expectedExchangeDate.getTime()) < 24 * 60 * 60 * 1000);
    const isFalseDiarySignal =
      !overrideSet && isPlaceholderDefault && !readyToExchange && !vm19 && !pm26;

    rows.push({
      address: tx.propertyAddress,
      expectedExchangeDate: tx.expectedExchangeDate!,
      overrideSet, isPlaceholderDefault,
      vm18, pm25, vm19, pm26, readyToExchange,
      isFalseDiarySignal,
    });
  }

  console.log(`Active files with expectedExchangeDate in the next 14 days: ${rows.length}`);
  const falsies = rows.filter((r) => r.isFalseDiarySignal);
  console.log(`\nLies (would falsely surface in Hub diary): ${falsies.length}`);
  for (const r of falsies) {
    console.log(`  ${r.expectedExchangeDate.toISOString().slice(0, 10)}  ${r.address}`);
    console.log(`    placeholder=${r.isPlaceholderDefault} override=${r.overrideSet} VM18=${r.vm18} PM25=${r.pm25} VM19=${r.vm19} PM26=${r.pm26}`);
  }
  console.log(`\nLegit (genuinely near exchange or user-forecasted):`);
  for (const r of rows.filter((r) => !r.isFalseDiarySignal)) {
    console.log(`  ${r.expectedExchangeDate.toISOString().slice(0, 10)}  ${r.address}`);
    console.log(`    placeholder=${r.isPlaceholderDefault} override=${r.overrideSet} VM18=${r.vm18} PM25=${r.pm25} VM19=${r.vm19} PM26=${r.pm26}`);
  }
})().catch(console.error).finally(() => p.$disconnect());
