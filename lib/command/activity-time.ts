// Activity-weighted time-on-file (Command Centre).
//
// The measured time-on-file (FileTimeSession) only captures focused in-app tab
// time. Most real effort on a file happens OFF-app: WhatsApp on a phone, email in
// Outlook, phone calls. This adds a rough per-interaction estimate ON TOP of the
// measured seconds, so a file's "time spent" reflects the comms effort too.
//
// Weights agreed with Ellis 2026-08-29. Only HUMAN-sent comms count — automated
// milestone / chase / reminder sends (isAutomated) are excluded, and in-app
// milestone clicks aren't here (they're already inside the measured focus-time).
//
// Source is the unified comms timeline (OutboundMessage): `type` gives direction
// (inbound | outbound | internal_note), `method` gives the channel.

import type { commandDb } from "@/lib/command/prisma";

type Db = typeof commandDb;

// Seconds added per interaction. WhatsApp is per-message either direction; email
// is asymmetric (writing one costs more than reading one).
export const ACTIVITY_WEIGHTS_SECONDS = {
  whatsapp: 30, // sent or received
  emailInbound: 60,
  emailOutbound: 120,
  sms: 30, // sent or received
  phone: 300, // a logged call
  voicemail: 60,
  note: 60, // an internal note written
  post: 120, // a letter logged
} as const;

// The weight for one OutboundMessage row from its (type, method).
function weightFor(type: string | null, method: string | null): number {
  if (type === "internal_note") return ACTIVITY_WEIGHTS_SECONDS.note;
  switch (method) {
    case "whatsapp": return ACTIVITY_WEIGHTS_SECONDS.whatsapp;
    case "sms": return ACTIVITY_WEIGHTS_SECONDS.sms;
    case "phone": return ACTIVITY_WEIGHTS_SECONDS.phone;
    case "voicemail": return ACTIVITY_WEIGHTS_SECONDS.voicemail;
    case "post": return ACTIVITY_WEIGHTS_SECONDS.post;
    case "email": return type === "inbound" ? ACTIVITY_WEIGHTS_SECONDS.emailInbound : ACTIVITY_WEIGHTS_SECONDS.emailOutbound;
    default: return 0;
  }
}

/**
 * Weighted comms seconds per file (ALL human-sent messages on the file, inbound +
 * outbound + notes). Used for the file-level totals. Returns a Map keyed by
 * transactionId; files with no comms are absent (treat as 0).
 */
export async function activitySecondsByFile(db: Db, txIds: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (txIds.length === 0) return out;
  const groups = await db.outboundMessage.groupBy({
    by: ["transactionId", "type", "method"],
    where: { transactionId: { in: txIds }, isAutomated: false },
    _count: { _all: true },
  });
  for (const g of groups) {
    if (!g.transactionId) continue;
    const secs = weightFor(g.type, g.method) * g._count._all;
    if (secs > 0) out.set(g.transactionId, (out.get(g.transactionId) ?? 0) + secs);
  }
  return out;
}

/**
 * Weighted comms seconds attributable to ONE user (the messages they sent + notes
 * they wrote — inbound has no author, so it's file-level only, not per-user). Used
 * for the per-agent total. Optionally scoped to a set of files.
 */
export async function activitySecondsForUser(db: Db, userId: string): Promise<number> {
  const groups = await db.outboundMessage.groupBy({
    by: ["type", "method"],
    where: { createdById: userId, isAutomated: false },
    _count: { _all: true },
  });
  let total = 0;
  for (const g of groups) total += weightFor(g.type, g.method) * g._count._all;
  return total;
}
