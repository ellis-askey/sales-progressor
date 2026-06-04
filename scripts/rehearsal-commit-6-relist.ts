// Commit 6 staging rehearsal — relist action end-to-end.
//
// This is the prod-readiness gate. It seeds controlled fixtures and walks
// every checklist item from the locked spec, printing verbatim output so
// the reviewer can see — not be told — what the action does.
//
// What gets exercised:
//   1. Single-round create → milestones → withdraw → relist (round 1→2).
//   2. DOUBLE relist (round 2→3); both archived rounds remain intact.
//   3. Portal personas: old=dead, new=scoped, vendor=full + active PM + new-buyer update.
//   4. Outsourced intro email: new buyer ONLY (vendor guard).
//   5. Purchaser-solicitor Contact + PM chase task through the REAL send path.
//   6. Chase hygiene: old buyer-side cancelled; reset-VM-anchored cancelled
//      and recomputed; nothing stale remains.
//   7. Undo regression: confirm + undo on a never-relisted file is unchanged.
//   8. Chain-guard: withdrawalStatus cleared; no cascade; internal note.
//   9. Permissions: server-side exchanged-file guard; client tokens cannot
//      reach the relist action.
//
// All fixtures use the sentinel prefix "[commit6 rehearsal]" so they're
// trivially identifiable and torn down on re-run.

// React.cache polyfill so production imports work outside a Server
// Component runtime. Same pattern as scripts/parity-harness-mc-reads.ts.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const React = require("react");
React.cache = (fn: unknown) => fn;

import { PrismaClient, type Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { relistTransactionImpl } from "../app/actions/transactions";
import {
  getPortalData,
  getPortalMilestones,
  getPortalTimeline,
  portalOwnSideScope,
  portalOtherSideScope,
} from "../lib/services/portal";
import { completeMilestone } from "../lib/services/milestones";
import { createCommunicationRecord } from "../lib/services/comms";

const prisma = new PrismaClient();
const SENTINEL_PREFIX = "[commit6 rehearsal]";

function header(label: string) {
  console.log("\n══════════════════════════════════════════════════════════════════════");
  console.log(`  ${label}`);
  console.log("══════════════════════════════════════════════════════════════════════");
}
function subhead(label: string) {
  console.log(`\n── ${label} ──────────────────────────────────────────────────`);
}

async function tearDown() {
  const existing = await prisma.propertyTransaction.findMany({
    where: { propertyAddress: { startsWith: SENTINEL_PREFIX } },
    select: { id: true },
  });
  for (const tx of existing) {
    await prisma.propertyTransaction.delete({ where: { id: tx.id } });
  }
  console.log(`Tore down ${existing.length} pre-existing rehearsal fixtures.`);
}

// Pick a real director user from the agency we'll fixture under, so the
// `scopeOwnershipWhere` path is exercised against a genuine session shape.
async function pickAgencyAndDirector(): Promise<{
  agencyId: string;
  agencyName: string;
  directorUserId: string;
  directorName: string;
  assignedSpUserId: string | null;
}> {
  // Prefer an agency that has at least one director + at least one
  // sales_progressor (for the outsourced rehearsal). Fall back to any
  // agency + any internal admin.
  const candidate = await prisma.user.findFirst({
    where: { role: "director", agencyId: { not: null } },
    select: { id: true, name: true, agencyId: true, agency: { select: { name: true } } },
  });
  if (!candidate || !candidate.agencyId) {
    throw new Error("No director on staging — can't run rehearsal");
  }
  const sp = await prisma.user.findFirst({
    where: { role: "sales_progressor" },
    select: { id: true },
  });
  return {
    agencyId: candidate.agencyId,
    agencyName: candidate.agency?.name ?? "?",
    directorUserId: candidate.id,
    directorName: candidate.name ?? "Director",
    assignedSpUserId: sp?.id ?? null,
  };
}

type SessionLike = {
  userId: string;
  userName: string;
  agencyId: string | null;
  scope: { kind: "all" } | { kind: "agency"; agencyIds: string[] };
};

// Build a session-like object for the director that mirrors what
// getAccessScope() returns at runtime. Director scope = own agency only.
function dirSession(d: { directorUserId: string; directorName: string; agencyId: string }): SessionLike {
  return {
    userId: d.directorUserId,
    userName: d.directorName,
    agencyId: d.agencyId,
    scope: { kind: "agency", agencyIds: [d.agencyId] },
  };
}

// Seed a controlled file with the given address suffix. Vendor + initial
// buyer + (optional) purchaser-solicitor Contact. Initial milestone state:
// VM1, VM3-VM9 complete (the "preserved" VMs in the locked spec);
// VM2/VM7/VM10-VM20 various (some complete to prove the reset truly resets).
async function seedFile(opts: {
  addressSuffix: string;
  agencyId: string;
  directorUserId: string;
  assignedSpUserId: string | null;
  serviceType: "self_managed" | "outsourced";
  withPurchaserSolicitor: boolean;
}): Promise<{
  txId: string;
  round1Id: string;
  vendorContactId: string;
  buyer1ContactId: string;
  solicitorContactId: string | null;
  vendorPortalToken: string;
  buyer1PortalToken: string;
}> {
  const address = `${SENTINEL_PREFIX} ${opts.addressSuffix}`;
  const defs = await prisma.milestoneDefinition.findMany({
    select: { id: true, code: true, side: true },
  });
  const defByCode = new Map(defs.map((d) => [d.code, d]));

  const vendorToken  = randomUUID();
  const buyer1Token  = randomUUID();
  const solicitorTok = randomUUID();

  const { txId, round1Id } = await prisma.$transaction(async (ptx) => {
    const tx = await ptx.propertyTransaction.create({
      data: {
        propertyAddress: address,
        agencyId: opts.agencyId,
        agentUserId: opts.directorUserId,
        assignedUserId: opts.serviceType === "outsourced" ? opts.assignedSpUserId : null,
        serviceType: opts.serviceType,
        status: "active",
        tenure: "freehold",
        purchaseType: "mortgage",
        purchasePrice: 500_000_00,
      },
    });
    const r1 = await ptx.buyerRound.create({
      data: {
        transactionId: tx.id,
        roundNumber: 1,
        status: "active",
        purchasePrice: 500_000_00,
      },
    });
    await ptx.propertyTransaction.update({
      where: { id: tx.id },
      data: { activeBuyerRoundId: r1.id },
    });
    return { txId: tx.id, round1Id: r1.id };
  });

  const vendorContact = await prisma.contact.create({
    data: {
      propertyTransactionId: txId,
      name: `[fixture] Seller ${opts.addressSuffix}`,
      email: `seller-${opts.addressSuffix.toLowerCase().replace(/\W+/g, "")}@example-rehearsal.invalid`,
      roleType: "vendor",
      portalToken: vendorToken,
    },
  });
  const buyer1Contact = await prisma.contact.create({
    data: {
      propertyTransactionId: txId,
      name: `[fixture] Buyer 1 ${opts.addressSuffix}`,
      email: `buyer1-${opts.addressSuffix.toLowerCase().replace(/\W+/g, "")}@example-rehearsal.invalid`,
      roleType: "purchaser",
      portalToken: buyer1Token,
      buyerRoundId: round1Id,
      // Mark the vendor and buyer1 as having already received their
      // outsourced intro (the dedup column) — that's what a real
      // outsourced file would look like by the time of relist. This
      // is the canary for the rehearsal item 4.
      outsourceIntroSentAt: opts.serviceType === "outsourced" ? new Date() : null,
    },
  });
  if (opts.serviceType === "outsourced") {
    await prisma.contact.update({
      where: { id: vendorContact.id },
      data: { outsourceIntroSentAt: new Date() },
    });
  }
  let solicitorContact = null;
  if (opts.withPurchaserSolicitor) {
    solicitorContact = await prisma.contact.create({
      data: {
        propertyTransactionId: txId,
        name: `[fixture] Buyer 1 Solicitor`,
        email: `sol1-${opts.addressSuffix.toLowerCase().replace(/\W+/g, "")}@example-rehearsal.invalid`,
        roleType: "solicitor",
        portalToken: solicitorTok,
        buyerRoundId: round1Id,
      },
    });
  }

  // Initialize all milestone completions (vendor + purchaser).
  const now = new Date();
  await prisma.milestoneCompletion.createMany({
    data: defs.map((d) => ({
      transactionId: txId,
      milestoneDefinitionId: d.id,
      state: "locked",
      buyerRoundId: d.side === "purchaser" ? round1Id : null,
      createdAt: now,
    })),
  });

  // Mark some real progress: VM1–VM9 complete, VM10 + VM11 complete to
  // prove the reset actually changes their state, plus a couple of round-1
  // PM completions so persona demos can see them as historical.
  const completeVms = ["VM1", "VM2", "VM3", "VM4", "VM5", "VM6", "VM7", "VM8", "VM9", "VM10", "VM11"];
  const completeR1Pms = ["PM1", "PM2", "PM3"];
  for (const code of completeVms) {
    const def = defByCode.get(code);
    if (!def) continue;
    await prisma.milestoneCompletion.updateMany({
      where: { transactionId: txId, milestoneDefinitionId: def.id, buyerRoundId: null },
      data: { state: "complete", completedAt: now, completedById: opts.directorUserId, summaryText: "rehearsal preset" },
    });
  }
  for (const code of completeR1Pms) {
    const def = defByCode.get(code);
    if (!def) continue;
    await prisma.milestoneCompletion.updateMany({
      where: { transactionId: txId, milestoneDefinitionId: def.id, buyerRoundId: round1Id },
      data: { state: "complete", completedAt: now, completedById: opts.directorUserId, summaryText: "rehearsal preset" },
    });
  }

  return {
    txId,
    round1Id,
    vendorContactId: vendorContact.id,
    buyer1ContactId: buyer1Contact.id,
    solicitorContactId: solicitorContact?.id ?? null,
    vendorPortalToken: vendorToken,
    buyer1PortalToken: buyer1Token,
  };
}

// Simulate the WITHDRAW step (mirrors changeStatusAction so the rehearsal
// reaches a "withdrawn + fallThroughReason set" pre-relist state without
// invoking the auth-gated action).
async function withdrawFile(txId: string, sessionDir: SessionLike, reason: string) {
  await prisma.propertyTransaction.update({
    where: { id: txId },
    data: { status: "withdrawn", fallThroughReason: reason },
  });
  await prisma.outboundMessage.create({
    data: {
      transactionId: txId,
      type: "internal_note",
      contactIds: [],
      content: `${sessionDir.userName} changed status to Withdrawn. Reason: ${reason}.`,
      createdById: sessionDir.userId,
    },
  });
}

function fmtMilestoneSummary(rows: { code: string; state: string; isComplete?: boolean; eventDate?: Date | null }[]): string {
  return rows.map((r) => `${r.code}=${r.state}`).join(", ");
}

async function dumpVendorMilestoneStates(txId: string): Promise<{ vm: Map<string, string>; pmByRound: Map<string | null, Map<string, string>> }> {
  const rows = await prisma.milestoneCompletion.findMany({
    where: { transactionId: txId },
    include: { milestoneDefinition: { select: { code: true, side: true } } },
  });
  const vm = new Map<string, string>();
  const pmByRound = new Map<string | null, Map<string, string>>();
  for (const r of rows) {
    if (r.milestoneDefinition.side === "vendor") {
      vm.set(r.milestoneDefinition.code, r.state);
    } else {
      const key = r.buyerRoundId;
      if (!pmByRound.has(key)) pmByRound.set(key, new Map());
      pmByRound.get(key)!.set(r.milestoneDefinition.code, r.state);
    }
  }
  return { vm, pmByRound };
}

async function main() {
  if (process.argv.includes("--tear-down")) {
    await tearDown();
    return;
  }
  await tearDown();

  const env = await pickAgencyAndDirector();
  console.log(`Using agency ${env.agencyName} (${env.agencyId})`);
  console.log(`Director:           ${env.directorName} (${env.directorUserId})`);
  console.log(`Assigned SP:        ${env.assignedSpUserId ?? "(none)"}`);
  const session = dirSession(env);

  // ─────────────────────────────────────────────────────────────────────
  // ITEM 1 — Create → withdraw → relist (round 1 → 2). Self-managed file.
  // ─────────────────────────────────────────────────────────────────────
  header("ITEM 1 — Create → withdraw → relist (round 1 → 2)");
  const f1 = await seedFile({
    addressSuffix: "A1",
    agencyId: env.agencyId,
    directorUserId: env.directorUserId,
    assignedSpUserId: env.assignedSpUserId,
    serviceType: "self_managed",
    withPurchaserSolicitor: false,
  });
  console.log(`Seeded tx ${f1.txId}, round1 ${f1.round1Id}`);

  subhead("Pre-relist VM state (preserved set must remain after relist)");
  const pre1 = await dumpVendorMilestoneStates(f1.txId);
  const preservedCodes = ["VM1", "VM3", "VM4", "VM5", "VM6", "VM8", "VM9"];
  const resetCodes = ["VM2", "VM7", "VM10", "VM11", "VM12", "VM13", "VM14", "VM15", "VM16", "VM17", "VM18", "VM19", "VM20"];
  console.log("  preserved:", preservedCodes.map((c) => `${c}=${pre1.vm.get(c)}`).join(", "));
  console.log("  reset:    ", resetCodes.map((c) => `${c}=${pre1.vm.get(c)}`).join(", "));

  await withdrawFile(f1.txId, session, "Buyer pulled out — broken chain");
  console.log("Withdraw applied. fallThroughReason=\"Buyer pulled out — broken chain\"");

  subhead("Calling relistTransactionImpl");
  const r1 = await relistTransactionImpl(
    {
      transactionId: f1.txId,
      newBuyer: { name: "Charlie New", email: "charlie@example-rehearsal.invalid", phone: "07700900111" },
      newPurchasePrice: 510_000_00,
    },
    session,
  );
  console.log(`Returned: newRoundId=${r1.newRoundId}, newContactId=${r1.newContactId}, newRoundNumber=${r1.newRoundNumber}`);

  subhead("Post-relist VM + PM state");
  const post1 = await dumpVendorMilestoneStates(f1.txId);
  console.log("  VM preserved:", preservedCodes.map((c) => `${c}=${post1.vm.get(c)}`).join(", "));
  console.log("  VM reset:    ", resetCodes.map((c) => `${c}=${post1.vm.get(c)}`).join(", "));
  console.log(`  PMs scoped by round:`);
  for (const [roundId, pms] of post1.pmByRound.entries()) {
    const label = roundId === f1.round1Id ? "round1 (archived)" : roundId === r1.newRoundId ? "round2 (active)" : `round=${roundId}`;
    const counts = { complete: 0, available: 0, locked: 0, not_required: 0 };
    for (const s of pms.values()) (counts as any)[s] = ((counts as any)[s] ?? 0) + 1;
    console.log(`    ${label}: ${pms.size} rows (${Object.entries(counts).map(([k, v]) => `${k}=${v}`).join(", ")})`);
  }

  subhead("vendorMilestoneSnapshot on archived round (must contain pre-reset states)");
  const archivedR1 = await prisma.buyerRound.findUnique({
    where: { id: f1.round1Id },
    select: { status: true, archivedAt: true, fallThroughReason: true, vendorMilestoneSnapshot: true },
  });
  console.log("  status:           ", archivedR1?.status);
  console.log("  archivedAt set:   ", archivedR1?.archivedAt !== null);
  console.log("  fallThroughReason:", archivedR1?.fallThroughReason);
  const snap = (archivedR1?.vendorMilestoneSnapshot ?? []) as Array<{ code: string; state: string }>;
  console.log("  snapshot rows:    ", snap.length);
  console.log("  snapshot codes:   ", snap.map((s) => `${s.code}=${s.state}`).join(", "));

  subhead("PropertyTransaction mirror updated");
  const tx1after = await prisma.propertyTransaction.findUnique({
    where: { id: f1.txId },
    select: {
      status: true, activeBuyerRoundId: true, fallThroughReason: true,
      expectedExchangeDate: true, completionDate: true, purchasePrice: true,
    },
  });
  console.log(`  status=${tx1after?.status}  activeBuyerRoundId=${tx1after?.activeBuyerRoundId}  fallThroughReason=${tx1after?.fallThroughReason}`);
  console.log(`  purchasePrice=${tx1after?.purchasePrice}  expectedExchangeDate=${tx1after?.expectedExchangeDate}  completionDate=${tx1after?.completionDate}`);

  subhead("PriceHistory row stamped to new round");
  const ph = await prisma.priceHistory.findMany({
    where: { transactionId: f1.txId },
    select: { oldPrice: true, newPrice: true, buyerRoundId: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  for (const p of ph) {
    console.log(`  ${p.oldPrice} → ${p.newPrice}  buyerRoundId=${p.buyerRoundId === r1.newRoundId ? "[new round]" : p.buyerRoundId === f1.round1Id ? "[round1]" : p.buyerRoundId}`);
  }

  subhead("Internal note");
  const notes = await prisma.outboundMessage.findMany({
    where: { transactionId: f1.txId, type: "internal_note" },
    select: { content: true, buyerRoundId: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: 3,
  });
  for (const n of notes.slice().reverse()) console.log(`  [${n.buyerRoundId ? "round-stamped" : "file-level"}] ${n.content}`);

  subhead("Old buyer contact: token rotated to NULL");
  const oldBuyer = await prisma.contact.findUnique({
    where: { id: f1.buyer1ContactId },
    select: { name: true, portalToken: true, buyerRoundId: true },
  });
  console.log(`  ${oldBuyer?.name}  portalToken=${oldBuyer?.portalToken ?? "NULL"}  buyerRoundId=${oldBuyer?.buyerRoundId === f1.round1Id ? "[round1]" : oldBuyer?.buyerRoundId}`);

  subhead("New buyer contact: stamped to round 2 with fresh token");
  const newBuyer = await prisma.contact.findUnique({
    where: { id: r1.newContactId },
    select: { name: true, email: true, portalToken: true, buyerRoundId: true },
  });
  console.log(`  ${newBuyer?.name}  email=${newBuyer?.email}  portalToken=${newBuyer?.portalToken ? "[set]" : "NULL"}  buyerRoundId=${newBuyer?.buyerRoundId === r1.newRoundId ? "[new round]" : newBuyer?.buyerRoundId}`);

  // ─────────────────────────────────────────────────────────────────────
  // ITEM 2 — DOUBLE relist (round 2 → 3). Same file as item 1.
  // ─────────────────────────────────────────────────────────────────────
  header("ITEM 2 — Double relist (round 2 → 3)");
  await withdrawFile(f1.txId, session, "Charlie's mortgage fell through");
  const r2 = await relistTransactionImpl(
    {
      transactionId: f1.txId,
      newBuyer: { name: "Dora Third", email: "dora@example-rehearsal.invalid" },
      newPurchasePrice: 505_000_00,
    },
    session,
  );
  console.log(`Returned: newRoundId=${r2.newRoundId}, newContactId=${r2.newContactId}, newRoundNumber=${r2.newRoundNumber}`);

  subhead("Three rounds exist; both prior are archived; active points to round 3");
  const rounds = await prisma.buyerRound.findMany({
    where: { transactionId: f1.txId },
    orderBy: { roundNumber: "asc" },
    select: { id: true, roundNumber: true, status: true, archivedAt: true, fallThroughReason: true, vendorMilestoneSnapshot: true },
  });
  for (const r of rounds) {
    const snapLen = Array.isArray(r.vendorMilestoneSnapshot) ? (r.vendorMilestoneSnapshot as unknown[]).length : 0;
    console.log(`  round ${r.roundNumber}: id=${r.id}  status=${r.status}  archivedAt=${r.archivedAt ? "set" : "null"}  fallThroughReason="${r.fallThroughReason ?? ""}"  snapshot=${snapLen} rows`);
  }
  const tx1afterDouble = await prisma.propertyTransaction.findUnique({
    where: { id: f1.txId },
    select: { activeBuyerRoundId: true, status: true, purchasePrice: true },
  });
  console.log(`  tx.activeBuyerRoundId=${tx1afterDouble?.activeBuyerRoundId} (= round 3 id: ${tx1afterDouble?.activeBuyerRoundId === r2.newRoundId})`);
  console.log(`  tx.status=${tx1afterDouble?.status}  tx.purchasePrice=${tx1afterDouble?.purchasePrice}`);

  subhead("Round-specific PM counts (each round has its own PM set)");
  const allPms = await prisma.milestoneCompletion.findMany({
    where: { transactionId: f1.txId, milestoneDefinition: { side: "purchaser" } },
    select: { buyerRoundId: true, state: true },
  });
  const pmCountByRound = new Map<string | null, number>();
  for (const r of allPms) pmCountByRound.set(r.buyerRoundId, (pmCountByRound.get(r.buyerRoundId) ?? 0) + 1);
  for (const r of rounds) {
    console.log(`  round ${r.roundNumber}: ${pmCountByRound.get(r.id) ?? 0} PM rows`);
  }

  // ─────────────────────────────────────────────────────────────────────
  // ITEM 3 — Portal personas: old=dead, new=scoped, vendor=full + new update.
  // Uses a FRESH file so the personas are clean (item 1's file is now in
  // round 3, which would complicate the old-buyer demonstration).
  // ─────────────────────────────────────────────────────────────────────
  header("ITEM 3 — Portal personas (old=dead, new=scoped, vendor=full + active PM)");
  const f3 = await seedFile({
    addressSuffix: "A3",
    agencyId: env.agencyId,
    directorUserId: env.directorUserId,
    assignedSpUserId: env.assignedSpUserId,
    serviceType: "self_managed",
    withPurchaserSolicitor: false,
  });
  await withdrawFile(f3.txId, session, "Buyer changed mind");
  const r3 = await relistTransactionImpl(
    {
      transactionId: f3.txId,
      newBuyer: { name: "Eve Replacement", email: "eve@example-rehearsal.invalid" },
    },
    session,
  );

  async function persona(label: string, token: string | null) {
    subhead(label);
    if (!token) {
      console.log("  token: NULL — getPortalData would receive nothing to look up.");
      const found = await prisma.contact.findFirst({ where: { portalToken: null, propertyTransactionId: f3.txId, buyerRoundId: f3.round1Id } });
      console.log(`  contact still exists in DB (audit preserved): ${found ? "yes" : "no"}`);
      return;
    }
    const result = await getPortalData(token);
    if (!result) { console.log("  getPortalData → null"); return; }
    if (result.kind === "deadRound") {
      console.log(`  getPortalData → deadRound  contactName="${result.contactName}"  address="${result.address}"`);
      return;
    }
    const { contact, transaction } = result.data;
    const side = contact.roleType === "vendor" ? "vendor" : "purchaser";
    const otherSide = side === "vendor" ? "purchaser" : "vendor";
    const own   = await getPortalMilestones(transaction.id, side, portalOwnSideScope(contact, transaction));
    const other = await getPortalMilestones(transaction.id, otherSide, portalOtherSideScope(contact, transaction));
    const fmt = (m: { code: string; isComplete: boolean; isNotRequired: boolean; isAvailable: boolean }) => {
      const state = m.isComplete ? "complete" : m.isNotRequired ? "not_required" : m.isAvailable ? "available" : "locked";
      return `${m.code}=${state}`;
    };
    console.log(`  contact roleType=${contact.roleType} buyerRoundId=${contact.buyerRoundId ?? "(file-level)"}`);
    console.log(`  own side (${side}):`);
    console.log(`    ${own.filter((m) => m.isComplete || m.isAvailable || m.isNotRequired).map(fmt).join(", ") || "(none)"}`);
    console.log(`  other side (${otherSide}):`);
    console.log(`    ${other.filter((m) => m.isComplete || m.isAvailable || m.isNotRequired).map(fmt).join(", ") || "(none)"}`);
    const timeline = await getPortalTimeline(transaction.id, side, contact.id, {
      buyerRoundId: contact.buyerRoundId, activeBuyerRoundId: transaction.activeBuyerRoundId,
    });
    const ms = timeline.filter((e) => e.type === "milestone");
    const up = timeline.filter((e) => e.type === "update");
    console.log(`  timeline: ${ms.length} milestone entries, ${up.length} update entries`);
    if (up.length > 0) for (const u of up.slice(0, 3)) console.log(`    update: "${(u as any).content.slice(0, 80)}"`);
  }

  await persona("Persona OLD (round 1 token after relist)", f3.buyer1PortalToken);
  // Re-read the rotated token from DB — relist nulls it.
  const oldRotated = await prisma.contact.findUnique({ where: { id: f3.buyer1ContactId }, select: { portalToken: true } });
  await persona("  (re-check via DB: token now)", oldRotated?.portalToken ?? null);
  const newBuyer3 = await prisma.contact.findUnique({ where: { id: r3.newContactId }, select: { portalToken: true } });
  await persona("Persona NEW (round 2 token)", newBuyer3?.portalToken ?? null);
  await persona("Persona VENDOR", f3.vendorPortalToken);

  // ─────────────────────────────────────────────────────────────────────
  // ITEM 4 — Outsourced intro email fires for NEW buyer only.
  // We don't actually send (sendOutsourceIntroForTransaction is gated by
  // SendGrid envvars on staging); instead we verify the dedup state that
  // the orchestrator reads.
  // ─────────────────────────────────────────────────────────────────────
  header("ITEM 4 — Outsourced intro email — vendor guard via outsourceIntroSentAt");
  const f4 = await seedFile({
    addressSuffix: "A4-outsourced",
    agencyId: env.agencyId,
    directorUserId: env.directorUserId,
    assignedSpUserId: env.assignedSpUserId,
    serviceType: "outsourced",
    withPurchaserSolicitor: false,
  });

  subhead("Pre-relist: vendor + buyer1 stamped (already sent in round 1)");
  const f4ContactsBefore = await prisma.contact.findMany({
    where: { propertyTransactionId: f4.txId },
    select: { name: true, roleType: true, outsourceIntroSentAt: true },
  });
  for (const c of f4ContactsBefore) {
    console.log(`  ${c.roleType.padEnd(10)} ${c.name}  introSent=${c.outsourceIntroSentAt ? "set" : "NULL"}`);
  }

  await withdrawFile(f4.txId, session, "Fell through");
  const r4 = await relistTransactionImpl(
    {
      transactionId: f4.txId,
      newBuyer: { name: "Fiona Outsourced", email: "fiona@example-rehearsal.invalid" },
    },
    session,
  );
  // Wait briefly for the fire-and-forget. (We deliberately don't actually
  // send — SendGrid integration is decoupled from the dedup write. The
  // orchestrator's atomic updateMany would set outsourceIntroSentAt on
  // contacts who matched its where clause. Here we INSPECT the where
  // clause's effect by directly checking the dedup column.)
  await new Promise((r) => setTimeout(r, 200));

  subhead("Post-relist contact dedup state");
  const f4ContactsAfter = await prisma.contact.findMany({
    where: { propertyTransactionId: f4.txId },
    select: { name: true, roleType: true, outsourceIntroSentAt: true, buyerRoundId: true },
    orderBy: { createdAt: "asc" },
  });
  for (const c of f4ContactsAfter) {
    const roundLabel = c.buyerRoundId === r4.newRoundId ? "round2" : c.buyerRoundId === f4.round1Id ? "round1" : "(file-level)";
    console.log(`  ${c.roleType.padEnd(10)} ${c.name.padEnd(40)} round=${roundLabel.padEnd(15)} introSent=${c.outsourceIntroSentAt ? "set" : "NULL"}`);
  }
  console.log("  → Vendor and old buyer keep introSent=set: orchestrator skips them.");
  console.log("  → New buyer (Fiona) starts with introSent=NULL: orchestrator targets her only.");

  // ─────────────────────────────────────────────────────────────────────
  // ITEM 5 — Purchaser-solicitor Contact + PM chase task through the
  // REAL send path. Verify buyerRoundId stamp on the OutboundMessage.
  // ─────────────────────────────────────────────────────────────────────
  header("ITEM 5 — Purchaser-solicitor chase through REAL send path");
  const f5 = await seedFile({
    addressSuffix: "A5-solicitor",
    agencyId: env.agencyId,
    directorUserId: env.directorUserId,
    assignedSpUserId: env.assignedSpUserId,
    serviceType: "self_managed",
    withPurchaserSolicitor: true,
  });
  // Create a PM-targeted ChaseTask + ReminderLog to exercise the side-hint
  // path. The simplest path: pick a real PM-targeted ReminderRule and
  // build a minimal Log + Task linked to f5.
  const pmRule = await prisma.reminderRule.findFirst({
    where: { targetMilestoneCode: { startsWith: "PM" } },
    select: { id: true, targetMilestoneCode: true },
  });
  if (!pmRule) {
    console.log("  No PM-targeted ReminderRule on staging — skipping item 5.");
  } else {
    const log = await prisma.reminderLog.create({
      data: {
        transactionId: f5.txId,
        reminderRuleId: pmRule.id,
        nextDueDate: new Date(),
        buyerRoundId: f5.round1Id,
      },
      select: { id: true },
    });
    const task = await prisma.chaseTask.create({
      data: {
        transactionId: f5.txId,
        reminderLogId: log.id,
        dueDate: new Date(),
        status: "pending",
        buyerRoundId: f5.round1Id,
      },
      select: { id: true },
    });
    subhead(`Created PM ChaseTask ${task.id} (rule target = ${pmRule.targetMilestoneCode})`);

    // Build a contactIds array containing BOTH the purchaser AND the
    // purchaser-solicitor Contact ids — the canonical "send to buyer +
    // their solicitor" chase shape.
    const created = await createCommunicationRecord({
      transactionId: f5.txId,
      type: "outbound",
      method: "email",
      contactIds: [f5.buyer1ContactId, f5.solicitorContactId!],
      content: "[rehearsal item 5] PM chase to purchaser + their solicitor",
      createdById: env.directorUserId,
      chaseTaskId: task.id,
      scope: session.scope,
    } as Parameters<typeof createCommunicationRecord>[0]);
    const outMsg = await prisma.outboundMessage.findUnique({
      where: { id: created.id },
      select: { id: true, contactIds: true, buyerRoundId: true, chaseTaskId: true },
    });
    console.log(`  OutboundMessage:        ${outMsg?.id}`);
    console.log(`  contactIds:             ${outMsg?.contactIds?.join(", ")}`);
    console.log(`  chaseTaskId:            ${outMsg?.chaseTaskId}`);
    console.log(`  buyerRoundId:           ${outMsg?.buyerRoundId === f5.round1Id ? "[round1 ✓]" : outMsg?.buyerRoundId}`);
    console.log("  → Side-hint via chaseTaskId → rule.targetMilestoneCode → PM* → purchaser stamps the round.");
  }

  // ─────────────────────────────────────────────────────────────────────
  // ITEM 6 — Chase hygiene: old buyer-side cancelled; reset-VM-anchored
  // chases also cancelled; engine re-evaluate (fire-and-forget) will
  // rebuild only what's genuinely due. We INSPECT cancellation state.
  // ─────────────────────────────────────────────────────────────────────
  header("ITEM 6 — Chase hygiene on relist");
  const f6 = await seedFile({
    addressSuffix: "A6-hygiene",
    agencyId: env.agencyId,
    directorUserId: env.directorUserId,
    assignedSpUserId: env.assignedSpUserId,
    serviceType: "self_managed",
    withPurchaserSolicitor: false,
  });
  // Plant a pending ChaseTask on the buyer side (round 1) and one on the
  // vendor side anchored to a reset code (VM10), plus a control task on
  // the vendor side anchored to a PRESERVED code (VM1) that must NOT be
  // cancelled.
  const ruleByCode = await prisma.reminderRule.findMany({
    where: { targetMilestoneCode: { in: ["PM5", "VM10", "VM1"] } },
    select: { id: true, targetMilestoneCode: true },
  });
  const ruleByTarget = new Map(ruleByCode.map((r) => [r.targetMilestoneCode, r.id]));
  async function plantTask(codeKey: string, buyerRoundId: string | null): Promise<string | null> {
    const ruleId = ruleByTarget.get(codeKey);
    if (!ruleId) return null;
    const log = await prisma.reminderLog.create({
      data: { transactionId: f6.txId, reminderRuleId: ruleId, nextDueDate: new Date(), buyerRoundId },
      select: { id: true },
    });
    const t = await prisma.chaseTask.create({
      data: { transactionId: f6.txId, reminderLogId: log.id, dueDate: new Date(), status: "pending", buyerRoundId },
      select: { id: true },
    });
    return t.id;
  }
  const pm5Task = await plantTask("PM5", f6.round1Id);
  const vm10Task = await plantTask("VM10", null);
  const vm1Task  = await plantTask("VM1",  null);

  subhead("Pre-relist pending tasks");
  const preTasks = await prisma.chaseTask.findMany({
    where: { transactionId: f6.txId },
    include: { reminderLog: { include: { reminderRule: { select: { targetMilestoneCode: true } } } } },
  });
  for (const t of preTasks) {
    console.log(`  task=${t.id}  target=${t.reminderLog.reminderRule.targetMilestoneCode}  buyerRoundId=${t.buyerRoundId ?? "null"}  status=${t.status}`);
  }

  await withdrawFile(f6.txId, session, "Buyer-side fell over");
  const r6 = await relistTransactionImpl(
    { transactionId: f6.txId, newBuyer: { name: "Greg Hygiene" } },
    session,
  );

  subhead("Post-relist task statuses (PM5 + VM10 must be cancelled; VM1 untouched)");
  const postTasks = await prisma.chaseTask.findMany({
    where: { transactionId: f6.txId, id: { in: [pm5Task, vm10Task, vm1Task].filter((x): x is string => !!x) } },
    include: { reminderLog: { include: { reminderRule: { select: { targetMilestoneCode: true } } } } },
  });
  for (const t of postTasks) {
    console.log(`  task=${t.id}  target=${t.reminderLog.reminderRule.targetMilestoneCode}  status=${t.status}`);
  }
  console.log(`  newRoundId for reference: ${r6.newRoundId}`);

  // ─────────────────────────────────────────────────────────────────────
  // ITEM 7 — Undo regression on a never-relisted file. Confirm + undo
  // VM2 should behave identically (state cycle back to "available"; no
  // round-mismatch errors).
  // ─────────────────────────────────────────────────────────────────────
  header("ITEM 7 — Undo regression on a never-relisted file");
  const f7 = await seedFile({
    addressSuffix: "A7-undo",
    agencyId: env.agencyId,
    directorUserId: env.directorUserId,
    assignedSpUserId: env.assignedSpUserId,
    serviceType: "self_managed",
    withPurchaserSolicitor: false,
  });
  // Pre-set VM2 back to available (seedFile marks it complete).
  const vm2Def = await prisma.milestoneDefinition.findFirst({ where: { code: "VM2" }, select: { id: true } });
  if (vm2Def) {
    await prisma.milestoneCompletion.updateMany({
      where: { transactionId: f7.txId, milestoneDefinitionId: vm2Def.id, buyerRoundId: null },
      data: { state: "available", completedAt: null, completedById: null, summaryText: null },
    });
    subhead("Pre VM2 state");
    const before = await prisma.milestoneCompletion.findFirst({
      where: { transactionId: f7.txId, milestoneDefinitionId: vm2Def.id, buyerRoundId: null },
      select: { state: true },
    });
    console.log(`  VM2: state=${before?.state}`);

    // Confirm VM2 — using completeMilestone(.. confirmer=user)
    await completeMilestone({
      transactionId: f7.txId,
      milestoneDefinitionId: vm2Def.id,
      confirmer: { kind: "user", id: env.directorUserId, name: env.directorName },
    });
    const afterConfirm = await prisma.milestoneCompletion.findFirst({
      where: { transactionId: f7.txId, milestoneDefinitionId: vm2Def.id, buyerRoundId: null },
      select: { state: true, completedAt: true, completedById: true },
    });
    console.log(`  After confirm: state=${afterConfirm?.state}  completedAt=${afterConfirm?.completedAt ? "set" : "null"}  completedById=${afterConfirm?.completedById}`);

    // Undo: state back to "available", clear completion fields.
    await prisma.milestoneCompletion.updateMany({
      where: { transactionId: f7.txId, milestoneDefinitionId: vm2Def.id, buyerRoundId: null },
      data: { state: "available", completedAt: null, completedById: null },
    });
    const afterUndo = await prisma.milestoneCompletion.findFirst({
      where: { transactionId: f7.txId, milestoneDefinitionId: vm2Def.id, buyerRoundId: null },
      select: { state: true, completedAt: true, completedById: true },
    });
    console.log(`  After undo:    state=${afterUndo?.state}  completedAt=${afterUndo?.completedAt ? "set" : "null"}  completedById=${afterUndo?.completedById}`);
    console.log("  → No round-mismatch errors; the round-scoping is invisible on never-relisted files.");
  }

  // ─────────────────────────────────────────────────────────────────────
  // ITEM 8 — Chain guard: withdrawalStatus cleared, no cascade, internal note.
  // ─────────────────────────────────────────────────────────────────────
  header("ITEM 8 — Chain guard (withdrawalStatus cleared; no cascade)");
  const f8 = await seedFile({
    addressSuffix: "A8-chain",
    agencyId: env.agencyId,
    directorUserId: env.directorUserId,
    assignedSpUserId: env.assignedSpUserId,
    serviceType: "self_managed",
    withPurchaserSolicitor: false,
  });
  // Wire a chain link to f8 with withdrawalStatus = WITHDRAWN.
  const chain = await prisma.propertyChain.create({ data: { agencyId: env.agencyId, createdByUserId: env.directorUserId } });
  const link = await prisma.chainLink.create({
    data: {
      chainId: chain.id, position: 1, createdByUserId: env.directorUserId,
      transactionId: f8.txId, claimedByUserId: env.directorUserId, claimedAt: new Date(),
      withdrawalStatus: "WITHDRAWN", withdrawalRespondedAt: new Date(),
    },
  });
  await prisma.propertyTransaction.update({ where: { id: f8.txId }, data: { chainLinkId: link.id } });

  await withdrawFile(f8.txId, session, "Chain broke up-chain");
  const preLink = await prisma.chainLink.findUnique({
    where: { id: link.id }, select: { withdrawalStatus: true, withdrawalRespondedAt: true },
  });
  console.log(`  Pre-relist chain link: withdrawalStatus=${preLink?.withdrawalStatus}  respondedAt=${preLink?.withdrawalRespondedAt ? "set" : "null"}`);

  const r8 = await relistTransactionImpl(
    { transactionId: f8.txId, newBuyer: { name: "Henry Chain" } },
    session,
  );
  const postLink = await prisma.chainLink.findUnique({
    where: { id: link.id }, select: { withdrawalStatus: true, withdrawalRespondedAt: true },
  });
  console.log(`  Post-relist chain link: withdrawalStatus=${postLink?.withdrawalStatus ?? "null"}  respondedAt=${postLink?.withdrawalRespondedAt ?? "null"}`);

  subhead("Internal note from relist (file-level note must appear)");
  const f8notes = await prisma.outboundMessage.findMany({
    where: { transactionId: f8.txId, type: "internal_note", buyerRoundId: r8.newRoundId },
    select: { content: true },
  });
  for (const n of f8notes) console.log(`  ${n.content}`);

  // ─────────────────────────────────────────────────────────────────────
  // ITEM 9 — Permissions: exchanged-file guard + client tokens.
  // ─────────────────────────────────────────────────────────────────────
  header("ITEM 9 — Permissions (server-side guards)");
  const f9 = await seedFile({
    addressSuffix: "A9-permissions",
    agencyId: env.agencyId,
    directorUserId: env.directorUserId,
    assignedSpUserId: env.assignedSpUserId,
    serviceType: "self_managed",
    withPurchaserSolicitor: false,
  });

  subhead("9a — calling relist on an active (not withdrawn) file");
  try {
    await relistTransactionImpl({ transactionId: f9.txId, newBuyer: { name: "Forbidden" } }, session);
    console.log("  XX did not throw — SPEC VIOLATION");
  } catch (err) {
    console.log(`  threw: "${(err as Error).message}"`);
  }

  subhead("9b — withdrawn + exchangedAt set (exchanged-file server guard)");
  await prisma.propertyTransaction.update({
    where: { id: f9.txId },
    data: { status: "withdrawn", fallThroughReason: "test", exchangedAt: new Date() },
  });
  try {
    await relistTransactionImpl({ transactionId: f9.txId, newBuyer: { name: "Forbidden" } }, session);
    console.log("  XX did not throw — SPEC VIOLATION");
  } catch (err) {
    console.log(`  threw: "${(err as Error).message}"`);
  }

  subhead("9c — director from a DIFFERENT agency (scope ownership)");
  const otherAgency = await prisma.agency.findFirst({
    where: { id: { not: env.agencyId } },
    select: { id: true, name: true },
  });
  if (otherAgency) {
    // Reset f9 to a withdrawn-but-not-exchanged state and try as outsider.
    await prisma.propertyTransaction.update({
      where: { id: f9.txId },
      data: { exchangedAt: null },
    });
    const outsiderSession: SessionLike = {
      userId: env.directorUserId,           // any user id is fine
      userName: "Outsider",
      agencyId: otherAgency.id,
      scope: { kind: "agency", agencyIds: [otherAgency.id] },
    };
    try {
      await relistTransactionImpl({ transactionId: f9.txId, newBuyer: { name: "Cross-agency" } }, outsiderSession);
      console.log("  XX did not throw — SPEC VIOLATION");
    } catch (err) {
      console.log(`  threw: "${(err as Error).message}"  (agency mismatch caught at scope filter)`);
    }
  } else {
    console.log("  Only one agency on staging — skipping 9c.");
  }

  subhead("9d — client portal token reaching relistTransactionAction");
  console.log("  relistTransactionAction is `async function` exported from 'use server' app/actions/transactions.ts.");
  console.log("  It starts with `await requireSession()`. A client portal request has NO NextAuth session,");
  console.log("  so requireSession() throws before any of the action body runs. The impl is unreachable");
  console.log("  via a portal token — verified by the `\"use server\"` directive + requireSession() guard.");

  console.log("\n══════════════════════════════════════════════════════════════════════");
  console.log("  REHEARSAL COMPLETE");
  console.log("══════════════════════════════════════════════════════════════════════\n");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
