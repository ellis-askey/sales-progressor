// Escalated "get enquiries raised" chases, as work-queue reminders.
//
// When the raise chase hits the two-week ceiling it escalates and automated
// nudging stops (lib/enquiries/raise-chase-decision.ts). From that point it's the
// team's to chase personally — so it surfaces here as a reminder in the work queue
// (and the file's Reminders tab), not just a bell notification. Read-only; scoped
// exactly like getAgentReminderLogs via txWhereWorkQueue.
//
// Snooze reuses the engine's own hold: a promised "raised by" date on the active
// PM14 completion (expectedDate). While that date is in the future the chase holds
// and this reminder stays quiet, then comes back — no extra schema.

import { prisma } from "@/lib/prisma";
import { txWhereWorkQueue } from "@/lib/services/work-queue";
import type { AgentVisibility } from "@/lib/services/agent";
import { withSolicitorRecipients, type ChaseContact, type SolicitorRef } from "@/lib/services/chase-recipients";
import { isActiveRoundContact } from "@/lib/contacts/round-scope";
import { ensureRaiseChaseTask } from "@/lib/enquiries/ensure-raise-chase-task";

export type EnquiryEscalationReminder = {
  transactionId: string;
  propertyAddress: string;
  photoStoragePath: string | null;
  escalatedAt: Date;
  openedAt: Date;
  nudgeCount: number;
  solicitorName: string | null; // the buyer's solicitor firm (or contact), for the card's contact line
  // Everything the polished ChaseDrawer needs, so the escalation chase is the
  // SAME drawer as a normal reminder: a provisioned PM14 chase task to run on,
  // the buyer-side recipients (client[s] + the injected buyer's solicitor), and
  // the milestone label. See lib/enquiries/ensure-raise-chase-task.ts.
  chaseTaskId: string | null;
  contacts: ChaseContact[];
  milestoneName: string;
};

export async function getEscalatedEnquiryReminders(
  vis: AgentVisibility,
  opts?: { transactionId?: string },
): Promise<EnquiryEscalationReminder[]> {
  // File-scoped (the Reminders tab on one already-authorised file) or the whole
  // work queue. Both only ever show ACTIVE files — a paused/withdrawn file has no
  // live chase.
  const txWhere = opts?.transactionId
    ? { id: opts.transactionId }
    : { ...txWhereWorkQueue(vis), status: "active" as const };

  const rows = await prisma.enquiryRaiseChase.findMany({
    where: { escalatedAt: { not: null }, closedAt: null, transaction: { is: txWhere } },
    select: {
      transactionId: true,
      escalatedAt: true,
      openedAt: true,
      nudgeCount: true,
      transaction: {
        select: {
          propertyAddress: true,
          photoStoragePath: true,
          activeBuyerRoundId: true,
          assignedUserId: true,
          contacts: { select: { id: true, name: true, roleType: true, email: true, phone: true, buyerRoundId: true } },
          purchaserSolicitorFirm: { select: { id: true, name: true } },
          purchaserSolicitorContact: { select: { id: true, name: true, email: true, phone: true, secondaryEmail: true } },
          // The active buyer's "enquiries raised" (PM14): its state closes the
          // reminder when complete; its expectedDate is the snooze ("raised by").
          milestoneCompletions: {
            where: { milestoneDefinition: { is: { code: "PM14" } } },
            select: { state: true, expectedDate: true, buyerRoundId: true },
          },
        },
      },
    },
  });

  const now = Date.now();
  const out: EnquiryEscalationReminder[] = [];
  for (const r of rows) {
    const tx = r.transaction;
    if (!r.escalatedAt) continue;
    const pm14 = tx.milestoneCompletions.find((m) => m.buyerRoundId === tx.activeBuyerRoundId) ?? tx.milestoneCompletions[0];
    // Already raised → nothing to chase (the cron closes the row too, but be safe).
    if (pm14?.state === "complete" || pm14?.state === "not_required") continue;
    // Snoozed: a promised "raised by" date still in the future → stay quiet until then.
    if (pm14?.expectedDate && pm14.expectedDate.getTime() > now) continue;
    // Build the buyer-side recipients the way the normal reminder path does:
    // round-scoped buyer client(s) + the injected buyer's solicitor (pre-selected
    // via preferRole="solicitor" on the card).
    const purchaserSolicitor: SolicitorRef | null = tx.purchaserSolicitorContact
      ? { ...tx.purchaserSolicitorContact, firm: tx.purchaserSolicitorFirm ?? null }
      : null;
    const buyerContacts = tx.contacts.filter(
      (c) => ["purchaser", "broker"].includes(c.roleType) && isActiveRoundContact(c, tx.activeBuyerRoundId),
    );
    const contacts = withSolicitorRecipients(buyerContacts, { purchaserSolicitor, side: "purchaser" });
    const chaseTaskId = await ensureRaiseChaseTask(r.transactionId, {
      buyerRoundId: tx.activeBuyerRoundId,
      assignedUserId: tx.assignedUserId,
      nudgeCount: r.nudgeCount,
    });
    out.push({
      transactionId: r.transactionId,
      propertyAddress: tx.propertyAddress,
      photoStoragePath: tx.photoStoragePath ?? null,
      escalatedAt: r.escalatedAt,
      openedAt: r.openedAt,
      nudgeCount: r.nudgeCount,
      solicitorName: tx.purchaserSolicitorFirm?.name ?? tx.purchaserSolicitorContact?.name ?? null,
      chaseTaskId,
      contacts,
      milestoneName: "Initial enquiries raised",
    });
  }
  return out;
}
