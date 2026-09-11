/**
 * @jest-environment node
 */

import { cleanIngestedEmail } from "../clean-inbound";

describe("cleanIngestedEmail", () => {
  it("keeps the new message and cuts an 'On … wrote:' quote chain", () => {
    const raw = [
      "Hi Sara,",
      "",
      "Any update on the enquiries?",
      "",
      "On 3 Sep 2026, at 11:01, Asim Haque <asim95@hotmail.co.uk> wrote:",
      "",
      "Hi both, previous message here.",
      "On 28 Aug 2026, at 15:18, Asim Haque wrote:",
      "even older",
    ].join("\n");
    expect(cleanIngestedEmail(raw)).toBe("Hi Sara,\n\nAny update on the enquiries?");
  });

  it("cuts an Outlook From:/Sent:/To: header block", () => {
    const raw = [
      "Thanks, that's received.",
      "",
      "From: kent@collective.legal",
      "Sent: 8 September 2026 09:54",
      "To: lucy.madley@neves.co.uk",
      "Subject: Re: 8 Brambling Crescent",
      "",
      "old quoted body",
    ].join("\n");
    expect(cleanIngestedEmail(raw)).toBe("Thanks, that's received.");
  });

  it("cuts the -----Original Message----- divider", () => {
    const raw = "New reply.\n\n-----Original Message-----\nFrom: someone\nold stuff";
    expect(cleanIngestedEmail(raw)).toBe("New reply.");
  });

  it("strips a confidentiality disclaimer footer", () => {
    const raw =
      "Please find the replies attached.\n\nIMPORTANT: The contents of this email and any attachments are confidential. They are intended for the named recipient(s) only.";
    expect(cleanIngestedEmail(raw)).toBe("Please find the replies attached.");
  });

  it("strips a '-- ' signature delimiter but keeps a normal sign-off", () => {
    const raw = "Message body.\n\nKind regards,\nSara\n\n-- \nSara Anwar | Collective Legal | 0123 456";
    expect(cleanIngestedEmail(raw)).toBe("Message body.\n\nKind regards,\nSara");
  });

  it("handles CRLF and empty input", () => {
    expect(cleanIngestedEmail("Hi\r\n\r\nOn 1 Jan 2026, X wrote:\r\nold")).toBe("Hi");
    expect(cleanIngestedEmail("")).toBe("");
    expect(cleanIngestedEmail(null)).toBe("");
  });
});
