/**
 * @jest-environment node
 */

import { extractInnerEmails, looksForwarded } from "../forwarded";

describe("extractInnerEmails", () => {
  it("pulls the sender/recipients from a forwarded header block", () => {
    const body = [
      "Begin forwarded message:",
      "",
      "From: kent@collective.legal",
      "Date: 8 September 2026 at 09:54:14 BST",
      "To: lucy.madley@neves.co.uk",
      "Cc: danny@dannybaileyproperty.co.uk",
      "Subject: Re: 8 Brambling Crescent",
    ].join("\n");
    expect(extractInnerEmails(body).sort()).toEqual(
      ["danny@dannybaileyproperty.co.uk", "kent@collective.legal", "lucy.madley@neves.co.uk"].sort(),
    );
  });

  it("handles 'Name <email>' and '>'-quoted header lines", () => {
    const body = "> From: Sara Anwar <kent@collective.legal>\n> To: Ellis <ellis@thesalesprogressor.co.uk>";
    expect(extractInnerEmails(body).sort()).toEqual(
      ["ellis@thesalesprogressor.co.uk", "kent@collective.legal"].sort(),
    );
  });

  it("ignores addresses in ordinary prose", () => {
    expect(extractInnerEmails("Please email me at bob@example.com when ready.")).toEqual([]);
  });

  it("is empty for no body", () => {
    expect(extractInnerEmails("")).toEqual([]);
    expect(extractInnerEmails(null)).toEqual([]);
  });
});

describe("looksForwarded", () => {
  it("detects Fw:/Fwd: subjects", () => {
    expect(looksForwarded({ subject: "Fwd: 8 Brambling Crescent", body: "" })).toBe(true);
    expect(looksForwarded({ subject: "FW: update", body: "" })).toBe(true);
  });
  it("detects a forwarded/From: block in the body", () => {
    expect(looksForwarded({ subject: "Re: x", body: "Begin forwarded message:\nFrom: a@b.com" })).toBe(true);
    expect(looksForwarded({ subject: "Re: x", body: "From: kent@collective.legal\nTo: y" })).toBe(true);
  });
  it("is false for a plain message", () => {
    expect(looksForwarded({ subject: "Update", body: "Hi, all done thanks." })).toBe(false);
  });
});
