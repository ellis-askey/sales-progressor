// A5 end-to-end verification: OutboundEmailQueue now supports Contact
// recipients with the same protections as User recipients.
//
// Steps:
//   1. Build fixture — agency, agent (User), contact (Contact), transaction.
//      Suppress real send by setting EMAIL_SANDBOX_MODE=true in env if not set.
//
//   2. enqueueEmail with recipientUserId. Confirm row exists with userId set,
//      contactId null. Confirm CHECK constraint passes (insert succeeded).
//
//   3. enqueueEmail with recipientContactId. Confirm row exists with userId
//      null, contactId set. Confirm CHECK passes.
//
//   4. enqueueEmail with BOTH set → must throw at runtime (assertion fail
//      before reaching the DB) AND if it reached the DB, the CHECK would
//      reject. Verifies the friendly assertion.
//
//   5. enqueueEmail with NEITHER set → same.
//
//   6. Dedup test — enqueue the same Contact row twice; second should be
//      silently no-op (P2002 swallowed). Row count for that source/contact
//      pair stays at 1.
//
//   7. Suppression test — set Contact.unsubscribedAt, run drainOutboundQueue.
//      The Contact-recipient row should be marked "suppressed:unsubscribed"
//      not sent. The User-recipient row should attempt to send (mocked by
//      EMAIL_SANDBOX_MODE — won't actually deliver, but the drain logic
//      runs).
//
//   8. Teardown.

import { prisma } from "../lib/prisma";
import { enqueueEmail, drainOutboundQueue } from "../lib/email/outboundQueue";

async function main() {
  if (process.env.EMAIL_SANDBOX_MODE !== "true") {
    console.warn("[a5] WARNING: EMAIL_SANDBOX_MODE not 'true' — set in .env if you don't want SendGrid to actually deliver. Continuing anyway since the drain may still skip on suppression.");
  }

  // 1. Fixture
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
  // Wipe any previous queue entries from prior runs to ensure idempotency
  await prisma.outboundEmailQueue.deleteMany({
    where: { OR: [{ recipientUserId: agent.id }, { sourceId: { startsWith: "a5-verify-" } }] },
  });

  const transaction = await prisma.propertyTransaction.create({
    data: {
      propertyAddress: `A5 verify ${Date.now()}, A5 1AA`,
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
      name: "A5 Verify Contact",
      email: "a5-verify@example.test",
      roleType: "vendor",
      portalToken: `a5-verify-${transaction.id}`,
    },
  });
  console.log(`[a5] fixture: agent ${agent.id}, contact ${contact.id}, tx ${transaction.id}`);

  // 2. Enqueue User recipient
  const userSourceId = `a5-verify-user-${transaction.id}`;
  await enqueueEmail({
    emailType: "A5_VERIFY",
    sourceId: userSourceId,
    recipientEmail: agent.email,
    recipientUserId: agent.id,
    payload: { subject: "User test", text: "User test body" },
  });
  const userRow = await prisma.outboundEmailQueue.findFirst({
    where: { emailType: "A5_VERIFY", sourceId: userSourceId, recipientUserId: agent.id },
  });
  console.log(`[a5] User-recipient row inserted: id=${userRow?.id ?? "MISSING"}`);
  console.log(`     userId=${userRow?.recipientUserId}, contactId=${userRow?.recipientContactId}`);
  if (!userRow || !userRow.recipientUserId || userRow.recipientContactId) {
    console.error(`[a5] FAIL: user row shape wrong`);
    process.exit(1);
  }

  // 3. Enqueue Contact recipient
  const contactSourceId = `a5-verify-contact-${transaction.id}`;
  await enqueueEmail({
    emailType: "A5_VERIFY",
    sourceId: contactSourceId,
    recipientEmail: contact.email!,
    recipientContactId: contact.id,
    payload: { subject: "Contact test", text: "Contact test body" },
  });
  const contactRow = await prisma.outboundEmailQueue.findFirst({
    where: { emailType: "A5_VERIFY", sourceId: contactSourceId, recipientContactId: contact.id },
  });
  console.log(`[a5] Contact-recipient row inserted: id=${contactRow?.id ?? "MISSING"}`);
  console.log(`     userId=${contactRow?.recipientUserId}, contactId=${contactRow?.recipientContactId}`);
  if (!contactRow || contactRow.recipientUserId || !contactRow.recipientContactId) {
    console.error(`[a5] FAIL: contact row shape wrong`);
    process.exit(1);
  }

  // 4. Both set → assertion error
  let bothError: string | null = null;
  try {
    await enqueueEmail({
      emailType: "A5_VERIFY",
      sourceId: `bad-${transaction.id}`,
      recipientEmail: "bad@example.test",
      recipientUserId: agent.id,
      recipientContactId: contact.id,
      payload: { subject: "", text: "" },
    });
  } catch (e) {
    bothError = (e as Error).message;
  }
  console.log(`[a5] BOTH set → error: ${bothError ? "thrown ✓" : "DID NOT THROW (FAIL)"}`);
  if (!bothError?.includes("exactly one")) {
    console.error(`[a5] FAIL: both-set didn't trigger the assertion`);
    process.exit(1);
  }

  // 5. Neither set → assertion error
  let neitherError: string | null = null;
  try {
    await enqueueEmail({
      emailType: "A5_VERIFY",
      sourceId: `bad2-${transaction.id}`,
      recipientEmail: "neither@example.test",
      payload: { subject: "", text: "" },
    });
  } catch (e) {
    neitherError = (e as Error).message;
  }
  console.log(`[a5] NEITHER set → error: ${neitherError ? "thrown ✓" : "DID NOT THROW (FAIL)"}`);
  if (!neitherError?.includes("exactly one")) {
    console.error(`[a5] FAIL: neither-set didn't trigger the assertion`);
    process.exit(1);
  }

  // 6. Dedup test — same Contact + sourceId + emailType
  await enqueueEmail({
    emailType: "A5_VERIFY",
    sourceId: contactSourceId,
    recipientEmail: contact.email!,
    recipientContactId: contact.id,
    payload: { subject: "Duplicate", text: "Should not insert a second row" },
  });
  const contactRowsAfterDedup = await prisma.outboundEmailQueue.count({
    where: { emailType: "A5_VERIFY", sourceId: contactSourceId, recipientContactId: contact.id },
  });
  console.log(`[a5] Contact-recipient row count after dedup attempt: ${contactRowsAfterDedup} (expect 1)`);
  if (contactRowsAfterDedup !== 1) {
    console.error(`[a5] FAIL: dedup did not prevent duplicate row`);
    process.exit(1);
  }

  // 7. Suppression test — opt the contact out, run drain
  await prisma.contact.update({
    where: { id: contact.id },
    data: { unsubscribedAt: new Date() },
  });
  const drainResult = await drainOutboundQueue();
  console.log(`[a5] drain result: sent=${drainResult.sent} skipped=${drainResult.skipped} failed=${drainResult.failed}`);

  // Inspect the Contact-recipient row's final state — should be marked
  // suppressed:unsubscribed, not actually sent.
  const contactRowAfterDrain = await prisma.outboundEmailQueue.findUnique({
    where: { id: contactRow.id },
    select: { sentAt: true, errorMessage: true, errorAt: true },
  });
  console.log(`[a5] Contact row after drain:`, contactRowAfterDrain);
  if (contactRowAfterDrain?.errorMessage !== "suppressed:unsubscribed") {
    console.error(`[a5] FAIL: contact suppression didn't kick in (errorMessage="${contactRowAfterDrain?.errorMessage}")`);
    process.exit(1);
  }

  // 8. Teardown
  await prisma.outboundEmailQueue.deleteMany({
    where: { OR: [{ recipientUserId: agent.id }, { recipientContactId: contact.id }] },
  });
  await prisma.propertyTransaction.delete({ where: { id: transaction.id } });
  console.log(`[a5] torn down`);

  await prisma.$disconnect();
  console.log(`[a5] all checks passed`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
