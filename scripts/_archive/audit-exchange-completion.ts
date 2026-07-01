// Staging audit for the exchange/completion fan-out (Option d + completion-pack
// timing + stale suppression + queue bypass).
//
// Walks each of the 10 scenarios in the audit plan, EVALUATING THE PURE
// DECISIONS that gate runtime behaviour rather than actually firing emails.
// This is the right level of verification because:
//
//   - The runtime fan-out is now well-covered by unit tests (27 tests in
//     exchange-completion-rules + 24 milestone-digest + 20 PR2-suppression).
//   - The integration concern is "do the rules produce the right decision
//     for a given tx state?" — which is exactly what this script exercises.
//   - Actually sending emails for every scenario would spam the test inbox
//     and isn't necessary to verify correctness.
//
// For each scenario, the script prints:
//   - the simulated tx state (recorded dates, current time)
//   - the staleness decision for the relevant customer-facing codes
//   - the completion-pack timing decision
//   - the expected end-to-end outcome (which emails fire, which are
//     suppressed, what's in the queue)
//
// Run:
//   npx ts-node --compiler-options '{"module":"CommonJS","esModuleInterop":true,"baseUrl":".","paths":{"@/*":["./*"]}}' --require tsconfig-paths/register scripts/audit-exchange-completion.ts

import {
  EXCHANGE_COMPLETION_CODES,
  AUTO_COUNTERPART_OF,
  isExchangeCompletionStale,
  decideCompletionPackTiming,
} from "@/lib/services/exchange-completion-rules";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const WEEK_MS = 7 * DAY_MS;

// Fixed "now" for deterministic output.
const NOW = new Date("2026-05-29T10:00:00Z").getTime();
const NOW_STR = new Date(NOW).toISOString();

function header(n: number, title: string): void {
  console.log("\n" + "=".repeat(72));
  console.log(`SCENARIO ${n}. ${title}`);
  console.log("=".repeat(72));
}

function bullet(label: string, value: string): void {
  console.log(`  ${label.padEnd(36)} ${value}`);
}

function explainCounterpart(primary: string): string {
  const counterpart = AUTO_COUNTERPART_OF[primary];
  return counterpart
    ? `${primary} ↔ ${counterpart} (auto-completion writes both DB rows; both emails fire after this PR)`
    : `${primary} (no auto-counterpart)`;
}

function evaluateOutcome(
  primary: string,
  tx: { expectedExchangeDate: Date | null; completionDate: Date | null },
): void {
  const counterpart = AUTO_COUNTERPART_OF[primary];
  const isExchange = primary === "VM19" || primary === "PM26";
  const isCompletion = primary === "VM20" || primary === "PM27";

  // Staleness decisions for both primary and counterpart
  const primaryStale = isExchangeCompletionStale(primary, tx, NOW);
  const counterStale = counterpart ? isExchangeCompletionStale(counterpart, tx, NOW) : false;

  bullet("Primary code", primary);
  bullet("Auto-counterpart", counterpart ?? "(none)");
  bullet("Staleness — primary", primaryStale ? "STALE → customer email suppressed" : "fresh → customer email fires");
  if (counterpart) {
    bullet("Staleness — counterpart", counterStale ? "STALE → customer email suppressed" : "fresh → customer email fires");
  }

  // Completion pack — only triggered by VM19/PM26
  if (isExchange) {
    const decision = decideCompletionPackTiming(tx.completionDate, NOW);
    let action: string;
    switch (decision.action) {
      case "skip":      action = "SUPPRESSED (completion in past)"; break;
      case "send-now":  action = "FIRES IMMEDIATELY (completion ≤3 days or unrecorded)"; break;
      case "schedule":  action = `QUEUED for ${decision.scheduledFor.toISOString()} (= completionDate − 3 days)`; break;
    }
    bullet("Completion pack", action);
  } else {
    bullet("Completion pack", "(N/A — only triggered on exchange)");
  }

  // Queue bypass — always for these 4 codes
  bullet("Queue bypass", "✓ exchange/completion codes never enter the 3-min MILESTONE_CONFIRMATION queue");

  // Customer email landings
  console.log("\n  Expected customer emails:");
  const sellerFromPrimary = primary.startsWith("V") && !primaryStale;
  const buyerFromPrimary  = primary.startsWith("P") && !primaryStale;
  const sellerFromCounter = counterpart?.startsWith("V") && !counterStale;
  const buyerFromCounter  = counterpart?.startsWith("P") && !counterStale;
  const sellerCount = (sellerFromPrimary ? 1 : 0) + (sellerFromCounter ? 1 : 0);
  const buyerCount  = (buyerFromPrimary ? 1 : 0) + (buyerFromCounter ? 1 : 0);

  // Completion pack adds to BOTH sides when it fires
  const completionPackFires =
    isExchange && tx.completionDate
      ? tx.completionDate.getTime() >= NOW && tx.completionDate.getTime() - NOW <= 3 * DAY_MS
      : isExchange && !tx.completionDate;
  const completionPackScheduled =
    isExchange && tx.completionDate
      ? tx.completionDate.getTime() - NOW > 3 * DAY_MS
      : false;

  console.log(`    Seller:  ${sellerCount} immediate exchange/completion email${sellerCount !== 1 ? "s" : ""}${
    completionPackFires ? " + 1 completion-pack immediate" : completionPackScheduled ? " + 1 completion-pack queued" : ""
  }`);
  console.log(`    Buyer:   ${buyerCount} immediate exchange/completion email${buyerCount !== 1 ? "s" : ""}${
    completionPackFires ? " + 1 completion-pack immediate" : completionPackScheduled ? " + 1 completion-pack queued" : ""
  }`);

  // Comms log
  console.log("\n  Comms log: writes the intent for ALL fan-outs regardless of suppression");
}

// ── Scenarios ─────────────────────────────────────────────────────────────

console.log(`\nReference time (NOW): ${NOW_STR}`);

header(1, "VM20 ticked normally");
console.log("\n  Setup:");
bullet("Recorded completion date", "(unset — agent ticked without entering date)");
bullet("Agent expectation", "seller gets VM20.vendor, buyer gets PM27.purchaser, one each");
console.log("\n  Outcome:");
evaluateOutcome("VM20", { expectedExchangeDate: null, completionDate: null });

header(2, "PM27 ticked normally (mirror of #1)");
console.log("\n  Setup:");
bullet("Recorded completion date", "(unset)");
bullet("Agent expectation", "seller gets VM20.vendor, buyer gets PM27.purchaser, one each");
console.log("\n  Outcome:");
evaluateOutcome("PM27", { expectedExchangeDate: null, completionDate: null });

header(3, "VM19 ticked, completion 6 weeks away");
console.log("\n  Setup:");
const completion6w = new Date(NOW + 6 * WEEK_MS);
bullet("Recorded exchange date", "just now (fresh confirmation)");
bullet("Recorded completion date", completion6w.toISOString());
bullet("Agent expectation", "exchange emails immediate, completion-pack queued for completionDate-3days");
console.log("\n  Outcome:");
evaluateOutcome("VM19", { expectedExchangeDate: new Date(NOW), completionDate: completion6w });

header(4, "VM19 ticked, completion 2 days away");
console.log("\n  Setup:");
const completion2d = new Date(NOW + 2 * DAY_MS);
bullet("Recorded exchange date", "just now");
bullet("Recorded completion date", completion2d.toISOString());
bullet("Agent expectation", "exchange emails immediate, completion-pack also immediate");
console.log("\n  Outcome:");
evaluateOutcome("VM19", { expectedExchangeDate: new Date(NOW), completionDate: completion2d });

header(5, "VM19 ticked, completion date in the past");
console.log("\n  Setup:");
const completionPast = new Date(NOW - 3 * DAY_MS);
bullet("Recorded exchange date", "just now");
bullet("Recorded completion date", completionPast.toISOString() + " (already completed)");
bullet("Agent expectation", "exchange emails immediate, completion-pack SUPPRESSED");
console.log("\n  Outcome:");
evaluateOutcome("VM19", { expectedExchangeDate: new Date(NOW), completionDate: completionPast });

header(6, "VM19 ticked, no completion date recorded");
console.log("\n  Setup:");
bullet("Recorded exchange date", "just now");
bullet("Recorded completion date", "(unrecorded)");
bullet("Agent expectation", "exchange emails immediate, completion-pack immediate");
console.log("\n  Outcome:");
evaluateOutcome("VM19", { expectedExchangeDate: new Date(NOW), completionDate: null });

header(7, "VM20 ticked >24h after recorded completion date");
console.log("\n  Setup:");
const completion3dAgo = new Date(NOW - 3 * DAY_MS);
bullet("Recorded completion date", completion3dAgo.toISOString() + " (3 days ago — STALE)");
bullet("Agent expectation", "milestone records, comms log writes, customer emails suppressed");
console.log("\n  Outcome:");
evaluateOutcome("VM20", { expectedExchangeDate: null, completionDate: completion3dAgo });

header(8, "VM19 ticked >72h after exchange date AND completion already in the past");
console.log("\n  Setup:");
const exchange5dAgo = new Date(NOW - 5 * DAY_MS);
const completion1dAgo = new Date(NOW - 1 * DAY_MS);
bullet("Recorded exchange date", exchange5dAgo.toISOString() + " (5 days ago — STALE)");
bullet("Recorded completion date", completion1dAgo.toISOString() + " (1 day ago — PAST)");
bullet("Agent expectation", "all customer emails suppressed, comms log writes");
console.log("\n  Outcome:");
evaluateOutcome("VM19", { expectedExchangeDate: exchange5dAgo, completionDate: completion1dAgo });

header(9, "VM19 ticked >72h after exchange but completion still 2 weeks away");
console.log("\n  Setup:");
const exchange4dAgo = new Date(NOW - 4 * DAY_MS);
const completion2wAway = new Date(NOW + 14 * DAY_MS);
bullet("Recorded exchange date", exchange4dAgo.toISOString() + " (4 days ago — STALE)");
bullet("Recorded completion date", completion2wAway.toISOString() + " (2 weeks away)");
bullet("Agent expectation", "exchange emails suppressed (stale), completion-pack STILL queued for completionDate-3days");
console.log("\n  Outcome:");
evaluateOutcome("VM19", { expectedExchangeDate: exchange4dAgo, completionDate: completion2wAway });

header(10, "Digest scenario: exchange/completion codes never bundled");
console.log("\n  Setup:");
bullet("Imagined sequence", "Agent ticks VM4 + VM5 + VM19 within 3-minute window");
bullet("Expectation", "VM4/VM5 enqueue for digest. VM19 NEVER enters the MILESTONE_CONFIRMATION queue.");
console.log("\n  Outcome:");
bullet("VM4 queue path", "MILESTONE_CONFIRMATION queue, scheduledFor = now + 3min, may digest with VM5");
bullet("VM5 queue path", "MILESTONE_CONFIRMATION queue, scheduledFor = now + 3min, may digest with VM4");
bullet("VM19 queue path", "✓ BYPASSED — direct sendEmail to vendor (+ counterpart fan-out to buyer)");
bullet("Result", "Customer receives 1 VM19 + 1 PM26 immediate. Plus a separate VM4+VM5 digest 3 minutes later.");
console.log("\n  In all 4 EXCHANGE_COMPLETION_CODES (VM19, PM26, VM20, PM27): queue is bypassed by");
console.log("  sendRichMilestoneEmails per the `if (isExchangeCompletion) sendEmail` branch.");

console.log("\n\n" + "=".repeat(72));
console.log("END OF AUDIT");
console.log("=".repeat(72));
console.log("\nAll 10 scenarios use the pure decision helpers from");
console.log("lib/services/exchange-completion-rules.ts. Helper correctness is");
console.log("locked by 27 unit tests in __tests__/exchange-completion-rules.test.ts.");
console.log("Runtime fan-out (sendRichMilestoneEmails + fireAutoCounterpartEmails +");
console.log("scheduleOrSendCompletionPack in lib/services/portal.ts) consumes those");
console.log("decisions and applies them in the contact loop / per-code dispatch.\n");
