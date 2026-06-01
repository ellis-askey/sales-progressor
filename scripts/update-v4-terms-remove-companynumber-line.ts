// One-off: strip the "Billing is operated by The Sales Progressor Ltd,
// company number [Company number], registered office [Registered office
// address]." sentence from the existing TermsVersion v4 row's
// bodySections JSON.
//
// Context: v4 shipped with a placeholder sentence at the end of the
// first section's body waiting for the real company number / registered
// office to be filled in. We're removing the sentence entirely (we don't
// need that boilerplate in the billing terms surface). Edit-in-place
// rather than ship a v5 because the change is purely a placeholder
// removal, not a material terms change.
//
// Idempotent: no-op if the sentence isn't found (already removed). Safe
// to re-run.
//
// Run on staging:
//   DATABASE_URL=<staging-direct-url> npx ts-node \
//     --compiler-options '{"module":"CommonJS","esModuleInterop":true,"baseUrl":".","paths":{"@/*":["./*"]}}' \
//     --require tsconfig-paths/register \
//     scripts/update-v4-terms-remove-companynumber-line.ts
//
// Run on prod: same command with the prod DATABASE_URL.

import { PrismaClient } from "@prisma/client";

const VERSION_TAG = "2026-06-payments-v4";
const SENTENCE_TO_REMOVE =
  " Billing is operated by The Sales Progressor Ltd, company number [Company number], registered office [Registered office address].";

type Section = { heading: string; body: string };

async function main() {
  const prisma = new PrismaClient();
  try {
    const row = await prisma.termsVersion.findUnique({
      where: { versionTag: VERSION_TAG },
      select: { id: true, bodySections: true },
    });

    if (!row) {
      console.log(`No-op: no row with versionTag '${VERSION_TAG}' on this DB.`);
      return;
    }

    if (!Array.isArray(row.bodySections)) {
      console.error("Aborting: bodySections is not an array on this row.");
      process.exit(1);
    }

    let touched = false;
    const updated: Section[] = (row.bodySections as unknown as Section[]).map((s) => {
      if (typeof s?.body !== "string") return s;
      if (s.body.includes(SENTENCE_TO_REMOVE)) {
        touched = true;
        return { ...s, body: s.body.replace(SENTENCE_TO_REMOVE, "") };
      }
      return s;
    });

    if (!touched) {
      console.log("No-op: sentence not present in any section body (already removed).");
      return;
    }

    await prisma.termsVersion.update({
      where: { id: row.id },
      data: { bodySections: updated as unknown as object },
    });

    console.log(`Updated TermsVersion ${VERSION_TAG} (id=${row.id}).`);
    console.log("Sentence removed from section bodies.");
  } finally {
    await prisma.$disconnect();
  }
}

void main();
