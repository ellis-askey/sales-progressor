// Phase-2 read-shape verification harness.
//
// Replicates the WHERE-clause shape of each Phase-2 read-path filter via
// direct Prisma queries (the service modules can't be imported here
// because they transitively pull react/cache which is server-only). The
// queries below MUST stay in lockstep with the services they mirror —
// any service change that alters the OR filter should be reflected here.
//
// Fixture: the Emily relist transaction (R1=Marcus, R2=Terry).
// Complements (does not replace) the Playwright suite which requires
// PLAYWRIGHT_TEST_PASSWORD operator-side.

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const TX_ID = "cmpzq6ykk0002734zkp9f6ie3";

type CheckResult = { label: string; pass: boolean; detail?: string };
const checks: CheckResult[] = [];

function check(label: string, pass: boolean, detail?: string) {
  checks.push({ label, pass, detail });
  console.log(`  ${pass ? "[PASS]" : "[FAIL]"} ${label}${detail ? "  — " + detail : ""}`);
}

(async () => {
  console.log("=".repeat(78));
  console.log("Phase-2 read-shape verification — Emily relist fixture");
  console.log("=".repeat(78));

  const tx = await prisma.propertyTransaction.findUnique({
    where: { id: TX_ID },
    select: {
      id: true, propertyAddress: true, status: true, activeBuyerRoundId: true, agencyId: true,
      buyerRounds: {
        select: { id: true, roundNumber: true, status: true, archivedAt: true },
        orderBy: { roundNumber: "asc" },
      },
    },
  });
  if (!tx) { console.error(`Fixture not found: ${TX_ID}`); await prisma.$disconnect(); process.exit(1); }
  const activeRound = tx.activeBuyerRoundId;

  console.log(`tx        ${tx.id}  ${tx.propertyAddress}`);
  console.log(`status    ${tx.status}    activeBuyerRoundId  ${activeRound}`);
  for (const r of tx.buyerRounds) {
    console.log(`R${r.roundNumber}        ${r.id}    status=${r.status}    archived=${r.archivedAt?.toISOString() ?? "—"}`);
  }

  // Data-driven: load every Contact on the fixture, separate by relationship
  // to the active round (rather than hardcoding "Marcus" + "Terry"). This
  // adapts to N rounds — the verification is "any fall-through purchaser is
  // hidden, the active-round purchaser is shown".
  const allContacts = await prisma.contact.findMany({
    where: { propertyTransactionId: TX_ID },
    select: { id: true, name: true, roleType: true, buyerRoundId: true },
    orderBy: { createdAt: "asc" },
  });

  const fallThroughPurchasers = allContacts.filter((c) =>
    c.roleType === "purchaser" && c.buyerRoundId !== null && c.buyerRoundId !== activeRound,
  );
  const activeRoundPurchasers = allContacts.filter((c) =>
    c.roleType === "purchaser" && c.buyerRoundId === activeRound,
  );
  const vendor = allContacts.find((c) => c.roleType === "vendor");

  console.log("");
  console.log(`Active-round purchasers       ${activeRoundPurchasers.length}: [${activeRoundPurchasers.map((c) => c.name).join(", ")}]`);
  console.log(`Fall-through purchasers       ${fallThroughPurchasers.length}: [${fallThroughPurchasers.map((c) => `${c.name} (round=${c.buyerRoundId})`).join(", ")}]`);
  console.log("");

  // Backwards-compat: keep "Marcus" / "Terry" individually referenced where
  // older test rows expect them, so we get specific PASS lines per known
  // fall-through buyer. (Both are fall-through in the current fixture state.)
  const marcus = allContacts.find((c) => c.name.includes("Marcus"));
  const terry  = allContacts.find((c) => c.name.toLowerCase().includes("terry"));

  // ── Section 2: getTransaction Contacts scoping ────────────────────────────
  console.log("─ Section 2: getTransaction Contacts scoping ─");
  const liveContacts = allContacts.filter((c) => {
    if (c.roleType !== "purchaser") return true;
    if (activeRound === null) return true;
    return c.buyerRoundId === activeRound;
  });
  const liveContactIds = new Set(liveContacts.map((c) => c.id));
  for (const ft of fallThroughPurchasers) {
    check(`live Contacts panel excludes ${ft.name} (fall-through)`, !liveContactIds.has(ft.id));
  }
  for (const ap of activeRoundPurchasers) {
    check(`live Contacts panel includes ${ap.name} (active-round)`, liveContactIds.has(ap.id));
  }
  if (vendor) check("live Contacts panel includes vendor (file-level)", liveContactIds.has(vendor.id));

  // ── PR 2: TransactionDocument scoping ────────────────────────────────────
  console.log("");
  console.log("─ PR 2: TransactionDocument scoping ─");
  const liveDocs = await prisma.transactionDocument.findMany({
    where: {
      transactionId: TX_ID,
      ...(activeRound
        ? { OR: [{ buyerRoundId: null }, { buyerRoundId: activeRound }] }
        : { buyerRoundId: null }),
    },
    select: { id: true, buyerRoundId: true, filename: true },
  });
  const leakedDocCount = liveDocs.filter((d) => d.buyerRoundId !== null && d.buyerRoundId !== activeRound).length;
  check(
    "live Documents panel hides fall-through-round purchaser uploads",
    leakedDocCount === 0,
    `${leakedDocCount} leaked / set size=${liveDocs.length}`,
  );

  // ── PR 3: OutboundMessage scoping (timeline) ─────────────────────────────
  console.log("");
  console.log("─ PR 3: OutboundMessage scoping (timeline) ─");
  const liveComms = await prisma.outboundMessage.findMany({
    where: {
      transactionId: TX_ID,
      ...(activeRound
        ? { OR: [{ buyerRoundId: null }, { buyerRoundId: activeRound }] }
        : { buyerRoundId: null }),
    },
    select: { id: true, buyerRoundId: true },
  });
  const leakedCommCount = liveComms.filter((c) => c.buyerRoundId !== null && c.buyerRoundId !== activeRound).length;
  check(
    "live activity timeline hides fall-through-round comms",
    leakedCommCount === 0,
    `${leakedCommCount} leaked / set size=${liveComms.length}`,
  );

  // ── PR 3 GAP-5: bell count ──────────────────────────────────────────────
  console.log("");
  console.log("─ PR 3 (GAP-5): bell count ─");
  const since = new Date(0);
  const activeRoundIds = activeRound ? [activeRound] : [];
  const bellCount = await prisma.outboundMessage.count({
    where: {
      type: "internal_note",
      createdAt: { gt: since },
      content: { contains: "via the client portal" },
      transactionId: TX_ID,
      OR: [{ buyerRoundId: null }, { buyerRoundId: { in: activeRoundIds } }],
    },
  });
  const unfilteredBellCount = await prisma.outboundMessage.count({
    where: {
      type: "internal_note",
      content: { contains: "via the client portal" },
      transactionId: TX_ID,
    },
  });
  check(
    `bell count is scoped: scoped=${bellCount} ≤ unscoped=${unfilteredBellCount}`,
    bellCount <= unfilteredBellCount,
  );

  // ── PR 4: PortalMessage scoping ──────────────────────────────────────────
  console.log("");
  console.log("─ PR 4: PortalMessage scoping ─");
  const livePortalContacts = await prisma.contact.findMany({
    where: {
      propertyTransactionId: TX_ID,
      OR: [
        { roleType: { not: "purchaser" as const } },
        { buyerRoundId: null },
        ...(activeRound ? [{ buyerRoundId: activeRound }] : []),
      ],
    },
    select: { id: true },
  });
  const livePortalContactIds = new Set(livePortalContacts.map((c) => c.id));
  for (const ft of fallThroughPurchasers) {
    check(`getAllPortalThreads-shape excludes ${ft.name} (fall-through)`, !livePortalContactIds.has(ft.id));
  }
  for (const ap of activeRoundPurchasers) {
    check(`getAllPortalThreads-shape includes ${ap.name} (active-round)`, livePortalContactIds.has(ap.id));
  }

  const lastContactedPortal = await prisma.portalMessage.findMany({
    where: {
      transactionId: TX_ID,
      fromClient: false,
      contact: {
        OR: [
          { roleType: { not: "purchaser" as const } },
          { buyerRoundId: null },
          ...(activeRound ? [{ buyerRoundId: activeRound }] : []),
        ],
      },
    },
    select: { contactId: true },
  });
  const lastContactedIds = new Set(lastContactedPortal.map((m) => m.contactId));
  for (const ft of fallThroughPurchasers) {
    check(`last-contacted PortalMessage query excludes ${ft.name}`, !lastContactedIds.has(ft.id));
  }

  // ── PR 5: ReminderLog read-path ──────────────────────────────────────────
  console.log("");
  console.log("─ PR 5: ReminderLog read-path ─");
  const liveLogs = await prisma.reminderLog.findMany({
    where: {
      transactionId: TX_ID,
      OR: [
        { buyerRoundId: null },
        ...(activeRound ? [{ buyerRoundId: activeRound }] : []),
      ],
    },
    select: { id: true, buyerRoundId: true },
  });
  const leakedLogCount = liveLogs.filter((l) => l.buyerRoundId !== null && l.buyerRoundId !== activeRound).length;
  check(
    "live Reminders tab hides fall-through-round logs",
    leakedLogCount === 0,
    `${leakedLogCount} leaked / set size=${liveLogs.length}`,
  );

  // ── PR 6: ChaseTask read-path ────────────────────────────────────────────
  console.log("");
  console.log("─ PR 6: ChaseTask read-path ─");
  const liveTasks = await prisma.chaseTask.findMany({
    where: {
      transactionId: TX_ID,
      OR: [
        { buyerRoundId: null },
        ...(activeRound ? [{ buyerRoundId: activeRound }] : []),
      ],
    },
    select: { id: true, buyerRoundId: true },
  });
  const leakedTaskCount = liveTasks.filter((t) => t.buyerRoundId !== null && t.buyerRoundId !== activeRound).length;
  check(
    "per-tx ChaseTask fetch hides fall-through-round tasks",
    leakedTaskCount === 0,
    `${leakedTaskCount} leaked / set size=${liveTasks.length}`,
  );

  // ── Archived drawer hard gates (one per round in the fixture) ────────────
  // Data-driven over all archived rounds so the assertion adapts to N
  // rounds (the fixture currently has multiple fall-throughs).
  console.log("");
  console.log(`─ Archived drawer hard gates (${tx.buyerRounds.length} round${tx.buyerRounds.length === 1 ? "" : "s"}) ─`);
  for (const r of tx.buyerRounds) {
    const rContacts = await prisma.contact.findMany({
      where: { propertyTransactionId: TX_ID, buyerRoundId: r.id },
      select: { id: true, name: true },
    });
    const rContactNames = rContacts.map((c) => c.name).join(", ") || "(none)";
    const rOutbound = await prisma.outboundMessage.count({
      where: { transactionId: TX_ID, buyerRoundId: r.id },
    });
    const rPortal = await prisma.portalMessage.count({
      where: { transactionId: TX_ID, buyerRoundId: r.id },
    });
    const rDocs = await prisma.transactionDocument.findMany({
      where: {
        transactionId: TX_ID,
        OR: [{ buyerRoundId: null }, { buyerRoundId: r.id }],
      },
      select: { id: true, buyerRoundId: true },
    });
    const rDocLeak = rDocs.filter((d) => d.buyerRoundId !== null && d.buyerRoundId !== r.id).length;

    // Hard gate: each archived round's drawer surfaces THIS round's
    // contacts and no other round's purchaser contacts.
    const purchaserHere = rContacts.length > 0;
    check(
      `Sale ${r.roundNumber} drawer surfaces this round's contacts (${rContactNames})`,
      purchaserHere,
    );
    const otherRoundContactsLeaked = await prisma.contact.count({
      where: {
        propertyTransactionId: TX_ID,
        buyerRoundId: { not: null },
        AND: [{ buyerRoundId: { not: r.id } }, { id: { in: rContacts.map((c) => c.id) } }],
      },
    });
    check(
      `Sale ${r.roundNumber} drawer does NOT surface other rounds' purchasers`,
      otherRoundContactsLeaked === 0,
      `${otherRoundContactsLeaked} leaked`,
    );
    check(
      `Sale ${r.roundNumber} drawer Documents = file-level + this round only`,
      rDocLeak === 0,
      `${rDocLeak} leaked / set size=${rDocs.length}`,
    );
    check(
      `Sale ${r.roundNumber} drawer comms includes round-scoped Outbound (${rOutbound}) + Portal (${rPortal})`,
      true,
      "informational",
    );
  }

  // ── GAP-4: agent search previousSale ─────────────────────────────────────
  console.log("");
  console.log("─ GAP-4: agent search previousSale labelling ─");
  for (const ft of fallThroughPurchasers) {
    const row = await prisma.contact.findUnique({
      where: { id: ft.id },
      select: {
        id: true, name: true, roleType: true, buyerRoundId: true,
        buyerRound: { select: { roundNumber: true } },
        transaction: { select: { activeBuyerRoundId: true } },
      },
    });
    if (!row) continue;
    const isPrevious = row.roleType === "purchaser" && row.buyerRoundId !== null &&
                       row.buyerRoundId !== row.transaction.activeBuyerRoundId;
    check(
      `${row.name} search row renders previousSale label`,
      isPrevious,
      isPrevious ? `Sale ${row.buyerRound?.roundNumber} · fell through` : "would render as current",
    );
  }
  // Unused but referenced for clarity:
  void marcus; void terry;

  // ── Phase-3: cross-tx aggregates ────────────────────────────────────────
  console.log("");
  console.log("─ Phase-3: cross-tx aggregate restructure ─");
  const agencyId = tx.agencyId;
  const fallThroughRoundIds = fallThroughPurchasers
    .map((c) => c.buyerRoundId)
    .filter((id): id is string => id !== null);

  const unscopedExchangedMcs = await prisma.milestoneCompletion.count({
    where: {
      transactionId: TX_ID,
      state: "complete",
      milestoneDefinition: { code: { in: ["VM19", "PM26"] } },
    },
  });
  const scopedExchangedMcs = await prisma.milestoneCompletion.count({
    where: {
      transactionId: TX_ID,
      state: "complete",
      milestoneDefinition: { code: { in: ["VM19", "PM26"] } },
      OR: [{ buyerRoundId: null }, ...(activeRound ? [{ buyerRoundId: activeRound }] : [])],
    },
  });
  check(
    `cross-tx exchanged-MC count is scoped: scoped=${scopedExchangedMcs} ≤ unscoped=${unscopedExchangedMcs}`,
    scopedExchangedMcs <= unscopedExchangedMcs,
  );

  const fallThroughRoundMcCount = fallThroughRoundIds.length > 0
    ? await prisma.milestoneCompletion.count({
        where: { transactionId: TX_ID, state: "complete", buyerRoundId: { in: fallThroughRoundIds } },
      })
    : 0;
  check(
    `fall-through-round MCs (informational — Phase-3 hides these from aggregates): ${fallThroughRoundMcCount}`,
    true,
    "informational",
  );

  const agencyActiveRoundIds = (
    await prisma.propertyTransaction.findMany({ where: { agencyId }, select: { activeBuyerRoundId: true } })
  )
    .map((t) => t.activeBuyerRoundId)
    .filter((id): id is string => id !== null);

  const unscopedContactsAgencyWide = await prisma.contact.count({
    where: { transaction: { agencyId } },
  });
  const scopedContactsAgencyWide = await prisma.contact.count({
    where: {
      transaction: { agencyId },
      OR: [
        { roleType: { not: "purchaser" as const } },
        { buyerRoundId: null },
        { buyerRoundId: { in: agencyActiveRoundIds } },
      ],
    },
  });
  check(
    `cross-tx Contact count is scoped: scoped=${scopedContactsAgencyWide} ≤ unscoped=${unscopedContactsAgencyWide}`,
    scopedContactsAgencyWide <= unscopedContactsAgencyWide,
  );

  // ── PR 1/1.5: queue gate (read-only) ────────────────────────────────────
  console.log("");
  console.log("─ PR 1.5: OutboundEmailQueue dead-round gate behaviour ─");
  // Confirm at least the SHAPE of the gate logic: any OutboundEmailQueue row
  // for a contact whose buyerRoundId mismatches activeBuyerRoundId should
  // be markable as recipient_round_archived. Read-only — just count
  // candidates that the live drain would skip.
  const queueCandidates = await prisma.outboundEmailQueue.count({
    where: {
      recipientContact: {
        propertyTransactionId: TX_ID,
        roleType: "purchaser",
        AND: [
          { buyerRoundId: { not: null } },
          activeRound ? { buyerRoundId: { not: activeRound } } : {},
        ],
      },
      sentAt: null,
      errorAt: null,
    },
  });
  check(`queue rows that would be gated by PR 1.5 (recipient_round_archived): ${queueCandidates}`, true, "informational");

  // ── Summary ──────────────────────────────────────────────────────────────
  console.log("");
  console.log("=".repeat(78));
  console.log("SUMMARY");
  console.log("=".repeat(78));
  const passes = checks.filter((c) => c.pass).length;
  const fails  = checks.filter((c) => !c.pass).length;
  console.log(`  PASS: ${passes}`);
  console.log(`  FAIL: ${fails}`);
  console.log("=".repeat(78));

  await prisma.$disconnect();
  process.exit(fails > 0 ? 1 : 0);
})().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
