/**
 * scripts/reset-db.ts
 *
 * Partial database reset for pre-launch cleanup.
 *
 * Keeps exactly 6 accounts:
 *   taylor@akeman-residential.co.uk  — keep user + agency, wipe transactions
 *   ayub@oplah.co.uk                 — keep user + agency, wipe transactions
 *   rachel@whitfieldhunt.co.uk       — keep user + agency + ALL transaction data
 *   ellisaskey@googlemail.com        — keep user (+ their agency, clean)
 *   ellis@thesalesprogressor.co.uk   — keep user (+ their agency, clean)
 *   ellisaskey+superadmin@googlemail.com — keep user (superadmin, no agency)
 *
 * Deletes: all other users, all other agencies, all transactions for clean agencies,
 *          all solicitor firms, all broker firms.
 * Preserves: ReminderRule, MilestoneDefinition, rachel's full transaction data.
 *
 * Usage (dry run — default, safe to run any time):
 *   npx ts-node --compiler-options "{\"module\":\"commonjs\"}" scripts/reset-db.ts
 *
 * Usage (live — IRREVERSIBLE):
 *   DRY_RUN=false npx ts-node --compiler-options "{\"module\":\"commonjs\"}" scripts/reset-db.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const DRY_RUN = process.env.DRY_RUN !== "false";

const KEEP_EMAILS = [
  "taylor@akeman-residential.co.uk",
  "ayub@oplah.co.uk",
  "rachel@whitfieldhunt.co.uk",
  "tom@whitfieldhunt.co.uk",
  "danny.bailey@exp.uk.com",
  "ellisaskey@googlemail.com",
  "ellis@thesalesprogressor.co.uk",
  "ellisaskey+superadmin@googlemail.com",
];

// These users' agencies are fully preserved (users + agencies + all transaction data)
const FULL_KEEP_EMAILS = new Set([
  "rachel@whitfieldhunt.co.uk",
  "danny.bailey@exp.uk.com",
]);

async function main() {
  console.log(DRY_RUN
    ? "DRY RUN — no changes will be made. Set DRY_RUN=false to execute."
    : "⚠  LIVE RUN — changes will be applied to Supabase NOW.");
  console.log("");

  // ── Resolve keep users ────────────────────────────────────────────────────

  const keepUsers = await prisma.user.findMany({
    where: { email: { in: KEEP_EMAILS } },
    select: { id: true, email: true, name: true, agencyId: true },
  });

  for (const email of KEEP_EMAILS) {
    if (!keepUsers.find(u => u.email === email)) {
      console.warn(`  WARNING: keep-email not found in DB: ${email}`);
    }
  }

  const fullKeepUsers = keepUsers.filter(u => FULL_KEEP_EMAILS.has(u.email));
  const fullKeepAgencyIds = new Set(
    fullKeepUsers.map(u => u.agencyId).filter((id): id is string => Boolean(id))
  );

  const allKeepAgencyIds = [...new Set(
    keepUsers.map(u => u.agencyId).filter((id): id is string => Boolean(id))
  )];

  // Agencies we're keeping but wiping transactions for (all keep-agencies except fully-preserved ones)
  const cleanAgencyIds = allKeepAgencyIds.filter(id => !fullKeepAgencyIds.has(id));

  // ── Compute what will be deleted ──────────────────────────────────────────

  const cleanTxRecords = cleanAgencyIds.length > 0
    ? await prisma.propertyTransaction.findMany({
        where: { agencyId: { in: cleanAgencyIds } },
        select: { id: true, propertyAddress: true },
      })
    : [];

  const deleteAgencies = await prisma.agency.findMany({
    where: { id: { notIn: allKeepAgencyIds } },
    select: { id: true, name: true },
  });
  const deleteAgencyIds = deleteAgencies.map(a => a.id);

  const deleteTxRecords = deleteAgencyIds.length > 0
    ? await prisma.propertyTransaction.findMany({
        where: { agencyId: { in: deleteAgencyIds } },
        select: { id: true, propertyAddress: true },
      })
    : [];

  const deleteUsers = await prisma.user.findMany({
    where: { email: { notIn: KEEP_EMAILS } },
    select: { id: true, email: true, name: true },
  });
  const deleteUserIds = deleteUsers.map(u => u.id);

  const solicitorFirmCount = await prisma.solicitorFirm.count();
  const brokerFirmCount = await prisma.brokerFirm.count();

  // ── Summary (always printed) ──────────────────────────────────────────────

  console.log("=== KEEP ===");
  for (const u of keepUsers) {
    const isFullKeep = FULL_KEEP_EMAILS.has(u.email);
    const note = u.agencyId
      ? isFullKeep
        ? "agency preserved with all data"
        : `agency kept, ${cleanTxRecords.filter(t => cleanAgencyIds.includes(u.agencyId!)).length} transactions wiped`
      : "no agency (superadmin)";
    console.log(`  ${u.email} (${u.name ?? "—"}) — ${note}`);
  }

  console.log("");
  console.log(`=== WIPE TRANSACTIONS (${cleanAgencyIds.length} clean agencies) ===`);
  for (const tx of cleanTxRecords) {
    console.log(`  ${tx.propertyAddress ?? tx.id}`);
  }

  console.log("");
  console.log(`=== DELETE AGENCIES (${deleteAgencies.length}) ===`);
  for (const a of deleteAgencies) console.log(`  ${a.name}`);

  console.log("");
  console.log(`=== DELETE TRANSACTIONS (from deleted agencies: ${deleteTxRecords.length}) ===`);
  for (const tx of deleteTxRecords) {
    console.log(`  ${tx.propertyAddress ?? tx.id}`);
  }

  console.log("");
  console.log(`=== DELETE USERS (${deleteUsers.length}) ===`);
  for (const u of deleteUsers) {
    console.log(`  ${u.email ?? u.id} (${u.name ?? "—"})`);
  }

  console.log("");
  console.log(`=== DELETE GLOBAL ===`);
  console.log(`  Solicitor firms: ${solicitorFirmCount}`);
  console.log(`  Broker firms: ${brokerFirmCount}`);
  console.log(`  Feedback submissions: all`);
  console.log("");

  if (DRY_RUN) {
    console.log("DRY RUN complete. Review above, then run with DRY_RUN=false to apply.");
    return;
  }

  // ── Execute ───────────────────────────────────────────────────────────────

  console.log("Executing...");

  const allPurgeTxIds = [
    ...cleanTxRecords.map(t => t.id),
    ...deleteTxRecords.map(t => t.id),
  ];

  // 1. Transaction data (FK-safe order — note: ManualTask cascades from PropertyTransaction)
  if (allPurgeTxIds.length > 0) {
    await purgeTxData(allPurgeTxIds);
    console.log(`  ✓ ${allPurgeTxIds.length} transactions and all related records purged`);
  }

  // 2. Property chains (agency-level, must go before users because createdByUserId has NoAction)
  const chainAgencyIds = [...cleanAgencyIds, ...deleteAgencyIds];
  if (chainAgencyIds.length > 0) {
    await prisma.propertyChain.deleteMany({ where: { agencyId: { in: chainAgencyIds } } });
    console.log("  ✓ Property chains removed");
  }

  // 3. Manual tasks for non-rachel agencies + by deleted users (createdById NoAction)
  if (chainAgencyIds.length > 0) {
    await prisma.manualTask.deleteMany({ where: { agencyId: { in: chainAgencyIds } } });
  }
  if (deleteUserIds.length > 0) {
    // Safety net: any remaining tasks created by users being deleted (e.g. in rachel's agency)
    await prisma.manualTask.deleteMany({ where: { createdById: { in: deleteUserIds } } });
  }
  console.log("  ✓ Manual tasks removed");

  // 4. Verified domains (createdByUserId has NoAction — must delete before users)
  await prisma.verifiedDomain.deleteMany({
    where: fullKeepAgencyIds.size > 0
      ? { agencyId: { notIn: [...fullKeepAgencyIds] } }
      : {},
  });
  console.log("  ✓ Verified domains removed");

  // 5. User auth records
  if (deleteUserIds.length > 0) {
    await prisma.userVerifiedEmail.deleteMany({ where: { userId: { in: deleteUserIds } } });
    await prisma.session.deleteMany({ where: { userId: { in: deleteUserIds } } });
    await prisma.account.deleteMany({ where: { userId: { in: deleteUserIds } } });
    console.log("  ✓ Auth records removed");
  }

  // 6. Agency-level records (before agency deletion)
  await prisma.agencyRecommendedSolicitor.deleteMany(); // all — solicitorFirm is being wiped
  if (deleteAgencyIds.length > 0) {
    await prisma.agencyPreferredBroker.deleteMany({ where: { agencyId: { in: deleteAgencyIds } } });
  }
  console.log("  ✓ Agency-level records removed");

  // 7. Delete users not in keep list
  if (deleteUserIds.length > 0) {
    await prisma.user.deleteMany({ where: { id: { in: deleteUserIds } } });
    console.log(`  ✓ ${deleteUserIds.length} users deleted`);
  }

  // 8. Delete agencies not in keep list (DirectorInvitation + NegotiatorInvitation cascade)
  if (deleteAgencyIds.length > 0) {
    await prisma.agency.deleteMany({ where: { id: { in: deleteAgencyIds } } });
    console.log(`  ✓ ${deleteAgencies.length} agencies deleted`);
  }

  // 9. Global cleanup
  await prisma.solicitorContact.deleteMany();
  await prisma.solicitorFirm.deleteMany();
  console.log("  ✓ Solicitor firms wiped");

  await prisma.brokerFirm.deleteMany(); // BrokerContact cascades via onDelete: Cascade
  console.log("  ✓ Broker firms wiped");

  await prisma.feedbackSubmission.deleteMany();

  console.log("");
  console.log("Reset complete.");
  console.log(`  ${keepUsers.length} accounts kept across ${allKeepAgencyIds.length} agencies.`);
  if (fullKeepAgencyIds.size > 0) {
    console.log(`  Full data preserved for: ${[...FULL_KEEP_EMAILS].join(", ")}`);
  }
}

async function purgeTxData(txIds: string[]) {
  // Delete in FK-safe order. Models with onDelete: Cascade from PropertyTransaction
  // are included explicitly for clarity even though they'd auto-delete.
  await prisma.portalMessage.deleteMany({ where: { transactionId: { in: txIds } } });
  await prisma.transactionDocument.deleteMany({ where: { transactionId: { in: txIds } } });
  await prisma.transactionFlag.deleteMany({ where: { transactionId: { in: txIds } } });
  await prisma.outboundMessage.deleteMany({ where: { transactionId: { in: txIds } } });
  await prisma.chaseTask.deleteMany({ where: { transactionId: { in: txIds } } });
  await prisma.reminderLog.deleteMany({ where: { transactionId: { in: txIds } } });
  await prisma.milestoneCompletion.deleteMany({ where: { transactionId: { in: txIds } } });
  await prisma.transactionNote.deleteMany({ where: { transactionId: { in: txIds } } });
  await prisma.contact.deleteMany({ where: { propertyTransactionId: { in: txIds } } }); // cascades PortalPushSubscription
  await prisma.priceHistory.deleteMany({ where: { transactionId: { in: txIds } } });
  // ManualTask: optional transactionId with onDelete: Cascade — handled by cascade
  await prisma.propertyTransaction.deleteMany({ where: { id: { in: txIds } } }); // OutsourcedAssignmentNotification cascades
}

main()
  .catch((err) => { console.error(err); process.exit(1); })
  .finally(() => prisma.$disconnect());
