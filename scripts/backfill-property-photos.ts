// One-shot: repair property-photo drift.
//
// The agent-app photo upload is two-step (upload the image to storage, then a
// separate call persists photoStoragePath on the row). If step 2 is missed, the
// image sits in storage while photoStoragePath stays null — so the photo shows
// nowhere and the Command Centre "photos to add" queue flags it wrongly.
//
// This lists the property-photos/ bucket and, for any transaction whose image is
// in storage but whose photoStoragePath is null, sets photoStoragePath (+ a
// photoUploadedAt stamp) so the photo reappears everywhere it's shown.
//
// SAFE BY DESIGN:
//   - Dry-run by default. Prints what it WOULD change. Pass APPLY=1 to write.
//   - Only fills EMPTY photoStoragePath (never overwrites a set one).
//   - Prints the connected database + storage host first.
//
// Usage (staging first, then prod):
//   npx tsx scripts/backfill-property-photos.ts            # dry run
//   APPLY=1 npx tsx scripts/backfill-property-photos.ts    # write

import { prisma } from "@/lib/prisma";
import { listStoredPhotos } from "@/lib/supabase-storage";

const APPLY = process.env.APPLY === "1";

async function main() {
  const dbHost = (process.env.DATABASE_URL ?? "").replace(/^.*@/, "").replace(/\/.*$/, "");
  console.log(`Database: ${dbHost || "(unknown)"}`);
  console.log(`Storage:  ${process.env.NEXT_PUBLIC_SUPABASE_URL ?? "(unknown)"}`);
  console.log(APPLY ? "MODE: APPLY (will write)\n" : "MODE: dry-run (no writes)\n");

  const stored = await listStoredPhotos();
  console.log(`Found ${stored.size} image(s) in property-photos/.`);
  if (stored.size === 0) {
    console.log("Nothing in storage to reconcile. (Is SUPABASE_SERVICE_ROLE_KEY set for this env?)");
    return;
  }

  const ids = [...stored.keys()];
  const drifted = await prisma.propertyTransaction.findMany({
    where: { id: { in: ids }, photoStoragePath: null },
    select: { id: true, propertyAddress: true },
  });

  console.log(`${drifted.length} file(s) have an image in storage but no photoStoragePath:\n`);
  for (const t of drifted) {
    console.log(`  ${t.propertyAddress}  ->  ${stored.get(t.id)}`);
  }

  if (!APPLY) {
    console.log(`\nDry run only. Re-run with APPLY=1 to set photoStoragePath on these ${drifted.length} file(s).`);
    return;
  }
  if (drifted.length === 0) {
    console.log("\nNothing to repair.");
    return;
  }

  let fixed = 0;
  for (const t of drifted) {
    const path = stored.get(t.id);
    if (!path) continue;
    await prisma.propertyTransaction.update({
      where: { id: t.id },
      data: { photoStoragePath: path, photoUploadedAt: new Date() },
    });
    fixed++;
  }
  console.log(`\nRepaired ${fixed} file(s). Their photos will now show everywhere.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
