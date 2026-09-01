// Exchange-day CLIENT email sender. Runs off the SAME cron and the SAME
// active-state derivation as the solicitor emails (lib/exchange-day/send.ts),
// so it is fully part of exchange-day activation: while a file is in exchange
// state, each buyer/seller gets two client-facing slots, individually:
//   - 09:00 morning   — informational + authority ask (no button)
//   - 11:00 authority — short nudge with the "I've given authority" button,
//                       ONLY to contacts who haven't confirmed authority this
//                       activation.
//
// Same timing rules as the solicitor slots: a slot only fires at/after its UK
// time, is skipped if exchange day was started AFTER it (activate at 10:00 ->
// the 09:00 email never goes), fires once per activation (guard columns), and
// won't fire more than 2h late. Honours the client email pause flags. Added
// alongside the portal card (not replacing it). See docs/active/exchange-day-SPEC.md.

import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { extractFirstName } from "@/lib/contacts/displayName";
import { resolveAgencySenderForTransaction } from "@/lib/email/agency-sender";
import { isExchangeDayActive } from "@/lib/services/exchange-day";
import {
  buildExchangeDayClientMorningEmail,
  buildExchangeDayClientAuthorityEmail,
} from "@/lib/exchange-day/emails";
import { resolveExchangeDayClientContent } from "@/lib/agency-email/templates";

const SLOT_WINDOW_MIN = 120;
const PORTAL_BASE = process.env.NEXTAUTH_URL ?? "https://portal.thesalesprogressor.co.uk";

type ClientSlot = "morning" | "authority";

const SLOTS: {
  slot: ClientSlot;
  minutes: number;
  field: "exchangeDayClientMorningEmailAt" | "exchangeDayClientAuthorityEmailAt";
  purpose: "notification" | "chase";
}[] = [
  { slot: "morning",   minutes: 9 * 60,  field: "exchangeDayClientMorningEmailAt",   purpose: "notification" },
  { slot: "authority", minutes: 11 * 60, field: "exchangeDayClientAuthorityEmailAt", purpose: "chase" },
];

function ukMinutes(d: Date): number {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(d);
  const h = Number(parts.find((p) => p.type === "hour")!.value) % 24;
  const m = Number(parts.find((p) => p.type === "minute")!.value);
  return h * 60 + m;
}
function firstName(name: string): string { return extractFirstName(name); }
function longDate(d: Date): string { return d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" }); }

type SlotFields = {
  exchangeDayStartedAt: Date | null;
  exchangeDayCancelledAt: Date | null;
  exchangedAt: Date | null;
  exchangeDayClientMorningEmailAt: Date | null;
  exchangeDayClientAuthorityEmailAt: Date | null;
};

// Pure: which client slots are due right now for this file. Same rules as the
// solicitor computeDueExchangeSlots — extracted so they're testable.
export function computeDueClientSlots(tx: SlotFields, now: Date): typeof SLOTS {
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

export async function sendDueExchangeDayClientEmails(now: Date = new Date()): Promise<{ files: number; emails: number }> {
  const candidates = await prisma.propertyTransaction.findMany({
    where: { exchangeDayStartedAt: { not: null }, exchangedAt: null, status: "active" },
    select: {
      id: true, propertyAddress: true, completionDate: true, exchangedAt: true,
      exchangeDayStartedAt: true, exchangeDayCancelledAt: true,
      exchangeDayClientMorningEmailAt: true, exchangeDayClientAuthorityEmailAt: true,
      clientEmailsPaused: true,
      agencyId: true,
      agentUserId: true, assignedUserId: true,
      agency: { select: { name: true } },
      assignedUser: { select: { name: true } },
      agentUser: { select: { name: true } },
      contacts: {
        where: { roleType: { in: ["vendor", "purchaser"] } },
        select: {
          id: true, name: true, email: true, roleType: true, portalToken: true,
          exchangeAuthorityGivenAt: true, unsubscribedAt: true, emailsPausedAt: true, chasesPausedUntil: true,
        },
      },
    },
  });

  let files = 0;
  let emails = 0;

  for (const tx of candidates) {
    const due = computeDueClientSlots(tx, now);
    if (due.length === 0) continue;

    const { from, replyTo } = await resolveAgencySenderForTransaction(tx.id).catch(() => ({ from: undefined, replyTo: undefined }));
    // Effective client copy — the agency's own version, else our default.
    const edContent = await resolveExchangeDayClientContent(tx.agencyId);
    const senderName = tx.assignedUser?.name ?? tx.agentUser?.name ?? "Sales Progressor";
    const agencyName = tx.agency?.name ?? "Sales Progressor";
    const addressShort = tx.propertyAddress.split(",")[0]?.trim() || tx.propertyAddress;
    const completionDate = tx.completionDate ? longDate(tx.completionDate) : "a date to be confirmed";
    const createdById = tx.assignedUserId ?? tx.agentUserId ?? null;
    const fileOff = tx.clientEmailsPaused;

    let touchedFile = false;
    for (const s of due) {
      for (const c of tx.contacts) {
        if (!c.email) continue;
        // Pause gates — "if they turned off" rules, most-specific respected.
        if (c.unsubscribedAt) continue;
        if (fileOff) continue;
        if (c.emailsPausedAt) continue;
        if (c.chasesPausedUntil && c.chasesPausedUntil > now) continue;

        const saleWord: "sale" | "purchase" = c.roleType === "vendor" ? "sale" : "purchase";
        const vars = { firstName: firstName(c.name), address: tx.propertyAddress, addressShort, completionDate, senderName, agencyName, saleWord };

        let built: { subject: string; text: string; html: string };
        if (s.slot === "authority") {
          // Skip anyone who has already given authority this activation.
          const given = !!c.exchangeAuthorityGivenAt && !!tx.exchangeDayStartedAt && c.exchangeAuthorityGivenAt >= tx.exchangeDayStartedAt;
          if (given || !c.portalToken) continue;
          built = buildExchangeDayClientAuthorityEmail({ ...vars, authorityUrl: `${PORTAL_BASE}/portal/${c.portalToken}?authority=1` }, edContent.authority);
        } else {
          built = buildExchangeDayClientMorningEmail(vars, edContent.morning);
        }

        try {
          await sendEmail({ to: c.email, from, replyTo, subject: built.subject, text: built.text, html: built.html, emailType: "EXCHANGE_DAY_CLIENT" });
          emails++;
          await prisma.outboundMessage.create({
            data: {
              transactionId: tx.id, type: "outbound", channel: "email", method: "email",
              purpose: s.purpose, status: "sent", isAutomated: true,
              recipientName: c.name, recipientEmail: c.email, subject: built.subject, content: built.text,
              contactIds: [c.id], createdById, createdByRole: "director",
            },
          }).catch(() => {});
        } catch (err) {
          console.error(`[exchange-day-client] send failed tx=${tx.id} slot=${s.slot} to=${c.email}:`, err);
        }
      }
      // Stamp the slot as processed (once per activation) so it never re-fires.
      await prisma.propertyTransaction.update({ where: { id: tx.id }, data: { [s.field]: now } });
      touchedFile = true;
    }
    if (touchedFile) files++;
  }

  return { files, emails };
}
