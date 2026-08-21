// Exchange-day solicitor email sender (Phase 3). Driven by a cron. For every
// file that's actively in exchange day (started today, not exchanged, not
// cancelled), it works out which of the three slots (08:45 / 12:30 / 15:30 UK)
// is due now and sends to the buyer's + seller's solicitor individually.
//
// Rules (see docs/active/exchange-day-SPEC.md):
//   - A slot only fires when NOW >= its UK time (send at/after the slot).
//   - The 8:45/10:00 rule: a slot is skipped if exchange day was STARTED after
//     that slot's time (activated at 10:00 -> the 08:45 email never goes).
//   - Idempotent per activation: a slot fires once (stamp >= startedAt).
//   - Staleness window: a slot won't fire more than 2h late (if the cron was
//     down we don't blast a stale morning email at 4pm).
//   - The "only if not yet exchanged" condition is inherent — exchanged files
//     are excluded, and marking exchange auto-drops them from the active set.

import { prisma } from "@/lib/prisma";
import { sendEmail, solicitorCc } from "@/lib/email";
import { resolveAgencySenderForTransaction } from "@/lib/email/agency-sender";
import { isExchangeDayActive } from "@/lib/services/exchange-day";
import { buildExchangeDaySolicitorEmail, type ExchangeDaySlot } from "@/lib/exchange-day/emails";

const SLOT_WINDOW_MIN = 120;

const SLOTS: { slot: ExchangeDaySlot; minutes: number; field: "exchangeDayMorningEmailAt" | "exchangeDayMiddayEmailAt" | "exchangeDayAfternoonEmailAt" }[] = [
  { slot: "morning",   minutes: 8 * 60 + 45,  field: "exchangeDayMorningEmailAt" },
  { slot: "midday",    minutes: 12 * 60 + 30, field: "exchangeDayMiddayEmailAt" },
  { slot: "afternoon", minutes: 15 * 60 + 30, field: "exchangeDayAfternoonEmailAt" },
];

// Minutes-since-midnight in UK wall-clock for a given instant.
function ukMinutes(d: Date): number {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(d);
  const h = Number(parts.find((p) => p.type === "hour")!.value) % 24;
  const m = Number(parts.find((p) => p.type === "minute")!.value);
  return h * 60 + m;
}

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || name;
}
function longDate(d: Date): string {
  return d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

type SlotFields = {
  exchangeDayStartedAt: Date | null;
  exchangeDayCancelledAt: Date | null;
  exchangedAt: Date | null;
  exchangeDayMorningEmailAt: Date | null;
  exchangeDayMiddayEmailAt: Date | null;
  exchangeDayAfternoonEmailAt: Date | null;
};

// Pure: which slots are due to send right now for this file. Encodes all the
// timing rules (due, 9am/10am skip, once-per-activation, staleness window,
// active-only). Extracted so the rules are testable without sending.
export function computeDueExchangeSlots(tx: SlotFields, now: Date): typeof SLOTS {
  if (!isExchangeDayActive(tx, now)) return [];
  const startMin = ukMinutes(tx.exchangeDayStartedAt!);
  const nowMin = ukMinutes(now);
  return SLOTS.filter((s) => {
    if (nowMin < s.minutes) return false;
    if (nowMin > s.minutes + SLOT_WINDOW_MIN) return false;
    if (startMin > s.minutes) return false;
    const stamp = tx[s.field];
    if (stamp && stamp >= tx.exchangeDayStartedAt!) return false;
    return true;
  });
}

export async function sendDueExchangeDayEmails(now: Date = new Date()): Promise<{ files: number; emails: number }> {
  const candidates = await prisma.propertyTransaction.findMany({
    where: { exchangeDayStartedAt: { not: null }, exchangedAt: null, status: "active" },
    select: {
      id: true, propertyAddress: true, completionDate: true, exchangedAt: true,
      exchangeDayStartedAt: true, exchangeDayCancelledAt: true,
      exchangeDayMorningEmailAt: true, exchangeDayMiddayEmailAt: true, exchangeDayAfternoonEmailAt: true,
      agentUserId: true, assignedUserId: true,
      agency: { select: { name: true } },
      assignedUser: { select: { name: true } },
      vendorSolicitorContact: { select: { name: true, email: true, secondaryEmail: true } },
      purchaserSolicitorContact: { select: { name: true, email: true, secondaryEmail: true } },
    },
  });

  let files = 0;
  let emails = 0;

  for (const tx of candidates) {
    const due = computeDueExchangeSlots(tx, now);
    if (due.length === 0) continue;

    // Sender identity + sign-off name (the progressor on the file).
    const { from, replyTo } = await resolveAgencySenderForTransaction(tx.id).catch(() => ({ from: undefined, replyTo: undefined }));
    let senderName = tx.assignedUser?.name ?? null;
    if (!senderName && tx.agentUserId) {
      senderName = (await prisma.user.findUnique({ where: { id: tx.agentUserId }, select: { name: true } }))?.name ?? null;
    }
    senderName = senderName ?? "Sales Progressor";
    const agencyName = tx.agency?.name ?? "Sales Progressor";
    const addressShort = tx.propertyAddress.split(",")[0]?.trim() || tx.propertyAddress;
    const completionDate = tx.completionDate ? longDate(tx.completionDate) : "a date to be confirmed";
    const createdById = tx.assignedUserId ?? tx.agentUserId ?? null;

    const recipients = [tx.vendorSolicitorContact, tx.purchaserSolicitorContact]
      .filter((c): c is { name: string; email: string; secondaryEmail: string | null } => !!c && !!c.email);

    let touchedFile = false;
    for (const s of due) {
      for (const sol of recipients) {
        const { subject, text, html } = buildExchangeDaySolicitorEmail(s.slot, {
          firstName: firstName(sol.name), address: tx.propertyAddress, addressShort, completionDate, senderName, agencyName,
        });
        try {
          await sendEmail({ to: sol.email, cc: solicitorCc(sol), from, replyTo, subject, text, html, emailType: "EXCHANGE_DAY" });
          emails++;
          await prisma.outboundMessage.create({
            data: {
              transactionId: tx.id, type: "outbound", channel: "email", method: "email",
              purpose: "chase", status: "sent", isAutomated: true,
              recipientName: sol.name, recipientEmail: sol.email, subject, content: text,
              contactIds: [], createdById, createdByRole: "director",
            },
          }).catch(() => {});
        } catch (err) {
          console.error(`[exchange-day] send failed tx=${tx.id} slot=${s.slot} to=${sol.email}:`, err);
        }
      }
      // Stamp the slot as processed (even if a side had no email — nothing left
      // to send this activation), so it never re-fires.
      await prisma.propertyTransaction.update({ where: { id: tx.id }, data: { [s.field]: now } });
      touchedFile = true;
    }
    if (touchedFile) files++;
  }

  return { files, emails };
}
