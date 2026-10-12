// Meta webhook signature verification (X-Hub-Signature-256) and the pure
// event-identity helpers. Kept dependency-free so they unit-test cleanly.
// Spec: every webhook POST body is signed sha256=HMAC_SHA256(raw body, app
// secret) — https://developers.facebook.com/docs/graph-api/webhooks/getting-started

import crypto from "crypto";

export function verifyMetaSignature(rawBody: string, header: string | null | undefined, appSecret: string): boolean {
  if (!header || !header.startsWith("sha256=")) return false;
  const theirs = header.slice("sha256=".length);
  const ours = crypto.createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex");
  if (theirs.length !== ours.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(theirs, "hex"), Buffer.from(ours, "hex"));
  } catch {
    return false;
  }
}

// Idempotency keys for the raw event store. A message event is unique by its
// wamid; a status event by wamid + status (Meta sends one webhook per status
// transition, and redeliveries of either must be no-ops).
export function messageDedupKey(wamid: string): string {
  return `msg:${wamid}`;
}
export function statusDedupKey(wamid: string, status: string): string {
  return `status:${wamid}:${status}`;
}

// Status ordering: a status may only ever advance (webhooks can arrive out of
// order — a `read` must never be overwritten by a late `delivered`). `failed`
// is terminal and ranks above everything so it always sticks.
const STATUS_RANK: Record<string, number> = { sent: 1, delivered: 2, read: 3, played: 4, failed: 9 };

export function statusRank(status: string): number {
  return STATUS_RANK[status] ?? 0;
}

export function statusAdvances(from: string | null | undefined, to: string): boolean {
  if (!from) return true;
  return statusRank(to) > statusRank(from);
}
