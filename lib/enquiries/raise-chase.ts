// The "get enquiries raised" chase — orchestration (enquiries rework).
//
// For every OPEN raise-chase on a LIVE file it works out whether a nudge or an
// escalation is due (raiseChaseDecision), then:
//   - nudges the buyer (client email) or the buyer's solicitor (solicitor
//     email), alternating, on the founder-approved cadence, and
//   - escalates to the file owner (bell notification) at the 2-week + 3-day
//     ceiling if nobody has confirmed enquiries raised.
//
// Reuses the reply-loop chase's master switch, weekday guard, base URL and the
// replyable per-agency / EXP sender. Gated OFF until the switch is flipped.

import { prisma } from "@/lib/prisma";
import { sendChainEmail } from "@/lib/email";
import { resolveAgencySenderForTransaction } from "@/lib/email/agency-sender";
import { signSolicitorToken } from "@/lib/solicitor-confirm/token";
import { isChaseEnabled, isWeekdayLondon, baseUrl } from "./chase";
import { raiseChaseDecision } from "./raise-chase-decision";
import { buildRaiseBuyerEmail, buildRaiseSolicitorEmail } from "./raise-chase-email";
import { logChaseSend, logEnquiryChaseComm } from "./chase-log";

function firstNameOf(full: string): string {
  return full.trim().split(/\s+/)[0] || "there";
}

export async function runRaiseChaseCron(now: Date): Promise<{
  enabled: boolean;
  considered: number;
  sent: number;
  escalated: number;
  skippedWeekend?: boolean;
}> {
  if (!(await isChaseEnabled())) return { enabled: false, considered: 0, sent: 0, escalated: 0 };
  if (!isWeekdayLondon(now)) return { enabled: true, considered: 0, sent: 0, escalated: 0, skippedWeekend: true };

  const chases = await prisma.enquiryRaiseChase.findMany({
    // Live files only. A withdrawn / on-hold / completed sale keeps no live
    // chase (it's closed on status change), but this is the belt-and-braces guard.
    where: { closedAt: null, transaction: { is: { status: "active" } } },
    select: {
      id: true,
      openedAt: true,
      lastNudgedAt: true,
      lastTarget: true,
      nudgeCount: true,
      escalatedAt: true,
      transaction: {
        select: {
          id: true,
          propertyAddress: true,
          clientEmailsPaused: true,
          agencyId: true,
          assignedUserId: true,
          agentUserId: true,
          activeBuyerRoundId: true,
          agency: { select: { name: true } },
          purchaserSolicitorContact: { select: { email: true, name: true } },
          purchaserSolicitorFirm: { select: { name: true } },
          vendorSolicitorFirm: { select: { name: true } },
          purchaserSolicitorEmailsPaused: true,
          contacts: {
            select: {
              name: true, roleType: true, email: true, portalToken: true,
              unsubscribedAt: true, emailsPausedAt: true, chasesPausedUntil: true,
            },
          },
          // PM14 ("enquiries raised"): its state closes the chase, its
          // expectedDate holds it. Round-scoped below to the ACTIVE buyer so a
          // relisted file reads the CURRENT buyer's tick, not a previous one.
          milestoneCompletions: {
            where: { milestoneDefinition: { is: { code: "PM14" } } },
            select: { state: true, expectedDate: true, buyerRoundId: true },
          },
        },
      },
    },
  });

  let sent = 0;
  let escalated = 0;

  for (const ch of chases) {
    const tx = ch.transaction;
    if (!tx) continue;

    // The ACTIVE buyer's "raised" row (round-scoped). A relisted file may carry
    // a previous buyer's complete PM14; we must only read the current round's.
    const activePm14 = tx.milestoneCompletions.find((m) => m.buyerRoundId === tx.activeBuyerRoundId);
    // If the current buyer's enquiries are already raised, the chase is done.
    if (activePm14?.state === "complete") {
      await prisma.enquiryRaiseChase.update({ where: { id: ch.id }, data: { closedAt: now } }).catch(() => {});
      continue;
    }
    const expectedDate = activePm14?.expectedDate ?? null;

    const decision = raiseChaseDecision(
      {
        openedAt: ch.openedAt,
        lastNudgedAt: ch.lastNudgedAt,
        lastTarget: ch.lastTarget,
        nudgeCount: ch.nudgeCount,
        escalatedAt: ch.escalatedAt,
        expectedDate,
      },
      now,
    );

    const ownerId = tx.assignedUserId ?? tx.agentUserId;

    // Escalation first — it fires even if we can't email anyone.
    if (decision.escalateDue) {
      const flip = await prisma.enquiryRaiseChase.updateMany({
        where: { id: ch.id, escalatedAt: null },
        data: { escalatedAt: now },
      });
      if (flip.count > 0) {
        if (ownerId) {
          await prisma.notification.create({
            data: {
              userId: ownerId,
              type: "enquiries_raise_stalled",
              transactionId: tx.id,
              payload: {
                address: tx.propertyAddress,
                message: `Enquiries on ${tx.propertyAddress} still aren't raised after two weeks. Worth a call to the buyer's solicitor.`,
              },
            },
          }).catch((err) => console.error(`[raise-chase] escalation notify failed for ${tx.id}:`, err));
        }
        escalated++;
      }
    }

    if (!decision.nudgeDue || !decision.target) continue;

    // Replyable per-agency / EXP sender + signature identity (same as the
    // reply-loop chase).
    // Sending address = the file's agency authenticated address (Reply-To
    // matching), SP fallback when the agency has none. Body signature identity
    // (senderName / agencyName) resolved separately below.
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
        agencyName = agent.agencyId ? (agent.agency?.name ?? tx.agency?.name ?? agencyName) : "The Sales Progressor";
      }
    }

    let didSend = false;
    try {
      if (decision.target === "buyer") {
        // Eligible buyer contacts only (mirrors the client-chase eligibility:
        // has email + portal access, not unsubscribed, not paused per-person or
        // per-file).
        if (!tx.clientEmailsPaused) {
          const buyers = tx.contacts.filter(
            (c) =>
              c.roleType === "purchaser" &&
              c.email &&
              c.portalToken &&
              !c.unsubscribedAt &&
              !c.emailsPausedAt &&
              !(c.chasesPausedUntil && c.chasesPausedUntil > now),
          );
          for (const b of buyers) {
            const mail = buildRaiseBuyerEmail({
              firstName: firstNameOf(b.name),
              address: tx.propertyAddress,
              senderName,
              agencyName,
              fileUrl: `${baseUrl()}/portal/${b.portalToken}`,
            });
            await sendChainEmail({ to: b.email as string, subject: mail.subject, text: mail.text, html: mail.html, from, replyTo });
            await logChaseSend({ transactionId: tx.id, kind: "raise", recipient: "buyer", recipientName: b.name }).catch(() => {});
            await logEnquiryChaseComm({
              transactionId: tx.id,
              agencyId: tx.agencyId,
              subject: mail.subject,
              body: mail.text,
              recipientEmail: b.email as string,
              recipientName: b.name,
              createdById: ownerId ?? null,
              sentAt: now,
            }).catch(() => {});
            didSend = true;
          }
        }
      } else {
        const email = tx.purchaserSolicitorContact?.email;
        if (email && !tx.purchaserSolicitorEmailsPaused) {
          const token = signSolicitorToken(tx.id, "purchaser");
          const clientNames = tx.contacts.filter((c) => c.roleType === "purchaser").map((c) => c.name);
          const mail = buildRaiseSolicitorEmail({
            address: tx.propertyAddress,
            clientNames,
            sellerFirmName: tx.vendorSolicitorFirm?.name ?? undefined,
            recipientFirstName: tx.purchaserSolicitorContact?.name ? firstNameOf(tx.purchaserSolicitorContact.name) : undefined,
            senderName,
            agencyName,
            provideUpdateUrl: `${baseUrl()}/s/${token}`,
            now,
          });
          await sendChainEmail({ to: email, subject: mail.subject, text: mail.text, html: mail.html, from, replyTo });
          await logChaseSend({ transactionId: tx.id, kind: "raise", recipient: "buyer_solicitor", recipientName: tx.purchaserSolicitorFirm?.name ?? null }).catch(() => {});
          await logEnquiryChaseComm({
            transactionId: tx.id,
            agencyId: tx.agencyId,
            subject: mail.subject,
            body: mail.text,
            recipientEmail: email,
            recipientName: tx.purchaserSolicitorFirm?.name ?? null,
            createdById: ownerId ?? null,
            sentAt: now,
          }).catch(() => {});
          didSend = true;
        }
      }
    } catch (err) {
      console.error(`[raise-chase] send failed for chase ${ch.id}:`, err);
    }

    // Advance the schedule whether or not the email went (an unreachable party
    // shouldn't stall the cadence — the time-based escalation still protects the
    // file). Only count a real send.
    await prisma.enquiryRaiseChase.update({
      where: { id: ch.id },
      data: { lastNudgedAt: now, lastTarget: decision.target, nudgeCount: { increment: 1 } },
    }).catch(() => {});
    if (didSend) sent++;
  }

  return { enabled: true, considered: chases.length, sent, escalated };
}
