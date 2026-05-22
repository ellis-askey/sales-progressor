// A3 verification: HMAC roundtrip for Contact unsubscribe.
//
// Steps:
//   1. Create a fresh test contact on a fresh test transaction.
//   2. Generate a contact:{id} token via the signing util.
//   3. Verify the token decodes (signature passes).
//   4. Call the endpoint logic inline — same prisma.contact.updateMany the
//      route handler runs. (We can't easily HTTP the route from here without
//      a running server; we exercise the SAME query that the route does.)
//   5. Confirm Contact.unsubscribedAt is now set.
//   6. Confirm isContactEmailSuppressed returns true.
//   7. Run step 4 again — the null-guard should make this a no-op (idempotent).
//      Confirm unsubscribedAt's value did not change.
//   8. Also exercise a bad token (signature mismatch) — verify returns null.
//   9. Tear down the fixture.

import { prisma } from "../lib/prisma";
import {
  generateUnsubscribeToken,
  verifyUnsubscribeToken,
  buildContactUnsubscribeUrl,
} from "../lib/email/unsubscribe";
import { isContactEmailSuppressed } from "../lib/email";

async function main() {
  // Ensure secret is set so the HMAC signing actually signs with something
  if (!process.env.UNSUBSCRIBE_SECRET) {
    console.error("UNSUBSCRIBE_SECRET not set in env; this test would generate empty signatures.");
    process.exit(1);
  }

  // 1. Build a fresh fixture
  let agency = await prisma.agency.findFirst({ where: { name: "TraceHarnessAgency" } });
  if (!agency) {
    agency = await prisma.agency.create({ data: { name: "TraceHarnessAgency", isInternal: true } });
  }
  let agentUser = await prisma.user.findFirst({ where: { email: "trace-agent@example.test" } });
  if (!agentUser) {
    agentUser = await prisma.user.create({
      data: {
        name: "Trace Agent",
        email: "trace-agent@example.test",
        role: "director",
        agencyId: agency.id,
        firmName: "TraceHarnessAgency",
      },
    });
  }
  const transaction = await prisma.propertyTransaction.create({
    data: {
      propertyAddress: `A3 verify ${Date.now()}, A3 1AA`,
      agencyId: agency.id,
      agentUserId: agentUser.id,
      assignedUserId: agentUser.id,
      purchaseType: "cash_buyer",
      tenure: "freehold",
      serviceType: "self_managed",
      progressedBy: "agent",
    },
  });
  const contact = await prisma.contact.create({
    data: {
      propertyTransactionId: transaction.id,
      name: "A3 Verify Contact",
      email: "a3-verify@example.test",
      roleType: "vendor",
      portalToken: `a3-verify-${transaction.id}`,
    },
  });

  console.log(`[a3] fixture contact ${contact.id}`);

  // 2. Generate signed token
  const subject = `contact:${contact.id}`;
  const token = generateUnsubscribeToken(subject);
  console.log(`[a3] token: ${token.slice(0, 24)}...${token.slice(-8)} (length=${token.length})`);

  // 3. Verify decodes
  const decoded = verifyUnsubscribeToken(token);
  console.log(`[a3] verifyUnsubscribeToken decoded: ${decoded === subject ? "OK (matches)" : `FAIL (got ${decoded})`}`);
  if (decoded !== subject) process.exit(1);

  // Demo the URL builder
  const url = buildContactUnsubscribeUrl(contact.id);
  console.log(`[a3] buildContactUnsubscribeUrl: ${url}`);

  // 4. Initial state: unsubscribedAt should be null
  const before = await prisma.contact.findUnique({
    where: { id: contact.id },
    select: { unsubscribedAt: true },
  });
  console.log(`[a3] before endpoint:  unsubscribedAt=${before?.unsubscribedAt ?? "null"}`);

  // 5. Exercise the endpoint's logic inline (same updateMany)
  const firstHit = await prisma.contact.updateMany({
    where: { id: contact.id, unsubscribedAt: null },
    data: { unsubscribedAt: new Date() },
  });
  console.log(`[a3] first hit:  rows updated = ${firstHit.count} (expect 1)`);

  // 6. Now unsubscribedAt is set
  const after1 = await prisma.contact.findUnique({
    where: { id: contact.id },
    select: { unsubscribedAt: true },
  });
  console.log(`[a3] after 1st hit:    unsubscribedAt=${after1?.unsubscribedAt?.toISOString() ?? "null"}`);

  // 7. Helper should now report suppressed
  const suppressed = await isContactEmailSuppressed(contact.id);
  console.log(`[a3] isContactEmailSuppressed: ${suppressed} (expect true)`);

  // 8. Idempotency — re-hit; updateMany WHERE filters out already-set rows
  const secondHit = await prisma.contact.updateMany({
    where: { id: contact.id, unsubscribedAt: null },
    data: { unsubscribedAt: new Date() },
  });
  console.log(`[a3] second hit: rows updated = ${secondHit.count} (expect 0)`);

  const after2 = await prisma.contact.findUnique({
    where: { id: contact.id },
    select: { unsubscribedAt: true },
  });
  const same = after1?.unsubscribedAt?.toISOString() === after2?.unsubscribedAt?.toISOString();
  console.log(`[a3] timestamp unchanged on re-hit: ${same ? "OK" : "FAIL"} (idempotent)`);

  // 9. Bad token — signature mismatch
  const tampered = token.slice(0, -2) + (token.endsWith("aa") ? "bb" : "aa");
  const badDecoded = verifyUnsubscribeToken(tampered);
  console.log(`[a3] tampered token:   verifyUnsubscribeToken = ${badDecoded ?? "null"} (expect null)`);
  if (badDecoded !== null) {
    console.error("[a3] FAIL: tampered token verified");
    process.exit(1);
  }

  // 10. Wrong subject prefix — should still parse but the endpoint would reject
  const malformedSubject = "garbage:nope";
  const malformedToken = generateUnsubscribeToken(malformedSubject);
  const malformedDecoded = verifyUnsubscribeToken(malformedToken);
  console.log(`[a3] malformed-subject token decodes to: ${malformedDecoded} (route handler invalid() branch handles this)`);

  // 11. Teardown
  await prisma.propertyTransaction.delete({ where: { id: transaction.id } });
  console.log(`[a3] torn down`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
