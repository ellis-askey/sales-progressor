/**
 * @jest-environment node
 */

// Intention rebuild (2026-10-19): the PROMISE_HINT phrase gate is gone — the
// model judges intention on every sent message. These tests cover what remains
// pure: the worth-reading skim (only the obviously pointless is skipped) and
// the option-B redaction applied to third-party context.

import { isWorthReading, buildRedactionTokens, redactForAi } from "../whatsapp-promise-hint";

describe("isWorthReading", () => {
  it("keeps every phrasing that could carry a commitment — intention is the model's job", () => {
    for (const s of [
      "I'll chase the solicitor tomorrow",
      "Chasing first thing",
      "Going to give them a nudge Monday",
      "Will have an answer by Friday",
      "On it - speaking to them today",
      "Leave it with me",
      "Yep, first thing tomorrow 🙏", // short reply — context makes it a promise
      "ok", // acceptance of a request can be a commitment
      "will do",
      "The searches have come back clear", // status update — the MODEL rejects it, not the gate
    ]) {
      expect(isWorthReading(s)).toBe(true);
    }
  });

  it("skips what cannot contain a commitment", () => {
    for (const s of [
      "",
      " ",
      "🙏",
      "👍👍",
      "...",
      "[image]",
      "[voice note]",
      "Thanks",
      "thank you so much!",
      "Cheers 🙏",
      "No worries",
      "Brilliant!",
      "lol",
      "Morning",
    ]) {
      expect(isWorthReading(s)).toBe(false);
    }
  });
});

describe("redaction (privacy option B)", () => {
  const tokens = buildRedactionTokens({
    propertyAddress: "4 Quennell House, Sheldon Way, Berkhamsted, HP4 1FF",
    names: ["Sarah Harvey", "Johann Sanseau", "Machins Solicitors"],
  });

  it("strips names, address segments, firms, phones and emails from context", () => {
    const out = redactForAi(
      "Sarah Harvey said Machins ordered the pack for 4 Quennell House. Call her on 07700 900123 or sarah@example.com",
      tokens,
    );
    expect(out).not.toMatch(/Sarah|Harvey|Machins|Quennell|07700|@example/);
    expect(out).toContain("[redacted]");
    // The verbs/asks survive — that's what the model needs.
    expect(out).toContain("ordered the pack");
  });

  it("does not shred ordinary words (short/stopword tokens are excluded)", () => {
    const out = redactForAi("Can you check on the survey for me?", tokens);
    expect(out).toBe("Can you check on the survey for me?");
  });

  it("redacts longest tokens first so firm names go before surname fragments", () => {
    const out = redactForAi("Machins Solicitors are slow", tokens);
    expect(out.startsWith("[redacted]")).toBe(true);
  });
});
