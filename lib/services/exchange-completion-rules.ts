// Pure decision helpers for the exchange/completion email flow.
//
// Three rules implemented here, each as a standalone testable function:
//
//   1. EXCHANGE_COMPLETION_CODES — the four codes that bypass the
//      3-minute digest queue and always fire as discrete single-event
//      customer emails.
//
//   2. isExchangeCompletionStale — given (code, tx.expectedExchangeDate,
//      tx.completionDate), decide whether the customer-facing email
//      should be suppressed because the agent is catching up well after
//      the event already happened.
//        VM19 / PM26 (exchange): suppress if ticked > 72h after the
//        recorded exchange date.
//        VM20 / PM27 (completion): suppress if ticked > 24h after the
//        recorded completion date.
//      No recorded date → not stale → send normally.
//
//   3. decideCompletionPackTiming — given tx.completionDate, decide
//      whether the "what to expect on completion day" pack should be
//      sent now, scheduled, or suppressed entirely.
//        completion date in the past → suppress (customer already
//          completed, prep content is moot)
//        completion date <= 3 days from now → send now
//        no completion date → send now (tick is source of truth)
//        completion date > 3 days from now → schedule for
//          completionDate - 3 days
//
// All three are pure; no I/O, no side effects. Live behaviour lives in
// lib/services/portal.ts.

export const EXCHANGE_COMPLETION_CODES: ReadonlySet<string> = new Set([
  "VM19", "PM26",  // exchange
  "VM20", "PM27",  // completion
]);

const EXCHANGE_CODES = new Set(["VM19", "PM26"]);
const COMPLETION_CODES = new Set(["VM20", "PM27"]);

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const THREE_DAYS_MS = 3 * DAY_MS;

// Counterpart map for the four auto-completing exchange/completion
// codes. Same mapping as BILATERAL_PAIRS in app/actions/milestones.ts
// and lib/services/portal.ts — exposed here so the email fan-out can
// derive the counterpart code without re-declaring.
export const AUTO_COUNTERPART_OF: Readonly<Record<string, string>> = {
  VM19: "PM26", PM26: "VM19",
  VM20: "PM27", PM27: "VM20",
};

// Returns true when the customer-facing email for this exchange/
// completion confirmation should be suppressed because the recorded
// date is too far in the past. Comms-log entry should still be written;
// only the actual customer email is skipped.
export function isExchangeCompletionStale(
  code: string,
  recordedDates: { expectedExchangeDate: Date | null; completionDate: Date | null },
  now: number = Date.now(),
): boolean {
  let staleHours: number;
  let recordedDate: Date | null;

  if (EXCHANGE_CODES.has(code)) {
    staleHours = 72;
    recordedDate = recordedDates.expectedExchangeDate;
  } else if (COMPLETION_CODES.has(code)) {
    staleHours = 24;
    recordedDate = recordedDates.completionDate;
  } else {
    return false; // not in scope — never stale
  }

  if (!recordedDate) return false; // no date → tick is source of truth → send
  const ageMs = now - recordedDate.getTime();
  return ageMs > staleHours * HOUR_MS;
}

// ── Completion pack timing ───────────────────────────────────────────────

export type CompletionPackDecision =
  | { action: "skip" }
  | { action: "send-now" }
  | { action: "schedule"; scheduledFor: Date };

export function decideCompletionPackTiming(
  completionDate: Date | null,
  now: number = Date.now(),
): CompletionPackDecision {
  if (!completionDate) return { action: "send-now" };
  const completionMs = completionDate.getTime();
  if (completionMs < now) return { action: "skip" };
  if (completionMs - now <= THREE_DAYS_MS) return { action: "send-now" };
  return { action: "schedule", scheduledFor: new Date(completionMs - THREE_DAYS_MS) };
}
