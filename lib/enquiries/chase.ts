// The enquiries chase engine (enquiries rework, Stage 1.4b).
//
// For every OPEN enquiries tracker it works out who holds the ball (the
// tracker's whose-court state), how long it's been silent, and:
//   - sends the matching chase email every 9 working days, via the per-agency
//     / EXP replyable sender (a reply lands in the right inbox), and
//   - escalates after 3 weeks (15 working days) of silence: it sets the amber
//     "stalled" flag on the tracker (surfaced on the file and in the hub
//     attention list) and drops a bell notification to the file's owner, so a
//     human steps in instead of the robot emailing into the void.
//
// Silence is measured from the last logged movement, or from when the loop
// opened if nothing's moved. Logging a movement resets both clocks.
//
// Reuses the existing solicitor-chase infrastructure: the working-day
// calendar, the replyable sender resolver, the tokenised /s/<token> update
// page, and the same master on/off switch (SolicitorChaseSettings), which is
// OFF by default. See docs/active/enquiries-stage-rework-SPEC.md.

import { prisma } from "@/lib/prisma";
import { sendChainEmail } from "@/lib/email";
import { resolveAgencySenderForTransaction } from "@/lib/email/agency-sender";
import { addWorkingDays } from "@/lib/emails/working-hours";
import { extractFirstName } from "@/lib/contacts/displayName";
import { signSolicitorToken } from "@/lib/solicitor-confirm/token";
import { buildEnquiryChaseEmail } from "./chase-email";
import { logChaseSend, logEnquiryChaseComm } from "./chase-log";

const CHASE_WORKING_DAYS = 9; // nudge cadence
const ESCALATE_WORKING_DAYS = 15; // 3 weeks of silence -> hand to a human

// Pure decision: given a tracker's timestamps and "now", is a chase or an
// escalation due? Extracted so the cadence logic is unit-testable without a
// database. Snooze suppresses both.
export function enquiryChaseDecision(
  t: {
    openedAt: Date;
    lastMovementAt: Date | null;
    lastChasedAt: Date | null;
    escalatedAt: Date | null;
    snoozedUntil: Date | null;
  },
  now: Date,
): { chaseDue: boolean; escalateDue: boolean } {
  if (t.snoozedUntil && t.snoozedUntil > now) return { chaseDue: false, escalateDue: false };
  const anchor = t.lastMovementAt ?? t.openedAt;
  const escalateDue = !t.escalatedAt && now >= addWorkingDays(anchor, ESCALATE_WORKING_DAYS);
  const firstDue = addWorkingDays(anchor, CHASE_WORKING_DAYS);
  const nextDue = t.lastChasedAt ? addWorkingDays(t.lastChasedAt, CHASE_WORKING_DAYS) : firstDue;
  const chaseDue = now >= nextDue;
  return { chaseDue, escalateDue };
}

export function isWeekdayLondon(d: Date): boolean {
  const wd = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", weekday: "long" }).format(d);
  return wd !== "Saturday" && wd !== "Sunday";
}

export function baseUrl(): string {
  return process.env.NEXTAUTH_URL ?? "https://portal.thesalesprogressor.co.uk";
}

// The single master switch for ALL enquiries chasing (reply-loop chase AND the
// raise chase). OFF by default.
export async function isChaseEnabled(): Promise<boolean> {
  const row = await prisma.solicitorChaseSettings.findUnique({ where: { id: "singleton" } });
  return row?.enabledByDefault ?? false;
}

export async function runEnquiryChaseCron(now: Date): Promise<{
  enabled: boolean;
  considered: number;
  sent: number;
  escalated: number;
  skippedWeekend?: boolean;
}> {
  if (!(await isChaseEnabled())) return { enabled: false, considered: 0, sent: 0, escalated: 0 };
  // Solicitors don't work weekends; the cron schedule is 1-5 but this covers
  // manual / ad-hoc triggers too.
  if (!isWeekdayLondon(now)) return { enabled: true, considered: 0, sent: 0, escalated: 0, skippedWeekend: true };

  const trackers = await prisma.enquiryTracker.findMany({
    // Only chase live files. A withdrawn / on-hold / completed sale keeps its
    // open tracker (nothing closes it on a status change), but we must not
    // email its solicitors or escalate to its owner. (The tracker is also
    // closed/snoozed on status change — see the status-change handler — but
    // this filter is the belt-and-braces guard the chase itself owns.)
    where: { closedAt: null, transaction: { is: { status: "active" } } },
    select: {
      id: true,
      currentlyWith: true,
      openedAt: true,
      lastMovementAt: true,
      lastChasedAt: true,
      escalatedAt: true,
      snoozedUntil: true,
      transaction: {
        select: {
          id: true,
          propertyAddress: true,
          agencyId: true,
          assignedUserId: true,
          agentUserId: true,
          agency: { select: { name: true } },
          vendorSolicitorContact: { select: { email: true, name: true } },
          vendorSolicitorFirm: { select: { name: true } },
          vendorSolicitorEmailsPaused: true,
          purchaserSolicitorContact: { select: { email: true, name: true } },
          purchaserSolicitorFirm: { select: { name: true } },
          purchaserSolicitorEmailsPaused: true,
          contacts: { select: { name: true, roleType: true } },
        },
      },
    },
  });

  let sent = 0;
  let escalated = 0;

  for (const t of trackers) {
    const tx = t.transaction;
    if (!tx) continue;

    const { chaseDue, escalateDue } = enquiryChaseDecision(t, now);
    const seller = t.currentlyWith === "seller_solicitor";
    const ownerId = tx.assignedUserId ?? tx.agentUserId;

    // Escalate first — this fires even when we can't email (the whole point is
    // that silence gets a human's attention).
    if (escalateDue) {
      const flip = await prisma.enquiryTracker.updateMany({
        where: { id: t.id, escalatedAt: null },
        data: { escalatedAt: now },
      });
      if (flip.count > 0) {
        if (ownerId) {
          try {
            await prisma.notification.create({
              data: {
                userId: ownerId,
                type: "enquiries_stalled",
                transactionId: tx.id,
                payload: {
                  address: tx.propertyAddress,
                  side: seller ? "seller" : "buyer",
                  message: `Enquiries on ${tx.propertyAddress} have had no movement in 3 weeks. Worth a direct call.`,
                },
              },
            });
          } catch (err) {
            console.error(`[enquiry-chase] escalation notify failed for ${t.id}:`, err);
          }
        }
        escalated++;
      }
    }

    if (!chaseDue) continue;

    const email = seller ? tx.vendorSolicitorContact?.email : tx.purchaserSolicitorContact?.email;
    const paused = seller ? tx.vendorSolicitorEmailsPaused : tx.purchaserSolicitorEmailsPaused;
    if (!email || paused) continue; // no one to chase on this side yet

    // Sending address = the file's agency authenticated address (Reply-To
    // matching), SP fallback when the agency has none (e.g. EXP). The body
    // signature identity (senderName / agencyName) is resolved separately below.
    const { from, replyTo } = await resolveAgencySenderForTransaction(tx.id);
    let senderName = tx.agency?.name ?? "The Sales Progressor";
    let agencyName = tx.agency?.name ?? "The Sales Progressor";
    if (ownerId) {
      const agent = await prisma.user.findUnique({
        where: { id: ownerId },
        select: { id: true, name: true, agencyId: true, agency: { select: { name: true } } },
      });
      if (agent) {
        senderName = agent.name ?? senderName;
        // Internal staff (agencyId null) = outsourced / EXP -> sign as SP.
        agencyName = agent.agencyId ? (agent.agency?.name ?? tx.agency?.name ?? agencyName) : "The Sales Progressor";
      }
    }

    const token = signSolicitorToken(tx.id, seller ? "vendor" : "purchaser");
    // Clients on the recipient's side name the subject: seller's solicitor sees
    // the sellers, buyer's solicitor sees the buyers.
    const clientNames = tx.contacts
      .filter((c) => c.roleType === (seller ? "vendor" : "purchaser"))
      .map((c) => c.name);
    const handlerName = (seller ? tx.vendorSolicitorContact?.name : tx.purchaserSolicitorContact?.name) ?? undefined;
    const mail = buildEnquiryChaseEmail({
      court: seller ? "seller_solicitor" : "buyer_solicitor",
      address: tx.propertyAddress,
      clientNames,
      recipientFirstName: handlerName ? extractFirstName(handlerName) : undefined,
      senderName,
      agencyName,
      provideUpdateUrl: `${baseUrl()}/s/${token}`,
      now,
    });

    try {
      await sendChainEmail({ to: email, subject: mail.subject, text: mail.text, html: mail.html, from, replyTo });
      await prisma.enquiryTracker.update({
        where: { id: t.id },
        data: { lastChasedAt: now, chaseCount: { increment: 1 } },
      });
      await logChaseSend({
        transactionId: tx.id,
        kind: "reply_loop",
        recipient: seller ? "seller_solicitor" : "buyer_solicitor",
        recipientName: (seller ? tx.vendorSolicitorFirm?.name : tx.purchaserSolicitorFirm?.name) ?? null,
      }).catch(() => {});
      // Record it on the file's internal activity timeline (never client-facing).
      await logEnquiryChaseComm({
        transactionId: tx.id,
        agencyId: tx.agencyId,
        subject: mail.subject,
        body: mail.text,
        recipientEmail: email,
        recipientName: (seller ? tx.vendorSolicitorFirm?.name : tx.purchaserSolicitorFirm?.name) ?? handlerName ?? null,
        createdById: ownerId ?? null,
        sentAt: now,
      }).catch(() => {});
      sent++;
    } catch (err) {
      console.error(`[enquiry-chase] send failed for tracker ${t.id}:`, err);
    }
  }

  return { enabled: true, considered: trackers.length, sent, escalated };
}
