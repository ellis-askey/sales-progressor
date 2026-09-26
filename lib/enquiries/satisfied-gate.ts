// Gate for the "all enquiries satisfied" chase (PM20 → buyer's solicitor).
//
// The general reminder rule for PM20 comes due purely on PM20's availability +
// grace, with no awareness of the enquiry tracker — so it would chase about
// confirming "all enquiries satisfied" while the ball is actually still in the
// SELLER's court (replies not yet in). This gate makes PM20 tracker-aware
// (critique #63).
//
// Two modes, decided by whether anyone has ENGAGED with the tracker (logged any
// movement — partial replies, replies sent, a court move, a correction, a
// solicitor reply). A fresh tracker opens with zero movements.
//
//   • Hands-off (0 movements): the agent isn't working the back-and-forth in the
//     tracker, so we don't wait on it forever — the chase fires 4 weeks after
//     enquiries were raised, whatever the court says.
//
//   • Engaged (>=1 movement): they're using the tracker, so we follow the proper
//     flow — chase only when the ball is with the buyer's solicitor, at least 3
//     weeks have passed since raised, and at least 5 working days since the
//     seller's full replies landed. Never while the ball is in the seller's
//     court. A re-raise flips the ball back and holds it again; it resumes 5
//     working days after replies return.
//
// The tracker-driven reply-loop chase (lib/enquiries/chase.ts) stays the
// court-aware source for the back-and-forth; PM20 is the final gate, so the two
// never double-chase.

import { addWorkingDays } from "@/lib/emails/working-hours";

export const ENQUIRY_SATISFIED_CODE = "PM20";

const DAY = 86_400_000;
const RAISED_FLOOR_DAYS = 21;              // engaged: never within 3 weeks of raising
const HANDS_OFF_FALLBACK_DAYS = 28;        // untouched: fire 4 weeks after raising
export const ENQUIRY_SATISFIED_AFTER_REPLIES_WORKING_DAYS = 5; // wd after ball returns to buyer

export type EnquirySatisfiedGate = {
  currentlyWith: "seller_solicitor" | "buyer_solicitor";
  openedAt: Date;
  // When the ball most recently flipped to the buyer's solicitor (full replies
  // in). Null when it has never flipped to the buyer.
  flipToBuyerAt: Date | null;
  // How many movements have been logged on the tracker (0 = nobody has engaged
  // with the back-and-forth yet). Tracker creation logs none, and the system's
  // own chases don't log movements, so 0 genuinely means "untouched by a human".
  movementCount: number;
};

// Pure decision — no I/O. `gate` is null only in the (practically impossible)
// case that a file reaches PM20 with no tracker at all; we allow the default
// behaviour then rather than silently hold it.
export function enquirySatisfiedChaseAllowed(
  gate: EnquirySatisfiedGate | null,
  now: Date = new Date(),
): boolean {
  if (!gate) return true; // no tracker → don't gate; behave as before
  // Hands-off fallback: nobody's worked the tracker → fire 4 weeks after raised.
  if (gate.movementCount === 0) {
    return now.getTime() - gate.openedAt.getTime() >= HANDS_OFF_FALLBACK_DAYS * DAY;
  }
  // Engaged flow.
  if (gate.currentlyWith !== "buyer_solicitor") return false; // never in the seller's court
  if (now.getTime() - gate.openedAt.getTime() < RAISED_FLOOR_DAYS * DAY) return false;
  if (!gate.flipToBuyerAt) return false;
  if (addWorkingDays(gate.flipToBuyerAt, ENQUIRY_SATISFIED_AFTER_REPLIES_WORKING_DAYS) > now) return false;
  return true;
}

// The date the PM20 reminder should be deferred to while the gate isn't met. The
// reminder engine sets nextDueDate to this so every surface (reminders tab,
// work-queue, hub, tab badge) and the client-chase cron keep it out of the "due"
// bucket until it's genuinely time. A court flip re-triggers the engine
// (logEnquiryMovement), so an engaged file recomputes the moment replies land.
export function enquirySatisfiedDeferUntil(
  gate: EnquirySatisfiedGate | null,
  now: Date = new Date(),
): Date {
  // No tracker → allowed, so no defer needed; return now (due).
  if (!gate) return now;
  // Hands-off: park exactly at the 4-week fallback point.
  if (gate.movementCount === 0) {
    return new Date(gate.openedAt.getTime() + HANDS_OFF_FALLBACK_DAYS * DAY);
  }
  // Engaged, ball with the buyer: the exact earliest-allowed date — the later of
  // the 3-week floor and 5 working days after replies landed.
  if (gate.currentlyWith === "buyer_solicitor" && gate.flipToBuyerAt) {
    const raisedFloor = new Date(gate.openedAt.getTime() + RAISED_FLOOR_DAYS * DAY);
    const repliesFloor = addWorkingDays(gate.flipToBuyerAt, ENQUIRY_SATISFIED_AFTER_REPLIES_WORKING_DAYS);
    return raisedFloor.getTime() > repliesFloor.getTime() ? raisedFloor : repliesFloor;
  }
  // Engaged, ball with the seller (a re-raise): can't chase until it returns to
  // the buyer. Park far out; a court flip re-triggers the engine (every flip goes
  // through logEnquiryMovement) to recompute the moment replies land. The
  // seller's-solicitor reply chase keeps nudging + escalates to the owner
  // meanwhile, so nothing is dropped.
  return new Date(now.getTime() + 365 * DAY);
}
