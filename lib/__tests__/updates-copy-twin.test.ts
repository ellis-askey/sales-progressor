/**
 * @jest-environment node
 *
 * Twin-close (mirrored half of a paired step) wording. A null confirmer must
 * render as a plain statement of fact — never "You confirmed…" for someone who
 * didn't, never a firm apparently confirming the other firm's step (the
 * misattribution the founder caught, 2026-09-17). Locks the approved strings.
 */

import { confirmationSentence, portalConfirmationSentence } from "../updates-copy";
import { confirmationSubtext, confirmerBucket } from "../milestone-confirmation-subtext";

describe("agent-surface twin sentences (null confirmer)", () => {
  it("renders the pack pair as plain facts", () => {
    expect(
      confirmationSentence({ code: "VM7", side: "vendor", confirmer: null, sideContacts: [], milestoneName: "x" })
    ).toBe("The seller's solicitor has issued the draft contract pack");
    expect(
      confirmationSentence({ code: "PM7", side: "purchaser", confirmer: null, sideContacts: [], milestoneName: "x" })
    ).toBe("The buyer's solicitor has received the draft contract pack");
  });
  it("renders the enquiries twin as its general clause", () => {
    expect(
      confirmationSentence({ code: "VM21", side: "vendor", confirmer: null, sideContacts: [], milestoneName: "x" })
    ).toBe("All enquiries are now satisfied");
  });
});

describe("portal twin sentences (null confirmer)", () => {
  it("own side reads second person with no confirmer named", () => {
    expect(
      portalConfirmationSentence({ code: "VM7", side: "vendor", viewerSide: "vendor", confirmer: null, milestoneName: "x" })
    ).toBe("Your solicitor has issued the draft contract pack");
    expect(
      portalConfirmationSentence({ code: "PM7", side: "purchaser", viewerSide: "purchaser", confirmer: null, milestoneName: "x" })
    ).toBe("Your solicitor has received the draft contract pack");
  });
  it("other side keeps the existing neutral voice", () => {
    expect(
      portalConfirmationSentence({ code: "VM7", side: "vendor", viewerSide: "purchaser", confirmer: null, milestoneName: "x" })
    ).toBe("The seller's solicitor has issued the draft contract pack");
  });
});

describe("portal honest mirror (#278/#279 reflected asymmetric pairs)", () => {
  it("buyer's auto-closed pack step states the seller's confirmed action, not the buyer's", () => {
    // Seller confirmed VM7 (issued); the buyer's PM7 closed automatically. The
    // buyer must not be told "your solicitor has received" — nobody confirmed that.
    expect(
      portalConfirmationSentence({
        code: "PM7", side: "purchaser", viewerSide: "purchaser", reflected: true,
        confirmer: { kind: "agent", name: "Ellis Askey" }, milestoneName: "x",
      })
    ).toBe("Ellis Askey confirmed the seller's solicitor has issued the draft contract pack");
  });
  it("seller's auto-closed pack step states the buyer's confirmed action", () => {
    expect(
      portalConfirmationSentence({
        code: "VM7", side: "vendor", viewerSide: "vendor", reflected: true,
        confirmer: { kind: "agent", name: "Ellis Askey" }, milestoneName: "x",
      })
    ).toBe("Ellis Askey confirmed the buyer's solicitor has received the draft contract pack");
  });
  it("seller's auto-closed enquiries step states that the buyer raised them", () => {
    expect(
      portalConfirmationSentence({
        code: "VM10", side: "vendor", viewerSide: "vendor", reflected: true,
        confirmer: { kind: "agent", name: "Ellis Askey" }, milestoneName: "x",
      })
    ).toBe("Ellis Askey confirmed the buyer's solicitor has raised initial enquiries with your solicitor");
  });
  it("drops to a nameless fact when the mirror carries no confirmer (pre-#278 data)", () => {
    expect(
      portalConfirmationSentence({
        code: "PM7", side: "purchaser", viewerSide: "purchaser", reflected: true,
        confirmer: null, milestoneName: "x",
      })
    ).toBe("The seller's solicitor has issued the draft contract pack");
  });
  it("leaves a simultaneous-pair mirror on its honest own-side wording (no restate)", () => {
    // Completion is simultaneous — "your purchase has completed" is true for the
    // buyer, so a reflected PM27 must NOT be restated.
    expect(
      portalConfirmationSentence({
        code: "PM27", side: "purchaser", viewerSide: "purchaser", reflected: true,
        confirmer: { kind: "agent", name: "Ellis Askey" }, milestoneName: "x",
      })
    ).toBe("Ellis Askey confirmed your purchase has completed");
  });
});

describe("twin subtext (bucket D)", () => {
  it("null confirmer maps to the twin bucket", () => {
    expect(confirmerBucket(null)).toBe("D");
  });
  it("both pack steps carry the approved twin line", () => {
    const line = "The draft pack is now with the buyer's solicitor for review.";
    expect(confirmationSubtext("VM7", "D")).toBe(line);
    expect(confirmationSubtext("PM7", "D")).toBe(line);
  });
});
