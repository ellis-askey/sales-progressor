// Turn OUR confirmed nine-step ticks on a neighbour's sale into a short, correctly
// timed update for that sale's agent: a question or two when they're on the email,
// or a plain report of what we've noted when they're not.
//
// The nine ticks (lib/chain/check-in-steps.ts) group into four tracks. We ask
// about the next unconfirmed beat on tracks that have STARTED, preferring the most
// advanced (closest to exchange), capped at two. Nothing confirmed → ask the
// opener; everything confirmed → ask about exchange readiness. Keys must match
// ChainNodeStepMark.stepKey (never rename without migrating).

import { CHECK_IN_STEPS } from "@/lib/chain/check-in-steps";

// A beat is askable only once its `requires` are confirmed — this encodes the
// real order (contracts don't go out until searches are back and enquiries are
// satisfied; "all set to exchange" only once contracts are out), so confirming
// an early step like the draft pack never jumps us to a premature late question.
type QBeat = { keys: string[]; idx: number; q: string; requires?: string[] };

// Each track's beats run earliest → latest. idx is the beat's place in the
// nine-step order.
const Q_TRACKS: QBeat[][] = [
  [
    { keys: ["dcp_issued"], idx: 0, q: "Has the draft contract pack been issued?" },
    { keys: ["contracts_issued"], idx: 6, q: "Have contracts gone out for signing?", requires: ["searches_received", "enquiries_satisfied"] },
    { keys: ["seller_signed_returned", "buyer_signed_returned"], idx: 8, q: "Are you all set to exchange?", requires: ["contracts_issued"] },
  ],
  [
    { keys: ["searches_ordered"], idx: 1, q: "Have searches been ordered?" },
    { keys: ["searches_received"], idx: 3, q: "Have the search results come back?" },
  ],
  [{ keys: ["finances_arranged"], idx: 2, q: "Is the buyer's finance in place?" }],
  [
    { keys: ["enquiries_raised"], idx: 4, q: "Have enquiries been raised?" },
    { keys: ["enquiries_satisfied"], idx: 5, q: "Are all enquiries satisfied now?" },
  ],
];

const ALL_KEYS = CHECK_IN_STEPS.map((s) => s.key);
const DCP_Q = "Has the draft contract pack been issued?";
const ALL_SET_Q = "Are you all set to exchange?";

/**
 * Up to two questions for the agent who holds this sale, from the step keys we've
 * confirmed about it. Correctly timed: a track already in motion is asked about
 * its immediate next beat (preferring the most advanced) before an un-started
 * track's opener; nothing confirmed asks about the draft contract pack; everything
 * confirmed asks about exchange readiness.
 */
export function chainQuestionsFor(confirmed: readonly string[]): string[] {
  const done = new Set(confirmed);
  if (done.size === 0) return [DCP_Q];
  if (ALL_KEYS.every((k) => done.has(k))) return [ALL_SET_Q];

  const cands: { q: string; score: number }[] = [];
  for (const beats of Q_TRACKS) {
    const started = beats[0].keys.some((k) => done.has(k));
    const next = beats.find((b) => !b.keys.every((k) => done.has(k)));
    if (!next) continue; // this track is fully confirmed
    if (next.requires && !next.requires.every((k) => done.has(k))) continue; // not yet its time
    // A track in motion outranks an un-started opener; among in-motion tracks the
    // more advanced wins, among openers the earliest-missing wins.
    cands.push({ q: next.q, score: started ? 1000 + next.idx : 100 - next.idx });
  }
  if (cands.length === 0) return [ALL_SET_Q];

  const seen = new Set<string>();
  return cands
    .sort((a, b) => b.score - a.score)
    .filter((c) => (seen.has(c.q) ? false : (seen.add(c.q), true)))
    .slice(0, 2)
    .map((c) => c.q);
}

// Report (agent not on the email): the furthest confirmed beat per track, as a
// short noun phrase — what we've noted, no question.
const REPORT_TRACKS: { keys: string[]; label: string }[][] = [
  [
    { keys: ["dcp_issued"], label: "the draft contract pack issued" },
    { keys: ["contracts_issued"], label: "contracts out for signing" },
    { keys: ["seller_signed_returned", "buyer_signed_returned"], label: "contracts signed and returned" },
  ],
  [
    { keys: ["searches_ordered"], label: "searches ordered" },
    { keys: ["searches_received"], label: "search results received" },
  ],
  [{ keys: ["finances_arranged"], label: "finances in place" }],
  [
    { keys: ["enquiries_raised"], label: "enquiries raised" },
    { keys: ["enquiries_satisfied"], label: "all enquiries satisfied" },
  ],
];

function joinPhrases(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/** What we've noted on this sale, for an agent who isn't on the email. */
export function chainReportFor(confirmed: readonly string[]): string {
  const done = new Set(confirmed);
  const labels: string[] = [];
  for (const beats of REPORT_TRACKS) {
    let furthest: string | null = null;
    for (const b of beats) if (b.keys.some((k) => done.has(k))) furthest = b.label;
    if (furthest) labels.push(furthest);
  }
  return labels.length ? `we have ${joinPhrases(labels)}` : "nothing confirmed here yet";
}
