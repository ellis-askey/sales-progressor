import "server-only";
import { prisma } from "@/lib/prisma";
import { fetchAreaSales } from "@/lib/services/property-intel";

// Durable cache + pre-warm layer over fetchAreaSales (HM Land Registry
// registered-sale counts per postcode district). The SPARQL endpoint is ~30s
// per outcode, so the All Files → Map view can't afford a live fetch on load.
// Reads come from the AreaSalesCount table (fresh within READ_TTL_MS); the
// nightly cron (warmAreaSales) keeps it populated ahead of any page load.

// How old a cached row may be and still be served without a refetch. The Land
// Registry window slides as time passes, but a share-of-market indicator
// tolerates a little drift; the daily cron keeps most rows under a day old.
const READ_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

// Read a single outcode's count, cache-first. On a miss (or a stale row) it
// does the slow fetch, writes the result back, and returns it. A failed fetch
// returns any stale cached value rather than nothing; null only when we've
// genuinely never got a count for this outcode.
export async function getAreaSalesCached(outcode: string, months: number): Promise<number | null> {
  const oc = outcode.trim().toUpperCase();
  const existing = await prisma.areaSalesCount
    .findUnique({ where: { outcode_months: { outcode: oc, months } } })
    .catch(() => null);

  if (existing && Date.now() - existing.fetchedAt.getTime() < READ_TTL_MS) {
    return existing.count;
  }

  const fresh = await fetchAreaSales(oc, months).catch(() => null);
  if (fresh == null) {
    // Couldn't refresh — fall back to a stale value if we have one.
    return existing?.count ?? null;
  }
  await prisma.areaSalesCount
    .upsert({
      where: { outcode_months: { outcode: oc, months } },
      create: { outcode: oc, months, count: fresh },
      update: { count: fresh, fetchedAt: new Date() },
    })
    .catch(() => {});
  return fresh;
}

export type WarmResult = {
  requested: number; // distinct (outcode, months) pairs that exist in live files
  warmed: number; // successfully refetched + stored this run
  failed: number; // fetch returned null (endpoint error) — stale row kept
  skipped: number; // over the per-run limit; will be picked up next run
};

// Cron entry point. Given the outcodes of all live files and the periods the UI
// asks for, refresh the stalest/missing counts first, bounded per run so a slow
// endpoint can't blow the function timeout. `skipped` is logged by the caller so
// a bounded run never reads as "covered everything".
export async function warmAreaSales(
  outcodes: string[],
  months: number[],
  opts: { limit?: number; concurrency?: number } = {},
): Promise<WarmResult> {
  const limit = opts.limit ?? 40;
  const concurrency = opts.concurrency ?? 5;

  const pairs: { outcode: string; months: number }[] = [];
  for (const oc of Array.from(new Set(outcodes.map((o) => o.trim().toUpperCase()))).filter(Boolean)) {
    for (const m of months) pairs.push({ outcode: oc, months: m });
  }

  const existing = await prisma.areaSalesCount.findMany({
    where: { outcode: { in: pairs.map((p) => p.outcode) } },
    select: { outcode: true, months: true, fetchedAt: true },
  });
  const ageOf = new Map(existing.map((r) => [`${r.outcode}|${r.months}`, r.fetchedAt.getTime()]));

  // Missing rows first (age 0), then stalest existing. Oldest-first so a bounded
  // run always makes progress on whatever's been waiting longest.
  const ordered = pairs
    .map((p) => ({ ...p, age: ageOf.get(`${p.outcode}|${p.months}`) ?? 0 }))
    .sort((a, b) => a.age - b.age);

  const toWarm = ordered.slice(0, limit);
  const skipped = Math.max(0, ordered.length - toWarm.length);

  let warmed = 0;
  let failed = 0;
  for (let i = 0; i < toWarm.length; i += concurrency) {
    const batch = toWarm.slice(i, i + concurrency);
    await Promise.all(
      batch.map(async (p) => {
        const n = await fetchAreaSales(p.outcode, p.months).catch(() => null);
        if (n == null) {
          failed += 1;
          return;
        }
        await prisma.areaSalesCount
          .upsert({
            where: { outcode_months: { outcode: p.outcode, months: p.months } },
            create: { outcode: p.outcode, months: p.months, count: n },
            update: { count: n, fetchedAt: new Date() },
          })
          .catch(() => {});
        warmed += 1;
      }),
    );
  }

  return { requested: pairs.length, warmed, failed, skipped };
}
