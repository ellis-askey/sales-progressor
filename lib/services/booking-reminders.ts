// Survey / lender-valuation booking emails to the AGENCY AGENT.
//
// Two emails, both to the agency's own agent (PropertyTransaction.agentUserId —
// the local person who holds keys / arranges access), never the remote
// progressor:
//
//   1. Booking-day "diary" email (maybeSendBookingDiaryEmail) — fires the moment
//      a booking is confirmed on an OUTSOURCED file (a progressor confirmed it,
//      or a buyer logged it and we released it). Self-managed files skip it (the
//      agent confirmed it themselves, so they already know). Only sent when keys
//      are collected from the branch (keyCollectionRequired) — a desktop
//      valuation or straight-to-property job needs nothing from the agent.
//      Carries an "add to calendar" .ics.
//
//   2. 7am morning-of nudge (sendBookingMorningReminders) — a daily sweep run by
//      app/api/cron/booking-morning. Fires for EVERY confirmed survey / valuation
//      happening today, on every file (both tiers). Keys line only when keys are
//      involved; straight-to-property jobs get a plain "happening today" version.
//
// Both are gated by the agent's "appointmentReminders" notification preference
// (default on) and go through sendAgentEmail so they log to /command/agent-emails.
// See docs/active/booking-reminders/00-plan.md.

import { prisma } from "@/lib/prisma";
import { sendAgentEmail } from "@/lib/email/agent-log";
import { resolveAgencySender } from "@/lib/email/agency-sender";
import { getNotificationPrefs } from "@/lib/agent/notification-prefs";
import { extractFirstName } from "@/lib/contacts/displayName";

type BookingCode = "PM6" | "PM9";

function noun(code: BookingCode): string {
  return code === "PM6" ? "lender valuation" : "survey";
}
function actor(code: BookingCode): string {
  return code === "PM6" ? "valuer" : "surveyor";
}
function shortAddress(address: string): string {
  return address.split(",")[0]?.trim() || address;
}

// eventDate is stored at UTC midnight of the appointment day, so format with
// timeZone UTC to render the calendar date without an off-by-one shift.
function fmtLongDate(d: Date): string {
  return d.toLocaleDateString("en-GB", {
    weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC",
  });
}
function icsDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}
function icsStamp(d: Date): string {
  return `${icsDate(d)}T090000Z`;
}

// A minimal all-day VEVENT for the appointment, with an 08:00 day-of reminder.
// Modelled on app/api/portal/calendar-export/[token]/route.ts (hand-rolled, no
// external ICS library).
function buildBookingIcs(code: BookingCode, address: string, eventDate: Date, keysFromBranch: boolean): string {
  const dateStr = icsDate(eventDate);
  const summary = `${code === "PM6" ? "Lender valuation" : "Survey"}: ${address}`;
  const keysLine = keysFromBranch
    ? `The ${actor(code)} is collecting keys from you. Have them ready.`
    : `The ${actor(code)} is going straight to the property.`;
  const description = `${code === "PM6" ? "Lender valuation" : "Survey"} at ${address}.\\n${keysLine}`;
  const uid = `booking-${code}-${dateStr}-${Math.abs(hash(address))}@thesalesprogressor.co.uk`;
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//The Sales Progressor//Booking Reminders//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${icsStamp(eventDate)}`,
    `DTSTART;VALUE=DATE:${dateStr}`,
    `DTEND;VALUE=DATE:${dateStr}`,
    `SUMMARY:${summary}`,
    `DESCRIPTION:${description}`,
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    `DESCRIPTION:${summary}`,
    `TRIGGER;VALUE=DATE-TIME:${dateStr}T080000`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

// Tiny stable hash for the ICS UID (avoids Math.random so the same booking
// yields a stable UID across resends, letting calendars update rather than dupe).
function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

/**
 * Day-of-booking "put it in your diary" email to the agency agent. Fire-and-
 * forget; every guard failure is a silent no-op (returns false).
 *
 * Sends only when: the file is OUTSOURCED, keys come from the branch, there is a
 * real appointment date, the file has an agent with an email, and that agent
 * hasn't turned appointment reminders off.
 */
export async function maybeSendBookingDiaryEmail(input: {
  transactionId: string;
  code: BookingCode;
  eventDate: Date | null;
  keyCollectionRequired: boolean | null;
  rescheduled?: boolean;
}): Promise<boolean> {
  // Straight-to-property or desktop (no date / no keys) → nothing for the agent.
  if (!input.eventDate || input.keyCollectionRequired !== true) return false;

  const tx = await prisma.propertyTransaction.findUnique({
    where: { id: input.transactionId },
    select: {
      serviceType: true,
      agencyId: true,
      agentUserId: true,
      propertyAddress: true,
      agentUser: { select: { name: true, email: true } },
    },
  });
  // Diary email is OUTSOURCED-only: on self-managed the agent confirmed it
  // themselves, so they already know.
  if (!tx || tx.serviceType !== "outsourced") return false;
  if (!tx.agentUserId || !tx.agentUser?.email) return false;

  const prefs = await getNotificationPrefs(tx.agentUserId);
  if (!prefs.appointmentReminders) return false;

  const sender = await resolveAgencySender(tx.agencyId, { fromPlatformAddress: true });
  const first = tx.agentUser.name ? extractFirstName(tx.agentUser.name) : "there";
  const short = shortAddress(tx.propertyAddress);
  const dateLong = fmtLongDate(input.eventDate);
  const keysLine = `The ${actor(input.code)} is collecting keys from you, so please have them ready.`;

  const lead = input.rescheduled
    ? `The ${noun(input.code)} at ${tx.propertyAddress} has been rescheduled.`
    : `A ${noun(input.code)} has been booked at ${tx.propertyAddress}.`;

  const subject = input.rescheduled
    ? `${input.code === "PM6" ? "Lender valuation" : "Survey"} rescheduled at ${short}`
    : `${input.code === "PM6" ? "Lender valuation" : "Survey"} booked at ${short}`;

  const text = [
    `Hi ${first},`,
    "",
    lead,
    "",
    `Date: ${dateLong}`,
    keysLine,
    "",
    "We've attached a calendar invite so you can drop it straight into your diary.",
  ].join("\n");

  const html = `
    <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;font-size:15px;color:#1f2937;line-height:1.6">
      <p>Hi ${first},</p>
      <p>${lead}</p>
      <p style="margin:16px 0;padding:12px 16px;background:#f8fafc;border-radius:10px">
        <strong>Date:</strong> ${dateLong}<br/>
        ${keysLine}
      </p>
      <p style="color:#6b7280">We've attached a calendar invite so you can drop it straight into your diary.</p>
    </div>`;

  const ics = buildBookingIcs(input.code, short, input.eventDate, true);
  await sendAgentEmail({
    to: tx.agentUser.email,
    subject,
    text,
    html,
    from: sender.from,
    replyTo: sender.replyTo,
    emailType: "booking_diary",
    kind: "booking_diary",
    userId: tx.agentUserId,
    agencyId: tx.agencyId,
    transactionId: input.transactionId,
    attachments: [{
      content: Buffer.from(ics, "utf8").toString("base64"),
      filename: `${input.code === "PM6" ? "valuation" : "survey"}.ics`,
      type: "text/calendar",
      disposition: "attachment",
    }],
  });
  return true;
}

/**
 * 7am morning-of sweep. Finds every confirmed survey / lender valuation whose
 * appointment is today (UK), and emails the agency agent on each. Deduped via a
 * Notification row keyed on the appointment date, so a re-fire in the cron
 * window can't double-send. Returns the number of emails sent.
 */
export async function sendBookingMorningReminders(): Promise<number> {
  // Today's calendar date in UK time → its UTC-midnight window. eventDate is
  // stored at UTC midnight of the appointment day, so this matches "today".
  const ukDateStr = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date()); // YYYY-MM-DD
  const start = new Date(`${ukDateStr}T00:00:00.000Z`);
  const end = new Date(start.getTime() + 86400000);

  const rows = await prisma.milestoneCompletion.findMany({
    where: {
      state: "complete",
      awaitingBookingConfirmation: false,
      eventDate: { gte: start, lt: end },
      milestoneDefinition: { code: { in: ["PM6", "PM9"] } },
      transaction: { status: "active" },
    },
    select: {
      eventDate: true,
      keyCollectionRequired: true,
      milestoneDefinition: { select: { code: true } },
      transaction: {
        select: {
          id: true,
          propertyAddress: true,
          agencyId: true,
          agentUserId: true,
          assignedUserId: true,
          agentUser: { select: { name: true, email: true } },
          // Never-happens fallback so a file with no agent still reaches someone.
          assignedUser: { select: { name: true, email: true } },
        },
      },
    },
  });

  let sent = 0;
  for (const r of rows) {
    const tx = r.transaction;
    const code = (r.milestoneDefinition.code === "PM6" ? "PM6" : "PM9") as BookingCode;
    // Recipient: the agency agent on every file (they hold keys / are local).
    const recipientId = tx.agentUserId ?? tx.assignedUserId;
    const recipient = tx.agentUser?.email ? tx.agentUser : tx.assignedUser;
    if (!recipientId || !recipient?.email) continue;

    const prefs = await getNotificationPrefs(recipientId);
    if (!prefs.appointmentReminders) continue;

    // Dedup on (user, type, tx, appointment date).
    const existing = await prisma.notification.findFirst({
      where: {
        userId: recipientId,
        type: "booking_morning",
        transactionId: tx.id,
        payload: { path: ["dateKey"], equals: ukDateStr },
      },
      select: { id: true },
    });
    if (existing) continue;

    const sender = await resolveAgencySender(tx.agencyId, { fromPlatformAddress: true });
    const first = recipient.name ? extractFirstName(recipient.name) : "there";
    const short = shortAddress(tx.propertyAddress);
    const keysLine = r.keyCollectionRequired
      ? `The ${actor(code)} is collecting keys from you, so please have them ready.`
      : `The ${actor(code)} is going straight to the property.`;
    const subject = `${code === "PM6" ? "Lender valuation" : "Survey"} today at ${short}`;
    const text = [
      `Hi ${first},`,
      "",
      `A reminder that the ${noun(code)} at ${tx.propertyAddress} is today.`,
      keysLine,
    ].join("\n");
    const html = `
      <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;font-size:15px;color:#1f2937;line-height:1.6">
        <p>Hi ${first},</p>
        <p>A reminder that the <strong>${noun(code)}</strong> at ${tx.propertyAddress} is today.</p>
        <p style="color:#6b7280">${keysLine}</p>
      </div>`;

    try {
      await sendAgentEmail({
        to: recipient.email,
        subject,
        text,
        html,
        from: sender.from,
        replyTo: sender.replyTo,
        emailType: "booking_morning",
        kind: "booking_morning",
        userId: recipientId,
        agencyId: tx.agencyId,
        transactionId: tx.id,
      });
      await prisma.notification.create({
        data: {
          userId: recipientId,
          type: "booking_morning",
          transactionId: tx.id,
          payload: { dateKey: ukDateStr, code, propertyAddress: tx.propertyAddress },
        },
      });
      sent++;
    } catch {
      // Best-effort per row; a single bad send never sinks the sweep.
    }
  }
  return sent;
}
