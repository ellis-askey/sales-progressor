// B4 verification: digest assembly + enqueue end-to-end.
//
// 1. assembleDigestPayload is pure — runs without DB; verifies shape.
// 2. enqueueClientChaseDigest writes:
//    - OutboundEmailQueue row with recipientContactId set, recipientUserId
//      null, emailType="CLIENT_CHASE", sourceId following the YYYYMMDD
//      pattern, payload containing subject + text + html
//    - ClientChaseState rows for each milestone with chaseCount=1,
//      firstChasedAt + lastChasedAt set to ~now, status="active"
// 3. Re-enqueue same (transaction, contact) on same day: queue dedups
//    (one row, no second insert); ClientChaseState chaseCount STILL
//    increments (intentional — second call would represent a second
//    chase attempt, even if queue rejects the duplicate row). This is a
//    quirk worth documenting and walking past.
// 4. Edge cases — opted-out contact, missing email, missing portalToken
//    all skip enqueue gracefully.
// 5. Suppression at drain: with contact opted out, the drain marks the
//    row "suppressed:unsubscribed" not sent. Already proven by A5; we
//    don't re-prove here.

import { prisma } from "../lib/prisma";
import { assembleDigestPayload, enqueueClientChaseDigest } from "../lib/email/client-chase-digest";

async function main() {
  // ─── 1. Pure assembly test ────────────────────────────────────────────────
  const pure = assembleDigestPayload({
    transaction: { id: "txn_pure", propertyAddress: "42 Test Lane, London, SW1 1AA" },
    contact: { id: "ctc_pure", name: "Trace Vendor", portalToken: "pure-token-abc" },
    milestones: [{ code: "PM5" }, { code: "PM9" }],
    agencyName: "Test Agency",
    recipientSide: "purchaser",
  });
  console.log(`[b4] Pure assembly:`);
  console.log(`     subject: ${pure.subject}`);
  console.log(`     text first 240 chars: ${pure.text.slice(0, 240)}...`);
  console.log(`     respondUrl: ${pure.respondUrl}`);
  console.log(`     unsubscribeUrl present: ${pure.unsubscribeUrl.includes("/api/unsubscribe?t=")}`);
  if (!pure.subject.includes("42 Test Lane")) {
    console.error(`[b4] FAIL: subject missing address`);
    process.exit(1);
  }
  if (!pure.text.includes("Trace") || !pure.respondUrl.includes("pure-token-abc")) {
    console.error(`[b4] FAIL: text/respondUrl missing fixture markers`);
    process.exit(1);
  }
  if (pure.text.includes("—") || pure.html.includes("—")) {
    console.error(`[b4] FAIL: em-dash in DRAFT copy (house style violation)`);
    process.exit(1);
  }
  console.log(`[b4] pure assembly ✓ (subject + text + respondUrl + unsubscribeUrl + no em-dashes)`);

  // ─── 2. Full enqueue end-to-end with fixture ──────────────────────────────
  let agency = await prisma.agency.findFirst({ where: { name: "TraceHarnessAgency" } });
  if (!agency) {
    agency = await prisma.agency.create({ data: { name: "TraceHarnessAgency", isInternal: true } });
  }
  let agent = await prisma.user.findFirst({ where: { email: "trace-agent@example.test" } });
  if (!agent) {
    agent = await prisma.user.create({
      data: {
        name: "Trace Agent",
        email: "trace-agent@example.test",
        role: "director",
        agencyId: agency.id,
        firmName: "TraceHarnessAgency",
      },
    });
  }
  // Clean any prior CLIENT_CHASE queue rows for this agent/contacts to keep idempotent
  await prisma.outboundEmailQueue.deleteMany({ where: { emailType: "CLIENT_CHASE" } });

  const transaction = await prisma.propertyTransaction.create({
    data: {
      propertyAddress: `B4 verify ${Date.now()}, B4 1AA`,
      agencyId: agency.id,
      agentUserId: agent.id,
      assignedUserId: agent.id,
      purchaseType: "cash_buyer",
      tenure: "freehold",
      serviceType: "self_managed",
      progressedBy: "agent",
    },
  });
  const contact = await prisma.contact.create({
    data: {
      propertyTransactionId: transaction.id,
      name: "B4 Verify Contact",
      email: "b4-verify@example.test",
      roleType: "vendor",
      portalToken: `b4-verify-${transaction.id}`,
    },
  });
  console.log(`[b4] fixture tx ${transaction.id}, contact ${contact.id}`);

  // First enqueue — 2 milestones
  const result1 = await enqueueClientChaseDigest({
    transactionId: transaction.id,
    contactId: contact.id,
    milestoneCodes: ["PM5", "PM9"],
  });
  console.log(`[b4] first enqueue: enqueued=${result1.enqueued} rowId=${result1.rowId}`);
  if (!result1.enqueued || !result1.rowId) {
    console.error(`[b4] FAIL: first enqueue should have succeeded`);
    process.exit(1);
  }

  // Inspect queue row
  const row = await prisma.outboundEmailQueue.findUnique({
    where: { id: result1.rowId },
    select: {
      emailType: true, sourceId: true, recipientEmail: true,
      recipientUserId: true, recipientContactId: true, payload: true, scheduledFor: true,
    },
  });
  if (!row) { console.error(`[b4] FAIL: queue row not found`); process.exit(1); }
  console.log(`[b4] queue row:`);
  console.log(`     emailType=${row.emailType} sourceId=${row.sourceId}`);
  console.log(`     recipientEmail=${row.recipientEmail} userId=${row.recipientUserId} contactId=${row.recipientContactId}`);
  console.log(`     scheduledFor=${row.scheduledFor.toISOString()}`);
  if (row.emailType !== "CLIENT_CHASE") { console.error(`[b4] FAIL: emailType`); process.exit(1); }
  if (row.recipientUserId !== null) { console.error(`[b4] FAIL: recipientUserId should be null`); process.exit(1); }
  if (row.recipientContactId !== contact.id) { console.error(`[b4] FAIL: recipientContactId mismatch`); process.exit(1); }
  if (!row.sourceId.startsWith(`${transaction.id}:${contact.id}:`)) {
    console.error(`[b4] FAIL: sourceId pattern wrong: ${row.sourceId}`);
    process.exit(1);
  }
  // Payload contains subject + text + html
  const payload = row.payload as Record<string, unknown>;
  if (typeof payload.subject !== "string" || typeof payload.text !== "string" || typeof payload.html !== "string") {
    console.error(`[b4] FAIL: payload shape`);
    process.exit(1);
  }
  console.log(`[b4] payload subject: ${payload.subject}`);

  // ClientChaseState rows
  const states = await prisma.clientChaseState.findMany({
    where: { transactionId: transaction.id, contactId: contact.id },
    orderBy: { milestoneCode: "asc" },
    select: { milestoneCode: true, chaseCount: true, firstChasedAt: true, lastChasedAt: true, status: true },
  });
  console.log(`[b4] ClientChaseState rows after 1st enqueue:`, states);
  if (states.length !== 2) { console.error(`[b4] FAIL: expected 2 ClientChaseState rows`); process.exit(1); }
  for (const s of states) {
    if (s.chaseCount !== 1) { console.error(`[b4] FAIL: chaseCount expected 1, got ${s.chaseCount} for ${s.milestoneCode}`); process.exit(1); }
    if (!s.firstChasedAt || !s.lastChasedAt) { console.error(`[b4] FAIL: chase dates missing`); process.exit(1); }
    if (s.status !== "active") { console.error(`[b4] FAIL: status not active`); process.exit(1); }
  }
  console.log(`[b4] ClientChaseState 1st-enqueue state ✓`);

  // ─── 3. Re-enqueue same day → queue dedups but chaseCount bumps ──────────
  // (Behaviour worth surfacing: same-day re-enqueue silently NO-OPs at the
  // queue layer due to the partial unique, but ClientChaseState upsert
  // still increments chaseCount. In production, the cron should only fire
  // once per (tx, contact, day) so this scenario shouldn't actually
  // happen, but documenting the property defensively.)
  const result2 = await enqueueClientChaseDigest({
    transactionId: transaction.id,
    contactId: contact.id,
    milestoneCodes: ["PM5", "PM9"],
  });
  console.log(`[b4] second enqueue (same day): enqueued=${result2.enqueued} rowId=${result2.rowId}`);

  const rowCount = await prisma.outboundEmailQueue.count({
    where: { emailType: "CLIENT_CHASE", sourceId: row.sourceId },
  });
  console.log(`[b4] queue row count after 2nd attempt: ${rowCount} (expect 1 — dedup)`);
  if (rowCount !== 1) { console.error(`[b4] FAIL: dedup did not hold`); process.exit(1); }

  const statesAfter2 = await prisma.clientChaseState.findMany({
    where: { transactionId: transaction.id, contactId: contact.id },
    orderBy: { milestoneCode: "asc" },
    select: { chaseCount: true, milestoneCode: true },
  });
  console.log(`[b4] ClientChaseState chaseCount after 2nd attempt:`, statesAfter2);
  for (const s of statesAfter2) {
    if (s.chaseCount !== 2) {
      console.error(`[b4] FAIL: chaseCount expected 2 after 2nd attempt, got ${s.chaseCount} for ${s.milestoneCode}`);
      process.exit(1);
    }
  }
  console.log(`[b4] dedup + chaseCount-bump invariant ✓ (queue=1 row, chaseCount=2)`);

  // ─── 4. Edge cases ───────────────────────────────────────────────────────
  // Opted-out contact → no enqueue
  await prisma.contact.update({ where: { id: contact.id }, data: { unsubscribedAt: new Date() } });
  const optedOut = await enqueueClientChaseDigest({
    transactionId: transaction.id,
    contactId: contact.id,
    milestoneCodes: ["PM8"],
  });
  console.log(`[b4] opted-out contact → enqueued=${optedOut.enqueued} (expect false)`);
  if (optedOut.enqueued) { console.error(`[b4] FAIL: opted-out contact should not enqueue`); process.exit(1); }
  // Reset
  await prisma.contact.update({ where: { id: contact.id }, data: { unsubscribedAt: null } });

  // Missing email → no enqueue
  await prisma.contact.update({ where: { id: contact.id }, data: { email: null } });
  const noEmail = await enqueueClientChaseDigest({
    transactionId: transaction.id,
    contactId: contact.id,
    milestoneCodes: ["PM8"],
  });
  console.log(`[b4] missing-email contact → enqueued=${noEmail.enqueued} (expect false)`);
  if (noEmail.enqueued) { console.error(`[b4] FAIL: missing-email should not enqueue`); process.exit(1); }
  await prisma.contact.update({ where: { id: contact.id }, data: { email: "b4-verify@example.test" } });

  // Missing portalToken → no enqueue
  await prisma.contact.update({ where: { id: contact.id }, data: { portalToken: null } });
  const noToken = await enqueueClientChaseDigest({
    transactionId: transaction.id,
    contactId: contact.id,
    milestoneCodes: ["PM8"],
  });
  console.log(`[b4] missing-portalToken contact → enqueued=${noToken.enqueued} (expect false)`);
  if (noToken.enqueued) { console.error(`[b4] FAIL: missing-portalToken should not enqueue`); process.exit(1); }
  await prisma.contact.update({ where: { id: contact.id }, data: { portalToken: `b4-verify-${transaction.id}` } });

  // Empty milestone list → no enqueue
  const empty = await enqueueClientChaseDigest({
    transactionId: transaction.id,
    contactId: contact.id,
    milestoneCodes: [],
  });
  console.log(`[b4] empty milestone list → enqueued=${empty.enqueued} (expect false)`);
  if (empty.enqueued) { console.error(`[b4] FAIL: empty list should not enqueue`); process.exit(1); }

  // ─── Teardown ────────────────────────────────────────────────────────────
  await prisma.outboundEmailQueue.deleteMany({ where: { emailType: "CLIENT_CHASE", recipientContactId: contact.id } });
  await prisma.propertyTransaction.delete({ where: { id: transaction.id } });
  console.log(`[b4] torn down`);

  await prisma.$disconnect();
  console.log(`[b4] all checks passed`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
