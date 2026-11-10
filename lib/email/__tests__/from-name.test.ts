/**
 * @jest-environment node
 */

import { buildFrom, rebrandSenderDisplay, stripAgencyLegalSuffix } from "../from-name";

describe("stripAgencyLegalSuffix", () => {
  it("strips UK legal suffixes", () => {
    expect(stripAgencyLegalSuffix("Akeman Residential Ltd")).toBe("Akeman Residential");
    expect(stripAgencyLegalSuffix("Foo LLP")).toBe("Foo");
    expect(stripAgencyLegalSuffix("Bar PLC")).toBe("Bar");
  });
  it("leaves a plain name untouched", () => {
    expect(stripAgencyLegalSuffix("Akeman Residential")).toBe("Akeman Residential");
  });
});

describe("buildFrom", () => {
  it("builds Display <address>", () => {
    expect(buildFrom("Ellis at Akeman Residential", "ellis@akeman-residential.co.uk")).toBe(
      "Ellis at Akeman Residential <ellis@akeman-residential.co.uk>",
    );
  });
  it("quotes a display name with header-breaking characters", () => {
    expect(buildFrom("Foo, Bar", "a@b.com")).toBe('"Foo, Bar" <a@b.com>');
  });
});

describe("rebrandSenderDisplay", () => {
  // The bug this fixes: an outsourced file with no assigned progressor resolved
  // its agency sender to the file's AGENT (Jack) over the agency's verified
  // address — so whoever opened the compose drawer sent as "Jack". Re-branding
  // keeps the deliverable address but names the email after the real sender.
  it("keeps the authenticated address, swaps the display to the sender", () => {
    const agencyResolved = "Jack at Akeman Residential <ellis@akeman-residential.co.uk>";
    expect(rebrandSenderDisplay(agencyResolved, "Ellis at Akeman Residential")).toBe(
      "Ellis at Akeman Residential <ellis@akeman-residential.co.uk>",
    );
    expect(rebrandSenderDisplay(agencyResolved, "Laura at Akeman Residential")).toBe(
      "Laura at Akeman Residential <ellis@akeman-residential.co.uk>",
    );
  });

  it("handles a quoted agency display name", () => {
    const resolved = '"Jack, Akeman" <updates@akeman.co.uk>';
    expect(rebrandSenderDisplay(resolved, "Ruby at Boardwalk")).toBe(
      "Ruby at Boardwalk <updates@akeman.co.uk>",
    );
  });

  it("re-quotes when the NEW display needs quoting", () => {
    expect(rebrandSenderDisplay("X <a@b.com>", "Foo, Bar")).toBe('"Foo, Bar" <a@b.com>');
  });

  it("returns the input unchanged when there is no parseable <address>", () => {
    expect(rebrandSenderDisplay("not-an-address-form", "Someone")).toBe("not-an-address-form");
  });
});
