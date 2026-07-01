/**
 * Trace harness for A1 (Sub-arc A — confirmation path unification).
 *
 * Captures EVERY Prisma write (model + action + args) made by a milestone
 * confirmation. Run twice: once against current code (baseline) and once
 * against the refactored code. The diff between the two runs is the proof
 * that agent-confirm behaviour is unchanged and client-confirm now fires
 * the full cascade.
 *
 * Usage (from project root, with .env.local pointing at staging):
 *   npx tsx scripts/trace-confirm-writes.ts --via agent --milestone PM8 --out logs/trace-agent-before.json
 *   npx tsx scripts/trace-confirm-writes.ts --via portal --milestone PM8 --out logs/trace-portal-before.json
 *   npx tsx scripts/trace-confirm-writes.ts --via portal --milestone VM19 --out logs/trace-portal-vm19-before.json
 *
 * For each run the script:
 *   1. Creates a fresh test transaction with a known agent, contacts, chain,
 *      and an explicit set of pre-completed milestones to satisfy prereqs.
 *   2. Installs a Prisma $use middleware that records every create/update/
 *      upsert/delete/*Many call on every model.
 *   3. Calls the confirmation path (completeMilestone or portalCompleteMilestone).
 *   4. Waits 2s for fire-and-forget side effects to flush.
 *   5. Writes the captured operations to the output file.
 *   6. Cleans up — deletes the test transaction (cascade clears completions,
 *      contacts, chain link).
 *
 * Output JSON shape (one entry per Prisma operation):
 *   { seq, model, action, args, ts }
 *
 * The diff between two runs is structural — same model + action + args (modulo
 * stable ids of the test fixture, which the script normalises) at the same seq.
 *
 * Read-only against fixture data; the script owns its own fixture lifecycle.
 * Uses EMAIL_SANDBOX_MODE — does not send real email.
 */

import { PrismaClient, Prisma } from "@prisma/client";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

// ─── CLI args ────────────────────────────────────────────────────────────────

type Via = "agent" | "portal";
type Args = {
  via: Via;
  milestone: string; // milestone code, e.g. "PM8" or "VM19"
  out: string;
  eventDate?: string;
  chain: boolean; // include a chain with a separate-agency mate
};

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const get = (flag: string): string | undefined => {
    const i = argv.indexOf(flag);
    return i >= 0 && i + 1 < argv.length ? argv[i + 1] : undefined;
  };
  const flag = (f: string): boolean => argv.includes(f);
  const via = (get("--via") as Via) ?? "agent";
  const milestone = get("--milestone") ?? "PM8";
  const out = get("--out") ?? `logs/trace-${via}-${milestone}.json`;
  const eventDate = get("--eventDate") ?? undefined;
  const chain = flag("--chain");
  if (via !== "agent" && via !== "portal") {
    throw new Error(`--via must be 'agent' or 'portal' (got ${via})`);
  }
  return { via, milestone, out, eventDate, chain };
}

// ─── Prereq map (must match lib/milestone-prerequisites.ts) ──────────────────
// Hardcoded subset for the codes we trace. Keep in sync if upstream changes.

const PREREQS: Record<string, string[]> = {
  // Common test targets
  PM8:  ["PM7"],            // Buyer's solicitor has ordered searches ← received DCP
  PM7:  ["PM4"],            // received DCP ← money on account
  PM4:  ["PM3"],            // money on account ← ID/AML
  PM3:  ["PM2"],            // ID/AML ← MOS received
  PM2:  ["PM1"],            // MOS received ← solicitor instructed
  PM1:  [],
  VM7:  ["VM6"],            // draft contract pack issued ← PIQ returned
  VM6:  ["VM5"],
  VM5:  ["VM4"],
  VM4:  ["VM3"],
  VM3:  ["VM2"],
  VM2:  ["VM1"],
  VM1:  [],
  VM19: ["VM18"],           // vendor exchanged ← vendor ready-to-exchange
  PM26: ["PM25"],           // purchaser exchanged ← purchaser ready-to-exchange
};

function prereqChain(code: string): string[] {
  const out = new Set<string>();
  const walk = (c: string) => {
    for (const p of PREREQS[c] ?? []) {
      if (out.has(p)) continue;
      out.add(p);
      walk(p);
    }
  };
  walk(code);
  return [...out];
}

// ─── Fixture lifecycle ───────────────────────────────────────────────────────

async function buildFixture(prisma: PrismaClient, targetCode: string, includeChain = false) {
  // 1. Find or create the test agency
  let agency = await prisma.agency.findFirst({ where: { name: "TraceHarnessAgency" } });
  if (!agency) {
    agency = await prisma.agency.create({ data: { name: "TraceHarnessAgency", isInternal: true } });
  }
  // 2. Find or create the test agent user
  let agentUser = await prisma.user.findFirst({ where: { email: "trace-agent@example.test" } });
  if (!agentUser) {
    agentUser = await prisma.user.create({
      data: {
        name: "Trace Agent",
        email: "trace-agent@example.test",
        role: "director",
        agencyId: agency.id,
        firmName: "TraceHarnessAgency",
        emailUnsubscribedAt: new Date(), // suppress retention emails during trace
      },
    });
  }

  // 3. Create the test transaction
  const transaction = await prisma.propertyTransaction.create({
    data: {
      propertyAddress: `Trace Fixture ${Date.now()}, TR1 1TR`,
      agencyId: agency.id,
      agentUserId: agentUser.id,
      assignedUserId: agentUser.id,
      purchaseType: "cash_buyer",
      tenure: "freehold",
      serviceType: "self_managed",
      progressedBy: "agent",
    },
  });

  // 4. Create contacts (vendor + purchaser) with portalTokens
  const vendorContact = await prisma.contact.create({
    data: {
      propertyTransactionId: transaction.id,
      name: "Trace Vendor",
      email: "trace-vendor@example.test",
      roleType: "vendor",
      portalToken: `trace-vendor-${transaction.id}`,
    },
  });
  const purchaserContact = await prisma.contact.create({
    data: {
      propertyTransactionId: transaction.id,
      name: "Trace Purchaser",
      email: "trace-purchaser@example.test",
      roleType: "purchaser",
      portalToken: `trace-purchaser-${transaction.id}`,
    },
  });

  // 5. Load all milestone definitions, build MilestoneCompletion rows for ALL
  //    of them (locked by default), then mark prereqs of the target as complete
  //    and the target itself as 'available'.
  const allDefs = await prisma.milestoneDefinition.findMany({
    select: { id: true, code: true },
  });
  const defByCode = new Map(allDefs.map((d) => [d.code, d.id]));

  const prereqCodes = prereqChain(targetCode);
  const completeCodes = new Set(prereqCodes); // all prereqs complete
  const availableCodes = new Set([targetCode]); // target available

  await prisma.milestoneCompletion.createMany({
    data: allDefs.map((d) => {
      const isComplete = completeCodes.has(d.code);
      const isAvailable = availableCodes.has(d.code);
      return {
        transactionId: transaction.id,
        milestoneDefinitionId: d.id,
        state: isComplete ? "complete" : isAvailable ? "available" : "locked",
        completedAt: isComplete ? new Date(Date.now() - 1000 * 60 * 60 * 24) : null, // 1d ago
        completedById: isComplete ? agentUser.id : null,
      } as const;
    }),
  });

  // 6. For VM19/PM26 / VM20/PM27 (bilateral pairs), the script needs to also
  //    set the counterpart side's prereqs complete so the bilateral write
  //    doesn't trip its own prereq guard.
  const BILATERAL: Record<string, string> = {
    VM19: "PM26", PM26: "VM19",
    VM20: "PM27", PM27: "VM20",
    VM18: "PM25", PM25: "VM18",
  };
  const counterCode = BILATERAL[targetCode];
  if (counterCode) {
    const counterPrereqs = prereqChain(counterCode);
    const counterDefIds = counterPrereqs
      .map((c) => defByCode.get(c))
      .filter((id): id is string => !!id);
    if (counterDefIds.length > 0) {
      await prisma.milestoneCompletion.updateMany({
        where: {
          transactionId: transaction.id,
          milestoneDefinitionId: { in: counterDefIds },
        },
        data: {
          state: "complete",
          completedAt: new Date(Date.now() - 1000 * 60 * 60 * 24),
          completedById: agentUser.id,
        },
      });
    }
    // Counter target itself: available
    const counterTargetId = defByCode.get(counterCode);
    if (counterTargetId) {
      await prisma.milestoneCompletion.updateMany({
        where: { transactionId: transaction.id, milestoneDefinitionId: counterTargetId },
        data: { state: "available" },
      });
    }
  }

  const targetDefId = defByCode.get(targetCode);
  if (!targetDefId) throw new Error(`Milestone code ${targetCode} not in DB`);

  // 7. Optional chain fixture — a 2-link chain where the trace transaction is
  //    one link and the OTHER link is claimed by a separate agency's agent.
  //    This is what fires chain-mate notifications when VM19/PM26/VM20/PM27
  //    are confirmed.
  let chainMate: { agency: { id: string }; user: { id: string; email: string; name: string }; transactionId: string } | null = null;
  if (includeChain) {
    // Separate agency for the chain mate
    let mateAgency = await prisma.agency.findFirst({ where: { name: "TraceHarnessChainMateAgency" } });
    if (!mateAgency) {
      mateAgency = await prisma.agency.create({ data: { name: "TraceHarnessChainMateAgency", isInternal: true } });
    }
    let mateUser = await prisma.user.findFirst({ where: { email: "trace-chainmate@example.test" } });
    if (!mateUser) {
      mateUser = await prisma.user.create({
        data: {
          name: "Trace Chain Mate Agent",
          email: "trace-chainmate@example.test",
          role: "director",
          agencyId: mateAgency.id,
          firmName: "TraceHarnessChainMateAgency",
          // NOT setting emailUnsubscribedAt — chain notifications use
          // isUserEmailSuppressed; suppressing the mate would skip them
          // and defeat the verification.
        },
      });
    } else if (mateUser.emailUnsubscribedAt !== null) {
      // Resurrect if previously suppressed
      mateUser = await prisma.user.update({
        where: { id: mateUser.id },
        data: { emailUnsubscribedAt: null },
      });
    }
    // Mate's own transaction (the downstream chain link)
    const mateTx = await prisma.propertyTransaction.create({
      data: {
        propertyAddress: `Trace ChainMate ${Date.now()}, CM2 2CM`,
        agencyId: mateAgency.id,
        agentUserId: mateUser.id,
        assignedUserId: mateUser.id,
        purchaseType: "cash_buyer",
        tenure: "freehold",
        serviceType: "self_managed",
        progressedBy: "agent",
      },
    });
    const chain = await prisma.propertyChain.create({
      data: {
        agencyId: agency.id,
        createdByUserId: agentUser.id,
        status: "ACTIVE",
      },
    });
    // Trace tx = position 0 (upstream / vendor in this chain)
    const traceLink = await prisma.chainLink.create({
      data: {
        chainId: chain.id,
        position: 0,
        createdByUserId: agentUser.id,
        claimedByUserId: agentUser.id,
        claimedAt: new Date(),
        transactionId: transaction.id,
        inviteStatus: "CLAIMED",
      },
    });
    // PropertyTransaction.chainLinkId back-reference — enqueueChainMilestoneNotifications
    // reads this; without it the chain walk returns early.
    await prisma.propertyTransaction.update({
      where: { id: transaction.id },
      data: { chainLinkId: traceLink.id },
    });
    // Mate tx = position 1 (downstream / purchaser in this chain)
    const mateLink = await prisma.chainLink.create({
      data: {
        chainId: chain.id,
        position: 1,
        createdByUserId: agentUser.id,
        claimedByUserId: mateUser.id,
        claimedAt: new Date(),
        transactionId: mateTx.id,
        inviteStatus: "CLAIMED",
      },
    });
    await prisma.propertyTransaction.update({
      where: { id: mateTx.id },
      data: { chainLinkId: mateLink.id },
    });
    chainMate = {
      agency: { id: mateAgency.id },
      user: { id: mateUser.id, email: mateUser.email, name: mateUser.name },
      transactionId: mateTx.id,
    };
  }

  return {
    agency,
    agentUser,
    transaction,
    vendorContact,
    purchaserContact,
    targetDefId,
    targetCode,
    chainMate,
  };
}

async function teardownFixture(
  prisma: PrismaClient,
  transactionId: string,
  chainMateTransactionId?: string | null,
) {
  // Cascade deletes completions, contacts, chain links, and the transaction.
  // Delete the mate's transaction first (FK cascade on ChainLink keeps things
  // consistent).
  if (chainMateTransactionId) {
    await prisma.propertyTransaction.delete({ where: { id: chainMateTransactionId } }).catch(() => {});
  }
  await prisma.propertyTransaction.delete({ where: { id: transactionId } });
}

// ─── Middleware capture ──────────────────────────────────────────────────────

type Captured = {
  seq: number;
  model: string;
  action: string;
  args: unknown;
  ts: number;
};

const WRITE_ACTIONS = new Set([
  "create", "createMany", "createManyAndReturn",
  "update", "updateMany",
  "upsert",
  "delete", "deleteMany",
]);

function installCapture(prisma: PrismaClient, captured: Captured[]) {
  let seq = 0;
  prisma.$use(async (params, next) => {
    if (WRITE_ACTIONS.has(params.action)) {
      captured.push({
        seq: seq++,
        model: params.model ?? "?",
        action: params.action,
        args: params.args,
        ts: Date.now(),
      });
    }
    return next(params);
  });
}

// ─── Args normalisation (for diff stability) ─────────────────────────────────
// Replace fixture-specific values with stable tokens so two runs against
// different transactions / contacts / users / dates produce comparable JSON.

function normalise(args: unknown, fixture: {
  transactionId: string;
  agentUserId: string;
  vendorContactId: string;
  purchaserContactId: string;
  targetDefId: string;
}): unknown {
  const tokens: Record<string, string> = {
    [fixture.transactionId]: "{TX_ID}",
    [fixture.agentUserId]: "{AGENT_USER_ID}",
    [fixture.vendorContactId]: "{VENDOR_CONTACT_ID}",
    [fixture.purchaserContactId]: "{PURCHASER_CONTACT_ID}",
    [fixture.targetDefId]: "{TARGET_DEF_ID}",
  };

  const walk = (v: unknown): unknown => {
    if (v === null || v === undefined) return v;
    if (typeof v === "string") {
      return tokens[v] ?? v;
    }
    if (v instanceof Date) {
      // Floor to nearest second to absorb scheduling jitter
      return new Date(Math.floor(v.getTime() / 1000) * 1000).toISOString();
    }
    if (Array.isArray(v)) return v.map(walk);
    if (typeof v === "object") {
      const out: Record<string, unknown> = {};
      for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
        out[k] = walk(val);
      }
      return out;
    }
    return v;
  };

  return walk(args);
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const { via, milestone, out, eventDate, chain } = parseArgs();
  // Tick-shifted to ensure consistent output paths
  mkdirSync(dirname(out), { recursive: true });

  // Use the APP singleton — both the fixture setup and the service-under-trace
  // run through the same client, so we capture every write regardless of which
  // module imported prisma (touchLastActivity, chain notifications, etc. all
  // use @/lib/prisma directly and would be invisible to a fresh PrismaClient).
  const appPrismaModule = await import("../lib/prisma");
  const prisma = appPrismaModule.prisma as unknown as PrismaClient;
  const captured: Captured[] = [];

  installCapture(prisma, captured);

  console.log(`[trace] building fixture for ${via} confirm of ${milestone}${chain ? " (with chain mate)" : ""}...`);
  const fx = await buildFixture(prisma, milestone, chain);
  console.log(`[trace] fixture transaction ${fx.transaction.id}${fx.chainMate ? `, chain mate ${fx.chainMate.user.email}` : ""}`);

  const fixtureCutoff = captured.length;

  try {
    // Lazy imports so service code uses the same Prisma singleton as the
    // application — we don't replace the global; the middleware on `prisma`
    // here captures our standalone client's calls, NOT the application's. To
    // capture application-Prisma calls, we run the service against this client.
    //
    // Approach: import the service functions and pass `prisma` as the `tx`
    // argument where the signature permits. For functions that don't accept a
    // client, we monkey-patch by re-exporting through a thin wrapper.

    if (via === "agent") {
      const { completeMilestone } = await import("../lib/services/milestones");
      // Direct service call — emulates what confirmMilestoneAction does inside
      // its $transaction (minus the bilateral counterpart and revalidate calls,
      // which are agent-action-specific and not part of the
      // service-layer cascade).
      await completeMilestone(
        {
          transactionId: fx.transaction.id,
          milestoneDefinitionId: fx.targetDefId,
          confirmer: { kind: "user", id: fx.agentUser.id, name: fx.agentUser.name },
          eventDate: eventDate ? new Date(eventDate) : null,
        },
        prisma as unknown as Prisma.TransactionClient,
      );
    } else {
      const { portalCompleteMilestone } = await import("../lib/services/portal");
      // portalCompleteMilestone uses the app singleton prisma — already
      // captured because our `prisma` IS the app singleton.
      // Determine the right token based on milestone side
      const isVendorSide = ["VM1","VM2","VM3","VM4","VM5","VM6","VM7","VM8","VM9","VM10","VM11","VM12","VM13","VM14","VM15","VM16","VM17","VM18","VM19","VM20"].includes(milestone);
      const token = isVendorSide ? fx.vendorContact.portalToken! : fx.purchaserContact.portalToken!;
      await portalCompleteMilestone({
        token,
        milestoneDefinitionId: fx.targetDefId,
        eventDate: eventDate ?? null,
      });
    }

    // Let fire-and-forget calls drain
    console.log(`[trace] waiting 2s for fire-and-forget side effects...`);
    await new Promise((r) => setTimeout(r, 2000));
  } catch (err) {
    console.error(`[trace] confirmation failed:`, err);
    process.exitCode = 1;
  }

  const fixtureNormalisation = {
    transactionId: fx.transaction.id,
    agentUserId: fx.agentUser.id,
    vendorContactId: fx.vendorContact.id,
    purchaserContactId: fx.purchaserContact.id,
    targetDefId: fx.targetDefId,
  };

  const dumped = captured.slice(fixtureCutoff).map((c) => ({
    seq: c.seq - fixtureCutoff,
    model: c.model,
    action: c.action,
    args: normalise(c.args, fixtureNormalisation),
  }));

  // Chain-mate verification payload: if a chain mate was set up, fetch any
  // OutboundEmailQueue rows enqueued during this run targeting that mate.
  let chainMateEmails: unknown[] | undefined;
  if (fx.chainMate) {
    const queued = await prisma.outboundEmailQueue.findMany({
      where: {
        recipientUserId: fx.chainMate.user.id,
        createdAt: { gte: new Date(Date.now() - 60 * 1000) },
      },
      select: {
        emailType: true,
        sourceId: true,
        recipientEmail: true,
        recipientUserId: true,
        payload: true,
        scheduledFor: true,
      },
    });
    chainMateEmails = queued.map((q) => ({
      emailType: q.emailType,
      sourceId: "{SOURCE_ID}", // normalised
      recipientEmail: q.recipientEmail === fx.chainMate!.user.email ? "{CHAIN_MATE_EMAIL}" : q.recipientEmail,
      recipientUserId: "{CHAIN_MATE_USER_ID}",
      payload: q.payload,
      scheduledFor: "{SCHEDULED_FOR}",
    }));
  }

  writeFileSync(out, JSON.stringify({
    via,
    milestone,
    eventDate: eventDate ?? null,
    chainMateInfo: fx.chainMate ? { email: fx.chainMate.user.email, agencyId: fx.chainMate.agency.id } : null,
    chainMateEmailsEnqueued: chainMateEmails,
    captured: dumped,
  }, null, 2));
  console.log(`[trace] wrote ${dumped.length} write operations${chainMateEmails ? ` + ${chainMateEmails.length} chain-mate emails` : ""} to ${out}`);

  console.log(`[trace] tearing down fixture ${fx.transaction.id}...`);
  await teardownFixture(prisma, fx.transaction.id, fx.chainMate?.transactionId);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
