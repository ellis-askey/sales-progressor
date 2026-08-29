// Pure mapping from a SendGrid Event Webhook event to the
// OutboundEmailQueue column updates we want to apply. Extracted so the
// /api/webhooks/sendgrid-bounce route stays a thin HTTP shell — the
// classification logic is unit-testable in isolation here.
//
// SendGrid event reference:
//   https://www.twilio.com/docs/sendgrid/for-developers/tracking-events/event
//
// We care about five event types:
//   - delivered  : recipient MTA accepted → deliveredAt
//   - deferred   : temporary failure, SendGrid will retry → deferredAt
//                  + increment deferredCount + capture reason
//   - bounce     : permanent failure (hard bounce) → bouncedAt + reason
//                  EXCEPT bounce + type="blocked" → blockedAt + reason
//                  (SendGrid bundles MTA blocks under bounce events)
//   - dropped    : SendGrid dropped before send → bouncedAt + reason
//                  (treat as bounce — same consequence for the UI)
//   - blocked    : separate event in some SendGrid versions → blockedAt
//
// processed / click / spam_report / unsubscribe / group_* events are ignored.
// "open" is handled for open-tracked sends (client chase) → openedAt.

export type SendGridEvent = {
  event: string;
  type?: string; // sub-type, e.g. "bounce" | "blocked" | "expired"
  reason?: string;
  status?: string;
  timestamp?: number; // seconds since epoch (SendGrid convention)
  email?: string;
  // Custom args we set in sendEmail() — comma-joined queue row ids for
  // bundled digest sends, single id otherwise.
  queueId?: string;
  [key: string]: unknown;
};

// What the webhook should write back to OutboundEmailQueue for one row.
// Returns null when the event is one we ignore (processed, click, etc.).
export type QueueUpdate =
  | { kind: "delivered"; deliveredAt: Date }
  | { kind: "deferred"; deferredAt: Date; deferredReason: string | null }
  | { kind: "bounced"; bouncedAt: Date; bouncedReason: string | null }
  | { kind: "blocked"; blockedAt: Date; blockedReason: string | null }
  | { kind: "opened"; openedAt: Date };

function tsToDate(timestamp: number | undefined): Date {
  if (typeof timestamp === "number" && Number.isFinite(timestamp)) {
    return new Date(timestamp * 1000);
  }
  return new Date();
}

function reasonOf(event: SendGridEvent): string | null {
  return event.reason ?? event.status ?? null;
}

export function classifyEvent(event: SendGridEvent): QueueUpdate | null {
  const at = tsToDate(event.timestamp);
  switch (event.event) {
    case "open":
      // Only emails sent with open-tracking (client chase) fire this. The
      // route stamps openedAt on first open. Note: unreliable signal.
      return { kind: "opened", openedAt: at };
    case "delivered":
      return { kind: "delivered", deliveredAt: at };
    case "deferred":
      return { kind: "deferred", deferredAt: at, deferredReason: reasonOf(event) };
    case "bounce":
      // SendGrid emits bounce events with type "bounce" | "blocked" |
      // "expired". Surfaces blocked as a distinct UI state because the
      // recipient is reachable but rejecting (reputation / spam-trap),
      // whereas a true bounce is a permanent address failure.
      if (event.type === "blocked") {
        return { kind: "blocked", blockedAt: at, blockedReason: reasonOf(event) };
      }
      return { kind: "bounced", bouncedAt: at, bouncedReason: reasonOf(event) };
    case "blocked":
      return { kind: "blocked", blockedAt: at, blockedReason: reasonOf(event) };
    case "dropped":
      return { kind: "bounced", bouncedAt: at, bouncedReason: reasonOf(event) ?? "dropped" };
    default:
      return null;
  }
}

// Split the queueId custom arg into the underlying row id list. Digest
// sends pass a comma-joined list of row ids so one webhook event fans
// out to every row in the bundle.
export function extractQueueIds(event: SendGridEvent): string[] {
  if (typeof event.queueId !== "string" || event.queueId.length === 0) return [];
  return event.queueId
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}
