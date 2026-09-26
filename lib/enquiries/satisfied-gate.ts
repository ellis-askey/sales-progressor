// Gate for the "all enquiries satisfied" chase (PM20 → buyer's solicitor).
//
// The general reminder rule for PM20 comes due purely on PM20's availability +
// grace, with no awareness of the enquiry tracker — so it would chase the
// buyer's solicitor to "confirm all enquiries satisfied" while the ball is
// actually still in the SELLER's court (replies not yet in). This gate makes
// the PM20 chase tracker-aware (critique #63).
//
// The chase is allowed ONLY when all of:
//   1. the ball is with the buyer's solicitor (seller has sent ALL replies —
//      a partial keeps the ball in the seller's court, so it's excluded);
//   2. at least 3 weeks have passed since enquiries were raised (openedAt);
//   3. at least 5 working days have passed since the ball flipped to the
//      buyer's solicitor (the seller's full replies landed).
// A re-raise flips the ball back to the seller → condition 1 fails → suppressed;
// it resumes 5 working days after the ball returns to the buyer (the "most
// recent flip" timestamp resets the clock on its own).
//
// The tracker-driven reply-loop chase (lib/enquiries/chase.ts) stays the
// court-aware source for the back-and-forth; PM20 is the final gate, so the two
// never double-chase the same party.

import { addWorkingDays } from "@/lib/emails/working-hours";

export const ENQUIRY_SATISFIED_CODE = "PM20";

const RAISED_FLOOR_DAYS = 21; // never within 3 weeks of enquiries being raised
export const ENQUIRY_SATISFIED_AFTER_REPLIES_WORKING_DAYS = 5; // wd after ball returns to buyer

export type EnquirySatisfiedGate = {
  currentlyWith: "seller_solicitor" | "buyer_solicitor";
  openedAt: Date;
  // When the ball most recently flipped to the buyer's solicitor (full replies
  // in). Null when it has never flipped to the buyer.
  flipToBuyerAt: Date | null;
};

// Pure decision — no I/O. `gate` is null when there's no open tracker; since
// PM20 can't be reached without enquiries first being raised (which opens the
// tracker), a null gate means we can't confirm the ball is with the buyer, so
// we don't chase. This can't drop a real chase — PM20 is unreachable without
// the tracker existing.
export function enquirySatisfiedChaseAllowed(
  gate: EnquirySatisfiedGate | null,
  now: Date = new Date(),
): boolean {
  if (!gate) return false;
  // Hard rule: never while the ball is in the seller's court.
  if (gate.currentlyWith !== "buyer_solicitor") return false;
  // At least 3 weeks since enquiries were raised.
  if (now.getTime() - gate.openedAt.getTime() < RAISED_FLOOR_DAYS * 86_400_000) return false;
  // At least 5 working days since the seller's full replies reached the buyer.
  if (!gate.flipToBuyerAt) return false;
  if (addWorkingDays(gate.flipToBuyerAt, ENQUIRY_SATISFIED_AFTER_REPLIES_WORKING_DAYS) > now) return false;
  return true;
}

// The date the PM20 reminder should be deferred to while the gate isn't met.
// The reminder engine sets nextDueDate to this so every surface (reminders tab,
// work-queue, hub, tab badge, client-chase cron) keeps it out of the "due"
// bucket until it's genuinely time. A court flip re-triggers the engine
// (logEnquiryMovement), so this recomputes the moment replies land.
export function enquirySatisfiedDeferUntil(
  gate: EnquirySatisfiedGate | null,
  now: Date = new Date(),
): Date {
  const raisedFloor = gate ? new Date(gate.openedAt.getTime() + RAISED_FLOOR_DAYS * 86_400_000) : null;
  // Ball with the buyer: we know the exact earliest-allowed date — the later of
  // the 3-week floor and 5 working days after replies landed.
  if (gate && gate.currentlyWith === "buyer_solicitor" && gate.flipToBuyerAt) {
    const repliesFloor = addWorkingDays(gate.flipToBuyerAt, ENQUIRY_SATISFIED_AFTER_REPLIES_WORKING_DAYS);
    return raisedFloor && raisedFloor.getTime() > repliesFloor.getTime() ? raisedFloor : repliesFloor;
  }
  // Ball with the seller (or no tracker): can't chase until it returns to the
  // buyer. Park it in the future (never before the 3-week floor); the court-flip
  // trigger recomputes it the moment full replies land, so this is only a safe
  // holding date, not the real due date.
  const parking = addWorkingDays(now, 10);
  return raisedFloor && raisedFloor.getTime() > parking.getTime() ? raisedFloor : parking;
}
