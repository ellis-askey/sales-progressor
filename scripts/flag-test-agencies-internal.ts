// One-shot: flag test/experiment agencies as internal so they stop tripping the
// Command Centre signal detectors (e.g. "silent agency" firing on "EXP - DB").
//
// Setting isInternal = true removes an agency from every product metric, the
// briefs, and the detectors (they already spread internalAgencyFilter).
//
// SAFE BY DESIGN:
//   - Dry-run by default. Prints what it WOULD change. Pass APPLY=1 to write.
//   - Prints the connected database host first so you can confirm the target.
//   - Matches on exact agency name (default: "EXP - DB"). Override with NAMES.
//
// Usage (from your own shell, staging first then prod):
//   npx tsx scripts/flag-test-agencies-internal.ts                 # dry run
//   APPLY=1 npx tsx scripts/flag-test-agencies-internal.ts         # write
//   APPLY=1 NAMES="EXP - DB,Test Agency" npx tsx scripts/flag-test-agencies-internal.ts

import { prisma } from "@/lib/prisma";

const NAMES = (process.env.NAMES ?? "EXP - DB")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const APPLY = process.env.APPLY === "1";

async function main() {
  const url = process.env.DATABASE_URL ?? "";
  const host = url.replace(/^.*@/, "").replace(/\/.*$/, "");
  console.log(`Connected to: ${host || "(unknown)"}`);
  console.log(`Target names: ${NAMES.join(", ")}`);
  console.log(APPLY ? "MODE: APPLY (will write)\n" : "MODE: dry-run (no writes)\n");

  const matches = await prisma.agency.findMany({
    where: { name: { in: NAMES } },
    select: { id: true, name: true, isInternal: true },
  });

  if (matches.length === 0) {
    console.log("No agencies matched those names. Nothing to do.");
    return;
  }

  for (const a of matches) {
    const willChange = !a.isInternal;
    console.log(`${a.name} (${a.id}) — isInternal ${a.isInternal} ${willChange ? "-> true" : "(already internal)"}`);
  }

  if (!APPLY) {
    console.log("\nDry run only. Re-run with APPLY=1 to write these changes.");
    return;
  }

  const toFlag = matches.filter((a) => !a.isInternal).map((a) => a.id);
  if (toFlag.length === 0) {
    console.log("\nEverything already internal. No writes needed.");
    return;
  }

  const res = await prisma.agency.updateMany({
    where: { id: { in: toFlag } },
    data: { isInternal: true },
  });
  console.log(`\nUpdated ${res.count} agency row(s) to isInternal = true.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
