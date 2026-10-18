/**
 * Demo seed (staging): put an ESCALATED "get enquiries raised" chase on one of
 * Emily Chen's (emily@hartwellpartners.co.uk) active self-managed files, so all
 * three enquiries fixes are visible in one place:
 *   1. Timeline shows one row per nudge (3 distinct ChaseSend rows here).
 *   2. Auto-nudging stopped at escalation (escalatedAt set, closedAt null).
 *   3. Work-queue reminder (file is self-managed/active, PM14 still open).
 *
 * Idempotent: re-running upserts the raise chase and rewrites its 3 nudges.
 * One-shot demo data — delete when done. Registered in docs/SCRIPTS_REGISTRY.md.
 */
import { prisma } from "@/lib/prisma";

const EMAIL = "emily@hartwellpartners.co.uk";

async function main() {
  const emily = await prisma.user.findUnique({ where: { email: EMAIL }, select: { id: true, agencyId: true } });
  if (!emily?.agencyId) throw new Error(`No agency for ${EMAIL}`);

  // Pick an active self-managed file whose PM14 ("enquiries raised") is still
  // OPEN (available), with no live raise chase already. 21 Redland Road fits.
  const candidates = await prisma.propertyTransaction.findMany({
    where: { agencyId: emily.agencyId, status: "active", serviceType: "self_managed", isDemo: false },
    select: {
      id: true, propertyAddress: true, activeBuyerRoundId: true,
      contacts: { where: { roleType: "purchaser" }, select: { name: true }, take: 1 },
      milestoneCompletions: { where: { milestoneDefinition: { is: { code: "PM14" } } }, select: { id: true, state: true, buyerRoundId: true } },
    },
    orderBy: { createdAt: "asc" },
  });
  const target = candidates.find((f) => {
    const pm14 = f.milestoneCompletions.find((m) => m.buyerRoundId === f.activeBuyerRoundId) ?? f.milestoneCompletions[0];
    return pm14?.state === "available";
  }) ?? candidates[0];
  if (!target) throw new Error("No suitable active self-managed file for Emily");

  const buyerName = target.contacts[0]?.name ?? "the buyer";
  console.log(`Seeding on: ${target.propertyAddress} (${target.id}), buyer ${buyerName}`);

  // A buyer's solicitor on the file, so the reminder names them (and the chase is
  // realistic). Firm name matches the solicitor-nudge ChaseSend below.
  const firm = await prisma.solicitorFirm.upsert({
    where: { name: "Clarke & Mortimer Solicitors" },
    create: { name: "Clarke & Mortimer Solicitors" },
    update: {},
  });
  let handler = await prisma.solicitorContact.findFirst({ where: { firmId: firm.id, name: "Elena-Rose Clarke" } });
  if (!handler) {
    handler = await prisma.solicitorContact.create({
      data: { firmId: firm.id, name: "Elena-Rose Clarke", email: "elena-rose@clarkemortimer.co.uk" },
    });
  }
  await prisma.propertyTransaction.update({
    where: { id: target.id },
    data: { purchaserSolicitorFirmId: firm.id, purchaserSolicitorContactId: handler.id },
  });

  // Dates (now ~2026-10-16): opened 15 Sep, three nudges, escalated after the last.
  const opened = new Date("2026-09-15T10:30:00Z");
  const nudge1 = new Date("2026-09-24T10:30:00Z"); // buyer (WD7)
  const nudge2 = new Date("2026-09-29T10:30:00Z"); // buyer's solicitor (WD10)
  const nudge3 = new Date("2026-10-06T10:30:00Z"); // buyer again
  const escalated = new Date("2026-10-09T10:30:00Z");

  // PM14 must be OPEN with no future "raised by" date, so the chase/reminder show.
  await prisma.milestoneCompletion.updateMany({
    where: {
      transactionId: target.id,
      milestoneDefinition: { is: { code: "PM14" } },
      ...(target.activeBuyerRoundId ? { buyerRoundId: target.activeBuyerRoundId } : {}),
    },
    data: { expectedDate: null },
  });

  await prisma.enquiryRaiseChase.upsert({
    where: { transactionId: target.id },
    create: {
      transactionId: target.id, openedAt: opened,
      lastNudgedAt: nudge3, lastTarget: "buyer", nudgeCount: 3,
      escalatedAt: escalated, closedAt: null,
    },
    update: {
      openedAt: opened, lastNudgedAt: nudge3, lastTarget: "buyer", nudgeCount: 3,
      escalatedAt: escalated, closedAt: null,
    },
  });

  // Three distinct nudge records → three timeline rows.
  await prisma.chaseSend.deleteMany({ where: { transactionId: target.id, kind: "raise" } });
  await prisma.chaseSend.createMany({
    data: [
      { transactionId: target.id, kind: "raise", recipient: "buyer", recipientName: buyerName, sentAt: nudge1 },
      { transactionId: target.id, kind: "raise", recipient: "buyer_solicitor", recipientName: firm.name, sentAt: nudge2 },
      { transactionId: target.id, kind: "raise", recipient: "buyer", recipientName: buyerName, sentAt: nudge3 },
    ],
  });

  // The OTHER signal the escalation fires: a bell notification to the file owner
  // (Emily), exactly as runRaiseChaseCron sends on escalation.
  await prisma.notification.deleteMany({ where: { userId: emily.id, transactionId: target.id, type: "enquiries_raise_stalled" } });
  await prisma.notification.create({
    data: {
      userId: emily.id,
      type: "enquiries_raise_stalled",
      transactionId: target.id,
      payload: {
        address: target.propertyAddress,
        message: `Enquiries on ${target.propertyAddress} still aren't raised after two weeks. Worth a call to the buyer's solicitor.`,
      },
      createdAt: escalated,
      readAt: null,
    },
  });

  console.log(`Done. View as Emily: work queue (/agent/work-queue), the file's Reminders tab, the Chase timeline on ${target.propertyAddress}, and the bell notification (top-right).`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
