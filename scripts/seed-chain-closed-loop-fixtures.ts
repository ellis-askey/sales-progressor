// Seed fixtures for the chain closed-loop arc walkthrough (2026-06-05).
//
// Creates five PropertyTransaction fixtures owned by Emily Chen
// (emily@hartwellpartners.co.uk) plus the supporting neighbour agents,
// chains, and pre-existing notification rows needed to walk every
// state the arc introduces:
//
//   F1 — standalone file (no chain). Tests withdraw + relist with no
//        chain side-effects. Free-form: try each WithdrawalReason +
//        each onwardSale path.
//   F2 — 4-link chain, Emily at position 3, claimed agents above + below.
//        Withdraw with BUYER_WITHDREW → upward LOST_BUYER to Tom + the
//        downstream segment (Jane + Alice) detaches into its own chain.
//        Tests Q1 (UPWARD-only cascade) + Q3 (split + CHAIN_DETACHED).
//   F3 — already-withdrawn in-chain file. Emily is at position 2, agent
//        above (Tom) responded WAITING two days ago to the original
//        LOST_BUYER. Relisting now fires BUYER_FOUND with the "wait is
//        over" variant. Tests Q2 (WAITING variant).
//   F4 — same as F3 but Tom responded REMARKETING. Tests Q2 (REMARKETING
//        variant — "stand down").
//   F5 — withdrawn in-chain file. Pristine ready-to-relist state. The
//        agent picks "Don't know yet" on the onward-sale step; after
//        relist the file is chainSetupPending=true → hub card surfaces.
//
// Idempotent — running twice resets the fixtures cleanly. Safe to re-run
// after an iteration tweak.
//
// Run: npx tsx scripts/seed-chain-closed-loop-fixtures.ts

import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const EMILY_EMAIL = "emily@hartwellpartners.co.uk";

const NEIGHBOUR_AGENTS = [
  // Position-4 (above Emily) — top of chain
  { email: "tom.brown@oakhurst-test.co.uk",   name: "Tom Brown",   agencyName: "Oakhurst (test)" },
  // Position-2 (below Emily) — buyer's onward sale
  { email: "jane.field@bright-test.co.uk",    name: "Jane Field",  agencyName: "Bright Estates (test)" },
  // Position-1 (bottom of chain in F2) — first-time buyer (no claim)
  // No agent — stays unclaimed
] as const;

async function ensureUser(opts: { email: string; name: string; agencyName: string; role?: "director" | "negotiator" }) {
  // Find-or-create the agency, then the user. Sharing agency name across
  // re-runs is fine — Agency.name doesn't have a unique constraint, so
  // findFirst is the canonical lookup.
  let agency = await prisma.agency.findFirst({ where: { name: opts.agencyName }, select: { id: true } });
  if (!agency) {
    const created = await prisma.agency.create({
      data: { name: opts.agencyName, feeTier: "standard" },
      select: { id: true },
    });
    agency = created;
  }
  let user = await prisma.user.findFirst({ where: { email: opts.email }, select: { id: true } });
  if (!user) {
    const created = await prisma.user.create({
      data: {
        email: opts.email,
        name: opts.name,
        // Use a placeholder password hash — these are seed fixtures
        // for the walkthrough; not for login. If Emily needs to log in
        // AS one of them, rotate via the password-reset flow.
        password: "fixture-no-login",
        role: opts.role ?? "director",
        agencyId: agency.id,
      },
      select: { id: true },
    });
    user = created;
  }
  return user.id;
}

async function getEmily() {
  const u = await prisma.user.findFirst({
    where: { email: EMILY_EMAIL },
    select: { id: true, agencyId: true },
  });
  if (!u || !u.agencyId) throw new Error("Emily not found on staging — seed her account first.");
  return { id: u.id, agencyId: u.agencyId };
}

// ─── Per-fixture builders ────────────────────────────────────────────────

async function deleteFixtureByAddress(propertyAddress: string, emilyAgencyId: string) {
  // Wipe any prior fixture with this address so re-runs reset cleanly.
  // Deletes cascade through BuyerRound + Contact + ChainLink relations
  // via the schema's onDelete: Cascade where set; for ChainLink we clear
  // the transactionId pointer first so the link orphan-checks don't
  // trip during transaction delete.
  const existing = await prisma.propertyTransaction.findMany({
    where: { agencyId: emilyAgencyId, propertyAddress },
    select: { id: true, chainLinkId: true },
  });
  for (const ex of existing) {
    if (ex.chainLinkId) {
      // Detach link first; if the link's chain has no other claimed links
      // it'll be left as a dead chain — that's fine for seed-reset.
      await prisma.chainLink.update({
        where: { id: ex.chainLinkId },
        data: { transactionId: null },
      });
    }
    await prisma.propertyTransaction.delete({ where: { id: ex.id } });
  }
}

async function buildStandaloneFixture(emily: { id: string; agencyId: string }, addr: string) {
  await deleteFixtureByAddress(addr, emily.agencyId);
  const tx = await prisma.propertyTransaction.create({
    data: {
      propertyAddress: addr,
      agencyId: emily.agencyId,
      agentUserId: emily.id,
      status: "active",
      tenure: "freehold",
      purchaseType: "mortgage",
      serviceType: "self_managed",
      progressedBy: "agent",
      purchasePrice: 47500000,
      buyerRounds: { create: { roundNumber: 1, purchasePrice: 47500000 } },
    },
    select: { id: true, buyerRounds: { select: { id: true } } },
  });
  await prisma.propertyTransaction.update({
    where: { id: tx.id },
    data: { activeBuyerRoundId: tx.buyerRounds[0].id },
  });
  await prisma.contact.create({
    data: {
      propertyTransactionId: tx.id,
      name: "James Hartley",
      email: "james.hartley@example.com",
      roleType: "vendor",
    },
  });
  await prisma.contact.create({
    data: {
      propertyTransactionId: tx.id,
      name: "Naomi West",
      email: "naomi.west@example.com",
      roleType: "purchaser",
      buyerRoundId: tx.buyerRounds[0].id,
    },
  });
  return tx.id;
}

async function build4LinkChainFixture(
  emily: { id: string; agencyId: string },
  addr: string,
  neighbourIds: { tomId: string; janeId: string },
) {
  await deleteFixtureByAddress(addr, emily.agencyId);

  // Create the chain row. Positions: 1 = bottom (first-time buyer
  // Alice — unclaimed), 2 = Jane's sale, 3 = Emily's sale (THIS file),
  // 4 = Tom's sale (top of chain — terminal seller above us).
  const chain = await prisma.propertyChain.create({
    data: { agencyId: emily.agencyId, name: `[Closed-loop fixture] ${addr}` },
    select: { id: true },
  });

  // Position 1 — Alice (unclaimed, stub fields populated to make the
  // chain look real in the chain widget; no inviteSentAt — the link
  // is "real-world unclaimed" rather than "invited but pending").
  await prisma.chainLink.create({
    data: {
      chainId: chain.id,
      position: 1,
      stubPropertyAddress: "9 Cedar Court, BS8 1FT",
      stubAgentEmail: "(first-time buyer — no onward sale)",
      stubAgentName: "Alice (FTB)",
      stubAgencyName: "(no agency — owner-occupier)",
    },
  });
  // Position 2 — Jane Field at Bright Estates (claimed). The link
  // needs a transactionId pointer to feel real, so we create a
  // PROPERTY transaction on Jane's agency that she's selling.
  const janeTx = await prisma.propertyTransaction.findFirst({
    where: { agencyId: { not: emily.agencyId }, propertyAddress: { contains: "9 Cedar Court" } },
    select: { id: true },
  });
  let janeTxId = janeTx?.id;
  if (!janeTxId) {
    const janeAgent = await prisma.user.findUnique({ where: { id: neighbourIds.janeId }, select: { agencyId: true } });
    const created = await prisma.propertyTransaction.create({
      data: {
        propertyAddress: "9 Cedar Court, Clifton, BS8 1FT",
        agencyId: janeAgent!.agencyId!,
        agentUserId: neighbourIds.janeId,
        status: "active",
        serviceType: "self_managed",
        progressedBy: "agent",
        buyerRounds: { create: { roundNumber: 1 } },
      },
      select: { id: true, buyerRounds: { select: { id: true } } },
    });
    await prisma.propertyTransaction.update({
      where: { id: created.id },
      data: { activeBuyerRoundId: created.buyerRounds[0].id },
    });
    janeTxId = created.id;
  }
  const janeLink = await prisma.chainLink.create({
    data: {
      chainId: chain.id,
      position: 2,
      transactionId: janeTxId,
      claimedByUserId: neighbourIds.janeId,
      claimedAt: new Date(),
      inviteStatus: "CLAIMED",
    },
    select: { id: true },
  });
  await prisma.propertyTransaction.update({
    where: { id: janeTxId },
    data: { chainLinkId: janeLink.id },
  });

  // Position 3 — Emily's sale (THIS file). Create + link.
  const emilyTx = await prisma.propertyTransaction.create({
    data: {
      propertyAddress: addr,
      agencyId: emily.agencyId,
      agentUserId: emily.id,
      status: "active",
      tenure: "freehold",
      purchaseType: "mortgage",
      serviceType: "self_managed",
      progressedBy: "agent",
      purchasePrice: 65000000,
      buyerRounds: { create: { roundNumber: 1, purchasePrice: 65000000 } },
    },
    select: { id: true, buyerRounds: { select: { id: true } } },
  });
  const emilyLink = await prisma.chainLink.create({
    data: {
      chainId: chain.id,
      position: 3,
      transactionId: emilyTx.id,
      claimedByUserId: emily.id,
      claimedAt: new Date(),
      inviteStatus: "CLAIMED",
    },
    select: { id: true },
  });
  await prisma.propertyTransaction.update({
    where: { id: emilyTx.id },
    data: { chainLinkId: emilyLink.id, activeBuyerRoundId: emilyTx.buyerRounds[0].id },
  });
  await prisma.contact.create({
    data: { propertyTransactionId: emilyTx.id, name: "Olivia Marsh", email: "olivia.marsh@example.com", roleType: "vendor" },
  });
  await prisma.contact.create({
    data: {
      propertyTransactionId: emilyTx.id,
      name: "Daniel Pope",
      email: "daniel.pope@example.com",
      roleType: "purchaser",
      buyerRoundId: emilyTx.buyerRounds[0].id,
    },
  });

  // Position 4 — Tom Brown at Oakhurst (claimed). Create his selling-tx.
  const tomTx = await prisma.propertyTransaction.findFirst({
    where: { agencyId: { not: emily.agencyId }, propertyAddress: { contains: "12 Elm Lane" } },
    select: { id: true },
  });
  let tomTxId = tomTx?.id;
  if (!tomTxId) {
    const tomAgent = await prisma.user.findUnique({ where: { id: neighbourIds.tomId }, select: { agencyId: true } });
    const created = await prisma.propertyTransaction.create({
      data: {
        propertyAddress: "12 Elm Lane, Redland, BS6 6AB",
        agencyId: tomAgent!.agencyId!,
        agentUserId: neighbourIds.tomId,
        status: "active",
        serviceType: "self_managed",
        progressedBy: "agent",
        buyerRounds: { create: { roundNumber: 1 } },
      },
      select: { id: true, buyerRounds: { select: { id: true } } },
    });
    await prisma.propertyTransaction.update({
      where: { id: created.id },
      data: { activeBuyerRoundId: created.buyerRounds[0].id },
    });
    tomTxId = created.id;
  }
  const tomLink = await prisma.chainLink.create({
    data: {
      chainId: chain.id,
      position: 4,
      transactionId: tomTxId,
      claimedByUserId: neighbourIds.tomId,
      claimedAt: new Date(),
      inviteStatus: "CLAIMED",
    },
    select: { id: true },
  });
  await prisma.propertyTransaction.update({
    where: { id: tomTxId },
    data: { chainLinkId: tomLink.id },
  });

  return { emilyTxId: emilyTx.id, emilyLinkId: emilyLink.id, tomLinkId: tomLink.id, janeLinkId: janeLink.id };
}

async function buildPreWithdrawnFixture(
  emily: { id: string; agencyId: string },
  addr: string,
  tomId: string,
  tomResponse: "WAITING" | "REMARKETING",
) {
  await deleteFixtureByAddress(addr, emily.agencyId);

  // 2-link chain — Emily at position 2, Tom at position 3. No downstream
  // (the file is already withdrawn — pretend the downstream detached
  // cleanly during the original withdraw).
  const chain = await prisma.propertyChain.create({
    data: { agencyId: emily.agencyId, name: `[Closed-loop fixture: pre-withdrawn] ${addr}` },
    select: { id: true },
  });

  const emilyTx = await prisma.propertyTransaction.create({
    data: {
      propertyAddress: addr,
      agencyId: emily.agencyId,
      agentUserId: emily.id,
      status: "withdrawn",
      tenure: "freehold",
      purchaseType: "mortgage",
      withdrawalReason: "BUYER_WITHDREW",
      fallThroughReason: "Buyer's mortgage application was declined",
      serviceType: "self_managed",
      progressedBy: "agent",
      purchasePrice: 52500000,
      buyerRounds: {
        create: {
          roundNumber: 1,
          purchasePrice: 52500000,
          fallThroughReason: "Buyer's mortgage application was declined",
          // Inline snapshot so the drawer's "Chain at withdrawal" section
          // renders something on F3 / F4 — same shape buildChainSnapshotForWithdrawal
          // would write at withdraw time.
          chainSnapshot: {
            chainId: chain.id,
            ourLinkId: "(set below)",
            ourPosition: 2,
            withdrawalReason: "BUYER_WITHDREW",
            capturedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
            neighbours: [
              {
                linkId: "(set below)",
                position: 3,
                withdrawalStatus: null,
                claimedByUserId: tomId,
                claimedAgentName: "Tom Brown",
                claimedAgencyName: "Oakhurst (test)",
                claimedTransactionId: null,
                claimedAddress: "12 Elm Lane, Redland, BS6 6AB",
                stubAddress: null,
                stubAgencyName: null,
                stubAgentName: null,
              },
            ],
            detachedSegment: null,
          },
        },
      },
    },
    select: { id: true, buyerRounds: { select: { id: true } } },
  });

  const emilyLink = await prisma.chainLink.create({
    data: {
      chainId: chain.id,
      position: 2,
      transactionId: emilyTx.id,
      claimedByUserId: emily.id,
      claimedAt: new Date(),
      inviteStatus: "CLAIMED",
    },
    select: { id: true },
  });
  await prisma.propertyTransaction.update({
    where: { id: emilyTx.id },
    data: { chainLinkId: emilyLink.id, activeBuyerRoundId: emilyTx.buyerRounds[0].id },
  });
  await prisma.contact.create({
    data: { propertyTransactionId: emilyTx.id, name: "Patricia Holt", email: "patricia.holt@example.com", roleType: "vendor" },
  });

  // Tom's link + tx
  const tomAgent = await prisma.user.findUnique({ where: { id: tomId }, select: { agencyId: true, email: true } });
  const tomTxAddr = tomResponse === "WAITING" ? "18 Birch Way, Cotham, BS6 5ZZ" : "22 Maple Grove, Cotham, BS6 5XX";
  let tomTx = await prisma.propertyTransaction.findFirst({
    where: { agencyId: tomAgent!.agencyId!, propertyAddress: tomTxAddr },
    select: { id: true },
  });
  if (!tomTx) {
    const created = await prisma.propertyTransaction.create({
      data: {
        propertyAddress: tomTxAddr,
        agencyId: tomAgent!.agencyId!,
        agentUserId: tomId,
        status: "active",
        serviceType: "self_managed",
        progressedBy: "agent",
        buyerRounds: { create: { roundNumber: 1 } },
      },
      select: { id: true, buyerRounds: { select: { id: true } } },
    });
    await prisma.propertyTransaction.update({
      where: { id: created.id },
      data: { activeBuyerRoundId: created.buyerRounds[0].id },
    });
    tomTx = { id: created.id };
  }
  const tomLink = await prisma.chainLink.create({
    data: {
      chainId: chain.id,
      position: 3,
      transactionId: tomTx.id,
      claimedByUserId: tomId,
      claimedAt: new Date(),
      inviteStatus: "CLAIMED",
      withdrawalStatus: tomResponse,
      withdrawalRespondedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    },
    select: { id: true },
  });
  await prisma.propertyTransaction.update({
    where: { id: tomTx.id },
    data: { chainLinkId: tomLink.id },
  });

  // Plant the original LOST_BUYER notification row with Tom's response
  // pre-recorded — this is what cascadeChainBuyerFound walks at relist
  // time to decide variant copy. Sets respondedAt + response so the
  // BUYER_FOUND payload picks the right branch.
  await prisma.chainNotificationQueue.create({
    data: {
      chainId: chain.id,
      triggeringLinkId: emilyLink.id,
      recipientLinkId: tomLink.id,
      recipientUserId: tomId,
      recipientEmail: tomAgent!.email!,
      type: "LOST_BUYER",
      direction: "UPWARD",
      emailSentAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      response: tomResponse,
      respondedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    },
  });

  // Patch the snapshot's linkId placeholders now that we have the real IDs.
  await prisma.buyerRound.update({
    where: { id: emilyTx.buyerRounds[0].id },
    data: {
      chainSnapshot: {
        chainId: chain.id,
        ourLinkId: emilyLink.id,
        ourPosition: 2,
        withdrawalReason: "BUYER_WITHDREW",
        capturedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        neighbours: [
          {
            linkId: emilyLink.id,
            position: 2,
            withdrawalStatus: "WITHDRAWN",
            claimedByUserId: emily.id,
            claimedAgentName: "Emily Chen",
            claimedAgencyName: "Hartwell & Partners",
            claimedTransactionId: emilyTx.id,
            claimedAddress: addr,
            stubAddress: null,
            stubAgencyName: null,
            stubAgentName: null,
          },
          {
            linkId: tomLink.id,
            position: 3,
            withdrawalStatus: tomResponse,
            claimedByUserId: tomId,
            claimedAgentName: "Tom Brown",
            claimedAgencyName: "Oakhurst (test)",
            claimedTransactionId: tomTx.id,
            claimedAddress: tomTxAddr,
            stubAddress: null,
            stubAgencyName: null,
            stubAgentName: null,
          },
        ],
        detachedSegment: null,
      },
    },
  });

  return { emilyTxId: emilyTx.id };
}

async function main() {
  const emily = await getEmily();
  console.log(`Emily: ${emily.id} / agency ${emily.agencyId}`);

  // Build the neighbour agents first (idempotent).
  const tomId = await ensureUser({ ...NEIGHBOUR_AGENTS[0] });
  const janeId = await ensureUser({ ...NEIGHBOUR_AGENTS[1] });
  console.log(`Neighbour agents: tom=${tomId} jane=${janeId}`);

  // ── F1: standalone (no chain) ─────────────────────────────────────────
  const f1 = await buildStandaloneFixture(emily, "[Chain arc F1] 1 Acacia Lane, Bristol, BS6 6AA");
  console.log(`F1 standalone: ${f1}`);

  // ── F2: 4-link chain, Emily mid-chain ─────────────────────────────────
  const f2 = await build4LinkChainFixture(
    emily,
    "[Chain arc F2] 2 Birch Way, Bristol, BS6 6BB",
    { tomId, janeId },
  );
  console.log(`F2 mid-chain: ${f2.emilyTxId}`);

  // ── F3: pre-withdrawn, Tom responded WAITING ──────────────────────────
  const f3 = await buildPreWithdrawnFixture(
    emily,
    "[Chain arc F3] 3 Cedar Court, Bristol, BS6 6CC",
    tomId,
    "WAITING",
  );
  console.log(`F3 pre-withdrawn (Tom=WAITING): ${f3.emilyTxId}`);

  // ── F4: pre-withdrawn, Tom responded REMARKETING ──────────────────────
  const f4 = await buildPreWithdrawnFixture(
    emily,
    "[Chain arc F4] 4 Dahlia Drive, Bristol, BS6 6DD",
    tomId,
    "REMARKETING",
  );
  console.log(`F4 pre-withdrawn (Tom=REMARKETING): ${f4.emilyTxId}`);

  // ── F5: withdrawn in-chain, awaiting relist (Don't know yet) ─────────
  // Same shape as F3 but Tom hasn't responded yet (no WAITING /
  // REMARKETING set), so the BUYER_FOUND on relist will use the
  // "default" no-response variant. After Emily picks "Don't know yet"
  // on the onward-sale step, chainSetupPending flips true and the hub
  // card appears.
  const f5 = await buildPreWithdrawnFixture(
    emily,
    "[Chain arc F5] 5 Elm Place, Bristol, BS6 6EE",
    tomId,
    "WAITING", // we'll null this back out below
  );
  // Reset Tom's response for F5 (was set to WAITING above; we want no
  // response so the BUYER_FOUND variant is "default").
  await prisma.chainNotificationQueue.updateMany({
    where: { recipientUserId: tomId, type: "LOST_BUYER" },
    data: { response: null, respondedAt: null },
  });
  // Note — this nulls Tom's response on F3 + F4 too. To keep them
  // distinct, set them explicitly after the F5 reset.
  await prisma.chainLink.updateMany({
    where: { claimedByUserId: tomId, withdrawalStatus: "WAITING" },
    data: { withdrawalStatus: null, withdrawalRespondedAt: null },
  });

  // Re-apply F3 / F4 Tom responses by targeting the specific notification
  // rows that pair with those files.
  // (Identify by triggeringLinkId — F3's Emily link vs F4's Emily link.
  // Cleanest is to look them up by tx.)
  const f3Emily = await prisma.propertyTransaction.findUnique({
    where: { id: f3.emilyTxId },
    select: { chainLinkId: true },
  });
  const f4Emily = await prisma.propertyTransaction.findUnique({
    where: { id: f4.emilyTxId },
    select: { chainLinkId: true },
  });
  if (f3Emily?.chainLinkId) {
    await prisma.chainNotificationQueue.updateMany({
      where: { triggeringLinkId: f3Emily.chainLinkId, type: "LOST_BUYER" },
      data: { response: "WAITING", respondedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000) },
    });
    await prisma.chainLink.updateMany({
      where: { claimedByUserId: tomId, chainId: { in: [(await prisma.chainLink.findUnique({ where: { id: f3Emily.chainLinkId }, select: { chainId: true } }))!.chainId] } },
      data: { withdrawalStatus: "WAITING", withdrawalRespondedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000) },
    });
  }
  if (f4Emily?.chainLinkId) {
    await prisma.chainNotificationQueue.updateMany({
      where: { triggeringLinkId: f4Emily.chainLinkId, type: "LOST_BUYER" },
      data: { response: "REMARKETING", respondedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000) },
    });
    await prisma.chainLink.updateMany({
      where: { claimedByUserId: tomId, chainId: { in: [(await prisma.chainLink.findUnique({ where: { id: f4Emily.chainLinkId }, select: { chainId: true } }))!.chainId] } },
      data: { withdrawalStatus: "REMARKETING", withdrawalRespondedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000) },
    });
  }

  console.log(`F5 awaiting-relist (Tom no response): ${f5.emilyTxId}`);

  console.log(`
============================================================
Chain closed-loop fixtures seeded.
Sign in as Emily on staging:
  https://salesprogressor-git-staging-ellis-askeys-projects.vercel.app/

Use these files for the walkthrough:
  F1 — [Chain arc F1] 1 Acacia Lane    (standalone, active)
  F2 — [Chain arc F2] 2 Birch Way      (mid-chain, active)
  F3 — [Chain arc F3] 3 Cedar Court    (withdrawn, Tom WAITING → relist for WAITING variant)
  F4 — [Chain arc F4] 4 Dahlia Drive   (withdrawn, Tom REMARKETING → relist for REMARKETING variant)
  F5 — [Chain arc F5] 5 Elm Place      (withdrawn, Tom no response → relist with "Don't know yet")

See docs/chain-closed-loop-walkthrough.md for the step-by-step.
============================================================
`);

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
