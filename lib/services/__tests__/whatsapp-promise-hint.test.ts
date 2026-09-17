/**
 * @jest-environment node
 */

import { PROMISE_HINT } from "../whatsapp-promise-hint";

describe("PROMISE_HINT pre-filter", () => {
  it("matches the polite 'I shall' phrasing that was previously skipped", () => {
    // The exact message that failed to become a to-do (2026-09-17).
    expect(PROMISE_HINT.test("Hi all, I shall speak with the seller's solicitor first thing and report back.")).toBe(true);
  });

  it("matches the common commitment phrasings", () => {
    for (const s of [
      "I'll chase the solicitor tomorrow",
      "I will check on the dimensions now for you",
      "I'm going to call the buyer this afternoon",
      "I am going to email them today",
      "I plan to speak to the vendor tomorrow",
      "I intend to ring the broker on Friday",
      "Let me check that for you",
      "Leave it with me, I'll sort it",
      "Will chase the seller's side today",
      "Shall speak to the agent first thing",
    ]) {
      expect(PROMISE_HINT.test(s)).toBe(true);
    }
  });

  // The pre-filter is deliberately coarse — it only gates the AI read, which then
  // judges intent/who. So it rightly ignores messages with no commitment phrasing
  // at all. (It's fine that e.g. "the solicitor will send…" slips through the
  // gate; the AI then rejects it as someone else's action.)
  it("does NOT match messages with no commitment phrasing", () => {
    for (const s of [
      "Thanks for the update",
      "Do you know if the buyer has sent the funds?",
      "Great news, congratulations!",
      "The searches have come back clear",
      "No update since Friday just yet",
    ]) {
      expect(PROMISE_HINT.test(s)).toBe(false);
    }
  });
});
