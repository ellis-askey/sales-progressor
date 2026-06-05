// Throwaway inspector — pulls the raw detail Ellis asked for on the 17
// "mixed-roles" OutboundMessage rows that PR 3's backfill flagged as
// unmatched-by-design. Decision point for the proposed refined rule
// ("at least one purchaser, others neither stamp nor block"). Read-only.
//
// Per-row output:
//   - msgId, type, createdAt
//   - transactionId + propertyAddress
//   - each contactId → name, roleType, buyerRoundId
//   - subject/first line (parsed out of content if present)
//
// Deletes itself from the working tree after use (or do so manually).

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

(async () => {
  // Same candidate query the backfill uses: NULL buyerRoundId. Then
  // filter to the "mixed-roles" bucket: contactIds non-empty AND not
  // all-purchaser when resolved.
  const candidates = await prisma.outboundMessage.findMany({
    where: { buyerRoundId: null, type: "outbound" },
    select: {
      id: true,
      type: true,
      content: true,
      createdAt: true,
      transactionId: true,
      contactIds: true,
      transaction: { select: { propertyAddress: true, activeBuyerRoundId: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const allContactIds = new Set<string>();
  for (const c of candidates) for (const id of c.contactIds) allContactIds.add(id);
  const contactsLookup = allContactIds.size > 0
    ? await prisma.contact.findMany({
        where: { id: { in: [...allContactIds] } },
        select: { id: true, name: true, roleType: true, buyerRoundId: true },
      })
    : [];
  const contactById = new Map(contactsLookup.map((c) => [c.id, c]));

  const mixed = candidates.filter((m) => {
    if (m.contactIds.length === 0) return false;
    const resolved = m.contactIds.map((id) => contactById.get(id));
    if (resolved.some((c) => !c)) return false;
    const allPurchaser = resolved.every((c) => c!.roleType === "purchaser");
    return !allPurchaser;
  });

  console.log("=".repeat(80));
  console.log(`OutboundMessage mixed-roles inspection — ${mixed.length} row${mixed.length === 1 ? "" : "s"}`);
  console.log("=".repeat(80));
  console.log("");

  for (const m of mixed) {
    const firstLine = (() => {
      // OutboundMessage.content varies — manual rows are plain text,
      // logAutomatedEmail rows start with "Subject: ...\n\n{body}".
      const lines = m.content.split("\n").filter((l) => l.trim().length > 0);
      const subjectLine = lines.find((l) => /^subject:/i.test(l));
      if (subjectLine) return subjectLine.trim();
      return (lines[0] ?? "").slice(0, 120);
    })();

    console.log(`--- msg ${m.id} ---`);
    console.log(`  type:       ${m.type}`);
    console.log(`  createdAt:  ${m.createdAt.toISOString()}`);
    console.log(`  tx:         ${m.transactionId}  ${m.transaction.propertyAddress}`);
    console.log(`  tx active:  ${m.transaction.activeBuyerRoundId ?? "(null)"}`);
    console.log(`  contacts (${m.contactIds.length}):`);
    for (const id of m.contactIds) {
      const c = contactById.get(id);
      if (!c) {
        console.log(`    ${id}  (NOT FOUND)`);
        continue;
      }
      console.log(
        `    ${id}  ${c.name.padEnd(28)} role=${c.roleType.padEnd(12)} ` +
          `buyerRoundId=${c.buyerRoundId ?? "(null)"}`,
      );
    }
    console.log(`  first line: ${firstLine}`);
    console.log("");
  }

  // Summary heuristic for the refined-rule discussion: of the mixed
  // rows, how many would be unambiguously stampable under the proposed
  // refined rule ("at least one purchaser, all purchaser contacts share
  // the same non-null buyerRoundId")?
  let refinedStampable = 0;
  let refinedAmbiguous = 0;
  let refinedNoPurchaser = 0;
  for (const m of mixed) {
    const purchasers = m.contactIds
      .map((id) => contactById.get(id))
      .filter((c): c is NonNullable<typeof c> => c != null && c.roleType === "purchaser");
    if (purchasers.length === 0) {
      refinedNoPurchaser++;
      continue;
    }
    const distinctRounds = new Set(purchasers.map((c) => c.buyerRoundId));
    if (purchasers.every((c) => c.buyerRoundId !== null) && distinctRounds.size === 1) {
      refinedStampable++;
    } else {
      refinedAmbiguous++;
    }
  }

  console.log("=".repeat(80));
  console.log("UNDER THE PROPOSED REFINED RULE");
  console.log("=".repeat(80));
  console.log(`  Stampable          ${refinedStampable}`);
  console.log(`  Ambiguous          ${refinedAmbiguous}  (purchasers on different rounds OR mixed null + set)`);
  console.log(`  No purchaser       ${refinedNoPurchaser}  (would stay file-level under refined rule too)`);
  console.log("=".repeat(80));

  await prisma.$disconnect();
})().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
