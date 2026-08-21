// lib/services/exchange-day.ts
//
// Exchange-day overlay (Phase 1 — state + backend). The agent flags "we're
// aiming to exchange contracts today". It is deliberately NOT a milestone, not
// a step, not part of the %. It's a single-day operational overlay whose
// "active" state is DERIVED from timestamps + the current date — no stored
// boolean, no midnight cron. See docs/active/exchange-day-SPEC.md.
//
// Phase 1 is pure state + service. The hero control/UI (Phase 2), the solicitor
// email sequence (Phase 3), the client portal state + authority (Phase 4) and
// the agent chip + chase suppression (Phase 5) all read/drive off this.

import { prisma } from "@/lib/prisma";
import { toUKDateStr } from "@/lib/utils";
import { touchLastActivity } from "@/lib/services/activity";

export type ExchangeDayFields = {
  exchangeDayStartedAt: Date | null;
  exchangeDayCancelledAt: Date | null;
  exchangedAt: Date | null;
};

// Pure derivation — no DB. Exchange day is "active" iff it was started TODAY
// (UK date), the file hasn't exchanged, and it hasn't been cancelled since the
// last start. Reading it tomorrow returns false with no write — that's the
// "self-clearing at midnight" behaviour, for free.
export function isExchangeDayActive(tx: ExchangeDayFields, now: Date = new Date()): boolean {
  if (!tx.exchangeDayStartedAt) return false;
  if (tx.exchangedAt) return false;
  if (toUKDateStr(tx.exchangeDayStartedAt) !== toUKDateStr(now)) return false;
  if (tx.exchangeDayCancelledAt && tx.exchangeDayCancelledAt >= tx.exchangeDayStartedAt) return false;
  return true;
}

export async function getExchangeDayState(transactionId: string): Promise<{
  active: boolean;
  exchanged: boolean;
  startedAt: Date | null;
  completionDate: Date | null;
}> {
  const tx = await prisma.propertyTransaction.findUnique({
    where: { id: transactionId },
    select: { exchangeDayStartedAt: true, exchangeDayCancelledAt: true, exchangedAt: true, completionDate: true },
  });
  if (!tx) throw new Error("Transaction not found");
  return { active: isExchangeDayActive(tx), exchanged: !!tx.exchangedAt, startedAt: tx.exchangeDayStartedAt, completionDate: tx.completionDate };
}

// Portal read: exchange-day state for one contact (by portal token). Drives the
// client-facing "aiming to exchange today" card + the authority CTA. Authority
// is "given" only for the CURRENT activation; a client who gave it on an earlier
// day sees "reask" so we ask again for today.
export async function getContactExchangeDayState(token: string): Promise<{
  active: boolean;
  authorityState: "given" | "reask" | "first";
  saleWord: "sale" | "purchase";
} | null> {
  const contact = await prisma.contact.findFirst({
    where: { portalToken: token },
    select: {
      exchangeAuthorityGivenAt: true,
      roleType: true,
      transaction: { select: { exchangeDayStartedAt: true, exchangeDayCancelledAt: true, exchangedAt: true } },
    },
  });
  if (!contact?.transaction) return null;
  const tx = contact.transaction;
  const saleWord: "sale" | "purchase" = contact.roleType === "vendor" ? "sale" : "purchase";
  if (!isExchangeDayActive(tx)) return { active: false, authorityState: "first", saleWord };
  const given = contact.exchangeAuthorityGivenAt;
  const authorityState = given && given >= tx.exchangeDayStartedAt! ? "given" : given ? "reask" : "first";
  return { active: true, authorityState, saleWord };
}

function longDate(d: Date): string {
  return d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

// Start (or re-start) exchange day. A completion date is REQUIRED — you can't
// agree to exchange without an agreed completion date. Pass one to set/confirm
// it, otherwise the file's existing completionDate is used; throws if neither.
// Idempotent-ish: re-starting stamps a fresh startedAt (which re-invalidates
// yesterday's client authority and clears any prior cancel).
export async function startExchangeDay(input: {
  transactionId: string;
  completionDate?: Date | null;
  actorId: string;
  actorName: string;
}): Promise<{ active: boolean; completionDate: Date }> {
  const tx = await prisma.propertyTransaction.findUnique({
    where: { id: input.transactionId },
    select: { completionDate: true, exchangedAt: true },
  });
  if (!tx) throw new Error("Transaction not found");
  if (tx.exchangedAt) throw new Error("This file has already exchanged.");

  const completionDate = input.completionDate ?? tx.completionDate;
  if (!completionDate) throw new Error("A completion date must be agreed before starting exchange day.");

  const now = new Date();
  await prisma.propertyTransaction.update({
    where: { id: input.transactionId },
    data: {
      completionDate,
      exchangeDayStartedAt: now,
      exchangeDayCancelledAt: null,
    },
  });

  await prisma.outboundMessage.create({
    data: {
      transactionId: input.transactionId,
      type: "internal_note",
      contactIds: [],
      content: `${input.actorName} started exchange day. Aiming to exchange today, with completion agreed for ${longDate(completionDate)}.`,
      createdById: input.actorId,
    },
  });
  touchLastActivity(input.transactionId).catch(() => {});
  return { active: true, completionDate };
}

// End exchange day early ("something's changed, no longer exchanging today").
// Stamps cancelledAt so the derivation reads inactive. Phases 3–5 hang the
// "stop the queued emails / revert the client state" behaviour off this.
export async function cancelExchangeDay(input: {
  transactionId: string;
  actorId: string;
  actorName: string;
}): Promise<{ active: boolean }> {
  await prisma.propertyTransaction.update({
    where: { id: input.transactionId },
    data: { exchangeDayCancelledAt: new Date() },
  });
  await prisma.outboundMessage.create({
    data: {
      transactionId: input.transactionId,
      type: "internal_note",
      contactIds: [],
      content: `${input.actorName} ended exchange day (no longer aiming to exchange today).`,
      createdById: input.actorId,
    },
  });
  touchLastActivity(input.transactionId).catch(() => {});
  return { active: false };
}
