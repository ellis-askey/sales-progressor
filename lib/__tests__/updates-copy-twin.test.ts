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
