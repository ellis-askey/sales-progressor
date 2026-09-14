/**
 * @jest-environment node
 */

// Locks the client-facing wording for the passive portal updates (chase +
// enquiry echoes). Reviewed with Ellis 2026-09-14 (the phrasing matrix).

import {
  solicitorChaseLine,
  clientChaseLine,
  enquiryEchoLine,
  hasSolicitorEchoCopy,
  hasClientEchoCopy,
} from "../chase-echo-copy";

describe("solicitorChaseLine", () => {
  it("names the firm and reads 'your solicitor' for the owning side", () => {
    expect(solicitorChaseLine({ code: "VM7", viewerSide: "vendor", chasedSide: "vendor", firmName: "Ashcroft Legal" }))
      .toBe("We've followed up with your solicitor, Ashcroft Legal, about issuing the draft contract pack.");
  });
  it("reads the role for the other side", () => {
    expect(solicitorChaseLine({ code: "VM7", viewerSide: "purchaser", chasedSide: "vendor", firmName: "Ashcroft Legal" }))
      .toBe("We've followed up with the seller's solicitor, Ashcroft Legal, about issuing the draft contract pack.");
  });
  it("uses the own-side clause variant where one exists (PM11)", () => {
    expect(solicitorChaseLine({ code: "PM11", viewerSide: "purchaser", chasedSide: "purchaser", firmName: "Bell & Co" }))
      .toBe("We've followed up with your solicitor, Bell & Co, about your mortgage offer.");
    expect(solicitorChaseLine({ code: "PM11", viewerSide: "vendor", chasedSide: "purchaser", firmName: "Bell & Co" }))
      .toBe("We've followed up with the buyer's solicitor, Bell & Co, about the mortgage offer.");
  });
  it("drops the appositive when there's no firm on file", () => {
    expect(solicitorChaseLine({ code: "PM8", viewerSide: "purchaser", chasedSide: "purchaser", firmName: null }))
      .toBe("We've followed up with your solicitor about getting the searches ordered.");
  });
  it("returns null for a code we have no copy for", () => {
    expect(solicitorChaseLine({ code: "PM99", viewerSide: "vendor", chasedSide: "purchaser", firmName: null })).toBeNull();
  });
});

describe("clientChaseLine (other side only)", () => {
  it("phrases the chased client by role", () => {
    expect(clientChaseLine({ code: "PM4", chasedSide: "purchaser", stepLabel: null }))
      .toBe("We've followed up with the buyer about putting funds with their solicitor.");
    expect(clientChaseLine({ code: "VM6", chasedSide: "vendor", stepLabel: null }))
      .toBe("We've followed up with the seller about returning their property information forms.");
  });
});

describe("enquiryEchoLine", () => {
  it("replies sent: seller sent, both sides", () => {
    expect(enquiryEchoLine("replies_sent", "vendor")).toBe("Your solicitor has sent their replies to the buyer's solicitor's enquiries.");
    expect(enquiryEchoLine("replies_sent", "purchaser")).toBe("The seller's solicitor has sent replies to your solicitor's enquiries.");
  });
  it("partial replies: with more to follow", () => {
    expect(enquiryEchoLine("partial_replies", "vendor")).toBe("Your solicitor has sent over some of the replies to the buyer's enquiries, with more to follow.");
    expect(enquiryEchoLine("partial_replies", "purchaser")).toBe("Some replies have come back from the seller's side, with more to follow.");
  });
  it("raise further: buyer asked, both sides", () => {
    expect(enquiryEchoLine("raised", "vendor")).toBe("The buyer's solicitor has raised some further enquiries with your solicitor.");
    expect(enquiryEchoLine("raised", "purchaser")).toBe("Your solicitor has raised some further enquiries with the seller's side.");
  });
});

describe("copy coverage helpers", () => {
  it("knows which steps have curated copy", () => {
    expect(hasSolicitorEchoCopy("VM7")).toBe(true);
    expect(hasSolicitorEchoCopy("PM99")).toBe(false);
    expect(hasClientEchoCopy("PM4")).toBe(true);
    expect(hasClientEchoCopy("PM8")).toBe(false); // PM8 is a solicitor step, not a client one
  });
});
